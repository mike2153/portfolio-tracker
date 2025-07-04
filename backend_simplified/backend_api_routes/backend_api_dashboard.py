"""
Backend‑API routes for dashboard & performance endpoints.
A rewired, cache‑aware, RLS‑compatible implementation.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, date
from typing import Any, Dict, List, Tuple, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query

from debug_logger import DebugLogger
from supa_api.supa_api_auth import require_authenticated_user
from supa_api.supa_api_portfolio import supa_api_calculate_portfolio
from supa_api.supa_api_transactions import supa_api_get_transaction_summary
from vantage_api.vantage_api_quotes import vantage_api_get_quote
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP  # local import

# Lazy‑imported heavy modules (they load Supabase clients, etc.)
# They must stay inside route bodies to avoid circular imports.

logger = logging.getLogger(__name__)

dashboard_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

class _AuthContext(Tuple[str, str]):
    """Tiny helper for (user_id, jwt)."""

    @property
    def user_id(self) -> str:  # noqa: D401 – property, not function.
        return self[0]

    @property
    def jwt(self) -> str:
        return self[1]


def _assert_jwt(user: Dict[str, Any]) -> _AuthContext:  # pragma: no cover
    """Extract and validate the caller's JWT for Supabase RLS access."""
    token: Optional[str] = user.get("access_token")
    uid: str = user["id"]

    logger.info("🔐 JWT token present: %s", bool(token))
    logger.info("🔐 User ID        : %s", uid)

    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")

    return _AuthContext((uid, token))


# ---------------------------------------------------------------------------
# /dashboard  –  consolidated snapshot
# ---------------------------------------------------------------------------

@dashboard_router.get("/dashboard")
@DebugLogger.log_api_call(
    api_name="BACKEND_API",
    sender="FRONTEND",
    receiver="BACKEND",
    operation="GET_DASHBOARD",
)
async def backend_api_get_dashboard(
    user: Dict[str, Any] = Depends(require_authenticated_user),
) -> Dict[str, Any]:
    """Return portfolio snapshot + market blurb for the dashboard."""

    logger.info("📥 Dashboard requested for %s", user.get("email", "<unknown>"))

    # --- Auth --------------------------------------------------------------
    uid, jwt = _assert_jwt(user)
        
    # --- Launch parallel data fetches -------------------------------------
    portfolio_task = asyncio.create_task(supa_api_calculate_portfolio(uid, user_token=jwt))
    summary_task   = asyncio.create_task(supa_api_get_transaction_summary(uid, user_token=jwt))
    spy_task       = asyncio.create_task(vantage_api_get_quote("SPY"))
        
    portfolio, summary, spy_quote = await asyncio.gather(
            portfolio_task,
            summary_task,
            spy_task,
        return_exceptions=True,
        )
        
    # --- Error handling ----------------------------------------------------
    if isinstance(portfolio, Exception):
        DebugLogger.log_error(__file__, "backend_api_get_dashboard/portfolio", portfolio, user_id=uid)
        portfolio = {
            "holdings": [],
                "total_value": 0,
                "total_cost": 0,
                "total_gain_loss": 0,
                "total_gain_loss_percent": 0,
            "holdings_count": 0,
        }

    if isinstance(summary, Exception):
        DebugLogger.log_error(__file__, "backend_api_get_dashboard/summary", summary, user_id=uid)
        summary = {
                "total_invested": 0,
                "total_sold": 0,
                "net_invested": 0,
            "total_transactions": 0,
        }

    if isinstance(spy_quote, Exception):
        logger.warning("Failed to fetch SPY quote: %s", spy_quote)
        spy_quote = None

    # Coerce to dictionaries for static typing
    portfolio_dict: Dict[str, Any] = cast(Dict[str, Any], portfolio)
    summary_dict: Dict[str, Any] = cast(Dict[str, Any], summary)

    # --- Build response ----------------------------------------------------
    daily_change = daily_change_pct = 0.0  # TODO: derive from yesterday's prices.

    resp = {
        "success": True,
        "portfolio": {
            "total_value": portfolio_dict.get("total_value", 0),
            "total_cost": portfolio_dict.get("total_cost", 0),
            "total_gain_loss": portfolio_dict.get("total_gain_loss", 0),
            "total_gain_loss_percent": portfolio_dict.get("total_gain_loss_percent", 0),
            "daily_change": daily_change,
            "daily_change_percent": daily_change_pct,
            "holdings_count": portfolio_dict.get("holdings_count", 0),
        },
        "top_holdings": portfolio_dict.get("holdings", [])[:5],
        "transaction_summary": summary_dict,
        "market_data": {
            "spy": spy_quote,
        },
    }

    logger.info("✅ Dashboard payload ready")
    return resp


# ---------------------------------------------------------------------------
# /dashboard/performance – time-series comparison
# ---------------------------------------------------------------------------

@dashboard_router.get("/dashboard/performance")
@DebugLogger.log_api_call(
    api_name="BACKEND_API",
    sender="FRONTEND",
    receiver="BACKEND",
    operation="GET_PERFORMANCE",
)
async def backend_api_get_performance(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    period: str = "1M",  # 1D, 1W, 1M, 3M, 6M, 1Y, ALL
    benchmark: str = Query("SPY", regex=r"^[A-Z]{1,5}$"),
) -> Dict[str, Any]:
    """Return portfolio vs index performance for the requested period."""

    logger.info("📥 Performance period=%s benchmark=%s", period, benchmark)
    logger.info("🔐 User authenticated: %s", user.get("email", "<unknown>"))
    
    # The require_authenticated_user dependency already validates auth
    # If we reach here, auth is valid - extract JWT
    uid, jwt = _assert_jwt(user)
        
    # --- Lazy imports (avoid circular deps) -------------------------------
    from services.portfolio_service import (
        PortfolioTimeSeriesService as PTS,
        PortfolioServiceUtils as PSU,
    )
    from services.index_sim_service import (
        IndexSimulationService as ISS,
        IndexSimulationUtils as ISU,
    )
        
    # --- Validate benchmark ----------------------------------------------
    benchmark = benchmark.upper()
    if not ISU.validate_benchmark(benchmark):
            raise HTTPException(status_code=400, detail=f"Unsupported benchmark: {benchmark}")
        
    # --- Resolve date range ----------------------------------------------
    start_date, end_date = PSU.compute_date_range(period)
    logger.info("📅 Range: %s → %s", start_date, end_date)
        
    # --- Portfolio calculation in background -----------------------------
    portfolio_task = asyncio.create_task(
        PTS.get_portfolio_series(uid, start_date, end_date, user_token=jwt)
        )
        
    # --- Build index series fresh ---------------------------------------
    index_series: List[Tuple[date, Decimal]] = await ISS.get_index_sim_series(  # type: ignore[arg-type]
        user_id=uid,
        benchmark=benchmark,
        start_date=start_date,
        end_date=end_date,
        user_token=jwt
    )

    # --- Await portfolio series ------------------------------------------
    portfolio_series: List[Tuple[date, Any]] = await portfolio_task  # values may be float or Decimal
    if isinstance(portfolio_series, Exception):
        raise HTTPException(status_code=500, detail="Portfolio time-series calculation failed")

    # --- Helper: safe Decimal coercion --------------------------------------
    def _safe_decimal(raw: Any) -> Decimal:  # noqa: WPS430 (nested def acceptable here)
        """Convert raw value to Decimal; on failure return quantised 0.00 and log."""
        if isinstance(raw, Decimal):
            return raw
        try:
            return Decimal(str(raw))
        except InvalidOperation:
            logger.warning("↪ Invalid numeric value %s – substituting 0", raw)
            return Decimal("0").quantize(Decimal("1.00"), ROUND_HALF_UP)

    # 🔍 DEBUG: Convert portfolio series to Decimal type for precise calculations
    logger.info("🔄 Converting portfolio series to Decimal - received %d data points", len(portfolio_series))
    logger.debug("📊 Portfolio series sample: %s", portfolio_series[:3] if len(portfolio_series) >= 3 else portfolio_series)
    
    portfolio_series_dec: List[Tuple[date, Decimal]] = [
        (d, _safe_decimal(v)) for d, v in portfolio_series
    ]
    logger.info("✅ Portfolio series converted to Decimal - %d points processed", len(portfolio_series_dec))
    
    # 🔍 DEBUG: Convert index series to Decimal type for precise calculations
    logger.info("🔄 Converting index series to Decimal - received %d data points", len(index_series))
    logger.debug("📊 Index series sample: %s", index_series[:3] if len(index_series) >= 3 else index_series)
    
    index_series_dec: List[Tuple[date, Decimal]] = [
        (d, _safe_decimal(v)) for d, v in index_series
    ]
    logger.info("✅ Index series converted to Decimal - %d points processed", len(index_series_dec))

    # --- Normalise index series to match portfolio start value ---------
    if portfolio_series_dec and index_series_dec and index_series_dec[0][1] != 0:
        scale_factor = portfolio_series_dec[0][1] / index_series_dec[0][1]
        index_series_dec = [
            (d, v * scale_factor) for d, v in index_series_dec
        ]
        logger.info(
            "🔧 Normalised index series by factor %.6f to match start value",
            float(scale_factor),
        )

    # --- Format & compute metrics ----------------------------------------
    logger.info("🔧 Formatting series for response...")
    logger.debug("📊 Portfolio series range: %s to %s", 
                 portfolio_series_dec[0][0] if portfolio_series_dec else "N/A",
                 portfolio_series_dec[-1][0] if portfolio_series_dec else "N/A")
    logger.debug("📊 Index series range: %s to %s", 
                 index_series_dec[0][0] if index_series_dec else "N/A",
                 index_series_dec[-1][0] if index_series_dec else "N/A")
    
    formatted = PSU.format_series_for_response(portfolio_series_dec, index_series_dec)
    logger.info("✅ Series formatted successfully")
    logger.debug("📊 Formatted data keys: %s", list(formatted.keys()))
    
    logger.info("🧮 Calculating performance metrics...")
    metrics = ISU.calculate_performance_metrics(portfolio_series_dec, index_series_dec)
    logger.info("✅ Performance metrics calculated")
    logger.debug("📊 Metrics keys: %s", list(metrics.keys()) if metrics else "No metrics")

    logger.info("✅ Perf ready – %s portfolio pts | %s index pts", len(portfolio_series), len(index_series))

    return {
            "success": True,
            "period": period,
            "benchmark": benchmark,
        "portfolio_performance": [
            {"date": d, "total_value": v, "indexed_performance": 0}
            for d, v in zip(formatted["dates"], formatted["portfolio"])
            ],
            "benchmark_performance": [
            {"date": d, "total_value": v, "indexed_performance": 0}
            for d, v in zip(formatted["dates"], formatted["index"])
            ],
            "metadata": {
            **formatted["metadata"],
                "benchmark_name": benchmark,
            "calculation_timestamp": datetime.utcnow().isoformat(),
        },
        "performance_metrics": metrics,
    }
