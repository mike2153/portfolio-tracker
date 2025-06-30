"""
Backend API routes for stock research functionality
Handles symbol search and stock overview data
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from typing import List, Dict, Any, Optional
import logging

from debug_logger import DebugLogger
from vantage_api.vantage_api_search import combined_symbol_search
from vantage_api.vantage_api_quotes import vantage_api_get_overview, vantage_api_get_quote
from supa_api.supa_api_auth import get_current_user

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

@research_router.get("/stock_overview")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="STOCK_OVERVIEW")
async def backend_api_stock_overview_handler(
    symbol: str = Query(..., description="Stock symbol to get overview for"),
    user: Optional[Dict[str, Any]] = Depends(get_current_user)
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
        
        # Add user-specific data if authenticated
        if user:
            logger.info(f"[backend_api_research.py::backend_api_stock_overview_handler] User {user['email']} accessing {symbol}")
            # Could add watchlist status, notes, etc here
        
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