"""
Supabase API functions for transaction management
Handles CRUD operations for user transactions
"""
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from .supa_api_client import get_supa_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_TRANSACTIONS")
async def supa_api_get_user_transactions(
    user_id: str,
    limit: int = 100,
    offset: int = 0,
    symbol: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get user's transactions with optional filtering"""
    logger.info(f"[supa_api_transactions.py::supa_api_get_user_transactions] Fetching transactions for user: {user_id}")
    
    try:
        client = get_supa_client()
        
        # Build query
        query = client.table('transactions') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('date', desc=True) \
            .order('created_at', desc=True)
        
        # Add symbol filter if provided
        if symbol:
            query = query.eq('symbol', symbol)
        
        # Add pagination
        query = query.range(offset, offset + limit - 1)
        
        # Execute query
        result = query.execute()
        
        logger.info(f"[supa_api_transactions.py::supa_api_get_user_transactions] Found {len(result.data)} transactions")
        
        return result.data
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_transactions.py",
            function_name="supa_api_get_user_transactions",
            error=e,
            user_id=user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="ADD_TRANSACTION")
async def supa_api_add_transaction(transaction_data: Dict[str, Any]) -> Dict[str, Any]:
    """Add a new transaction to the database"""
    logger.info(f"[supa_api_transactions.py::supa_api_add_transaction] Adding transaction: {transaction_data['symbol']} - {transaction_data['transaction_type']}")
    
    try:
        client = get_supa_client()
        
        # Insert transaction
        result = client.table('transactions') \
            .insert(transaction_data) \
            .execute()
        
        if result.data:
            logger.info(f"[supa_api_transactions.py::supa_api_add_transaction] Transaction added with ID: {result.data[0]['id']}")
            return result.data[0]
        else:
            raise Exception("Failed to add transaction")
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_transactions.py",
            function_name="supa_api_add_transaction",
            error=e,
            transaction_data=transaction_data
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="UPDATE_TRANSACTION")
async def supa_api_update_transaction(
    transaction_id: str,
    user_id: str,
    transaction_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Update an existing transaction"""
    logger.info(f"[supa_api_transactions.py::supa_api_update_transaction] Updating transaction: {transaction_id}")
    
    try:
        client = get_supa_client()
        
        # Ensure user owns the transaction
        existing = client.table('transactions') \
            .select('id') \
            .eq('id', transaction_id) \
            .eq('user_id', user_id) \
            .execute()
        
        if not existing.data:
            raise ValueError("Transaction not found or access denied")
        
        # Update transaction
        result = client.table('transactions') \
            .update(transaction_data) \
            .eq('id', transaction_id) \
            .eq('user_id', user_id) \
            .execute()
        
        if result.data:
            logger.info(f"[supa_api_transactions.py::supa_api_update_transaction] Transaction updated successfully")
            return result.data[0]
        else:
            raise Exception("Failed to update transaction")
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_transactions.py",
            function_name="supa_api_update_transaction",
            error=e,
            transaction_id=transaction_id,
            user_id=user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="DELETE_TRANSACTION")
async def supa_api_delete_transaction(transaction_id: str, user_id: str) -> bool:
    """Delete a transaction"""
    logger.info(f"[supa_api_transactions.py::supa_api_delete_transaction] Deleting transaction: {transaction_id}")
    
    try:
        client = get_supa_client()
        
        # Delete transaction (with user_id check for security)
        result = client.table('transactions') \
            .delete() \
            .eq('id', transaction_id) \
            .eq('user_id', user_id) \
            .execute()
        
        # Check if anything was deleted
        success = len(result.data) > 0
        
        if success:
            logger.info(f"[supa_api_transactions.py::supa_api_delete_transaction] Transaction deleted successfully")
        else:
            logger.warning(f"[supa_api_transactions.py::supa_api_delete_transaction] Transaction not found")
        
        return success
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_transactions.py",
            function_name="supa_api_delete_transaction",
            error=e,
            transaction_id=transaction_id,
            user_id=user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_TRANSACTION_SUMMARY")
async def supa_api_get_transaction_summary(user_id: str) -> Dict[str, Any]:
    """Get summary statistics for user's transactions"""
    logger.info(f"[supa_api_transactions.py::supa_api_get_transaction_summary] Getting transaction summary for user: {user_id}")
    
    try:
        client = get_supa_client()
        
        # Get all transactions for summary
        result = client.table('transactions') \
            .select('transaction_type, quantity, price, commission') \
            .eq('user_id', user_id) \
            .execute()
        
        # Calculate summary
        total_invested = 0.0
        total_sold = 0.0
        total_commission = 0.0
        buy_count = 0
        sell_count = 0
        
        for transaction in result.data:
            amount = transaction['quantity'] * transaction['price']
            commission = transaction.get('commission', 0)
            total_commission += commission
            
            if transaction['transaction_type'] == 'Buy':
                total_invested += amount + commission
                buy_count += 1
            else:  # Sell
                total_sold += amount - commission
                sell_count += 1
        
        summary = {
            'total_invested': total_invested,
            'total_sold': total_sold,
            'total_commission': total_commission,
            'net_invested': total_invested - total_sold,
            'buy_count': buy_count,
            'sell_count': sell_count,
            'total_transactions': buy_count + sell_count
        }
        
        logger.info(f"[supa_api_transactions.py::supa_api_get_transaction_summary] Summary calculated: {summary}")
        
        return summary
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_transactions.py",
            function_name="supa_api_get_transaction_summary",
            error=e,
            user_id=user_id
        )
        raise 