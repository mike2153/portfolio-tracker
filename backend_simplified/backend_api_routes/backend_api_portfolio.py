"""
Backend API routes for portfolio and transaction management
Handles CRUD operations for transactions and portfolio calculations
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Query, Header
from typing import Dict, Any, List, Optional, Union
import logging
from datetime import datetime
from decimal import Decimal

from debug_logger import DebugLogger
from supa_api.supa_api_auth import require_authenticated_user
from utils.auth_helpers import extract_user_credentials
from utils.response_factory import ResponseFactory
from models.response_models import APIResponse, ErrorResponse
from utils.error_handlers import (
    ServiceUnavailableError, 
    InvalidInputError, 
    DataNotFoundError,
    handle_database_error,
    handle_external_api_error,
    async_error_handler
)
from supa_api.supa_api_transactions import (
    supa_api_get_user_transactions,
    supa_api_add_transaction,
    supa_api_update_transaction,
    supa_api_delete_transaction
)
from supa_api.supa_api_portfolio import supa_api_calculate_portfolio
from services.dividend_service import dividend_service
from services.price_manager import price_manager
from services.portfolio_calculator import portfolio_calculator
from services.portfolio_metrics_manager import portfolio_metrics_manager

# Import centralized validation models
from models.validation_models import TransactionCreate, TransactionUpdate

logger = logging.getLogger(__name__)

# Create router
portfolio_router = APIRouter()

@portfolio_router.get("/portfolio")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_PORTFOLIO")
async def backend_api_get_portfolio(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False, description="Force refresh cache"),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Get user's current portfolio holdings calculated from transactions"""
    # Comprehensive logging for incoming request
    logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] === GET PORTFOLIO REQUEST START ===")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] User email: {user.get('email', 'unknown')}")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] User ID: {user.get('id', 'unknown')}")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Force refresh: {force_refresh}")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Auth headers present: {bool(user.get('access_token'))}")
    
    try:
        # Use PortfolioMetricsManager for optimized portfolio data
        user_id, user_token = extract_user_credentials(user)
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Extracted user_id: {user_id}")
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Token length: {len(user_token) if user_token else 0}")
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="portfolio",
            force_refresh=force_refresh
        )
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Metrics retrieved, cache status: {metrics.cache_status}")
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Holdings count: {len(metrics.holdings)}")
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Computation time: {metrics.computation_time_ms}ms")
        
        # Convert holdings to expected format
        holdings_list = []
        for holding in metrics.holdings:
            holdings_list.append({
                "symbol": holding.symbol,
                "quantity": float(holding.quantity),
                "avg_cost": float(holding.avg_cost),
                "total_cost": float(holding.total_cost),
                "current_price": float(holding.current_price),
                "current_value": float(holding.current_value),
                "gain_loss": float(holding.gain_loss),
                "gain_loss_percent": holding.gain_loss_percent,
                "dividends_received": float(holding.dividends_received) if hasattr(holding, 'dividends_received') else 0,
                "price_date": holding.price_date,
                "currency": holding.currency if hasattr(holding, 'currency') else "USD",
                "base_currency_value": float(holding.base_currency_value) if hasattr(holding, 'base_currency_value') and holding.base_currency_value else float(holding.current_value)
            })
        
        portfolio_data = {
            "holdings": holdings_list,
            "total_value": float(metrics.performance.total_value),
            "total_cost": float(metrics.performance.total_cost),
            "total_gain_loss": float(metrics.performance.total_gain_loss),
            "total_gain_loss_percent": metrics.performance.total_gain_loss_percent,
            "base_currency": metrics.performance.base_currency if hasattr(metrics.performance, 'base_currency') else "USD"
        }
        
        # Check API version for response format
        if api_version == "v2":
            response = ResponseFactory.success(
                data=portfolio_data,
                message="Portfolio data retrieved successfully",
                metadata={
                    "cache_status": metrics.cache_status,
                    "computation_time_ms": metrics.computation_time_ms
                }
            )
            logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Returning v2 format response")
            return response
        else:
            # Backward compatible format
            response_data = {
                "success": True,
                **portfolio_data,
                "cache_status": metrics.cache_status,
                "computation_time_ms": metrics.computation_time_ms
            }
            logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Returning v1 format response")
            return response_data
        
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] Response data structure: {list(portfolio_data.keys())}")
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] === GET PORTFOLIO REQUEST END (SUCCESS) ===")
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"[backend_api_portfolio.py::backend_api_get_portfolio] ERROR: {type(e).__name__}: {str(e)}")
        logger.error(f"[backend_api_portfolio.py::backend_api_get_portfolio] Full stack trace:", exc_info=True)
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_portfolio",
            error=e,
            user_id=user_id if 'user_id' in locals() else 'unknown'
        )
        logger.info(f"[backend_api_portfolio.py::backend_api_get_portfolio] === GET PORTFOLIO REQUEST END (ERROR) ===")
        
        if "supabase" in str(e).lower() or "postgrest" in str(e).lower():
            raise handle_database_error(e, "portfolio retrieval", user_id if 'user_id' in locals() else None)
        else:
            raise ServiceUnavailableError(
                "Portfolio Service",
                f"Failed to retrieve portfolio data: {str(e)}"
            )

@portfolio_router.get("/transactions")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_TRANSACTIONS")
async def backend_api_get_transactions(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    limit: int = 100,
    offset: int = 0,
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Get user's transaction history"""
    logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] === GET TRANSACTIONS REQUEST START ===")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] User email: {user.get('email', 'unknown')}")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] Limit: {limit}, Offset: {offset}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] Extracted user_id: {user_id}")
        
        transactions = await supa_api_get_user_transactions(
            user_id=user_id,
            limit=limit,
            offset=offset,
            user_token=user_token
        )
        logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] Retrieved {len(transactions)} transactions")
        
        # Check API version for response format
        if api_version == "v2":
            response = ResponseFactory.success(
                data={
                    "transactions": transactions,
                    "count": len(transactions)
                },
                message="Transactions retrieved successfully"
            )
            logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] Returning v2 format response")
            return response
        else:
            # Backward compatible format
            response_data = {
                "success": True,
                "transactions": transactions,
                "count": len(transactions)
            }
            logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] Returning v1 format response")
            return response_data
        
        logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] === GET TRANSACTIONS REQUEST END (SUCCESS) ===")
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"[backend_api_portfolio.py::backend_api_get_transactions] ERROR: {type(e).__name__}: {str(e)}")
        logger.error(f"[backend_api_portfolio.py::backend_api_get_transactions] Full stack trace:", exc_info=True)
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_transactions",
            error=e,
            user_id=user_id if 'user_id' in locals() else 'unknown'
        )
        logger.info(f"[backend_api_portfolio.py::backend_api_get_transactions] === GET TRANSACTIONS REQUEST END (ERROR) ===")
        
        if "supabase" in str(e).lower() or "postgrest" in str(e).lower():
            raise handle_database_error(e, "transaction retrieval", user_id if 'user_id' in locals() else None)
        else:
            raise ServiceUnavailableError(
                "Transaction Service",
                f"Failed to retrieve transactions: {str(e)}"
            )

@portfolio_router.post("/cache/clear")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="CLEAR_CACHE")
async def backend_api_clear_cache(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Clear the portfolio metrics cache for the current user"""
    logger.info(f"[backend_api_portfolio.py::backend_api_clear_cache] Clearing cache for user: {user['email']}")
    
    try:
        user_id = user["id"]
        
        # Invalidate all cache entries for the user
        await portfolio_metrics_manager.invalidate_user_cache(user_id)
        
        # Check API version for response format
        if api_version == "v2":
            return ResponseFactory.success(
                data={"cleared": True},
                message="Portfolio cache cleared successfully"
            )
        else:
            # Backward compatible format
            return {
                "success": True,
                "message": "Portfolio cache cleared successfully"
            }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_clear_cache",
            error=e,
            user_id=user_id
        )
        raise ServiceUnavailableError(
            "Cache Service",
            f"Failed to clear cache: {str(e)}"
        )

@portfolio_router.post("/transactions")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ADD_TRANSACTION")
async def backend_api_add_transaction(
    transaction: TransactionCreate,
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Add a new transaction"""
    logger.info(f"🔥🔥🔥 [backend_api_portfolio.py::backend_api_add_transaction] === COMPREHENSIVE API DEBUG START ===")
    logger.info(f"🔥 [backend_api_portfolio.py::backend_api_add_transaction] Adding transaction for user: {user['email']}, symbol: {transaction.symbol}")

    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Note: Input validation is now handled by the Pydantic model with Field validators
        # Symbol is already validated and normalized by the model
        # All numeric fields are already Decimal types with proper constraints
        # Date validation and notes sanitization are handled by validators
        

        
        # Add user_id to transaction data - CRITICAL: Use authenticated user's ID, never trust client
        transaction_data = transaction.model_dump()
        transaction_data["user_id"] = user["id"]  # 🔒 SECURITY: Force user_id from auth token
        
        # Convert Decimal fields to float for JSON serialization
        transaction_data["quantity"] = float(transaction_data["quantity"])
        transaction_data["price"] = float(transaction_data["price"])
        transaction_data["commission"] = float(transaction_data["commission"])
        transaction_data["exchange_rate"] = float(transaction_data["exchange_rate"])
        
        # Convert date to string format
        transaction_data["date"] = transaction_data["date"].strftime('%Y-%m-%d')
        
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
        # Note: user_id and user_token already extracted at the beginning of the function
        
        new_transaction = await supa_api_add_transaction(transaction_data, user_token, market_info)
        
        # Invalidate cache after adding transaction
        await portfolio_metrics_manager.invalidate_user_cache(user_id)

        # Sync dividends for this symbol after adding a BUY transaction
        if transaction.transaction_type == "Buy":
            try:
                # Get the transaction date for dividend sync
                transaction_date = transaction.date
                
                # For historical transactions, we might want to sync all past dividends
                # Setting from_date to None will sync all available dividends for the symbol
                # and the service will automatically determine which ones the user is eligible for
                logger.info(f"[backend_api_portfolio.py] Syncing dividends for {transaction.symbol} from {transaction_date}")
                
                # Sync dividends from the transaction date onward
                if not user_token:
                    raise HTTPException(status_code=401, detail="Missing user token")
                # Now safe to use user_token as str
                dividend_sync_result = await dividend_service.sync_dividends_for_symbol(
                    user_id=user_id,
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
        
        # Check API version for response format
        if api_version == "v2":
            return ResponseFactory.success(
                data={"transaction": new_transaction},
                message=f"{transaction.transaction_type} transaction added successfully"
            )
        else:
            # Backward compatible format
            return {
                "success": True,
                "transaction": new_transaction,
                "message": f"{transaction.transaction_type} transaction added successfully"
            }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except ValueError as e:
        logger.error(f"💥 [API_DEBUG] VALUE ERROR IN BACKEND API!")
        logger.error(f"💥 [API_DEBUG] Exception message: {str(e)}")
        raise InvalidInputError("transaction", str(e))
    except Exception as e:
        logger.error(f"💥 [API_DEBUG] EXCEPTION IN BACKEND API!")
        logger.error(f"💥 [API_DEBUG] Exception type: {type(e).__name__}")
        logger.error(f"💥 [API_DEBUG] Exception message: {str(e)}")
        logger.error(f"💥 [API_DEBUG] Exception details: {e}")
        
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_add_transaction",
            error=e,
            user_id=user_id if 'user_id' in locals() else 'unknown',
            transaction=transaction.model_dump()
        )
        logger.info(f"🔥🔥🔥 [backend_api_portfolio.py::backend_api_add_transaction] === COMPREHENSIVE API DEBUG END (ERROR) ===")
        
        if "supabase" in str(e).lower() or "postgrest" in str(e).lower():
            raise handle_database_error(e, "transaction creation", user_id if 'user_id' in locals() else None)
        elif "alpha vantage" in str(e).lower():
            raise handle_external_api_error(e, "Alpha Vantage", "symbol search", user_id if 'user_id' in locals() else None)
        else:
            raise ServiceUnavailableError(
                "Transaction Service",
                f"Failed to add transaction: {str(e)}"
            )

@portfolio_router.put("/transactions/{transaction_id}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="UPDATE_TRANSACTION")
async def backend_api_update_transaction(
    transaction_id: str,
    transaction: TransactionUpdate,
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Update an existing transaction"""
    logger.info(f"[backend_api_portfolio.py::backend_api_update_transaction] Updating transaction {transaction_id} for user: {user['email']}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # CRITICAL FIX: Forward the caller's JWT so RLS allows update operation
        logger.info(f"[backend_api_portfolio.py::backend_api_update_transaction] 🔐 JWT token present: {bool(user_token)}")
        
        # Convert Pydantic model to dict with proper serialization
        transaction_data = transaction.model_dump()
        
        # Convert Decimal fields to float for JSON serialization
        transaction_data["quantity"] = float(transaction_data["quantity"])
        transaction_data["price"] = float(transaction_data["price"])
        transaction_data["commission"] = float(transaction_data["commission"])
        transaction_data["exchange_rate"] = float(transaction_data["exchange_rate"])
        
        # Convert date to string format
        transaction_data["date"] = transaction_data["date"].strftime('%Y-%m-%d')
        
        updated = await supa_api_update_transaction(
            transaction_id=transaction_id,
            user_id=user_id,
            transaction_data=transaction_data,
            user_token=user_token
        )
        
        # Invalidate cache after updating transaction
        await portfolio_metrics_manager.invalidate_user_cache(user_id)
        
        # Check API version for response format
        if api_version == "v2":
            return ResponseFactory.success(
                data={"transaction": updated},
                message="Transaction updated successfully"
            )
        else:
            # Backward compatible format
            return {
                "success": True,
                "transaction": updated,
                "message": "Transaction updated successfully"
            }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_update_transaction",
            error=e,
            transaction_id=transaction_id,
            user_id=user_id if 'user_id' in locals() else 'unknown'
        )
        
        if "not found" in str(e).lower():
            raise DataNotFoundError("Transaction", transaction_id)
        elif "supabase" in str(e).lower() or "postgrest" in str(e).lower():
            raise handle_database_error(e, "transaction update", user_id if 'user_id' in locals() else None)
        else:
            raise ServiceUnavailableError(
                "Transaction Service",
                f"Failed to update transaction: {str(e)}"
            )

@portfolio_router.delete("/transactions/{transaction_id}")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="DELETE_TRANSACTION")
async def backend_api_delete_transaction(
    transaction_id: str,
    user: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Delete a transaction"""
    logger.info(f"[backend_api_portfolio.py::backend_api_delete_transaction] Deleting transaction {transaction_id} for user: {user['email']}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # CRITICAL FIX: Forward the caller's JWT so RLS allows delete operation
        logger.info(f"[backend_api_portfolio.py::backend_api_delete_transaction] 🔐 JWT token present: {bool(user_token)}")
        
        success = await supa_api_delete_transaction(
            transaction_id=transaction_id,
            user_id=user_id,
            user_token=user_token
        )
        
        if success:
            # Invalidate cache after deleting transaction
            await portfolio_metrics_manager.invalidate_user_cache(user_id)
            
            # Check API version for response format
            if api_version == "v2":
                return ResponseFactory.success(
                    data={"deleted": True},
                    message="Transaction deleted successfully"
                )
            else:
                # Backward compatible format
                return {
                    "success": True,
                    "message": "Transaction deleted successfully"
                }
        else:
            raise DataNotFoundError("Transaction", transaction_id)
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_delete_transaction",
            error=e,
            transaction_id=transaction_id,
            user_id=user_id if 'user_id' in locals() else 'unknown'
        )
        
        if "supabase" in str(e).lower() or "postgrest" in str(e).lower():
            raise handle_database_error(e, "transaction deletion", user_id if 'user_id' in locals() else None)
        else:
            raise ServiceUnavailableError(
                "Transaction Service",
                f"Failed to delete transaction: {str(e)}"
            )

@portfolio_router.get("/allocation")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_ALLOCATION")
async def backend_api_get_allocation(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False, description="Force refresh cache"),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """
    Unified allocation API endpoint for both dashboard and analytics pages
    Returns comprehensive portfolio allocation data with all calculations
    """
    logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] === GET ALLOCATION REQUEST START ===")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] User email: {user.get('email', 'unknown')}")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Force refresh: {force_refresh}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Extracted user_id: {user_id}")
        
        # Use PortfolioMetricsManager for optimized allocation data
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="allocation",
            force_refresh=force_refresh
        )
        logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Metrics retrieved, cache status: {metrics.cache_status}")
        logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Holdings count: {len(metrics.holdings)}")
        
        # Convert allocations to expected format
        allocations = []
        colors = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime']
        
        # Simple sector and region mappings (can be enhanced with external data later)
        sector_mapping = {
            # Technology
            'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'GOOG': 'Technology',
            'META': 'Technology', 'NVDA': 'Technology', 'AMD': 'Technology', 'INTC': 'Technology',
            'ORCL': 'Technology', 'CRM': 'Technology', 'ADBE': 'Technology', 'CSCO': 'Technology',
            'IBM': 'Technology', 'QCOM': 'Technology', 'TXN': 'Technology', 'AVGO': 'Technology',
            'MU': 'Technology', 'AMAT': 'Technology', 'LRCX': 'Technology', 'KLAC': 'Technology',
            'ASML': 'Technology', 'TSM': 'Technology', 'NXPI': 'Technology', 'MRVL': 'Technology',
            
            # Finance
            'JPM': 'Finance', 'BAC': 'Finance', 'WFC': 'Finance', 'GS': 'Finance',
            'MS': 'Finance', 'C': 'Finance', 'AXP': 'Finance', 'BLK': 'Finance',
            'SCHW': 'Finance', 'BRK.B': 'Finance', 'BRK.A': 'Finance', 'V': 'Finance',
            'MA': 'Finance', 'PYPL': 'Finance', 'SQ': 'Finance', 'COIN': 'Finance',
            
            # Healthcare
            'JNJ': 'Healthcare', 'UNH': 'Healthcare', 'PFE': 'Healthcare', 'ABBV': 'Healthcare',
            'LLY': 'Healthcare', 'MRK': 'Healthcare', 'CVS': 'Healthcare', 'MDT': 'Healthcare',
            'BMY': 'Healthcare', 'AMGN': 'Healthcare', 'GILD': 'Healthcare', 'ISRG': 'Healthcare',
            
            # Consumer
            'AMZN': 'Consumer', 'TSLA': 'Consumer', 'WMT': 'Consumer', 'HD': 'Consumer',
            'DIS': 'Consumer', 'NKE': 'Consumer', 'MCD': 'Consumer', 'SBUX': 'Consumer',
            'TGT': 'Consumer', 'COST': 'Consumer', 'PG': 'Consumer', 'KO': 'Consumer',
            'PEP': 'Consumer', 'NFLX': 'Consumer', 'ABNB': 'Consumer', 'BKNG': 'Consumer',
            
            # Energy
            'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy', 'SLB': 'Energy',
            'EOG': 'Energy', 'PXD': 'Energy', 'MPC': 'Energy', 'PSX': 'Energy',
            
            # ETFs
            'SPY': 'ETF', 'QQQ': 'ETF', 'VOO': 'ETF', 'VTI': 'ETF', 'IWM': 'ETF',
            'DIA': 'ETF', 'ARKK': 'ETF', 'VUG': 'ETF', 'VTV': 'ETF', 'GLD': 'ETF',
            'SLV': 'ETF', 'USO': 'ETF', 'JEPI': 'ETF', 'JEPQ': 'ETF', 'SCHD': 'ETF',
            'VIG': 'ETF', 'VYM': 'ETF', 'VXUS': 'ETF', 'VEA': 'ETF', 'VWO': 'ETF',
            
            # Crypto/Blockchain
            'WULF': 'Technology', 'MARA': 'Technology', 'RIOT': 'Technology', 'HIVE': 'Technology',
            'BITF': 'Technology', 'HUT': 'Technology', 'CLSK': 'Technology',
            
            # Industrial
            'BA': 'Industrial', 'CAT': 'Industrial', 'GE': 'Industrial', 'LMT': 'Industrial',
            'RTX': 'Industrial', 'DE': 'Industrial', 'UPS': 'Industrial', 'FDX': 'Industrial',
            
            # Real Estate
            'AMT': 'Real Estate', 'PLD': 'Real Estate', 'CCI': 'Real Estate', 'EQIX': 'Real Estate',
            'PSA': 'Real Estate', 'O': 'Real Estate', 'WELL': 'Real Estate', 'AVB': 'Real Estate',
        }
        
        region_mapping = {
            # US Companies
            'AAPL': 'US', 'MSFT': 'US', 'GOOGL': 'US', 'AMZN': 'US', 'META': 'US',
            'TSLA': 'US', 'NVDA': 'US', 'JPM': 'US', 'JNJ': 'US', 'V': 'US',
            'WMT': 'US', 'MA': 'US', 'PG': 'US', 'HD': 'US', 'DIS': 'US',
            'BAC': 'US', 'XOM': 'US', 'CVX': 'US', 'ABBV': 'US', 'PFE': 'US',
            'KO': 'US', 'PEP': 'US', 'MCD': 'US', 'NKE': 'US', 'VZ': 'US',
            'INTC': 'US', 'CSCO': 'US', 'ORCL': 'US', 'IBM': 'US', 'GS': 'US',
            'MS': 'US', 'WFC': 'US', 'C': 'US', 'AXP': 'US', 'BLK': 'US',
            'WULF': 'US', 'MARA': 'US', 'RIOT': 'US', 'CLSK': 'US',
            
            # European Companies
            'ASML': 'Europe', 'SAP': 'Europe', 'NESN': 'Europe', 'NOVN': 'Europe',
            'ROG': 'Europe', 'AZN': 'Europe', 'SHEL': 'Europe', 'TTE': 'Europe',
            'SAN': 'Europe', 'BCS': 'Europe', 'UBS': 'Europe', 'CS': 'Europe',
            'BUBSF': 'Europe',
            
            # Asian Companies
            'TSM': 'Asia', 'BABA': 'Asia', 'TCEHY': 'Asia', 'JD': 'Asia',
            'BIDU': 'Asia', 'NIO': 'Asia', 'LI': 'Asia', 'XPEV': 'Asia',
            'SONY': 'Asia', 'TM': 'Asia', 'HMC': 'Asia', 'HIVE': 'Canada',
            'BITF': 'Canada', 'HUT': 'Canada',
            
            # ETFs are global
            'SPY': 'US', 'QQQ': 'US', 'VOO': 'US', 'VTI': 'US', 'IWM': 'US',
            'VXUS': 'International', 'VEA': 'International', 'VWO': 'Emerging Markets',
            'EFA': 'International', 'IEMG': 'Emerging Markets',
        }
        
        for idx, holding in enumerate(metrics.holdings):
            if holding.quantity > 0:  # Only include current holdings
                symbol = holding.symbol
                allocations.append({
                    'symbol': symbol,
                    'company_name': symbol,  # We don't store company names
                    'quantity': float(holding.quantity),
                    'current_price': float(holding.current_price),
                    'cost_basis': float(holding.total_cost),
                    'current_value': float(holding.current_value),
                    'gain_loss': float(holding.gain_loss),
                    'gain_loss_percent': holding.gain_loss_percent,
                    'dividends_received': float(holding.dividends_received) if hasattr(holding, 'dividends_received') else 0,
                    'realized_pnl': float(holding.realized_pnl) if hasattr(holding, 'realized_pnl') else 0,
                    'allocation_percent': holding.allocation_percent,
                    'color': colors[idx % len(colors)],
                    'sector': sector_mapping.get(symbol, 'Other'),
                    'region': region_mapping.get(symbol, 'US')  # Default to US if not found
                })
        
        allocation_data = {
            "allocations": allocations,
            "summary": {
                "total_value": float(metrics.performance.total_value),
                "total_cost": float(metrics.performance.total_cost),
                "total_gain_loss": float(metrics.performance.total_gain_loss),
                "total_gain_loss_percent": metrics.performance.total_gain_loss_percent,
                "total_dividends": float(metrics.performance.dividends_total),
                "cache_status": metrics.cache_status,
                "computation_time_ms": metrics.computation_time_ms
            }
        }
        
        logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Allocations count: {len(allocations)}")
        logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Total portfolio value: ${allocation_data['summary']['total_value']:.2f}")
        
        # Check API version for response format
        if api_version == "v2":
            response = ResponseFactory.success(
                data=allocation_data,
                message="Portfolio allocation data retrieved successfully",
                metadata={
                    "cache_status": metrics.cache_status,
                    "computation_time_ms": metrics.computation_time_ms
                }
            )
            logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Returning v2 format response")
            return response
        else:
            # Backward compatible format
            response_data = {
                "success": True,
                "data": allocation_data
            }
            logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] Returning v1 format response")
            return response_data
        
        logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] === GET ALLOCATION REQUEST END (SUCCESS) ===")
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"[backend_api_portfolio.py::backend_api_get_allocation] ERROR: {type(e).__name__}: {str(e)}")
        logger.error(f"[backend_api_portfolio.py::backend_api_get_allocation] Full stack trace:", exc_info=True)
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_allocation",
            error=e,
            user_id=user_id if 'user_id' in locals() else 'unknown'
        )
        # According to architecture, we should not have fallbacks that bypass PortfolioMetricsManager
        logger.error(f"[backend_api_portfolio] Failed to get allocation data: {str(e)}")
        logger.info(f"[backend_api_portfolio.py::backend_api_get_allocation] === GET ALLOCATION REQUEST END (ERROR) ===")
        
        if "supabase" in str(e).lower() or "postgrest" in str(e).lower():
            raise handle_database_error(e, "allocation data retrieval", user_id if 'user_id' in locals() else None)
        else:
            raise ServiceUnavailableError(
                "Portfolio Service",
                f"Failed to retrieve portfolio allocation data: {str(e)}"
            ) 