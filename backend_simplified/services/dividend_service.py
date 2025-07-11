"""
Dividend Service for tracking and syncing dividend payments
Handles Alpha Vantage integration and dividend confirmation workflow
"""
import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal

from debug_logger import DebugLogger
from supa_api.supa_api_client import get_supa_service_client
from vantage_api.vantage_api_client import get_vantage_client

logger = logging.getLogger(__name__)

class DividendService:
    """Service for managing dividend tracking and synchronization"""
    
    def __init__(self):
        self.supa_client = get_supa_service_client()
        self.vantage_client = get_vantage_client()
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="SYNC_DIVIDENDS")
    async def sync_dividends_for_symbol(self, user_id: str, symbol: str, from_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Sync dividends for a specific symbol from Alpha Vantage
        
        Args:
            user_id: User UUID
            symbol: Stock ticker symbol
            from_date: Start date for dividend sync (defaults to 5 years ago)
            
        Returns:
            Dict with sync results
        """
        if not from_date:
            from_date = datetime.now().date() - timedelta(days=5*365)
        
        try:
            # Fetch dividend data from Alpha Vantage
            dividend_data = await self._fetch_dividends_from_alpha_vantage(symbol)
            
            if not dividend_data:
                return {
                    "success": True,
                    "symbol": symbol,
                    "dividends_synced": 0,
                    "message": f"No dividend data available for {symbol}"
                }
            
            # Filter dividends from the specified date
            filtered_dividends = [
                div for div in dividend_data 
                if datetime.strptime(div['date'], '%Y-%m-%d').date() >= from_date
            ]
            
            # Insert new dividends into database
            synced_count = 0
            for dividend in filtered_dividends:
                inserted = await self._insert_dividend_if_not_exists(
                    user_id=user_id,
                    symbol=symbol,
                    dividend_data=dividend
                )
                if inserted:
                    synced_count += 1
            
            logger.info(f"[DividendService] Synced {synced_count} dividends for {symbol}")
            
            return {
                "success": True,
                "symbol": symbol,
                "dividends_synced": synced_count,
                "total_found": len(filtered_dividends),
                "message": f"Successfully synced {synced_count} dividends for {symbol}"
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="sync_dividends_for_symbol",
                error=e,
                user_id=user_id,
                symbol=symbol
            )
            return {
                "success": False,
                "symbol": symbol,
                "error": str(e)
            }
    
    async def _fetch_dividends_from_alpha_vantage(self, symbol: str) -> List[Dict[str, Any]]:
        """Fetch dividend data from Alpha Vantage API"""
        try:
            # Import here to avoid circular imports
            from vantage_api.vantage_api_quotes import vantage_api_get_dividends
            
            dividends_data = await vantage_api_get_dividends(symbol)
            
            if not dividends_data:
                logger.warning(f"No dividend data found for {symbol}")
                return []
            
            # Convert to our format
            dividends = []
            for item in dividends_data:
                dividends.append({
                    'date': item.get('ex_date'),
                    'amount': float(item.get('amount', 0)),
                    'ex_date': item.get('ex_date'),
                    'pay_date': item.get('pay_date', item.get('ex_date')),
                    'currency': item.get('currency', 'USD')
                })
            
            return dividends
            
        except Exception as e:
            logger.error(f"Failed to fetch dividends for {symbol}: {e}")
            return []
    
    async def _insert_dividend_if_not_exists(self, user_id: str, symbol: str, dividend_data: Dict[str, Any]) -> bool:
        """Insert dividend into database if it doesn't already exist"""
        try:
            # Check if dividend already exists
            existing = self.supa_client.table('user_dividends') \
                .select('id') \
                .eq('user_id', user_id) \
                .eq('symbol', symbol) \
                .eq('ex_date', dividend_data['ex_date']) \
                .eq('amount', dividend_data['amount']) \
                .execute()
            
            if existing.data:
                return False  # Already exists
            
            # Insert new dividend
            insert_data = {
                'user_id': user_id,
                'symbol': symbol,
                'ex_date': dividend_data['ex_date'],
                'pay_date': dividend_data.get('pay_date', dividend_data['ex_date']),
                'amount': dividend_data['amount'],
                'currency': dividend_data.get('currency', 'USD'),
                'confirmed': False,
                'source': 'alpha_vantage'
            }
            
            result = self.supa_client.table('user_dividends') \
                .insert(insert_data) \
                .execute()
            
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Failed to insert dividend: {e}")
            return False
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="GET_USER_DIVIDENDS")
    async def get_user_dividends(self, user_id: str, confirmed_only: bool = False) -> Dict[str, Any]:
        """Get all dividends for a user"""
        try:
            query = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('user_id', user_id) \
                .order('pay_date', desc=True)
            
            if confirmed_only:
                query = query.eq('confirmed', True)
            
            result = query.execute()
            
            return {
                "success": True,
                "dividends": result.data,
                "total_count": len(result.data)
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="get_user_dividends",
                error=e,
                user_id=user_id
            )
            return {
                "success": False,
                "error": str(e),
                "dividends": []
            }
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="CONFIRM_DIVIDEND")
    async def confirm_dividend(self, user_id: str, dividend_id: str) -> Dict[str, Any]:
        """
        Confirm a dividend payment and create corresponding transaction
        
        Args:
            user_id: User UUID
            dividend_id: Dividend record UUID
            
        Returns:
            Dict with confirmation results
        """
        try:
            # Get dividend details
            dividend_result = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('id', dividend_id) \
                .eq('user_id', user_id) \
                .single() \
                .execute()
            
            if not dividend_result.data:
                return {
                    "success": False,
                    "error": "Dividend not found"
                }
            
            dividend = dividend_result.data
            
            if dividend['confirmed']:
                return {
                    "success": False,
                    "error": "Dividend already confirmed"
                }
            
            # Get user's current holding quantity for this symbol
            holdings_result = await self._get_user_holdings_for_symbol(user_id, dividend['symbol'])
            
            if not holdings_result['success'] or holdings_result['quantity'] <= 0:
                return {
                    "success": False,
                    "error": f"No current holdings found for {dividend['symbol']}"
                }
            
            quantity = holdings_result['quantity']
            total_dividend = Decimal(str(dividend['amount'])) * Decimal(str(quantity))
            
            # Create dividend transaction
            transaction_data = {
                'user_id': user_id,
                'symbol': dividend['symbol'],
                'transaction_type': 'DIVIDEND',
                'quantity': quantity,
                'price': dividend['amount'],
                'total_value': float(total_dividend),
                'date': dividend['pay_date'],
                'notes': f"Dividend payment - ${dividend['amount']} per share"
            }
            
            # Insert transaction
            transaction_result = self.supa_client.table('transactions') \
                .insert(transaction_data) \
                .execute()
            
            if not transaction_result.data:
                return {
                    "success": False,
                    "error": "Failed to create dividend transaction"
                }
            
            # Mark dividend as confirmed
            confirm_result = self.supa_client.table('user_dividends') \
                .update({'confirmed': True, 'updated_at': datetime.now().isoformat()}) \
                .eq('id', dividend_id) \
                .execute()
            
            if not confirm_result.data:
                return {
                    "success": False,
                    "error": "Failed to confirm dividend"
                }
            
            logger.info(f"[DividendService] Confirmed dividend {dividend_id} for user {user_id}")
            
            return {
                "success": True,
                "dividend_id": dividend_id,
                "transaction_id": transaction_result.data[0]['id'],
                "total_amount": float(total_dividend),
                "shares": quantity,
                "message": f"Dividend confirmed: ${total_dividend:.2f} for {quantity} shares"
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="confirm_dividend",
                error=e,
                user_id=user_id,
                dividend_id=dividend_id
            )
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _get_user_holdings_for_symbol(self, user_id: str, symbol: str) -> Dict[str, Any]:
        """Get user's current holdings for a specific symbol"""
        try:
            # Get all transactions for this symbol
            transactions_result = self.supa_client.table('transactions') \
                .select('*') \
                .eq('user_id', user_id) \
                .eq('symbol', symbol) \
                .order('date', desc=False) \
                .execute()
            
            if not transactions_result.data:
                return {"success": True, "quantity": 0}
            
            # Calculate current holdings
            total_quantity = 0
            for transaction in transactions_result.data:
                if transaction['transaction_type'] in ['BUY', 'DIVIDEND']:
                    total_quantity += transaction['quantity']
                elif transaction['transaction_type'] == 'SELL':
                    total_quantity -= transaction['quantity']
            
            return {
                "success": True,
                "quantity": max(0, total_quantity)  # Can't have negative holdings
            }
            
        except Exception as e:
            logger.error(f"Failed to get holdings for {symbol}: {e}")
            return {"success": False, "error": str(e), "quantity": 0}
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="GET_DIVIDEND_SUMMARY")
    async def get_dividend_summary(self, user_id: str) -> Dict[str, Any]:
        """Get dividend summary statistics for analytics"""
        try:
            # Get all confirmed dividends
            confirmed_dividends = self.supa_client.table('user_dividends') \
                .select('amount, pay_date, currency') \
                .eq('user_id', user_id) \
                .eq('confirmed', True) \
                .execute()
            
            # Get pending dividends
            pending_dividends = self.supa_client.table('user_dividends') \
                .select('amount, pay_date, currency') \
                .eq('user_id', user_id) \
                .eq('confirmed', False) \
                .gte('pay_date', datetime.now().date().isoformat()) \
                .execute()
            
            # Calculate totals
            total_received = sum(float(div['amount']) for div in confirmed_dividends.data)
            total_pending = sum(float(div['amount']) for div in pending_dividends.data)
            
            # Calculate YTD dividends
            current_year = datetime.now().year
            ytd_dividends = sum(
                float(div['amount']) for div in confirmed_dividends.data
                if datetime.strptime(div['pay_date'], '%Y-%m-%d').year == current_year
            )
            
            return {
                "success": True,
                "summary": {
                    "total_received": total_received,
                    "total_pending": total_pending,
                    "ytd_received": ytd_dividends,
                    "confirmed_count": len(confirmed_dividends.data),
                    "pending_count": len(pending_dividends.data)
                }
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="get_dividend_summary",
                error=e,
                user_id=user_id
            )
            return {
                "success": False,
                "error": str(e),
                "summary": {}
            }

# Create singleton instance
dividend_service = DividendService()