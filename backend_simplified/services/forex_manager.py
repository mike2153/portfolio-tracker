"""
Forex Manager Service for Multi-Currency Support
Handles exchange rate fetching, caching, and conversions with proper type safety
"""

from decimal import Decimal
from datetime import date, timedelta, datetime
import aiohttp
from typing import Optional, Dict, Any
from supabase import Client
import logging

logger = logging.getLogger(__name__)


class ForexManager:
    """Manages forex rates with simple counter-based rate limiting"""
    
    def __init__(self, supabase_client: Client, alpha_vantage_key: str) -> None:
        """
        Initialize ForexManager with Supabase client and Alpha Vantage API key
        
        Args:
            supabase_client: Authenticated Supabase client
            alpha_vantage_key: Alpha Vantage API key for forex data
        """
        self.supabase: Client = supabase_client
        self.av_key: str = alpha_vantage_key
        self.cache: Dict[str, Decimal] = {}  # Simple memory cache
        
    async def get_exchange_rate(
        self, 
        from_currency: str, 
        to_currency: str, 
        target_date: date
    ) -> Decimal:
        """
        Get exchange rate with 7-day fallback
        
        Args:
            from_currency: Source currency code (e.g., 'USD')
            to_currency: Target currency code (e.g., 'EUR')
            target_date: Date for which to get the rate
            
        Returns:
            Exchange rate as Decimal
        """
        if from_currency == to_currency:
            return Decimal('1.0')
        
        # Check memory cache first
        cache_key: str = f"{from_currency}/{to_currency}/{target_date}"
        if cache_key in self.cache:
            return self.cache[cache_key]
            
        # Try database with fallback (up to 7 days)
        for days_back in range(7):
            check_date: date = target_date - timedelta(days=days_back)
            
            try:
                result = await self.supabase.table('forex_rates')\
                    .select('rate')\
                    .eq('from_currency', from_currency)\
                    .eq('to_currency', to_currency)\
                    .eq('date', check_date.isoformat())\
                    .execute()
                    
                # Guard against empty results
                if result.data and len(result.data) > 0:
                    rate: Decimal = Decimal(str(result.data[0]['rate']))
                    self.cache[cache_key] = rate
                    return rate
            except Exception as e:
                logger.error(f"Error fetching forex rate from database: {e}")
                continue
        
        # Not found - try to fetch ONCE from API
        if await self._can_make_api_call():
            success: bool = await self._fetch_forex_history(from_currency, to_currency)
            if success:
                # Try database one more time
                try:
                    result = await self.supabase.table('forex_rates')\
                        .select('rate')\
                        .eq('from_currency', from_currency)\
                        .eq('to_currency', to_currency)\
                        .eq('date', target_date.isoformat())\
                        .execute()
                        
                    if result.data and len(result.data) > 0:
                        rate = Decimal(str(result.data[0]['rate']))
                        self.cache[cache_key] = rate
                        return rate
                except Exception as e:
                    logger.error(f"Error fetching forex rate after API call: {e}")
        
        # Use fallback - no recursion!
        return self._get_fallback_rate(from_currency, to_currency)
    
    async def get_latest_rate(
        self, 
        from_currency: str, 
        to_currency: str
    ) -> Decimal:
        """
        Get most recent exchange rate
        
        Args:
            from_currency: Source currency code
            to_currency: Target currency code
            
        Returns:
            Latest exchange rate as Decimal
        """
        if from_currency == to_currency:
            return Decimal('1.0')
        
        try:
            result = await self.supabase.table('forex_rates')\
                .select('rate')\
                .eq('from_currency', from_currency)\
                .eq('to_currency', to_currency)\
                .order('date', desc=True)\
                .limit(1)\
                .execute()
            
            if result.data and len(result.data) > 0:
                return Decimal(str(result.data[0]['rate']))
        except Exception as e:
            logger.error(f"Error fetching latest forex rate: {e}")
        
        # Try to fetch if we can
        if await self._can_make_api_call():
            await self._fetch_forex_history(from_currency, to_currency)
            
            # Try once more
            try:
                result = await self.supabase.table('forex_rates')\
                    .select('rate')\
                    .eq('from_currency', from_currency)\
                    .eq('to_currency', to_currency)\
                    .order('date', desc=True)\
                    .limit(1)\
                    .execute()
                    
                if result.data and len(result.data) > 0:
                    return Decimal(str(result.data[0]['rate']))
            except Exception as e:
                logger.error(f"Error fetching latest rate after API call: {e}")
        
        return self._get_fallback_rate(from_currency, to_currency)
    
    async def _can_make_api_call(self) -> bool:
        """
        Check if we're within API limits
        
        Returns:
            True if we can make an API call, False otherwise
        """
        today: date = date.today()
        
        try:
            # Check daily limit
            result = await self.supabase.table('api_usage')\
                .select('call_count')\
                .eq('service', 'alphavantage')\
                .eq('date', today.isoformat())\
                .execute()
            
            if result.data and len(result.data) > 0:
                call_count: int = result.data[0]['call_count']
                if call_count >= 450:
                    logger.warning(f"API limit reached: {call_count}/450 calls today")
                    return False
        except Exception as e:
            logger.error(f"Error checking API usage: {e}")
            return False  # Conservative approach - don't make call if we can't check
            
        return True
    
    async def _increment_api_usage(self) -> None:
        """Track API usage by incrementing counter"""
        today: date = date.today()
        
        try:
            # Get current count
            result = await self.supabase.table('api_usage')\
                .select('call_count')\
                .eq('service', 'alphavantage')\
                .eq('date', today.isoformat())\
                .execute()
            
            if result.data and len(result.data) > 0:
                # Update existing
                new_count: int = result.data[0]['call_count'] + 1
                await self.supabase.table('api_usage')\
                    .update({'call_count': new_count})\
                    .eq('service', 'alphavantage')\
                    .eq('date', today.isoformat())\
                    .execute()
            else:
                # Insert new
                await self.supabase.table('api_usage')\
                    .insert({
                        'service': 'alphavantage',
                        'date': today.isoformat(),
                        'call_count': 1
                    })\
                    .execute()
        except Exception as e:
            logger.error(f"Error incrementing API usage: {e}")
    
    async def _fetch_forex_history(
        self, 
        from_currency: str, 
        to_currency: str
    ) -> bool:
        """
        Fetch forex data from Alpha Vantage API
        
        Args:
            from_currency: Source currency code
            to_currency: Target currency code
            
        Returns:
            True if successful, False otherwise
        """
        url: str = "https://www.alphavantage.co/query"
        params: Dict[str, str] = {
            'function': 'FX_DAILY',
            'from_symbol': from_currency,
            'to_symbol': to_currency,
            'apikey': self.av_key
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=10) as response:
                    if response.status != 200:
                        logger.error(f"API request failed with status {response.status}")
                        return False
                        
                    data: Dict[str, Any] = await response.json()
                    
            # Check for API error messages
            if 'Error Message' in data:
                logger.error(f"Alpha Vantage API error: {data['Error Message']}")
                return False
            
            if 'Note' in data:
                logger.warning(f"Alpha Vantage API note: {data['Note']}")
                return False
                    
            if 'Time Series FX (Daily)' in data:
                rates_to_insert: list[Dict[str, Any]] = []
                
                for date_str, values in data['Time Series FX (Daily)'].items():
                    # Parse date properly
                    rate_date: date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
                    rates_to_insert.append({
                        'from_currency': from_currency,
                        'to_currency': to_currency,
                        'date': rate_date.isoformat(),
                        'rate': str(Decimal(values['4. close']))
                    })
                
                if rates_to_insert:
                    # Bulk insert all rates at once for performance
                    await self.supabase.table('forex_rates')\
                        .upsert(rates_to_insert, on_conflict='from_currency,to_currency,date')\
                        .execute()
                    
                    logger.info(f"Successfully fetched {len(rates_to_insert)} forex rates for {from_currency}/{to_currency}")
                
                return True
            else:
                logger.error(f"Unexpected API response format: {list(data.keys())}")
                return False
        
        except aiohttp.ClientTimeout:
            logger.error("Alpha Vantage API request timed out")
            return False
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching forex data: {e}")
            return False
        except ValueError as e:
            logger.error(f"Error parsing forex data: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error fetching forex data: {e}")
            return False
            
        finally:
            # Always increment API usage, even on errors
            await self._increment_api_usage()
    
    def _get_fallback_rate(
        self, 
        from_currency: str, 
        to_currency: str
    ) -> Decimal:
        """
        Emergency fallback rates when API and database fail
        
        Args:
            from_currency: Source currency code
            to_currency: Target currency code
            
        Returns:
            Fallback exchange rate as Decimal
        """
        fallback_rates: Dict[str, Decimal] = {
            'USD/EUR': Decimal('0.92'),
            'EUR/USD': Decimal('1.09'),
            'USD/GBP': Decimal('0.79'),
            'GBP/USD': Decimal('1.27'),
            'USD/JPY': Decimal('150.0'),
            'JPY/USD': Decimal('0.0067'),
            'USD/AUD': Decimal('1.52'),
            'AUD/USD': Decimal('0.66'),
            'USD/CAD': Decimal('1.36'),
            'CAD/USD': Decimal('0.74'),
            'EUR/GBP': Decimal('0.86'),
            'GBP/EUR': Decimal('1.16'),
            'EUR/JPY': Decimal('163.5'),
            'JPY/EUR': Decimal('0.0061'),
            'GBP/JPY': Decimal('190.0'),
            'JPY/GBP': Decimal('0.0053'),
            'AUD/CAD': Decimal('0.89'),
            'CAD/AUD': Decimal('1.12'),
        }
        
        key: str = f"{from_currency}/{to_currency}"
        if key in fallback_rates:
            logger.warning(f"Using fallback rate for {key}: {fallback_rates[key]}")
            return fallback_rates[key]
        
        # If no direct rate, try reverse
        reverse_key: str = f"{to_currency}/{from_currency}"
        if reverse_key in fallback_rates:
            rate: Decimal = Decimal('1') / fallback_rates[reverse_key]
            logger.warning(f"Using reverse fallback rate for {key}: {rate}")
            return rate
        
        # Last resort - return 1.0
        logger.error(f"No fallback rate available for {key}, using 1.0")
        return Decimal('1.0')