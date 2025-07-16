"""
Price Data Service - THE ONLY database price reader
This service is responsible for reading price data from the database.
NO API calls, NO external fetching - just clean database reads.
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import date, datetime, timedelta
from decimal import Decimal

from supa_api.supa_api_historical_prices import supa_api_get_historical_prices
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)


class PriceDataService:
    """
    Service for reading price data from the database.
    This is the ONLY service that should be used to get price data throughout the application.
    """
    
    @staticmethod
    async def get_latest_price(symbol: str, user_token: str, max_days_back: int = 7) -> Optional[Dict[str, Any]]:
        """
        Get the most recent price for a symbol from the database.
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            max_days_back: Maximum number of days to look back for a price
            
        Returns:
            Dict with price data or None if not found
            {
                'symbol': 'AAPL',
                'price': 150.00,
                'date': '2024-01-15',
                'volume': 1000000
            }
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
                logger.warning(f"[PriceDataService] No prices found for {symbol} in last {max_days_back} days")
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
            logger.error(f"[PriceDataService] Error getting latest price for {symbol}: {e}")
            return None
    
    @staticmethod
    async def get_prices_for_symbols(symbols: List[str], user_token: str, max_days_back: int = 7) -> Dict[str, Dict[str, Any]]:
        """
        Get latest prices for multiple symbols.
        
        Args:
            symbols: List of stock ticker symbols
            user_token: JWT token for database access
            max_days_back: Maximum number of days to look back for prices
            
        Returns:
            Dict mapping symbol to price data
        """
        prices = {}
        
        for symbol in symbols:
            price_data = await PriceDataService.get_latest_price(symbol, user_token, max_days_back)
            if price_data:
                prices[symbol] = price_data
            else:
                logger.warning(f"[PriceDataService] No price data for {symbol}")
        
        return prices
    
    @staticmethod
    async def get_price_at_date(symbol: str, target_date: date, user_token: str, tolerance_days: int = 5) -> Optional[Dict[str, Any]]:
        """
        Get price for a symbol at a specific date (or closest available).
        
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
                logger.warning(f"[PriceDataService] No prices found for {symbol} around {target_date}")
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
            logger.error(f"[PriceDataService] Error getting price at date for {symbol}: {e}")
            return None
    
    @staticmethod
    async def get_price_history(symbol: str, start_date: date, end_date: date, user_token: str) -> List[Dict[str, Any]]:
        """
        Get price history for a symbol over a date range.
        
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
                logger.warning(f"[PriceDataService] No price history found for {symbol} from {start_date} to {end_date}")
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
            logger.error(f"[PriceDataService] Error getting price history for {symbol}: {e}")
            return []
    
    @staticmethod
    async def has_recent_price(symbol: str, user_token: str, hours: int = 24) -> bool:
        """
        Check if we have a recent price for a symbol.
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            hours: How many hours back to consider "recent"
            
        Returns:
            True if we have a price within the specified hours
        """
        try:
            cutoff_date = datetime.now().date() - timedelta(hours=hours)
            price_data = await PriceDataService.get_latest_price(symbol, user_token, max_days_back=hours//24 + 1)
            
            if not price_data:
                return False
            
            price_date = datetime.strptime(price_data['date'], '%Y-%m-%d').date()
            return price_date >= cutoff_date
            
        except Exception as e:
            logger.error(f"[PriceDataService] Error checking recent price for {symbol}: {e}")
            return False


# Create singleton instance
price_data_service = PriceDataService()