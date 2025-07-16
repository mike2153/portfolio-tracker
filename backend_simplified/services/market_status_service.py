"""
Market Status Service
Handles checking if markets are open based on stored market hours
Enhanced with holiday support and session tracking
"""
import logging
from datetime import datetime, time, timezone, timedelta, date
from typing import Dict, Any, Optional, Tuple, List, Set
import pytz
from zoneinfo import ZoneInfo
import asyncio

from debug_logger import DebugLogger
from supa_api.supa_api_client import get_supa_service_client

logger = logging.getLogger(__name__)

class MarketStatusService:
    """
    Service for checking market status based on market hours stored with transactions
    """
    
    def __init__(self):
        self._market_info_cache = {}  # Cache symbol -> market info
        self._market_status_cache = {}  # Cache region -> (is_open, check_time)
        self._last_update_cache = {}  # Cache symbol -> last_update_time
        self._cache_duration = 3600  # 1 hour cache
        self._holidays_cache = {}  # Cache exchange -> Set[date]
        self._holidays_loaded = False
        logger.info("[MarketStatusService] Initialized")
    
    async def is_market_open_for_symbol(self, symbol: str, user_token: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if the market is open for a specific symbol
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            
        Returns:
            Tuple of (is_open: bool, market_info: dict)
        """
        try:
            # Get market info for symbol
            market_info = await self.get_market_info_for_symbol(symbol, user_token)
            
            if not market_info:
                # No market info, assume market is open (fail-open)
                logger.warning(f"[MarketStatusService] No market info for {symbol}, assuming open")
                return True, {"reason": "no_market_info"}
            
            # Check if market is currently open
            is_open = await self._check_market_hours(
                market_info['market_open'],
                market_info['market_close'],
                market_info['market_timezone']
            )
            
            market_info['is_open'] = is_open
            market_info['checked_at'] = datetime.now(timezone.utc).isoformat()
            
            logger.info(f"[MarketStatusService] Market for {symbol} ({market_info['market_region']}): {'OPEN' if is_open else 'CLOSED'}")
            
            return is_open, market_info
            
        except Exception as e:
            logger.error(f"[MarketStatusService] Error checking market status for {symbol}: {e}")
            # On error, assume market is open (fail-open)
            return True, {"error": str(e), "reason": "error_fail_open"}
    
    async def get_market_info_for_symbol(self, symbol: str, user_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get market information for a symbol from the database
        
        Args:
            symbol: Stock ticker symbol
            user_token: JWT token for database access
            
        Returns:
            Dict with market info or None if not found
        """
        try:
            # Check cache first
            cache_key = f"market_info:{symbol}"
            if cache_key in self._market_info_cache:
                cached_data, cache_time = self._market_info_cache[cache_key]
                if (datetime.now() - cache_time).seconds < self._cache_duration:
                    return cached_data
            
            # Query database for market info
            supa = get_supa_service_client()
            
            # Use the view to get market info
            result = supa.table('symbol_market_info') \
                .select('*') \
                .eq('symbol', symbol.upper()) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                market_info = result.data[0]
                # Cache the result
                self._market_info_cache[cache_key] = (market_info, datetime.now())
                return market_info
            
            # Fallback: Query transactions table directly
            result = supa.table('transactions') \
                .select('symbol, market_region, market_open, market_close, market_timezone, market_currency') \
                .eq('symbol', symbol.upper()) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                market_info = result.data[0]
                # Cache the result
                self._market_info_cache[cache_key] = (market_info, datetime.now())
                return market_info
            
            return None
            
        except Exception as e:
            logger.error(f"[MarketStatusService] Error getting market info for {symbol}: {e}")
            return None
    
    async def _check_market_hours(self, market_open: str, market_close: str, market_tz: str) -> bool:
        """
        Check if current time is within market hours
        
        Args:
            market_open: Market open time (e.g., "09:30:00" or "09:30")
            market_close: Market close time (e.g., "16:00:00" or "16:00")
            market_tz: Market timezone (e.g., "UTC-05" or "America/New_York")
            
        Returns:
            True if market is open, False otherwise
        """
        try:
            # Convert timezone string to proper timezone
            tz = self._parse_timezone(market_tz)
            
            # Get current time in market timezone
            now = datetime.now(tz)
            
            # Check if it's a weekend (Saturday = 5, Sunday = 6)
            if now.weekday() >= 5:
                return False
            
            # Check if it's a holiday
            if await self.is_market_holiday(now.date(), market_tz):
                return False
            
            # Parse market hours
            open_time = self._parse_time(market_open)
            close_time = self._parse_time(market_close)
            
            # Get current time components
            current_time = now.time()
            
            # Extended hours: Add 30 minutes buffer before open and after close
            # This helps catch pre-market and after-hours trading
            extended_open = (datetime.combine(now.date(), open_time) - timedelta(minutes=30)).time()
            extended_close = (datetime.combine(now.date(), close_time) + timedelta(minutes=30)).time()
            
            # Check if current time is within extended market hours
            is_open = extended_open <= current_time <= extended_close
            
            DebugLogger.info_if_enabled(
                f"[MarketStatusService] Market hours check: {current_time} in {market_tz}, "
                f"market {extended_open}-{extended_close}, is_open={is_open}",
                logger
            )
            
            return is_open
            
        except Exception as e:
            logger.error(f"[MarketStatusService] Error checking market hours: {e}")
            # On error, assume market is open
            return True
    
    def _parse_timezone(self, tz_string: str) -> timezone:
        """
        Parse timezone string to timezone object
        
        Args:
            tz_string: Timezone string (e.g., "UTC-05", "America/New_York")
            
        Returns:
            timezone object
        """
        try:
            # Handle UTC offset format (e.g., "UTC-05", "UTC+08")
            if tz_string.startswith('UTC'):
                offset_str = tz_string[3:]
                if offset_str:
                    # Parse offset
                    sign = 1 if offset_str[0] == '+' else -1
                    hours = int(offset_str[1:].split(':')[0])
                    minutes = int(offset_str[1:].split(':')[1]) if ':' in offset_str else 0
                    offset = sign * (hours * 60 + minutes)
                    return timezone(timedelta(minutes=-offset))  # Negative because UTC-05 means 5 hours behind UTC
            
            # Try to parse as timezone name
            return ZoneInfo(tz_string)
            
        except Exception:
            # Default to Eastern Time if parsing fails
            logger.warning(f"[MarketStatusService] Failed to parse timezone '{tz_string}', using US/Eastern")
            return ZoneInfo('America/New_York')
    
    def _parse_time(self, time_str: str) -> time:
        """
        Parse time string to time object
        
        Args:
            time_str: Time string (e.g., "09:30", "09:30:00")
            
        Returns:
            time object
        """
        try:
            # Try HH:MM:SS format
            if time_str.count(':') == 2:
                return datetime.strptime(time_str, '%H:%M:%S').time()
            # Try HH:MM format
            else:
                return datetime.strptime(time_str, '%H:%M').time()
        except Exception:
            # Default to 9:30 AM if parsing fails
            logger.warning(f"[MarketStatusService] Failed to parse time '{time_str}', using 09:30")
            return time(9, 30)
    
    def calculate_next_market_open(self, market_info: Dict[str, Any]) -> Optional[datetime]:
        """
        Calculate when the market will next open
        
        Args:
            market_info: Market information dict
            
        Returns:
            datetime of next market open or None
        """
        try:
            tz = self._parse_timezone(market_info['market_timezone'])
            now = datetime.now(tz)
            open_time = self._parse_time(market_info['market_open'])
            
            # Start with today's open time
            next_open = now.replace(hour=open_time.hour, minute=open_time.minute, second=0, microsecond=0)
            
            # If it's past today's open, move to tomorrow
            if now >= next_open:
                next_open += timedelta(days=1)
            
            # Skip weekends
            while next_open.weekday() >= 5:
                next_open += timedelta(days=1)
            
            return next_open
            
        except Exception as e:
            logger.error(f"[MarketStatusService] Error calculating next market open: {e}")
            return None
    
    def clear_cache(self):
        """Clear the market info cache"""
        self._market_info_cache.clear()
        self._market_status_cache.clear()
        self._last_update_cache.clear()
        logger.info("[MarketStatusService] Cache cleared")
    
    async def group_symbols_by_market(self, symbols: List[str], user_token: Optional[str] = None) -> Dict[str, List[str]]:
        """
        Group symbols by their market region for efficient market status checking
        
        Args:
            symbols: List of stock symbols
            user_token: JWT token for database access
            
        Returns:
            Dict mapping market region to list of symbols
        """
        market_groups = {}
        
        for symbol in symbols:
            market_info = await self.get_market_info_for_symbol(symbol, user_token)
            region = market_info.get('market_region', 'United States') if market_info else 'United States'
            
            if region not in market_groups:
                market_groups[region] = []
            market_groups[region].append(symbol)
        
        logger.info(f"[MarketStatusService] Grouped {len(symbols)} symbols into {len(market_groups)} markets")
        for region, syms in market_groups.items():
            logger.info(f"[MarketStatusService] {region}: {', '.join(syms)}")
        
        return market_groups
    
    async def check_markets_status(self, market_groups: Dict[str, List[str]]) -> Dict[str, bool]:
        """
        Check market status for multiple markets at once
        
        Args:
            market_groups: Dict mapping market region to list of symbols
            
        Returns:
            Dict mapping market region to open/closed status
        """
        market_status = {}
        now = datetime.now()
        
        for region in market_groups.keys():
            # Check cache first
            cache_key = f"market_status:{region}"
            if cache_key in self._market_status_cache:
                is_open, check_time = self._market_status_cache[cache_key]
                if (now - check_time).seconds < 300:  # 5 minute cache
                    market_status[region] = is_open
                    continue
            
            # Get market info for any symbol in this region
            sample_symbol = market_groups[region][0]
            market_info = await self.get_market_info_for_symbol(sample_symbol)
            
            if market_info:
                is_open = await self._check_market_hours(
                    market_info['market_open'],
                    market_info['market_close'],
                    market_info['market_timezone']
                )
            else:
                is_open = True  # Default to open if no info
            
            market_status[region] = is_open
            self._market_status_cache[cache_key] = (is_open, now)
            
            logger.info(f"[MarketStatusService] Market {region}: {'OPEN' if is_open else 'CLOSED'}")
        
        return market_status
    
    def should_update_prices(self, symbol: str, market_is_open: bool, market_info: Dict[str, Any] = None) -> bool:
        """
        Determine if we should update prices for a symbol based on market status
        ENHANCED: Ensures we capture closing prices after market close
        
        Args:
            symbol: Stock symbol
            market_is_open: Whether the market is currently open
            market_info: Optional market info with close time
            
        Returns:
            True if prices should be updated, False otherwise
        """
        if market_is_open:
            # Market is open, always update
            return True
        
        # Market is closed - check when we last updated
        last_update = self._last_update_cache.get(symbol)
        if not last_update:
            # Never updated, should update to get closing price
            return True
        
        now = datetime.now()
        today = date.today()
        
        # If market closed today, check if we updated after market close
        if market_info:
            try:
                # Parse market close time
                close_time = self._parse_time(market_info.get('market_close', '16:00'))
                market_tz = self._parse_timezone(market_info.get('market_timezone', 'UTC-05'))
                
                # Get market close datetime for today
                market_close_today = datetime.combine(today, close_time)
                market_close_today = market_close_today.replace(tzinfo=market_tz)
                
                # Convert to same timezone for comparison
                last_update_tz = last_update.replace(tzinfo=timezone.utc)
                market_close_utc = market_close_today.astimezone(timezone.utc)
                
                # If last update was before market close, we need to update to get closing price
                if last_update_tz < market_close_utc:
                    logger.info(f"[MarketStatusService] {symbol} last updated before market close, need closing price")
                    return True
                    
                # If updated after market close today, we have the closing price
                if last_update.date() == today and last_update_tz >= market_close_utc:
                    logger.info(f"[MarketStatusService] {symbol} already has today's closing price, skipping")
                    return False
                    
            except Exception as e:
                logger.warning(f"[MarketStatusService] Error checking market close time: {e}")
                # On error, be conservative and update
                return True
        
        # Default behavior: if updated today after market would have closed, skip
        if last_update.date() == today:
            # Assume market closes by 4:30 PM in most cases
            if last_update.hour >= 16 and last_update.minute >= 30:
                logger.info(f"[MarketStatusService] {symbol} already updated after market close today, skipping")
                return False
        
        # For any other case (different day, etc), update
        return True
    
    def mark_symbol_updated(self, symbol: str):
        """Mark a symbol as having been updated"""
        self._last_update_cache[symbol] = datetime.now()
    
    async def load_market_holidays(self) -> None:
        """
        Load market holidays from database into cache
        Should be called on startup or periodically
        """
        if self._holidays_loaded:
            return
        
        try:
            supa = get_supa_service_client()
            
            # Fetch all holidays
            result = supa.table('market_holidays') \
                .select('exchange, holiday_date') \
                .execute()
            
            if result.data:
                # Group holidays by exchange
                for holiday in result.data:
                    exchange = holiday['exchange']
                    holiday_date = datetime.fromisoformat(holiday['holiday_date']).date()
                    
                    if exchange not in self._holidays_cache:
                        self._holidays_cache[exchange] = set()
                    
                    self._holidays_cache[exchange].add(holiday_date)
                
                self._holidays_loaded = True
                logger.info(f"[MarketStatusService] Loaded {len(result.data)} holidays for {len(self._holidays_cache)} exchanges")
            
        except Exception as e:
            logger.error(f"[MarketStatusService] Error loading holidays: {e}")
    
    async def is_market_holiday(self, check_date: date, market_tz: str) -> bool:
        """
        Check if a specific date is a market holiday
        
        Args:
            check_date: Date to check
            market_tz: Market timezone to determine exchange
            
        Returns:
            True if holiday, False otherwise
        """
        # Ensure holidays are loaded
        if not self._holidays_loaded:
            await self.load_market_holidays()
        
        # Map timezone to exchange
        exchange = self._get_exchange_from_timezone(market_tz)
        
        # Check if date is in holidays set
        if exchange in self._holidays_cache:
            return check_date in self._holidays_cache[exchange]
        
        return False
    
    def _get_exchange_from_timezone(self, market_tz: str) -> str:
        """
        Map timezone to exchange name
        """
        # Common mappings
        tz_to_exchange = {
            'America/New_York': 'NYSE',
            'UTC-05': 'NYSE',
            'UTC-04': 'NYSE',  # During DST
            'America/Toronto': 'TSX',
            'UTC-08': 'NYSE',  # Pacific
            'UTC-07': 'NYSE',  # Pacific DST
            'Europe/London': 'LSE',
            'UTC+00': 'LSE',
            'Australia/Sydney': 'ASX',
            'UTC+10': 'ASX',
            'UTC+11': 'ASX',  # During DST
        }
        
        return tz_to_exchange.get(market_tz, 'NYSE')  # Default to NYSE
    
    async def get_missed_sessions(self, symbol: str, last_update: datetime, 
                                  user_token: Optional[str] = None) -> List[date]:
        """
        Get list of market sessions that occurred since last update
        
        Args:
            symbol: Stock symbol
            last_update: Last time we updated prices for this symbol
            user_token: JWT token for database access
            
        Returns:
            List of dates where market was open but we don't have prices
        """
        missed_sessions = []
        
        # Get market info for symbol
        market_info = await self.get_market_info_for_symbol(symbol, user_token)
        if not market_info:
            logger.warning(f"[MarketStatusService] No market info for {symbol}, cannot check missed sessions")
            return missed_sessions
        
        # Start from day after last update
        current_date = last_update.date() + timedelta(days=1)
        today = date.today()
        
        # Get timezone for holiday checking
        market_tz = market_info.get('market_timezone', 'America/New_York')
        
        while current_date <= today:
            # Skip weekends
            if current_date.weekday() < 5:  # Monday = 0, Friday = 4
                # Check if it was a holiday
                if not await self.is_market_holiday(current_date, market_tz):
                    # This was a trading day we missed
                    missed_sessions.append(current_date)
            
            current_date += timedelta(days=1)
        
        if missed_sessions:
            logger.info(f"[MarketStatusService] {symbol} has {len(missed_sessions)} missed sessions: {missed_sessions}")
        
        return missed_sessions
    
    async def get_last_trading_day(self, from_date: date = None) -> date:
        """
        Get the most recent trading day (not weekend or holiday)
        
        Args:
            from_date: Date to start checking from (default: today)
            
        Returns:
            Most recent trading day
        """
        if from_date is None:
            from_date = date.today()
        
        check_date = from_date
        
        # Go backwards until we find a trading day
        while True:
            # Not a weekend
            if check_date.weekday() < 5:
                # Not a holiday (check NYSE by default)
                if not await self.is_market_holiday(check_date, 'America/New_York'):
                    return check_date
            
            # Go back one day
            check_date -= timedelta(days=1)
            
            # Safety check - don't go back more than 10 days
            if (from_date - check_date).days > 10:
                logger.warning(f"[MarketStatusService] Could not find trading day within 10 days of {from_date}")
                return from_date
    
    async def get_next_trading_day(self, from_date: date = None) -> date:
        """
        Get the next trading day (not weekend or holiday)
        
        Args:
            from_date: Date to start checking from (default: today)
            
        Returns:
            Next trading day
        """
        if from_date is None:
            from_date = date.today()
        
        check_date = from_date + timedelta(days=1)
        
        # Go forward until we find a trading day
        while True:
            # Not a weekend
            if check_date.weekday() < 5:
                # Not a holiday (check NYSE by default)
                if not await self.is_market_holiday(check_date, 'America/New_York'):
                    return check_date
            
            # Go forward one day
            check_date += timedelta(days=1)
            
            # Safety check - don't go forward more than 10 days
            if (check_date - from_date).days > 10:
                logger.warning(f"[MarketStatusService] Could not find trading day within 10 days of {from_date}")
                return from_date
    
    async def was_market_open_on_date(self, check_date: date, symbol: str = None, 
                                      user_token: Optional[str] = None) -> bool:
        """
        Check if market was open on a specific historical date
        
        Args:
            check_date: Date to check
            symbol: Optional symbol to get specific exchange info
            user_token: JWT token for database access
            
        Returns:
            True if market was open that day
        """
        # Weekend check
        if check_date.weekday() >= 5:
            return False
        
        # Get market timezone
        market_tz = 'America/New_York'  # Default
        if symbol:
            market_info = await self.get_market_info_for_symbol(symbol, user_token)
            if market_info:
                market_tz = market_info.get('market_timezone', 'America/New_York')
        
        # Holiday check
        if await self.is_market_holiday(check_date, market_tz):
            return False
        
        return True
    
    def get_market_session_times(self, session_date: date, market_info: Dict[str, Any]) -> Tuple[datetime, datetime]:
        """
        Get the open and close times for a specific market session
        
        Args:
            session_date: Date of the market session
            market_info: Market information including timezone and hours
            
        Returns:
            Tuple of (market_open_datetime, market_close_datetime)
        """
        # Parse timezone and times
        tz = self._parse_timezone(market_info.get('market_timezone', 'America/New_York'))
        open_time = self._parse_time(market_info.get('market_open', '09:30'))
        close_time = self._parse_time(market_info.get('market_close', '16:00'))
        
        # Create datetime objects
        market_open = datetime.combine(session_date, open_time).replace(tzinfo=tz)
        market_close = datetime.combine(session_date, close_time).replace(tzinfo=tz)
        
        return market_open, market_close

# Create singleton instance
market_status_service = MarketStatusService()