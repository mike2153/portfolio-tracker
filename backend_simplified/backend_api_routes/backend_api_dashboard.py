"""
Backend‑API routes for dashboard & performance endpoints.
A rewired, cache‑aware, RLS‑compatible implementation.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, date
from typing import Any, Dict, List, Tuple, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Header

from debug_logger import DebugLogger, LoggingConfig
from supa_api.supa_api_auth import require_authenticated_user
from supa_api.supa_api_transactions import supa_api_get_transaction_summary
from services.price_manager import price_manager
from services.portfolio_calculator import portfolio_calculator
from services.portfolio_metrics_manager import portfolio_metrics_manager
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from utils.response_factory import ResponseFactory
from models.response_models import APIResponse 

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
    x_api_version: str = Header("v1", description="API version for response format"),
) -> Dict[str, Any]:
    """Return portfolio snapshot + market blurb for the dashboard."""
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] === GET DASHBOARD REQUEST START ===")
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] User email: {user.get('email', 'unknown')}")
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] User ID: {user.get('id', 'unknown')}")
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Force refresh: {force_refresh}")
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Auth headers present: {bool(user.get('access_token'))}")

    # --- Auth --------------------------------------------------------------
    uid, jwt = _assert_jwt(user)
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Extracted user_id: {uid}")
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] JWT token length: {len(jwt) if jwt else 0}")
    
    try:
        # --- Use PortfolioMetricsManager for simplified data fetching -------
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=uid,
            user_token=jwt,
            metric_type="dashboard",
            force_refresh=force_refresh
        )
        logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Metrics retrieved, cache status: {metrics.cache_status}")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Holdings count: {len(metrics.holdings)}")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Computation time: {metrics.computation_time_ms}ms")
        
        # --- Get transaction summary separately (not yet in metrics manager) --
        try:
            summary = await supa_api_get_transaction_summary(uid, user_token=jwt)
            logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Transaction summary retrieved successfully")
        except Exception as e:
            logger.error(f"[backend_api_dashboard.py::backend_api_get_dashboard] Failed to get transaction summary: {str(e)}")
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
        # Convert Pydantic models to dictionaries as per BACKEND_GUIDE.md
        holdings_dicts = [holding.dict() for holding in metrics.holdings]
        daily_change, daily_change_pct = await portfolio_calculator.calculate_daily_change(
            holdings_dicts, jwt
        )
        
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
        
        # Prepare data for response
        dashboard_data = {
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
        }
        
        # Return based on version
        if x_api_version == "v2":
            # New standardized format
            response = ResponseFactory.success(
                data=dashboard_data,
                message="Dashboard data retrieved successfully",
                metadata={
                    "cache_status": metrics.cache_status,
                    "computation_time_ms": metrics.computation_time_ms,
                    "holdings_count": len(metrics.holdings),
                    "force_refresh": force_refresh,
                }
            )
            logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Returning v2 response format")
            return response.dict()
        else:
            # Legacy v1 format for backward compatibility
            resp = {
                "success": True,
                **dashboard_data,
                "cache_status": metrics.cache_status,
                "computation_time_ms": metrics.computation_time_ms,
            }
            
            logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Response structure: {list(resp.keys())}")
            logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Portfolio value: ${resp['portfolio']['total_value']:.2f}")
            logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Top holdings count: {len(resp['top_holdings'])}")
            logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] === GET DASHBOARD REQUEST END (SUCCESS) ===")
            return resp
        
    except Exception as e:
        # Log the error and let it propagate - no fallback
        logger.error(f"[backend_api_dashboard.py::backend_api_get_dashboard] ERROR: {type(e).__name__}: {str(e)}")
        logger.error(f"[backend_api_dashboard.py::backend_api_get_dashboard] Full stack trace:", exc_info=True)
        DebugLogger.log_error(__file__, "backend_api_get_dashboard", e, user_id=uid)
        # Return error based on version
        if x_api_version == "v2":
            error_response = ResponseFactory.error(
                error="DashboardError",
                message=f"Failed to retrieve dashboard data: {str(e)}",
                status_code=500
            )
            raise HTTPException(
                status_code=500,
                detail=error_response.dict()
            )
        else:
            # Legacy error format
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve dashboard data: {str(e)}"
            )

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
    x_api_version: str = Header("v1", description="API version for response format"),
) -> Dict[str, Any]:
    """Return portfolio vs index performance for the requested period."""
    logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] === GET PERFORMANCE REQUEST START ===")
    logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] User email: {user.get('email', 'unknown')}")
    logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] Period: {period}, Benchmark: {benchmark}")

    uid, jwt = _assert_jwt(user)
    logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] Extracted user_id: {uid}")
        
    # --- Lazy imports (avoid circular deps) -------------------------------
    from services.index_sim_service import (
        IndexSimulationService as ISS,
        IndexSimulationUtils as ISU,
    )
        
    # --- Validate benchmark ----------------------------------------------
    benchmark = benchmark.upper()
    if not ISU.validate_benchmark(benchmark):
        if x_api_version == "v2":
            error_response = ResponseFactory.validation_error(
                field_errors={"benchmark": f"Unsupported benchmark: {benchmark}"},
                message="Invalid benchmark symbol"
            )
            raise HTTPException(status_code=400, detail=error_response.dict())
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported benchmark: {benchmark}")
        
    # --- Resolve date range ----------------------------------------------
    start_date, end_date = portfolio_calculator._compute_date_range(period)
    
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
        if x_api_version == "v2":
            error_response = ResponseFactory.error(
                error="CalculationError",
                message="Portfolio time-series calculation failed",
                status_code=500
            )
            raise HTTPException(status_code=500, detail=error_response.dict())
        else:
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
                # No data response
                no_data_response = {
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
                
                if x_api_version == "v2":
                    return ResponseFactory.error(
                        error="NoDataError",
                        message="No data available for portfolio or benchmark",
                        status_code=404
                    ).dict()
                else:
                    return {"success": False, **no_data_response}
            
            # Convert to chart format
            index_only_chart_data = []
            for d, v in index_only_series:
                chart_point = {"date": d.isoformat(), "value": float(v)}
                index_only_chart_data.append(chart_point)
            # Index-only response data
            index_only_data = {
                "period": period,
                "benchmark": benchmark,
                "portfolio_performance": [],    
                "benchmark_performance": index_only_chart_data, 
                "metadata": {
                    "no_data": False, 
                    "index_only": True, 
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
            
            if x_api_version == "v2":
                return ResponseFactory.success(
                    data=index_only_data,
                    message="Index-only performance data retrieved (no portfolio data available)",
                    metadata={
                        "cache_status": "fresh",
                        "computation_time_ms": 0,
                        "index_only_mode": True
                    }
                ).dict()
            else:
                return {"success": True, **index_only_data}
            
        except Exception as e:
            logger.error("[backend_api_get_performance] ❌ Index-only fallback failed: %s", str(e))
            # Error fallback response
            error_data = {
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
            
            if x_api_version == "v2":
                return ResponseFactory.error(
                    error="DataRetrievalError",
                    message=f"Failed to retrieve data: {str(e)}",
                    status_code=500
                ).dict()
            else:
                return {"success": False, **error_data}

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
    
    # Filter out zero values (non-trading days) and convert to Decimal
    portfolio_series_filtered = []
    zero_count = 0
    for d, v in portfolio_series:
        decimal_value = _safe_decimal(v)
        if decimal_value > 0:
            portfolio_series_filtered.append((d, decimal_value))
        else:
            zero_count += 1
    # Use filtered series for calculations
    portfolio_series_dec = portfolio_series_filtered
    
    index_series_dec: List[Tuple[date, Decimal]] = [
        (d, _safe_decimal(v)) for d, v in index_series
    ]

    if portfolio_series_dec and index_series_dec:
        value_difference = abs(float(portfolio_series_dec[0][1]) - float(index_series_dec[0][1]))
        
        if value_difference > 1.0:  # More than $1 difference suggests an issue
            logger.warning(f"⚠️ Large start value difference detected: ${value_difference:.2f}")
            logger.warning(f"⚠️ This may indicate the rebalanced method needs adjustment")
    
    # Use index series as-is (no scaling needed)
    final_index_series_dec = index_series_dec
    
    formatted = portfolio_calculator.format_series_for_response(portfolio_series_dec, final_index_series_dec)
    metrics = ISU.calculate_performance_metrics(portfolio_series_dec, final_index_series_dec)
    
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
    
    # Prepare performance data
    performance_data = {
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
    
    if x_api_version == "v2":
        # Calculate computation time (approximate)
        computation_time_ms = int((datetime.utcnow() - datetime.fromisoformat(performance_data["metadata"]["calculation_timestamp"].replace("Z", ""))).total_seconds() * 1000) if "calculation_timestamp" in performance_data["metadata"] else 0
        
        return ResponseFactory.success(
            data=performance_data,
            message="Performance data retrieved successfully",
            metadata={
                "cache_status": "fresh",
                "computation_time_ms": computation_time_ms,
                "period": period,
                "benchmark": benchmark
            }
        ).dict()
    else:
        # Legacy v1 format
        return {"success": True, **performance_data}

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
    x_api_version: str = Header("v1", description="API version for response format"),
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
            empty_data = {"items": []}
            if x_api_version == "v2":
                return ResponseFactory.success(
                    data=empty_data,
                    message="No holdings found",
                    metadata={
                        "cache_status": metrics.cache_status,
                        "computation_time_ms": metrics.computation_time_ms
                    }
                ).dict()
            else:
                return {
                    "success": True,
                    "data": empty_data,
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
                "name": holding.symbol, 
                "value": float(holding.current_value),
                "changePercent": holding.gain_loss_percent,
                "changeValue": float(holding.gain_loss)
            })
        
        # Prepare response data
        gainers_data = {"items": top_gainers}
        
        if x_api_version == "v2":
            return ResponseFactory.success(
                data=gainers_data,
                message=f"Retrieved {len(top_gainers)} top gaining holdings",
                metadata={
                    "cache_status": metrics.cache_status,
                    "computation_time_ms": metrics.computation_time_ms,
                    "total_gainers": len(gainers),
                    "displayed_count": len(top_gainers)
                }
            ).dict()
        else:
            # Legacy v1 format
            return {
                "success": True,
                "data": gainers_data,
                "cache_status": metrics.cache_status
            }
        
    except Exception as e:
        DebugLogger.log_error(__file__, "backend_api_get_gainers", e, user_id=uid)
        if x_api_version == "v2":
            error_response = ResponseFactory.error(
                error="GainersError",
                message=f"Failed to retrieve top gainers: {str(e)}",
                status_code=500
            )
            raise HTTPException(
                status_code=500,
                detail=error_response.dict()
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve top gainers: {str(e)}"
            )

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
    x_api_version: str = Header("v1", description="API version for response format"),
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
            empty_data = {"items": []}
            if x_api_version == "v2":
                return ResponseFactory.success(
                    data=empty_data,
                    message="No holdings found",
                    metadata={
                        "cache_status": metrics.cache_status,
                        "computation_time_ms": metrics.computation_time_ms
                    }
                ).dict()
            else:
                return {
                    "success": True,
                    "data": empty_data,
                    "message": "No holdings found"
                }
        
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
                "name": holding.symbol, 
                "value": float(holding.current_value),
                "changePercent": abs(holding.gain_loss_percent), 
                "changeValue": abs(float(holding.gain_loss)) 
            })
        
        # Prepare response data
        losers_data = {"items": top_losers}
        
        if x_api_version == "v2":
            return ResponseFactory.success(
                data=losers_data,
                message=f"Retrieved {len(top_losers)} top losing holdings",
                metadata={
                    "cache_status": metrics.cache_status,
                    "computation_time_ms": metrics.computation_time_ms,
                    "total_losers": len(losers),
                    "displayed_count": len(top_losers)
                }
            ).dict()
        else:
            # Legacy v1 format
            return {
                "success": True,
                "data": losers_data,
                "cache_status": metrics.cache_status
            }
        
    except Exception as e:
        DebugLogger.log_error(__file__, "backend_api_get_losers", e, user_id=uid)
        if x_api_version == "v2":
            error_response = ResponseFactory.error(
                error="LosersError",
                message=f"Failed to retrieve top losers: {str(e)}",
                status_code=500
            )
            raise HTTPException(
                status_code=500,
                detail=error_response.dict()
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve top losers: {str(e)}"
            )
