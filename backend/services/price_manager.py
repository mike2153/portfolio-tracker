"""
Simplified Price Manager - Essential EOD Price Management Service
===============================================================

This simplified service provides only the essential functionality for End-of-Day (EOD) price management:
1. Get latest prices from database
2. Get historical price data for charts
3. Update EOD prices via Alpha Vantage
4. Get prices for multiple symbols (batch operations)

All complex caching, real-time quotes, and market status functionality has been removed.
"""

import logging
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional
from decimal import Decimal, InvalidOperation

from supa_api.supa_api_historical_prices import supa_api_get_historical_prices_batch, supa_api_store_historical_prices_batch
from supa_api.supa_api_client import get_supa_service_client
from vantage_api.vantage_api_quotes import vantage_api_get_daily_adjusted

logger = logging.getLogger(__name__)


class SimplifiedPriceManager:
    """
    Simplified price management service focused on essential EOD operations.
    
    Core responsibilities:
    - Fetch latest prices from database for portfolio calculations
    - Retrieve historical price data for chart generation
    - Update EOD prices when needed via Alpha Vantage API
    - Handle batch operations for multiple symbols efficiently
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the price manager (singleton pattern)"""
        if not self._initialized:
            self.db_client = get_supa_service_client()
            self._initialized = True
            logger.info("SimplifiedPriceManager initialized")
    
    async def get_latest_prices(
        self,
        symbols: List[str],
        user_token: str,
        max_days_back: int = 7
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get the most recent prices for multiple symbols from database.
        
        Args:
            symbols: List of stock ticker symbols
            user_token: JWT token for database access
            max_days_back: Maximum number of days to look back for prices
            
        Returns:
            Dict mapping symbol to price data: {symbol: {price, date, open, high, low, close, volume}}
        """
        if not symbols:
            return {}
        
        try:
            # Get prices from the last N days for all symbols
            end_date = date.today()
            start_date = end_date - timedelta(days=max_days_back)
            
            # Convert symbols to uppercase
            symbols_upper = [s.upper() for s in symbols]
            
            # Batch query all symbols
            historical_prices = await supa_api_get_historical_prices_batch(
                symbols=symbols_upper,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            if not historical_prices:
                logger.warning(f"No prices found for symbols in last {max_days_back} days")
                return {}
            
            # Group prices by symbol and find latest for each
            prices = {}
            symbol_prices = {}
            
            # Group by symbol
            for price_data in historical_prices:
                symbol = price_data.get('symbol')
                if not symbol:
                    continue
                symbol = symbol.upper()
                if symbol in symbols_upper:
                    if symbol not in symbol_prices:
                        symbol_prices[symbol] = []
                    symbol_prices[symbol].append(price_data)
            
            # Get the most recent price for each symbol
            for symbol, price_list in symbol_prices.items():
                if price_list:
                    latest_price_data = max(price_list, key=lambda x: x['date'])
                    
                    prices[symbol] = {
                        'symbol': symbol,
                        'price': self._safe_decimal_conversion(latest_price_data['close']),
                        'date': latest_price_data['date'],
                        'volume': self._safe_decimal_conversion(latest_price_data.get('volume', 0)),
                        'open': self._safe_decimal_conversion(latest_price_data.get('open', latest_price_data['close'])),
                        'high': self._safe_decimal_conversion(latest_price_data.get('high', latest_price_data['close'])),
                        'low': self._safe_decimal_conversion(latest_price_data.get('low', latest_price_data['close'])),
                        'close': self._safe_decimal_conversion(latest_price_data['close']),
                        'previous_close': self._safe_decimal_conversion(
                            latest_price_data.get('previous_close', latest_price_data['close'])
                        )
                    }
            
            # Log missing symbols
            missing_symbols = set(symbols_upper) - set(prices.keys())
            if missing_symbols:
                logger.warning(f"No price data found for symbols: {missing_symbols}")
            
            return prices
            
        except Exception as e:
            logger.error(f"Error getting latest prices: {e}")
            return {}
    
    async def get_prices_for_symbols_from_db(
        self,
        symbols: List[str],
        user_token: str
    ) -> Dict[str, Dict[str, Any]]:
        """
        Alias for get_latest_prices to maintain compatibility.
        Fetches the latest prices for given symbols from the database.
        """
        return await self.get_latest_prices(symbols, user_token)
    
    async def get_portfolio_prices(
        self,
        symbols: List[str],
        start_date: date,
        end_date: date,
        user_token: str
    ) -> Dict[str, Any]:
        """
        Get portfolio prices for given symbols and date range.
        Returns a dict with success status and prices.
        """
        try:
            prices = await self.get_historical_prices(symbols, start_date, end_date, user_token)
            return {
                'success': True,
                'prices': prices
            }
        except Exception as e:
            logger.error(f"Error getting portfolio prices: {e}")
            return {
                'success': False,
                'prices': {},
                'error': str(e)
            }
    
    async def get_historical_prices(
        self,
        symbols: List[str],
        start_date: date,
        end_date: date,
        user_token: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get historical price data for multiple symbols (optimized for charts).
        
        Args:
            symbols: List of stock ticker symbols
            start_date: Start date for price data
            end_date: End date for price data
            user_token: JWT token for database access
            
        Returns:
            Dict mapping symbol to list of price records: {symbol: [{date, open, high, low, close, volume}, ...]}
        """
        if not symbols:
            return {}
        
        try:
            # Convert symbols to uppercase
            symbols_upper = [s.upper() for s in symbols]
            
            # Batch query all symbols for the date range
            historical_prices = await supa_api_get_historical_prices_batch(
                symbols=symbols_upper,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            if not historical_prices:
                logger.warning(f"No historical prices found for date range {start_date} to {end_date}")
                return {}
            
            # Group prices by symbol
            symbol_prices = {}
            for price_data in historical_prices:
                symbol = price_data.get('symbol')
                if not symbol:
                    continue
                symbol = symbol.upper()
                if symbol in symbols_upper:
                    if symbol not in symbol_prices:
                        symbol_prices[symbol] = []
                    
                    # Format price record
                    symbol_prices[symbol].append({
                        'date': price_data['date'],
                        'open': self._safe_decimal_conversion(price_data.get('open', price_data['close'])),
                        'high': self._safe_decimal_conversion(price_data.get('high', price_data['close'])),
                        'low': self._safe_decimal_conversion(price_data.get('low', price_data['close'])),
                        'close': self._safe_decimal_conversion(price_data['close']),
                        'volume': self._safe_decimal_conversion(price_data.get('volume', 0)),
                        'adjusted_close': self._safe_decimal_conversion(price_data.get('adjusted_close', price_data['close']))
                    })
            
            # Sort each symbol's prices by date
            for symbol in symbol_prices:
                symbol_prices[symbol].sort(key=lambda x: x['date'])
            
            return symbol_prices
            
        except Exception as e:
            logger.error(f"Error getting historical prices: {e}")
            return {}
    
    async def update_eod_prices(
        self,
        symbols: Optional[List[str]] = None,
        target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Update End-of-Day prices for symbols via Alpha Vantage API.
        If no symbols provided, fetches all symbols from transactions and watchlists.
        
        Args:
            symbols: Optional list of stock ticker symbols to update (fetches all if None)
            target_date: Specific date to update (defaults to today)
            
        Returns:
            Dict with update results: {success: bool, updated: int, failed: int, errors: [str]}
        """
        # If no symbols provided, fetch all symbols from database
        if symbols is None:
            try:
                # Get all unique symbols from transactions
                transactions_response = self.db_client.table('transactions')\
                    .select('symbol')\
                    .execute()
                
                transaction_symbols = set(
                    t['symbol'].upper() for t in transactions_response.data 
                    if t.get('symbol')
                )
                
                # Try to get symbols from watchlists if table exists
                watchlist_symbols = set()
                try:
                    watchlist_response = self.db_client.table('watchlists')\
                        .select('symbol')\
                        .execute()
                    
                    watchlist_symbols = set(
                        w['symbol'].upper() for w in watchlist_response.data 
                        if w.get('symbol')
                    )
                except Exception as e:
                    # Watchlists table might not exist
                    logger.debug(f"[PriceManager] Could not fetch watchlist symbols: {e}")
                
                # Combine all unique symbols
                symbols = list(transaction_symbols | watchlist_symbols)
                logger.info(f"[PriceManager] Found {len(symbols)} unique symbols to update")
                
            except Exception as e:
                logger.error(f"[PriceManager] Failed to fetch symbols from database: {e}")
                return {
                    "success": False, 
                    "error": f"Failed to fetch symbols: {str(e)}",
                    "updated": 0,
                    "failed": 0
                }
        
        if not symbols:
            logger.info("[PriceManager] No symbols to update")
            return {"success": True, "updated": 0, "failed": 0, "errors": []}
        
        if not target_date:
            target_date = date.today()
        
        results = {
            "success": True,
            "updated": 0,
            "failed": 0,
            "errors": []
        }
        
        for symbol in symbols:
            try:
                symbol = symbol.upper().strip()
                
                # Get daily adjusted prices from Alpha Vantage
                daily_response = await vantage_api_get_daily_adjusted(symbol)
                
                if not daily_response or daily_response.get('status') != 'success':
                    error_msg = f"{symbol}: Alpha Vantage API failed"
                    logger.error(error_msg)
                    results["errors"].append(error_msg)
                    results["failed"] += 1
                    continue
                
                time_series = daily_response.get('data', {})
                if not time_series:
                    error_msg = f"{symbol}: No time series data received"
                    logger.error(error_msg)
                    results["errors"].append(error_msg)
                    results["failed"] += 1
                    continue
                
                # Find price data for target date
                target_date_str = target_date.isoformat()
                if target_date_str not in time_series:
                    # Try to find the most recent available date
                    available_dates = sorted(time_series.keys(), reverse=True)
                    if available_dates:
                        target_date_str = available_dates[0]
                        logger.info(f"{symbol}: Using most recent date {target_date_str} instead of {target_date}")
                    else:
                        error_msg = f"{symbol}: No price data available"
                        logger.error(error_msg)
                        results["errors"].append(error_msg)
                        results["failed"] += 1
                        continue
                
                day_data = time_series[target_date_str]
                
                # Extract and validate price data
                try:
                    close_price = self._safe_decimal_conversion(
                        day_data.get('5. adjusted close', day_data.get('4. close', '0'))
                    )
                    
                    if not self._is_valid_price(close_price):
                        error_msg = f"{symbol}: Invalid price data {close_price}"
                        logger.error(error_msg)
                        results["errors"].append(error_msg)
                        continue
                    
                    # Prepare price record
                    price_record = {
                        'symbol': symbol,
                        'date': target_date_str,
                        'open': self._safe_decimal_conversion(day_data.get('1. open', close_price)),
                        'high': self._safe_decimal_conversion(day_data.get('2. high', close_price)),
                        'low': self._safe_decimal_conversion(day_data.get('3. low', close_price)),
                        'close': self._safe_decimal_conversion(day_data.get('4. close', close_price)),
                        'adjusted_close': close_price,
                        'volume': int(day_data.get('6. volume', 0)),
                        'dividend_amount': self._safe_decimal_conversion(day_data.get('7. dividend amount', '0')),
                        'split_coefficient': self._safe_decimal_conversion(day_data.get('8. split coefficient', '1'))
                    }
                    
                    # Store in database
                    await supa_api_store_historical_prices_batch([price_record])
                    results["updated"] += 1
                    logger.info(f"Updated EOD price for {symbol} on {target_date_str}")
                    
                except (ValueError, InvalidOperation) as e:
                    error_msg = f"{symbol}: Price data conversion error - {e}"
                    logger.error(error_msg)
                    results["errors"].append(error_msg)
                    results["failed"] += 1
                    continue
                
            except Exception as e:
                error_msg = f"{symbol}: Update failed - {e}"
                logger.error(error_msg)
                results["errors"].append(error_msg)
                results["failed"] += 1
                continue
        
        # Set overall success based on whether any updates succeeded
        results["success"] = results["updated"] > 0 or (results["updated"] == 0 and results["failed"] == 0)
        
        return results

    async def update_prices_with_session_check(
        self,
        symbols: List[str],
        user_token: Optional[str] = None,
        include_indexes: bool = False
    ) -> Dict[str, Any]:
        """
        Compatibility wrapper for previous price manager API.
        In this simplified implementation, we just call update_eod_prices.
        """
        try:
            result = await self.update_eod_prices(symbols=symbols)
            # Normalize structure to what callers expect in logs
            return {
                "success": result.get("success", False),
                "data": {
                    "updated": result.get("updated", 0),
                    "failed": result.get("failed", 0),
                    "errors": result.get("errors", []),
                    "sessions_filled": result.get("updated", 0)
                }
            }
        except Exception as e:
            logger.error(f"[PriceManager] update_prices_with_session_check failed: {e}")
            return {"success": False, "data": {"updated": 0, "failed": 0, "errors": [str(e)], "sessions_filled": 0}}
    
    async def get_user_portfolio_prices(
        self,
        user_id: str,
        user_token: str,
        max_days_back: int = 7
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get latest prices for all symbols in a user's portfolio.
        
        Args:
            user_id: User ID to get portfolio symbols for
            user_token: JWT token for database access
            max_days_back: Maximum days to look back for prices
            
        Returns:
            Dict mapping symbol to price data
        """
        try:
            # Get user's portfolio symbols
            result = self.db_client.table('transactions') \
                .select('symbol') \
                .eq('user_id', user_id) \
                .execute()
            
            if not result.data:
                logger.info(f"No transactions found for user {user_id}")
                return {}
            
            # Get unique symbols
            symbols = list(set(row['symbol'] for row in result.data if row.get('symbol')))
            
            if not symbols:
                return {}
            
            # Get latest prices for all symbols
            return await self.get_latest_prices(symbols, user_token, max_days_back)
            
        except Exception as e:
            logger.error(f"Error getting user portfolio prices: {e}")
            return {}

    async def get_market_status(self) -> Dict[str, Any]:
        """
        Compatibility method expected by PortfolioMetricsManager.
        This simplified manager does not track live sessions. Return a safe default.
        """
        now = datetime.now(timezone.utc)
        # Assume market closed; callers handle closed gracefully
        return {
            "is_open": False,
            "session": "closed",
            "next_open": None,
            "next_close": None,
            "timezone": "America/New_York",
            "as_of": now.isoformat()
        }
    
    def _safe_decimal_conversion(self, value: Any) -> Decimal:
        """
        Safely convert any value to Decimal with error handling.
        
        Args:
            value: Value to convert to Decimal
            
        Returns:
            Decimal representation of the value, or Decimal('0') if conversion fails
        """
        try:
            if isinstance(value, Decimal):
                return value
            elif isinstance(value, str):
                # Clean up percentage strings and other formats
                cleaned_value = value.replace('%', '').replace(',', '').strip()
                return Decimal(cleaned_value) if cleaned_value else Decimal('0')
            elif isinstance(value, (int, float)):
                return Decimal(str(value))
            else:
                return Decimal(str(value))
        except (ValueError, TypeError, InvalidOperation) as e:
            logger.warning(f"Failed to convert {value} to Decimal: {e}")
            return Decimal('0')
    
    def _is_valid_price(self, price: Any) -> bool:
        """
        Check if a price value is valid (positive and finite).
        
        Args:
            price: Price value to validate
            
        Returns:
            True if price is valid, False otherwise
        """
        try:
            if isinstance(price, Decimal):
                return price > 0 and price.is_finite()
            price_decimal = Decimal(str(price))
            return price_decimal > 0 and price_decimal.is_finite()
        except (ValueError, TypeError, InvalidOperation):
            return False
    
    async def prefetch_user_symbols(
        self,
        user_id: str,
        user_token: str
    ) -> int:
        """
        Compatibility method for portfolio_metrics_manager.
        In simplified version, we don't prefetch - prices are fetched on demand.
        
        Args:
            user_id: User identifier
            user_token: JWT token
            
        Returns:
            Number of symbols (0 in simplified version)
        """
        # No-op in simplified version - prices are fetched when needed
        logger.debug(f"[PriceManager] prefetch_user_symbols called for user {user_id} - no-op in simplified version")
        return 0
    
    def enable_request_cache(self) -> None:
        """
        Compatibility method for portfolio_metrics_manager.
        No-op in simplified version as we don't use request-level caching.
        """
        logger.debug("[PriceManager] enable_request_cache called - no-op in simplified version")
        pass
    
    def disable_request_cache(self) -> None:
        """
        Compatibility method for portfolio_metrics_manager.
        No-op in simplified version as we don't use request-level caching.
        """
        logger.debug("[PriceManager] disable_request_cache called - no-op in simplified version")
        pass
    
    async def get_portfolio_prices_for_charts(
        self,
        symbols: List[str],
        start_date: date,
        end_date: date,
        user_token: str
    ) -> Dict[str, Any]:
        """
        Get historical prices for portfolio charts.
        Returns a dict with success status and data.
        
        Args:
            symbols: List of stock ticker symbols
            start_date: Start date for price history
            end_date: End date for price history
            user_token: JWT token for database access
            
        Returns:
            Dict with 'success' and 'data' keys
        """
        try:
            # Use the existing get_historical_prices method
            data = await self.get_historical_prices(
                symbols=symbols,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            return {
                'success': True,
                'data': data
            }
        except Exception as e:
            logger.error(f"Error getting portfolio prices for charts: {e}")
            return {
                'success': False,
                'data': {},
                'error': str(e)
            }


# Create singleton instance
price_manager = SimplifiedPriceManager()