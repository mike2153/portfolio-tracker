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
from services.dividend_service import dividend_service

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

    try:
        # 🔥 SECURITY: Additional input validation and sanitization

        
        # Validate transaction type
        if transaction.transaction_type not in ["Buy", "Sell"]:
            logger.error(f"❌ [VALIDATION_DEBUG] Invalid transaction type: {transaction.transaction_type}")
            return {
                "success": False,
                "message": "Transaction type must be 'Buy' or 'Sell'.",
                "error_type": "validation_error"
            }
        # Validate numeric fields
        if transaction.quantity <= 0 or transaction.quantity > 10000000:
            logger.error(f"❌ [SECURITY_DEBUG] Invalid quantity: {transaction.quantity}")
            return {
                "success": False,
                "message": "Quantity must be between 0.01 and 10,000,000 shares.",
                "error_type": "validation_error"
            }
            
        if transaction.price <= 0 or transaction.price > 10000000:
            logger.error(f"❌ [SECURITY_DEBUG] Invalid price: {transaction.price}")
            return {
                "success": False,
                "message": "Price must be between $0.01 and $10,000,000 per share.",
                "error_type": "validation_error"
            }
            
        if transaction.commission < 0 or transaction.commission > 10000:
            logger.error(f"❌ [SECURITY_DEBUG] Invalid commission: {transaction.commission}")
            return {
                "success": False,
                "message": "Commission must be between $0 and $10,000.",
                "error_type": "validation_error"
            }
        
        # 🔒 SECURITY: Validate symbol format (prevent injection via symbol)
        import re
        if not re.match(r'^[A-Z0-9.-]{1,8}$', transaction.symbol):
            logger.error(f"❌ [SECURITY_DEBUG] Invalid symbol format: {transaction.symbol}")
            return {
                "success": False,
                "message": "Invalid symbol format. Symbol must be 1-8 characters (uppercase letters, numbers, dots, or hyphens only).",
                "error_type": "validation_error"
            }
        
        # 🔒 SECURITY: Validate date is not too far in past/future
        from datetime import datetime, timedelta
        transaction_date = datetime.strptime(transaction.date, '%Y-%m-%d').date()
        today = datetime.now().date()
        
        if transaction_date > today:
            logger.error(f"❌ [SECURITY_DEBUG] Future date not allowed: {transaction.date}")
            return {
                "success": False,
                "message": "Transaction date cannot be in the future. Please select a valid date.",
                "error_type": "validation_error"
            }
            
        if transaction_date < (today - timedelta(days=3650)):  # 10 years ago
            logger.error(f"❌ [SECURITY_DEBUG] Date too far in past: {transaction.date}")
            return {
                "success": False,
                "message": "Transaction date cannot be more than 10 years ago. Please select a more recent date.",
                "error_type": "validation_error"
            }
        
        # 🔒 SECURITY: Sanitize notes field
        if transaction.notes:
            # Remove any potential XSS or injection attempts
            sanitized_notes = re.sub(r'[<>"\';]', '', transaction.notes[:500])  # Limit to 500 chars
            if sanitized_notes != transaction.notes:
                logger.warning(f"⚠️ [SECURITY_DEBUG] Notes field sanitized")
            transaction.notes = sanitized_notes
        

        
        # Add user_id to transaction data - CRITICAL: Use authenticated user's ID, never trust client
        transaction_data = transaction.dict()
        transaction_data["user_id"] = user["id"]  # 🔒 SECURITY: Force user_id from auth token
        
        # 🔥 VALIDATE FINAL TRANSACTION DATA
        required_fields = ['user_id', 'symbol', 'transaction_type', 'quantity', 'price', 'date']
        missing_fields = [field for field in required_fields if not transaction_data.get(field)]
        if missing_fields:
            logger.error(f"❌ [FINAL_VALIDATION_DEBUG] MISSING REQUIRED FIELDS: {missing_fields}")
            raise ValueError(f"Missing required fields: {missing_fields}")
        
        # Fetch market info for the symbol from Alpha Vantage search
        market_info = None
        try:
            from vantage_api.vantage_api_search import vantage_api_symbol_search
            search_results = await vantage_api_symbol_search(transaction.symbol, limit=5)
            
            if search_results and len(search_results) > 0:
                # Find exact match for the symbol
                for result in search_results:
                    if result.get('symbol', '').upper() == transaction.symbol.upper():
                        # Use the market info directly from Alpha Vantage
                        market_info = {
                            'region': result.get('region', 'United States'),
                            'marketOpen': result.get('marketOpen', '09:30'),
                            'marketClose': result.get('marketClose', '16:00'),
                            'timezone': result.get('timezone', 'UTC-05'),
                            'currency': result.get('currency', 'USD')
                        }
                        logger.info(f"[backend_api_portfolio.py] Found market info for {transaction.symbol}: {market_info}")
                        break
                
                # If no exact match, use the first result as fallback
                if not market_info and search_results:
                    result = search_results[0]
                    market_info = {
                        'region': result.get('region', 'United States'),
                        'marketOpen': result.get('marketOpen', '09:30'),
                        'marketClose': result.get('marketClose', '16:00'),
                        'timezone': result.get('timezone', 'UTC-05'),
                        'currency': result.get('currency', 'USD')
                    }
                    logger.warning(f"[backend_api_portfolio.py] No exact match for {transaction.symbol}, using first result: {result.get('symbol')}")
                        
        except Exception as search_error:
            logger.warning(f"[backend_api_portfolio.py] Failed to fetch market info for {transaction.symbol}: {search_error}")
            # Continue without market info - will use defaults in the database
        
        # Add to database
        user_token = user.get("access_token")
        
        new_transaction = await supa_api_add_transaction(transaction_data, user_token, market_info)

        # Sync dividends for this symbol after adding a BUY transaction
        if transaction.transaction_type == "Buy":
            try:
                # Get the transaction date for dividend sync
                transaction_date = datetime.strptime(transaction.date, '%Y-%m-%d').date()
                
                # For historical transactions, we might want to sync all past dividends
                # Setting from_date to None will sync all available dividends for the symbol
                # and the service will automatically determine which ones the user is eligible for
                logger.info(f"[backend_api_portfolio.py] Syncing dividends for {transaction.symbol} from {transaction_date}")
                
                # Sync dividends from the transaction date onward
                dividend_sync_result = await dividend_service.sync_dividends_for_symbol(
                    user_id=user["id"],
                    symbol=transaction.symbol,
                    user_token=user_token,
                    from_date=transaction_date  # This ensures we only check dividends after purchase date
                )
                
                if dividend_sync_result.get("success"):
                    logger.info(f"[backend_api_portfolio.py] Successfully synced {dividend_sync_result.get('dividends_synced', 0)} new dividends and assigned {dividend_sync_result.get('dividends_assigned', 0)} dividends to user for {transaction.symbol}")
                else:
                    logger.warning(f"[backend_api_portfolio.py] Dividend sync completed with issues for {transaction.symbol}: {dividend_sync_result.get('error', 'Unknown error')}")
                
            except Exception as dividend_error:
                # Don't fail the transaction if dividend sync fails
                logger.error(f"[backend_api_portfolio.py] Dividend sync failed for {transaction.symbol}: {str(dividend_error)}", exc_info=True)
        
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

@portfolio_router.get("/allocation")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_ALLOCATION")
async def backend_api_get_allocation(
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Unified allocation API endpoint for both dashboard and analytics pages
    Returns comprehensive portfolio allocation data with all calculations
    """
    logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Allocation requested for user: {user['email']}")
    
    try:
        user_token = user.get("access_token")
        user_id = user["id"]
        
        # Get all user transactions
        transactions = await supa_api_get_user_transactions(
            user_id=user_id,
            limit=1000,  # Get all transactions
            user_token=user_token
        )
        
        if not transactions:
            logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] No transactions found for user")
            return {
                "success": True,
                "data": {
                    "allocations": [],
                    "summary": {
                        "total_value": 0,
                        "total_cost": 0,
                        "total_gain_loss": 0,
                        "total_gain_loss_percent": 0,
                        "total_dividends": 0
                    }
                }
            }
        
        # Group transactions by symbol
        holdings = {}
        for txn in transactions:
            symbol = txn['symbol']
            if symbol not in holdings:
                holdings[symbol] = {
                    "symbol": symbol,
                    "quantity": 0,
                    "total_cost": 0,
                    "dividends_received": 0,
                    "transactions": []
                }
            
            holdings[symbol]["transactions"].append(txn)
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                holdings[symbol]["quantity"] += txn['quantity']
                holdings[symbol]["total_cost"] += txn['quantity'] * txn['price']
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                holdings[symbol]["quantity"] -= txn['quantity']
                # Adjust cost basis proportionally
                if holdings[symbol]["quantity"] > 0:
                    cost_per_share = holdings[symbol]["total_cost"] / (holdings[symbol]["quantity"] + txn['quantity'])
                    holdings[symbol]["total_cost"] -= cost_per_share * txn['quantity']
                else:
                    holdings[symbol]["total_cost"] = 0
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                holdings[symbol]["dividends_received"] += txn.get('total_value', txn['price'] * txn['quantity'])
        
        # Filter out holdings with zero quantity
        active_holdings = {k: v for k, v in holdings.items() if v["quantity"] > 0}
        
        if not active_holdings:
            logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] No active holdings found")
            return {
                "success": True,
                "data": {
                    "allocations": [],
                    "summary": {
                        "total_value": 0,
                        "total_cost": 0,
                        "total_gain_loss": 0,
                        "total_gain_loss_percent": 0,
                        "total_dividends": 0
                    }
                }
            }
        
        # Get current prices for all holdings
        allocations = []
        total_value = 0
        total_cost = 0
        total_dividends = 0
        
        # Define colors for allocation visualization
        colors = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime']
        
        for idx, (symbol, holding) in enumerate(active_holdings.items()):
            # Get current price
            price_result = await current_price_manager.get_current_price_fast(symbol)
            
            if price_result.get("success"):
                current_price = price_result["data"]["price"]
                
                # Calculate values
                current_value = holding["quantity"] * current_price
                cost_basis = holding["total_cost"]
                gain_loss = current_value - cost_basis
                gain_loss_percent = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0
                
                # Add to totals
                total_value += current_value
                total_cost += cost_basis
                total_dividends += holding["dividends_received"]
                
                # Create allocation entry
                allocation = {
                    "symbol": symbol,
                    "company_name": price_result["data"].get("company_name", symbol),
                    "quantity": holding["quantity"],
                    "current_price": current_price,
                    "cost_basis": cost_basis,
                    "current_value": current_value,
                    "gain_loss": gain_loss,
                    "gain_loss_percent": gain_loss_percent,
                    "dividends_received": holding["dividends_received"],
                    "allocation_percent": 0,  # Will calculate after we have total
                    "color": colors[idx % len(colors)]
                }
                
                allocations.append(allocation)
            else:
                logger.warning(f"[backend_api_portfolio.py::backend_api_get_allocation] Failed to get price for {symbol}")
        
        # Calculate allocation percentages
        if total_value > 0:
            for allocation in allocations:
                allocation["allocation_percent"] = (allocation["current_value"] / total_value) * 100
        
        # Sort by value (largest first)
        allocations.sort(key=lambda x: x["current_value"], reverse=True)
        
        # Calculate summary metrics
        total_gain_loss = total_value - total_cost
        total_gain_loss_percent = (total_gain_loss / total_cost * 100) if total_cost > 0 else 0
        
        return {
            "success": True,
            "data": {
                "allocations": allocations,
                "summary": {
                    "total_value": total_value,
                    "total_cost": total_cost,
                    "total_gain_loss": total_gain_loss,
                    "total_gain_loss_percent": total_gain_loss_percent,
                    "total_dividends": total_dividends
                }
            }
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_allocation",
            error=e,
            user_id=user["id"]
        )
        raise HTTPException(status_code=500, detail=str(e)) 