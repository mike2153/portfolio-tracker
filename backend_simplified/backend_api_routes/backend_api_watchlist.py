"""
Backend API endpoints for watchlist functionality.
Handles all watchlist-related HTTP requests.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, List, Optional
from decimal import Decimal
from pydantic import BaseModel, Field
import logging
import asyncio

from supa_api.supa_api_auth import require_authenticated_user
from utils.auth_helpers import extract_user_credentials
from supa_api.supa_api_watchlist import (
    supa_api_get_watchlist,
    supa_api_add_to_watchlist,
    supa_api_remove_from_watchlist,
    supa_api_update_watchlist_item,
    supa_api_check_watchlist_status
)
from vantage_api.vantage_api_quotes import vantage_api_get_quote
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

# Pydantic models for request/response validation
class WatchlistAdd(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=10)
    notes: Optional[str] = Field(None, max_length=500)
    target_price: Optional[Decimal] = Field(None, gt=0, le=10000000)

class WatchlistUpdate(BaseModel):
    notes: Optional[str] = Field(None, max_length=500)
    target_price: Optional[Decimal] = Field(None, gt=0, le=10000000)

# Create router
watchlist_router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

@watchlist_router.get("")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_WATCHLIST")
async def backend_api_get_watchlist(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    include_quotes: bool = Query(True, description="Include current price data")
) -> Dict[str, Any]:
    """
    Get user's watchlist with optional current price data.
    
    Args:
        user: Authenticated user data
        include_quotes: Whether to include current price data
        
    Returns:
        Dict containing watchlist items and count
    """
    logger.info(f"[backend_api_watchlist.py::backend_api_get_watchlist] Watchlist requested for user: {user['email']}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Get watchlist items from database
        watchlist_items = await supa_api_get_watchlist(user_id, user_token)
        
        # If quotes requested, fetch current prices
        if include_quotes and watchlist_items:
            # Fetch quotes in parallel for all symbols
            symbols = [item['symbol'] for item in watchlist_items]
            quote_tasks = [vantage_api_get_quote(symbol) for symbol in symbols]
            quotes = await asyncio.gather(*quote_tasks, return_exceptions=True)
            
            # Merge quote data with watchlist items
            for i, item in enumerate(watchlist_items):
                if not isinstance(quotes[i], Exception) and quotes[i]:
                    quote = quotes[i]
                    item['current_price'] = float(quote.get('price', 0))
                    item['change'] = float(quote.get('change', 0))
                    item['change_percent'] = float(quote.get('changePercent', 0))
                    item['volume'] = int(quote.get('volume', 0))
                else:
                    # Default values if quote fetch failed
                    item['current_price'] = 0
                    item['change'] = 0
                    item['change_percent'] = 0
                    item['volume'] = 0
        
        return {
            "success": True,
            "watchlist": watchlist_items,
            "count": len(watchlist_items)
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_watchlist.py",
            function_name="backend_api_get_watchlist",
            error=e,
            user_id=user["id"]
        )
        raise HTTPException(status_code=500, detail=str(e))

@watchlist_router.post("/{symbol}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ADD_TO_WATCHLIST")
async def backend_api_add_to_watchlist(
    symbol: str,
    data: Optional[WatchlistAdd] = None,
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Add a stock to user's watchlist.
    
    Args:
        symbol: Stock symbol to add
        data: Optional additional data (notes, target price)
        user: Authenticated user data
        
    Returns:
        Dict with success status and message
    """
    logger.info(f"[backend_api_watchlist.py::backend_api_add_to_watchlist] Adding {symbol} to watchlist for user: {user['email']}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Validate symbol format
        import re
        if not re.match(r'^[A-Z0-9.-]{1,10}$', symbol.upper()):
            raise HTTPException(status_code=400, detail="Invalid symbol format")
        
        # Extract notes and target price if provided
        notes = data.notes if data else None
        target_price = data.target_price if data else None
        
        # Add to watchlist
        watchlist_item = await supa_api_add_to_watchlist(
            user_id=user_id,
            symbol=symbol,
            user_token=user_token,
            notes=notes,
            target_price=target_price
        )
        
        return {
            "success": True,
            "item": watchlist_item,
            "message": f"{symbol.upper()} added to watchlist"
        }
        
    except Exception as e:
        if "duplicate key value" in str(e):
            raise HTTPException(status_code=409, detail=f"{symbol} is already in your watchlist")
        
        DebugLogger.log_error(
            file_name="backend_api_watchlist.py",
            function_name="backend_api_add_to_watchlist",
            error=e,
            user_id=user["id"],
            symbol=symbol
        )
        raise HTTPException(status_code=500, detail=str(e))

@watchlist_router.delete("/{symbol}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="REMOVE_FROM_WATCHLIST")
async def backend_api_remove_from_watchlist(
    symbol: str,
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Remove a stock from user's watchlist.
    
    Args:
        symbol: Stock symbol to remove
        user: Authenticated user data
        
    Returns:
        Dict with success status and message
    """
    logger.info(f"[backend_api_watchlist.py::backend_api_remove_from_watchlist] Removing {symbol} from watchlist for user: {user['email']}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Remove from watchlist
        success = await supa_api_remove_from_watchlist(
            user_id=user_id,
            symbol=symbol,
            user_token=user_token
        )
        
        return {
            "success": success,
            "message": f"{symbol.upper()} removed from watchlist"
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_watchlist.py",
            function_name="backend_api_remove_from_watchlist",
            error=e,
            user_id=user["id"],
            symbol=symbol
        )
        raise HTTPException(status_code=500, detail=str(e))

@watchlist_router.put("/{symbol}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="UPDATE_WATCHLIST_ITEM")
async def backend_api_update_watchlist_item(
    symbol: str,
    data: WatchlistUpdate,
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Update watchlist item (notes, target price).
    
    Args:
        symbol: Stock symbol to update
        data: Update data (notes, target price)
        user: Authenticated user data
        
    Returns:
        Dict with success status and message
    """
    logger.info(f"[backend_api_watchlist.py::backend_api_update_watchlist_item] Updating {symbol} in watchlist for user: {user['email']}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Update watchlist item
        updated_item = await supa_api_update_watchlist_item(
            user_id=user_id,
            symbol=symbol,
            user_token=user_token,
            notes=data.notes,
            target_price=data.target_price
        )
        
        return {
            "success": True,
            "item": updated_item,
            "message": f"{symbol.upper()} updated successfully"
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_watchlist.py",
            function_name="backend_api_update_watchlist_item",
            error=e,
            user_id=user["id"],
            symbol=symbol
        )
        raise HTTPException(status_code=500, detail=str(e))

@watchlist_router.get("/{symbol}/status")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="CHECK_WATCHLIST_STATUS")
async def backend_api_check_watchlist_status(
    symbol: str,
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Check if a stock is in user's watchlist.
    
    Args:
        symbol: Stock symbol to check
        user: Authenticated user data
        
    Returns:
        Dict with watchlist status
    """
    logger.info(f"[backend_api_watchlist.py::backend_api_check_watchlist_status] Checking {symbol} status for user: {user['email']}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Check status
        is_in_watchlist = await supa_api_check_watchlist_status(
            user_id=user_id,
            symbol=symbol,
            user_token=user_token
        )
        
        return {
            "success": True,
            "is_in_watchlist": is_in_watchlist
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_watchlist.py",
            function_name="backend_api_check_watchlist_status",
            error=e,
            user_id=user["id"],
            symbol=symbol
        )
        raise HTTPException(status_code=500, detail=str(e))