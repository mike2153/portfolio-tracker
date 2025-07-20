"""
Supabase API functions for watchlist operations.
Handles all database interactions for the watchlist feature.
"""
from typing import List, Dict, Any, Optional
from decimal import Decimal
from supabase import Client
from supa_api.supa_api_jwt_helpers import create_authenticated_client
from debug_logger import DebugLogger
import asyncio

@DebugLogger.log_api_call(api_name="SUPABASE_API", sender="BACKEND", receiver="SUPABASE", operation="GET_WATCHLIST")
async def supa_api_get_watchlist(user_id: str, user_token: str) -> List[Dict[str, Any]]:
    """
    Get user's watchlist.
    
    Args:
        user_id: User's UUID
        user_token: JWT token for authentication
        
    Returns:
        List of watchlist items
        
    Raises:
        Exception: If database query fails
    """
    try:
        # Create authenticated client
        auth_client = create_authenticated_client(user_token)
        
        # Fetch watchlist items
        response = auth_client.table('watchlist') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at.asc') \
            .execute()
        
        return response.data
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_watchlist.py",
            function_name="supa_api_get_watchlist",
            error=e,
            user_id=user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE_API", sender="BACKEND", receiver="SUPABASE", operation="ADD_TO_WATCHLIST")
async def supa_api_add_to_watchlist(
    user_id: str, 
    symbol: str, 
    user_token: str,
    notes: Optional[str] = None,
    target_price: Optional[Decimal] = None
) -> Dict[str, Any]:
    """
    Add a stock to user's watchlist.
    
    Args:
        user_id: User's UUID
        symbol: Stock symbol
        user_token: JWT token for authentication
        notes: Optional notes about the stock
        target_price: Optional target price
        
    Returns:
        Created watchlist item
        
    Raises:
        Exception: If database insert fails
    """
    try:
        # Create authenticated client
        auth_client = create_authenticated_client(user_token)
        
        # Prepare data
        data = {
            'user_id': user_id,
            'symbol': symbol.upper(),
            'notes': notes,
            'target_price': str(target_price) if target_price else None
        }
        
        # Insert into watchlist
        response = auth_client.table('watchlist') \
            .insert(data) \
            .execute()
        
        if response.data:
            return response.data[0]
        else:
            raise Exception("Failed to add to watchlist")
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_watchlist.py",
            function_name="supa_api_add_to_watchlist",
            error=e,
            user_id=user_id,
            symbol=symbol
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE_API", sender="BACKEND", receiver="SUPABASE", operation="REMOVE_FROM_WATCHLIST")
async def supa_api_remove_from_watchlist(user_id: str, symbol: str, user_token: str) -> bool:
    """
    Remove a stock from user's watchlist.
    
    Args:
        user_id: User's UUID
        symbol: Stock symbol
        user_token: JWT token for authentication
        
    Returns:
        True if successful
        
    Raises:
        Exception: If database delete fails
    """
    try:
        # Create authenticated client
        auth_client = create_authenticated_client(user_token)
        
        # Delete from watchlist
        response = auth_client.table('watchlist') \
            .delete() \
            .eq('user_id', user_id) \
            .eq('symbol', symbol.upper()) \
            .execute()
        
        return True
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_watchlist.py",
            function_name="supa_api_remove_from_watchlist",
            error=e,
            user_id=user_id,
            symbol=symbol
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE_API", sender="BACKEND", receiver="SUPABASE", operation="UPDATE_WATCHLIST_ITEM")
async def supa_api_update_watchlist_item(
    user_id: str,
    symbol: str,
    user_token: str,
    notes: Optional[str] = None,
    target_price: Optional[Decimal] = None
) -> Dict[str, Any]:
    """
    Update a watchlist item (notes, target price).
    
    Args:
        user_id: User's UUID
        symbol: Stock symbol
        user_token: JWT token for authentication
        notes: Optional updated notes
        target_price: Optional updated target price
        
    Returns:
        Updated watchlist item
        
    Raises:
        Exception: If database update fails
    """
    try:
        # Create authenticated client
        auth_client = create_authenticated_client(user_token)
        
        # Prepare update data
        update_data = {}
        if notes is not None:
            update_data['notes'] = notes
        if target_price is not None:
            update_data['target_price'] = str(target_price)
            
        # Update watchlist item
        response = auth_client.table('watchlist') \
            .update(update_data) \
            .eq('user_id', user_id) \
            .eq('symbol', symbol.upper()) \
            .execute()
        
        if response.data:
            return response.data[0]
        else:
            raise Exception("Failed to update watchlist item")
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_watchlist.py",
            function_name="supa_api_update_watchlist_item",
            error=e,
            user_id=user_id,
            symbol=symbol
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE_API", sender="BACKEND", receiver="SUPABASE", operation="CHECK_WATCHLIST_STATUS")
async def supa_api_check_watchlist_status(user_id: str, symbol: str, user_token: str) -> bool:
    """
    Check if a stock is in user's watchlist.
    
    Args:
        user_id: User's UUID
        symbol: Stock symbol
        user_token: JWT token for authentication
        
    Returns:
        True if stock is in watchlist, False otherwise
    """
    try:
        # Create authenticated client
        auth_client = create_authenticated_client(user_token)
        
        # Check if exists
        response = auth_client.table('watchlist') \
            .select('id') \
            .eq('user_id', user_id) \
            .eq('symbol', symbol.upper()) \
            .execute()
        
        return len(response.data) > 0
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_watchlist.py",
            function_name="supa_api_check_watchlist_status",
            error=e,
            user_id=user_id,
            symbol=symbol
        )
        return False