# backend/api/services/market_data_cache.py
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any
from decimal import Decimal
from django.utils import timezone
from ..models import CachedDailyPrice, CachedCompanyFundamentals
from ..alpha_vantage_service import get_alpha_vantage_service

logger = logging.getLogger(__name__)

class MarketDataCacheService:
    """Service for managing cached market data with Alpha Vantage fallback"""
    
    def __init__(self):
        self.av_service = get_alpha_vantage_service()
    
    def get_daily_prices(
        self, 
        symbol: str, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        use_cache: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Get daily price data for a symbol, using cache when available.
        
        Args:
            symbol: Stock symbol
            start_date: Start date for data (optional)
            end_date: End date for data (optional, defaults to today)
            use_cache: Whether to use cached data
        
        Returns:
            Dictionary with 'data' key containing list of price records
        """
        logger.debug(f"Getting daily prices for {symbol}, use_cache={use_cache}")
        
        if not end_date:
            end_date = date.today()
        
        if use_cache:
            # Try to get data from cache first
            cached_data = self._get_cached_prices(symbol, start_date, end_date)
            if cached_data:
                logger.info(f"Cache hit for daily prices: {symbol}")
                return {'data': cached_data, 'source': 'cache'}
        
        # Fallback to Alpha Vantage
        logger.info(f"Cache miss for daily prices: {symbol}, fetching from Alpha Vantage")
        av_data = self.av_service.get_daily_adjusted(symbol, outputsize='full')
        
        if av_data and 'data' in av_data:
            # Filter by date range if specified
            if start_date or end_date:
                filtered_data = []
                for item in av_data['data']:
                    item_date = datetime.strptime(item['date'], '%Y-%m-%d').date()
                    if start_date and item_date < start_date:
                        continue
                    if end_date and item_date > end_date:
                        continue
                    filtered_data.append(item)
                av_data['data'] = filtered_data
            
            av_data['source'] = 'alpha_vantage'
            return av_data
        
        return None
    
    def get_company_fundamentals(
        self, 
        symbol: str, 
        use_cache: bool = True,
        max_age_hours: int = 24
    ) -> Optional[Dict[str, Any]]:
        """
        Get company fundamental data, using cache when available.
        
        Args:
            symbol: Stock symbol
            use_cache: Whether to use cached data
            max_age_hours: Maximum age of cached data in hours
        
        Returns:
            Dictionary containing fundamental data
        """
        logger.debug(f"Getting fundamentals for {symbol}, use_cache={use_cache}")
        
        if use_cache:
            # Check cache first
            cached_fundamentals = CachedCompanyFundamentals.objects.filter(
                symbol=symbol
            ).first()
            
            if cached_fundamentals:
                # Check if data is fresh
                hours_since_update = (
                    timezone.now() - cached_fundamentals.last_updated
                ).total_seconds() / 3600
                
                if hours_since_update < max_age_hours:
                    logger.info(f"Cache hit for fundamentals: {symbol}")
                    data = cached_fundamentals.data.copy()
                    data['source'] = 'cache'
                    data['cache_age_hours'] = round(hours_since_update, 1)
                    return data
        
        # Fallback to Alpha Vantage
        logger.info(f"Cache miss for fundamentals: {symbol}, fetching from Alpha Vantage")
        overview = self.av_service.get_company_overview(symbol)
        
        if overview:
            overview['source'] = 'alpha_vantage'
            return overview
        
        return None
    
    def get_advanced_financials(
        self, 
        symbol: str, 
        use_cache: bool = True,
        max_age_hours: int = 24
    ) -> Optional[Dict[str, Any]]:
        """
        Get advanced financial metrics, using cache when available.
        
        Args:
            symbol: Stock symbol
            use_cache: Whether to use cached data
            max_age_hours: Maximum age of cached data in hours
        
        Returns:
            Dictionary containing advanced financial metrics
        """
        logger.debug(f"Getting advanced financials for {symbol}, use_cache={use_cache}")
        
        if use_cache:
            # Check cache first
            cached_fundamentals = CachedCompanyFundamentals.objects.filter(
                symbol=symbol
            ).first()
            
            if cached_fundamentals:
                # Check if data is fresh
                hours_since_update = (
                    timezone.now() - cached_fundamentals.last_updated
                ).total_seconds() / 3600
                
                if hours_since_update < max_age_hours:
                    logger.info(f"Cache hit for advanced financials: {symbol}")
                    
                    # Return the advanced metrics if available
                    if 'advanced_metrics' in cached_fundamentals.data:
                        data = cached_fundamentals.data['advanced_metrics'].copy()
                        data['source'] = 'cache'
                        data['cache_age_hours'] = round(hours_since_update, 1)
                        return data
        
        # If no cached advanced metrics, we need to calculate them
        # This would typically be done by the update_market_data command
        logger.warning(f"No cached advanced financials for {symbol}. Consider running update_market_data command.")
        return None
    
    def _get_cached_prices(
        self, 
        symbol: str, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Get cached price data for a symbol within date range"""
        queryset = CachedDailyPrice.objects.filter(symbol=symbol)
        
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        # Check if we have recent data
        if not queryset.exists():
            return None
        
        # Check if data is reasonably up-to-date (within last 2 days)
        latest_date = queryset.order_by('-date').first().date
        days_old = (date.today() - latest_date).days
        
        if days_old > 2:
            logger.debug(f"Cached data for {symbol} is {days_old} days old, considering fresh fetch")
            return None
        
        # Convert to Alpha Vantage format
        cached_records = queryset.order_by('-date').values(
            'date', 'open', 'high', 'low', 'close', 'adjusted_close', 
            'volume', 'dividend_amount'
        )
        
        data = []
        for record in cached_records:
            data.append({
                'date': record['date'].strftime('%Y-%m-%d'),
                'open': str(record['open']),
                'high': str(record['high']),
                'low': str(record['low']),
                'close': str(record['close']),
                'adjusted_close': str(record['adjusted_close']),
                'volume': str(record['volume']),
                'dividend_amount': str(record['dividend_amount'])
            })
        
        return data
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get statistics about the cache"""
        daily_price_count = CachedDailyPrice.objects.count()
        fundamentals_count = CachedCompanyFundamentals.objects.count()
        
        # Get unique symbols
        unique_price_symbols = CachedDailyPrice.objects.values('symbol').distinct().count()
        unique_fundamental_symbols = CachedCompanyFundamentals.objects.values('symbol').distinct().count()
        
        # Get latest updates
        latest_price_update = CachedDailyPrice.objects.order_by('-updated_at').first()
        latest_fundamentals_update = CachedCompanyFundamentals.objects.order_by('-last_updated').first()
        
        return {
            'daily_prices': {
                'total_records': daily_price_count,
                'unique_symbols': unique_price_symbols,
                'latest_update': latest_price_update.updated_at if latest_price_update else None
            },
            'fundamentals': {
                'total_records': fundamentals_count,
                'unique_symbols': unique_fundamental_symbols,
                'latest_update': latest_fundamentals_update.last_updated if latest_fundamentals_update else None
            }
        }

# Singleton instance
_cache_service_instance = None

def get_market_data_cache_service() -> MarketDataCacheService:
    """Get singleton instance of MarketDataCacheService"""
    global _cache_service_instance
    if _cache_service_instance is None:
        _cache_service_instance = MarketDataCacheService()
    return _cache_service_instance 