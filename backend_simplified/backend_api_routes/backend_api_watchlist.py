"""
Backend API endpoints for watchlist functionality.
Handles all watchlist-related HTTP requests.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from typing import Dict, Any, List, Optional, Union
from decimal import Decimal
import logging
import asyncio

from supa_api.supa_api_auth import require_authenticated_user
from utils.auth_helpers import extract_user_credentials
from utils.response_factory import ResponseFactory
from models.response_models import APIResponse
from supa_api.supa_api_watchlist import (
    supa_api_get_watchlist,
    supa_api_add_to_watchlist,
    supa_api_remove_from_watchlist,
    supa_api_update_watchlist_item,
    supa_api_check_watchlist_status
)
from services.price_manager import price_manager
from debug_logger import DebugLogger

# Import centralized validation models
from models.validation_models import WatchlistAdd, WatchlistUpdate

logger = logging.getLogger(__name__)

# Create router
watchlist_router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

@watchlist_router.get("")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_WATCHLIST")
async def backend_api_get_watchlist(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    include_quotes: bool = Query(True, description="Include current price data"),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
            # Use PriceManager to get current quotes
            from datetime import date
            today = date.today()
            symbols = [item['symbol'] for item in watchlist_items]
            quotes_result = await price_manager.get_portfolio_prices(symbols, today, today, user_token)
            
            # Extract price data from the result
            quotes = {}
            if quotes_result.get('success') and quotes_result.get('prices'):
                for symbol, price_data in quotes_result['prices'].items():
                    quotes[symbol] = price_data
            
            # Merge quote data with watchlist items
            for item in watchlist_items:
                symbol = item['symbol']
                if symbol in quotes and quotes[symbol]:
                    quote = quotes[symbol]
                    item['current_price'] = float(quote.get('price', 0))
                    item['change'] = float(quote.get('change', 0))
                    item['change_percent'] = float(quote.get('change_percent', 0))
                    item['volume'] = int(quote.get('volume', 0))
                else:
                    # Default values if quote not available
                    item['current_price'] = 0
                    item['change'] = 0
                    item['change_percent'] = 0
                    item['volume'] = 0
        
        watchlist_data = {
            "watchlist": watchlist_items,
            "count": len(watchlist_items)
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=watchlist_data,
                message=f"Watchlist retrieved with {len(watchlist_items)} items"
            )
        else:
            return {
                "success": True,
                **watchlist_data
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
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
        
        # Symbol validation is already handled by the Pydantic model
        # if data is provided, it's already validated
        
        # Extract notes and target price if provided
        notes = data.notes if data else None
        target_price = float(data.target_price) if data and data.target_price else None
        
        # Add to watchlist
        watchlist_item = await supa_api_add_to_watchlist(
            user_id=user_id,
            symbol=symbol,
            user_token=user_token,
            notes=notes,
            target_price=target_price
        )
        
        response_data = {
            "item": watchlist_item,
            "message": f"{symbol.upper()} added to watchlist"
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=watchlist_item,
                message=response_data["message"]
            )
        else:
            return {
                "success": True,
                **response_data
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
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
        
        message = f"{symbol.upper()} removed from watchlist"
        
        if api_version == "v2":
            if success:
                return ResponseFactory.success(
                    data=None,
                    message=message
                )
            else:
                return ResponseFactory.error(
                    error="RemovalError",
                    message="Failed to remove item from watchlist",
                    status_code=500
                )
        else:
            return {
                "success": success,
                "message": message
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
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
            target_price=float(data.target_price) if data.target_price else None
        )
        
        response_data = {
            "item": updated_item,
            "message": f"{symbol.upper()} updated successfully"
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=updated_item,
                message=response_data["message"]
            )
        else:
            return {
                "success": True,
                **response_data
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
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
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
        
        status_data = {
            "is_in_watchlist": is_in_watchlist
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=status_data,
                message=f"{symbol.upper()} is {'in' if is_in_watchlist else 'not in'} watchlist"
            )
        else:
            return {
                "success": True,
                **status_data
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