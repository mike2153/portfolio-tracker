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

from debug_logger import DebugLogger, LoggingConfig
from supa_api.supa_api_auth import require_authenticated_user
from supa_api.supa_api_transactions import supa_api_get_transaction_summary
from services.price_manager import price_manager
from services.portfolio_calculator import portfolio_calculator
from services.portfolio_metrics_manager import portfolio_metrics_manager
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

    #logger.info("🔐 JWT token present: %s", bool(token))
    #logger.info("🔐 User ID        : %s", uid)

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
    force_refresh: bool = Query(False, description="Force refresh cache"),
) -> Dict[str, Any]:
    """Return portfolio snapshot + market blurb for the dashboard."""

    #logger.info("📥 Dashboard requested for %s", user.get("email", "<unknown>"))

    # --- Auth --------------------------------------------------------------
    uid, jwt = _assert_jwt(user)
    
    try:
        # --- Use PortfolioMetricsManager for simplified data fetching -------
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=uid,
            user_token=jwt,
            metric_type="dashboard",
            force_refresh=force_refresh
        )
        
        # --- Get transaction summary separately (not yet in metrics manager) --
        try:
            summary = await supa_api_get_transaction_summary(uid, user_token=jwt)
        except Exception as e:
            DebugLogger.log_error(__file__, "backend_api_get_dashboard/summary", e, user_id=uid)
            summary = {
                "total_invested": 0,
                "total_sold": 0,
                "net_invested": 0,
                "total_transactions": 0,
            }
        
        # --- Trigger background price update for user's portfolio -------------
        # This runs in the background and doesn't block the dashboard response
        # Always check for price updates to ensure we have the latest data
        logger.info(f"[Dashboard] Triggering background price update for user {uid}")
        asyncio.create_task(
            price_manager.update_user_portfolio_prices(uid, jwt)
        )
        
        # --- Build response for backward compatibility ---------------------
        daily_change = daily_change_pct = 0.0  # TODO: derive from yesterday's prices.
        
        # Transform holdings to match existing format
        holdings_with_allocation = []
        for holding in metrics.holdings[:5]:  # Top 5 holdings
            holding_dict = {
                "symbol": holding.symbol,
                "quantity": float(holding.quantity),
                "avg_cost": float(holding.avg_cost),
                "total_cost": float(holding.total_cost),
                "current_price": float(holding.current_price),
                "current_value": float(holding.current_value),
                "allocation": holding.allocation_percent,
                "total_gain_loss": float(holding.gain_loss),
                "total_gain_loss_percent": holding.gain_loss_percent,
                "gain_loss": float(holding.gain_loss),  # Keep both for compatibility
                "gain_loss_percent": holding.gain_loss_percent,
            }
            holdings_with_allocation.append(holding_dict)
        
        resp = {
            "success": True,
            "portfolio": {
                "total_value": float(metrics.performance.total_value),
                "total_cost": float(metrics.performance.total_cost),
                "total_gain_loss": float(metrics.performance.total_gain_loss),
                "total_gain_loss_percent": metrics.performance.total_gain_loss_percent,
                "daily_change": daily_change,
                "daily_change_percent": daily_change_pct,
                "holdings_count": len(metrics.holdings),
            },
            "top_holdings": holdings_with_allocation,
            "transaction_summary": summary,
            "cache_status": metrics.cache_status,  # Include cache status for monitoring
            "computation_time_ms": metrics.computation_time_ms,
        }
        
        #logger.info("✅ Dashboard payload ready (cache: %s)", metrics.cache_status)
        return resp
        
    except Exception as e:
        # Fallback to old method if metrics manager fails
        logger.error(f"PortfolioMetricsManager failed, falling back to direct calls: {e}")
        
        # --- Launch parallel data fetches -------------------------------------
        portfolio_task = asyncio.create_task(portfolio_calculator.calculate_holdings(uid, user_token=jwt))
        summary_task   = asyncio.create_task(supa_api_get_transaction_summary(uid, user_token=jwt))
            
        portfolio, summary = await asyncio.gather(
                portfolio_task,
                summary_task,
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


        # Coerce to dictionaries for static typing
        portfolio_dict: Dict[str, Any] = cast(Dict[str, Any], portfolio)
        summary_dict: Dict[str, Any] = cast(Dict[str, Any], summary)

        # --- Build response ----------------------------------------------------
        daily_change = daily_change_pct = 0.0  # TODO: derive from yesterday's prices.
        
        # Calculate holdings_count since portfolio_calculator doesn't provide it
        holdings_count = len(portfolio_dict.get("holdings", []))
        
        # Add allocation to each holding for compatibility
        total_value = portfolio_dict.get("total_value", 0)
        holdings_with_allocation = []
        for holding in portfolio_dict.get("holdings", []):
            holding_with_allocation = holding.copy()
            holding_with_allocation["allocation"] = (holding["current_value"] / total_value * 100) if total_value > 0 else 0
            # Rename fields for compatibility
            holding_with_allocation["total_gain_loss"] = holding.get("gain_loss", 0)
            holding_with_allocation["total_gain_loss_percent"] = holding.get("gain_loss_percent", 0)
            holdings_with_allocation.append(holding_with_allocation)

        resp = {
            "success": True,
            "portfolio": {
                "total_value": portfolio_dict.get("total_value", 0),
                "total_cost": portfolio_dict.get("total_cost", 0),
                "total_gain_loss": portfolio_dict.get("total_gain_loss", 0),
                "total_gain_loss_percent": portfolio_dict.get("total_gain_loss_percent", 0),
                "daily_change": daily_change,
                "daily_change_percent": daily_change_pct,
                "holdings_count": holdings_count,
            },
            "top_holdings": holdings_with_allocation[:5],
            "transaction_summary": summary_dict,
        }

        #logger.info("✅ Dashboard payload ready")
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

    #logger.info("📥 Performance period=%s benchmark=%s", period, benchmark)
    #logger.info("🔐 User authenticated: %s", user.get("email", "<unknown>"))
    
    # The require_authenticated_user dependency already validates auth
    # If we reach here, auth is valid - extract JWT
    uid, jwt = _assert_jwt(user)
        
    # --- Lazy imports (avoid circular deps) -------------------------------
    from services.portfolio_calculator import portfolio_calculator
    from services.index_sim_service import (
        IndexSimulationService as ISS,
        IndexSimulationUtils as ISU,
    )
        
    # --- Validate benchmark ----------------------------------------------
    benchmark = benchmark.upper()
    if not ISU.validate_benchmark(benchmark):
            raise HTTPException(status_code=400, detail=f"Unsupported benchmark: {benchmark}")
        
    # --- Resolve date range ----------------------------------------------
    start_date, end_date = portfolio_calculator._compute_date_range(period)
    #logger.info("📅 Range: %s → %s", start_date, end_date)
    
    # --- Trigger background price update for user's portfolio -------------
    logger.info(f"[Performance] Triggering background price update for user {uid}")
    asyncio.create_task(
        price_manager.update_user_portfolio_prices(uid, jwt)
    )
        
    # --- Portfolio calculation in background -----------------------------
    portfolio_task = asyncio.create_task(
        portfolio_calculator.calculate_portfolio_time_series(uid, jwt, period)
    )
        
    # --- Build rebalanced index series for this timeframe --------------
    #logger.info(f"[backend_api_get_performance] 🎯 Using REBALANCED index simulation for accurate comparison")
    index_series: List[Tuple[date, Decimal]] = await ISS.get_index_sim_series(  # type: ignore[arg-type]
        user_id=uid,
        benchmark=benchmark,
        start_date=start_date,
        end_date=end_date,
        user_token=jwt
    )

    # --- Await portfolio series ------------------------------------------
    portfolio_result = await portfolio_task
    if isinstance(portfolio_result, Exception):
        raise HTTPException(status_code=500, detail="Portfolio time-series calculation failed")
    # Support both old and new return types for backward compatibility
    if isinstance(portfolio_result, tuple) and len(portfolio_result) == 2:
        portfolio_series, portfolio_meta = portfolio_result
    else:
        portfolio_series = portfolio_result
        portfolio_meta = {"no_data": False}
    # === INDEX-ONLY FALLBACK MODE ===
    # If no portfolio data, show index-only performance instead of empty response
    if portfolio_meta.get("no_data"):
        logger.warning("[backend_api_get_performance] No portfolio data for this period")
        #logger.info("[backend_api_get_performance] 🎯 Activating INDEX-ONLY FALLBACK MODE")
        #logger.info("[backend_api_get_performance] 📊 User will see benchmark performance instead of empty charts")
        
        # Get index-only series using the new method
        try:
            index_only_series, index_only_meta = await portfolio_calculator.calculate_index_time_series(
                user_id=uid,
                user_token=jwt,
                range_key=period,
                benchmark=benchmark
            )
            
            if index_only_meta.get("no_data"):
                logger.error("[backend_api_get_performance] ❌ Even index-only data unavailable")
                return {
                    "success": False,
                    "period": period,
                    "benchmark": benchmark,
                    "portfolio_performance": [],
                    "benchmark_performance": [],
                    "metadata": {
                        "no_data": True,
                        "index_only": True,
                        "error": "No data available for portfolio or benchmark",
                        "user_guidance": index_only_meta.get("user_guidance", "No data available"),
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "benchmark_name": benchmark,
                        "calculation_timestamp": datetime.utcnow().isoformat(),
                    },
                    "performance_metrics": {},
                }
            
            # Format index-only data for chart display
            #logger.info("[backend_api_get_performance] ✅ Index-only data retrieved: %d points", len(index_only_series))
            
            # Convert to chart format
            index_only_chart_data = []
            for d, v in index_only_series:
                chart_point = {"date": d.isoformat(), "value": float(v)}
                index_only_chart_data.append(chart_point)
    
            
            #logger.info("[backend_api_get_performance] 🎯 INDEX-ONLY MODE: Returning %d benchmark data points", len(index_only_chart_data))
            
            return {
                "success": True,
                "period": period,
                "benchmark": benchmark,
                "portfolio_performance": [],  # Empty - no portfolio data
                "benchmark_performance": index_only_chart_data,  # Show benchmark performance
                "metadata": {
                    "no_data": False,  # We have data (benchmark data)
                    "index_only": True,  # Signal this is index-only mode
                    "reason": portfolio_meta.get("reason", "no_portfolio_data"),
                    "user_guidance": portfolio_meta.get("user_guidance", "Add transactions to see portfolio comparison"),
                    "start_date": index_only_chart_data[0]["date"] if index_only_chart_data else start_date.isoformat(),
                    "end_date": index_only_chart_data[-1]["date"] if index_only_chart_data else end_date.isoformat(),
                    "benchmark_name": benchmark,
                    "calculation_timestamp": datetime.utcnow().isoformat(),
                    "chart_type": "index_only_mode",
                },
                "performance_metrics": {
                    "portfolio_return_pct": 0,
                    "index_return_pct": ((float(index_only_series[-1][1]) - float(index_only_series[0][1])) / float(index_only_series[0][1])) * 100 if len(index_only_series) >= 2 and index_only_series[0][1] != 0 else 0,
                    "outperformance_pct": 0,
                    "index_only_mode": True
                },
            }
            
        except Exception as e:
            logger.error("[backend_api_get_performance] ❌ Index-only fallback failed: %s", str(e))
            return {
                "success": False,
                "period": period,
                "benchmark": benchmark,
                "portfolio_performance": [],
                "benchmark_performance": [],
                "metadata": {
                    "no_data": True,
                    "error": f"Failed to retrieve data: {str(e)}",
                    "user_guidance": portfolio_meta.get("user_guidance", "Please try again or contact support"),
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "benchmark_name": benchmark,
                    "calculation_timestamp": datetime.utcnow().isoformat(),
                },
                "performance_metrics": {},
            }

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

    # 🔍 FILTER: Remove zero values and ensure only trading days with actual data
   # logger.info("🔄 Filtering portfolio series - received %d data points", len(portfolio_series))
    
    
    # Filter out zero values (non-trading days) and convert to Decimal
    portfolio_series_filtered = []
    zero_count = 0
    for d, v in portfolio_series:
        decimal_value = _safe_decimal(v)
        if decimal_value > 0:
            portfolio_series_filtered.append((d, decimal_value))
        else:
            zero_count += 1
    
    #logger.info("✅ Portfolio series filtered - %d trading days with actual values, %d zero values removed", 
    #            len(portfolio_series_filtered), zero_count)
    #logger.info("📊 Filtered series sample: %s", portfolio_series_filtered[:3] if len(portfolio_series_filtered) >= 3 else portfolio_series_filtered)
    
    # Log all filtered dates for debugging
    #if portfolio_series_filtered:
        #logger.info("📅 First trading day: %s = $%s", portfolio_series_filtered[0][0], portfolio_series_filtered[0][1])
        #logger.info("📅 Last trading day: %s = $%s", portfolio_series_filtered[-1][0], portfolio_series_filtered[-1][1])
    #else:
        #logger.warning("⚠️ No trading days with portfolio values found!")
    
    # Use filtered series for calculations
    portfolio_series_dec = portfolio_series_filtered
    
    # 🔍 DEBUG: Convert index series to Decimal type for precise calculations
    #logger.info("🔄 Converting index series to Decimal - received %d data points", len(index_series))

    
    index_series_dec: List[Tuple[date, Decimal]] = [
        (d, _safe_decimal(v)) for d, v in index_series
    ]
    #logger.info("✅ Index series converted to Decimal - %d points processed", len(index_series_dec))

    #logger.info("🎯 REBALANCED INDEX: No normalization needed - index already starts at portfolio value")
    #logger.info(f"📊 Portfolio start value: ${portfolio_series_dec[0][1] if portfolio_series_dec else 'N/A'}")
    #logger.info(f"📊 Index start value: ${index_series_dec[0][1] if index_series_dec else 'N/A'}")
    
    if portfolio_series_dec and index_series_dec:
        value_difference = abs(float(portfolio_series_dec[0][1]) - float(index_series_dec[0][1]))
        #logger.info(f"📊 Start value difference: ${value_difference:.2f} (should be minimal)")
        
        if value_difference > 1.0:  # More than $1 difference suggests an issue
            logger.warning(f"⚠️ Large start value difference detected: ${value_difference:.2f}")
            logger.warning(f"⚠️ This may indicate the rebalanced method needs adjustment")
    
    # Use index series as-is (no scaling needed)
    final_index_series_dec = index_series_dec

    # --- Format & compute metrics ----------------------------------------
    #logger.info("🔧 Formatting series for response...")

    
    formatted = portfolio_calculator.format_series_for_response(portfolio_series_dec, final_index_series_dec)
    #logger.info("✅ Series formatted successfully")

    
    #logger.info("🧮 Calculating performance metrics...")
    metrics = ISU.calculate_performance_metrics(portfolio_series_dec, final_index_series_dec)
    #logger.info("✅ Performance metrics calculated")


    #logger.info("✅ Perf ready – %s portfolio pts | %s index pts", len(portfolio_series), len(final_index_series_dec))

    # 🔍 CHART FORMAT: Create discrete data points for chart plotting (no time-series gaps)
    #logger.info("🔧 Formatting data for discrete chart plotting...")
    #logger.info("📊 Input portfolio series: %d points", len(portfolio_series_dec))
    #logger.info("📊 Input index series: %d points", len(final_index_series_dec))
    
    # Create arrays of actual trading days only (no zero-value gaps)
    portfolio_chart_data = []
    for d, v in portfolio_series_dec:
        chart_point = {"date": d.isoformat(), "value": float(v)}
        portfolio_chart_data.append(chart_point)
        
    
    # Match index series to portfolio dates for consistent chart data
    portfolio_dates = {d for d, v in portfolio_series_dec}
    #logger.info("📅 Portfolio dates available: %d unique dates", len(portfolio_dates))
    
    index_chart_data = []
    for d, v in final_index_series_dec:
        if d in portfolio_dates:
            chart_point = {"date": d.isoformat(), "value": float(v)}
            index_chart_data.append(chart_point)
    
    #logger.info("✅ Chart data formatted - %d portfolio points, %d index points", 
    #            len(portfolio_chart_data), len(index_chart_data))
    
    # Log sample of final chart data
   # if portfolio_chart_data:
        #logger.info("📊 First portfolio chart point: %s", portfolio_chart_data[0])
        #logger.info("📊 Last portfolio chart point: %s", portfolio_chart_data[-1])
    #if index_chart_data:
        #logger.info("📊 First index chart point: %s", index_chart_data[0])
        #logger.info("📊 Last index chart point: %s", index_chart_data[-1])
    
    return {
        "success": True,
        "period": period,
        "benchmark": benchmark,
        "portfolio_performance": portfolio_chart_data,
        "benchmark_performance": index_chart_data,
        "metadata": {
            "trading_days_count": len(portfolio_chart_data),
            "start_date": portfolio_chart_data[0]["date"] if portfolio_chart_data else None,
            "end_date": portfolio_chart_data[-1]["date"] if portfolio_chart_data else None,
            "benchmark_name": benchmark,
            "calculation_timestamp": datetime.utcnow().isoformat(),
            "chart_type": "discrete_trading_days",  # Signal to frontend this is discrete data
        },
        "performance_metrics": metrics,
    }

@dashboard_router.post("/debug/toggle-info-logging")
async def toggle_info_logging(current_user: dict = Depends(require_authenticated_user)):
    """
    Toggle info logging on/off at runtime
    Requires authentication for security
    """
    try:
        new_state = LoggingConfig.toggle_info_logging()
        return {
            "success": True,
            "info_logging_enabled": new_state,
            "message": f"Info logging {'enabled' if new_state else 'disabled'}"
        }
    except Exception as e:
        logger.error(f"❌ Error toggling info logging: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@dashboard_router.get("/debug/logging-status")
async def get_logging_status(current_user: dict = Depends(require_authenticated_user)):
    """
    Get current logging configuration status
    """
    return {
        "info_logging_enabled": LoggingConfig.is_info_enabled()
    }

@dashboard_router.post("/debug/reset-circuit-breaker")
async def reset_circuit_breaker(
    service: Optional[str] = Query(None, description="Service name (alpha_vantage, dividend_api) or None for all"),
    current_user: dict = Depends(require_authenticated_user)
):
    """
    Reset circuit breaker for price services
    Useful when the circuit breaker is blocking API calls after failures
    """
    try:
        from services.price_manager import price_manager
        price_manager.reset_circuit_breaker(service)
        
        return {
            "success": True,
            "message": f"Circuit breaker reset for {service if service else 'all services'}"
        }
    except Exception as e:
        logger.error(f"Error resetting circuit breaker: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@dashboard_router.get("/dashboard/gainers")
@DebugLogger.log_api_call(
    api_name="BACKEND_API",
    sender="FRONTEND",
    receiver="BACKEND",
    operation="GET_GAINERS",
)
async def backend_api_get_gainers(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False),
) -> Dict[str, Any]:
    """Get top gaining holdings for the dashboard."""
    try:
        uid, jwt = _assert_jwt(user)
        
        # Get portfolio metrics
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=uid,
            user_token=jwt,
            metric_type="gainers",
            force_refresh=force_refresh
        )
        
        if not metrics.holdings:
            return {
                "success": True,
                "data": {"items": []},
                "message": "No holdings found"
            }
        
        # Filter for positive gains and sort by gain percentage
        gainers = [
            h for h in metrics.holdings 
            if h.gain_loss_percent > 0 and h.quantity > 0
        ]
        gainers.sort(key=lambda x: x.gain_loss_percent, reverse=True)
        
        # Format top 5 gainers
        top_gainers = []
        for holding in gainers[:5]:
            top_gainers.append({
                "ticker": holding.symbol,
                "name": holding.symbol,  # We don't have company names yet
                "value": float(holding.current_value),
                "changePercent": holding.gain_loss_percent,
                "changeValue": float(holding.gain_loss)
            })
        
        return {
            "success": True,
            "data": {"items": top_gainers},
            "cache_status": metrics.cache_status
        }
        
    except Exception as e:
        DebugLogger.log_error(__file__, "backend_api_get_gainers", e, user_id=uid)
        # Fallback to direct call
        try:
            portfolio = await portfolio_calculator.calculate_holdings(uid, jwt)
            
            if not portfolio or not portfolio.get("holdings"):
                return {
                    "success": True,
                    "data": {"items": []},
                    "message": "No holdings found"
                }
            
            holdings = portfolio["holdings"]
            
            # Filter for positive gains and sort by gain percentage
            gainers = [
                h for h in holdings 
                if h.get("gain_loss_percent", 0) > 0 and h.get("quantity", 0) > 0
            ]
            gainers.sort(key=lambda x: x.get("gain_loss_percent", 0), reverse=True)
            
            # Format top 5 gainers
            top_gainers = []
            for holding in gainers[:5]:
                top_gainers.append({
                    "ticker": holding["symbol"],
                    "name": holding.get("name", holding["symbol"]),
                    "value": holding.get("current_value", 0),
                    "changePercent": holding.get("gain_loss_percent", 0),
                    "changeValue": holding.get("gain_loss", 0)
                })
            
            return {
                "success": True,
                "data": {"items": top_gainers}
            }
        except Exception as e2:
            return {
                "success": False,
                "error": str(e2),
                "data": {"items": []}
            }

@dashboard_router.get("/dashboard/losers")
@DebugLogger.log_api_call(
    api_name="BACKEND_API",
    sender="FRONTEND",
    receiver="BACKEND",
    operation="GET_LOSERS",
)
async def backend_api_get_losers(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False),
) -> Dict[str, Any]:
    """Get top losing holdings for the dashboard."""
    try:
        uid, jwt = _assert_jwt(user)
        
        # Get portfolio metrics
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=uid,
            user_token=jwt,
            metric_type="losers",
            force_refresh=force_refresh
        )
        
        if not metrics.holdings:
            return {
                "success": True,
                "data": {"items": []},
                "message": "No holdings found"
            }
        
        # Filter for negative gains and sort by gain percentage (ascending for biggest losses)
        losers = [
            h for h in metrics.holdings 
            if h.gain_loss_percent < 0 and h.quantity > 0
        ]
        losers.sort(key=lambda x: x.gain_loss_percent)
        
        # Format top 5 losers
        top_losers = []
        for holding in losers[:5]:
            top_losers.append({
                "ticker": holding.symbol,
                "name": holding.symbol,  # We don't have company names yet
                "value": float(holding.current_value),
                "changePercent": abs(holding.gain_loss_percent),  # Show as positive for display
                "changeValue": abs(float(holding.gain_loss))  # Show as positive for display
            })
        
        return {
            "success": True,
            "data": {"items": top_losers},
            "cache_status": metrics.cache_status
        }
        
    except Exception as e:
        DebugLogger.log_error(__file__, "backend_api_get_losers", e, user_id=uid)
        # Fallback to direct call
        try:
            portfolio = await portfolio_calculator.calculate_holdings(uid, jwt)
            
            if not portfolio or not portfolio.get("holdings"):
                return {
                    "success": True,
                    "data": {"items": []},
                    "message": "No holdings found"
                }
            
            holdings = portfolio["holdings"]
            
            # Filter for negative gains and sort by gain percentage (ascending for biggest losses)
            losers = [
                h for h in holdings 
                if h.get("gain_loss_percent", 0) < 0 and h.get("quantity", 0) > 0
            ]
            losers.sort(key=lambda x: x.get("gain_loss_percent", 0))
            
            # Format top 5 losers
            top_losers = []
            for holding in losers[:5]:
                top_losers.append({
                    "ticker": holding["symbol"],
                    "name": holding.get("name", holding["symbol"]),
                    "value": holding.get("current_value", 0),
                    "changePercent": abs(holding.get("gain_loss_percent", 0)),  # Show as positive for display
                    "changeValue": abs(holding.get("gain_loss", 0))  # Show as positive for display
                })
            
            return {
                "success": True,
                "data": {"items": top_losers}
            }
        except Exception as e2:
            return {
                "success": False,
                "error": str(e2),
                "data": {"items": []}
            }
