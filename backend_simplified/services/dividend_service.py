"""
Dividend Service for tracking and syncing dividend payments
Handles Alpha Vantage integration and dividend confirmation workflow
"""
import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal
import threading
import time

from debug_logger import DebugLogger
from supa_api.supa_api_client import get_supa_service_client
from vantage_api.vantage_api_client import get_vantage_client

logger = logging.getLogger(__name__)

class DividendService:
    """Service for managing dividend tracking and synchronization"""
    
    def __init__(self):
        self.supa_client = get_supa_service_client()
        self.vantage_client = get_vantage_client()
        
        # Race condition protection
        self._sync_lock = threading.RLock()
        self._last_global_sync = 0
        self._user_sync_locks = {}  # Per-user sync locks
        self._global_sync_in_progress = False
        
        logger.info(f"[DividendService] Initialized with service client: {type(self.supa_client)}")
    
    def _can_start_global_sync(self) -> bool:
        """Check if global sync can start (no user syncs in progress, not rate limited)"""
        with self._sync_lock:
            # Don't start if already in progress
            if self._global_sync_in_progress:
                return False
            
            # Rate limiting: don't sync more than once every 10 minutes
            current_time = time.time()
            if current_time - self._last_global_sync < 600:  # 10 minutes
                return False
            
            # Don't start if any user syncs are in progress
            if any(self._user_sync_locks.values()):
                return False
            
            return True
    
    def _acquire_user_sync_lock(self, user_id: str) -> bool:
        """Try to acquire sync lock for a specific user"""
        with self._sync_lock:
            # Don't allow user sync if global sync is in progress
            if self._global_sync_in_progress:
                return False
            
            # Don't allow if this user is already syncing
            if self._user_sync_locks.get(user_id, False):
                return False
            
            # Acquire the lock
            self._user_sync_locks[user_id] = True
            return True
    
    def _release_user_sync_lock(self, user_id: str):
        """Release sync lock for a specific user"""
        with self._sync_lock:
            self._user_sync_locks[user_id] = False
    
    def _validate_dividend_data(self, dividend: Dict[str, Any], symbol: str) -> Dict[str, Any]:
        """Validate dividend data and return validation result"""
        errors = []
        
        # Required fields validation
        if not dividend.get('ex_date'):
            errors.append("Missing ex_date")
        
        if not dividend.get('amount'):
            errors.append("Missing amount")
        elif not isinstance(dividend['amount'], (int, float)) or dividend['amount'] <= 0:
            errors.append(f"Invalid amount: {dividend['amount']}")
        
        # Date format validation
        if dividend.get('ex_date'):
            try:
                ex_date = datetime.strptime(dividend['ex_date'], '%Y-%m-%d').date()
                # Check if date is reasonable (not too far in past/future)
                today = date.today()
                if ex_date > today + timedelta(days=365):
                    errors.append(f"Ex-date too far in future: {ex_date}")
                elif ex_date < today - timedelta(days=365*10):
                    errors.append(f"Ex-date too far in past: {ex_date}")
            except ValueError:
                errors.append(f"Invalid date format: {dividend.get('ex_date')}")
        
        # Currency validation
        valid_currencies = self._get_supported_currencies()
        currency = dividend.get('currency', 'USD')
        if currency not in valid_currencies:
            # Warning, not error - still allow but log
            logger.warning(f"Unusual currency for {symbol}: {currency}")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': []
        }
    
    def _validate_ownership_calculation(self, shares_owned: float, symbol: str, ex_date: str) -> Dict[str, Any]:
        """Validate ownership calculation results"""
        errors = []
        warnings = []
        
        # Check for negative shares (should never happen)
        if shares_owned < 0:
            errors.append(f"Negative shares owned: {shares_owned}")
        
        # Check for unreasonable values
        if shares_owned > 1_000_000:
            warnings.append(f"Very large position: {shares_owned} shares")
        
        # Check for fractional shares (some brokers allow, some don't)
        if shares_owned % 1 != 0:
            warnings.append(f"Fractional shares: {shares_owned}")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'shares_owned': max(0, shares_owned)  # Ensure non-negative
        }
    
    def _get_supported_currencies(self) -> List[str]:
        """Get list of supported currencies for dividend tracking"""
        return [
            'USD',  # US Dollar
            'EUR',  # Euro
            'GBP',  # British Pound
            'CAD',  # Canadian Dollar
            'AUD',  # Australian Dollar
            'JPY',  # Japanese Yen
            'CHF',  # Swiss Franc
            'HKD',  # Hong Kong Dollar
            'SGD',  # Singapore Dollar
            'SEK',  # Swedish Krona
            'NOK',  # Norwegian Krone
            'DKK',  # Danish Krone
            'NZD',  # New Zealand Dollar
            'ZAR',  # South African Rand
            'BRL',  # Brazilian Real
            'MXN',  # Mexican Peso
            'KRW',  # South Korean Won
            'INR',  # Indian Rupee
            'TWD',  # Taiwan Dollar
            'THB',  # Thai Baht
        ]
    
    def _get_currency_symbol(self, currency_code: str) -> str:
        """Get currency symbol for display purposes"""
        currency_symbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': 'C$', 'AUD': 'A$',
            'JPY': '¥', 'CHF': 'Fr', 'HKD': 'HK$', 'SGD': 'S$', 'SEK': 'kr',
            'NOK': 'kr', 'DKK': 'kr', 'NZD': 'NZ$', 'ZAR': 'R', 'BRL': 'R$',
            'MXN': '$', 'KRW': '₩', 'INR': '₹', 'TWD': 'NT$', 'THB': '฿'
        }
        return currency_symbols.get(currency_code.upper(), currency_code)
    
    def _format_currency_amount(self, amount: float, currency: str) -> str:
        """Format amount with appropriate currency symbol and precision"""
        symbol = self._get_currency_symbol(currency)
        
        # Different currencies have different decimal places
        if currency in ['JPY', 'KRW']:  # No decimal places
            return f"{symbol}{amount:,.0f}"
        elif currency in ['BHD', 'KWD', 'OMR']:  # 3 decimal places
            return f"{symbol}{amount:,.3f}"
        else:  # Standard 2 decimal places
            return f"{symbol}{amount:,.2f}"
    
    async def _convert_currency_if_needed(self, amount: float, from_currency: str, to_currency: str = 'USD') -> Dict[str, Any]:
        """
        Convert currency amount if needed (placeholder for future currency conversion)
        Currently returns original amount with metadata
        """
        if from_currency == to_currency:
            return {
                'converted_amount': amount,
                'original_amount': amount,
                'from_currency': from_currency,
                'to_currency': to_currency,
                'exchange_rate': 1.0,
                'conversion_date': datetime.now().isoformat(),
                'needs_conversion': False
            }
        
        # TODO: Implement actual currency conversion using exchange rate API
        # For now, just return original amount with metadata
        logger.warning(f"Currency conversion not implemented: {from_currency} to {to_currency}")
        
        return {
            'converted_amount': amount,  # No conversion yet
            'original_amount': amount,
            'from_currency': from_currency,
            'to_currency': to_currency,
            'exchange_rate': None,
            'conversion_date': datetime.now().isoformat(),
            'needs_conversion': True,
            'note': 'Currency conversion not implemented - using original amount'
        }
    
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
            
            # Insert dividends into global reference table (no user-specific data)
            synced_count = 0
            for dividend in filtered_dividends:
                # Insert into global table (regardless of user ownership)
                inserted = await self._upsert_global_dividend(
                    symbol=symbol,
                    dividend_data=dividend
                )
                if inserted:
                    synced_count += 1
            
            logger.info(f"[DividendService] Synced {synced_count} new global dividends for {symbol}")
            
            # Step 2: Assign ALL applicable dividends to the user (including existing ones)
            # This ensures users get dividends even if they were already in the global table
            assigned_count = 0
            logger.info(f"[DividendService] Assigning {len(filtered_dividends)} dividends to user {user_id}")
            
            for dividend in filtered_dividends:
                # Calculate shares held at ex-date
                shares_at_ex_date = await self._calculate_shares_owned_at_date(
                    user_id, symbol, dividend['ex_date'], user_token
                )
                
                if shares_at_ex_date > 0:
                    # Create user-specific dividend record
                    total_amount = float(dividend['amount']) * shares_at_ex_date
                    # Add symbol to dividend data since it's not included from Alpha Vantage
                    dividend_with_symbol = {**dividend, 'symbol': symbol}
                    success = await self._create_user_dividend_record(
                        user_id=user_id,
                        dividend=dividend_with_symbol,
                        shares_held=shares_at_ex_date,
                        total_amount=total_amount
                    )
                    if success:
                        assigned_count += 1
                        logger.info(f"[DividendService] Assigned dividend to user: {symbol} on {dividend['ex_date']} - {shares_at_ex_date} shares @ ${dividend['amount']}/share = ${total_amount}")
                    else:
                        logger.info(f"[DividendService] User already has dividend record for {symbol} on {dividend['ex_date']}")
                else:
                    logger.info(f"[DividendService] User had 0 shares of {symbol} on {dividend['ex_date']}, skipping")
            
            logger.info(f"[DividendService] Assigned {assigned_count} dividends to user {user_id} for {symbol}")
            
            return {
                "success": True,
                "symbol": symbol,
                "dividends_synced": synced_count,
                "dividends_assigned": assigned_count,
                "total_found": len(filtered_dividends),
                "message": f"Successfully synced {synced_count} new dividends and assigned {assigned_count} dividends to user for {symbol}"
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
    
    async def _fetch_dividends_from_alpha_vantage(self, symbol: str, max_retries: int = 3) -> List[Dict[str, Any]]:
        """Fetch dividend data from Alpha Vantage API with retry logic and error handling"""
        
        for attempt in range(max_retries):
            try:
                # Import here to avoid circular imports
                from vantage_api.vantage_api_quotes import vantage_api_get_dividends
                
                DebugLogger.info_if_enabled(f"[DividendService] Fetching dividends for {symbol} (attempt {attempt + 1}/{max_retries})", logger)
                
                dividends_data_raw = await vantage_api_get_dividends(symbol)
                DebugLogger.info_if_enabled(f"[DividendService] Raw Alpha Vantage response for {symbol}: {dividends_data_raw}", logger)
                
                if not dividends_data_raw:
                    logger.info(f"[DividendService] Alpha Vantage reported no dividend history for {symbol}. This is normal for some stocks. Skipping.")
                    return []
                
                # Validate and convert to our format
                dividends = []
                for item in dividends_data_raw:
                    try:
                        # Validate required fields
                        if not item.get('ex_date'):
                            logger.warning(f"Skipping dividend for {symbol}: missing ex_date")
                            continue
                        
                        amount = item.get('amount', 0)
                        if not amount or float(amount) <= 0:
                            logger.warning(f"Skipping dividend for {symbol}: invalid amount {amount}")
                            continue
                        
                        dividend = {
                            'date': item.get('ex_date'),
                            'amount': float(amount),
                            'ex_date': item.get('ex_date'),
                            'pay_date': item.get('pay_date', item.get('ex_date')),
                            'declaration_date': item.get('declaration_date'),
                            'record_date': item.get('record_date'),
                            'currency': item.get('currency', 'USD')
                        }
                        
                        # Validate date format
                        try:
                            datetime.strptime(dividend['ex_date'], '%Y-%m-%d')
                        except ValueError:
                            logger.warning(f"Skipping dividend for {symbol}: invalid date format {dividend['ex_date']}")
                            continue
                        
                        dividends.append(dividend)
                        
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Skipping invalid dividend data for {symbol}: {e}")
                        continue
                
                DebugLogger.info_if_enabled(f"[DividendService] Successfully fetched {len(dividends)} valid dividends for {symbol}", logger)
                return dividends
            
            except Exception as e:
                error_msg = str(e).lower()
                
                # Handle specific Alpha Vantage errors
                if "rate limit" in error_msg or "api call frequency" in error_msg:
                    wait_time = 60 * (attempt + 1)  # Exponential backoff
                    logger.warning(f"Rate limit hit for {symbol}, waiting {wait_time}s before retry {attempt + 1}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                        continue
                
                elif "invalid api key" in error_msg or "no api key" in error_msg:
                    logger.error(f"API key issue for {symbol}: {e}")
                    return []  # Don't retry on auth errors
                
                elif "invalid symbol" in error_msg or "unknown symbol" in error_msg:
                    logger.warning(f"Invalid symbol {symbol}: {e}")
                    return []  # Don't retry on invalid symbols
                
                else:
                    # Generic error - retry with backoff
                    wait_time = 5 * (attempt + 1)
                    logger.warning(f"API error for {symbol} (attempt {attempt + 1}): {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                        continue
                
                # If this is the last attempt, log the error
                if attempt == max_retries - 1:
                    DebugLogger.log_error(
                        file_name="dividend_service.py",
                        function_name="_fetch_dividends_from_alpha_vantage",
                        error=e,
                        symbol=symbol,
                        attempt=attempt + 1
                    )
        
        # All retries failed
        logger.error(f"Failed to fetch dividends for {symbol} after {max_retries} attempts")
        return []
    
    async def _upsert_global_dividend(self, symbol: str, dividend_data: Optional[Dict[str, Any]] = None, user_id: Optional[str] = None, dividend: Optional[Dict[str, Any]] = None, shares_held: Optional[float] = None, total_amount: Optional[float] = None) -> bool:
        """Upsert dividend into global reference table with proper validation and duplicate checking"""
        try:
            # Handle both calling patterns
            if dividend_data is not None:
                # Called with dividend_data (global dividend pattern)
                data = dividend_data
                is_user_specific = False
            elif dividend is not None:
                # Called with user-specific data
                data = dividend
                is_user_specific = True
            else:
                logger.warning(f"Skipping dividend for {symbol}: no dividend data provided")
                return False
            
            # VALIDATION: Check for required fields and validate data
            if not data.get('ex_date') or data['ex_date'] in [None, 'None', '']:
                logger.warning(f"Skipping dividend for {symbol}: invalid ex_date '{data.get('ex_date')}'")
                return False
            
            if not data.get('amount') or data['amount'] in [None, 'None', '']:
                logger.warning(f"Skipping dividend for {symbol}: invalid amount '{data.get('amount')}'")
                return False
            
            # Convert amount to float early for validation
            try:
                per_share_amount = float(data['amount'])
            except (ValueError, TypeError):
                logger.warning(f"Skipping dividend for {symbol}: invalid amount format '{data['amount']}'")
                return False
            
            # Validate date format for ex_date
            try:
                datetime.strptime(str(data['ex_date']), '%Y-%m-%d')
            except ValueError:
                logger.warning(f"Skipping dividend for {symbol}: invalid ex_date format '{data['ex_date']}'")
                return False
            
            # DUPLICATE CHECK: Check if this exact dividend already exists
            if is_user_specific and user_id:
                # Check for user-specific dividend
                existing = (self.supa_client.table('user_dividends')
                            .select('id')
                            .eq('symbol', symbol)
                            .eq('ex_date', data['ex_date'])
                            .eq('amount', per_share_amount)
                            .eq('user_id', user_id)
                            .execute())
            else:
                # Check for global dividend
                existing = (self.supa_client.table('user_dividends')
                            .select('id')
                            .eq('symbol', symbol)
                            .eq('ex_date', data['ex_date'])
                            .eq('amount', per_share_amount)
                            .is_('user_id', None)  # Global dividends have null user_id
                            .execute())
            
            if existing.data:
                logger.info(f"Dividend already exists for {symbol} on {data['ex_date']}, skipping")
                return False  # Already exists, no need to insert
            
            # Prepare insert data
            if is_user_specific and user_id:
                # User-specific dividend
                insert_data = {
                    'symbol': symbol,
                    'ex_date': data['ex_date'],
                    'amount': per_share_amount,  # Per-share amount
                    'currency': data.get('currency', 'USD'),
                    'confirmed': False,
                    'user_id': user_id,
                    'shares_held_at_ex_date': shares_held,
                    'source': 'alpha_vantage'
                }
                if total_amount is not None:
                    insert_data['total_amount'] = total_amount
            else:
                # Global dividend (user_id = null)
                insert_data = {
                    'symbol': symbol,
                    'ex_date': data['ex_date'],
                    'amount': per_share_amount,  # Per-share amount (global reference)
                    'currency': data.get('currency', 'USD'),
                    'confirmed': False,  # Global dividends start as unconfirmed
                    'user_id': None,  # Global dividends have null user_id
                    'shares_held_at_ex_date': None,  # Global dividends don't have user-specific shares
                    'source': 'alpha_vantage'
                }
            
            # Handle pay_date with validation
            pay_date = data.get('pay_date') or data.get('payment_date')
            if pay_date and pay_date not in [None, 'None', '']:
                try:
                    datetime.strptime(str(pay_date), '%Y-%m-%d')
                    insert_data['pay_date'] = pay_date
                except ValueError:
                    logger.warning(f"Invalid pay_date format for {symbol}: '{pay_date}', using ex_date")
                    insert_data['pay_date'] = data['ex_date']
            else:
                insert_data['pay_date'] = data['ex_date']  # Default to ex_date
            
            # Only add optional date fields if they have valid values and formats
            optional_dates = ['declaration_date', 'record_date', 'payment_date']
            for date_field in optional_dates:
                date_value = data.get(date_field)
                if date_value and date_value not in [None, 'None', '']:
                    try:
                        datetime.strptime(str(date_value), '%Y-%m-%d')
                        insert_data[date_field] = date_value
                    except ValueError:
                        logger.warning(f"Invalid {date_field} format for {symbol}: '{date_value}', skipping field")
            
            # Insert into user_dividends table
            logger.info(f"[DIVIDEND_DB_DEBUG] About to insert into user_dividends table:")
            logger.info(f"[DIVIDEND_DB_DEBUG] Insert data: {insert_data}")
            
            result = self.supa_client.table('user_dividends') \
                .insert(insert_data) \
                .execute()
            
            logger.info(f"[DIVIDEND_DB_DEBUG] Insert result: success={bool(result.data)}, data_count={len(result.data) if result.data else 0}")
            if getattr(result, 'error', None):
                logger.error(f"[DIVIDEND_DB_DEBUG] Insert error: {getattr(result, 'error', 'Unknown error')}")
            
            if result.data:
                dividend_type = "user-specific" if is_user_specific else "global"
                logger.info(f"[DIVIDEND_DB_DEBUG] ✅ SUCCESS: Inserted {dividend_type} dividend for {symbol} on {data['ex_date']}: ${per_share_amount}")
                return True
            else:
                logger.error(f"[DIVIDEND_DB_DEBUG] ❌ FAILED: No data returned from insert for {symbol} on {data['ex_date']}")
                if getattr(result, 'error', None):
                    logger.error(f"[DIVIDEND_DB_DEBUG] Error details: {getattr(result, 'error', 'Unknown error')}")
                return False
            
        except Exception as e:
            logger.error(f"Failed to upsert global dividend for {symbol}: {e}")
            logger.error(f"Dividend data that caused error: {data if 'data' in locals() else dividend_data}")
            return False
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="GET_USER_DIVIDENDS")
    async def get_user_dividends(self, user_id: str, user_token: Optional[str] = None, confirmed_only: bool = False) -> Dict[str, Any]:
        """Get dividends for user's portfolio with ownership calculations (OPTIMIZED + VERBOSE)"""
        try:
            logger.info(f"[DIVIDEND_DEBUG] ===== Starting get_user_dividends for user {user_id}, confirmed_only={confirmed_only} =====")
            
            # OPTIMIZATION: Get user transactions ONCE and reuse for all calculations
            from supa_api.supa_api_transactions import supa_api_get_user_transactions
            all_transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
            
            logger.info(f"[DIVIDEND_DEBUG] Retrieved {len(all_transactions) if all_transactions else 0} transactions")
            if all_transactions:
                logger.info(f"[DIVIDEND_DEBUG] Sample transactions: {all_transactions[:2]}")
            
            if not all_transactions:
                logger.info(f"[DIVIDEND_DEBUG] No transactions found for user {user_id}")
                return {
                    "success": True,
                    "dividends": [],
                    "total_count": 0,
                    "message": "No transactions found"
                }
            
            # Get symbols user has transacted with
            user_symbols = list(set(txn['symbol'] for txn in all_transactions if txn.get('symbol')))
            logger.info(f"[DIVIDEND_DEBUG] User symbols from transactions: {user_symbols}")
            
            if not user_symbols:
                logger.info(f"[DIVIDEND_DEBUG] No symbols found in transactions")
                return {
                    "success": True,
                    "dividends": [],
                    "total_count": 0,
                    "message": "No portfolio holdings found"
                }
            
            # Get all dividend transactions for confirmed status check
            dividend_transactions = [txn for txn in all_transactions if txn.get('transaction_type') == 'DIVIDEND']
            confirmed_dividends_set = set()
            for txn in dividend_transactions:
                confirmed_dividends_set.add((txn['symbol'], txn['date']))
            
            logger.info(f"[DIVIDEND_DEBUG] Found {len(dividend_transactions)} confirmed dividend transactions")
            logger.info(f"[DIVIDEND_DEBUG] Confirmed dividends set: {confirmed_dividends_set}")
            
            # NEW SIMPLE APPROACH: Get user-specific dividends only (where user_id = actual user_id)
            # UPDATED: Exclude rejected dividends
            query = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('user_id', user_id) \
                .order('pay_date', desc=True)
            
            # Filter out rejected dividends after fetching
            # (Supabase client doesn't support complex OR conditions well)
            
            # Apply confirmed_only filter at database level for efficiency
            if confirmed_only:
                query = query.eq('confirmed', True)
            
            result = query.execute()
            logger.info(f"[DIVIDEND_DEBUG] Found {len(result.data) if result.data else 0} user-specific dividends for user {user_id}")
            
            if result.data:
                logger.info(f"[DIVIDEND_DEBUG] Sample user dividends: {result.data[:2]}")
            
            # Filter out rejected dividends
            filtered_dividends = []
            for dividend in result.data:
                # Skip if rejected is True
                if dividend.get('rejected', False):
                    logger.info(f"[DIVIDEND_DEBUG] Skipping rejected dividend: {dividend['symbol']} id={dividend['id']}")
                    continue
                filtered_dividends.append(dividend)
            
            logger.info(f"[DIVIDEND_DEBUG] After filtering rejected: {len(filtered_dividends)} dividends remain")
            
            # Simple processing - data is already user-specific with correct amounts
            enriched_dividends = []
            for dividend in filtered_dividends:
                logger.info(f"[DIVIDEND_DEBUG] Processing user dividend: {dividend['symbol']} ex_date={dividend['ex_date']} amount={dividend['amount']} shares={dividend.get('shares_held_at_ex_date', 0)} total={dividend.get('total_amount', 0)}")
                
                # Check if confirmed using cached transaction data
                is_confirmed = (dividend['symbol'], dividend['pay_date']) in confirmed_dividends_set
                
                # Calculate current holdings for display
                current_holdings = self._calculate_current_holdings_from_transactions(
                    all_transactions, dividend['symbol']
                )
                
                # Ensure id is explicitly included and converted to string
                dividend_id = dividend.get('id')
                if dividend_id:
                    dividend_id = str(dividend_id)  # Convert UUID to string
                else:
                    logger.warning(f"[DIVIDEND_DEBUG] WARNING: Dividend missing 'id' field for {dividend['symbol']}")
                
                enriched_dividend = {
                    'id': dividend_id,  # Explicitly include id as string
                    'symbol': dividend['symbol'],
                    'user_id': dividend.get('user_id'),
                    'ex_date': dividend['ex_date'],  # Keep as string (YYYY-MM-DD format)
                    'pay_date': dividend.get('pay_date'),  # Keep as string
                    'amount': float(dividend['amount']) if dividend.get('amount') else 0.0,
                    'amount_per_share': float(dividend['amount']) if dividend.get('amount') else 0.0,  # Frontend expects 'amount_per_share'
                    'shares_held_at_ex_date': float(dividend.get('shares_held_at_ex_date', 0)),
                    'current_holdings': float(current_holdings) if current_holdings is not None else 0.0,
                    'total_amount': float(dividend.get('total_amount', 0)),  # Use pre-calculated amount
                    'confirmed': bool(is_confirmed),
                    'company': self._get_company_name(dividend['symbol']) or f"{dividend['symbol']} Corporation",
                    'status': 'confirmed' if is_confirmed else 'pending',
                    'dividend_type': dividend.get('dividend_type', 'cash'),
                    'source': dividend.get('source', 'alpha_vantage'),
                    'currency': dividend.get('currency', 'USD'),
                    'is_future': datetime.strptime(dividend['ex_date'], '%Y-%m-%d').date() > date.today(),
                    'is_recent': (date.today() - datetime.strptime(dividend['ex_date'], '%Y-%m-%d').date()).days <= 30,
                    'created_at': dividend.get('created_at'),  # Keep timestamp as string
                    'updated_at': dividend.get('updated_at')   # Keep timestamp as string
                }
                
                enriched_dividends.append(enriched_dividend)
                logger.info(f"[DIVIDEND_DEBUG] ✓ Added user dividend: {dividend['symbol']} confirmed={is_confirmed}, total_amount={enriched_dividend['total_amount']}")
            
            logger.info(f"[DIVIDEND_DEBUG] ===== Final result: {len(enriched_dividends)} dividends to return =====")
            if enriched_dividends:
                logger.info(f"[DIVIDEND_DEBUG] Sample enriched dividends: {enriched_dividends[:2]}")
                
                # DETAILED DEBUG: Log the exact structure being returned
                for i, div in enumerate(enriched_dividends[:3]):  # First 3 dividends
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG] Dividend {i+1}:")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   id: {div.get('id', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   symbol: {div.get('symbol', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   amount_per_share: {div.get('amount_per_share', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   shares_held_at_ex_date: {div.get('shares_held_at_ex_date', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   current_holdings: {div.get('current_holdings', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   total_amount: {div.get('total_amount', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   confirmed: {div.get('confirmed', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   company: {div.get('company', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   ex_date: {div.get('ex_date', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   pay_date: {div.get('pay_date', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   currency: {div.get('currency', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   status: {div.get('status', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   is_future: {div.get('is_future', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   is_recent: {div.get('is_recent', 'MISSING')}")
                    logger.info(f"[DIVIDEND_DETAILED_DEBUG]   Full object keys: {list(div.keys())}")
            else:
                logger.warning(f"[DIVIDEND_DEBUG] NO DIVIDENDS TO RETURN!")
            
            return {
                "success": True,
                "dividends": enriched_dividends,
                "total_count": len(enriched_dividends)
            }
            
        except Exception as e:
            logger.error(f"[DIVIDEND_DEBUG] ERROR in get_user_dividends: {str(e)}")
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
    async def confirm_dividend(self, user_id: str, dividend_id: str, user_token: Optional[str] = None, edited_amount: Optional[float] = None) -> Dict[str, Any]:
        """
        Confirm a dividend payment and create corresponding transaction
        
        Args:
            user_id: User UUID
            dividend_id: Dividend record UUID
            edited_amount: Optional edited amount (overrides calculated amount)
            user_token: User's JWT token for authentication
            
        Returns:
            Dict with confirmation results
        """
        try:
            # Get dividend details from global table
            dividend_result = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('id', dividend_id) \
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
            
            # Use edited amount if provided, otherwise use the pre-calculated amount from cache
            if edited_amount is not None:
                # Validate edited amount
                if edited_amount < 0:
                    return {
                        "success": False,
                        "error": "Dividend amount cannot be negative"
                    }
                final_amount = Decimal(str(edited_amount))
                DebugLogger.info_if_enabled(f"[DividendService] Using edited amount: ${edited_amount}", logger)
            else:
                final_amount = Decimal(str(dividend['amount']))
                DebugLogger.info_if_enabled(f"[DividendService] Using calculated amount: ${dividend['amount']}", logger)
            
            # Get shares held at ex-date from the notes field or recalculate
            shares_held = self._extract_shares_from_notes(dividend.get('notes', ''))
            if not shares_held:
                # Fallback: recalculate shares held at ex-date
                if not user_token:
                    raise ValueError("User token is required for this operation")
                shares_held = await self._calculate_shares_owned_at_date(
                    user_id, dividend['symbol'], dividend['ex_date'], user_token
                )
            
            if shares_held <= 0:
                return {
                    "success": False,
                    "error": f"No shares were held on ex-dividend date for {dividend['symbol']}"
                }
            
            # dividend['amount'] is per-share, calculate total if user edited the total amount
            if edited_amount is not None:
                # User edited the total amount, calculate the per-share amount
                per_share_amount = final_amount / Decimal(str(shares_held))
                total_amount_for_transaction = final_amount
            else:
                # Use the per-share amount from database
                per_share_amount = Decimal(str(dividend['amount']))
                total_amount_for_transaction = per_share_amount * Decimal(str(shares_held))
            
            # Create dividend transaction in transactions table (user's actual receipt)
            # Note: transactions table uses 'price' and 'quantity', not 'total_value'
            # Total is calculated as price * quantity in portfolio calculations
            transaction_data = {
                'user_id': user_id,
                'symbol': dividend['symbol'],
                'transaction_type': 'DIVIDEND',
                'quantity': shares_held,
                'price': float(per_share_amount),
                # 'total_value' field doesn't exist - removed
                'date': dividend['pay_date'],
                'notes': f"Dividend payment - ${per_share_amount:.4f} per share × {shares_held} shares" + 
                        (f" (edited total from ${dividend['amount'] * shares_held:.2f})" if edited_amount is not None else "")
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
                "total_amount": float(total_amount_for_transaction),
                "shares": shares_held,
                "per_share_amount": float(per_share_amount),
                "was_edited": edited_amount is not None,
                "message": f"Dividend confirmed: ${total_amount_for_transaction:.2f} for {shares_held} shares"
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
    
    async def reject_dividend(self, user_id: str, dividend_id: str, user_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Reject a dividend - sets rejected=true, hiding it permanently from the user
        """
        try:
            logger.info(f"[DividendService] Rejecting dividend {dividend_id} for user {user_id}")
            
            # Get the dividend to verify ownership
            dividend_result = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('id', dividend_id) \
                .eq('user_id', user_id) \
                .single() \
                .execute()
            
            if not dividend_result.data:
                return {
                    "success": False,
                    "error": "Dividend not found or access denied"
                }
            
            # Update dividend to set rejected=true
            update_result = self.supa_client.table('user_dividends') \
                .update({
                    'rejected': True,
                    'updated_at': datetime.now().isoformat()
                }) \
                .eq('id', dividend_id) \
                .eq('user_id', user_id) \
                .execute()
            
            if not update_result.data:
                return {
                    "success": False,
                    "error": "Failed to reject dividend"
                }
            
            logger.info(f"[DividendService] Successfully rejected dividend {dividend_id}")
            
            return {
                "success": True,
                "dividend_id": dividend_id,
                "message": "Dividend rejected and hidden permanently"
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="reject_dividend",
                error=e,
                user_id=user_id,
                dividend_id=dividend_id
            )
            return {
                "success": False,
                "error": str(e)
            }
    
    async def edit_dividend(self, user_id: str, original_dividend_id: str, edited_data: Dict[str, Any], user_token: str) -> Dict[str, Any]:
        """
        Edit a dividend - smart update logic:
        - If ex_date changes: reject original and create new (due to unique constraint)
        - Otherwise: update in place for better performance
        """
        try:
            logger.info(f"[DividendService] Editing dividend {original_dividend_id} for user {user_id}")
            
            # Get the original dividend
            original_result = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('id', original_dividend_id) \
                .eq('user_id', user_id) \
                .single() \
                .execute()
            
            if not original_result.data:
                return {
                    "success": False,
                    "error": "Original dividend not found or access denied"
                }
            
            original_dividend = original_result.data
            was_confirmed = original_dividend.get('confirmed', False)
            
            # Check if ex_date is changing
            original_ex_date = original_dividend['ex_date']
            new_ex_date = edited_data.get('ex_date', original_ex_date)
            ex_date_changing = (original_ex_date != new_ex_date)
            
            # Calculate amounts based on shares held at ex-date
            shares_held = original_dividend.get('shares_held_at_ex_date')
            if not shares_held or shares_held <= 0 or ex_date_changing:
                # Recalculate if missing or ex_date changed
                shares_held = await self._calculate_shares_owned_at_date(
                    user_id, 
                    original_dividend['symbol'], 
                    new_ex_date, 
                    user_token
                )
            
            # Handle amount calculations
            if edited_data.get('amount_per_share') is not None:
                amount_per_share = float(edited_data['amount_per_share'])
                total_amount = round(amount_per_share * shares_held, 2)
            elif edited_data.get('total_amount') is not None:
                total_amount = float(edited_data['total_amount'])
                amount_per_share = round(total_amount / shares_held, 3) if shares_held > 0 else 0
            else:
                # Keep original amounts if not edited
                amount_per_share = float(original_dividend['amount'])
                total_amount = round(amount_per_share * shares_held, 2)
            
            # SMART UPDATE LOGIC
            if ex_date_changing:
                # Ex-date is changing - need to reject original and create new
                # due to unique constraint on (user_id, symbol, ex_date, amount)
                logger.info(f"[DividendService] Ex-date changing from {original_ex_date} to {new_ex_date}, using reject-then-create approach")
                
                # First reject the original
                reject_result = await self.reject_dividend(user_id, original_dividend_id, user_token)
                if not reject_result['success']:
                    return {
                        "success": False,
                        "error": f"Failed to reject original dividend: {reject_result.get('error', 'Unknown error')}"
                    }
                
                # Then create new dividend with edited data
                new_dividend_data = {
                    'user_id': user_id,
                    'symbol': original_dividend['symbol'],  # Symbol cannot be edited
                    'ex_date': new_ex_date,
                    'pay_date': edited_data.get('pay_date', original_dividend['pay_date']),
                    'declaration_date': original_dividend.get('declaration_date'),
                    'record_date': original_dividend.get('record_date'),
                    'amount': amount_per_share,
                    'currency': original_dividend.get('currency', 'USD'),
                    'shares_held_at_ex_date': shares_held,
                    'current_holdings': original_dividend.get('current_holdings'),
                    'total_amount': total_amount,
                    'confirmed': was_confirmed,  # Keep same confirmation status
                    'status': 'edited',
                    'dividend_type': original_dividend.get('dividend_type', 'cash'),
                    'source': 'manual',  # Mark as manually edited
                    'notes': f"Edited from dividend {original_dividend_id}",
                    'rejected': False  # New dividend is not rejected
                }
                
                # Insert new dividend
                new_dividend_result = self.supa_client.table('user_dividends') \
                    .insert(new_dividend_data) \
                    .execute()
                
                if not new_dividend_result.data:
                    return {
                        "success": False,
                        "error": "Failed to create edited dividend"
                    }
                
                new_dividend_id = new_dividend_result.data[0]['id']
                
            else:
                # Ex-date not changing - update in place
                logger.info(f"[DividendService] Ex-date not changing, updating dividend in place")
                
                # Prepare update data
                update_data = {
                    'amount': amount_per_share,
                    'total_amount': total_amount,
                    'shares_held_at_ex_date': shares_held,
                    'source': 'manual',  # Mark as manually edited
                    'notes': f"Edited at {datetime.utcnow().isoformat()}"
                }
                
                # Add pay_date if provided
                if 'pay_date' in edited_data:
                    update_data['pay_date'] = edited_data['pay_date']
                
                # Update the dividend
                update_result = self.supa_client.table('user_dividends') \
                    .update(update_data) \
                    .eq('id', original_dividend_id) \
                    .eq('user_id', user_id) \
                    .execute()
                
                if not update_result.data:
                    return {
                        "success": False,
                        "error": "Failed to update dividend"
                    }
                
                new_dividend_id = original_dividend_id
            
            # If original was confirmed, handle transactions
            if was_confirmed:
                # For in-place updates, we need to update the existing transaction
                if not ex_date_changing:
                    # Find and update the existing dividend transaction
                    existing_txn_result = self.supa_client.table('transactions') \
                        .select('id') \
                        .eq('user_id', user_id) \
                        .eq('symbol', original_dividend['symbol']) \
                        .eq('transaction_type', 'DIVIDEND') \
                        .eq('date', original_dividend['pay_date']) \
                        .execute()
                    
                    if existing_txn_result.data:
                        # Update the existing transaction
                        txn_update_result = self.supa_client.table('transactions') \
                            .update({
                                'quantity': shares_held,
                                'price': amount_per_share,
                                'notes': f"Edited dividend payment - ${amount_per_share:.3f} per share × {shares_held} shares"
                            }) \
                            .eq('id', existing_txn_result.data[0]['id']) \
                            .execute()
                        
                        if not txn_update_result.data:
                            logger.warning(f"Failed to update transaction for edited dividend {original_dividend_id}")
                else:
                    # For ex_date changes, we need to handle transactions differently
                    # The reject_dividend function should have already handled removing the original transaction
                    # Now create a new transaction for the edited dividend
                    new_transaction = {
                        'user_id': user_id,
                        'symbol': original_dividend['symbol'],
                        'transaction_type': 'DIVIDEND',
                        'quantity': shares_held,
                        'price': amount_per_share,
                        'date': edited_data.get('pay_date', original_dividend['pay_date']),
                        'notes': f"Edited dividend payment - ${amount_per_share:.3f} per share × {shares_held} shares"
                    }
                    
                    new_transaction_result = self.supa_client.table('transactions') \
                        .insert(new_transaction) \
                        .execute()
                    
                    if not new_transaction_result.data:
                        logger.warning(f"Failed to create new transaction for edited dividend {new_dividend_id}")
            
            # Get the final dividend data to return
            if ex_date_changing:
                final_dividend = new_dividend_result.data[0]
            else:
                final_dividend = update_result.data[0]
            
            logger.info(f"[DividendService] Successfully edited dividend {original_dividend_id}" + 
                       (f" -> {new_dividend_id}" if ex_date_changing else " (in place)"))
            
            return {
                "success": True,
                "original_dividend_id": original_dividend_id,
                "new_dividend_id": new_dividend_id,
                "dividend": final_dividend,
                "was_confirmed": was_confirmed,
                "update_method": "reject_and_create" if ex_date_changing else "in_place",
                "message": f"Dividend edited successfully. {'Transactions adjusted.' if was_confirmed else 'Ready for confirmation.'}"
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="edit_dividend",
                error=e,
                user_id=user_id,
                dividend_id=original_dividend_id
            )
            return {
                "success": False,
                "error": str(e)
            }
    
    @DebugLogger.log_api_call(api_name="DIVIDEND_SERVICE", sender="BACKEND", receiver="DATABASE", operation="GET_DIVIDEND_SUMMARY")
    async def get_dividend_summary(self, user_id: str) -> Dict[str, Any]:
        """Get dividend summary statistics for analytics"""
        try:
            # Get all confirmed dividends
            confirmed_dividends_result = self.supa_client.table('user_dividends') \
                .select('amount, pay_date, currency, rejected') \
                .eq('user_id', user_id) \
                .eq('confirmed', True) \
                .execute()
            
            # Filter out rejected dividends
            confirmed_dividends = [
                div for div in confirmed_dividends_result.data 
                if not div.get('rejected', False)
            ]
            
            # Get pending dividends
            pending_dividends_result = self.supa_client.table('user_dividends') \
                .select('amount, pay_date, currency, rejected') \
                .eq('user_id', user_id) \
                .eq('confirmed', False) \
                .gte('pay_date', datetime.now().date().isoformat()) \
                .execute()
            
            # Filter out rejected dividends
            pending_dividends = [
                div for div in pending_dividends_result.data 
                if not div.get('rejected', False)
            ]
            
            # Calculate totals
            total_received = sum(float(div['amount']) for div in confirmed_dividends)
            total_pending = sum(float(div['amount']) for div in pending_dividends)
            
            # Calculate YTD dividends
            current_year = datetime.now().year
            ytd_dividends = sum(
                float(div['amount']) for div in confirmed_dividends
                if datetime.strptime(div['pay_date'], '%Y-%m-%d').year == current_year
            )
            
            # Count dividends
            confirmed_count = len(confirmed_dividends)
            pending_count = len(pending_dividends)
            
            return {
                "success": True,
                "summary": {
                    "total_received": total_received,
                    "total_pending": total_pending,
                    "ytd_received": ytd_dividends,
                    "confirmed_count": confirmed_count,
                    "pending_count": pending_count
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
    
    async def _calculate_shares_owned_at_date(self, user_id, symbol: str, target_date: str, user_token: str) -> float:
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
        """Efficiently sync dividends for all user's current holdings with race condition protection"""
        
        # Check if this user sync is already in progress
        if not self._acquire_user_sync_lock(user_id):
            return {
                "success": False,
                "error": "Dividend sync already in progress for this user",
                "code": "SYNC_IN_PROGRESS"
            }
        
        try:
            # Check if global sync is running
            with self._sync_lock:
                if self._global_sync_in_progress:
                    return {
                        "success": False,
                        "error": "Global dividend sync in progress, please try again later",
                        "code": "GLOBAL_SYNC_IN_PROGRESS"
                    }
            
            logger.info(f"[DividendService] Starting protected user sync for {user_id}")
            
            # Use the existing sync logic but with protection
            return await self._sync_dividends_for_all_holdings_impl(user_id, user_token)
            
        finally:
            self._release_user_sync_lock(user_id)
    
    async def _sync_dividends_for_all_holdings_impl(self, user_id: str, user_token: str) -> Dict[str, Any]:
        """Implementation of user dividend sync (extracted from original method)"""
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
                
                # Fetch dividend data from Alpha Vantage with retry logic
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
                
                # Process each dividend - INSERT ALL DIVIDENDS regardless of ownership
                symbol_synced = 0
                for dividend in relevant_dividends:
                    logger.info(f"[DividendService] Processing {symbol} dividend on {dividend['ex_date']}: amount ${dividend['amount']} per share")
                    
                    # Insert dividend into global table (for ALL dividends, not just owned ones)
                    logger.info(f"[DIVIDEND_INSERT_DEBUG] About to insert dividend: symbol={symbol}, ex_date={dividend['ex_date']}, amount={dividend['amount']}")
                    logger.info(f"[DIVIDEND_INSERT_DEBUG] Full dividend data: {dividend}")
                    
                    inserted = await self._upsert_global_dividend(
                        symbol=symbol, dividend_data=dividend
                    )
                    
                    if inserted:
                        symbol_synced += 1
                        logger.info(f"[DIVIDEND_INSERT_DEBUG] ✅ SUCCESS: Inserted dividend for {symbol} on {dividend['ex_date']}")
                    else:
                        logger.error(f"[DIVIDEND_INSERT_DEBUG] ❌ FAILED: Could not insert dividend for {symbol} on {dividend['ex_date']}")
                        logger.error(f"[DIVIDEND_INSERT_DEBUG] Dividend data that failed: {dividend}")
                    
                    # Optional: Calculate shares for logging (but don't filter by it)
                    shares_owned = self._calculate_shares_at_date(
                        all_transactions, symbol, dividend['ex_date']
                    )
                    logger.info(f"[DividendService] Note: Users held {shares_owned} shares of {symbol} on {dividend['ex_date']}")
                
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
                function_name="_sync_dividends_for_all_holdings_impl",
                error=e,
                user_id=user_id
            )
            return {
                "success": False,
                "error": str(e)
            }

    async def background_dividend_sync_all_users(self) -> Dict[str, Any]:
        """Protected global background sync with race condition handling"""
        
        # Check if global sync can start
        if not self._can_start_global_sync():
            return {
                "success": False,
                "error": "Cannot start global sync: user syncs in progress or rate limited",
                "code": "SYNC_BLOCKED"
            }
        
        # Set global sync flag
        with self._sync_lock:
            self._global_sync_in_progress = True
            self._last_global_sync = time.time()
        
        DebugLogger.info_if_enabled("[dividend_service::background_dividend_sync_all_users] Starting protected global sync", logger)
        
        try:
            return await self._background_dividend_sync_all_users_impl()
        finally:
            with self._sync_lock:
                self._global_sync_in_progress = False
    
    async def _background_dividend_sync_all_users_impl(self) -> Dict[str, Any]:
        """Implementation of global background sync - OPTIMIZED with smart filtering"""
        try:
            # OPTIMIZATION: Check if any dividend data was recently added (within last 6 hours)
            six_hours_ago = (datetime.now() - timedelta(hours=6)).isoformat()
            
            recent_dividends = (self.supa_client.table('user_dividends')
                                .select('id')
                                .gte('created_at', six_hours_ago)
                                .is_('user_id', None)
                                .limit(1)
                                .execute())
            
            if recent_dividends.data:
                DebugLogger.info_if_enabled(f"[dividend_service] Recent dividend sync detected, limiting processing", logger)
                # Skip processing if we've synced recently
                return {
                    "success": True,
                    "total_symbols": 0,
                    "total_assigned": 0,
                    "message": "Skipped sync - recent dividend data found",
                    "optimized": True
                }
            
            unique_symbols_result = self.supa_client.table('transactions').select('symbol').execute()
            unique_symbols = list(set(row['symbol'] for row in unique_symbols_result.data if row['symbol']))
            DebugLogger.info_if_enabled(f"[dividend_service] Found {len(unique_symbols)} unique symbols across all users", logger)
            
            DebugLogger.info_if_enabled(f"[dividend_service] Starting full background sync. Found {len(unique_symbols)} unique symbols: {unique_symbols}", logger)

            total_assigned = 0
            sync_results = []
            
            for symbol in unique_symbols:
                try:
                    DebugLogger.info_if_enabled(f"[dividend_service] <<< SYNCING SYMBOL: {symbol} >>>", logger)
                    
                    dividends = await self._fetch_dividends_from_alpha_vantage(symbol)
                    DebugLogger.info_if_enabled(f"[dividend_service] Fetched {len(dividends)} dividends for {symbol}", logger)
                    
                    if not dividends:
                        DebugLogger.info_if_enabled(f"[dividend_service] No dividends found for {symbol}, skipping", logger)
                        continue
                    
                    # INSERT ALL DIVIDENDS FOR THIS SYMBOL (global approach)
                    symbol_inserted = 0
                    for dividend in dividends:
                        logger.info(f"[GLOBAL_DIVIDEND_SYNC] Processing {symbol} dividend on {dividend['ex_date']}: amount ${dividend['amount']} per share")
                        
                        # Insert dividend into global table (for ALL dividends, not user-specific)
                        inserted = await self._upsert_global_dividend(
                            symbol=symbol, dividend_data=dividend
                        )
                        
                        if inserted:
                            symbol_inserted += 1
                            total_assigned += 1
                            logger.info(f"[GLOBAL_DIVIDEND_SYNC] ✅ SUCCESS: Inserted global dividend for {symbol} on {dividend['ex_date']}")
                        else:
                            logger.info(f"[GLOBAL_DIVIDEND_SYNC] ⚠ SKIP: Dividend already exists for {symbol} on {dividend['ex_date']}")
                    
                    DebugLogger.info_if_enabled(f"[dividend_service] Inserted {symbol_inserted} new dividends for {symbol}", logger)
                    
                    sync_results.append({
                        "symbol": symbol,
                        "dividends_found": len(dividends),
                        "dividends_inserted": symbol_inserted
                    })
                    
                except Exception as e:
                    DebugLogger.log_error(file_name="dividend_service.py", function_name="background_dividend_sync_all_users", error=e, symbol=symbol, additional_info=f"Failed to sync symbol {symbol}")
                    sync_results.append({
                        "symbol": symbol,
                        "error": str(e)
                    })
                    continue
            
            # Skip the old user-by-user processing
            logger.info(f"[GLOBAL_DIVIDEND_SYNC] ✅ COMPLETED: Total {total_assigned} dividends inserted across {len(unique_symbols)} symbols")
            
            return {
                "success": True,
                "total_symbols": len(unique_symbols),
                "total_assigned": total_assigned,
                "sync_results": sync_results,
                "message": f"Global dividend sync completed: {total_assigned} dividends inserted"
            }
        
        except Exception as e:
            DebugLogger.log_error(file_name="dividend_service.py", function_name="background_dividend_sync_all_users", error=e)
            return {"success": False, "error": str(e)}
    
    async def _get_user_transactions_for_symbol(self, user_id: str, symbol: str) -> List[Dict[str, Any]]:
        DebugLogger.info_if_enabled(f"[dividend_service::_get_user_transactions_for_symbol] Fetching transactions for user {user_id} symbol {symbol}", logger)
        result = self.supa_client.table('transactions').select('*').eq('user_id', user_id).eq('symbol', symbol).order('date').execute()
        DebugLogger.info_if_enabled(f"[dividend_service] Retrieved {len(result.data)} transactions", logger)
        return result.data
    
    def _analyze_transactions(self, transactions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Analyze transactions to get per-symbol info like first transaction date."""
        holdings_info: Dict[str, Dict[str, Any]] = {}
        for txn in transactions:
            symbol = txn.get('symbol')
            if not symbol:
                continue
            date_obj = datetime.strptime(txn['date'], '%Y-%m-%d').date()
            if symbol not in holdings_info:
                holdings_info[symbol] = {'first_date': date_obj}
            elif date_obj < holdings_info[symbol]['first_date']:
                holdings_info[symbol]['first_date'] = date_obj
        return holdings_info
    
    def _compute_ownership_windows(self, transactions: List[Dict[str, Any]]) -> List[tuple[date, Optional[date]]]:
        DebugLogger.info_if_enabled(f"[dividend_service::_compute_ownership_windows] Computing windows for {len(transactions)} transactions.", logger)
        if not transactions:
            DebugLogger.info_if_enabled("[dividend_service] No transactions, returning empty windows", logger)
            return []
        
        # Sort by date ascending
        sorted_transactions = sorted(transactions, key=lambda t: datetime.strptime(t['date'], '%Y-%m-%d'))
        DebugLogger.info_if_enabled(f"[dividend_service] Sorted {len(sorted_transactions)} transactions", logger)
        
        windows = []
        current_start = None
        running_quantity = 0.0
        
        for tx in sorted_transactions:
            date_obj = datetime.strptime(tx['date'], '%Y-%m-%d').date()
            quantity_change = float(tx['quantity']) if tx['transaction_type'] in ['BUY', 'Buy'] else -float(tx['quantity'])
            prev_quantity = running_quantity
            running_quantity += quantity_change
            
            DebugLogger.info_if_enabled(f"[dividend_service] Tx on {date_obj}: {tx['transaction_type']} {quantity_change}, running={running_quantity}", logger)
            
            if prev_quantity <= 0 and running_quantity > 0:
                current_start = date_obj
                DebugLogger.info_if_enabled(f"[dividend_service] Starting new window on {date_obj}", logger)
            elif prev_quantity > 0 and running_quantity <= 0 and current_start:
                windows.append((current_start, date_obj))
                DebugLogger.info_if_enabled(f"[dividend_service] Closed window: {current_start} to {date_obj}", logger)
                current_start = None
        
        # If still holding at end
        if current_start and running_quantity > 0:
            windows.append((current_start, None))
            DebugLogger.info_if_enabled(f"[dividend_service] Added open window: {current_start} to ongoing", logger)
        
        DebugLogger.info_if_enabled(f"[dividend_service] Computed {len(windows)} ownership windows.", logger)
        return windows
    
    # Old method replaced with _upsert_global_dividend
    
    def _extract_shares_from_notes(self, notes: str) -> Optional[float]:
        """Extract shares count from notes field (format: 'Calculated: X shares × $Y per share')"""
        try:
            if not notes or 'shares' not in notes:
                return None
            
            import re
            # Match pattern: "Calculated: 123.45 shares"
            match = re.search(r'Calculated:\s*([\d.]+)\s*shares', notes)
            if match:
                return float(match.group(1))
                
            return None
        except Exception as e:
            logger.warning(f"Failed to extract shares from notes: {e}")
            return None
    
    async def get_dividends_for_user(self, user_id: str, user_token: str, confirmed_only: bool = False) -> Dict[str, Any]:
        """
        Get all dividends assigned to a specific user from the user_dividends table.
        This is called by the frontend and trusts the background sync has done the heavy lifting.
        """
        try:
            DebugLogger.info_if_enabled(f"[DividendService] Getting all assigned dividends for user {user_id} (confirmed_only={confirmed_only})", logger)

            # The logic is now much simpler: just fetch all records for this user.
            # The background sync is responsible for ensuring only eligible dividends are in this table.
            query = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('user_id', user_id) \
                .order('pay_date', desc=True)

            if confirmed_only:
                query = query.eq('confirmed', True)

            result = query.execute()

            DebugLogger.info_if_enabled(f"[DividendService] Found {len(result.data)} dividend records for user {user_id}", logger)

            # Enrich with company name for frontend convenience
            enriched_dividends = [
                {**dividend, 'company': self._get_company_name(dividend['symbol'])}
                for dividend in result.data
            ]
            
            return {
                "success": True,
                "data": enriched_dividends,
                "metadata": {
                    "timestamp": datetime.now().isoformat(),
                    "user_id": user_id,
                    "confirmed_only": confirmed_only,
                    "total_dividends": len(enriched_dividends)
                }
            }

        except Exception as e:
            DebugLogger.log_error(
                file_name="dividend_service.py",
                function_name="get_dividends_for_user",
                error=e,
                user_id=user_id
            )
            return {"success": False, "error": str(e), "data": []}
    
    async def _get_user_portfolio_symbols(self, user_id: str, user_token: str) -> List[str]:
        """Get list of symbols user currently owns or has owned"""
        try:
            from supa_api.supa_api_transactions import supa_api_get_user_transactions
            
            all_transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
            
            if not all_transactions:
                return []
            
            # Get unique symbols from user's transaction history
            symbols = list(set(txn['symbol'] for txn in all_transactions if txn.get('symbol')))
            return symbols
            
        except Exception as e:
            logger.error(f"Failed to get user portfolio symbols: {e}")
            return []
    
    async def _get_current_holdings(self, user_id: str, symbol: str, user_token: str) -> float:
        """Get user's current holdings for a symbol"""
        try:
            from supa_api.supa_api_transactions import supa_api_get_user_transactions
            
            all_transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
            
            if not all_transactions:
                return 0.0
            
            # Filter by symbol and calculate current holdings
            symbol_transactions = [txn for txn in all_transactions if txn['symbol'] == symbol]
            
            total_shares = 0.0
            for txn in symbol_transactions:
                if txn['transaction_type'] in ['BUY', 'Buy']:
                    total_shares += float(txn['quantity'])
                elif txn['transaction_type'] in ['SELL', 'Sell']:
                    total_shares -= float(txn['quantity'])
                # DIVIDEND transactions don't affect share count
            
            return max(0.0, total_shares)
            
        except Exception as e:
            logger.error(f"Failed to get current holdings for {symbol}: {e}")
            return 0.0
    
    async def _is_user_dividend_confirmed_async(self, user_id: str, dividend_id: str, symbol: str, pay_date: str) -> bool:
        """Check if user has confirmed this dividend by looking for a transaction"""
        try:
            # Look for matching dividend transaction
            existing_transaction = self.supa_client.table('transactions') \
                .select('id') \
                .eq('user_id', user_id) \
                .eq('symbol', symbol) \
                .eq('transaction_type', 'DIVIDEND') \
                .eq('date', pay_date) \
                .execute()
            
            return bool(existing_transaction.data)
            
        except Exception as e:
            logger.error(f"Failed to check dividend confirmation status: {e}")
            return False
            
    def _is_user_dividend_confirmed(self, user_id: str, dividend_id: str, user_token: str) -> bool:
        """Sync version - kept for compatibility but not used in main flow"""
        try:
            # This is a fallback sync method, but we use the async version above
            return False
        except Exception as e:
            logger.error(f"Failed to check dividend confirmation status: {e}")
            return False
    
    def _calculate_current_holdings_from_transactions(self, transactions: List[Dict[str, Any]], symbol: str) -> float:
        """Calculate current holdings from pre-loaded transactions"""
        try:
            symbol_transactions = [txn for txn in transactions if txn['symbol'] == symbol]
            
            total_shares = 0.0
            for txn in symbol_transactions:
                if txn['transaction_type'] in ['BUY', 'Buy']:
                    total_shares += float(txn['quantity'])
                elif txn['transaction_type'] in ['SELL', 'Sell']:
                    total_shares -= float(txn['quantity'])
                # DIVIDEND transactions don't affect share count
            
            return max(0.0, total_shares)
            
        except Exception as e:
            logger.error(f"Failed to calculate current holdings for {symbol}: {e}")
            return 0.0

    def _calculate_shares_at_date(self, transactions: List[Dict[str, Any]], symbol: str, target_date: str) -> float:
        """Calculate shares held at a specific date from pre-loaded transactions"""
        try:
            target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Filter transactions for this symbol that occurred on or before the target date
            symbol_transactions = [
                txn for txn in transactions 
                if txn['symbol'] == symbol and 
                datetime.strptime(str(txn['date']), '%Y-%m-%d').date() <= target_date_obj
            ]
            
            total_shares = 0.0
            for txn in symbol_transactions:
                if txn['transaction_type'] in ['BUY', 'Buy']:
                    total_shares += float(txn['quantity'])
                elif txn['transaction_type'] in ['SELL', 'Sell']:
                    total_shares -= float(txn['quantity'])
                # DIVIDEND transactions don't affect share count
            
            return max(0.0, total_shares)
            
        except Exception as e:
            logger.error(f"Failed to calculate shares at date {target_date} for {symbol}: {e}")
            return 0.0

    def _get_company_name(self, symbol: str) -> str:
        """Utility to get company name from a hardcoded list."""
        companies: Dict[str, str] = {
            'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft Corporation', 'GOOGL': 'Alphabet Inc.',
            'AMZN': 'Amazon.com Inc.', 'TSLA': 'Tesla Inc.', 'NVDA': 'NVIDIA Corporation',
            'META': 'Meta Platforms Inc.', 'SPY': 'SPDR S&P 500 ETF', 'QQQ': 'Invesco QQQ Trust',
            'VOO': 'Vanguard S&P 500 ETF', 'JEPI': 'JPMorgan Equity Premium Income ETF',
            'ORCL': 'Oracle Corporation', 'WULF': 'TeraWulf Inc.', 'BUBSF': 'Blue Solutions S.A.',
            'VTI': 'Vanguard Total Stock Market ETF', 'VXUS': 'Vanguard Total International Stock ETF'
        }
        return companies.get(symbol, f"{symbol} Corporation")

    # =============================================================================
    # NEW SIMPLE LOOP-BASED DIVIDEND ASSIGNMENT METHODS
    # =============================================================================
    
    async def assign_dividends_to_users_simple(self) -> Dict[str, Any]:
        """
        Simple loop-based dividend assignment:
        For each user holding -> For each date range -> Get dividends in range -> Assign to user
        """
        try:
            logger.info("[SIMPLE_DIVIDEND_ASSIGNMENT] ===== Starting simple dividend assignment =====")
            
            # Get all users who have transactions
            users = await self._get_users_with_transactions()
            logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Found {len(users)} users with transactions")
            
            total_assigned = 0
            assignment_results = []
            
            for user_id in users:
                try:
                    # Get user's holdings with date ranges
                    holdings = await self._get_user_holdings_with_date_ranges(user_id)
                    logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] User {user_id}: {len(holdings)} holdings")
                    
                    user_assigned = 0
                    
                    for holding in holdings:
                        symbol = holding['symbol']
                        start_date = holding['start_date']
                        end_date = holding['end_date']
                        
                        logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Processing {symbol} for user {user_id}: {start_date} to {end_date}")
                        
                        # Get all global dividends for this symbol in this date range
                        dividends = await self._get_global_dividends_in_range(symbol, start_date, end_date)
                        logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Found {len(dividends)} dividends for {symbol} in range")
                        
                        for dividend in dividends:
                            # Calculate shares owned at ex_date
                            shares_at_ex_date = await self._calculate_shares_at_date_simple(user_id, symbol, dividend['ex_date'])
                            
                            if shares_at_ex_date > 0:
                                # Create user-specific dividend record
                                success = await self._create_user_dividend_record(
                                    user_id=user_id,
                                    dividend=dividend,
                                    shares_held=shares_at_ex_date,
                                    total_amount=float(dividend['amount']) * shares_at_ex_date
                                )
                                
                                if success:
                                    user_assigned += 1
                                    total_assigned += 1
                                    logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] ✓ Assigned {symbol} dividend ({dividend['ex_date']}) to user {user_id}: {shares_at_ex_date} shares * ${dividend['amount']} = ${float(dividend['amount']) * shares_at_ex_date}")
                    
                    assignment_results.append({
                        "user_id": user_id,
                        "dividends_assigned": user_assigned
                    })
                    
                except Exception as e:
                    logger.error(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Error processing user {user_id}: {e}")
                    assignment_results.append({
                        "user_id": user_id,
                        "error": str(e)
                    })
            
            logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] ✅ COMPLETED: {total_assigned} dividends assigned to {len(users)} users")
            
            return {
                "success": True,
                "total_users": len(users),
                "total_assigned": total_assigned,
                "assignment_results": assignment_results,
                "message": f"Simple dividend assignment completed: {total_assigned} dividends assigned"
            }
            
        except Exception as e:
            logger.error(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Error: {e}")
            DebugLogger.log_error(file_name="dividend_service.py", function_name="assign_dividends_to_users_simple", error=e)
            return {"success": False, "error": str(e)}
    
    async def _get_users_with_transactions(self) -> List[str]:
        """Get all user IDs who have transactions"""
        try:
            result = self.supa_client.table('transactions') \
                .select('user_id') \
                .execute()
            
            # Get unique user IDs, filtering out None/invalid values
            user_ids = list(set([
                str(row['user_id']) for row in result.data 
                if row.get('user_id') and str(row['user_id']).lower() not in ['none', 'null', 'nan', '']
            ]))
            
            logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Found {len(user_ids)} unique users with valid transactions")
            return user_ids
            
        except Exception as e:
            logger.error(f"Error getting users with transactions: {e}")
            return []
    
    async def _get_user_holdings_with_date_ranges(self, user_id: str) -> List[Dict[str, Any]]:
        """Get user's holdings with the date ranges they owned each symbol"""
        try:
            # Get all transactions for user
            result = self.supa_client.table('transactions') \
                .select('*') \
                .eq('user_id', user_id) \
                .order('date') \
                .execute()
            
            transactions = result.data
            if not transactions:
                return []
            
            # Group by symbol and find ownership date ranges
            holdings = {}
            
            for txn in transactions:
                symbol = txn['symbol']
                txn_date = datetime.strptime(txn['date'], '%Y-%m-%d').date()
                
                if symbol not in holdings:
                    holdings[symbol] = {
                        'symbol': symbol,
                        'first_date': txn_date,
                        'last_date': txn_date,
                        'total_shares': 0
                    }
                
                # Update date range
                if txn_date < holdings[symbol]['first_date']:
                    holdings[symbol]['first_date'] = txn_date
                if txn_date > holdings[symbol]['last_date']:
                    holdings[symbol]['last_date'] = txn_date
                
                # Track total shares (to filter out symbols they never actually owned)
                if txn['transaction_type'].upper() in ['BUY', 'PURCHASE']:
                    holdings[symbol]['total_shares'] += txn['quantity']
                elif txn['transaction_type'].upper() in ['SELL', 'SALE']:
                    holdings[symbol]['total_shares'] -= txn['quantity']
            
            # Convert to list format and filter out symbols with no net ownership
            result_holdings = []
            for symbol_data in holdings.values():
                if symbol_data['total_shares'] > 0 or symbol_data['total_shares'] == 0:  # Include even if sold all shares
                    result_holdings.append({
                        'symbol': symbol_data['symbol'],
                        'start_date': symbol_data['first_date'],
                        'end_date': date.today(),  # Use today as end date for ongoing holdings
                    })
            
            logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] User {user_id} holdings: {len(result_holdings)} symbols")
            return result_holdings
            
        except Exception as e:
            logger.error(f"Error getting holdings for user {user_id}: {e}")
            return []
    
    async def _get_global_dividends_in_range(self, symbol: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """Get all global dividends for a symbol within a date range"""
        try:
            result = self.supa_client.table('user_dividends') \
                .select('*') \
                .eq('symbol', symbol) \
                .is_('user_id', None) \
                .gte('ex_date', start_date.isoformat()) \
                .lte('ex_date', end_date.isoformat()) \
                .execute()
            
            logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Found {len(result.data)} global dividends for {symbol} between {start_date} and {end_date}")
            return result.data
            
        except Exception as e:
            logger.error(f"Error getting global dividends for {symbol}: {e}")
            return []
    
    async def _calculate_shares_at_date_simple(self, user_id: str, symbol: str, target_date: str) -> float:
        """Calculate shares owned by user at a specific date (simplified version)"""
        try:
            target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
            
            # Get all transactions for this user and symbol up to the target date
            result = self.supa_client.table('transactions') \
                .select('*') \
                .eq('user_id', user_id) \
                .eq('symbol', symbol) \
                .lte('date', target_date) \
                .order('date') \
                .execute()
            
            transactions = result.data
            if not transactions:
                return 0.0
            
            total_shares = 0.0
            for txn in transactions:
                if txn['transaction_type'].upper() in ['BUY', 'PURCHASE']:
                    total_shares += float(txn['quantity'])
                elif txn['transaction_type'].upper() in ['SELL', 'SALE']:
                    total_shares -= float(txn['quantity'])
            
            logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] User {user_id} owned {total_shares} shares of {symbol} on {target_date}")
            return max(0.0, total_shares)
            
        except Exception as e:
            logger.error(f"Error calculating shares for {user_id} {symbol} at {target_date}: {e}")
            return 0.0
    
    async def _create_user_dividend_record(self, user_id: str, dividend: Dict[str, Any], shares_held: float, total_amount: float) -> bool:
        """Create a user-specific dividend record"""
        try:
            # Check if record already exists
            existing = self.supa_client.table('user_dividends') \
                .select('id') \
                .eq('user_id', user_id) \
                .eq('symbol', dividend['symbol']) \
                .eq('ex_date', dividend['ex_date']) \
                .execute()
            
            if existing.data:
                logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] User dividend already exists for {user_id} {dividend['symbol']} {dividend['ex_date']}")
                return False
            
            # Create new user-specific dividend record
            insert_data = {
                'user_id': user_id,
                'symbol': dividend['symbol'],
                'ex_date': dividend['ex_date'],
                'pay_date': dividend['pay_date'],
                'amount': float(dividend['amount']),  # Per-share amount
                'shares_held_at_ex_date': shares_held,
                'total_amount': total_amount,
                'currency': dividend.get('currency', 'USD'),
                'confirmed': False,
                'status': 'pending',
                'dividend_type': 'cash',
                'source': 'alpha_vantage',
                'declaration_date': dividend.get('declaration_date'),
                'record_date': dividend.get('record_date')
            }
            
            result = self.supa_client.table('user_dividends') \
                .insert(insert_data) \
                .execute()
            
            if result.data:
                logger.info(f"[SIMPLE_DIVIDEND_ASSIGNMENT] ✓ Created user dividend record for {user_id} {dividend['symbol']} {dividend['ex_date']}")
                return True
            else:
                logger.error(f"[SIMPLE_DIVIDEND_ASSIGNMENT] Failed to create user dividend record")
                return False
                
        except Exception as e:
            logger.error(f"Error creating user dividend record: {e}")
            return False

    async def full_dividend_sync_and_assignment(self) -> Dict[str, Any]:
        """
        Combined function for scheduled jobs: 
        1. Sync global dividends from Alpha Vantage
        2. Assign dividends to users based on holdings
        """
        try:
            logger.info("[FULL_DIVIDEND_SYNC] ===== Starting full dividend sync and assignment =====")
            
            # Step 1: Sync global dividends
            logger.info("[FULL_DIVIDEND_SYNC] Step 1: Syncing global dividends from Alpha Vantage")
            global_sync_result = await self.background_dividend_sync_all_users()
            
            # Step 2: Assign dividends to users
            logger.info("[FULL_DIVIDEND_SYNC] Step 2: Assigning dividends to users")
            assignment_result = await self.assign_dividends_to_users_simple()
            
            logger.info("[FULL_DIVIDEND_SYNC] ✅ COMPLETED: Full dividend sync and assignment")
            
            return {
                "success": True,
                "global_sync": global_sync_result,
                "assignment": assignment_result,
                "message": "Full dividend sync and assignment completed successfully"
            }
            
        except Exception as e:
            logger.error(f"[FULL_DIVIDEND_SYNC] Error: {e}")
            DebugLogger.log_error(file_name="dividend_service.py", function_name="full_dividend_sync_and_assignment", error=e)
            return {"success": False, "error": str(e)}

# Create singleton instance
dividend_service = DividendService()