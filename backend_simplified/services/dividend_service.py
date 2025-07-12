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
        logger.info(f"[DividendService] Initialized with service client: {type(self.supa_client)}")
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="SYNC_DIVIDENDS")
    async def sync_dividends_for_symbol(self, user_id: str, symbol: str, user_token: str, from_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Sync dividends for a specific symbol from Alpha Vantage and calculate user ownership
        
        Args:
            user_id: User UUID
            symbol: Stock ticker symbol
            user_token: User's JWT token for authentication
            from_date: Start date for dividend sync (defaults to user's first transaction)
            
        Returns:
            Dict with sync results
        """
        try:
            # Get user's first transaction date for this symbol if no from_date provided
            if not from_date:
                first_transaction_date = await self._get_first_transaction_date(user_id, symbol, user_token)
                if first_transaction_date:
                    from_date = first_transaction_date
                else:
                    from_date = datetime.now().date() - timedelta(days=5*365)
            
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
                if datetime.strptime(div['ex_date'], '%Y-%m-%d').date() >= from_date
            ]
            
            # Calculate user's ownership at each dividend date and insert
            synced_count = 0
            for dividend in filtered_dividends:
                # Calculate how many shares user owned at ex-dividend date
                shares_owned = await self._calculate_shares_owned_at_date(
                    user_id, symbol, dividend['ex_date'], user_token
                )
                
                # Only insert if user owned shares at that date
                if shares_owned > 0:
                    inserted = await self._insert_dividend_with_ownership(
                        user_id=user_id,
                        symbol=symbol,
                        dividend_data=dividend,
                        shares_owned=shares_owned
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
    
    async def _insert_dividend_with_ownership(self, user_id: str, symbol: str, dividend_data: Dict[str, Any], shares_owned: float) -> bool:
        """Insert dividend into database with calculated ownership amount"""
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
            
            # Calculate total dividend amount user should receive
            per_share_amount = float(dividend_data['amount'])
            total_dividend_amount = per_share_amount * shares_owned
            
            # Insert new dividend with ownership calculation
            insert_data = {
                'user_id': user_id,
                'symbol': symbol,
                'ex_date': dividend_data['ex_date'],
                'pay_date': dividend_data.get('pay_date', dividend_data['ex_date']),
                'amount': total_dividend_amount,  # Total amount user should receive
                'currency': dividend_data.get('currency', 'USD'),
                'confirmed': False,
                'source': 'alpha_vantage',
                'notes': f'Calculated: {shares_owned} shares × ${per_share_amount:.4f} per share'
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

    async def _get_first_transaction_date(self, user_id: str, symbol: str, user_token: str) -> Optional[date]:
        """Get the date of user's first transaction for a symbol"""
        try:
            # Import here to avoid circular imports
            from supa_api.supa_api_transactions import supa_api_get_user_transactions
            
            # Get all transactions for this symbol
            transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
            
            if not transactions:
                return None
            
            # Filter by symbol and find the earliest date
            symbol_transactions = [t for t in transactions if t['symbol'] == symbol]
            if not symbol_transactions:
                return None
                
            # Sort by date and get the first one
            symbol_transactions.sort(key=lambda x: x['date'])
            return datetime.strptime(symbol_transactions[0]['date'], '%Y-%m-%d').date()
            
        except Exception as e:
            logger.error(f"Failed to get first transaction date: {e}")
            return None
    
    async def _calculate_shares_owned_at_date(self, user_id: str, symbol: str, target_date: str, user_token: str) -> float:
        """Calculate how many shares user owned at a specific date"""
        try:
            # Import here to avoid circular imports
            from supa_api.supa_api_transactions import supa_api_get_user_transactions
            
            # Get all transactions for this symbol up to the target date
            target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Get all transactions using the authenticated API
            all_transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
            
            if not all_transactions:
                return 0.0
            
            # Filter transactions for this symbol up to the target date
            relevant_transactions = [
                t for t in all_transactions 
                if t['symbol'] == symbol and 
                datetime.strptime(t['date'], '%Y-%m-%d').date() <= target_date_obj
            ]
            
            if not relevant_transactions:
                return 0.0
            
            # Calculate running total of shares
            total_shares = 0.0
            for transaction in relevant_transactions:
                if transaction['transaction_type'] in ['BUY', 'Buy']:
                    total_shares += float(transaction['quantity'])
                elif transaction['transaction_type'] in ['SELL', 'Sell']:
                    total_shares -= float(transaction['quantity'])
                # Note: DIVIDEND transactions don't affect share count
            
            return max(0.0, total_shares)  # Can't have negative shares
            
        except Exception as e:
            logger.error(f"Failed to calculate shares owned at date: {e}")
            return 0.0
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="SYNC_ALL_HOLDINGS")
    async def sync_dividends_for_all_holdings(self, user_id: str, user_token: str) -> Dict[str, Any]:
        """Efficiently sync dividends for all user's current holdings"""
        try:
            logger.info(f"[DividendService] Starting efficient dividend sync for user {user_id}")
            
            # STEP 1: Get ALL user transactions ONCE
            from supa_api.supa_api_transactions import supa_api_get_user_transactions
            all_transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
            
            if not all_transactions:
                return {
                    "success": True,
                    "total_symbols": 0,
                    "dividends_synced": 0,
                    "message": "No transactions found"
                }
            
            logger.info(f"[DividendService] Found {len(all_transactions)} total transactions")
            
            # STEP 2: Build holdings and first transaction dates from the transaction data
            holdings_info = self._analyze_transactions(all_transactions)
            
            if not holdings_info:
                return {
                    "success": True,
                    "total_symbols": 0,
                    "dividends_synced": 0,
                    "message": "No current holdings found"
                }
            
            logger.info(f"[DividendService] Found {len(holdings_info)} current holdings: {list(holdings_info.keys())}")
            
            # STEP 3: Batch process dividends for all holdings
            total_synced = 0
            sync_results = []
            
            for symbol, info in holdings_info.items():
                logger.info(f"[DividendService] Processing dividends for {symbol} (owned since {info['first_date']})")
                
                # Fetch dividend data from Alpha Vantage
                dividend_data = await self._fetch_dividends_from_alpha_vantage(symbol)
                
                if not dividend_data:
                    logger.info(f"[DividendService] No dividends found for {symbol}")
                    continue
                
                logger.info(f"[DividendService] Found {len(dividend_data)} raw dividends for {symbol}")
                
                # Filter dividends from first transaction date
                relevant_dividends = [
                    div for div in dividend_data 
                    if datetime.strptime(div['ex_date'], '%Y-%m-%d').date() >= info['first_date']
                ]
                
                logger.info(f"[DividendService] {len(relevant_dividends)} relevant dividends for {symbol} (after {info['first_date']})")
                
                # Process each dividend
                symbol_synced = 0
                for dividend in relevant_dividends:
                    # Calculate shares owned at ex-dividend date using our pre-loaded transaction data
                    shares_owned = self._calculate_shares_at_date(
                        all_transactions, symbol, dividend['ex_date']
                    )
                    
                    logger.info(f"[DividendService] {symbol} on {dividend['ex_date']}: owned {shares_owned} shares, amount ${dividend['amount']} per share")
                    
                    if shares_owned > 0:
                        # Insert dividend record
                        inserted = await self._insert_dividend_with_ownership_batch(
                            user_id, symbol, dividend, shares_owned, user_token
                        )
                        if inserted:
                            symbol_synced += 1
                            logger.info(f"[DividendService] ✓ Inserted dividend for {symbol} on {dividend['ex_date']}")
                        else:
                            logger.info(f"[DividendService] ⚠ Dividend already exists for {symbol} on {dividend['ex_date']}")
                    else:
                        logger.info(f"[DividendService] ⚠ No shares owned for {symbol} on {dividend['ex_date']}")
                
                total_synced += symbol_synced
                sync_results.append({
                    "symbol": symbol,
                    "dividends_synced": symbol_synced,
                    "total_found": len(relevant_dividends)
                })
                
                logger.info(f"[DividendService] Synced {symbol_synced} dividends for {symbol}")
            
            return {
                "success": True,
                "total_symbols": len(holdings_info),
                "dividends_synced": total_synced,
                "sync_results": sync_results,
                "message": f"Synced dividends for {len(holdings_info)} holdings, found {total_synced} dividend payments"
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="sync_dividends_for_all_holdings",
                error=e,
                user_id=user_id
            )
            return {
                "success": False,
                "error": str(e)
            }
    
    def _analyze_transactions(self, transactions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Analyze transactions to find current holdings and first transaction dates"""
        try:
            holdings = {}
            
            for transaction in transactions:
                symbol = transaction['symbol']
                transaction_date = datetime.strptime(transaction['date'], '%Y-%m-%d').date()
                
                if symbol not in holdings:
                    holdings[symbol] = {
                        'quantity': 0,
                        'first_date': transaction_date
                    }
                
                # Track earliest transaction date
                if transaction_date < holdings[symbol]['first_date']:
                    holdings[symbol]['first_date'] = transaction_date
                
                # Calculate current quantity
                if transaction['transaction_type'] in ['BUY', 'Buy']:
                    holdings[symbol]['quantity'] += float(transaction['quantity'])
                elif transaction['transaction_type'] in ['SELL', 'Sell']:
                    holdings[symbol]['quantity'] -= float(transaction['quantity'])
            
            # Return only symbols with positive holdings
            return {
                symbol: info for symbol, info in holdings.items() 
                if info['quantity'] > 0
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze transactions: {e}")
            return {}
    
    def _calculate_shares_at_date(self, transactions: List[Dict[str, Any]], symbol: str, target_date: str) -> float:
        """Calculate shares owned at a specific date using pre-loaded transaction data"""
        try:
            target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Filter transactions for this symbol up to the target date
            relevant_transactions = [
                t for t in transactions 
                if t['symbol'] == symbol and 
                datetime.strptime(t['date'], '%Y-%m-%d').date() <= target_date_obj
            ]
            
            # Calculate running total
            total_shares = 0.0
            for transaction in relevant_transactions:
                if transaction['transaction_type'] in ['BUY', 'Buy']:
                    total_shares += float(transaction['quantity'])
                elif transaction['transaction_type'] in ['SELL', 'Sell']:
                    total_shares -= float(transaction['quantity'])
            
            return max(0.0, total_shares)
            
        except Exception as e:
            logger.error(f"Failed to calculate shares at date: {e}")
            return 0.0
    
    async def _insert_dividend_with_ownership_batch(self, user_id: str, symbol: str, dividend_data: Dict[str, Any], shares_owned: float, user_token: str) -> bool:
        """Insert dividend record efficiently using service client for admin operations"""
        try:
            # Use service client which has full permissions for admin operations like dividend insertion
            # The user_id in the insert data ensures the record is associated with the correct user
            
            # Check if dividend already exists to avoid duplicates
            existing = self.supa_client.table('user_dividends') \
                .select('id') \
                .eq('user_id', user_id) \
                .eq('symbol', symbol) \
                .eq('ex_date', dividend_data['ex_date']) \
                .execute()
            
            if existing.data:
                return False  # Already exists
            
            # Calculate total dividend amount
            per_share_amount = float(dividend_data['amount'])
            total_dividend_amount = per_share_amount * shares_owned
            
            # Insert new dividend record
            insert_data = {
                'user_id': user_id,
                'symbol': symbol,
                'ex_date': dividend_data['ex_date'],
                'pay_date': dividend_data.get('pay_date', dividend_data['ex_date']),
                'amount': total_dividend_amount,  # Total amount user should receive
                'currency': dividend_data.get('currency', 'USD'),
                'confirmed': False,
                'source': 'alpha_vantage',
                'notes': f'Calculated: {shares_owned} shares × ${per_share_amount:.4f} per share'
            }
            
            result = self.supa_client.table('user_dividends') \
                .insert(insert_data) \
                .execute()
            
            return bool(result.data)
            
        except Exception as e:
            logger.error(f"Failed to insert dividend batch: {e}")
            return False

# Create singleton instance
dividend_service = DividendService()