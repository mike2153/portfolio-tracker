"""
Refactored dividend endpoints for backend_api_analytics.py
These endpoints use the new DividendServiceRefactored and data flow pattern
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from auth.auth_utils import require_authenticated_user
from services.dividend_service_refactored import DividendServiceRefactored
from services.portfolio_metrics_manager import portfolio_metrics_manager
from services.price_manager import price_manager
from supa_api.supa_api_client import get_supa_service_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)
analytics_router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Initialize services
dividend_service = DividendServiceRefactored()
supa_client = get_supa_service_client()


@analytics_router.get("/dividends")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="ANALYTICS_DIVIDENDS")
async def backend_api_analytics_dividends(
    confirmed_only: bool = Query(False, description="Return only confirmed dividends"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Get user dividends using the refactored service.
    All data is fetched via PortfolioMetricsManager and passed to DividendService.
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found")
    if not user_token:
        raise HTTPException(status_code=401, detail="Access token not found")
    
    logger.info(f"[REFACTORED] Getting dividends for user: {user_id}, confirmed_only: {confirmed_only}")
    
    try:
        # Get user dividends from database
        query = supa_client.table('user_dividends').select('*').eq('user_id', user_id)
        if confirmed_only:
            query = query.eq('confirmed', True)
        
        response = query.order('pay_date', desc=True).execute()
        user_dividends = response.data if response else []
        
        # Get dividend summary using refactored service
        summary = dividend_service.calculate_dividend_summary(user_dividends)
        
        # Get portfolio symbols from transactions
        metrics = await portfolio_metrics_manager.get_cached_metrics(user_id, user_token)
        owned_symbols = []
        if metrics and hasattr(metrics, 'holdings'):
            owned_symbols = [h.symbol for h in metrics.holdings if h.quantity > 0]
        
        return {
            "success": True,
            "data": user_dividends,
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "confirmed_only": confirmed_only,
                "total_dividends": len(user_dividends),
                "owned_symbols": owned_symbols,
                "summary": summary
            }
        }
        
    except Exception as e:
        logger.error(f"[REFACTORED] Error getting dividends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@analytics_router.post("/dividends/confirm")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="CONFIRM_DIVIDEND")
async def backend_api_confirm_dividend(
    request: Request,
    dividend_id: str = Query(..., description="Dividend ID to confirm"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Confirm a dividend using the refactored service.
    Service returns the data changes needed, API route applies them.
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    body = await request.json()
    edited_amount = body.get('edited_amount')
    
    logger.info(f"[REFACTORED] Confirming dividend {dividend_id} for user {user_id}")
    
    try:
        # Get the dividend to confirm
        div_response = supa_client.table('user_dividends') \
            .select('*') \
            .eq('id', dividend_id) \
            .eq('user_id', user_id) \
            .single() \
            .execute()
        
        if not div_response or not div_response.data:
            raise HTTPException(status_code=404, detail="Dividend not found")
        
        dividend = div_response.data
        
        # Use refactored service to prepare confirmation
        confirmation_data = dividend_service.prepare_dividend_confirmation(
            dividend, edited_amount
        )
        
        # Apply the updates to database
        update_response = supa_client.table('user_dividends') \
            .update(confirmation_data['updates']) \
            .eq('id', dividend_id) \
            .execute()
        
        # Create transaction record
        transaction_data = confirmation_data['transaction_data']
        transaction_data['user_id'] = user_id
        
        txn_response = supa_client.table('transactions') \
            .insert(transaction_data) \
            .execute()
        
        return {
            "success": True,
            "dividend_id": dividend_id,
            "status": "confirmed",
            "total_amount": confirmation_data['updates'].get('total_amount', dividend['total_amount']),
            "transaction_created": bool(txn_response and txn_response.data)
        }
        
    except Exception as e:
        logger.error(f"[REFACTORED] Error confirming dividend: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@analytics_router.post("/dividends/reject")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="REJECT_DIVIDEND")
async def backend_api_reject_dividend(
    dividend_id: str = Query(..., description="Dividend ID to reject"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Reject a dividend using the refactored service.
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    logger.info(f"[REFACTORED] Rejecting dividend {dividend_id} for user {user_id}")
    
    try:
        # Get the dividend to reject
        div_response = supa_client.table('user_dividends') \
            .select('*') \
            .eq('id', dividend_id) \
            .eq('user_id', user_id) \
            .single() \
            .execute()
        
        if not div_response or not div_response.data:
            raise HTTPException(status_code=404, detail="Dividend not found")
        
        dividend = div_response.data
        
        # Use refactored service to prepare rejection
        rejection_data = dividend_service.prepare_dividend_rejection(dividend)
        
        # Apply the updates to database
        update_response = supa_client.table('user_dividends') \
            .update(rejection_data['updates']) \
            .eq('id', dividend_id) \
            .execute()
        
        return {
            "success": True,
            "dividend_id": dividend_id,
            "status": "rejected"
        }
        
    except Exception as e:
        logger.error(f"[REFACTORED] Error rejecting dividend: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@analytics_router.post("/dividends/sync")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="SYNC_DIVIDENDS")
async def backend_api_sync_dividends(
    symbol: str = Query(..., description="Symbol to sync dividends for"),
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Sync dividends for a symbol using PriceManager and refactored service.
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    logger.info(f"[REFACTORED] Syncing dividends for {symbol} for user {user_id}")
    
    try:
        # Get dividend history from PriceManager
        dividend_response = await price_manager.get_dividend_history(
            symbol=symbol,
            user_token=user_token
        )
        
        if not dividend_response['success']:
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to fetch dividends: {dividend_response.get('error')}"
            )
        
        dividend_history = dividend_response['data']
        
        # Get user transactions for this symbol
        txn_response = supa_client.table('transactions') \
            .select('*') \
            .eq('user_id', user_id) \
            .eq('symbol', symbol) \
            .order('date') \
            .execute()
        
        transactions = txn_response.data if txn_response else []
        
        # Calculate eligible dividends
        eligible_dividends = dividend_service.calculate_dividend_eligibility(
            transactions, dividend_history, symbol
        )
        
        # Upsert eligible dividends to database
        created_count = 0
        updated_count = 0
        
        for div in eligible_dividends:
            # Check if dividend already exists
            existing = supa_client.table('user_dividends') \
                .select('id') \
                .eq('user_id', user_id) \
                .eq('symbol', symbol) \
                .eq('ex_date', div['ex_date']) \
                .execute()
            
            div_record = {
                'user_id': user_id,
                'symbol': symbol,
                'ex_date': div['ex_date'],
                'pay_date': div['pay_date'],
                'amount': div['amount_per_share'],
                'shares_held': div['shares_held'],
                'total_amount': div['total_amount'],
                'currency': div['currency'],
                'status': 'pending',
                'confirmed': False
            }
            
            if existing and existing.data:
                # Update existing
                supa_client.table('user_dividends') \
                    .update(div_record) \
                    .eq('id', existing.data[0]['id']) \
                    .execute()
                updated_count += 1
            else:
                # Insert new
                supa_client.table('user_dividends') \
                    .insert(div_record) \
                    .execute()
                created_count += 1
        
        return {
            "success": True,
            "symbol": symbol,
            "dividends_found": len(dividend_history),
            "eligible_dividends": len(eligible_dividends),
            "created": created_count,
            "updated": updated_count,
            "source": dividend_response.get('source', 'unknown')
        }
        
    except Exception as e:
        logger.error(f"[REFACTORED] Error syncing dividends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@analytics_router.post("/dividends/sync-all")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="SYNC_ALL_DIVIDENDS")
async def backend_api_sync_all_dividends(
    user_data: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Sync dividends for all user holdings using refactored service.
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    logger.info(f"[REFACTORED] Syncing all dividends for user {user_id}")
    
    try:
        # Get all user transactions
        txn_response = supa_client.table('transactions') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('date') \
            .execute()
        
        transactions = txn_response.data if txn_response else []
        
        # Get unique symbols with current holdings
        symbols = dividend_service.get_portfolio_symbols(transactions)
        
        # Sync each symbol
        results = []
        for symbol in symbols:
            try:
                # Get dividend history from PriceManager
                dividend_response = await price_manager.get_dividend_history(
                    symbol=symbol,
                    user_token=user_token
                )
                
                if dividend_response['success']:
                    dividend_history = dividend_response['data']
                    
                    # Calculate eligible dividends
                    eligible_dividends = dividend_service.calculate_dividend_eligibility(
                        transactions, dividend_history, symbol
                    )
                    
                    # Upsert to database
                    for div in eligible_dividends:
                        div_record = {
                            'user_id': user_id,
                            'symbol': symbol,
                            'ex_date': div['ex_date'],
                            'pay_date': div['pay_date'],
                            'amount': div['amount_per_share'],
                            'shares_held': div['shares_held'],
                            'total_amount': div['total_amount'],
                            'currency': div['currency'],
                            'status': 'pending',
                            'confirmed': False
                        }
                        
                        # Upsert (insert or update)
                        supa_client.table('user_dividends').upsert(
                            div_record,
                            on_conflict='user_id,symbol,ex_date'
                        ).execute()
                    
                    results.append({
                        "symbol": symbol,
                        "success": True,
                        "eligible_count": len(eligible_dividends)
                    })
                else:
                    results.append({
                        "symbol": symbol,
                        "success": False,
                        "error": dividend_response.get('error', 'Unknown error')
                    })
                    
            except Exception as symbol_error:
                logger.error(f"Error syncing {symbol}: {symbol_error}")
                results.append({
                    "symbol": symbol,
                    "success": False,
                    "error": str(symbol_error)
                })
        
        successful = sum(1 for r in results if r['success'])
        total_eligible = sum(r.get('eligible_count', 0) for r in results if r['success'])
        
        return {
            "success": True,
            "symbols_processed": len(symbols),
            "successful_syncs": successful,
            "total_eligible_dividends": total_eligible,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"[REFACTORED] Error syncing all dividends: {e}")
        raise HTTPException(status_code=500, detail=str(e))