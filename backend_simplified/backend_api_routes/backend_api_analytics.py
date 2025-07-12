"""
Backend API routes for analytics functionality
Handles analytics summary, holdings data, and dividend management
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Dict, Any, List
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal

from debug_logger import DebugLogger
from supa_api.supa_api_auth import require_authenticated_user
from services.dividend_service import dividend_service
from services.portfolio_service import PortfolioTimeSeriesService
from services.current_price_manager import current_price_manager

logger = logging.getLogger(__name__)

# Create router
analytics_router = APIRouter()

@analytics_router.get("/summary")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ANALYTICS_SUMMARY")
async def backend_api_analytics_summary(
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Get analytics summary with KPI cards data
    Returns portfolio value, profit, IRR, passive income, and cash balance
    OPTIMIZED: Uses cached portfolio calculation to reduce redundant database calls
    """
    user_id = user_data.get("id")  # Supabase user ID is under 'id' key
    user_token = user_data.get("access_token")
    
    # Validate required authentication data
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_analytics_summary] OPTIMIZED Summary request for user: {user_id}")
    
    try:
        # OPTIMIZATION: Use existing portfolio calculation from portfolio service
        portfolio_service = PortfolioTimeSeriesService()
        portfolio_result = await portfolio_service.get_portfolio_series(user_id, "1D", user_token)  # Just get current value
        
        # Extract current portfolio value from series
        portfolio_value = 0
        total_gain_loss = 0
        total_gain_loss_percent = 0
        
        if portfolio_result[0] and len(portfolio_result[0]) > 0:
            # Get the latest value from the series
            latest_value = portfolio_result[0][-1][1]  # Last [date, value] pair
            portfolio_value = float(latest_value)
            
            # Quick calculation of gain/loss (simplified)
            if len(portfolio_result[0]) > 1:
                first_value = portfolio_result[0][0][1]
                if first_value > 0:
                    total_gain_loss = portfolio_value - float(first_value)
                    total_gain_loss_percent = (total_gain_loss / float(first_value)) * 100
        
        # OPTIMIZATION: Get lightweight dividend summary (no complex calculations)
        dividend_summary = await _get_lightweight_dividend_summary(user_id)
        
        # Skip IRR calculation for summary (too expensive for summary view)
        summary = {
            "portfolio_value": portfolio_value,
            "total_profit": total_gain_loss,
            "total_profit_percent": total_gain_loss_percent,
            "irr_percent": "0",  # Simplified - compute on demand
            "passive_income_ytd": dividend_summary.get("ytd_received", 0),
            "cash_balance": 0,  # TODO: Implement cash tracking
            "dividend_summary": dividend_summary
        }
        
        return {
            "success": True,
            "data": summary,
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "optimized": True
            }
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_analytics_summary",
            error=e,
            user_id=user_id
        )
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/holdings")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ANALYTICS_HOLDINGS")
async def backend_api_analytics_holdings(
    include_sold: bool = Query(False, description="Include sold holdings in response"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Get detailed holdings data for analytics table
    Returns holdings with cost basis, value, dividends, gains, P&L, etc.
    """
    user_id = user_data.get("id")  # Supabase user ID is under 'id' key
    user_token = user_data.get("access_token")
    
    # Validate required authentication data
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_analytics_holdings] Holdings request for user: {user_id}")
    
    try:
        holdings_data = await _get_detailed_holdings(user_id, user_token, include_sold)
        
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
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.get("/dividends")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ANALYTICS_DIVIDENDS")
async def backend_api_analytics_dividends(
    confirmed_only: bool = Query(False, description="Return only confirmed dividends"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    REFACTORED: Get dividends with unified data model and transaction-based confirmation
    Fixes all data consistency and API contract issues
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_analytics_dividends] FIXED dividends request for user: {user_id}, confirmed_only: {confirmed_only}")
    
    try:
        # Use original service with corrected parameter order
        dividends_result = await dividend_service.get_user_dividends(
            user_id, user_token, confirmed_only
        )
        
        if not dividends_result["success"]:
            raise HTTPException(status_code=500, detail=dividends_result.get("error", "Failed to get dividends"))
        
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
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_analytics_dividends",
            error=e,
            user_id=user_id
        )
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/confirm")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="CONFIRM_DIVIDEND")
async def backend_api_confirm_dividend(
    request: Request,
    dividend_id: str = Query(..., description="Dividend ID to confirm"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    REFACTORED: Confirm dividend with proper validation and transaction creation
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    body = await request.json()
    edited_amount = body.get('edited_amount')  # Optional float
    DebugLogger.info_if_enabled(f"[backend_api_analytics.py] REFACTORED confirm request for dividend {dividend_id}, user {user_id}, edited_amount: {edited_amount}", logger)
    
    try:
        # Use original service with corrected parameter order
        result = await dividend_service.confirm_dividend(user_id, dividend_id, user_token, edited_amount)
        
        DebugLogger.info_if_enabled(f"[backend_api_analytics.py] Confirmation result: success={result['success']}, total_amount={result.get('total_amount')}", logger)
        return result
        
    except Exception as e:
        DebugLogger.log_error(file_name="backend_api_analytics.py", function_name="backend_api_confirm_dividend", error=e, user_id=user_id, dividend_id=dividend_id)
        raise HTTPException(status_code=500, detail=str(e))

@analytics_router.post("/dividends/sync")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="SYNC_DIVIDENDS")
async def backend_api_sync_dividends(
    symbol: str = Query(..., description="Symbol to sync dividends for"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    REFACTORED: Manually sync dividends with idempotent upserts
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_sync_dividends] REFACTORED syncing dividends for {symbol}, user: {user_id}")
    
    try:
        # Use original service
        result = await dividend_service.sync_dividends_for_symbol(user_id, symbol.upper(), user_token)
        
        return {
            "success": True,
            "data": result,
            "message": result.get("message", f"Dividend sync completed for {symbol}")
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_analytics.py",
            function_name="backend_api_sync_dividends",
            error=e,
            user_id=user_id,
            symbol=symbol
        )
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
    user_id = user_data.get("id")  # Supabase user ID is under 'id' key
    user_token = user_data.get("access_token")
    
    # Validate required authentication data
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication data")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found in authentication data")
    
    logger.info(f"[backend_api_analytics.py::backend_api_sync_all_dividends] OPTIMIZED sync for user: {user_id}")
    
    try:
        # OPTIMIZATION: Check if user has synced recently (within last 5 minutes)
        last_sync_key = f"dividend_sync_{user_id}"
        current_time = datetime.now().timestamp()
        
        # Simple in-memory rate limiting (in production, use Redis)
        if not hasattr(backend_api_sync_all_dividends, '_sync_cache'):
            backend_api_sync_all_dividends._sync_cache = {}
        
        last_sync_time = backend_api_sync_all_dividends._sync_cache.get(last_sync_key, 0)
        time_since_last_sync = current_time - last_sync_time
        
        if time_since_last_sync < 300:  # 5 minutes
            remaining_time = 300 - time_since_last_sync
            return {
                "success": True,
                "data": {"total_symbols": 0, "dividends_synced": 0},
                "message": f"Dividend sync rate limited. Try again in {int(remaining_time)} seconds.",
                "rate_limited": True
            }
        
        # Update sync time before processing
        backend_api_sync_all_dividends._sync_cache[last_sync_key] = current_time
        
        result = await dividend_service.sync_dividends_for_all_holdings(user_id, user_token)
        
        return {
            "success": True,
            "data": result,
            "message": result.get("message", "Dividend sync completed for all holdings"),
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

# Helper functions

async def _get_portfolio_summary(user_id: str, user_token: str) -> Dict[str, Any]:
    """Get basic portfolio summary data - OPTIMIZED to use existing portfolio service"""
    try:
        # Use the optimized portfolio service instead of duplicating logic
        portfolio_service = PortfolioTimeSeriesService()
        portfolio_result = await portfolio_service.get_portfolio_series(user_id, "1D", user_token)
        
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
    """Get detailed holdings data for analytics table - OPTIMIZED with bulk price fetching"""
    from supa_api.supa_api_transactions import supa_api_get_user_transactions
    
    # Get all transactions using user's JWT token (respects RLS)
    transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
    
    logger.info(f"[backend_api_analytics.py::_get_detailed_holdings] Found {len(transactions) if transactions else 0} transactions for user {user_id}")
    
    if not transactions:
        logger.warning(f"[backend_api_analytics.py::_get_detailed_holdings] No transactions found for user {user_id}")
        return []
    
    # Group by symbol and calculate metrics
    holdings = {}
    
    for transaction in transactions:
        symbol = transaction['symbol']
        if symbol not in holdings:
            holdings[symbol] = {
                "symbol": symbol,
                "quantity": 0,
                "cost_basis": 0,
                "realized_pnl": 0,
                "dividends_received": 0,
                "total_bought": 0,
                "total_sold": 0
            }
        
        if transaction['transaction_type'] in ['Buy', 'BUY']:
            holdings[symbol]["quantity"] += transaction['quantity']
            holdings[symbol]["cost_basis"] += transaction['quantity'] * transaction['price']
            holdings[symbol]["total_bought"] += transaction['quantity'] * transaction['price']
        elif transaction['transaction_type'] in ['Sell', 'SELL']:
            # Calculate realized P&L
            avg_cost = holdings[symbol]["cost_basis"] / holdings[symbol]["quantity"] if holdings[symbol]["quantity"] > 0 else 0
            realized_gain = (transaction['price'] - avg_cost) * transaction['quantity']
            holdings[symbol]["realized_pnl"] += realized_gain
            
            holdings[symbol]["quantity"] -= transaction['quantity']
            holdings[symbol]["cost_basis"] -= avg_cost * transaction['quantity']
            holdings[symbol]["total_sold"] += transaction['quantity'] * transaction['price']
        elif transaction['transaction_type'] in ['Dividend', 'DIVIDEND']:
            holdings[symbol]["dividends_received"] += transaction.get('total_value', transaction['quantity'] * transaction['price'])
    
    # OPTIMIZATION: Get current prices in bulk for all symbols at once
    symbols_to_price = [symbol for symbol, holding in holdings.items() 
                       if include_sold or holding["quantity"] > 0]
    
    # Bulk fetch prices for all symbols
    symbol_prices = {}
    for symbol in symbols_to_price:
        price_result = await current_price_manager.get_current_price_fast(symbol)
        if price_result.get("success"):
            symbol_prices[symbol] = price_result["data"].get("price", 0)
        else:
            symbol_prices[symbol] = 0
    
    logger.info(f"[backend_api_analytics.py::_get_detailed_holdings] Fetched prices for {len(symbol_prices)} symbols")
    
    # Get current prices and calculate current values
    result_holdings = []
    
    for symbol, holding in holdings.items():
        if not include_sold and holding["quantity"] <= 0:
            continue
        
        # Get current price from our bulk-fetched data
        current_price = symbol_prices.get(symbol, 0)
        
        current_value = holding["quantity"] * current_price
        unrealized_gain = current_value - holding["cost_basis"]
        total_profit = unrealized_gain + holding["realized_pnl"] + holding["dividends_received"]
        
        # Calculate percentages
        total_invested = holding["cost_basis"] + holding["total_sold"]
        unrealized_gain_percent = (unrealized_gain / holding["cost_basis"] * 100) if holding["cost_basis"] > 0 else 0
        total_profit_percent = (total_profit / total_invested * 100) if total_invested > 0 else 0
        
        result_holdings.append({
            "symbol": symbol,
            "quantity": holding["quantity"],
            "current_price": current_price,
            "current_value": current_value,
            "cost_basis": holding["cost_basis"],
            "unrealized_gain": unrealized_gain,
            "unrealized_gain_percent": unrealized_gain_percent,
            "realized_pnl": holding["realized_pnl"],
            "dividends_received": holding["dividends_received"],
            "total_profit": total_profit,
            "total_profit_percent": total_profit_percent,
            "daily_change": 0,  # TODO: Calculate daily change
            "daily_change_percent": 0,  # TODO: Calculate daily change percent
            "irr_percent": 0  # TODO: Calculate IRR per holding
        })
    
    return result_holdings

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
            projected_amount = float(dividend['amount']) * enriched_dividend['current_holdings']
            enriched_dividend['projected_amount'] = projected_amount
        
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
        
        ytd_result = supa_client.table('user_dividends') \
            .select('amount') \
            .eq('user_id', user_id) \
            .eq('confirmed', True) \
            .gte('pay_date', year_start) \
            .execute()
        
        ytd_received = sum(float(div['amount']) for div in ytd_result.data) if ytd_result.data else 0
        
        return {
            "ytd_received": ytd_received,
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
        portfolio_service = PortfolioTimeSeriesService()
        portfolio_data = await portfolio_service.get_portfolio_series(user_id, "1Y", user_token)
        
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
        
        total_return = (end_value - start_value) / start_value
        days = len(series_data)
        annualized_return = (Decimal(1) + total_return) ** (Decimal('365') / Decimal(days)) - Decimal(1)
        
        return {"irr_percent": annualized_return * 100}
        
    except Exception as e:
        logger.error(f"Failed to calculate IRR: {e}")
        return {"irr_percent": 0}