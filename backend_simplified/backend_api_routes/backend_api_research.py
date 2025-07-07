"""
Backend API routes for stock research functionality
Handles symbol search and stock overview data
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from debug_logger import DebugLogger
from vantage_api.vantage_api_search import combined_symbol_search
from vantage_api.vantage_api_quotes import vantage_api_get_overview, vantage_api_get_quote, vantage_api_get_historical_price
from supa_api.supa_api_auth import require_authenticated_user
from services.financials_service import FinancialsService

logger = logging.getLogger(__name__)

# Create router
research_router = APIRouter()

@research_router.get("/symbol_search")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="SYMBOL_SEARCH")
async def backend_api_symbol_search_handler(
    q: str = Query(..., description="Search query for stock symbols"),
    limit: int = Query(20, description="Maximum number of results")
) -> Dict[str, Any]:
    """
    Search for stock symbols with intelligent scoring
    Returns relevance-sorted results from cache and Alpha Vantage
    """
    logger.info(f"[backend_api_research.py::backend_api_symbol_search_handler] Search request: query='{q}', limit={limit}")
    
    if not q or len(q.strip()) < 1:
        return {
            "ok": True,
            "results": [],
            "total": 0,
            "query": q,
            "limit": limit
        }
    
    try:
        # Perform combined search (cache + Alpha Vantage)
        results = await combined_symbol_search(q.strip(), limit)
        
        logger.info(f"[backend_api_research.py::backend_api_symbol_search_handler] Found {len(results)} results for '{q}'")
        
        return {
            "ok": True,
            "results": results,
            "total": len(results),
            "query": q,
            "limit": limit
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_symbol_search_handler",
            error=e,
            query=q
        )
        raise HTTPException(status_code=500, detail=str(e))

@research_router.get("/stock_overview", dependencies=[Depends(require_authenticated_user)])
async def backend_api_stock_overview_handler(
    symbol: str = Query(..., description="Stock symbol to get overview for")
) -> Dict[str, Any]:
    """
    Get comprehensive stock overview data
    Combines real-time quote and company fundamentals
    """
    logger.info(f"[backend_api_research.py::backend_api_stock_overview_handler] Overview request for: {symbol}")
    
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    
    symbol = symbol.upper().strip()
    
    try:
        # Get both quote and overview data in parallel
        import asyncio
        quote_task = asyncio.create_task(vantage_api_get_quote(symbol))
        overview_task = asyncio.create_task(vantage_api_get_overview(symbol))
        
        quote_data, overview_data = await asyncio.gather(quote_task, overview_task)
        
        # Combine the data
        combined_data = {
            "symbol": symbol,
            "price_data": quote_data,
            "fundamentals": overview_data,
            "success": True
        }
        
        return combined_data
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_stock_overview_handler",
            error=e,
            symbol=symbol
        )
        
        # Return partial data if possible
        return {
            "symbol": symbol,
            "price_data": None,
            "fundamentals": None,
            "success": False,
            "error": str(e)
        }

@research_router.get("/quote/{symbol}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="QUOTE")
async def backend_api_quote_handler(
    symbol: str
) -> Dict[str, Any]:
    """Get real-time quote data for a symbol"""
    logger.info(f"[backend_api_research.py::backend_api_quote_handler] Quote request for: {symbol}")
    
    try:
        quote_data = await vantage_api_get_quote(symbol.upper())
        return {
            "success": True,
            "data": quote_data
        }
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_quote_handler",
            error=e,
            symbol=symbol
        )
        raise HTTPException(status_code=500, detail=str(e))

@research_router.get("/historical_price/{symbol}", dependencies=[Depends(require_authenticated_user)])
async def backend_api_historical_price_handler(
    symbol: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format for historical price lookup")
) -> Dict[str, Any]:
    """
    Get historical closing price for a stock on a specific date
    
    This endpoint is used by the transaction form to auto-populate the price field
    when a user selects a stock ticker and transaction date.
    
    Args:
        symbol: Stock ticker symbol (e.g., 'AAPL')
        date: Transaction date in YYYY-MM-DD format
    
    Returns:
        Historical price data including open, high, low, close, and volume
        If exact date is not available (weekend/holiday), returns closest trading day
    """
    logger.info(f"[backend_api_research.py::backend_api_historical_price_handler] Historical price request: {symbol} on {date}")
    
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    
    if not date:
        raise HTTPException(status_code=400, detail="Date is required")
    
    # Validate date format
    try:
        from datetime import datetime
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")
    
    symbol = symbol.upper().strip()
    
    try:
        # Get historical price data from Alpha Vantage
        price_data = await vantage_api_get_historical_price(symbol, date)
        
        # Format response for frontend consumption
        response_data = {
            "success": True,
            "symbol": price_data["symbol"],
            "requested_date": price_data["requested_date"],
            "actual_date": price_data["date"],
            "is_exact_date": price_data["is_exact_date"],
            "price_data": {
                "open": price_data["open"],
                "high": price_data["high"],
                "low": price_data["low"],
                "close": price_data["close"],
                "adjusted_close": price_data["adjusted_close"],
                "volume": price_data["volume"]
            },
            "message": f"Historical price for {symbol} on {price_data['date']}" + 
                      ("" if price_data["is_exact_date"] else f" (closest trading day to {date})")
        }
        
        logger.info(f"[backend_api_research.py::backend_api_historical_price_handler] Successfully retrieved price: {symbol} @ ${price_data['close']} on {price_data['date']}")
        
        return response_data
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_historical_price_handler",
            error=e,
            symbol=symbol,
            date=date
        )
        
        # Return error response instead of raising exception to allow frontend to handle gracefully
        return {
            "success": False,
            "symbol": symbol,
            "requested_date": date,
            "error": str(e),
            "message": f"Could not fetch historical price for {symbol} on {date}"
        }

@research_router.get("/financials/{symbol}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="FINANCIALS")
async def backend_api_financials_handler(
    symbol: str,
    data_type: str = Query('overview', description="Type of financial data: overview, income, balance, cashflow"),
    force_refresh: bool = Query(False, description="Force refresh from API even if cached"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Get company financials with intelligent caching
    
    This endpoint implements the required caching pattern:
    1. Check Supabase for fresh data (<24h old)
    2. Return cached data if fresh
    3. Fetch from external API if stale/missing
    4. Store in Supabase for future requests
    """
    logger.info(f"[backend_api_research.py::backend_api_financials_handler] Financials request: {symbol}:{data_type}")
    
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    
    try:
        # Extract JWT token from user data
        user_token = user_data.get("access_token")
        
        result = await FinancialsService.get_company_financials(
            symbol=symbol.upper().strip(),
            data_type=data_type,
            force_refresh=force_refresh,
            user_token=user_token
        )
        
        # Return success response with cache metadata
        return {
            "success": result["success"],
            "data": result.get("data"),
            "metadata": {
                "symbol": result["symbol"],
                "data_type": result["data_type"],
                "cache_status": result["cache_status"],
                "timestamp": datetime.utcnow().isoformat()
            },
            "error": result.get("error")
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_financials_handler",
            error=e,
            symbol=symbol,
            data_type=data_type
        )
        raise HTTPException(status_code=500, detail=str(e))

@research_router.post("/financials/force-refresh")
async def backend_api_force_refresh_financials_handler(
    symbol: str = Query(..., description="Stock symbol to refresh"),
    data_type: str = Query('overview', description="Type of financial data to refresh"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Force refresh financial data from external API
    Admin/dev endpoint for manual cache invalidation
    """
    logger.info(f"[backend_api_research.py] Force refresh request: {symbol}:{data_type}")
    
    try:
        # Extract JWT token from user data
        user_token = user_data.get("access_token")
        
        result = await FinancialsService.get_company_financials(
            symbol=symbol,
            data_type=data_type,
            force_refresh=True,
            user_token=user_token
        )
        
        return {
            "success": True,
            "message": f"Successfully refreshed {symbol}:{data_type}",
            "data": result.get("data"),
            "metadata": {
                "symbol": symbol,
                "data_type": data_type,
                "cache_status": "force_refresh",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_force_refresh_financials_handler",
            error=e,
            symbol=symbol
        )
        raise HTTPException(status_code=500, detail=str(e))