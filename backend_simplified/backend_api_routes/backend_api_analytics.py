"""
Backend API routes for analytics functionality
Handles analytics summary, holdings data, and dividend management
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Header
from typing import Dict, Any, List, Union
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
import time

from debug_logger import DebugLogger
from supa_api.supa_api_auth import require_authenticated_user
from services.dividend_service import dividend_service
from services.portfolio_calculator import portfolio_calculator
from services.portfolio_metrics_manager import portfolio_metrics_manager
from utils.auth_helpers import extract_user_credentials
from models.response_models import APIResponse
from utils.response_factory import ResponseFactory
from utils.error_handlers import (
    ServiceUnavailableError, InvalidInputError, DataNotFoundError,
    handle_database_error, handle_external_api_error, async_error_handler
)

logger = logging.getLogger(__name__)

# Create router
analytics_router = APIRouter()

@analytics_router.get("/summary")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ANALYTICS_SUMMARY")
async def backend_api_analytics_summary(
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    x_api_version: str = Header(default="v1", alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    Get analytics summary with KPI cards data
    Returns portfolio value, profit, IRR, passive income, and cash balance
    OPTIMIZED: Uses cached portfolio calculation to reduce redundant database calls
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    # Validate required authentication data
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_analytics_summary] OPTIMIZED Summary request for user: {user_id}, API version: {x_api_version}")
    
    start_time = time.time()
    try:
        # Use PortfolioMetricsManager for optimized data fetching
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="analytics_summary",
            force_refresh=False
        )
        
        # Extract portfolio metrics
        portfolio_value = float(metrics.performance.total_value)
        total_cost = float(metrics.performance.total_cost)
        total_gain_loss = float(metrics.performance.total_gain_loss)
        total_gain_loss_percent = metrics.performance.total_gain_loss_percent
        
        # Use dividend summary from metrics if available, otherwise get lightweight version
        if metrics.dividend_summary:
            dividend_summary = {
                "ytd_received": float(metrics.dividend_summary.ytd_received),
                "total_received": float(metrics.dividend_summary.total_received),
                "total_pending": float(metrics.dividend_summary.total_pending),
                "confirmed_count": metrics.dividend_summary.count_received,  # Note: model uses count_received
                "pending_count": metrics.dividend_summary.count_pending
            }
        else:
            # Fallback to lightweight summary
            dividend_summary = await _get_lightweight_dividend_summary(user_id)
        
        # Calculate IRR using performance data if available
        irr_percent = 0.0
        # For now, always use the simple IRR calculation
        # TODO: Add XIRR to PortfolioPerformance model in future
        irr_data = await _calculate_simple_irr(user_id, user_token)
        irr_percent = float(irr_data.get("irr_percent", 0))
        
        # Calculate total profit including dividends
        total_dividends = dividend_summary.get("ytd_received", 0)  # This year's dividends
        total_profit_with_dividends = total_gain_loss + total_dividends
        
        summary = {
            "portfolio_value": portfolio_value,
            "total_profit": total_profit_with_dividends,  # Include dividends in total profit
            "total_profit_percent": total_gain_loss_percent,  # Keep original percentage for now
            "irr_percent": irr_percent,
            "passive_income_ytd": dividend_summary.get("ytd_received", 0),
            "cash_balance": 0,  # TODO: Implement cash tracking
            "dividend_summary": dividend_summary
        }
        
        # Calculate total computation time
        computation_time_ms = int((time.time() - start_time) * 1000)
        
        # Return v2 format if requested
        if x_api_version == "v2":
            return ResponseFactory.success(
                data=summary,
                message="Analytics summary retrieved successfully",
                metadata={
                    "user_id": user_id,
                    "optimized": True,
                    "cache_status": metrics.cache_status,
                    "metrics_computation_time_ms": metrics.computation_time_ms,
                    "total_computation_time_ms": computation_time_ms
                }
            )
        
        # Return legacy v1 format
        return {
            "success": True,
            "data": summary,
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "optimized": True,
                "cache_status": metrics.cache_status,
                "computation_time_ms": metrics.computation_time_ms
            }
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_analytics_summary",
            error=e,
            user_id=user_id
        )
        
        # Return v2 error format if requested
        if x_api_version == "v2":
            if isinstance(e, ServiceUnavailableError):
                return ResponseFactory.service_unavailable("Analytics service", str(e))
            else:
                return ResponseFactory.error(
                    error="InternalServerError",
                    message="Failed to retrieve analytics summary",
                    status_code=500
                )
        
        # Return legacy v1 error format
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/holdings")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ANALYTICS_HOLDINGS")
async def backend_api_analytics_holdings(
    include_sold: bool = Query(False, description="Include sold holdings in response"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    x_api_version: str = Header(default="v1", alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[List[Dict[str, Any]]]]:
    """
    Get detailed holdings data for analytics table
    Returns holdings with cost basis, value, dividends, gains, P&L, etc.
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    # Validate required authentication data
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_analytics_holdings] Holdings request for user: {user_id}, API version: {x_api_version}")
    
    start_time = time.time()
    try:
        holdings_data = await _get_detailed_holdings(user_id, user_token, include_sold)
        
        # Calculate computation time
        computation_time_ms = int((time.time() - start_time) * 1000)
        
        # Return v2 format if requested
        if x_api_version == "v2":
            return ResponseFactory.success(
                data=holdings_data,
                message=f"Retrieved {len(holdings_data)} holdings",
                metadata={
                    "user_id": user_id,
                    "include_sold": include_sold,
                    "total_holdings": len(holdings_data),
                    "computation_time_ms": computation_time_ms
                }
            )
        
        # Return legacy v1 format
        return {
            "success": True,
            "data": holdings_data,
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "include_sold": include_sold,
                "total_holdings": len(holdings_data)
            }
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_analytics_holdings",
            error=e,
            user_id=user_id
        )
        
        # Return v2 error format if requested
        if x_api_version == "v2":
            if isinstance(e, DataNotFoundError):
                return ResponseFactory.not_found("Holdings", user_id)
            elif isinstance(e, ServiceUnavailableError):
                return ResponseFactory.service_unavailable("Analytics service", str(e))
            else:
                return ResponseFactory.error(
                    error="InternalServerError",
                    message="Failed to retrieve holdings data",
                    status_code=500
                )
        
        # Return legacy v1 error format
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/dividends")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ANALYTICS_DIVIDENDS")
async def backend_api_analytics_dividends(
    confirmed_only: bool = Query(False, description="Return only confirmed dividends"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    x_api_version: str = Header(default="v1", alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[List[Dict[str, Any]]]]:
    """
    REFACTORED: Get dividends with unified data model and transaction-based confirmation
    Fixes all data consistency and API contract issues
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_analytics_dividends] FIXED dividends request for user: {user_id}, confirmed_only: {confirmed_only}, API version: {x_api_version}")
    
    start_time = time.time()
    try:
        # Use original service with corrected parameter order
        dividends_result = await dividend_service.get_user_dividends(
            user_id, user_token, confirmed_only
        )
        
        if not dividends_result["success"]:
            error_msg = dividends_result.get("error", "Failed to get dividends")
            if x_api_version == "v2":
                return ResponseFactory.error(
                    error="DividendRetrievalError",
                    message=error_msg,
                    status_code=500
                )
            else:
                raise HTTPException(status_code=500, detail=error_msg)
        
        # Calculate computation time
        computation_time_ms = int((time.time() - start_time) * 1000)
        
        # Return v2 format if requested
        if x_api_version == "v2":
            return ResponseFactory.success(
                data=dividends_result["dividends"],
                message=dividends_result.get("message", "Dividends retrieved successfully"),
                metadata={
                    "user_id": user_id,
                    "confirmed_only": confirmed_only,
                    "total_dividends": dividends_result["total_count"],
                    "owned_symbols": dividends_result.get("owned_symbols", []),
                    "computation_time_ms": computation_time_ms
                }
            )
        
        # Return legacy v1 format
        return {
            "success": True,
            "data": dividends_result["dividends"],
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "confirmed_only": confirmed_only,
                "total_dividends": dividends_result["total_count"],
                "owned_symbols": dividends_result.get("owned_symbols", []),
                "message": dividends_result.get("message", "Success")
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions if not in v2 mode
        if x_api_version != "v2":
            raise
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_analytics_dividends",
            error=e,
            user_id=user_id
        )
        
        # Return v2 error format if requested
        if x_api_version == "v2":
            if "database" in str(e).lower() or "supabase" in str(e).lower():
                return handle_database_error(e, "dividend retrieval", user_id)
            elif "alpha vantage" in str(e).lower():
                return handle_external_api_error(e, "Alpha Vantage", "retrieve dividends", user_id)
            else:
                return ResponseFactory.error(
                    error="InternalServerError",
                    message="Failed to retrieve dividends",
                    status_code=500
                )
        
        # Return legacy v1 error format
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/confirm")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="CONFIRM_DIVIDEND")
async def backend_api_confirm_dividend(
    request: Request,
    dividend_id: str = Query(..., description="Dividend ID to confirm"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    x_api_version: str = Header(default="v1", alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    OPTIMIZED: Confirm dividend with proper validation and transaction creation
    NO PORTFOLIO RECALCULATION - Only dividend operations (uses Alpha Vantage dividend APIs)
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    body = await request.json()
    edited_amount = body.get('edited_amount')  # Optional float
    DebugLogger.info_if_enabled(f"[backend_api_analytics.py] OPTIMIZED confirm request for dividend {dividend_id}, user {user_id}, edited_amount: {edited_amount}, API version: {x_api_version}", logger)
    
    start_time = time.time()
    try:
        # PERFORMANCE: This uses Alpha Vantage dividend APIs, NOT historical price data
        # No get_historical_prices calls should be triggered from this operation
        result = await dividend_service.confirm_dividend(user_id, dividend_id, user_token, edited_amount)
        
        DebugLogger.info_if_enabled(f"[backend_api_analytics.py] OPTIMIZED confirmation result: success={result['success']}, total_amount={result.get('total_amount')}", logger)
        DebugLogger.info_if_enabled(f"[backend_api_analytics.py] 🚀 PERFORMANCE: Dividend confirmation completed without portfolio recalculation", logger)
        
        # Calculate computation time
        computation_time_ms = int((time.time() - start_time) * 1000)
        
        # Return v2 format if requested
        if x_api_version == "v2":
            return ResponseFactory.success(
                data={
                    "dividend_id": dividend_id,
                    "total_amount": result.get('total_amount'),
                    "transaction_id": result.get('transaction_id'),
                    "performance_optimized": True,
                    "portfolio_recalculation_skipped": True
                },
                message=result.get('message', 'Dividend confirmed successfully'),
                metadata={
                    "user_id": user_id,
                    "computation_time_ms": computation_time_ms,
                    "cache_status": "not_applicable"
                }
            )
        
        # Add performance metadata to help frontend understand this was optimized
        result["performance_optimized"] = True
        result["portfolio_recalculation_skipped"] = True
        
        return result
        
    except Exception as e:
        DebugLogger.log_error(file_name="backend_api_analytics.py", function_name="backend_api_confirm_dividend", error=e, user_id=user_id, dividend_id=dividend_id)
        
        # Return v2 error format if requested
        if x_api_version == "v2":
            if "not found" in str(e).lower():
                return ResponseFactory.not_found("Dividend", dividend_id)
            elif "already confirmed" in str(e).lower():
                return ResponseFactory.validation_error(
                    {"dividend_id": "Dividend is already confirmed"},
                    "Cannot confirm an already confirmed dividend"
                )
            else:
                return ResponseFactory.error(
                    error="DividendConfirmationError",
                    message=f"Failed to confirm dividend: {str(e)}",
                    status_code=500
                )
        
        # Return legacy v1 error format
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/sync")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="SYNC_DIVIDENDS")
async def backend_api_sync_dividends(
    symbol: str = Query(..., description="Symbol to sync dividends for"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    x_api_version: str = Header(default="v1", alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    REFACTORED: Manually sync dividends with idempotent upserts
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_sync_dividends] REFACTORED syncing dividends for {symbol}, user: {user_id}, API version: {x_api_version}")
    
    start_time = time.time()
    try:
        # Validate symbol format
        if not symbol or not symbol.strip():
            if x_api_version == "v2":
                return ResponseFactory.validation_error(
                    {"symbol": "Symbol cannot be empty"},
                    "Invalid symbol provided"
                )
            else:
                raise HTTPException(status_code=400, detail="Symbol cannot be empty")
        # Use original service
        result = await dividend_service.sync_dividends_for_symbol(user_id, symbol.upper(), user_token)
        
        # Calculate computation time
        computation_time_ms = int((time.time() - start_time) * 1000)
        
        # Return v2 format if requested
        if x_api_version == "v2":
            return ResponseFactory.success(
                data={
                    "symbol": symbol.upper(),
                    "dividends_synced": result.get("dividends_synced", 0),
                    "dividends_assigned": result.get("dividends_assigned", 0),
                    "from_cache": result.get("from_cache", False)
                },
                message=result.get("message", f"Dividend sync completed for {symbol}"),
                metadata={
                    "user_id": user_id,
                    "computation_time_ms": computation_time_ms,
                    "api_source": "Alpha Vantage" if not result.get("from_cache") else "cache"
                }
            )
        
        # Return legacy v1 format
        return {
            "success": True,
            "data": result,
            "message": result.get("message", f"Dividend sync completed for {symbol}")
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions if not in v2 mode
        if x_api_version != "v2":
            raise
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_sync_dividends",
            error=e,
            user_id=user_id,
            symbol=symbol
        )
        
        # Return v2 error format if requested
        if x_api_version == "v2":
            if "rate limit" in str(e).lower():
                return ResponseFactory.error(
                    error="RateLimitError",
                    message="API rate limit exceeded. Please try again later.",
                    status_code=429
                )
            elif "alpha vantage" in str(e).lower():
                return ResponseFactory.service_unavailable(
                    "Alpha Vantage API",
                    "Unable to sync dividends at this time"
                )
            else:
                return ResponseFactory.error(
                    error="DividendSyncError",
                    message=f"Failed to sync dividends for {symbol}",
                    status_code=500
                )
        
        # Return legacy v1 error format
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/sync-all")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="SYNC_ALL_DIVIDENDS")
async def backend_api_sync_all_dividends(
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Automatically sync dividends for all user's holdings
    OPTIMIZED: Includes rate limiting to prevent excessive syncing
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    # Validate required authentication data
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_sync_all_dividends] OPTIMIZED sync for user: {user_id}")
    
    try:
        # OPTIMIZATION: Check if user has synced recently (within last 5 minutes)
        # Use database rate limiting instead of in-memory cache for multi-worker safety
        from supa_api.supa_api_client import get_supa_service_client
        supa_client = get_supa_service_client()
        
        # Call the database rate limit check function
        rate_limit_result = supa_client.rpc(
            'check_rate_limit',
            {
                'p_user_id': user_id,
                'p_action': 'dividend_sync_all',
                'p_seconds': 300,  # 5 minutes
                'p_max_attempts': 1  # Only allow once per 5 minutes
            }
        ).execute()
        
        # Check if rate limited
        if not rate_limit_result.data:
            # Calculate approximate time remaining (5 minutes)
            return {
                "success": True,
                "data": {"total_symbols": 0, "dividends_synced": 0},
                "message": "Dividend sync rate limited. Try again in a few minutes.",
                "rate_limited": True
            }
        
        # Get all unique symbols the user has owned
        from supa_api.supa_api_transactions import supa_api_get_user_transactions
        user_transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
        
        if not user_transactions:
            return {
                "success": True,
                "data": {"total_symbols": 0, "dividends_synced": 0, "dividends_assigned": 0},
                "message": "No transactions found for user",
                "rate_limited": False
            }
        
        unique_symbols = list(set(txn['symbol'] for txn in user_transactions))
        logger.info(f"[backend_api_analytics.py] Syncing dividends for {len(unique_symbols)} symbols: {unique_symbols}")
        
        # Sync and assign dividends for each symbol
        total_synced = 0
        total_assigned = 0
        
        for symbol in unique_symbols:
            try:
                # This will sync global dividends and assign applicable ones to the user
                sync_result = await dividend_service.sync_dividends_for_symbol(
                    user_id=user_id,
                    symbol=symbol,
                    user_token=user_token,
                    from_date=None  # Check all dividends
                )
                if sync_result.get("success"):
                    total_synced += sync_result.get("dividends_synced", 0)
                    total_assigned += sync_result.get("dividends_assigned", 0)
            except Exception as e:
                logger.warning(f"[backend_api_analytics.py] Failed to sync {symbol}: {e}")
        
        return {
            "success": True,
            "data": {
                "total_symbols": len(unique_symbols),
                "dividends_synced": total_synced,
                "dividends_assigned": total_assigned
            },
            "message": f"Synced {total_synced} global dividends and assigned {total_assigned} to user",
            "rate_limited": False
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_sync_all_dividends",
            error=e,
            user_id=user_id
        )
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/dividends/summary")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="DIVIDEND_SUMMARY")
async def backend_api_dividend_summary(
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    x_api_version: str = Header(default="v1", alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    Get lightweight dividend summary for dividend page cards only
    This is much faster than the full analytics summary
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    logger.info(f"[backend_api_analytics.py::backend_api_dividend_summary] Fast dividend summary for user: {user_id}, API version: {x_api_version}")
    
    start_time = time.time()
    try:
        # Use the lightweight dividend summary from service
        summary = await dividend_service.get_dividend_summary(user_id)
        
        if not summary["success"]:
            error_msg = summary.get("error", "Failed to get dividend summary")
            if x_api_version == "v2":
                return ResponseFactory.error(
                    error="DividendSummaryError",
                    message=error_msg,
                    status_code=500
                )
            else:
                raise HTTPException(status_code=500, detail=error_msg)
        
        # Calculate computation time
        computation_time_ms = int((time.time() - start_time) * 1000)
        
        # Return v2 format if requested
        if x_api_version == "v2":
            return ResponseFactory.success(
                data=summary["summary"],
                message="Dividend summary retrieved successfully",
                metadata={
                    "user_id": user_id,
                    "computation_time_ms": computation_time_ms,
                    "cache_status": "lightweight_query"
                }
            )
        
        # Return legacy v1 format
        return {
            "success": True,
            "data": summary["summary"]
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions if not in v2 mode
        if x_api_version != "v2":
            raise
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_dividend_summary",
            error=e,
            user_id=user_id
        )
        
        # Return v2 error format if requested
        if x_api_version == "v2":
            return ResponseFactory.error(
                error="InternalServerError",
                message="Failed to retrieve dividend summary",
                status_code=500
            )
        
        # Return legacy v1 error format
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/assign-simple")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ASSIGN_DIVIDENDS_SIMPLE")
async def backend_api_assign_dividends_simple(
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    NEW SIMPLE DIVIDEND ASSIGNMENT: Use loop-based approach to assign dividends to users
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_assign_dividends_simple] Starting simple dividend assignment")
    
    try:
        result = await dividend_service.assign_dividends_to_users_simple()
        
        return {
            "success": True,
            "data": result,
            "message": result.get("message", "Simple dividend assignment completed")
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_assign_dividends_simple",
            error=e,
            user_id=user_id
        )
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/reject")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="REJECT_DIVIDEND")
async def backend_api_reject_dividend(
    dividend_id: str = Query(..., description="Dividend ID to reject"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Reject a dividend - sets rejected=true, hiding it permanently from the user
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_reject_dividend] Rejecting dividend {dividend_id} for user {user_id}")
    
    try:
        result = await dividend_service.reject_dividend(user_id, dividend_id, user_token)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to reject dividend"))
        
        return result
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_reject_dividend",
            error=e,
            user_id=user_id,
            dividend_id=dividend_id
        )
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/edit")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="EDIT_DIVIDEND")
async def backend_api_edit_dividend(
    request: Request,
    original_dividend_id: str = Query(..., description="Original dividend ID to edit"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Edit a dividend by creating a new one and rejecting the original
    Handles both pending and confirmed dividends
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    # Parse request body
    body = await request.json()
    edited_data = {
        'ex_date': body.get('ex_date'),
        'pay_date': body.get('pay_date'),
        'amount_per_share': body.get('amount_per_share'),
        'total_amount': body.get('total_amount')
    }
    
    # Validate required fields
    if not edited_data['ex_date']:
        raise HTTPException(status_code=400, detail="Ex-date is required")
    if edited_data['amount_per_share'] is None and edited_data['total_amount'] is None:
        raise HTTPException(status_code=400, detail="Either amount_per_share or total_amount is required")
    
    # Validate dates
    if edited_data['pay_date'] and edited_data['ex_date']:
        if edited_data['pay_date'] < edited_data['ex_date']:
            raise HTTPException(status_code=400, detail="Pay date must be on or after ex-date")
    
    # Validate amounts
    if edited_data['amount_per_share'] is not None and edited_data['amount_per_share'] < 0:
        raise HTTPException(status_code=400, detail="Amount per share cannot be negative")
    if edited_data['total_amount'] is not None and edited_data['total_amount'] < 0:
        raise HTTPException(status_code=400, detail="Total amount cannot be negative")
    
    logger.info(f"[backend_api_analytics.py::backend_api_edit_dividend] Editing dividend {original_dividend_id} for user {user_id}")
    
    try:
        result = await dividend_service.edit_dividend(
            user_id=user_id,
            original_dividend_id=original_dividend_id,
            edited_data=edited_data,
            user_token=user_token
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to edit dividend"))
        
        return result
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_edit_dividend",
            error=e,
            user_id=user_id,
            dividend_id=original_dividend_id
        )
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions

async def _get_portfolio_summary(user_id: str, user_token: str) -> Dict[str, Any]:
    """Get basic portfolio summary data - OPTIMIZED to use existing portfolio service"""
    try:
        # Use the optimized portfolio calculator instead of duplicating logic
        portfolio_result = await portfolio_calculator.calculate_portfolio_time_series(user_id, user_token, "1D")
        
        if not portfolio_result[0] or len(portfolio_result[0]) == 0:
            return {"total_value": 0, "total_gain_loss": 0, "total_gain_loss_percent": 0, "total_invested": 0}
        
        # Get the latest value from the series
        latest_value = float(portfolio_result[0][-1][1])  # Last [date, value] pair
        
        # Simple approximation of total invested (could be enhanced)
        # For now, just return current value as we're optimizing for speed
        return {
            "total_value": latest_value,
            "total_gain_loss": 0,  # Skip complex calculation for summary
            "total_gain_loss_percent": 0,  # Skip complex calculation for summary
            "total_invested": latest_value  # Simplified
        }
        
    except Exception as e:
        logger.error(f"Failed to get portfolio summary: {e}")
        return {"total_value": 0, "total_gain_loss": 0, "total_gain_loss_percent": 0, "total_invested": 0}

async def _get_detailed_holdings(user_id: str, user_token: str, include_sold: bool) -> List[Dict[str, Any]]:
    """Get detailed holdings data for analytics table - Using PortfolioMetricsManager"""
    logger.info(f"[backend_api_analytics.py::_get_detailed_holdings] Getting detailed holdings for user {user_id}")
    
    try:
        # Use PortfolioMetricsManager for optimized data fetching
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="detailed_holdings",
            force_refresh=False
        )
        
        if not metrics.holdings:
            logger.warning(f"[backend_api_analytics.py::_get_detailed_holdings] No holdings found for user {user_id}")
            return []
        
        # Convert holdings to dictionary format expected by the frontend
        detailed_holdings = []
        for holding in metrics.holdings:
            # Filter out sold holdings if not requested
            if not include_sold and holding.quantity <= 0:
                continue
                
            holding_dict = {
                'symbol': holding.symbol,
                'quantity': float(holding.quantity),
                'avg_cost': float(holding.avg_cost),
                'current_price': float(holding.current_price),
                'cost_basis': float(holding.total_cost),
                'current_value': float(holding.current_value),
                'unrealized_gain': float(holding.gain_loss),
                'unrealized_gain_percent': holding.gain_loss_percent,
                'realized_pnl': float(holding.realized_pnl) if hasattr(holding, 'realized_pnl') else 0,
                'dividends_received': float(holding.dividends_received) if hasattr(holding, 'dividends_received') else 0,
                'total_profit': float(holding.gain_loss) + float(getattr(holding, 'realized_pnl', 0)) + float(getattr(holding, 'dividends_received', 0)),
                'total_profit_percent': holding.gain_loss_percent,  # Simplified for now
                'total_bought': float(holding.total_cost),  # Simplified
                'total_sold': 0,  # TODO: Track sold amounts
                'daily_change': 0,  # TODO: Implement daily change calculation
                'daily_change_percent': 0,  # TODO: Implement daily change percent
                'irr_percent': 0  # TODO: Implement IRR per holding
            }
            detailed_holdings.append(holding_dict)
        
        logger.info(f"[backend_api_analytics.py::_get_detailed_holdings] Returning {len(detailed_holdings)} holdings")
        
        return detailed_holdings
        
    except Exception as e:
        logger.error(f"[backend_api_analytics.py::_get_detailed_holdings] Error getting detailed holdings: {e}")
        # Fallback to direct portfolio calculator
        try:
            detailed_holdings = await portfolio_calculator.calculate_detailed_holdings(user_id, user_token)
            
            if not detailed_holdings:
                return []
            
            # Filter out sold holdings if not requested
            if not include_sold:
                detailed_holdings = [h for h in detailed_holdings if h['quantity'] > 0]
            
            # Add missing fields
            for holding in detailed_holdings:
                holding['daily_change'] = 0
                holding['daily_change_percent'] = 0
                holding['irr_percent'] = 0
            
            return detailed_holdings
        except Exception as e2:
            logger.error(f"[backend_api_analytics.py::_get_detailed_holdings] Fallback also failed: {e2}")
            return []

async def _enrich_dividend_data(user_id: str, dividends: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enrich dividend data with current holding information"""
    # Add company name, current holdings, etc.
    enriched = []
    
    for dividend in dividends:
        enriched_dividend = dividend.copy()
        
        # Get current holdings for this symbol
        holding_result = await dividend_service._get_user_holdings_for_symbol(user_id, dividend['symbol'])
        enriched_dividend['current_holdings'] = holding_result.get('quantity', 0)
        
        # Calculate projected dividend amount
        if not dividend['confirmed'] and enriched_dividend['current_holdings'] > 0:
            projected_amount = Decimal(str(dividend['amount'])) * Decimal(str(enriched_dividend['current_holdings']))
            enriched_dividend['projected_amount'] = float(projected_amount)  # Convert to float for JSON serialization
        
        enriched.append(enriched_dividend)
    
    return enriched

async def _get_lightweight_dividend_summary(user_id: str) -> Dict[str, Any]:
    """Get basic dividend summary without expensive calculations"""
    try:
        from supa_api.supa_api_client import get_supa_service_client
        supa_client = get_supa_service_client()
        
        # Single query for YTD dividends (most important metric)
        current_year = datetime.now().year
        year_start = f"{current_year}-01-01"
        
        # Get confirmed dividends for the year - need total_amount, not just amount per share
        ytd_result = supa_client.table('user_dividends') \
            .select('total_amount, amount, shares_held_at_ex_date') \
            .eq('user_id', user_id) \
            .eq('confirmed', True) \
            .gte('pay_date', year_start) \
            .execute()
        
        # Calculate YTD received - use total_amount if available, otherwise calculate from amount * shares
        ytd_received = Decimal('0')
        for div in ytd_result.data if ytd_result.data else []:
            if div.get('total_amount'):
                ytd_received += Decimal(str(div['total_amount']))
            elif div.get('amount') and div.get('shares_held_at_ex_date'):
                # Fallback calculation if total_amount not set
                ytd_received += Decimal(str(div['amount'])) * Decimal(str(div['shares_held_at_ex_date']))
        
        return {
            "ytd_received": float(ytd_received),  # Convert to float for JSON serialization
            "total_received": 0,  # Skip for performance
            "total_pending": 0,   # Skip for performance
            "confirmed_count": len(ytd_result.data) if ytd_result.data else 0,
            "pending_count": 0    # Skip for performance
        }
        
    except Exception as e:
        logger.error(f"Failed to get lightweight dividend summary: {e}")
        return {
            "ytd_received": 0,
            "total_received": 0,
            "total_pending": 0,
            "confirmed_count": 0,
            "pending_count": 0
        }

async def _calculate_simple_irr(user_id: str, user_token: str) -> Dict[str, Any]:
    """Calculate simple IRR approximation"""
    # This is a simplified IRR calculation
    # In production, you'd want a more sophisticated IRR calculation
    
    try:
        # Get portfolio performance for the last year
        portfolio_data = await portfolio_calculator.calculate_portfolio_time_series(user_id, user_token, "1Y")
        
        if not portfolio_data[0]:  # No data
            return {"irr_percent": 0}
        
        series_data = portfolio_data[0]
        if len(series_data) < 2:
            return {"irr_percent": 0}
        
        # Simple annualized return calculation
        start_value = series_data[0][1]  # First value
        end_value = series_data[-1][1]   # Last value
        
        if start_value <= 0:
            return {"irr_percent": 0}
        
        # Convert to float for calculation
        start_val_float = float(start_value)
        end_val_float = float(end_value)
        
        total_return = (end_val_float - start_val_float) / start_val_float
        days = len(series_data)
        
        # Simple annualized return calculation
        annualized_return = ((1 + total_return) ** (365 / days)) - 1
        
        return {"irr_percent": annualized_return * 100}
        
    except Exception as e:
        logger.error(f"Failed to calculate IRR: {e}")
        return {"irr_percent": 0}


@analytics_router.post("/dividends/add-manual")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ADD_MANUAL_DIVIDEND")
async def backend_api_add_manual_dividend(
    request: Request,
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Manually add a dividend entry
    Creates both a user_dividend record and optionally a transaction if update_cash_balance is true
    """
    # Extract and validate user credentials
    user_id, user_token = extract_user_credentials(user_data)
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    # Parse request body
    body = await request.json()
    
    # Extract and validate required fields
    ticker = body.get('ticker', '').strip().upper()
    company_name = body.get('company_name', '').strip()
    payment_date = body.get('payment_date')
    total_received = body.get('total_received')
    amount_per_share = body.get('amount_per_share', 0)
    fee = float(body.get('fee', 0))
    tax = float(body.get('tax', 0))
    note = body.get('note', '')
    update_cash_balance = body.get('update_cash_balance', True)
    
    # Validation
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    if not payment_date:
        raise HTTPException(status_code=400, detail="Payment date is required")
    if not total_received or float(total_received) <= 0:
        raise HTTPException(status_code=400, detail="Total received must be greater than 0")
    
    try:
        total_received = float(total_received)
        amount_per_share = float(amount_per_share) if amount_per_share else 0
        
        # Calculate net amount after fees and taxes
        net_amount = total_received - fee - tax
        
        logger.info(f"[backend_api_analytics.py::backend_api_add_manual_dividend] Adding manual dividend for {ticker} on {payment_date}, user: {user_id}")
        
        # Step 1: Create the dividend record in user_dividends
        result = await dividend_service.add_manual_dividend(
            user_id=user_id,
            user_token=user_token,
            ticker=ticker,
            payment_date=payment_date,
            total_amount=total_received,
            amount_per_share=amount_per_share,
            fee=fee,
            tax=tax,
            note=note,
            company_name=company_name
        )
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to add dividend"))
        
        dividend_id = result.get("dividend_id")
        
        # Step 2: If update_cash_balance is true, create a transaction
        if update_cash_balance and dividend_id:
            # Import transaction service
            from supa_api.supa_api_transactions import create_cash_transaction
            
            # Create a dividend transaction
            transaction_result = await create_cash_transaction(
                user_id=user_id,
                user_token=user_token,
                transaction_type="dividend",
                amount=net_amount,  # Use net amount after fees/taxes
                description=f"Dividend from {ticker} - {company_name}" if company_name else f"Dividend from {ticker}",
                transaction_date=payment_date,
                dividend_id=dividend_id  # Link to the dividend record
            )
            
            if not transaction_result.get("success"):
                logger.warning(f"Failed to create transaction for dividend: {transaction_result.get('error')}")
                # Don't fail the whole operation if transaction creation fails
        
        return {
            "success": True,
            "dividend_id": dividend_id,
            "message": "Dividend added successfully",
            "data": {
                "ticker": ticker,
                "payment_date": payment_date,
                "total_amount": total_received,
                "net_amount": net_amount,
                "transaction_created": update_cash_balance
            }
        }
        
    except ValueError as e:
        logger.error(f"Validation error adding manual dividend: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error adding manual dividend: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add dividend: {str(e)}")