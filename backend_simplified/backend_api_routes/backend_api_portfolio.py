"""
Backend API routes for portfolio and transaction management
Handles CRUD operations for transactions and portfolio calculations
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any, List
import logging
from datetime import datetime
from pydantic import BaseModel

from debug_logger import DebugLogger
from supa_api.supa_api_auth import require_authenticated_user
from supa_api.supa_api_transactions import (
    supa_api_get_user_transactions,
    supa_api_add_transaction,
    supa_api_update_transaction,
    supa_api_delete_transaction
)
from supa_api.supa_api_portfolio import supa_api_calculate_portfolio

logger = logging.getLogger(__name__)

# Create router
portfolio_router = APIRouter()

# Pydantic models for request validation
class TransactionCreate(BaseModel):
    transaction_type: str  # Buy or Sell
    symbol: str
    quantity: float
    price: float
    date: str
    currency: str = "USD"
    commission: float = 0.0
    notes: str = ""

class TransactionUpdate(BaseModel):
    transaction_type: str
    symbol: str
    quantity: float
    price: float
    date: str
    currency: str
    commission: float
    notes: str

@portfolio_router.get("/portfolio")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_PORTFOLIO")
async def backend_api_get_portfolio(
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """Get user's current portfolio holdings calculated from transactions"""
    logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Portfolio requested for user: {user['email']}")
    
    try:
        # Get portfolio calculations
        user_token = user.get("access_token")
        portfolio_data = await supa_api_calculate_portfolio(user["id"], user_token=user_token)
        
        return {
            "success": True,
            "holdings": portfolio_data["holdings"],
            "total_value": portfolio_data["total_value"],
            "total_cost": portfolio_data["total_cost"],
            "total_gain_loss": portfolio_data["total_gain_loss"],
            "total_gain_loss_percent": portfolio_data["total_gain_loss_percent"]
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_portfolio",
            error=e,
            user_id=user["id"]
        )
        raise HTTPException(status_code=500, detail=str(e))

@portfolio_router.get("/transactions")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_TRANSACTIONS")
async def backend_api_get_transactions(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """Get user's transaction history"""
    logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] Transactions requested for user: {user['email']}")
    
    try:
        user_token = user.get("access_token")
        transactions = await supa_api_get_user_transactions(
            user_id=user["id"],
            limit=limit,
            offset=offset,
            user_token=user_token
        )
        
        return {
            "success": True,
            "transactions": transactions,
            "count": len(transactions)
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_transactions",
            error=e,
            user_id=user["id"]
        )
        raise HTTPException(status_code=500, detail=str(e))

@portfolio_router.post("/transactions")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ADD_TRANSACTION")
async def backend_api_add_transaction(
    transaction: TransactionCreate,
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """Add a new transaction"""
    logger.info(f"🔥🔥🔥 [backend_api_portfolio.py::backend_api_add_transaction] === COMPREHENSIVE API DEBUG START ===")
    logger.info(f"🔥 [backend_api_portfolio.py::backend_api_add_transaction] Adding transaction for user: {user['email']}, symbol: {transaction.symbol}")
    
    # 🔥 EXTENSIVE USER AUTHENTICATION DEBUG
    logger.info(f"👤 [USER_AUTH_DEBUG] Full user object: {user}")
    logger.info(f"👤 [USER_AUTH_DEBUG] User keys: {list(user.keys())}")
    logger.info(f"👤 [USER_AUTH_DEBUG] User ID: {user.get('id', 'MISSING!')}")
    logger.info(f"👤 [USER_AUTH_DEBUG] User ID type: {type(user.get('id'))}")
    logger.info(f"👤 [USER_AUTH_DEBUG] User email: {user.get('email', 'MISSING!')}")
    logger.info(f"👤 [USER_AUTH_DEBUG] User aud: {user.get('aud', 'MISSING!')}")
    logger.info(f"👤 [USER_AUTH_DEBUG] User role: {user.get('role', 'MISSING!')}")
    
    # 🔥 EXTENSIVE TRANSACTION INPUT DEBUG
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Raw transaction input: {transaction}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Transaction dict: {transaction.dict()}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Transaction type: {transaction.transaction_type}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Symbol: {transaction.symbol}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Quantity: {transaction.quantity}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Price: {transaction.price}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Date: {transaction.date}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Currency: {transaction.currency}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Commission: {transaction.commission}")
    logger.info(f"📝 [TRANSACTION_INPUT_DEBUG] Notes: {transaction.notes}")

    try:
        # 🔥 SECURITY: Additional input validation and sanitization
        logger.info(f"🔒 [SECURITY_DEBUG] === ADDITIONAL SECURITY VALIDATION ===")
        
        # Validate transaction type
        if transaction.transaction_type not in ["Buy", "Sell"]:
            logger.error(f"❌ [VALIDATION_DEBUG] Invalid transaction type: {transaction.transaction_type}")
            raise ValueError("Transaction type must be 'Buy' or 'Sell'")
        logger.info(f"✅ [VALIDATION_DEBUG] Transaction type validation passed")
        
        # 🔒 SECURITY: Validate numeric fields to prevent overflow attacks
        if transaction.quantity <= 0 or transaction.quantity > 10000000:
            logger.error(f"❌ [SECURITY_DEBUG] Invalid quantity: {transaction.quantity}")
            raise ValueError("Quantity must be between 0.01 and 10,000,000")
            
        if transaction.price <= 0 or transaction.price > 10000000:
            logger.error(f"❌ [SECURITY_DEBUG] Invalid price: {transaction.price}")
            raise ValueError("Price must be between $0.01 and $10,000,000")
            
        if transaction.commission < 0 or transaction.commission > 10000:
            logger.error(f"❌ [SECURITY_DEBUG] Invalid commission: {transaction.commission}")
            raise ValueError("Commission must be between $0 and $10,000")
        
        # 🔒 SECURITY: Validate symbol format (prevent injection via symbol)
        import re
        if not re.match(r'^[A-Z]{1,8}$', transaction.symbol):
            logger.error(f"❌ [SECURITY_DEBUG] Invalid symbol format: {transaction.symbol}")
            raise ValueError("Symbol must be 1-6 uppercase letters only")
        
        # 🔒 SECURITY: Validate date is not too far in past/future
        from datetime import datetime, timedelta
        transaction_date = datetime.strptime(transaction.date, '%Y-%m-%d').date()
        today = datetime.now().date()
        
        if transaction_date > today:
            logger.error(f"❌ [SECURITY_DEBUG] Future date not allowed: {transaction.date}")
            raise ValueError("Transaction date cannot be in the future")
            
        if transaction_date < (today - timedelta(days=3650)):  # 10 years ago
            logger.error(f"❌ [SECURITY_DEBUG] Date too far in past: {transaction.date}")
            raise ValueError("Transaction date cannot be more than 10 years ago")
        
        # 🔒 SECURITY: Sanitize notes field
        if transaction.notes:
            # Remove any potential XSS or injection attempts
            sanitized_notes = re.sub(r'[<>"\';]', '', transaction.notes[:500])  # Limit to 500 chars
            if sanitized_notes != transaction.notes:
                logger.warning(f"⚠️ [SECURITY_DEBUG] Notes field sanitized")
            transaction.notes = sanitized_notes
        
        logger.info(f"✅ [SECURITY_DEBUG] All additional security validations passed")
        
        # Add user_id to transaction data - CRITICAL: Use authenticated user's ID, never trust client
        transaction_data = transaction.dict()
        transaction_data["user_id"] = user["id"]  # 🔒 SECURITY: Force user_id from auth token
        
        logger.info(f"🔗 [TRANSACTION_MERGE_DEBUG] Transaction data BEFORE adding user_id: {transaction.dict()}")
        logger.info(f"🔗 [TRANSACTION_MERGE_DEBUG] User ID being added: {user['id']}")
        logger.info(f"🔗 [TRANSACTION_MERGE_DEBUG] Transaction data AFTER adding user_id: {transaction_data}")
        logger.info(f"🔗 [TRANSACTION_MERGE_DEBUG] Final transaction_data keys: {list(transaction_data.keys())}")
        
        # 🔥 VALIDATE FINAL TRANSACTION DATA
        required_fields = ['user_id', 'symbol', 'transaction_type', 'quantity', 'price', 'date']
        missing_fields = [field for field in required_fields if not transaction_data.get(field)]
        if missing_fields:
            logger.error(f"❌ [FINAL_VALIDATION_DEBUG] MISSING REQUIRED FIELDS: {missing_fields}")
            raise ValueError(f"Missing required fields: {missing_fields}")
        logger.info(f"✅ [FINAL_VALIDATION_DEBUG] All required fields present")
        
        logger.info(f"🚀 [API_DEBUG] Calling supa_api_add_transaction with data: {transaction_data}")
        
        # Add to database
        user_token = user.get("access_token")
        logger.info(f"🔐 [API_DEBUG] Extracting user token for RLS: {bool(user_token)}")
        if user_token:
            logger.info(f"🔐 [API_DEBUG] Token preview: {user_token[:20]}...")
        
        new_transaction = await supa_api_add_transaction(transaction_data, user_token)
        
        logger.info(f"🎉 [API_DEBUG] supa_api_add_transaction returned: {new_transaction}")
        logger.info(f"🔥🔥🔥 [backend_api_portfolio.py::backend_api_add_transaction] === COMPREHENSIVE API DEBUG END (SUCCESS) ===")
        
        return {
            "success": True,
            "transaction": new_transaction,
            "message": f"{transaction.transaction_type} transaction added successfully"
        }
        
    except Exception as e:
        logger.error(f"💥 [API_DEBUG] EXCEPTION IN BACKEND API!")
        logger.error(f"💥 [API_DEBUG] Exception type: {type(e).__name__}")
        logger.error(f"💥 [API_DEBUG] Exception message: {str(e)}")
        logger.error(f"💥 [API_DEBUG] Exception details: {e}")
        
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_add_transaction",
            error=e,
            user_id=user["id"],
            transaction=transaction.dict()
        )
        logger.info(f"🔥🔥🔥 [backend_api_portfolio.py::backend_api_add_transaction] === COMPREHENSIVE API DEBUG END (ERROR) ===")
        raise HTTPException(status_code=400, detail=str(e))

@portfolio_router.put("/transactions/{transaction_id}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="UPDATE_TRANSACTION")
async def backend_api_update_transaction(
    transaction_id: str,
    transaction: TransactionUpdate,
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """Update an existing transaction"""
    logger.info(f"[backend_api_portfolio.py::backend_api_update_transaction] Updating transaction {transaction_id} for user: {user['email']}")
    
    try:
        # CRITICAL FIX: Forward the caller's JWT so RLS allows update operation
        user_token = user.get("access_token")
        logger.info(f"[backend_api_portfolio.py::backend_api_update_transaction] 🔐 JWT token present: {bool(user_token)}")
        
        updated = await supa_api_update_transaction(
            transaction_id=transaction_id,
            user_id=user["id"],
            transaction_data=transaction.dict(),
            user_token=user_token
        )
        
        return {
            "success": True,
            "transaction": updated,
            "message": "Transaction updated successfully"
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_update_transaction",
            error=e,
            transaction_id=transaction_id,
            user_id=user["id"]
        )
        raise HTTPException(status_code=400, detail=str(e))

@portfolio_router.delete("/transactions/{transaction_id}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="DELETE_TRANSACTION")
async def backend_api_delete_transaction(
    transaction_id: str,
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """Delete a transaction"""
    logger.info(f"[backend_api_portfolio.py::backend_api_delete_transaction] Deleting transaction {transaction_id} for user: {user['email']}")
    
    try:
        # CRITICAL FIX: Forward the caller's JWT so RLS allows delete operation
        user_token = user.get("access_token")
        logger.info(f"[backend_api_portfolio.py::backend_api_delete_transaction] 🔐 JWT token present: {bool(user_token)}")
        
        success = await supa_api_delete_transaction(
            transaction_id=transaction_id,
            user_id=user["id"],
            user_token=user_token
        )
        
        if success:
            return {
                "success": True,
                "message": "Transaction deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail="Transaction not found")
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_delete_transaction",
            error=e,
            transaction_id=transaction_id,
            user_id=user["id"]
        )
        raise HTTPException(status_code=400, detail=str(e)) 