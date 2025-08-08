"""
Backend API routes for portfolio and transaction management
Handles CRUD operations for transactions and portfolio calculations
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Query, Header
from fastapi.responses import Response
from typing import Dict, Any, List, Optional, Union
import logging
import gzip
import json
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation

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
from services.user_performance_manager import user_performance_manager

# Import centralized validation models
from models.validation_models import TransactionCreate, TransactionUpdate

# Removed alignment function to fix backend hanging issue

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
        
        # Convert holdings to expected format with Decimal safety
        holdings_list = []
        for holding in metrics.holdings:
            try:
                # Use Decimal internally, convert to float only for JSON serialization
                quantity_decimal = holding.quantity if isinstance(holding.quantity, Decimal) else Decimal(str(holding.quantity))
                avg_cost_decimal = holding.avg_cost if isinstance(holding.avg_cost, Decimal) else Decimal(str(holding.avg_cost))
                total_cost_decimal = holding.total_cost if isinstance(holding.total_cost, Decimal) else Decimal(str(holding.total_cost))
                current_price_decimal = holding.current_price if isinstance(holding.current_price, Decimal) else Decimal(str(holding.current_price))
                current_value_decimal = holding.current_value if isinstance(holding.current_value, Decimal) else Decimal(str(holding.current_value))
                gain_loss_decimal = holding.gain_loss if isinstance(holding.gain_loss, Decimal) else Decimal(str(holding.gain_loss))
                
                # Handle optional dividends_received field
                dividends_received_decimal = Decimal('0')
                if hasattr(holding, 'dividends_received') and holding.dividends_received is not None:
                    try:
                        dividends_received_decimal = holding.dividends_received if isinstance(holding.dividends_received, Decimal) else Decimal(str(holding.dividends_received))
                    except (InvalidOperation, TypeError, ValueError) as e:
                        logger.warning(f"Invalid dividends_received value for {holding.symbol}: {holding.dividends_received}, using 0. Error: {e}")
                        dividends_received_decimal = Decimal('0')
                
                # Handle optional base_currency_value field
                base_currency_value_decimal = current_value_decimal  # Default to current_value
                if hasattr(holding, 'base_currency_value') and holding.base_currency_value is not None:
                    try:
                        base_currency_value_decimal = holding.base_currency_value if isinstance(holding.base_currency_value, Decimal) else Decimal(str(holding.base_currency_value))
                    except (InvalidOperation, TypeError, ValueError) as e:
                        logger.warning(f"Invalid base_currency_value for {holding.symbol}: {holding.base_currency_value}, using current_value. Error: {e}")
                        base_currency_value_decimal = current_value_decimal
                
                # Convert Decimal to float only at final serialization
                holdings_list.append({
                    "symbol": holding.symbol,
                    "quantity": str(quantity_decimal),
                    "avg_cost": str(avg_cost_decimal),
                    "total_cost": str(total_cost_decimal),
                    "current_price": str(current_price_decimal),
                    "current_value": str(current_value_decimal),
                    "gain_loss": str(gain_loss_decimal),
                    "gain_loss_percent": str(holding.gain_loss_percent),
                    "dividends_received": str(dividends_received_decimal),
                    "price_date": holding.price_date,
                    "currency": holding.currency if hasattr(holding, 'currency') else "USD",
                    "base_currency_value": str(base_currency_value_decimal)
                })
            except (InvalidOperation, TypeError, ValueError) as e:
                logger.error(f"Error converting holding {holding.symbol} financial data to Decimal: {e}")
                # Fallback with zero values
                holdings_list.append({
                    "symbol": holding.symbol,
                    "quantity": "0",
                    "avg_cost": "0",
                    "total_cost": "0",
                    "current_price": "0",
                    "current_value": "0",
                    "gain_loss": "0",
                    "gain_loss_percent": "0",
                    "dividends_received": "0",
                    "price_date": holding.price_date,
                    "currency": holding.currency if hasattr(holding, 'currency') else "USD",
                    "base_currency_value": "0"
                })
        
        # Convert portfolio summary data with Decimal safety
        try:
            total_value_decimal = metrics.performance.total_value if isinstance(metrics.performance.total_value, Decimal) else Decimal(str(metrics.performance.total_value))
            total_cost_decimal = metrics.performance.total_cost if isinstance(metrics.performance.total_cost, Decimal) else Decimal(str(metrics.performance.total_cost))
            total_gain_loss_decimal = metrics.performance.total_gain_loss if isinstance(metrics.performance.total_gain_loss, Decimal) else Decimal(str(metrics.performance.total_gain_loss))
        except (InvalidOperation, TypeError, ValueError) as e:
            logger.error(f"Error converting portfolio summary financial data to Decimal: {e}")
            total_value_decimal = Decimal('0')
            total_cost_decimal = Decimal('0')
            total_gain_loss_decimal = Decimal('0')
        
        # Convert Decimal to string to preserve precision
        portfolio_data = {
            "holdings": holdings_list,
            "total_value": str(total_value_decimal),
            "total_cost": str(total_cost_decimal),
            "total_gain_loss": str(total_gain_loss_decimal),
            "total_gain_loss_percent": str(metrics.performance.total_gain_loss_percent),
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
            logger.debug(f"[backend_api_get_portfolio] Returning v2 format response")
            return response
        else:
            # Backward compatible format
            response_data = {
                "success": True,
                **portfolio_data,
                "cache_status": metrics.cache_status,
                "computation_time_ms": metrics.computation_time_ms
            }
            logger.debug(f"[backend_api_get_portfolio] Returning v1 format response")
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
            logger.debug(f"[backend_api_get_transactions] Returning v2 format response")
            return response
        else:
            # Backward compatible format
            response_data = {
                "success": True,
                "transactions": transactions,
                "count": len(transactions)
            }
            logger.debug(f"[backend_api_get_transactions] Returning v1 format response")
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
        
        # Convert Decimal fields to float for JSON serialization with error handling
        # Convert to Decimal first, then to float for JSON serialization
        try:
            quantity_decimal = Decimal(str(transaction_data["quantity"]))
            price_decimal = Decimal(str(transaction_data["price"]))
            commission_decimal = Decimal(str(transaction_data["commission"]))
            exchange_rate_decimal = Decimal(str(transaction_data["exchange_rate"]))
            
            transaction_data["quantity"] = quantity_decimal
            transaction_data["price"] = price_decimal
            transaction_data["commission"] = commission_decimal
            transaction_data["exchange_rate"] = exchange_rate_decimal
        except (TypeError, ValueError, InvalidOperation) as e:
            logger.error(f"Error converting transaction data to Decimal/float for JSON serialization: {e}")
            raise ValueError(f"Invalid transaction data for JSON serialization: {e}")
        
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
        
        # Invalidate user_performance cache after adding transaction
        try:
            await user_performance_manager.invalidate_cache(user_id)
            logger.info(f"[CACHE] Successfully invalidated user_performance cache for user {user_id} after adding transaction")
        except Exception as cache_error:
            logger.error(f"[CACHE] Failed to invalidate user_performance cache for user {user_id} after adding transaction: {cache_error}")
            # Don't fail the mutation if cache invalidation fails

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
        
        # Convert to Decimal first, then to float for JSON serialization
        try:
            quantity_decimal = Decimal(str(transaction_data["quantity"]))
            price_decimal = Decimal(str(transaction_data["price"]))
            commission_decimal = Decimal(str(transaction_data["commission"]))
            exchange_rate_decimal = Decimal(str(transaction_data["exchange_rate"]))
            
            transaction_data["quantity"] = quantity_decimal
            transaction_data["price"] = price_decimal
            transaction_data["commission"] = commission_decimal
            transaction_data["exchange_rate"] = exchange_rate_decimal
        except (TypeError, ValueError, InvalidOperation) as e:
            logger.error(f"Error converting transaction update data to Decimal/float for JSON serialization: {e}")
            raise ValueError(f"Invalid transaction update data for JSON serialization: {e}")
        
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
        
        # Invalidate user_performance cache after updating transaction
        try:
            await user_performance_manager.invalidate_cache(user_id)
            logger.info(f"[CACHE] Successfully invalidated user_performance cache for user {user_id} after updating transaction {transaction_id}")
        except Exception as cache_error:
            logger.error(f"[CACHE] Failed to invalidate user_performance cache for user {user_id} after updating transaction {transaction_id}: {cache_error}")
            # Don't fail the mutation if cache invalidation fails
        
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
            
            # Invalidate user_performance cache after deleting transaction
            try:
                await user_performance_manager.invalidate_cache(user_id)
                logger.info(f"[CACHE] Successfully invalidated user_performance cache for user {user_id} after deleting transaction {transaction_id}")
            except Exception as cache_error:
                logger.error(f"[CACHE] Failed to invalidate user_performance cache for user {user_id} after deleting transaction {transaction_id}: {cache_error}")
                # Don't fail the mutation if cache invalidation fails
            
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
                try:
                    # Convert financial data to Decimal first, then to float for JSON
                    quantity_decimal = holding.quantity if isinstance(holding.quantity, Decimal) else Decimal(str(holding.quantity))
                    current_price_decimal = holding.current_price if isinstance(holding.current_price, Decimal) else Decimal(str(holding.current_price))
                    total_cost_decimal = holding.total_cost if isinstance(holding.total_cost, Decimal) else Decimal(str(holding.total_cost))
                    current_value_decimal = holding.current_value if isinstance(holding.current_value, Decimal) else Decimal(str(holding.current_value))
                    gain_loss_decimal = holding.gain_loss if isinstance(holding.gain_loss, Decimal) else Decimal(str(holding.gain_loss))
                    
                    # Handle optional fields with Decimal safety
                    dividends_received_decimal = Decimal('0')
                    if hasattr(holding, 'dividends_received') and holding.dividends_received is not None:
                        try:
                            dividends_received_decimal = holding.dividends_received if isinstance(holding.dividends_received, Decimal) else Decimal(str(holding.dividends_received))
                        except (InvalidOperation, TypeError, ValueError):
                            dividends_received_decimal = Decimal('0')
                    
                    realized_pnl_decimal = Decimal('0')
                    if hasattr(holding, 'realized_pnl') and holding.realized_pnl is not None:
                        try:
                            realized_pnl_decimal = holding.realized_pnl if isinstance(holding.realized_pnl, Decimal) else Decimal(str(holding.realized_pnl))
                        except (InvalidOperation, TypeError, ValueError):
                            realized_pnl_decimal = Decimal('0')
                    
                    # Convert Decimal to float only at final serialization
                    allocations.append({
                        'symbol': symbol,
                        'company_name': symbol,  # We don't store company names
                        'quantity': str(quantity_decimal),
                        'current_price': str(current_price_decimal),
                        'cost_basis': str(total_cost_decimal),
                        'current_value': str(current_value_decimal),
                        'gain_loss': str(gain_loss_decimal),
                        'gain_loss_percent': holding.gain_loss_percent,
                        'dividends_received': str(dividends_received_decimal),
                        'realized_pnl': str(realized_pnl_decimal),
                        'allocation_percent': holding.allocation_percent,
                        'color': colors[idx % len(colors)],
                        'sector': sector_mapping.get(symbol, 'Other'),
                        'region': region_mapping.get(symbol, 'US')  # Default to US if not found
                    })
                except (InvalidOperation, TypeError, ValueError) as e:
                    logger.error(f"Error converting allocation data for {symbol} to Decimal: {e}")
                    # Add allocation with fallback zero values
                    allocations.append({
                        'symbol': symbol,
                        'company_name': symbol,
                        'quantity': 0.0,
                        'current_price': 0.0,
                        'cost_basis': 0.0,
                        'current_value': 0.0,
                        'gain_loss': 0.0,
                        'gain_loss_percent': 0.0,
                        'dividends_received': 0.0,
                        'realized_pnl': 0.0,
                        'allocation_percent': 0.0,
                        'color': colors[idx % len(colors)],
                        'sector': sector_mapping.get(symbol, 'Other'),
                        'region': region_mapping.get(symbol, 'US')
                    })
        
        # Convert allocation summary data with Decimal safety
        try:
            total_value_decimal = metrics.performance.total_value if isinstance(metrics.performance.total_value, Decimal) else Decimal(str(metrics.performance.total_value))
            total_cost_decimal = metrics.performance.total_cost if isinstance(metrics.performance.total_cost, Decimal) else Decimal(str(metrics.performance.total_cost))
            total_gain_loss_decimal = metrics.performance.total_gain_loss if isinstance(metrics.performance.total_gain_loss, Decimal) else Decimal(str(metrics.performance.total_gain_loss))
            
            # Handle optional dividends_total field
            dividends_total_decimal = Decimal('0')
            if hasattr(metrics.performance, 'dividends_total') and metrics.performance.dividends_total is not None:
                try:
                    dividends_total_decimal = metrics.performance.dividends_total if isinstance(metrics.performance.dividends_total, Decimal) else Decimal(str(metrics.performance.dividends_total))
                except (InvalidOperation, TypeError, ValueError):
                    dividends_total_decimal = Decimal('0')
        except (InvalidOperation, TypeError, ValueError) as e:
            logger.error(f"Error converting allocation summary financial data to Decimal: {e}")
            total_value_decimal = Decimal('0')
            total_cost_decimal = Decimal('0')
            total_gain_loss_decimal = Decimal('0')
            dividends_total_decimal = Decimal('0')
        
        # Convert Decimal to float only at final serialization
        allocation_data = {
            "allocations": allocations,
            "summary": {
                "total_value": str(total_value_decimal),
                "total_cost": str(total_cost_decimal),
                "total_gain_loss": str(total_gain_loss_decimal),
                "total_gain_loss_percent": metrics.performance.total_gain_loss_percent,
                "total_dividends": str(dividends_total_decimal),
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
            logger.debug(f"[backend_api_get_allocation] Returning v2 format response")
            return response
        else:
            # Backward compatible format
            response_data = {
                "success": True,
                "data": allocation_data
            }
            logger.debug(f"[backend_api_get_allocation] Returning v1 format response")
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

@portfolio_router.get("/complete", response_model=None)
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_COMPLETE_PORTFOLIO")
async def backend_api_get_complete_portfolio(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False, description="Force refresh all cached data"),
    include_historical: bool = Query(True, description="Include historical time series data"),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]], Response]:
    """
    CROWN JEWEL ENDPOINT: Get complete consolidated portfolio data in a single response.
    
    This endpoint replaces 19+ individual API calls with one comprehensive response:
    - Portfolio holdings and performance metrics
    - Dividend data and projections  
    - Asset allocation breakdowns
    - Transaction summaries
    - Time series data for charts
    - Market analysis and risk metrics
    - Currency conversions
    - Performance metadata and caching info
    
    Performance target: <1s cached, <5s fresh generation
    
    Args:
        user: Authenticated user from dependency injection
        force_refresh: Skip all caches and generate fresh data
        include_historical: Include time series data for charts (default: True)
        api_version: API version for response format compatibility
    
    Returns:
        Comprehensive portfolio data structure with performance metadata
        
    Raises:
        HTTPException: For authentication, validation, or service errors
    """
    # Request timing and metadata tracking
    request_start_time = datetime.utcnow()
    
    logger.debug(f"[backend_api_get_complete_portfolio] Request: user={user.get('id', 'unknown')[:8]}..., force_refresh={force_refresh}, include_historical={include_historical}")
    
    try:
        # Step 1: Extract and validate user credentials
        user_id, user_token = extract_user_credentials(user)
        logger.debug(f"[backend_api_get_complete_portfolio] Extracted credentials: user_id={user_id[:8] if user_id else 'None'}..., token_present={bool(user_token)}")
        
        # Step 2: Generate complete portfolio data using UserPerformanceManager
        logger.debug(f"[backend_api_get_complete_portfolio] Generating complete portfolio data...")
        generation_start = datetime.utcnow()
        
        try:
            complete_data = await user_performance_manager.generate_complete_data(
                user_id=user_id,
                user_token=user_token,
                force_refresh=force_refresh
            )
            logger.debug(f"[backend_api_get_complete_portfolio] Complete data generated successfully")
        except Exception as gen_error:
            logger.error(f"[backend_api_portfolio.py::backend_api_get_complete_portfolio] Error generating complete data: {gen_error}")
            logger.error(f"[backend_api_portfolio.py::backend_api_get_complete_portfolio] Stack trace:", exc_info=True)
            raise ServiceUnavailableError(
                "Data Generation Service",
                f"Failed to generate complete portfolio data: {str(gen_error)}"
            )
        
        generation_time_ms = int((datetime.utcnow() - generation_start).total_seconds() * 1000)
        logger.debug(f"[backend_api_get_complete_portfolio] Data generation completed in {generation_time_ms}ms")
        
        # Step 3: Transform data for API response with comprehensive error handling
        logger.debug(f"[backend_api_get_complete_portfolio] Transforming data for API response...")
        transform_start = datetime.utcnow()
        
        try:
            # Convert portfolio metrics to API format with Decimal safety
            portfolio_metrics = complete_data.portfolio_metrics
            
            # Validate that portfolio metrics exist
            if not portfolio_metrics:
                raise ValueError("Portfolio metrics data is missing from complete data")
            
            # Validate that portfolio metrics have the required structure
            if not hasattr(portfolio_metrics, 'holdings') or not hasattr(portfolio_metrics, 'performance'):
                raise ValueError("Portfolio metrics data structure is incomplete")
            
            # Holdings data with complete financial information
            holdings_list = []
            for holding in portfolio_metrics.holdings:
                try:
                    # Ensure all financial data is Decimal and properly converted
                    quantity_decimal = holding.quantity if isinstance(holding.quantity, Decimal) else Decimal(str(holding.quantity))
                    avg_cost_decimal = holding.avg_cost if isinstance(holding.avg_cost, Decimal) else Decimal(str(holding.avg_cost))
                    total_cost_decimal = holding.total_cost if isinstance(holding.total_cost, Decimal) else Decimal(str(holding.total_cost))
                    current_price_decimal = holding.current_price if isinstance(holding.current_price, Decimal) else Decimal(str(holding.current_price))
                    current_value_decimal = holding.current_value if isinstance(holding.current_value, Decimal) else Decimal(str(holding.current_value))
                    gain_loss_decimal = holding.gain_loss if isinstance(holding.gain_loss, Decimal) else Decimal(str(holding.gain_loss))
                    
                    # Handle optional dividend data
                    dividends_received_decimal = Decimal('0')
                    if hasattr(holding, 'dividends_received') and holding.dividends_received is not None:
                        try:
                            dividends_received_decimal = holding.dividends_received if isinstance(holding.dividends_received, Decimal) else Decimal(str(holding.dividends_received))
                        except (InvalidOperation, TypeError, ValueError) as e:
                            logger.warning(f"Invalid dividends_received for {holding.symbol}: {e}")
                            dividends_received_decimal = Decimal('0')
                    
                    # Convert to float for JSON serialization
                    holdings_list.append({
                        "symbol": holding.symbol,
                        "quantity": str(quantity_decimal),
                        "avg_cost": str(avg_cost_decimal),
                        "total_cost": str(total_cost_decimal),
                        "current_price": str(current_price_decimal),
                        "current_value": str(current_value_decimal),
                        "gain_loss": str(gain_loss_decimal),
                        "gain_loss_percent": holding.gain_loss_percent,
                        "allocation_percent": holding.allocation_percent,
                        "dividends_received": str(dividends_received_decimal),
                        "price_date": holding.price_date,
                        "currency": getattr(holding, 'currency', 'USD')
                    })
                    
                except (InvalidOperation, TypeError, ValueError) as e:
                    logger.error(f"Error processing holding {holding.symbol}: {e}")
                    # Add holding with safe fallback values
                    holdings_list.append({
                        "symbol": holding.symbol,
                        "quantity": 0.0,
                        "avg_cost": 0.0,
                        "total_cost": 0.0,
                        "current_price": 0.0,
                        "current_value": 0.0,
                        "gain_loss": 0.0,
                        "gain_loss_percent": 0.0,
                        "allocation_percent": 0.0,
                        "dividends_received": 0.0,
                        "price_date": holding.price_date,
                        "currency": "USD"
                    })
            
            # Portfolio summary with Decimal safety
            try:
                total_value_decimal = portfolio_metrics.performance.total_value if isinstance(portfolio_metrics.performance.total_value, Decimal) else Decimal(str(portfolio_metrics.performance.total_value))
                total_cost_decimal = portfolio_metrics.performance.total_cost if isinstance(portfolio_metrics.performance.total_cost, Decimal) else Decimal(str(portfolio_metrics.performance.total_cost))
                total_gain_loss_decimal = portfolio_metrics.performance.total_gain_loss if isinstance(portfolio_metrics.performance.total_gain_loss, Decimal) else Decimal(str(portfolio_metrics.performance.total_gain_loss))
            except (InvalidOperation, TypeError, ValueError) as e:
                logger.error(f"Error converting portfolio summary: {e}")
                total_value_decimal = Decimal('0')
                total_cost_decimal = Decimal('0')
                total_gain_loss_decimal = Decimal('0')
            
            # Calculate top gainers and losers (3 each, mutually exclusive)
            # First, we need to get daily change data for each holding
            top_gainers = []
            top_losers = []
            
            if holdings_list:
                # Calculate daily changes for each holding using previous_close from price data
                holdings_with_daily_changes = []
                for holding in holdings_list:
                    symbol = holding["symbol"]
                    quantity = Decimal(str(holding["quantity"]))
                    current_price = Decimal(str(holding["current_price"]))
                    
                    # Calculate daily change using previous_close from current price data
                    daily_change_value = Decimal('0')
                    daily_change_percent = Decimal('0')
                    
                    # previous_close should be available from the portfolio metrics calculation
                    # For now, we'll calculate it directly if needed
                    try:
                        # Get current prices with previous_close
                        symbols_for_prev = [symbol]
                        current_prices = await price_manager.get_latest_prices(symbols_for_prev, user_token)
                        price_data = current_prices.get(symbol)
                        
                        if price_data and price_data.get('previous_close') is not None:
                            previous_close = Decimal(str(price_data['previous_close']))
                            if previous_close > 0:
                                # Calculate per-share change
                                price_change = current_price - previous_close
                                daily_change_percent = (price_change / previous_close) * 100
                                # Total value change for the position
                                daily_change_value = price_change * quantity
                    except Exception as e:
                        logger.warning(f"Error calculating daily change for {symbol}: {e}")
                    
                    holdings_with_daily_changes.append({
                        **holding,
                        "daily_change_value": str(daily_change_value),
                        "daily_change_percent": str(daily_change_percent)  # Convert to string for JSON
                    })
                
                # Filter holdings by daily gain/loss and sort
                # daily_change_percent is stored as string, convert to Decimal for comparison
                holdings_with_daily_gains = [h for h in holdings_with_daily_changes if Decimal(h["daily_change_percent"]) > 0]
                holdings_with_daily_losses = [h for h in holdings_with_daily_changes if Decimal(h["daily_change_percent"]) < 0]
                
                # Sort gainers by daily percentage (descending) and take top 3
                holdings_with_daily_gains.sort(key=lambda x: Decimal(x["daily_change_percent"]), reverse=True)
                top_gainers = [
                    {
                        "name": holding['symbol'],  # Removed "Stock " prefix
                        "ticker": holding["symbol"],
                        "value": holding["current_value"],
                        "changePercent": holding["daily_change_percent"],  # Using daily change
                        "changeValue": holding["daily_change_value"]  # Using daily change value
                    }
                    for holding in holdings_with_daily_gains[:3]
                ]
                
                # Sort losers by daily percentage (ascending - most negative first) and take top 3
                holdings_with_daily_losses.sort(key=lambda x: Decimal(x["daily_change_percent"]))
                top_losers = [
                    {
                        "name": holding['symbol'],  # Removed "Stock " prefix
                        "ticker": holding["symbol"],
                        "value": holding["current_value"],
                        "changePercent": holding["daily_change_percent"],  # Using daily change
                        "changeValue": holding["daily_change_value"]  # Using daily change value
                    }
                    for holding in holdings_with_daily_losses[:3]
                ]
            
            logger.debug(f"[backend_api_get_complete_portfolio] Calculated {len(top_gainers)} gainers and {len(top_losers)} losers")
            
            # Construct complete API response data
            complete_response_data = {
                # Core portfolio data
                "portfolio_data": {
                    "holdings": holdings_list,
                    "total_value": str(total_value_decimal),
                    "total_cost": str(total_cost_decimal),
                    "total_gain_loss": str(total_gain_loss_decimal),
                    "total_gain_loss_percent": portfolio_metrics.performance.total_gain_loss_percent,
                    "base_currency": getattr(portfolio_metrics.performance, 'base_currency', 'USD')
                },
                
                # Performance metrics
                "performance_data": {
                    "daily_change": getattr(portfolio_metrics.performance, 'daily_change', Decimal('0')),
                    "daily_change_percent": getattr(portfolio_metrics.performance, 'daily_change_percent', 0.0),
                    "ytd_return": getattr(portfolio_metrics.performance, 'ytd_return', Decimal('0')),
                    "ytd_return_percent": getattr(portfolio_metrics.performance, 'ytd_return_percent', 0.0),
                    "total_return_percent": portfolio_metrics.performance.total_gain_loss_percent,
                    "volatility": getattr(portfolio_metrics.performance, 'volatility', Decimal('0')) or Decimal('0'),
                    "sharpe_ratio": getattr(portfolio_metrics.performance, 'sharpe_ratio', Decimal('0')) or Decimal('0'),
                    "max_drawdown": getattr(portfolio_metrics.performance, 'max_drawdown', Decimal('0')) or Decimal('0')
                },
                
                # Allocation breakdown (reuse existing allocation logic)
                "allocation_data": {
                    "by_symbol": [
                        {
                            "symbol": holding["symbol"],
                            "allocation_percent": holding["allocation_percent"],
                            "current_value": holding["current_value"]
                        }
                        for holding in holdings_list
                    ],
                    "diversification_score": (complete_data.market_analysis.get("portfolio_diversification") or {}).get("diversification_score", 0.0),
                    "concentration_risk": (complete_data.market_analysis.get("portfolio_diversification") or {}).get("concentration_risk", "unknown"),
                    "number_of_positions": len(holdings_list)
                },
                
                # Dividend summary
                "dividend_data": {
                    "recent_dividends": complete_data.detailed_dividends[:10],  # Last 10 dividends
                    "total_received_ytd": sum(
                        Decimal(str(div.get("amount", 0))) for div in complete_data.detailed_dividends
                        if div.get("ex_date") and div["ex_date"].startswith(str(datetime.utcnow().year))
                    ),
                    "total_received_all_time": sum(
                        Decimal(str(div.get("amount", 0))) for div in complete_data.detailed_dividends
                    ),
                    "dividend_count": len(complete_data.detailed_dividends)
                },
                
                # Transaction summary
                "transactions_summary": {
                    "total_transactions": getattr(complete_data.portfolio_metrics, 'transaction_count', 0),
                    "last_transaction_date": getattr(complete_data.portfolio_metrics, 'last_transaction_date', None),
                    "realized_gains": getattr(complete_data.portfolio_metrics.performance, 'realized_gains', Decimal('0'))
                },
                
                # Market analysis
                "market_analysis": complete_data.market_analysis,
                
                # Currency conversions
                "currency_conversions": {
                    currency_pair: str(rate) for currency_pair, rate in complete_data.currency_conversions.items()
                },
                
                # Top gainers and losers (3 each, mutually exclusive)
                "top_gainers": top_gainers,
                "top_losers": top_losers
            }
            
            transform_time_ms = int((datetime.utcnow() - transform_start).total_seconds() * 1000)
            logger.debug(f"[backend_api_get_complete_portfolio] Data transformation completed in {transform_time_ms}ms")
            
            # Validate response structure before returning
            required_fields = ['portfolio_data', 'performance_data', 'allocation_data', 'dividend_data', 'market_analysis', 'currency_conversions', 'transactions_summary']
            missing_fields = [field for field in required_fields if field not in complete_response_data]
            if missing_fields:
                logger.error(f"[backend_api_portfolio.py::backend_api_get_complete_portfolio] Missing required fields in response: {missing_fields}")
                raise ServiceUnavailableError(
                    "Response Structure Error",
                    f"Incomplete response data structure: missing {missing_fields}"
                )
            
            logger.debug(f"[backend_api_get_complete_portfolio] Response structure validation passed")
            
        except Exception as e:
            logger.error(f"[backend_api_portfolio.py::backend_api_get_complete_portfolio] Error transforming data: {e}")
            raise ServiceUnavailableError(
                "Data Transformation",
                f"Failed to transform complete portfolio data: {str(e)}"
            )
        
        # Step 4: Calculate total processing time and payload size
        total_processing_time_ms = int((datetime.utcnow() - request_start_time).total_seconds() * 1000)
        
        # Calculate payload size for monitoring
        response_json = json.dumps(complete_response_data, default=str)
        payload_size_bytes = len(response_json.encode('utf-8'))
        payload_size_kb = round(payload_size_bytes / 1024, 2)
        
        logger.debug(f"[backend_api_get_complete_portfolio] Processing: {total_processing_time_ms}ms, Size: {payload_size_kb}KB")
        
        # Step 5: Add comprehensive metadata
        metadata = {
            "generated_at": complete_data.generated_at.isoformat(),
            "cache_hit": complete_data.metadata.cache_hit_ratio > 0,
            "cache_strategy": complete_data.metadata.cache_strategy_used.value,
            "data_completeness": complete_data.metadata.data_completeness.overall_completeness,
            "performance_metadata": {
                "total_processing_time_ms": total_processing_time_ms,
                "data_generation_time_ms": generation_time_ms,
                "data_transformation_time_ms": transform_time_ms,
                "service_computation_time_ms": complete_data.metadata.total_computation_time_ms,
                "cache_hit_ratio": complete_data.metadata.cache_hit_ratio,
                "payload_size_bytes": payload_size_bytes,
                "payload_size_kb": payload_size_kb,
                "data_sources": complete_data.metadata.data_sources,
                "fallback_strategies_used": complete_data.metadata.fallback_strategies_used
            }
        }
        
        # Step 6: Handle response compression for large payloads
        use_compression = payload_size_bytes > 50000  # Compress if >50KB
        
        if use_compression:
            logger.debug(f"[backend_api_get_complete_portfolio] Compressing response (size: {payload_size_kb}KB)")
            
            # Check API version for response format
            if api_version == "v2":
                response_data = ResponseFactory.success(
                    data=complete_response_data,
                    message="Complete portfolio data retrieved successfully",
                    metadata=metadata
                )
            else:
                # Backward compatible format - properly merge metadata
                response_data = {
                    "success": True,
                    **complete_response_data,
                    "metadata": {
                        **complete_response_data.get("metadata", {}),
                        **metadata
                    }
                }
            
            # Compress response
            compressed_json = gzip.compress(json.dumps(response_data, default=str).encode('utf-8'))
            compressed_size_kb = round(len(compressed_json) / 1024, 2)
            compression_ratio = round((1 - len(compressed_json) / payload_size_bytes) * 100, 1)
            
            logger.debug(f"[backend_api_get_complete_portfolio] Compressed to {compressed_size_kb}KB ({compression_ratio}% reduction)")
            
            return Response(
                content=compressed_json,
                media_type="application/json",
                headers={
                    "Content-Encoding": "gzip",
                    "X-Original-Size": str(payload_size_bytes),
                    "X-Compressed-Size": str(len(compressed_json)),
                    "X-Compression-Ratio": f"{compression_ratio}%",
                    "X-Processing-Time-Ms": str(total_processing_time_ms),
                    "X-Cache-Hit": str(metadata["cache_hit"]).lower()
                }
            )
        else:
            # Step 7: Return uncompressed response
            logger.debug(f"[backend_api_get_complete_portfolio] Returning uncompressed response")
            
            # Check API version for response format
            if api_version == "v2":
                response = ResponseFactory.success(
                    data=complete_response_data,
                    message="Complete portfolio data retrieved successfully",
                    metadata=metadata
                )
                logger.debug(f"[backend_api_get_complete_portfolio] Returning v2 format response")
                return response
            else:
                # Backward compatible format - properly merge metadata
                response_data = {
                    "success": True,
                    **complete_response_data,
                    "metadata": {
                        **complete_response_data.get("metadata", {}),
                        **metadata
                    }
                }
                logger.debug(f"[backend_api_get_complete_portfolio] Returning v1 format response")
                return response_data
        
        logger.debug(f"[backend_api_get_complete_portfolio] Complete - Holdings: {len(holdings_list)}, Dividends: {len(complete_data.detailed_dividends)}")
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        # Comprehensive error handling with fallback data
        total_error_time_ms = int((datetime.utcnow() - request_start_time).total_seconds() * 1000)
        
        logger.error(f"[backend_api_portfolio.py::backend_api_get_complete_portfolio] ERROR: {type(e).__name__}: {str(e)}")
        logger.error(f"[backend_api_portfolio.py::backend_api_get_complete_portfolio] Processing time before error: {total_error_time_ms}ms")
        logger.error(f"[backend_api_portfolio.py::backend_api_get_complete_portfolio] Full stack trace:", exc_info=True)
        
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_complete_portfolio",
            error=e,
            user_id=user_id if 'user_id' in locals() else 'unknown',
            additional_context={
                "force_refresh": force_refresh,
                "include_historical": include_historical,
                "processing_time_ms": total_error_time_ms
            }
        )
        
        logger.debug(f"[backend_api_get_complete_portfolio] Request failed - returning empty fallback structure")
        
        # Return empty but properly structured response for frontend compatibility
        empty_fallback_response = {
            "success": False,
            "error": str(e),
            "portfolio_data": {
                "holdings": [],
                "total_value": 0,
                "total_cost": 0,
                "total_gain_loss": 0,
                "total_gain_loss_percent": 0,
                "base_currency": "USD"
            },
            "performance_data": {
                "daily_change": 0,
                "daily_change_percent": 0,
                "ytd_return": 0,
                "ytd_return_percent": 0,
                "total_return_percent": 0,
                "volatility": 0,
                "sharpe_ratio": 0,
                "max_drawdown": 0
            },
            "allocation_data": {
                "by_symbol": [],
                "diversification_score": 0,
                "concentration_risk": "unknown",
                "number_of_positions": 0
            },
            "dividend_data": {
                "recent_dividends": [],
                "total_received_ytd": 0,
                "total_received_all_time": 0,
                "dividend_count": 0
            },
            "transactions_summary": {
                "total_transactions": 0,
                "last_transaction_date": None,
                "realized_gains": 0
            },
            "market_analysis": {},
            "currency_conversions": {},
            "top_gainers": [],
            "top_losers": [],
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "cache_hit": False,
                "generation_time_ms": total_error_time_ms,
                "payload_size_kb": 0,
                "processing_time_ms": total_error_time_ms,
                "error": True,
                "error_message": str(e)
            }
        }
        
        return empty_fallback_response

@portfolio_router.get("/portfolio/performance/historical")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_HISTORICAL_PERFORMANCE")
async def backend_api_get_historical_performance(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    period: str = Query("1Y", description="Time period: 7D, 1M, 3M, 1Y, YTD, MAX"),
    benchmark: str = Query("SPY", description="Benchmark ticker: SPY, QQQ, A200, URTH, VTI, VXUS"),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Dict[str, Any]:
    """
    Get historical portfolio performance data vs benchmark for charting.
    
    Returns time-series data showing portfolio value over time compared to benchmark index.
    """
    logger.info(f"[backend_api_portfolio.py::backend_api_get_historical_performance] === HISTORICAL PERFORMANCE REQUEST START ===")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_historical_performance] User ID: {user.get('id', 'unknown')}")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_historical_performance] Period: {period}, Benchmark: {benchmark}")
    
    try:
        # Extract user credentials
        user_id, user_token = extract_user_credentials(user)
        
        # Import the proper portfolio calculator service
        from services.portfolio_calculator import portfolio_calculator
        from services.index_sim_service import IndexSimulationService
        
        # Get portfolio time series using the robust calculator (uses close/EOD)
        portfolio_series, portfolio_metadata = await portfolio_calculator.calculate_portfolio_time_series(
            user_id=user_id,
            user_token=user_token,
            range_key=period,
            benchmark=benchmark
        )
        
        # Align date ranges to ensure both series start and end on the same dates
        if portfolio_series:
            # Use the actual portfolio date range (when user had holdings)
            start_date = portfolio_series[0][0]  # First date with holdings
            end_date = portfolio_series[-1][0]   # Last date with holdings
            
            logger.debug(f"[backend_api_get_historical_performance] Portfolio effective range: {start_date} to {end_date}")
            
            # Get index simulation using the same effective date range as portfolio
            index_series = await IndexSimulationService.get_index_sim_series(
                user_id=user_id,
                benchmark=benchmark,
                start_date=start_date,  # Use portfolio's actual start date
                end_date=end_date,      # Use portfolio's actual end date
                user_token=user_token
            )
        else:
            # Fallback to original date range if no portfolio data
            start_date, end_date = portfolio_calculator._compute_date_range(period)
            logger.debug(f"[backend_api_get_historical_performance] No portfolio data, using period range: {start_date} to {end_date}")
            
            index_series = await IndexSimulationService.get_index_sim_series(
                user_id=user_id,
                benchmark=benchmark,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
        
        # Both series now have aligned date ranges
        aligned_portfolio = portfolio_series
        aligned_benchmark = index_series
        
        # Format data for frontend
        portfolio_performance = [
            {"date": d.isoformat(), "value": str(v)} for d, v in aligned_portfolio
        ]
        
        benchmark_performance = [
            {"date": d.isoformat(), "value": str(v)} for d, v in aligned_benchmark
        ]
        
        # Reduced logging - only log essential information
        if portfolio_performance and benchmark_performance:
            logger.debug(f"[backend_api_get_historical_performance] Portfolio: {len(portfolio_performance)} points, Benchmark: {len(benchmark_performance)} points")
        
        # Calculate performance metrics
        if portfolio_series and index_series:
            from services.index_sim_service import IndexSimulationUtils
            metrics = IndexSimulationUtils.calculate_performance_metrics(portfolio_series, index_series)
        else:
            metrics = {
                "portfolio_start_value": 0,
                "portfolio_end_value": 0,
                "portfolio_return_pct": 0,
                "index_start_value": 0,
                "index_end_value": 0,
                "index_return_pct": 0,
                "outperformance_pct": 0,
                "absolute_outperformance": 0
            }
        
        # Build response in expected format
        performance_data = {
            "portfolio_performance": portfolio_performance,
            "benchmark_performance": benchmark_performance,
            "metadata": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_points": len(portfolio_performance),
                "portfolio_final_value": portfolio_performance[-1]["value"] if portfolio_performance else 0,
                "index_final_value": benchmark_performance[-1]["value"] if benchmark_performance else 0,
                "benchmark_name": {"SPY": "S&P 500", "QQQ": "Nasdaq 100", "A200": "ASX 200", "URTH": "MSCI World", "VTI": "Total Stock Market", "VXUS": "International"}.get(benchmark, benchmark),
                "calculation_timestamp": datetime.utcnow().isoformat(),
                "cached": False,
                "no_data": portfolio_metadata.get("no_data", False),
                "index_only": False,
                "reason": "success",
                "chart_type": "performance_comparison"
            },
            "performance_metrics": {
                "portfolio_start_value": str(metrics.get("portfolio_start_value", 0)),
                "portfolio_end_value": str(metrics.get("portfolio_end_value", 0)),
                "portfolio_return_pct": str(metrics.get("portfolio_return_pct", 0)),
                "index_start_value": str(metrics.get("index_start_value", 0)),
                "index_end_value": str(metrics.get("index_end_value", 0)),
                "index_return_pct": str(metrics.get("index_return_pct", 0)),
                "outperformance_pct": str(metrics.get("outperformance_pct", 0)),
                "absolute_outperformance": str(metrics.get("absolute_outperformance", 0))
            }
        }
        
        # Simple summary log
        logger.debug(f"[backend_api_get_historical_performance] Retrieved {len(performance_data.get('portfolio_performance', []))} portfolio and {len(performance_data.get('benchmark_performance', []))} benchmark data points")
        
        response_data = {
            "success": True,
            "period": period,
            "benchmark": benchmark,
            "portfolio_performance": performance_data["portfolio_performance"],
            "benchmark_performance": performance_data["benchmark_performance"],
            "metadata": performance_data["metadata"],
            "performance_metrics": performance_data["performance_metrics"]
        }
        return response_data
        
    except Exception as e:
        logger.error(f"[backend_api_portfolio.py::backend_api_get_historical_performance] Error: {e}")
        DebugLogger.log_error(
            file_name="backend_api_portfolio.py",
            function_name="backend_api_get_historical_performance",
            error=e,
            user_id=user_id if 'user_id' in locals() else 'unknown'
        )
        
        raise ServiceUnavailableError(
            "Historical Performance Service",
            f"Failed to retrieve historical performance data: {str(e)}"
        ) 