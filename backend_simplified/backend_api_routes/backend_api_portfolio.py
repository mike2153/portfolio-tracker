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
        portfolio_data = await supa_api_calculate_portfolio(user["id"])
        
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
        transactions = await supa_api_get_user_transactions(
            user_id=user["id"],
            limit=limit,
            offset=offset
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
    logger.info(f"[backend_api_portfolio.py::backend_api_add_transaction] Adding transaction for user: {user['email']}, symbol: {transaction.symbol}")
    
    try:
        # Validate transaction type
        if transaction.transaction_type not in ["Buy", "Sell"]:
            raise ValueError("Transaction type must be 'Buy' or 'Sell'")
        
        # Add user_id to transaction data
        transaction_data = transaction.dict()
        transaction_data["user_id"] = user["id"]
        
        # Add to database
        new_transaction = await supa_api_add_transaction(transaction_data)
        
        return {
            "success": True,
            "transaction": new_transaction,
            "message": f"{transaction.transaction_type} transaction added successfully"
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_add_transaction",
            error=e,
            user_id=user["id"],
            transaction=transaction.dict()
        )
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
        updated = await supa_api_update_transaction(
            transaction_id=transaction_id,
            user_id=user["id"],
            transaction_data=transaction.dict()
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
        success = await supa_api_delete_transaction(
            transaction_id=transaction_id,
            user_id=user["id"]
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