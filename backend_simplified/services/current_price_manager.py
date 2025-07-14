"""
Current Price Manager - Simplified Centralized Price Data Service

Unified service for all price data needs across portfolio and research pages.
Simple logic: Check last price date, fill gaps if needed, get current price.

Key Features:
- Check if last price matches today's date
- Fill missing daily data and update database
- Get current price (intraday if available, fallback to last close)
- Graceful error handling for Alpha Vantage downtime
- Ignore NaN/error/0.00 values automatically
"""

import asyncio
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import math

from debug_logger import DebugLogger
from supa_api.supa_api_historical_prices import supa_api_get_historical_prices, supa_api_store_historical_prices_batch
from vantage_api.vantage_api_quotes import vantage_api_get_quote, vantage_api_get_daily_adjusted
from vantage_api.vantage_api_client import get_vantage_client
from services.market_status_service import market_status_service

logger = logging.getLogger(__name__)

class CurrentPriceManager:
    """
    Simplified centralized price data manager
    
    Logic:
    1. Check if last price matches today's date
    2. If not, request daily prices and update DB
    3. Get current price (intraday or last close)
    4. Handle errors gracefully
    """
    
    def __init__(self):
        self.vantage_client = get_vantage_client()
        self._quote_cache = {}  # Cache structure: {symbol: (data, fetch_time, price)}
        self._cache_timeout_fallback = 300  # 5 minutes fallback when we can't determine market status
        logger.info("[CurrentPriceManager] Initialized with market-aware caching")
    
    async def get_current_price_fast(self, symbol: str) -> Dict[str, Any]:
        """
        Get current price quickly without database operations or data filling
        Used for dashboard and quick quotes where speed is more important than data completeness
        
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
            
            if cache_key in self._quote_cache:
                cached_data, cache_time, cached_price = self._quote_cache[cache_key]
                age_seconds = (now - cache_time).total_seconds()
                
                # Check if market is currently open
                is_market_open, market_info = await market_status_service.is_market_open_for_symbol(symbol)
                
                if not is_market_open:
                    # Market is closed - use cache if we have it (no matter how old)
                    logger.info(f"[CurrentPriceManager] Market closed for {symbol}, using cached quote (age: {age_seconds:.1f}s)")
                    return cached_data
                else:
                    # Market is open - check if we need fresh data
                    # Get fresh quote to see if price changed
                    fresh_quote = await self._get_current_price_data(symbol)
                    
                    if fresh_quote and fresh_quote.get('price') == cached_price:
                        # Price hasn't changed, update cache timestamp and continue using it
                        logger.info(f"[CurrentPriceManager] Market open but price unchanged for {symbol}, extending cache")
                        self._quote_cache[cache_key] = (cached_data, now, cached_price)
                        return cached_data
                    elif fresh_quote:
                        # Price changed, use and cache the fresh data
                        logger.info(f"[CurrentPriceManager] Market open and price changed for {symbol}, using fresh quote")
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
                        self._quote_cache[cache_key] = (result, now, fresh_quote.get('price'))
                        return result
                    elif age_seconds < self._cache_timeout_fallback:
                        # Failed to get fresh quote but cache is recent
                        logger.info(f"[CurrentPriceManager] Failed to get fresh quote, using recent cache for {symbol}")
                        return cached_data
            
            # No cache or cache miss - get fresh quote from Alpha Vantage
            logger.info(f"[CurrentPriceManager] Getting fresh quote for {symbol}")
            current_price_data = await self._get_current_price_data(symbol)
            
            if current_price_data:
                # Check market status for metadata
                is_market_open, market_info = await market_status_service.is_market_open_for_symbol(symbol)
                
                result = {
                    "success": True,
                    "data": current_price_data,
                    "metadata": {
                        "symbol": symbol,
                        "data_source": "alpha_vantage_quote_fast",
                        "timestamp": now.isoformat(),
                        "market_status": "open" if is_market_open else "closed",
                        "message": "Current price retrieved successfully (fast mode)"
                    }
                }
                
                # Cache the result with price for comparison
                self._quote_cache[cache_key] = (result, now, current_price_data.get('price'))
                return result
            
            else:
                return {
                    "success": False,
                    "error": "Quote Not Available",
                    "data": None,
                    "metadata": {
                        "symbol": symbol,
                        "timestamp": now.isoformat(),
                        "message": "No quote data available from Alpha Vantage"
                    }
                }
                
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error getting fast quote for {symbol}: {e}")
            return {
                "success": False,
                "error": "Service Temporarily Unavailable",
                "data": None,
                "metadata": {
                    "symbol": symbol,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Service error: {str(e)}"
                }
            }
    
    async def get_current_price(self, symbol: str, user_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Get current price for a symbol with gap filling
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access (optional for basic quotes)
            
        Returns:
            Dict containing current price data and metadata
        """
        try:
            symbol = symbol.upper().strip()
            logger.info(f"[CurrentPriceManager] Getting current price for {symbol} (user_token: {'provided' if user_token else 'none'})")
            
            # Step 1: Try to get current/intraday price first (most efficient)
            current_price_data = await self._get_current_price_data(symbol)
            
            if current_price_data:
                # Step 2: Check if market is open before updating historical data
                if user_token:
                    is_market_open, market_info = await market_status_service.is_market_open_for_symbol(symbol, user_token)
                    
                    if is_market_open:
                        # Market is open - ensure historical data is current (background)
                        logger.info(f"[CurrentPriceManager] Market open for {symbol}, checking historical data gaps")
                        asyncio.create_task(self._ensure_data_current(symbol, user_token))
                    else:
                        logger.info(f"[CurrentPriceManager] Market closed for {symbol}, skipping historical data update")
                
                return {
                    "success": True,
                    "data": current_price_data,
                    "metadata": {
                        "symbol": symbol,
                        "data_source": "alpha_vantage_quote",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "message": "Current price retrieved successfully"
                    }
                }
            
            # Step 3: Fallback to last closing price from database if user_token provided
            if user_token:
                await self._ensure_data_current(symbol, user_token)
                last_close = await self._get_last_closing_price(symbol, user_token)
                if last_close:
                    return {
                        "success": True,
                        "data": last_close,
                        "metadata": {
                            "symbol": symbol,
                            "data_source": "database_last_close",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "message": "Using last closing price from database"
                        }
                    }
            
            # Step 4: No data available
            return {
                "success": False,
                "error": "Data Not Available At This Time",
                "data": None,
                "metadata": {
                    "symbol": symbol,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": "No current or historical price data available"
                }
            }
            
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error getting current price for {symbol}: {e}")
            return {
                "success": False,
                "error": "Data Not Available At This Time",
                "data": None,
                "metadata": {
                    "symbol": symbol,
                    "timestamp": datetime.utcnow().isoformat(),
                    "message": f"Service error: {str(e)}"
                }
            }
    
    async def get_historical_prices(
        self, 
        symbol: str, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None,
        years: int = 5,
        user_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get historical prices with automatic gap filling
        
        Args:
            symbol: Stock ticker symbol
            start_date: Start date for historical data
            end_date: End date for historical data
            years: Number of years back (if dates not provided)
            user_token: JWT token for database access
            
        Returns:
            Dict containing historical price data and metadata
        """
        try:
            symbol = symbol.upper().strip()
            
            # Calculate date range if not provided
            if end_date is None:
                end_date = date.today()
            if start_date is None:
                start_date = end_date - timedelta(days=years * 365)
            
            logger.info(f"[CurrentPriceManager] Getting historical prices for {symbol} from {start_date} to {end_date}")
            
            # Ensure data is current
            if user_token:
                await self._ensure_data_current(symbol, user_token)
            
            # Get historical data from database
            historical_data = await self._get_db_historical_data(symbol, start_date, end_date, user_token)
            
            if historical_data:
                return {
                    "success": True,
                    "data": {
                        "symbol": symbol,
                        "price_data": historical_data,
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat(),
                        "data_points": len(historical_data)
                    },
                    "metadata": {
                        "data_source": "database",
                        "timestamp": datetime.utcnow().isoformat(),
                        "message": "Historical data retrieved successfully"
                    }
                }
            
            else:
                return {
                    "success": False,
                    "error": "Data Not Available At This Time",
                    "data": None,
                    "metadata": {
                        "symbol": symbol,
                        "timestamp": datetime.utcnow().isoformat(),
                        "message": "No historical data available"
                    }
                }
                
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error getting historical prices for {symbol}: {e}")
            return {
                "success": False,
                "error": "Data Not Available At This Time",
                "data": None,
                "metadata": {
                    "symbol": symbol,
                    "timestamp": datetime.utcnow().isoformat(),
                    "message": f"Service error: {str(e)}"
                }
            }
    
    async def get_portfolio_prices(
        self, 
        symbols: List[str], 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None,
        user_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get historical prices for multiple symbols (portfolio use)
        NOW WITH SMART MARKET CHECKING: Groups symbols by exchange and checks market status once
        
        Args:
            symbols: List of stock ticker symbols
            start_date: Start date for historical data
            end_date: End date for historical data
            user_token: JWT token for database access
            
        Returns:
            Dict containing price data for all symbols
        """
        try:
            logger.info(f"[CurrentPriceManager] Getting portfolio prices for {len(symbols)} symbols")
            
            # Step 1: Group symbols by market/exchange
            market_groups = await market_status_service.group_symbols_by_market(symbols, user_token)
            
            # Step 2: Check market status for each exchange ONCE
            market_status = await market_status_service.check_markets_status(market_groups)
            
            # Process symbols by market group
            portfolio_data = {}
            successful_symbols = []
            failed_symbols = []
            skipped_symbols = []
            
            for region, region_symbols in market_groups.items():
                market_is_open = market_status.get(region, True)
                
                for symbol in region_symbols:
                    try:
                        # Get market info for better decision making
                        market_info = await market_status_service.get_market_info_for_symbol(symbol, user_token)
                        
                        # Check if we should update prices for this symbol
                        should_update = market_status_service.should_update_prices(symbol, market_is_open, market_info)
                        
                        if not should_update:
                            # Market is closed and we already have recent data
                            # Get cached data from database without triggering updates
                            logger.info(f"[CurrentPriceManager] Skipping {symbol} - market closed, already have recent data")
                            
                            # Get existing data from DB without triggering updates
                            if user_token:
                                historical_data = await self._get_db_historical_data(symbol, start_date, end_date, user_token)
                                if historical_data:
                                    portfolio_data[symbol] = historical_data
                                    successful_symbols.append(symbol)
                                    skipped_symbols.append(symbol)
                                    continue
                        
                        # Market is open or we need to update - proceed normally
                        result = await self.get_historical_prices(
                            symbol=symbol,
                            start_date=start_date,
                            end_date=end_date,
                            user_token=user_token
                        )
                        
                        if result.get("success"):
                            portfolio_data[symbol] = result["data"]["price_data"]
                            successful_symbols.append(symbol)
                            # Mark as updated
                            market_status_service.mark_symbol_updated(symbol)
                        else:
                            failed_symbols.append(symbol)
                            logger.warning(f"[CurrentPriceManager] Failed to get data for {symbol}: {result.get('error')}")
                            
                    except Exception as e:
                        logger.error(f"[CurrentPriceManager] Error processing {symbol}: {e}")
                        failed_symbols.append(symbol)
            
            logger.info(f"[CurrentPriceManager] Portfolio prices summary: {len(successful_symbols)} successful, {len(skipped_symbols)} skipped (market closed), {len(failed_symbols)} failed")
            
            return {
                "success": True,
                "data": {
                    "portfolio_prices": portfolio_data,
                    "successful_symbols": successful_symbols,
                    "failed_symbols": failed_symbols,
                    "skipped_symbols": skipped_symbols,
                    "total_symbols": len(symbols)
                },
                "metadata": {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Portfolio data: {len(successful_symbols)} retrieved ({len(skipped_symbols)} from cache), {len(failed_symbols)} failed",
                    "market_status": market_status
                }
            }
            
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error getting portfolio prices: {e}")
            return {
                "success": False,
                "error": "Data Not Available At This Time",
                "data": None,
                "metadata": {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Service error: {str(e)}"
                }
            }
    
    async def _ensure_data_current(self, symbol: str, user_token: str) -> bool:
        """
        Ensure we have current data by checking last price date and filling gaps
        Only fills gaps if market has been open since last data point
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            
        Returns:
            True if data is current, False otherwise
        """
        try:
            # Check if market is currently open
            is_market_open, market_info = await market_status_service.is_market_open_for_symbol(symbol, user_token)
            
            if not is_market_open:
                logger.info(f"[CurrentPriceManager] Market closed for {symbol}, skipping data update")
                return True
            
            # Step 1: Get last price date from database
            last_price_date = await self._get_last_price_date(symbol, user_token)
            today = date.today()
            
            logger.info(f"[CurrentPriceManager] Last price date for {symbol}: {last_price_date}, Today: {today}")
            
            # Step 2: Check if we need to fill gaps
            if last_price_date is None or last_price_date < today:
                # Check if market has been open since last price date
                if last_price_date and (today - last_price_date).days <= 1:
                    # Only one day gap - might be weekend/holiday
                    next_open = market_status_service.calculate_next_market_open(market_info)
                    if next_open and next_open.date() > today:
                        logger.info(f"[CurrentPriceManager] Market hasn't opened since {last_price_date}, no gaps to fill")
                        return True
                
                logger.info(f"[CurrentPriceManager] Need to fill gaps for {symbol}")
                
                # Determine start date for gap filling
                if last_price_date is None:
                    # No data, get last 100 days
                    start_date = today - timedelta(days=100)
                else:
                    # Fill from day after last price
                    start_date = last_price_date + timedelta(days=1)
                
                # Fill gaps
                await self._fill_price_gaps(symbol, start_date, today, user_token)
                return True
            
            else:
                logger.info(f"[CurrentPriceManager] Data is current for {symbol}")
                return True
                
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error ensuring data current for {symbol}: {e}")
            return False
    
    async def _get_last_price_date(self, symbol: str, user_token: str) -> Optional[date]:
        """Get the last price date we have in the database"""
        try:
            # Get the most recent price record
            recent_data = await supa_api_get_historical_prices(
                symbol=symbol,
                start_date=(date.today() - timedelta(days=30)).isoformat(),
                end_date=date.today().isoformat(),
                user_token=user_token
            )
            
            if recent_data:
                # Find the latest date
                latest_date = max(
                    datetime.strptime(record["date"], "%Y-%m-%d").date() 
                    for record in recent_data
                )
                return latest_date
            
            return None
            
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error getting last price date for {symbol}: {e}")
            return None
    
    async def _fill_price_gaps(self, symbol: str, start_date: date, end_date: date, user_token: str) -> bool:
        """Fill price gaps by fetching from Alpha Vantage and updating database"""
        try:
            logger.info(f"[CurrentPriceManager] Filling price gaps for {symbol} from {start_date} to {end_date}")
            
            # Get daily data from Alpha Vantage
            raw_data = await vantage_api_get_daily_adjusted(symbol)
            
            if not raw_data:
                logger.warning(f"[CurrentPriceManager] No data returned from Alpha Vantage for {symbol}")
                return False
            
            # Filter and format data for the date range
            formatted_data = []
            for date_str, price_data in raw_data.items():
                try:
                    record_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    
                    # Check if date is in our range
                    if start_date <= record_date <= end_date:
                        
                        # Extract price values
                        open_price = float(price_data.get("1. open", 0))
                        high_price = float(price_data.get("2. high", 0))
                        low_price = float(price_data.get("3. low", 0))
                        close_price = float(price_data.get("4. close", 0))
                        volume = int(price_data.get("6. volume", 0))
                        
                        # Skip if any price is NaN, 0, or invalid
                        if (self._is_valid_price(open_price) and 
                            self._is_valid_price(high_price) and 
                            self._is_valid_price(low_price) and 
                            self._is_valid_price(close_price)):
                            
                            formatted_data.append({
                                "symbol": symbol,
                                "date": date_str,
                                "open": open_price,
                                "high": high_price,
                                "low": low_price,
                                "close": close_price,
                                "adjusted_close": float(price_data.get("5. adjusted close", close_price)),
                                "volume": volume,
                                "dividend_amount": float(price_data.get("7. dividend amount", 0)),
                                "split_coefficient": float(price_data.get("8. split coefficient", 1))
                            })
                        
                except (ValueError, KeyError) as e:
                    logger.warning(f"[CurrentPriceManager] Skipping invalid data for {date_str}: {e}")
                    continue
            
            # Store in database
            if formatted_data:
                success = await supa_api_store_historical_prices_batch(
                    price_data=formatted_data,
                    user_token=user_token
                )
                
                if success:
                    logger.info(f"[CurrentPriceManager] Successfully stored {len(formatted_data)} price records for {symbol}")
                    return True
                else:
                    logger.warning(f"[CurrentPriceManager] Failed to store price data for {symbol}")
                    return False
            
            else:
                logger.warning(f"[CurrentPriceManager] No valid price data found for {symbol}")
                return False
                
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error filling price gaps for {symbol}: {e}")
            return False
    
    async def _get_current_price_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get current price data from Alpha Vantage"""
        try:
            # Try to get current quote
            quote_data = await vantage_api_get_quote(symbol)
            
            if quote_data and self._is_valid_price(quote_data.get('price', 0)):
                return quote_data
            
            return None
            
        except Exception as e:
            logger.warning(f"[CurrentPriceManager] Error getting current price for {symbol}: {e}")
            return None
    
    async def _get_last_closing_price(self, symbol: str, user_token: str) -> Optional[Dict[str, Any]]:
        """Get last closing price from database"""
        try:
            # Get recent data
            recent_data = await supa_api_get_historical_prices(
                symbol=symbol,
                start_date=(date.today() - timedelta(days=10)).isoformat(),
                end_date=date.today().isoformat(),
                user_token=user_token
            )
            
            if recent_data:
                # Find the most recent valid record
                latest_record = max(
                    recent_data,
                    key=lambda x: datetime.strptime(x["date"], "%Y-%m-%d").date()
                )
                
                close_price = float(latest_record.get("close", 0))
                
                if self._is_valid_price(close_price):
                    return {
                        'symbol': symbol,
                        'price': close_price,
                        'change': 0.0,
                        'change_percent': '0.00',
                        'volume': int(latest_record.get("volume", 0)),
                        'latest_trading_day': latest_record["date"],
                        'previous_close': close_price,
                        'open': float(latest_record.get("open", close_price)),
                        'high': float(latest_record.get("high", close_price)),
                        'low': float(latest_record.get("low", close_price))
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error getting last closing price for {symbol}: {e}")
            return None
    
    async def _get_db_historical_data(
        self, 
        symbol: str, 
        start_date: date, 
        end_date: date, 
        user_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get historical data from database"""
        try:
            if not user_token:
                return []
            
            db_data = await supa_api_get_historical_prices(
                symbol=symbol,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            # Filter out invalid data and format
            valid_data = []
            for record in db_data:
                try:
                    close_price = float(record.get("close", 0))
                    
                    if self._is_valid_price(close_price):
                        valid_data.append({
                            "time": record["date"],
                            "open": float(record.get("open", 0)),
                            "high": float(record.get("high", 0)),
                            "low": float(record.get("low", 0)),
                            "close": close_price,
                            "volume": int(record.get("volume", 0))
                        })
                        
                except (ValueError, KeyError):
                    continue
            
            # Sort by date (newest first)
            valid_data.sort(key=lambda x: x["time"], reverse=True)
            
            return valid_data
            
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error getting DB historical data for {symbol}: {e}")
            return []
    
    def _is_valid_price(self, price: float) -> bool:
        """Check if a price value is valid (not NaN, not 0, not negative)"""
        try:
            return (
                price is not None and 
                not math.isnan(price) and 
                not math.isinf(price) and 
                price > 0
            )
        except (TypeError, ValueError):
            return False
    
    async def ensure_closing_prices(self, symbols: List[str], user_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Ensure we have closing prices for all symbols
        Called after market close to capture final prices
        
        Args:
            symbols: List of stock symbols
            user_token: JWT token for database access
            
        Returns:
            Dict with update results
        """
        try:
            logger.info(f"[CurrentPriceManager] Ensuring closing prices for {len(symbols)} symbols")
            
            updated_symbols = []
            skipped_symbols = []
            failed_symbols = []
            
            for symbol in symbols:
                try:
                    # Check market status and info
                    is_open, market_info = await market_status_service.is_market_open_for_symbol(symbol, user_token)
                    
                    if is_open:
                        logger.info(f"[CurrentPriceManager] Market still open for {symbol}, skipping closing price update")
                        skipped_symbols.append(symbol)
                        continue
                    
                    # Force check if we need closing price
                    should_update = market_status_service.should_update_prices(symbol, False, market_info)
                    
                    if should_update:
                        logger.info(f"[CurrentPriceManager] Getting closing price for {symbol}")
                        
                        # Get current quote (will be closing price if market closed)
                        current_price_data = await self._get_current_price_data(symbol)
                        
                        if current_price_data and self._is_valid_price(current_price_data.get('price', 0)):
                            # Update our cache
                            cache_key = f"quote_{symbol}"
                            result = {
                                "success": True,
                                "data": current_price_data,
                                "metadata": {
                                    "symbol": symbol,
                                    "data_source": "alpha_vantage_closing_price",
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "market_status": "closed",
                                    "message": "Closing price captured"
                                }
                            }
                            self._quote_cache[cache_key] = (result, datetime.now(timezone.utc), current_price_data.get('price'))
                            
                            # Mark as updated
                            market_status_service.mark_symbol_updated(symbol)
                            updated_symbols.append(symbol)
                            
                            # Also ensure historical data is updated
                            if user_token:
                                await self._ensure_data_current(symbol, user_token)
                        else:
                            failed_symbols.append(symbol)
                    else:
                        logger.info(f"[CurrentPriceManager] {symbol} already has closing price")
                        skipped_symbols.append(symbol)
                        
                except Exception as e:
                    logger.error(f"[CurrentPriceManager] Error getting closing price for {symbol}: {e}")
                    failed_symbols.append(symbol)
            
            return {
                "success": True,
                "updated": updated_symbols,
                "skipped": skipped_symbols,
                "failed": failed_symbols,
                "summary": f"Updated {len(updated_symbols)} closing prices, skipped {len(skipped_symbols)}, failed {len(failed_symbols)}"
            }
            
        except Exception as e:
            logger.error(f"[CurrentPriceManager] Error ensuring closing prices: {e}")
            return {
                "success": False,
                "error": str(e)
            }

# Create a singleton instance for easy import
current_price_manager = CurrentPriceManager()