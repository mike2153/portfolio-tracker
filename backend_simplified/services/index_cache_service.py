"""
Index Series Cache Service
==========================
Manages pre‑computed index simulation data so the dashboard never waits on the
300 ms live‑simulation path.

Key features
------------
* **Cache‑first reads** – return stale data if the requested range is not fully
  covered so the UI is always fast.
* **Bulk transactional writes** – single UPSERT per batch to avoid corruption.
* **Async invalidation & rebuild queue** – fire‑and‑forget API so callers don’t
  block.
* **Prometheus metrics** – hit / miss counters and rebuild timing.

The only functional change from the previous version is that every Prometheus
counter/histogram is now supplied with the *two* label values it was declared
with, eliminating the "counter metric is missing label values" exception.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, NamedTuple, Optional, Tuple

from debug_logger import DebugLogger
from supa_api.supa_api_client import get_supa_service_client

# ---------------------------------------------------------------------------
# Prometheus metrics (gracefully optional)
# ---------------------------------------------------------------------------
try:
    from prometheus_client import Counter, Histogram  # type: ignore

    PROMETHEUS_AVAILABLE = True

    _hits_total = Counter(
        "index_cache_hits_total", "Total cache hits", ["user_id", "benchmark"]
    )
    _misses_total = Counter(
        "index_cache_misses_total", "Total cache misses", ["user_id", "benchmark"]
    )
    _rebuild_seconds = Histogram(
        "index_cache_rebuild_seconds",
        "Time spent rebuilding cache",
        ["user_id", "benchmark"],
    )
    _rebuild_failed_total = Counter(
        "index_cache_rebuild_failed_total",
        "Failed cache rebuilds",
        ["user_id", "benchmark"],
    )

    def _inc(metric, uid: str, bmk: str):  # small helper to avoid repetition
        metric.labels(uid, bmk).inc()

    def _time(metric, uid: str, bmk: str):
        return metric.labels(uid, bmk).time()

except ImportError:  # metrics are entirely optional

    PROMETHEUS_AVAILABLE = False

    class _NoOpMetric:  # pylint: disable=too-few-public-methods
        def inc(self, *_, **__):
            pass

        def observe(self, *_, **__):
            pass

        def time(self):
            return self

        # context‑manager no‑op
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    _hits_total = _misses_total = _rebuild_seconds = _rebuild_failed_total = _NoOpMetric()

    def _inc(*_):
        pass

    def _time(*_):  # type: ignore
        return _NoOpMetric()

# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)


class CacheSlice(NamedTuple):
    """Return type for :py:meth:`IndexCacheService.read_slice`."""

    data: List[Tuple[date, Decimal]]
    is_stale: bool
    cache_coverage_end: Optional[date]
    total_points: int


# ---------------------------------------------------------------------------
# Main service
# ---------------------------------------------------------------------------
class IndexCacheService:
    """Provides all cache operations used by the backend."""

    def __init__(self) -> None:
        self._service_client = None
        print(
            f"🔧 [IndexCacheService] Service initialised – Prometheus available: {PROMETHEUS_AVAILABLE}"
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    async def _get_service_client(self):
        if self._service_client is None:
            self._service_client = get_supa_service_client()
            print("🔧 [IndexCacheService] Supabase service client created")
        return self._service_client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    async def read_slice(
        self,
        user_id: str,
        benchmark: str,
        start_date: date,
        end_date: date,
    ) -> CacheSlice:
        """Return a slice of cached index data – never computes live data."""

        print("🔍 [IndexCacheService] === CACHE READ START ===")
        print(f"🔍 User        : {user_id}")
        print(f"🔍 Benchmark   : {benchmark}")
        print(f"🔍 Date range  : {start_date} → {end_date}")

        try:
            client = await self._get_service_client()

            # Step 1 — determine last cached date for this user/index
            resp_latest = (
                client.table("index_series_cache")
                .select("date")
                .eq("user_id", user_id)
                .eq("benchmark", benchmark)
                .order("date", desc=True)
                .limit(1)
                .execute()
            )

            cache_end_date: Optional[date] = None
            if resp_latest.data:
                cache_end_date = datetime.strptime(resp_latest.data[0]["date"], "%Y-%m-%d").date()
                print(f"🔍 Cache coverage ends at {cache_end_date}")
            else:
                print("🔍 No cache rows found for this user/index")

            has_full_coverage = cache_end_date is not None and cache_end_date >= end_date
            print(f"🔍 Full coverage? {has_full_coverage}")

            # Step 2 — fetch slice
            resp_slice = (
                client.table("index_series_cache")
                .select("date,value")
                .eq("user_id", user_id)
                .eq("benchmark", benchmark)
                .gte("date", start_date.isoformat())
                .lte("date", end_date.isoformat())
                .order("date")
                .execute()
            )

            data = [
                (
                    datetime.strptime(r["date"], "%Y-%m-%d").date(),
                    Decimal(str(r["value"])),
                )
                for r in resp_slice.data
            ]
            print(f"🔍 Retrieved {len(data)} rows from cache")

            # Step 3 — metrics & result
            if has_full_coverage:
                _inc(_hits_total, user_id, benchmark)
            else:
                _inc(_misses_total, user_id, benchmark)

            return CacheSlice(
                data=data,
                is_stale=not has_full_coverage,
                cache_coverage_end=cache_end_date,
                total_points=len(data),
            )

        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("Cache read failed: %s", exc)
            return CacheSlice([], True, None, 0)

    # ------------------------------------------------------------------
    async def write_bulk(
        self,
        user_id: str,
        benchmark: str,
        data_points: List[Tuple[date, Decimal]],
    ) -> bool:
        """Upsert many (date,value) rows with one request."""

        if not data_points:
            print("⚠️  No points supplied to write_bulk – skipping")
            return True

        try:
            client = await self._get_service_client()

            rows = [
                {
                    "user_id": user_id,
                    "benchmark": benchmark,
                    "date": d.isoformat(),
                    "value": float(v),
                    "created_at": datetime.utcnow().isoformat(),
                }
                for d, v in data_points
            ]

            client.table("index_series_cache").upsert(
                rows,
                on_conflict="user_id,benchmark,date",
                returning="minimal",  # lean response # type: ignore
            ).execute()
            return True

        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("Bulk upsert failed: %s", exc)
            DebugLogger.log_error(
                file_name=__file__,
                function_name="write_bulk",
                error=exc,
                user_id=user_id,
                benchmark=benchmark,
                data_points_count=len(data_points),
            )
            return False

    # ------------------------------------------------------------------
    async def invalidate_async(
        self,
        user_id: str,
        benchmarks: Optional[List[str]] = None,
    ) -> bool:
        """Delete cached rows and queue a rebuild (fire‑and‑forget)."""
        default_benchmarks = ["SPY", "QQQ", "A200", "URTH", "VTI", "VXUS"]
        targets = benchmarks or default_benchmarks

        try:
            client = await self._get_service_client()

            q = client.table("index_series_cache").delete().eq("user_id", user_id)
            if benchmarks:
                q = q.in_("benchmark", benchmarks)  # type: ignore[misc]
            q.execute()

            for bmk in targets:
                asyncio.create_task(self._queue_rebuild(user_id, bmk))
            return True

        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("Cache invalidation failed: %s", exc)
            DebugLogger.log_error(
                file_name=__file__,
                function_name="invalidate_async",
                error=exc,
                user_id=user_id,
                benchmarks=benchmarks,
            )
            return False

    # ------------------------------------------------------------------
    async def get_cache_stats(self, user_id: str) -> Dict[str, Any]:
        """Return a short summary for debugging / monitoring."""
        try:
            client = await self._get_service_client()
            resp = (
                client.table("index_series_cache")
                .select("benchmark,date")
                .eq("user_id", user_id)
                .execute()
            )

            summary: Dict[str, Any] = {
                "user_id": user_id,
                "total_cache_points": len(resp.data),
                "benchmarks": {},
                "oldest_date": None,
                "newest_date": None,
            }

            for row in resp.data:
                bmk = row["benchmark"]
                d: str = row["date"]
                summary["benchmarks"].setdefault(bmk, {"points": 0, "date_range": [d, d]})
                info = summary["benchmarks"][bmk]
                info["points"] += 1
                info["date_range"][0] = min(info["date_range"][0], d)
                info["date_range"][1] = max(info["date_range"][1], d)
                summary["oldest_date"] = d if summary["oldest_date"] is None else min(summary["oldest_date"], d)
                summary["newest_date"] = d if summary["newest_date"] is None else max(summary["newest_date"], d)

            return summary

        except Exception as exc:  # pylint: disable=broad-except
            logger.exception("get_cache_stats failed: %s", exc)
            return {"user_id": user_id, "error": str(exc)}

    # ------------------------------------------------------------------
    # Placeholder for background work
    # ------------------------------------------------------------------
    async def _queue_rebuild(self, user_id: str, benchmark: str):
        print(f"🔄 Rebuild queued for {user_id}:{benchmark}")
        # Simulate background latency
        await asyncio.sleep(1)
        # In a real deployment this would push to Celery / RQ / etc.


# ---------------------------------------------------------------------------
# Module‑level singleton – import anywhere
# ---------------------------------------------------------------------------
index_cache_service = IndexCacheService()
