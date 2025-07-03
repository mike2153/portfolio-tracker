"""
Backend API routes for dashboard data
Returns all dashboard data in a single efficient call
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date
import logging
import asyncio

from debug_logger import DebugLogger
from supa_api.supa_api_auth import require_authenticated_user
from supa_api.supa_api_portfolio import supa_api_calculate_portfolio
from supa_api.supa_api_transactions import supa_api_get_transaction_summary
from vantage_api.vantage_api_quotes import vantage_api_get_quote

logger = logging.getLogger(__name__)

# Create router
dashboard_router = APIRouter()

@dashboard_router.get("/dashboard")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_DASHBOARD")
async def backend_api_get_dashboard(
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Get all dashboard data in one efficient call
    Includes portfolio summary, top holdings, recent transactions, and market data
    """
    logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Dashboard requested for user: {user['email']}")
    
    try:
        # CRITICAL FIX: Forward the caller's JWT so RLS returns rows
        user_token = user.get("access_token")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] 🔐 JWT token present: {bool(user_token)}")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] 🔐 Token preview: {user_token[:20] + '...' if user_token else 'None'}")
        
        # Run multiple data fetches in parallel WITH user token for RLS
        portfolio_task = asyncio.create_task(supa_api_calculate_portfolio(
            user["id"], 
            user_token=user_token
        ))
        summary_task = asyncio.create_task(supa_api_get_transaction_summary(
            user["id"],
            user_token=user_token
        ))
        
        # Get benchmark data (S&P 500)
        spy_task = asyncio.create_task(vantage_api_get_quote("SPY"))
        
        # Wait for all tasks
        portfolio_data, transaction_summary, spy_quote = await asyncio.gather(
            portfolio_task,
            summary_task,
            spy_task,
            return_exceptions=True
        )
        
        # Handle SPY quote error gracefully
        if isinstance(spy_quote, Exception):
            logger.warning(f"[backend_api_dashboard.py::backend_api_get_dashboard] Failed to get SPY quote: {spy_quote}")
            spy_quote = None
        
        # Extract top holdings (limit to 5 for dashboard)
        top_holdings = portfolio_data["holdings"][:5] if not isinstance(portfolio_data, Exception) else []
        
        # Calculate daily change (simplified - in production would use historical data)
        daily_change = 0.0
        daily_change_percent = 0.0
        
        # Prepare dashboard response
        dashboard_data = {
            "success": True,
            "portfolio": {
                "total_value": portfolio_data["total_value"] if not isinstance(portfolio_data, Exception) else 0,
                "total_cost": portfolio_data["total_cost"] if not isinstance(portfolio_data, Exception) else 0,
                "total_gain_loss": portfolio_data["total_gain_loss"] if not isinstance(portfolio_data, Exception) else 0,
                "total_gain_loss_percent": portfolio_data["total_gain_loss_percent"] if not isinstance(portfolio_data, Exception) else 0,
                "daily_change": daily_change,
                "daily_change_percent": daily_change_percent,
                "holdings_count": portfolio_data["holdings_count"] if not isinstance(portfolio_data, Exception) else 0
            },
            "top_holdings": top_holdings,
            "transaction_summary": {
                "total_invested": transaction_summary["total_invested"] if not isinstance(transaction_summary, Exception) else 0,
                "total_sold": transaction_summary["total_sold"] if not isinstance(transaction_summary, Exception) else 0,
                "net_invested": transaction_summary["net_invested"] if not isinstance(transaction_summary, Exception) else 0,
                "total_transactions": transaction_summary["total_transactions"] if not isinstance(transaction_summary, Exception) else 0
            },
            "market_data": {
                "spy": {
                    "price": spy_quote["price"] if spy_quote else 0,
                    "change": spy_quote["change"] if spy_quote else 0,
                    "change_percent": spy_quote["change_percent"] if spy_quote else "0"
                } if spy_quote else None
            }
        }
        
        logger.info(f"[backend_api_dashboard.py::backend_api_get_dashboard] Dashboard data compiled successfully")
        
        return dashboard_data
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_dashboard.py",
            function_name="backend_api_get_dashboard",
            error=e,
            user_id=user["id"]
        )
        
        # Return minimal dashboard on error
        return {
            "success": False,
            "error": str(e),
            "portfolio": {
                "total_value": 0,
                "total_cost": 0,
                "total_gain_loss": 0,
                "total_gain_loss_percent": 0,
                "daily_change": 0,
                "daily_change_percent": 0,
                "holdings_count": 0
            },
            "top_holdings": [],
            "transaction_summary": {
                "total_invested": 0,
                "total_sold": 0,
                "net_invested": 0,
                "total_transactions": 0
            },
            "market_data": None
        }

@dashboard_router.get("/dashboard/performance")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_PERFORMANCE")
async def backend_api_get_performance(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    period: str = "1M"  # 1D, 1W, 1M, 3M, 6M, 1Y, ALL
) -> Dict[str, Any]:
    """Get portfolio performance data for charting"""
    logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] Performance data requested for period: {period}")
    
    try:
        # CRITICAL: Extract JWT token for RLS compliance
        user_token = user.get("access_token")
        user_id = user["id"]
        
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] 🔐 JWT token present: {bool(user_token)}")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] 🔐 User ID: {user_id}")
        
        if not user_token:
            logger.error(f"[backend_api_dashboard.py::backend_api_get_performance] ❌ JWT token missing")
            raise HTTPException(status_code=401, detail="Authentication token required")
        
        # Import services (lazy import to avoid circular dependencies)
        from services.portfolio_service import PortfolioTimeSeriesService, PortfolioServiceUtils
        from services.index_sim_service import IndexSimulationService, IndexSimulationUtils
        
        # Step 1: Validate benchmark
        benchmark = "SPY"  # Default benchmark for now
        if not IndexSimulationUtils.validate_benchmark(benchmark):
            logger.error(f"[backend_api_dashboard.py::backend_api_get_performance] ❌ Invalid benchmark: {benchmark}")
            raise HTTPException(status_code=400, detail=f"Unsupported benchmark: {benchmark}")
        
        # Step 2: Compute date range (convert old period to new range format)
        range_key = period.replace("M", "M").replace("Y", "Y")  # Convert period to range
        start_date, end_date = PortfolioServiceUtils.compute_date_range(range_key)
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] 📅 Date range: {start_date} to {end_date}")
        
        # Step 3: Calculate portfolio and index series in parallel
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] 🚀 Starting parallel calculations...")
        
        portfolio_task = asyncio.create_task(
            PortfolioTimeSeriesService.get_portfolio_series(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
        )
        
        index_task = asyncio.create_task(
            IndexSimulationService.get_index_sim_series(
                user_id=user_id,
                benchmark=benchmark,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
        )
        
        # Wait for both calculations to complete
        portfolio_series, index_series = await asyncio.gather(
            portfolio_task,
            index_task,
            return_exceptions=True
        )
        
        # Handle calculation errors
        if isinstance(portfolio_series, Exception):
            logger.error(f"[backend_api_dashboard.py::backend_api_get_performance] ❌ Portfolio calculation failed: {portfolio_series}")
            raise portfolio_series
        
        if isinstance(index_series, Exception):
            logger.error(f"[backend_api_dashboard.py::backend_api_get_performance] ❌ Index simulation failed: {index_series}")
            raise index_series
        
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] ✅ Parallel calculations complete")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] Portfolio points: {len(portfolio_series)}")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] Index points: {len(index_series)}")
        
        # Step 4: Format response data
        formatted_data = PortfolioServiceUtils.format_series_for_response(
            portfolio_series, index_series
        )
        
        # Step 5: Calculate performance metrics
        performance_metrics = IndexSimulationUtils.calculate_performance_metrics(
            portfolio_series, index_series
        )
        
        # Step 6: Build final response (maintain backward compatibility)
        response_data = {
            "success": True,
            "period": period,
            "benchmark": benchmark,
            "portfolio_performance": [
                {"date": date, "total_value": value, "indexed_performance": 0}
                for date, value in zip(formatted_data["dates"], formatted_data["portfolio"])
            ],
            "benchmark_performance": [
                {"date": date, "total_value": value, "indexed_performance": 0}
                for date, value in zip(formatted_data["dates"], formatted_data["index"])
            ],
            "metadata": {
                **formatted_data["metadata"],
                "benchmark_name": benchmark,
                "calculation_timestamp": datetime.now().isoformat()
            },
            "performance_metrics": performance_metrics
        }
        
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] ✅ Performance comparison complete")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] 📊 Portfolio final value: ${response_data['metadata']['portfolio_final_value']}")
        logger.info(f"[backend_api_dashboard.py::backend_api_get_performance] 📈 Index final value: ${response_data['metadata']['index_final_value']}")
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"[backend_api_dashboard.py::backend_api_get_performance] ❌ Unexpected error: {e}")
        DebugLogger.log_error(
            file_name="backend_api_dashboard.py",
            function_name="backend_api_get_performance",
            error=e,
            user_id=user.get("id"),
            period=period
        )
        raise HTTPException(status_code=500, detail=f"Failed to calculate performance comparison: {str(e)}") 