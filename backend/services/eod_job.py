from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Dict, Any, List, Tuple

from supa_api.supa_api_client import get_supa_service_client
from supa_api.supa_api_historical_prices import supa_api_store_historical_prices_batch
from services.price_manager import price_manager
from vantage_api.vantage_api_quotes import vantage_api_get_daily_adjusted

logger = logging.getLogger(__name__)


JOB_NAME = "nightly_eod"


async def _has_job_run(run_date: date) -> bool:
    client = get_supa_service_client()
    resp = client.table("job_locks").select("job_name").eq("job_name", JOB_NAME).eq("run_date", run_date.isoformat()).execute()
    return bool(resp.data)


async def _mark_job_run(run_date: date) -> None:
    client = get_supa_service_client()
    client.table("job_locks").upsert({"job_name": JOB_NAME, "run_date": run_date.isoformat()}).execute()


async def _symbols_to_refresh() -> List[str]:
    client = get_supa_service_client()
    symbols: set[str] = set()
    try:
        tx = client.table("transactions").select("symbol").execute()
        for row in tx.data or []:
            if row.get("symbol"):
                symbols.add(row["symbol"].upper())
    except Exception as e:
        logger.warning(f"[EOD] failed to read transactions: {e}")
    try:
        wl = client.table("watchlist").select("symbol").execute()
        for row in wl.data or []:
            if row.get("symbol"):
                symbols.add(row["symbol"].upper())
    except Exception:
        pass
    return sorted(symbols)


async def _upsert_prices_for_symbols(symbols: List[str], run_date: date) -> Tuple[int, int]:
    updated = 0
    failed = 0
    for symbol in symbols:
        try:
            av = await vantage_api_get_daily_adjusted(symbol)
            if not av or av.get("status") != "success":
                failed += 1
                continue
            ts = av.get("data", {})
            if not ts:
                failed += 1
                continue
            # Prefer specific run_date, else latest available
            d = run_date.isoformat()
            if d not in ts:
                # fallback to most recent
                if not ts:
                    failed += 1
                    continue
                d = sorted(ts.keys())[-1]
            vals = ts[d]
            record = {
                "symbol": symbol,
                "date": d,
                "open": str(vals.get("1. open", "0")),
                "high": str(vals.get("2. high", "0")),
                "low": str(vals.get("3. low", "0")),
                # use close (not adjusted)
                "close": str(vals.get("4. close", vals.get("5. adjusted close", "0"))),
                "adjusted_close": str(vals.get("5. adjusted close", vals.get("4. close", "0"))),
                "volume": int(vals.get("6. volume", 0)),
                "dividend_amount": str(vals.get("7. dividend amount", "0")),
                "split_coefficient": str(vals.get("8. split coefficient", "1")),
            }
            await supa_api_store_historical_prices_batch([record])
            updated += 1
        except Exception:
            logger.exception(f"[EOD] upsert failed for {symbol}")
            failed += 1
    return updated, failed


async def run_nightly_eod(now_utc: date | None = None, *, force: bool = False) -> Dict[str, Any]:
    run_date = now_utc or datetime.now(timezone.utc).date()
    if not force and await _has_job_run(run_date):
        return {"success": True, "skipped": True, "message": "already ran"}

    symbols = await _symbols_to_refresh()
    upd, fail = await _upsert_prices_for_symbols(symbols, run_date)

    # Note: FX update is handled by ForexManager on-demand for now
    # Future: add EOD FX prefetch here if needed

    await _mark_job_run(run_date)
    return {"success": True, "updated": upd, "failed": fail, "run_date": run_date.isoformat()}


