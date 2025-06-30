"""
Backend API routes for dashboard data
Returns all dashboard data in a single efficient call
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
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
        # Run multiple data fetches in parallel
        portfolio_task = asyncio.create_task(supa_api_calculate_portfolio(user["id"]))
        summary_task = asyncio.create_task(supa_api_get_transaction_summary(user["id"]))
        
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
        # In production, this would fetch historical data
        # For now, return current value as a single point
        portfolio_data = await supa_api_calculate_portfolio(user["id"])
        
        performance_data = {
            "success": True,
            "period": period,
            "data_points": [{
                "date": "today",
                "value": portfolio_data["total_value"],
                "gain_loss": portfolio_data["total_gain_loss"]
            }],
            "summary": {
                "start_value": portfolio_data["total_cost"],
                "end_value": portfolio_data["total_value"],
                "absolute_return": portfolio_data["total_gain_loss"],
                "percent_return": portfolio_data["total_gain_loss_percent"]
            }
        }
        
        return performance_data
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_dashboard.py",
            function_name="backend_api_get_performance",
            error=e,
            user_id=user["id"],
            period=period
        )
        raise HTTPException(status_code=500, detail=str(e)) 