#!/usr/bin/env python3
"""
Load market holidays from pandas_market_calendars into the database
Run this script to populate the market_holidays table with upcoming holidays
"""

import sys
import os
# Add parent directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import logging
from datetime import datetime, timedelta
import pandas_market_calendars as mcal
from typing import List, Dict, Any

from supa_api.supa_api_client import get_supa_service_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Exchanges to load holidays for
EXCHANGES_TO_LOAD = [
    'NYSE',      # New York Stock Exchange
    'NASDAQ',    # NASDAQ
    'TSX',       # Toronto Stock Exchange
    'LSE',       # London Stock Exchange
    'ASX',       # Australian Securities Exchange
    'EUREX',     # European Exchange
    'JPX',       # Japan Exchange
]

async def load_holidays_for_exchange(exchange: str, years_ahead: int = 2) -> List[Dict[str, Any]]:
    """
    Load holidays for a specific exchange
    
    Args:
        exchange: Exchange name (e.g., 'NYSE')
        years_ahead: Number of years ahead to load holidays for
        
    Returns:
        List of holiday records
    """
    try:
        # Get calendar for exchange
        calendar = mcal.get_calendar(exchange)
        
        # Date range
        start_date = datetime.now()
        end_date = start_date + timedelta(days=365 * years_ahead)
        
        # Get holidays
        holidays = calendar.holidays(start_date=start_date, end_date=end_date)
        
        # Convert to records
        holiday_records = []
        for holiday_date in holidays:
            # Get holiday name if available
            holiday_name = "Market Holiday"  # Default
            
            # Some calendars provide holiday names
            if hasattr(calendar, 'special_dates'):
                for name, dates in calendar.special_dates.items():
                    if holiday_date in dates:
                        holiday_name = name
                        break
            
            holiday_records.append({
                'exchange': exchange,
                'holiday_date': holiday_date.strftime('%Y-%m-%d'),
                'holiday_name': holiday_name,
                'market_status': 'closed'
            })
        
        # Also check for early close days if the calendar supports it
        if hasattr(calendar, 'early_closes'):
            early_closes = calendar.early_closes(start_date=start_date, end_date=end_date)
            for early_close_date in early_closes.index:
                holiday_records.append({
                    'exchange': exchange,
                    'holiday_date': early_close_date.strftime('%Y-%m-%d'),
                    'holiday_name': 'Early Close',
                    'market_status': 'early_close',
                    'early_close_time': early_closes.loc[early_close_date].strftime('%H:%M:%S')
                })
        
        logger.info(f"Found {len(holiday_records)} holidays/special days for {exchange}")
        return holiday_records
        
    except Exception as e:
        logger.error(f"Error loading holidays for {exchange}: {e}")
        return []

async def load_all_holidays():
    """
    Load holidays for all configured exchanges
    """
    try:
        logger.info("Starting market holiday loader...")
        
        # Ensure pandas_market_calendars is available
        try:
            import pandas_market_calendars as mcal
            logger.info(f"pandas_market_calendars version: {mcal.__version__}")
        except ImportError:
            logger.error("pandas_market_calendars not installed. Run: pip install pandas_market_calendars")
            return
        
        # Get Supabase client
        supa = get_supa_service_client()
        
        # Load holidays for each exchange
        all_holidays = []
        for exchange in EXCHANGES_TO_LOAD:
            logger.info(f"Loading holidays for {exchange}...")
            holidays = await load_holidays_for_exchange(exchange)
            all_holidays.extend(holidays)
        
        logger.info(f"Total holidays to insert: {len(all_holidays)}")
        
        # Insert into database in batches
        batch_size = 100
        for i in range(0, len(all_holidays), batch_size):
            batch = all_holidays[i:i + batch_size]
            
            # Upsert batch (update if exists, insert if not)
            result = supa.table('market_holidays') \
                .upsert(batch, on_conflict='exchange,holiday_date') \
                .execute()
            
            logger.info(f"Inserted batch {i//batch_size + 1}/{(len(all_holidays) + batch_size - 1)//batch_size}")
        
        logger.info("✅ Market holidays loaded successfully!")
        
        # Show summary
        result = supa.table('market_holidays') \
            .select('exchange', count='exact') \
            .execute()
        
        logger.info(f"Total holidays in database: {result.count}")
        
    except Exception as e:
        logger.error(f"Error loading holidays: {e}")
        raise

async def main():
    """
    Main entry point
    """
    await load_all_holidays()

if __name__ == "__main__":
    asyncio.run(main())