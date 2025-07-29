"""
Price Manager - Unified Price Data Service
==========================================

Consolidates functionality from:
- CurrentPriceManager: Real-time quotes, historical data, portfolio updates
- PriceDataService: Database-only price reads
- MarketStatusService: Market hours, holidays, session tracking

This unified service is THE single source of truth for all price operations.
"""

import asyncio
import logging
import math
import pytz
import json
import hashlib
from datetime import datetime, date, timedelta, timezone, time
from typing import Dict, Any, List, Optional, Tuple, Set
from decimal import Decimal
import time as time_module
from zoneinfo import ZoneInfo
from collections import defaultdict
from dataclasses import dataclass

from debug_logger import DebugLogger
from supa_api.supa_api_historical_prices import supa_api_get_historical_prices, supa_api_store_historical_prices_batch, supa_api_get_historical_prices_batch,supa_api_get_prices_for_date_batch
from supa_api.supa_api_client import get_supa_service_client
from vantage_api.vantage_api_quotes import vantage_api_get_quote, vantage_api_get_daily_adjusted
from vantage_api.vantage_api_client import get_vantage_client

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Cache configuration with 15-minute TTL for market hours"""
    quote_timeout_market_open: int = 900  # 15 minutes during market hours
    quote_timeout_market_closed: int = 3600  # 1 hour when closed
    quote_timeout_weekend: int = 86400  # 24 hours on weekends
    market_info_timeout: int = 3600  # 1 hour for market info
    market_status_timeout: int = 300  # 5 minutes for market status
    

class CircuitBreaker:
    """Circuit breaker pattern for external service failures - uses database for distributed state"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.db_client = get_supa_service_client()
    
    def is_open(self, service: str) -> bool:
        """Check if circuit is open (blocking calls)"""
        try:
            result = self.db_client.rpc('check_circuit_breaker', {
                'p_service_name': service,
                'p_failure_threshold': self.failure_threshold,
                'p_recovery_timeout': self.recovery_timeout
            }).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]['is_open']
            
            # Default to closed if check fails
            return False
        except Exception as e:
            logger.error(f"Failed to check circuit breaker: {e}")
            # Fail open - allow service calls if circuit breaker check fails
            return False
    
    def record_failure(self, service: str):
        """Record service failure"""
        try:
            self.db_client.rpc('record_service_failure', {
                'p_service_name': service,
                'p_failure_threshold': self.failure_threshold
            }).execute()
            logger.warning(f"Recorded failure for service {service}")
        except Exception as e:
            logger.error(f"Failed to record service failure: {e}")
    
    def record_success(self, service: str):
        """Record service success"""
        try:
            self.db_client.rpc('record_service_success', {
                'p_service_name': service
            }).execute()
        except Exception as e:
            logger.error(f"Failed to record service success: {e}")
    
    def reset(self, service: Optional[str] = None):
        """Reset circuit breaker for a service or all services"""
        try:
            self.db_client.rpc('reset_circuit_breaker', {
                'p_service_name': service
            }).execute()
            if service:
                logger.info(f"Circuit breaker RESET for {service}")
            else:
                logger.info("Circuit breaker RESET for all services")
        except Exception as e:
            logger.error(f"Failed to reset circuit breaker: {e}")


class PriceManager:
    """
    Unified price management service consolidating all price-related operations.
    
    This service combines:
    - Real-time price quotes (Alpha Vantage integration)
    - Historical price data management
    - Market status and session tracking
    - Database price reads
    - Intelligent caching with market awareness
    - Session-aware price updates
    """
    
    # Default US market hours for indexes
    _DEFAULT_US_INDEXES = {'SPY', 'QQQ', 'VTI', 'DIA', 'IWM', 'VOO', 'VXUS', 'URTH', 'A200'}
    
    def __init__(self):
        # Core dependencies
        self.vantage_client = get_vantage_client()
        self.db_client = get_supa_service_client()
        
        # Cache configuration
        self.cache_config = CacheConfig()
        
        # Cache configuration
        self._holidays_loaded = False
        self._previous_day_cache_ttl = 3600  # 1 hour cache for previous day prices
        
        # Session ID for request-level caching
        self._session_id = None
        
        # Circuit breaker for API failures
        self._circuit_breaker = CircuitBreaker()
        logger.info("PriceManager initialized")
        
        # Session management
        self._update_locks: Dict[str, asyncio.Lock] = {}
        
        # Request-level cache configuration
        self._request_cache_enabled = False
        
        logger.info("[PriceManager] Initialized unified price management service")
    
    # ========== Request-Level Cache Management ==========
    
    def enable_request_cache(self):
        """Enable request-level caching for the current request"""
        self._request_cache_enabled = True
        # Generate a unique session ID for this request
        import uuid
        self._session_id = str(uuid.uuid4())
        logger.debug(f"[PriceManager] Request cache enabled with session {self._session_id}")
    
    def disable_request_cache(self):
        """Disable request-level caching and clear cache"""
        self._request_cache_enabled = False
        self._session_id = None
        # Note: Database cleanup handled by expiration
        logger.debug("[PriceManager] Request cache disabled")
    
    def _get_request_cache_key(self, operation: str, **kwargs) -> str:
        """Generate a cache key for request-level caching"""
        # Create a deterministic key from operation and parameters
        params_str = json.dumps(kwargs, sort_keys=True)
        return f"{operation}:{hashlib.md5(params_str.encode()).hexdigest()}"
    
    # ========== Market Status Operations (from MarketStatusService) ==========
    
    async def is_market_open(self, symbol: str, user_token: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if market is open for a symbol
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            
        Returns:
            Tuple of (is_open: bool, market_info: dict)
        """
        try:
            # Get market info for symbol
            market_info = await self.get_market_info(symbol, user_token)
            
            if not market_info:
                # No market info, assume market is open (fail-open)
                logger.warning(f"[PriceManager] No market info for {symbol}, assuming open")
                return True, {"reason": "no_market_info"}
            
            # Check if market is currently open
            is_open = await self._check_market_hours(
                market_info['market_open'],
                market_info['market_close'],
                market_info['market_timezone']
            )
            
            market_info['is_open'] = is_open
            market_info['checked_at'] = datetime.now(timezone.utc).isoformat()
            
            return is_open, market_info
            
        except Exception as e:
            logger.error(f"[PriceManager] Error checking market status for {symbol}: {e}")
            # On error, assume market is open (fail-open)
            return True, {"error": str(e), "reason": "error_fail_open"}
    
    def _get_cache_key_for_date(self, target_date: date) -> str:
        """Generate a cache key for a specific date."""
        return target_date.strftime('%Y-%m-%d')
    
    def _is_cache_valid(self, cache_timestamp: float, ttl: int) -> bool:
        """Check if cached data is still valid based on TTL."""
        return (time_module.time() - cache_timestamp) < ttl
    
    async def get_previous_day_prices(
        self,
        symbols: List[str],
        user_token: str,
        from_date: Optional[date] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get the closing prices for a list of symbols from the last trading day.
        Includes caching to minimize database calls.

        Args:
            symbols: List of stock ticker symbols.
            user_token: JWT token for database access.
            from_date: Optional date to start looking back from (defaults to today).

        Returns:
            Dictionary mapping symbols to their previous day's price data.
        """
        if not symbols:
            return {}

        last_trading_day = await self.get_last_trading_day(from_date)
        cache_key = self._get_cache_key_for_date(last_trading_day)
        
        # Check database cache first
        try:
            result = self.db_client.rpc(
                'get_previous_day_prices',
                {
                    'p_cache_date': last_trading_day,
                    'p_symbols': symbols
                }
            ).execute()
            
            if result.data:
                logger.info(f"[PRICE MANAGER] Previous day cache HIT for {last_trading_day}")
                return {row['symbol']: row['price_data'] for row in result.data}
        except Exception as e:
            logger.warning(f"[PRICE MANAGER] Failed to check previous day cache: {e}")
        
        # Cache miss or expired - fetch from database
        prices = await supa_api_get_prices_for_date_batch(
            symbols=symbols,
            target_date=last_trading_day,
            user_token=user_token
        )
        
        # Update database cache
        try:
            # Prepare batch insert data
            cache_records = []
            expires_at = (datetime.now(timezone.utc) + timedelta(seconds=self._previous_day_cache_ttl)).isoformat()
            
            for symbol, price_data in prices.items():
                cache_records.append({
                    'cache_date': last_trading_day,
                    'symbol': symbol,
                    'price_data': price_data,
                    'cached_at': datetime.now(timezone.utc).isoformat(),
                    'expires_at': expires_at
                })
            
            # Batch upsert to database
            if cache_records:
                self.db_client.table('previous_day_price_cache').upsert(cache_records).execute()
                logger.debug(f"[PRICE MANAGER] Cached {len(cache_records)} previous day prices")
        except Exception as e:
            logger.error(f"[PRICE MANAGER] Failed to cache previous day prices: {e}")
        
        return prices
    
    def _cleanup_old_cache_entries(self):
        """Remove cache entries older than 7 days - handled by database expiration."""
        # Database handles cleanup via expires_at column
        # This method is kept for compatibility but does nothing
        pass
    
    async def get_market_info(self, symbol: str, user_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get market information for a symbol from the database
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            
        Returns:
            Dict with market info or None if not found
        """
        try:
            # Check database cache first
            cache_key = f"market_info:{symbol}"
            try:
                result = self.db_client.table('market_info_cache').select(
                    'market_data'
                ).eq(
                    'symbol', symbol
                ).gte(
                    'expires_at', datetime.now(timezone.utc).isoformat()
                ).single().execute()
                
                if result.data:
                    return result.data['market_data']
            except:
                pass  # Cache miss, continue to fetch
            
            # Get market info from transactions table (which stores market data)
            result = self.db_client.table('transactions') \
                .select('symbol, market_region, market_open, market_close, market_timezone, market_currency') \
                .eq('symbol', symbol.upper()) \
                .not_.is_('market_region', 'null') \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                market_data = result.data[0]
                
                # Cache the result in database
                try:
                    self.db_client.table('market_info_cache').upsert({
                        'symbol': symbol,
                        'market_data': market_data,
                        'cached_at': datetime.now(timezone.utc).isoformat(),
                        'expires_at': (datetime.now(timezone.utc) + timedelta(seconds=self.cache_config.market_info_timeout)).isoformat()
                    }).execute()
                except Exception as e:
                    logger.warning(f"Failed to cache market info: {e}")
                
                return market_data
            
            # For known US indexes, use default values
            if symbol.upper() in self._DEFAULT_US_INDEXES:
                default_market_info = {
                    'symbol': symbol.upper(),
                    'market_region': 'United States',
                    'market_open': '09:30',
                    'market_close': '16:00',
                    'market_timezone': 'America/New_York',
                    'market_currency': 'USD'
                }
                # Cache default market info in database
                try:
                    self.db_client.table('market_info_cache').upsert({
                        'symbol': symbol,
                        'market_data': default_market_info,
                        'cached_at': datetime.now(timezone.utc).isoformat(),
                        'expires_at': (datetime.now(timezone.utc) + timedelta(seconds=self.cache_config.market_info_timeout)).isoformat()
                    }).execute()
                except Exception as e:
                    logger.warning(f"Failed to cache default market info: {e}")
                return default_market_info
            
            logger.warning(f"[PriceManager] No market info found for {symbol}")
            return None
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting market info for {symbol}: {e}")
            return None
    
    async def get_missed_sessions(self, symbol: str, last_update: datetime) -> List[date]:
        """
        Get trading sessions missed since last update
        
        Args:
            symbol: Stock ticker symbol
            last_update: Last update timestamp
            
        Returns:
            List of dates where market was open but prices weren't updated
        """
        try:
            if not self._holidays_loaded:
                await self.load_market_holidays()
            
            market_info = await self.get_market_info(symbol)
            if not market_info:
                return []
            
            # Parse timezone
            market_tz = self._parse_timezone(market_info.get('market_timezone', 'America/New_York'))
            exchange = self._get_exchange_from_timezone(market_tz)
            
            # Get current time in market timezone
            now = datetime.now(market_tz)
            start_date = last_update.date() if isinstance(last_update, datetime) else last_update
            
            logger.info(f"[DEBUG] get_missed_sessions: Checking {symbol} from {start_date} to {now.date()}")
            
            missed_sessions = []
            current_date = start_date + timedelta(days=1)
            
            while current_date <= now.date():
                # Skip weekends
                if current_date.weekday() in [5, 6]:  # Saturday, Sunday
                    current_date += timedelta(days=1)
                    continue
                
                # Skip holidays
                if self._is_holiday(current_date, exchange):
                    current_date += timedelta(days=1)
                    continue
                
                # This was a trading day we missed
                missed_sessions.append(current_date)
                current_date += timedelta(days=1)
            
            return missed_sessions
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting missed sessions for {symbol}: {e}")
            return []
    
    async def load_market_holidays(self):
        """Load market holidays from database into cache"""
        try:
            result = self.db_client.table('market_holidays') \
                .select('exchange, holiday_date') \
                .execute()
            
            if result.data:
                # Holidays are now stored in database, no need to cache in memory
                self._holidays_loaded = True
                logger.info(f"[PriceManager] Found {len(result.data)} market holidays in database")
            
        except Exception as e:
            logger.error(f"[PriceManager] Error loading market holidays: {e}")
    
    # ========== Real-time Price Operations (from CurrentPriceManager) ==========
    
    async def get_current_price_fast(self, symbol: str) -> Dict[str, Any]:
        """
        Get current price quickly without database operations or data filling
        
        Args:
            symbol: Stock ticker symbol
            
        Returns:
            Dict containing current price data and metadata
        """
        try:
            symbol = symbol.upper().strip()
            
            # Check cache first
            cache_key = f"quote_{symbol}"
            now = datetime.now(timezone.utc)
            
            # Check database cache
            cached_quote = None
            try:
                cached_quote = self.db_client.rpc(
                    'get_cached_quote',
                    {
                        'p_symbol': symbol,
                        'p_cache_key': cache_key
                    }
                ).execute()
                
                if cached_quote.data:
                    cached_data = cached_quote.data
                    cache_time = datetime.fromisoformat(cached_data.get('cached_at', now.isoformat()))
                    cached_price = float(cached_data.get('cached_price', 0))
                    age_seconds = (now - cache_time).total_seconds()
                else:
                    cached_data = None
            except Exception as e:
                logger.debug(f"Cache lookup failed: {e}")
                cached_data = None
            
            if cached_data:
                
                # Check if market is currently open
                is_market_open, market_info = await self.is_market_open(symbol)
                
                if not is_market_open:
                    # Market is closed - use cache if we have it (no matter how old)
                    return cached_data
                else:
                    # Market is open - check cache validity (15 minutes)
                    if age_seconds < self.cache_config.quote_timeout_market_open:
                        return cached_data
                    
                    # Get fresh quote
                    fresh_quote = await self._get_current_price_data(symbol)
                    
                    if fresh_quote and fresh_quote.get('price') == cached_price:
                        # Price hasn't changed, update cache timestamp
                        # Update cache timestamp in database
                        try:
                            self.db_client.rpc(
                                'set_cached_quote',
                                {
                                    'p_symbol': symbol,
                                    'p_cache_key': cache_key,
                                    'p_quote_data': cached_data,
                                    'p_cached_price': cached_price,
                                    'p_ttl_seconds': cache_timeout
                                }
                            ).execute()
                        except:
                            pass
                        return cached_data
                    elif fresh_quote:
                        # Price changed, use and cache the fresh data
                        result = {
                            "success": True,
                            "data": fresh_quote,
                            "metadata": {
                                "symbol": symbol,
                                "data_source": "alpha_vantage_quote_fast",
                                "timestamp": now.isoformat(),
                                "market_status": "open",
                                "message": "Fresh quote - price changed"
                            }
                        }
                        # Cache the fresh result in database
                        try:
                            self.db_client.rpc(
                                'set_cached_quote',
                                {
                                    'p_symbol': symbol,
                                    'p_cache_key': cache_key,
                                    'p_quote_data': result,
                                    'p_cached_price': fresh_quote.get('price'),
                                    'p_ttl_seconds': cache_timeout
                                }
                            ).execute()
                        except:
                            pass
                        return result
            
            # No cache, get fresh quote
            quote_data = await self._get_current_price_data(symbol)
            
            if not quote_data:
                return {
                    "success": False,
                    "error": "Failed to get quote",
                    "metadata": {"symbol": symbol}
                }
            
            result = {
                "success": True,
                "data": quote_data,
                "metadata": {
                    "symbol": symbol,
                    "data_source": "alpha_vantage_quote_fast",
                    "timestamp": now.isoformat(),
                    "message": "Fresh quote"
                }
            }
            
            # Cache the result in database
            try:
                # Determine appropriate cache timeout
                is_market_open, _ = await self.is_market_open(symbol)
                if is_market_open:
                    cache_timeout = self.cache_config.quote_timeout_market_open
                elif now.weekday() >= 5:  # Weekend
                    cache_timeout = self.cache_config.quote_timeout_weekend
                else:
                    cache_timeout = self.cache_config.quote_timeout_market_closed
                
                self.db_client.rpc(
                    'set_cached_quote',
                    {
                        'p_symbol': symbol,
                        'p_cache_key': cache_key,
                        'p_quote_data': result,
                        'p_cached_price': quote_data.get('price'),
                        'p_ttl_seconds': cache_timeout
                    }
                ).execute()
            except Exception as e:
                logger.warning(f"Failed to cache quote: {e}")
            
            return result
            
        except Exception as e:
            logger.error(f"[PriceManager] Error in get_current_price_fast for {symbol}: {e}")
            return {
                "success": False,
                "error": str(e),
                "metadata": {"symbol": symbol}
            }
    
    async def get_current_price(self, symbol: str, user_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Get current price with data completeness checking and gap filling
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            
        Returns:
            Dict containing current price data and metadata
        """
        try:
            symbol = symbol.upper().strip()
            
            # First ensure data is current
            await self._ensure_data_current(symbol, user_token)
            
            # Then get the current price
            result = await self.get_current_price_fast(symbol)
            
            # If we have a user token, also get the last closing price for reference
            if user_token and result.get('success'):
                last_close = await self._get_last_closing_price(symbol, user_token)
                if last_close:
                    result['data']['previous_close'] = last_close.get('close', result['data'].get('previous_close'))
            
            return result
            
        except Exception as e:
            logger.error(f"[PriceManager] Error in get_current_price for {symbol}: {e}")
            return {
                "success": False,
                "error": str(e),
                "metadata": {"symbol": symbol}
            }
    
    async def get_historical_prices(
        self,
        symbol: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        years: Optional[int] = None,
        user_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get historical prices with automatic gap filling
        
        Args:
            symbol: Stock ticker symbol
            start_date: Start date for historical data
            end_date: End date for historical data
            years: Number of years of history (alternative to start_date)
            user_token: JWT token for database access
            
        Returns:
            Dict containing historical price data and metadata
        """
        try:
            symbol = symbol.upper().strip()
            
            # Determine date range
            if not end_date:
                end_date = date.today()
            
            if years and not start_date:
                start_date = end_date - timedelta(days=years * 365)
            elif not start_date:
                start_date = end_date - timedelta(days=365)  # Default 1 year
            
            # Ensure we have data for the requested range
            await self._fill_price_gaps(symbol, start_date, end_date, user_token)
            
            # Get data from database
            historical_data = await self._get_db_historical_data(symbol, start_date, end_date, user_token)
            
            return {
                "success": True,
                "data": historical_data,
                "metadata": {
                    "symbol": symbol,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "record_count": len(historical_data),
                    "data_source": "database"
                }
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting historical prices for {symbol}: {e}")
            return {
                "success": False,
                "error": str(e),
                "metadata": {"symbol": symbol}
            }
    
    async def get_portfolio_prices(
        self,
        symbols: List[str],
        start_date: date,
        end_date: date,
        user_token: str
    ) -> Dict[str, Any]:
        """
        Get prices for multiple symbols efficiently
        
        Args:
            symbols: List of stock ticker symbols
            start_date: Start date for price data
            end_date: End date for price data
            user_token: JWT token for database access
            
        Returns:
            Dict containing price data for all symbols
        """
        try:
            results = {}
            errors = []
            
            # Process symbols in parallel batches
            batch_size = 10
            for i in range(0, len(symbols), batch_size):
                batch = symbols[i:i + batch_size]
                
                # Create tasks for batch
                tasks = []
                for symbol in batch:
                    task = self.get_historical_prices(
                        symbol=symbol,
                        start_date=start_date,
                        end_date=end_date,
                        user_token=user_token
                    )
                    tasks.append(task)
                
                # Execute batch
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for symbol, result in zip(batch, batch_results):
                    if isinstance(result, Exception):
                        errors.append(f"{symbol}: {str(result)}")
                    elif result.get('success'):
                        results[symbol] = result['data']
                    else:
                        errors.append(f"{symbol}: {result.get('error', 'Unknown error')}")
            
            return {
                "success": len(errors) == 0,
                "data": results,
                "errors": errors,
                "metadata": {
                    "symbols_requested": len(symbols),
                    "symbols_returned": len(results),
                    "date_range": f"{start_date.isoformat()} to {end_date.isoformat()}"
                }
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting portfolio prices: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {},
                "errors": [str(e)]
            }
    
    async def get_portfolio_prices_for_charts(
        self,
        symbols: List[str],
        start_date: date,
        end_date: date,
        user_token: str
    ) -> Dict[str, Any]:
        """
        Get portfolio prices optimized for charts (database only, no API calls)
        
        Args:
            symbols: List of stock ticker symbols
            start_date: Start date for price data
            end_date: End date for price data
            user_token: JWT token for database access
            
        Returns:
            Dict containing price data optimized for charting
        """
        try:
            all_prices = {}
            
            for symbol in symbols:
                # Get data from database only
                prices = await self._get_db_historical_data(symbol, start_date, end_date, user_token)
                if prices:
                    all_prices[symbol] = prices
            
            return {
                "success": True,
                "data": all_prices,
                "metadata": {
                    "symbols_count": len(symbols),
                    "data_source": "database_only",
                    "optimized_for": "charts"
                }
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting chart prices: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": {}
            }
    
    # ========== Database-Only Operations (from PriceDataService) ==========
    
    async def get_latest_price_from_db(
        self,
        symbol: str,
        user_token: str,
        max_days_back: int = 7
    ) -> Optional[Dict[str, Any]]:
        """
        Get the most recent price for a symbol from the database (no API calls)
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            max_days_back: Maximum number of days to look back for a price
            
        Returns:
            Dict with price data or None if not found
        """
        try:
            # Get prices from the last N days
            end_date = date.today()
            start_date = end_date - timedelta(days=max_days_back)
            
            historical_prices = await supa_api_get_historical_prices(
                symbol=symbol.upper(),
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            if not historical_prices:
                logger.warning(f"[PriceManager] No prices found for {symbol} in last {max_days_back} days")
                return None
            
            # Get the most recent price
            latest_price_data = max(historical_prices, key=lambda x: x['date'])
            
            return {
                'symbol': symbol.upper(),
                'price': float(latest_price_data['close']),
                'date': latest_price_data['date'],
                'volume': int(latest_price_data.get('volume', 0)),
                'open': float(latest_price_data.get('open', latest_price_data['close'])),
                'high': float(latest_price_data.get('high', latest_price_data['close'])),
                'low': float(latest_price_data.get('low', latest_price_data['close'])),
                'close': float(latest_price_data['close'])
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting latest price from DB for {symbol}: {e}")
            return None
    
    async def get_prices_for_symbols_from_db(
        self,
        symbols: List[str],
        user_token: str,
        max_days_back: int = 7
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get latest prices for multiple symbols from database (batch optimized)
        
        Args:
            symbols: List of stock ticker symbols
            user_token: JWT token for database access
            max_days_back: Maximum number of days to look back for prices
            
        Returns:
            Dict mapping symbol to price data
        """
        if not symbols:
            return {}
        
        # Check request cache if enabled
        if self._request_cache_enabled and self._session_id:
            cache_key = self._get_request_cache_key(
                "batch_prices",
                symbols=sorted(symbols),
                max_days_back=max_days_back
            )
            
            try:
                result = self.db_client.table('price_request_cache').select(
                    'result_data'
                ).eq(
                    'session_id', self._session_id
                ).eq(
                    'cache_key', cache_key
                ).gte(
                    'expires_at', datetime.now(timezone.utc).isoformat()
                ).single().execute()
                
                if result.data:
                    logger.debug(f"[PriceManager] Request cache HIT for batch prices: {len(symbols)} symbols")
                    return result.data['result_data']
            except:
                pass  # Cache miss, continue
            
        try:
            # Get prices from the last N days for all symbols in one query
            end_date = date.today()
            start_date = end_date - timedelta(days=max_days_back)
            
            # Convert symbols to uppercase
            symbols_upper = [s.upper() for s in symbols]
            
            # Batch query all symbols at once
            historical_prices = await supa_api_get_historical_prices_batch(
                symbols=symbols_upper,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            if not historical_prices:
                logger.warning(f"[PriceManager] No prices found for symbols in last {max_days_back} days")
                return {}
            
            # Group prices by symbol and find latest for each
            prices = {}
            symbol_prices = defaultdict(list)
            
            for price_data in historical_prices:
                symbol = price_data.get('symbol', '').upper()
                if symbol in symbols_upper:
                    symbol_prices[symbol].append(price_data)
            
            # Get the most recent price for each symbol
            for symbol, price_list in symbol_prices.items():
                if price_list:
                    latest_price_data = max(price_list, key=lambda x: x['date'])
                    prices[symbol] = {
                        'symbol': symbol,
                        'price': float(latest_price_data['close']),
                        'date': latest_price_data['date'],
                        'volume': int(latest_price_data.get('volume', 0)),
                        'open': float(latest_price_data.get('open', latest_price_data['close'])),
                        'high': float(latest_price_data.get('high', latest_price_data['close'])),
                        'low': float(latest_price_data.get('low', latest_price_data['close'])),
                        'close': float(latest_price_data['close'])
                    }
            
            # Log any missing symbols
            missing_symbols = set(symbols_upper) - set(prices.keys())
            if missing_symbols:
                logger.warning(f"[PriceManager] No price data for symbols: {missing_symbols}")
            
            # Store in request cache if enabled
            if self._request_cache_enabled and self._session_id:
                try:
                    self.db_client.table('price_request_cache').upsert({
                        'session_id': self._session_id,
                        'cache_key': cache_key,
                        'result_data': prices,
                        'created_at': datetime.now(timezone.utc).isoformat(),
                        'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
                    }).execute()
                    logger.debug(f"[PriceManager] Stored batch prices in request cache: {len(prices)} symbols")
                except Exception as e:
                    logger.warning(f"Failed to cache request data: {e}")
            
            return prices
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting batch prices from DB: {e}")
            # Fall back to individual queries
            return await self._get_prices_for_symbols_individually(symbols, user_token, max_days_back)
    
    async def _get_prices_for_symbols_individually(
        self,
        symbols: List[str],
        user_token: str,
        max_days_back: int = 7
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fallback method for getting prices individually
        """
        prices = {}
        
        for symbol in symbols:
            price_data = await self.get_latest_price_from_db(symbol, user_token, max_days_back)
            if price_data:
                prices[symbol] = price_data
            else:
                logger.warning(f"[PriceManager] No price data for {symbol}")
        
        return prices
    
    async def get_price_at_date(
        self,
        symbol: str,
        target_date: date,
        user_token: str,
        tolerance_days: int = 5
    ) -> Optional[Dict[str, Any]]:
        """
        Get price for a symbol at a specific date (or closest available)
        
        Args:
            symbol: Stock ticker symbol
            target_date: Date to get price for
            user_token: JWT token for database access
            tolerance_days: Number of days before target date to search
            
        Returns:
            Dict with price data or None if not found
        """
        try:
            # Search from target date back to tolerance days before
            start_date = target_date - timedelta(days=tolerance_days)
            end_date = target_date
            
            historical_prices = await supa_api_get_historical_prices(
                symbol=symbol.upper(),
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            if not historical_prices:
                logger.warning(f"[PriceManager] No prices found for {symbol} around {target_date}")
                return None
            
            # Find the price closest to target date
            closest_price = min(
                historical_prices,
                key=lambda x: abs(datetime.strptime(x['date'], '%Y-%m-%d').date() - target_date)
            )
            
            return {
                'symbol': symbol.upper(),
                'price': float(closest_price['close']),
                'date': closest_price['date'],
                'volume': int(closest_price.get('volume', 0)),
                'requested_date': target_date.isoformat(),
                'actual_date': closest_price['date']
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting price at date for {symbol}: {e}")
            return None
    
    async def get_price_history(
        self,
        symbol: str,
        start_date: date,
        end_date: date,
        user_token: str
    ) -> List[Dict[str, Any]]:
        """
        Get price history for a symbol over a date range from database
        
        Args:
            symbol: Stock ticker symbol
            start_date: Start date for history
            end_date: End date for history
            user_token: JWT token for database access
            
        Returns:
            List of price records sorted by date
        """
        try:
            historical_prices = await supa_api_get_historical_prices(
                symbol=symbol.upper(),
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            if not historical_prices:
                logger.warning(f"[PriceManager] No price history found for {symbol} from {start_date} to {end_date}")
                return []
            
            # Sort by date and format
            formatted_prices = []
            for price_data in sorted(historical_prices, key=lambda x: x['date']):
                formatted_prices.append({
                    'symbol': symbol.upper(),
                    'date': price_data['date'],
                    'open': float(price_data.get('open', price_data['close'])),
                    'high': float(price_data.get('high', price_data['close'])),
                    'low': float(price_data.get('low', price_data['close'])),
                    'close': float(price_data['close']),
                    'volume': int(price_data.get('volume', 0))
                })
            
            return formatted_prices
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting price history for {symbol}: {e}")
            return []
    
    async def has_recent_price(
        self,
        symbol: str,
        user_token: str,
        hours: int = 24
    ) -> bool:
        """
        Check if we have a recent price for a symbol
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            hours: How many hours back to consider "recent"
            
        Returns:
            True if we have a price within the specified hours
        """
        try:
            cutoff_date = datetime.now().date() - timedelta(hours=hours)
            price_data = await self.get_latest_price_from_db(
                symbol, user_token, max_days_back=hours//24 + 1
            )
            
            if not price_data:
                return False
            
            price_date = datetime.strptime(price_data['date'], '%Y-%m-%d').date()
            return price_date >= cutoff_date
            
        except Exception as e:
            logger.error(f"[PriceManager] Error checking recent price for {symbol}: {e}")
            return False
    
    # ========== Session-Aware Update Operations ==========
    
    async def update_prices_with_session_check(
        self,
        symbols: List[str],
        user_token: str,
        include_indexes: bool = True
    ) -> Dict[str, Any]:
        """
        Update prices only for missed trading sessions
        
        Args:
            symbols: List of stock ticker symbols
            user_token: JWT token for database access
            include_indexes: Whether to include index symbols
            
        Returns:
            Dict with update results and statistics
        """
        update_results = {
            "symbols_checked": len(symbols),
            "symbols_updated": 0,
            "sessions_filled": 0,
            "api_calls": 0,
            "errors": []
        }
        
        for symbol in symbols:
            try:
                # Get update lock for symbol
                if symbol not in self._update_locks:
                    self._update_locks[symbol] = asyncio.Lock()
                
                async with self._update_locks[symbol]:
                    # Check last update time
                    last_update = await self._get_last_price_date(symbol, user_token)
                    
                    if last_update:
                        # Get missed sessions since last update
                        missed_sessions = await self.get_missed_sessions(symbol, last_update)
                        
                        if missed_sessions:
                            logger.info(f"{symbol} missing {len(missed_sessions)} sessions")
                            
                            # Fill the gaps
                            start_date = min(missed_sessions)
                            end_date = max(missed_sessions)
                            
                            logger.info(f"Filling price gaps for {symbol}")
                            success = await self._fill_price_gaps(symbol, start_date, end_date, user_token)
                            
                            if success:
                                update_results["symbols_updated"] += 1
                                update_results["sessions_filled"] += len(missed_sessions)
                                update_results["api_calls"] += 1
                                logger.info(f"Successfully updated {symbol} prices")
                            else:
                                logger.error(f"Failed to update prices for {symbol}")
                                
                                # Update the log
                                await self._update_price_log(
                                    symbol=symbol,
                                    update_trigger="session_check",
                                    sessions_updated=len(missed_sessions)
                                )
                    
            except Exception as e:
                logger.error(f"[PriceManager] Error updating {symbol}: {e}")
                update_results["errors"].append(f"{symbol}: {str(e)}")
        
        return update_results
    
    async def update_user_portfolio_prices(
        self,
        user_id: str,
        user_token: str
    ) -> Dict[str, Any]:
        """
        Update prices for all symbols in a user's portfolio
        
        Args:
            user_id: User ID
            user_token: JWT token for database access
            
        Returns:
            Dict with update results
        """
        try:
            logger.info(f"[PriceManager] Starting portfolio price update for user {user_id}")
            
            # Get user's portfolio symbols using service client
            # (transactions table doesn't have RLS, so service client is appropriate)
            result = self.db_client.table('transactions') \
                .select('symbol') \
                .eq('user_id', user_id) \
                .execute()
            
            if not result.data:
                logger.info(f"[PriceManager] No transactions found for user {user_id}")
                return {
                    "success": True,
                    "message": "No symbols in portfolio",
                    "symbols_updated": 0
                }
            
            # Get unique symbols
            symbols = list(set(row['symbol'] for row in result.data if row.get('symbol')))
            logger.info(f"[PriceManager] Found {len(symbols)} unique symbols in portfolio: {symbols}")
            
            # Update prices
            update_results = await self.update_prices_with_session_check(symbols, user_token)
            logger.info(f"[PriceManager] Price update results: {update_results}")
            
            return {
                "success": True,
                "user_id": user_id,
                "portfolio_symbols": len(symbols),
                **update_results
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error updating portfolio prices for user {user_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "user_id": user_id
            }
    
    async def ensure_closing_prices(
        self,
        symbols: List[str],
        user_token: str
    ) -> Dict[str, Any]:
        """
        Ensure we have closing prices for symbols after market close
        
        Args:
            symbols: List of stock ticker symbols
            user_token: JWT token for database access
            
        Returns:
            Dict with update results
        """
        results = {
            "symbols_checked": len(symbols),
            "symbols_updated": 0,
            "errors": []
        }
        
        for symbol in symbols:
            try:
                # Check if market is closed
                is_open, market_info = await self.is_market_open(symbol)
                
                if not is_open:
                    # Get latest price date
                    last_price_date = await self._get_last_price_date(symbol, user_token)
                    
                    # If we don't have today's closing price, get it
                    if not last_price_date or last_price_date < date.today():
                        success = await self._fill_price_gaps(
                            symbol, 
                            date.today(), 
                            date.today(), 
                            user_token
                        )
                        
                        if success:
                            results["symbols_updated"] += 1
                
            except Exception as e:
                logger.error(f"[PriceManager] Error ensuring closing price for {symbol}: {e}")
                results["errors"].append(f"{symbol}: {str(e)}")
        
        return results
    
    # ========== Private Helper Methods ==========
    
    async def _check_market_hours(self, market_open: str, market_close: str, market_tz: str) -> bool:
        """Check if market is currently open based on hours and timezone"""
        try:
            # Parse timezone
            tz = self._parse_timezone(market_tz)
            
            # Get current time in market timezone
            now = datetime.now(tz)
            current_time = now.time()
            current_date = now.date()
            
            # Parse market hours
            open_time = self._parse_time(market_open)
            close_time = self._parse_time(market_close)
            
            if not open_time or not close_time:
                logger.warning(f"[PriceManager] Invalid market hours: open={market_open}, close={market_close}")
                return False
            
            # Check if it's a weekend
            if current_date.weekday() in [5, 6]:  # Saturday, Sunday
                return False
            
            # Check if it's a holiday
            exchange = self._get_exchange_from_timezone(tz)
            if self._is_holiday(current_date, exchange):
                return False
            
            # Add buffer for extended hours (30 minutes before open and after close)
            extended_open = (datetime.combine(current_date, open_time) - timedelta(minutes=30)).time()
            extended_close = (datetime.combine(current_date, close_time) + timedelta(minutes=30)).time()
            
            # Check if current time is within extended market hours
            return extended_open <= current_time <= extended_close
            
        except Exception as e:
            logger.error(f"[PriceManager] Error checking market hours: {e}")
            return False
    
    def _parse_timezone(self, tz_string: str) -> timezone:
        """Parse timezone string to timezone object"""
        try:
            # Handle common timezone strings
            tz_map = {
                'EST': 'America/New_York',
                'EDT': 'America/New_York',
                'ET': 'America/New_York',
                'CST': 'America/Chicago',
                'CDT': 'America/Chicago',
                'CT': 'America/Chicago',
                'PST': 'America/Los_Angeles',
                'PDT': 'America/Los_Angeles',
                'PT': 'America/Los_Angeles',
                'GMT': 'Europe/London',
                'BST': 'Europe/London',
                'CET': 'Europe/Berlin',
                'CEST': 'Europe/Berlin',
                'JST': 'Asia/Tokyo',
                'HKT': 'Asia/Hong_Kong',
                'SGT': 'Asia/Singapore',
                'AEDT': 'Australia/Sydney',
                'AEST': 'Australia/Sydney'
            }
            
            # Check if it's a known abbreviation
            if tz_string in tz_map:
                tz_string = tz_map[tz_string]
            
            # Try to create timezone
            return ZoneInfo(tz_string)
            
        except Exception:
            # Default to US Eastern
            logger.warning(f"[PriceManager] Unknown timezone '{tz_string}', defaulting to US Eastern")
            return ZoneInfo('America/New_York')
    
    def _parse_time(self, time_str: str) -> Optional[time]:
        """Parse time string to time object"""
        try:
            # Handle various time formats
            for fmt in ['%H:%M', '%H:%M:%S', '%I:%M %p', '%I:%M:%S %p']:
                try:
                    return datetime.strptime(time_str, fmt).time()
                except ValueError:
                    continue
            
            # If all formats fail, try a more flexible approach
            parts = time_str.replace(':', ' ').split()
            if len(parts) >= 2:
                hour = int(parts[0])
                minute = int(parts[1])
                return time(hour, minute)
            
            return None
            
        except Exception as e:
            logger.error(f"[PriceManager] Error parsing time '{time_str}': {e}")
            return None
    
    def _get_exchange_from_timezone(self, tz: timezone) -> str:
        """Get exchange name from timezone"""
        tz_name = str(tz)
        
        exchange_map = {
            'America/New_York': 'NYSE',
            'America/Chicago': 'NASDAQ',
            'America/Los_Angeles': 'NYSE',
            'Europe/London': 'LSE',
            'Europe/Berlin': 'XETRA',
            'Europe/Paris': 'EURONEXT',
            'Asia/Tokyo': 'JPX',
            'Asia/Hong_Kong': 'HKEX',
            'Asia/Singapore': 'SGX',
            'Australia/Sydney': 'ASX'
        }
        
        return exchange_map.get(tz_name, 'NYSE')
    
    def _is_holiday(self, check_date: date, exchange: str) -> bool:
        """Check if date is a market holiday"""
        try:
            result = self.db_client.rpc(
                'is_market_holiday',
                {
                    'p_exchange': exchange,
                    'p_check_date': check_date.isoformat()
                }
            ).execute()
            
            return bool(result.data) if result.data is not None else False
        except Exception as e:
            logger.warning(f"Failed to check holiday: {e}")
            return False
    
    async def _get_current_price_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get current price data from Alpha Vantage"""
        try:
            # Check circuit breaker
            if self._circuit_breaker.is_open('alpha_vantage'):
                logger.warning(f"[PriceManager] Circuit breaker open for Alpha Vantage")
                return None
            
            # Get quote from Alpha Vantage
            quote_response = await vantage_api_get_quote(symbol)
            
            if not quote_response or quote_response.get('status') != 'success':
                self._circuit_breaker.record_failure('alpha_vantage')
                return None
            
            quote_data = quote_response.get('data', {})
            
            # Validate and format the data
            price = float(quote_data.get('price', 0))
            if not self._is_valid_price(price):
                logger.warning(f"[PriceManager] Invalid price for {symbol}: {price}")
                return None
            
            self._circuit_breaker.record_success('alpha_vantage')
            
            return {
                'symbol': symbol,
                'price': price,
                'change': float(quote_data.get('change', 0)),
                'change_percent': quote_data.get('change_percent', '0%'),
                'volume': int(quote_data.get('volume', 0)),
                'latest_trading_day': quote_data.get('latest_trading_day'),
                'previous_close': float(quote_data.get('previous_close', price)),
                'open': float(quote_data.get('open', price)),
                'high': float(quote_data.get('high', price)),
                'low': float(quote_data.get('low', price))
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting current price data for {symbol}: {e}")
            self._circuit_breaker.record_failure('alpha_vantage')
            return None
    
    async def _get_last_closing_price(self, symbol: str, user_token: str) -> Optional[Dict[str, Any]]:
        """Get last closing price from database"""
        return await self.get_latest_price_from_db(symbol, user_token, max_days_back=7)
    
    async def _get_db_historical_data(
        self,
        symbol: str,
        start_date: date,
        end_date: date,
        user_token: str
    ) -> List[Dict[str, Any]]:
        """Get historical data from database"""
        try:
            historical_prices = await supa_api_get_historical_prices(
                symbol=symbol,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            if not historical_prices:
                return []
            
            # Filter out invalid prices and sort by date
            valid_prices = []
            for price_data in sorted(historical_prices, key=lambda x: x['date']):
                close_price = float(price_data.get('close', 0))
                if self._is_valid_price(close_price):
                    valid_prices.append({
                        'date': price_data['date'],
                        'open': float(price_data.get('open', close_price)),
                        'high': float(price_data.get('high', close_price)),
                        'low': float(price_data.get('low', close_price)),
                        'close': close_price,
                        'volume': int(price_data.get('volume', 0)),
                        'adjusted_close': float(price_data.get('adjusted_close', close_price))
                    })
            
            return valid_prices
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting DB historical data for {symbol}: {e}")
            return []
    
    def _is_valid_price(self, price: Any) -> bool:
        """Check if a price value is valid"""
        try:
            price_float = float(price)
            return price_float > 0 and not math.isnan(price_float) and not math.isinf(price_float)
        except (ValueError, TypeError):
            return False
    
    async def _ensure_data_current(self, symbol: str, user_token: Optional[str]) -> bool:
        """Ensure price data is current, filling gaps if needed"""
        try:
            if not user_token:
                return True  # Can't check without token
            
            # Get last price date
            last_date = await self._get_last_price_date(symbol, user_token)
            
            if not last_date:
                # No data at all, try to get last 30 days
                end_date = date.today()
                start_date = end_date - timedelta(days=30)
                await self._fill_price_gaps(symbol, start_date, end_date, user_token)
            else:
                # Check if we need to update
                today = date.today()
                if last_date < today:
                    # Fill gaps from last date to today
                    await self._fill_price_gaps(symbol, last_date + timedelta(days=1), today, user_token)
            
            return True
            
        except Exception as e:
            logger.error(f"[PriceManager] Error ensuring data current for {symbol}: {e}")
            return False
    
    async def _get_last_price_date(self, symbol: str, user_token: str) -> Optional[date]:
        """Get the date of the last price in database"""
        try:
            latest_price = await self.get_latest_price_from_db(symbol, user_token, max_days_back=30)
            
            if latest_price and 'date' in latest_price:
                return datetime.strptime(latest_price['date'], '%Y-%m-%d').date()
            
            return None
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting last price date for {symbol}: {e}")
            return None
    
    async def _fill_price_gaps(
        self,
        symbol: str,
        start_date: date,
        end_date: date,
        user_token: str
    ) -> bool:
        """Fill missing price data from Alpha Vantage"""
        try:
            # Check circuit breaker
            if self._circuit_breaker.is_open('alpha_vantage'):
                logger.warning(f"Circuit breaker open, skipping gap fill for {symbol}")
                return False
            
            # Get daily adjusted prices from Alpha Vantage
            # Get daily adjusted prices from Alpha Vantage
            daily_response = await vantage_api_get_daily_adjusted(symbol)
            
            if not daily_response or daily_response.get('status') != 'success':
                logger.error(f"Alpha Vantage API failed for {symbol}")
                self._circuit_breaker.record_failure('alpha_vantage')
                return False
            
            time_series = daily_response.get('data', {})
            if not time_series:
                logger.error(f"No time series data in response for {symbol}")
                return False
            
            # Process time series data
            
            # Filter and prepare data for the requested date range
            
            # Filter and prepare data for the requested date range
            price_records = []
            records_in_range = 0
            for date_str, day_data in time_series.items():
                try:
                    price_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
                    if start_date <= price_date <= end_date:
                        records_in_range += 1
                        
                        # Extract price data from Alpha Vantage format
                        if isinstance(day_data, dict):
                            # Alpha Vantage returns keys like '5. adjusted close' and '4. close'
                            close_price = float(day_data.get('5. adjusted close', day_data.get('4. close', 0)))
                        else:
                            # If day_data is not a dict, it might be the price value directly
                            logger.error(f"Unexpected data type for {date_str}: {type(day_data)}")
                            continue
                        
                        if not self._is_valid_price(close_price):
                            logger.warning(f"Invalid price for {symbol} on {date_str}: {close_price}")
                        else:
                            price_records.append({
                                'symbol': symbol,
                                'date': date_str,
                                'open': float(day_data.get('1. open', close_price)),
                                'high': float(day_data.get('2. high', close_price)),
                                'low': float(day_data.get('3. low', close_price)),
                                'close': float(day_data.get('4. close', close_price)),
                                'adjusted_close': close_price,
                                'volume': int(day_data.get('6. volume', 0)),
                                'dividend_amount': float(day_data.get('7. dividend amount', 0)),
                                'split_coefficient': float(day_data.get('8. split coefficient', 1))
                            })
                except (ValueError, KeyError) as e:
                    logger.warning(f"[PriceManager] Skipping invalid data for {symbol} on {date_str}: {e}")
                    continue
            
            # Store valid price records
            
            # Store in database if we have records
            if price_records:
                await supa_api_store_historical_prices_batch(price_records)
                logger.info(f"Stored {len(price_records)} price records for {symbol}")
                self._circuit_breaker.record_success('alpha_vantage')
                return True
            else:
                logger.warning(f"No valid price records to store for {symbol}")
            
            return False
            
        except Exception as e:
            logger.error(f"[PriceManager] Error filling price gaps for {symbol}: {e}")
            self._circuit_breaker.record_failure('alpha_vantage')
            return False
    
    async def _update_price_log(
        self,
        symbol: str,
        update_trigger: str,
        sessions_updated: int
    ) -> None:
        """Update price update log"""
        try:
            log_entry = {
                'symbol': symbol,
                'update_trigger': update_trigger,
                'sessions_updated': sessions_updated,
                'api_calls_made': 1,  # Correct column name
                'last_update_time': datetime.now(timezone.utc).isoformat(),
                'last_session_date': date.today().isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Use upsert to update existing entry or insert new one
            self.db_client.table('price_update_log').upsert(
                log_entry,
                on_conflict='symbol'  # Update if symbol already exists
            ).execute()
            
        except Exception as e:
            logger.error(f"[PriceManager] Failed to update price log: {e}")
            # Re-raise because this is a real error that needs fixing
            raise
    
    # ========== Additional Market Status Methods ==========
    
    async def get_last_trading_day(self, from_date: Optional[date] = None) -> date:
        """Get the most recent trading day"""
        if not from_date:
            from_date = date.today()
        
        current = from_date
        while current.weekday() in [5, 6] or self._is_holiday(current, 'NYSE'):
            current -= timedelta(days=1)
        
        return current
    
    async def get_next_trading_day(self, from_date: Optional[date] = None) -> date:
        """Get the next trading day"""
        if not from_date:
            from_date = date.today()
        
        current = from_date + timedelta(days=1)
        while current.weekday() in [5, 6] or self._is_holiday(current, 'NYSE'):
            current += timedelta(days=1)
        
        return current
    
    async def clear_cache(self):
        """Clear all caches"""
        try:
            self.db_client.rpc('cleanup_expired_price_caches').execute()
            logger.info("[PriceManager] Database caches cleaned up")
        except Exception as e:
            logger.error(f"[PriceManager] Failed to clear caches: {e}")
    
    async def get_market_status(self, symbol: str = "SPY") -> Dict[str, Any]:
        """
        Get current market status including open/closed state and session info
        
        Args:
            symbol: Stock symbol to check market status for (default: SPY for US market)
            
        Returns:
            Dict with market status information:
            {
                "is_open": bool,
                "session": str,  # "pre", "regular", "after", "closed"
                "next_open": str (ISO datetime),
                "next_close": str (ISO datetime),
                "timezone": str
            }
        """
        try:
            # Use existing is_market_open method
            is_open, market_info = await self.is_market_open(symbol)
            
            # Get market hours from market_info
            market_tz = market_info.get("timezone", "America/New_York")
            tz = ZoneInfo(market_tz)
            now = datetime.now(tz)
            
            # Determine session type
            session = "closed"
            if is_open:
                # Check if in extended hours
                market_open = datetime.strptime(market_info.get("market_open", "09:30"), "%H:%M").time()
                market_close = datetime.strptime(market_info.get("market_close", "16:00"), "%H:%M").time()
                extended_open = datetime.strptime(market_info.get("extended_open", "04:00"), "%H:%M").time()
                extended_close = datetime.strptime(market_info.get("extended_close", "20:00"), "%H:%M").time()
                
                current_time = now.time()
                
                if extended_open <= current_time < market_open:
                    session = "pre"
                elif market_open <= current_time < market_close:
                    session = "regular"
                elif market_close <= current_time <= extended_close:
                    session = "after"
            
            # Calculate next open/close times
            next_open = None
            next_close = None
            
            if is_open:
                # Market is open, next close is today
                close_time = datetime.strptime(market_info.get("market_close", "16:00"), "%H:%M").time()
                next_close = now.replace(hour=close_time.hour, minute=close_time.minute, second=0, microsecond=0)
                
                # Next open is tomorrow
                next_trading_day = await self.get_next_trading_day(now.date())
                open_time = datetime.strptime(market_info.get("market_open", "09:30"), "%H:%M").time()
                next_open = datetime.combine(next_trading_day, open_time).replace(tzinfo=tz)
            else:
                # Market is closed
                if now.weekday() >= 5:  # Weekend
                    # Next open is Monday
                    next_trading_day = await self.get_next_trading_day(now.date())
                    open_time = datetime.strptime(market_info.get("market_open", "09:30"), "%H:%M").time()
                    next_open = datetime.combine(next_trading_day, open_time).replace(tzinfo=tz)
                    
                    # Next close is also Monday
                    close_time = datetime.strptime(market_info.get("market_close", "16:00"), "%H:%M").time()
                    next_close = datetime.combine(next_trading_day, close_time).replace(tzinfo=tz)
                else:
                    # Weekday after hours
                    current_time = now.time()
                    close_time = datetime.strptime(market_info.get("market_close", "16:00"), "%H:%M").time()
                    
                    if current_time > close_time:
                        # After close, next open is tomorrow
                        next_trading_day = await self.get_next_trading_day(now.date())
                        open_time = datetime.strptime(market_info.get("market_open", "09:30"), "%H:%M").time()
                        next_open = datetime.combine(next_trading_day, open_time).replace(tzinfo=tz)
                        
                        close_time = datetime.strptime(market_info.get("market_close", "16:00"), "%H:%M").time()
                        next_close = datetime.combine(next_trading_day, close_time).replace(tzinfo=tz)
                    else:
                        # Before open, next open is today
                        open_time = datetime.strptime(market_info.get("market_open", "09:30"), "%H:%M").time()
                        next_open = now.replace(hour=open_time.hour, minute=open_time.minute, second=0, microsecond=0)
                        
                        close_time = datetime.strptime(market_info.get("market_close", "16:00"), "%H:%M").time()
                        next_close = now.replace(hour=close_time.hour, minute=close_time.minute, second=0, microsecond=0)
            
            return {
                "is_open": is_open,
                "session": session,
                "next_open": next_open.isoformat() if next_open else None,
                "next_close": next_close.isoformat() if next_close else None,
                "timezone": market_tz
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting market status: {str(e)}")
            # Return default closed status on error
            return {
                "is_open": False,
                "session": "closed",
                "next_open": None,
                "next_close": None,
                "timezone": "America/New_York"
            }
    
    # ========== Dividend Operations ==========
    
    async def get_dividend_history(
        self,
        symbol: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        user_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get dividend history for a symbol with caching and fallback to Alpha Vantage
        
        Args:
            symbol: Stock ticker symbol
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            user_token: JWT token for database access
            
        Returns:
            Dict containing dividend history data
        """
        try:
            # Check circuit breaker
            if self._circuit_breaker.is_open("dividend_api"):
                logger.warning(f"[PriceManager] Circuit breaker open for dividend API")
                return {
                    "success": False,
                    "error": "Dividend API temporarily unavailable",
                    "data": []
                }
            
            # Skip database lookup since dividend_history table doesn't exist
            # Go directly to API fetch
            
            # Fetch from Alpha Vantage
            try:
                api_dividends = await self._fetch_dividends_from_alpha_vantage(symbol)
                
                if api_dividends:
                    # Filter by date range if specified
                    filtered = self._filter_dividends_by_date(api_dividends, start_date, end_date)
                    
                    self._circuit_breaker.record_success("dividend_api")
                    return {
                        "success": True,
                        "data": filtered,
                        "source": "alpha_vantage"
                    }
                else:
                    # Return database data even if potentially stale
                    return {
                        "success": True,
                        "data": db_dividends or [],
                        "source": "database",
                        "warning": "Using cached data, API returned no results"
                    }
                    
            except Exception as api_error:
                self._circuit_breaker.record_failure("dividend_api")
                logger.error(f"[PriceManager] Alpha Vantage dividend fetch failed: {api_error}")
                
                # Return database data as fallback
                return {
                    "success": True,
                    "data": db_dividends or [],
                    "source": "database",
                    "warning": f"Using cached data due to API error: {str(api_error)}"
                }
                
        except Exception as e:
            logger.error(f"[PriceManager] Error getting dividend history: {e}")
            return {
                "success": False,
                "error": str(e),
                "data": []
            }
    
    async def get_portfolio_dividends(
        self,
        symbols: List[str],
        start_date: Optional[date] = None,
        user_token: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get dividend history for multiple symbols efficiently
        
        Args:
            symbols: List of stock ticker symbols
            start_date: Optional start date for filtering
            user_token: JWT token for database access
            
        Returns:
            Dict mapping symbols to their dividend histories
        """
        try:
            results = {}
            errors = []
            
            # Process symbols in parallel batches
            batch_size = 10
            for i in range(0, len(symbols), batch_size):
                batch = symbols[i:i + batch_size]
                
                # Create tasks for batch
                tasks = []
                for symbol in batch:
                    task = self.get_dividend_history(symbol, start_date, None, user_token)
                    tasks.append(task)
                
                # Execute batch in parallel
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for symbol, result in zip(batch, batch_results):
                    if isinstance(result, Exception):
                        errors.append(f"{symbol}: {str(result)}")
                        results[symbol] = []
                    elif result.get("success"):
                        results[symbol] = result.get("data", [])
                    else:
                        errors.append(f"{symbol}: {result.get('error', 'Unknown error')}")
                        results[symbol] = []
            
            return {
                "success": len(errors) == 0,
                "data": results,
                "errors": errors if errors else None
            }
            
        except Exception as e:
            logger.error(f"[PriceManager] Error getting portfolio dividends: {e}")
            return {
                "success": False,
                "data": {},
                "errors": [str(e)]
            }
    
    # Removed _get_db_dividend_history - dividend_history table doesn't exist
    
    async def _fetch_dividends_from_alpha_vantage(self, symbol: str) -> List[Dict[str, Any]]:
        """Fetch dividend history from Alpha Vantage"""
        from vantage_api.vantage_api_financials import vantage_api_get_dividends
        
        try:
            # Get dividend data from Alpha Vantage
            response = await vantage_api_get_dividends(symbol)
            
            if response and "data" in response:
                return response["data"]
            
            return []
            
        except Exception as e:
            logger.error(f"[PriceManager] Alpha Vantage dividend API error for {symbol}: {e}")
            raise
    
    # Removed _store_dividend_history - dividend_history table doesn't exist
    
    # Removed _has_recent_dividend_data - not needed without dividend_history table
    
    async def prefetch_user_symbols(self, user_id: str, user_token: str) -> int:
        """Prefetch all prices for user's holdings to warm the cache
        
        Args:
            user_id: User's UUID (required)
            user_token: JWT token (required)
            
        Returns:
            Number of symbols prefetched
        """
        # Type assertions
        if not user_id:
            raise ValueError("user_id cannot be empty")
        if not user_token:
            raise ValueError("user_token cannot be empty")
            
        try:
            # Get user's symbols
            from supa_api.supa_api_portfolio import supa_api_get_user_symbols
            symbols = await supa_api_get_user_symbols(user_id, user_token)
            
            # Type check
            if not isinstance(symbols, list):
                logger.error(f"Expected list from supa_api_get_user_symbols, got {type(symbols)}")
                return 0
            
            if symbols:
                # Use existing batch method to fetch all prices
                await self.get_portfolio_prices(symbols, user_token)
                logger.info(f"[PriceManager] Prefetched {len(symbols)} symbols for user {user_id}")
                return len(symbols)
            
            return 0
            
        except Exception as e:
            logger.warning(f"[PriceManager] Prefetch failed for user {user_id}: {e}")
            return 0
    
    def _filter_dividends_by_date(
        self,
        dividends: List[Dict[str, Any]],
        start_date: Optional[date],
        end_date: Optional[date]
    ) -> List[Dict[str, Any]]:
        """Filter dividends by date range"""
        if not start_date and not end_date:
            return dividends
        
        filtered = []
        for dividend in dividends:
            try:
                ex_date_str = dividend.get("ex_dividend_date") or dividend.get("ex_date")
                if not ex_date_str:
                    continue
                
                ex_date = datetime.strptime(ex_date_str, "%Y-%m-%d").date()
                
                if start_date and ex_date < start_date:
                    continue
                if end_date and ex_date > end_date:
                    continue
                
                filtered.append(dividend)
                
            except:
                continue
        
        return filtered
    
    def reset_circuit_breaker(self, service: Optional[str] = None):
        """Reset circuit breaker for Alpha Vantage or all services
        
        Args:
            service: Specific service to reset ('alpha_vantage', 'dividend_api') or None for all
        """
        self._circuit_breaker.reset(service)
        if service:
            logger.info(f"[PriceManager] Circuit breaker reset for {service}")
        else:
            logger.info("[PriceManager] Circuit breaker reset for all services")


# Create singleton instance
price_manager = PriceManager()