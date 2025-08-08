"""
Backend API routes for stock research functionality
Handles symbol search and stock overview data
"""
from fastapi import APIRouter, Query, HTTPException, Depends, Header
from typing import Dict, Any, Optional, Union
import logging
from datetime import datetime, timedelta, timezone

from debug_logger import DebugLogger
from utils.response_factory import ResponseFactory
from models.response_models import APIResponse
from vantage_api.vantage_api_search import combined_symbol_search
from vantage_api.vantage_api_quotes import vantage_api_get_overview, vantage_api_get_historical_price
from vantage_api.vantage_api_news import vantage_api_get_news_sentiment
from supa_api.supa_api_auth import require_authenticated_user
from services.financials_service import FinancialsService
from services.price_manager import price_manager

logger = logging.getLogger(__name__)

# Create router
research_router = APIRouter()

@research_router.get("/symbol_search")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="SYMBOL_SEARCH")
async def backend_api_symbol_search_handler(
    q: str = Query(..., description="Search query for stock symbols"),
    limit: int = Query(50, description="Maximum number of results"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    Search for stock symbols with intelligent scoring
    Returns relevance-sorted results from cache and Alpha Vantage
    """
    logger.info(f"[backend_api_research.py::backend_api_symbol_search_handler] Search request: query='{q}', limit={limit}")
    
    if not q or len(q.strip()) < 1:
        empty_result = {
            "results": [],
            "total": 0,
            "query": q,
            "limit": limit
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=empty_result,
                message="No search query provided"
            )
        else:
            return {
                "ok": True,
                **empty_result
            }
    
    try:
        # Perform combined search (cache + Alpha Vantage)
        results = await combined_symbol_search(q.strip(), limit)
        
        logger.info(f"[backend_api_research.py::backend_api_symbol_search_handler] Found {len(results)} results for '{q}'")
        
        result_data = {
            "results": results,
            "total": len(results),
            "query": q,
            "limit": limit
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=result_data,
                message=f"Found {len(results)} results for '{q}'"
            )
        else:
            return {
                "ok": True,
                **result_data
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
async def backend_api_stock_overview_handler(
    symbol: str = Query(..., description="Stock symbol to get overview for"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
        
        # Extract user token for price_manager
        user_token = user_data.get("access_token")
        
        # Get latest EOD price and overview data
        quote_task = asyncio.create_task(price_manager.get_latest_prices([symbol], user_token))
        overview_task = asyncio.create_task(vantage_api_get_overview(symbol))
        
        prices_result, overview_data = await asyncio.gather(quote_task, overview_task)
        
        # Extract price data from price_manager result
        if symbol in prices_result:
            price_data = prices_result[symbol]
            quote_data = {
                "symbol": price_data["symbol"],
                "price": str(price_data["price"]),
                "date": price_data["date"],
                "volume": str(price_data["volume"]),
                "open": str(price_data["open"]),
                "high": str(price_data["high"]),
                "low": str(price_data["low"]),
                "close": str(price_data["close"]),
                "price_type": "EOD Price"  # Add EOD notation
            }
        else:
            quote_data = None
            logger.warning(f"[backend_api_research.py] Failed to get EOD price for {symbol}")
        
        # Log overview data for debugging
        logger.info(f"[backend_api_research.py] Overview data for {symbol}: {type(overview_data)} with {len(overview_data) if isinstance(overview_data, dict) else 'non-dict'} keys")
        if isinstance(overview_data, dict) and overview_data:
            logger.info(f"[backend_api_research.py] Overview data keys: {list(overview_data.keys())}")
        
        # Combine the data
        combined_data = {
            "symbol": symbol,
            "price_data": quote_data,
            "fundamentals": overview_data,
            "price_metadata": {
                "data_type": "eod_price",
                "source": "database",
                "price_note": "End-of-Day Price" if quote_data else "EOD price unavailable"
            }
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=combined_data,
                message=f"Stock overview with EOD price retrieved for {symbol}"
            )
        else:
            return {
                "success": True,
                **combined_data
            }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_stock_overview_handler",
            error=e,
            symbol=symbol
        )
        
        # Return partial data if possible
        error_data = {
            "symbol": symbol,
            "price_data": None,
            "fundamentals": None
        }
        
        if api_version == "v2":
            return ResponseFactory.error(
                error="ServiceError",
                message=f"Failed to retrieve stock overview with EOD price: {str(e)}",
                status_code=500
            )
        else:
            return {
                "success": False,
                "error": str(e),
                **error_data
            }

@research_router.get("/quote/{symbol}", dependencies=[Depends(require_authenticated_user)])
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="QUOTE")
async def backend_api_quote_handler(
    symbol: str,
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Get latest EOD price data for a symbol using price_manager"""
    logger.info(f"[backend_api_research.py::backend_api_quote_handler] EOD price request for: {symbol}")
    
    try:
        user_token = user_data.get("access_token")
        symbol = symbol.upper().strip()
        
        # Get latest price using price_manager.get_latest_prices()
        prices_result = await price_manager.get_latest_prices([symbol], user_token)
        
        if symbol in prices_result:
            price_data = prices_result[symbol]
            
            # Format data to match expected structure
            quote_data = {
                "symbol": price_data["symbol"],
                "price": str(price_data["price"]),
                "date": price_data["date"],
                "volume": str(price_data["volume"]),
                "open": str(price_data["open"]),
                "high": str(price_data["high"]),
                "low": str(price_data["low"]),
                "close": str(price_data["close"]),
                "price_type": "EOD Price"  # Add EOD notation
            }
            
            metadata = {
                "data_type": "eod_price",
                "source": "database",
                "price_note": "End-of-Day Price"
            }
            
            if api_version == "v2":
                return ResponseFactory.success(
                    data=quote_data,
                    message="EOD price retrieved successfully",
                    metadata=metadata
                )
            else:
                return {
                    "success": True,
                    "data": quote_data,
                    "metadata": metadata
                }
        else:
            error_msg = f"EOD price data not available for {symbol}"
            
            if api_version == "v2":
                return ResponseFactory.error(
                    error="DataNotAvailable",
                    message=error_msg,
                    status_code=404
                )
            else:
                return {
                    "success": False,
                    "error": error_msg,
                    "data": None,
                    "metadata": {"data_type": "eod_price"}
                }
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_quote_handler",
            error=e,
            symbol=symbol
        )
        if api_version == "v2":
            return ResponseFactory.error(
                error="ServiceError",
                message="EOD price data not available at this time",
                status_code=500
            )
        else:
            return {
                "success": False,
                "error": "EOD price data not available at this time",
                "data": None,
                "metadata": {}
            }

@research_router.get("/historical_price/{symbol}")
async def backend_api_historical_price_handler(
    symbol: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format for historical price lookup"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=response_data,
                message=response_data["message"]
            )
        else:
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
        error_data = {
            "symbol": symbol,
            "requested_date": date
        }
        error_msg = f"Could not fetch historical price for {symbol} on {date}"
        
        if api_version == "v2":
            return ResponseFactory.error(
                error="DataNotAvailable",
                message=error_msg,
                status_code=404
            )
        else:
            return {
                "success": False,
                "error": str(e),
                "message": error_msg,
                **error_data
            }

@research_router.get("/financials/{symbol}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="FINANCIALS")
async def backend_api_financials_handler(
    symbol: str,
    data_type: str = Query('OVERVIEW', description="Type of financial data: OVERVIEW, INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW"),
    force_refresh: bool = Query(False, description="Force refresh from API even if cached"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
        if not user_token:
            raise HTTPException(status_code=401, detail="Unauthorized")
        result = await FinancialsService.get_company_financials(
            symbol=symbol.upper().strip(),
            user_token=user_token,
            data_type=data_type,
            force_refresh=force_refresh
        )
        
        # Return success response with cache metadata
        metadata = {
            "symbol": result["symbol"],
            "data_type": result["data_type"],
            "cache_status": result["cache_status"],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if api_version == "v2":
            if result["success"]:
                return ResponseFactory.success(
                    data=result.get("data"),
                    message="Financial data retrieved successfully",
                    metadata=metadata
                )
            else:
                return ResponseFactory.error(
                    error="DataRetrievalError",
                    message=result.get("error", "Failed to retrieve financial data"),
                    status_code=500
                )
        else:
            return {
                "success": result["success"],
                "data": result.get("data"),
                "metadata": metadata,
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
    data_type: str = Query('OVERVIEW', description="Type of financial data to refresh: OVERVIEW, INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    Force refresh financial data from external API
    Admin/dev endpoint for manual cache invalidation
    """
    logger.info(f"[backend_api_research.py] Force refresh request: {symbol}:{data_type}")
    
    try:
        # Extract JWT token from user data
        user_token = user_data.get("access_token")
        if not user_token:
            raise HTTPException(status_code=401, detail="Unauthorized")
        result = await FinancialsService.get_company_financials(
            symbol=symbol,
            user_token=user_token,
            data_type=data_type,
            force_refresh=True
        )
        
        response_data = {
            "message": f"Successfully refreshed {symbol}:{data_type}",
            "data": result.get("data"),
            "metadata": {
                "symbol": symbol,
                "data_type": data_type,
                "cache_status": "force_refresh",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=result.get("data"),
                message=response_data["message"],
                metadata=response_data["metadata"]
            )
        else:
            return {
                "success": True,
                **response_data
            }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_force_refresh_financials_handler",
            error=e,
            symbol=symbol
        )
        raise HTTPException(status_code=500, detail=str(e))



@research_router.get("/stock_prices/{symbol}", dependencies=[Depends(require_authenticated_user)])
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="STOCK_PRICES")
async def backend_api_stock_prices_handler(
    symbol: str,
    days: int = Query(None, description="Number of days of historical data"),
    years: int = Query(None, description="Number of years of historical data"),
    ytd: bool = Query(False, description="Year-to-date data"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    Get historical price data for a stock ticker with flexible period selection.
    """
    logger.info(f"[backend_api_research.py::backend_api_stock_prices_handler] Price data request: {symbol} with days={days}, years={years}, ytd={ytd}")

    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    symbol = symbol.upper().strip()
    today = datetime.now(timezone.utc).date()

    # Determine start_date based on query params
    if days is not None:
        start_date = today - timedelta(days=days)
    elif years is not None:
        start_date = today - timedelta(days=years * 365)
    elif ytd:
        start_date = datetime(today.year, 1, 1).date()
    else:
        # Default: 5 years
        start_date = today - timedelta(days=5 * 365)

    try:
        # Fetch historical price data using price_manager
        user_token = user_data.get("access_token")
        if not user_token:
            raise HTTPException(status_code=401, detail="Unauthorized")
            
        # Use price_manager.get_historical_prices() which takes a list of symbols
        prices_result = await price_manager.get_historical_prices(
            symbols=[symbol],
            start_date=start_date,
            end_date=today,
            user_token=user_token
        )

        if symbol not in prices_result or not prices_result[symbol]:
            error_msg = f"Historical EOD price data not available for {symbol}"
            
            if api_version == "v2":
                return ResponseFactory.error(
                    error="DataNotAvailable",
                    message=error_msg,
                    status_code=404
                )
            else:
                return {
                    "success": False,
                    "error": error_msg,
                    "data": None,
                    "metadata": {"data_type": "historical_eod_prices"}
                }
        
        # Convert Decimal values to float for JSON serialization
        historical_data = []
        for price_record in prices_result[symbol]:
            historical_data.append({
                "date": price_record["date"],
                "open": str(price_record["open"]),
                "high": str(price_record["high"]),
                "low": str(price_record["low"]),
                "close": str(price_record["close"]),
                "volume": str(price_record["volume"]),
                "adjusted_close": str(price_record["adjusted_close"])
            })
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_stock_prices_handler",
            error=e,
            symbol=symbol,
            days=days,
            years=years,
            ytd=ytd
        )
        if api_version == "v2":
            return ResponseFactory.error(
                error="ServiceError",
                message="Historical EOD price data not available at this time",
                status_code=500
            )
        else:
            return {
                "success": False,
                "error": "Historical EOD price data not available at this time",
                "data": None,
                "metadata": {}
            }

    # Success response with EOD notation
    price_data = {
        "symbol": symbol,
        "price_data": historical_data,
        "start_date": str(start_date),
        "end_date": str(today),
        "data_points": len(historical_data),
        "price_type": "EOD Prices"  # Add EOD notation
    }
    
    metadata = {
        "data_type": "historical_eod_prices",
        "source": "database",
        "price_note": "End-of-Day Historical Prices"
    }
    
    if api_version == "v2":
        return ResponseFactory.success(
            data=price_data,
            message=f"Historical EOD prices retrieved for {symbol}",
            metadata=metadata
        )
    else:
        return {
            "success": True,
            "data": price_data,
            "metadata": metadata
        }

@research_router.get("/news/{symbol}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="NEWS")
async def backend_api_news_handler(
    symbol: str,
    limit: int = Query(50, description="Maximum number of articles"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    Fetch news and sentiment data for a stock symbol
    """
    logger.info(f"[backend_api_research.py::backend_api_news_handler] Fetching news for {symbol}, limit={limit}")
    
    try:
        result = await vantage_api_get_news_sentiment(symbol, limit=limit)
        
        if not result.get('ok'):
            error_msg = result.get('error', 'Failed to fetch news')
            
            if api_version == "v2":
                return ResponseFactory.error(
                    error="NewsServiceError",
                    message=error_msg,
                    status_code=500
                )
            else:
                return {
                    "success": False,
                    "error": error_msg,
                    "data": None
                }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=result['data'],
                message=f"News retrieved for {symbol}"
            )
        else:
            return {
                "success": True,
                "data": result['data']
            }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_research.py",
            function_name="backend_api_news_handler",
            error=e,
            symbol=symbol
        )
        if api_version == "v2":
            return ResponseFactory.error(
                error="ServiceError",
                message=f"Failed to fetch news: {str(e)}",
                status_code=500
            )
        else:
            return {
                "success": False,
                "error": str(e),
                "data": None
            }