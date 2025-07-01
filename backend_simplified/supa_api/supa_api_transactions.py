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
async def supa_api_add_transaction(transaction_data: Dict[str, Any], user_token: Optional[str] = None) -> Dict[str, Any]:
    """Add a new transaction to the database"""
    logger.info(f"🔥🔥🔥 [supa_api_transactions.py::supa_api_add_transaction] === COMPREHENSIVE TRANSACTION DEBUG START ===")
    logger.info(f"🔥 [supa_api_transactions.py::supa_api_add_transaction] Adding transaction: {transaction_data['symbol']} - {transaction_data['transaction_type']}")
    
    # 🔥 EXTENSIVE DEBUGGING FOR RLS ISSUE
    logger.info(f"📊 [TRANSACTION_DEBUG] Full transaction_data: {transaction_data}")
    logger.info(f"📊 [TRANSACTION_DEBUG] Transaction data keys: {list(transaction_data.keys())}")
    logger.info(f"📊 [TRANSACTION_DEBUG] User ID: {transaction_data.get('user_id', 'MISSING!')}")
    logger.info(f"📊 [TRANSACTION_DEBUG] User ID type: {type(transaction_data.get('user_id'))}")
    logger.info(f"📊 [TRANSACTION_DEBUG] Symbol: {transaction_data.get('symbol')}")
    logger.info(f"📊 [TRANSACTION_DEBUG] Transaction type: {transaction_data.get('transaction_type')}")
    logger.info(f"📊 [TRANSACTION_DEBUG] Quantity: {transaction_data.get('quantity')}")
    logger.info(f"📊 [TRANSACTION_DEBUG] Price: {transaction_data.get('price')}")
    logger.info(f"📊 [TRANSACTION_DEBUG] Date: {transaction_data.get('date')}")
    logger.info(f"🔐 [TRANSACTION_DEBUG] User token provided: {bool(user_token)}")
    if user_token:
        logger.info(f"🔐 [TRANSACTION_DEBUG] Token preview: {user_token[:20]}...")
    
    try:
        # 🔥 CREATE AUTHENTICATED CLIENT FOR RLS
        if user_token:
            logger.info(f"🔐 [TRANSACTION_DEBUG] Validating user authentication for RLS...")
            
            # Validate the user token first
            try:
                from .supa_api_client import supa_api_client
                user_response = supa_api_client.get_user_from_token(user_token)
                if user_response and user_response.get('id'):
                    logger.info(f"✅ [TRANSACTION_DEBUG] User token validated: {user_response.get('email')}")
                    
                    # Verify the user_id in transaction matches the token user
                    if str(transaction_data.get('user_id')) != str(user_response.get('id')):
                        logger.error(f"❌ [TRANSACTION_DEBUG] User ID mismatch!")
                        logger.error(f"❌ [TRANSACTION_DEBUG] Token user ID: {user_response.get('id')}")
                        logger.error(f"❌ [TRANSACTION_DEBUG] Transaction user ID: {transaction_data.get('user_id')}")
                        raise Exception("User ID mismatch - security violation")
                    
                    logger.info(f"✅ [TRANSACTION_DEBUG] User ID validation passed")
                    logger.info(f"✅ [TRANSACTION_DEBUG] Using service role client - RLS policies will enforce security")
                    
                    # Use service role client (RLS policies in database will enforce user access)
                    client = get_supa_client()
                    
                else:
                    logger.error(f"❌ [TRANSACTION_DEBUG] Invalid user token")
                    raise Exception("Invalid user token - authentication failed")
                    
            except Exception as auth_error:
                logger.error(f"❌ [TRANSACTION_DEBUG] Authentication validation failed: {auth_error}")
                raise Exception(f"Authentication failed: {auth_error}")
                
        else:
            logger.warning(f"⚠️ [TRANSACTION_DEBUG] No user token provided - using service client")
            # Use service role client (has bypass RLS privileges)
            client = get_supa_client()
        
        logger.info(f"🔗 [TRANSACTION_DEBUG] Supabase client configured successfully")
        
        # 🔥 VALIDATE TRANSACTION DATA BEFORE INSERTION
        required_fields = ['user_id', 'symbol', 'transaction_type', 'quantity', 'price', 'date']
        missing_fields = [field for field in required_fields if not transaction_data.get(field)]
        if missing_fields:
            logger.error(f"❌ [TRANSACTION_DEBUG] MISSING REQUIRED FIELDS: {missing_fields}")
            raise ValueError(f"Missing required fields: {missing_fields}")
        
        # 🔥 LOG EXACT INSERTION ATTEMPT
        logger.info(f"🚀 [TRANSACTION_DEBUG] Attempting database insertion...")
        logger.info(f"🚀 [TRANSACTION_DEBUG] Table: transactions")
        logger.info(f"🚀 [TRANSACTION_DEBUG] Data to insert: {transaction_data}")
        
        # Insert transaction with authenticated client
        result = client.table('transactions') \
            .insert(transaction_data) \
            .execute()
        
        logger.info(f"🎉 [TRANSACTION_DEBUG] Insertion result: {result}")
        logger.info(f"🎉 [TRANSACTION_DEBUG] Result data: {result.data}")
        logger.info(f"🎉 [TRANSACTION_DEBUG] Result count: {result.count}")
        
        if result.data:
            logger.info(f"✅ [supa_api_transactions.py::supa_api_add_transaction] Transaction added with ID: {result.data[0]['id']}")
            logger.info(f"🔥🔥🔥 [supa_api_transactions.py::supa_api_add_transaction] === COMPREHENSIVE TRANSACTION DEBUG END (SUCCESS) ===")
            return result.data[0]
        else:
            logger.error(f"❌ [TRANSACTION_DEBUG] No data returned from insertion!")
            raise Exception("Failed to add transaction - no data returned")
            
    except Exception as e:
        logger.error(f"💥 [TRANSACTION_DEBUG] EXCEPTION DURING INSERTION!")
        logger.error(f"💥 [TRANSACTION_DEBUG] Exception type: {type(e).__name__}")
        logger.error(f"💥 [TRANSACTION_DEBUG] Exception message: {str(e)}")
        logger.error(f"💥 [TRANSACTION_DEBUG] Exception details: {e}")
        
        # 🔥 SPECIFIC RLS ERROR HANDLING
        if "row-level security policy" in str(e).lower():
            logger.error(f"🔒 [TRANSACTION_DEBUG] === RLS POLICY VIOLATION DETECTED ===")
            logger.error(f"🔒 [TRANSACTION_DEBUG] This suggests the user_id doesn't match the authenticated user")
            logger.error(f"🔒 [TRANSACTION_DEBUG] Expected user_id: {transaction_data.get('user_id')}")
            logger.error(f"🔒 [TRANSACTION_DEBUG] User token provided: {bool(user_token)}")
            logger.error(f"🔒 [TRANSACTION_DEBUG] Possible solutions:")
            logger.error(f"🔒 [TRANSACTION_DEBUG] 1. Check Supabase RLS policies for transactions table")
            logger.error(f"🔒 [TRANSACTION_DEBUG] 2. Ensure RLS policy allows INSERT for authenticated users")
            logger.error(f"🔒 [TRANSACTION_DEBUG] 3. Verify user_id in transaction matches auth.uid()")
            logger.error(f"🔒 [TRANSACTION_DEBUG] === RLS POLICY DEBUG END ===")
        
        DebugLogger.log_error(
            file_name="supa_api_transactions.py",
            function_name="supa_api_add_transaction",
            error=e,
            transaction_data=transaction_data
        )
        logger.info(f"🔥🔥🔥 [supa_api_transactions.py::supa_api_add_transaction] === COMPREHENSIVE TRANSACTION DEBUG END (ERROR) ===")
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