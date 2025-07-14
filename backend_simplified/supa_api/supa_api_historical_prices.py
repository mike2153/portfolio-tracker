"""
Supabase API functions for historical stock price data management
Handles storing and retrieving historical price data for portfolio calculations
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import asyncio

from .supa_api_client import get_supa_service_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="STORE_HISTORICAL_PRICES")
async def supa_api_store_historical_prices(symbol: str, price_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Store historical price data for a symbol in the database
    
    Args:
        symbol: Stock ticker symbol
        price_data: List of price data dictionaries with date, open, high, low, close, volume, etc.
    
    Returns:
        Dict with success status and number of records stored
    """
    logger.info(f"[supa_api_historical_prices.py::supa_api_store_historical_prices] Storing {len(price_data)} price records for {symbol}")
    
    client = get_supa_service_client()
    
    try:
        # Prepare data for database insertion
        db_records = []
        for data_point in price_data:
            db_record = {
                'symbol': symbol.upper(),
                'date': data_point['date'],
                'open': float(data_point['open']),
                'high': float(data_point['high']),
                'low': float(data_point['low']),
                'close': float(data_point['close']),
                'adjusted_close': float(data_point.get('adjusted_close', data_point['close'])),
                'volume': int(data_point.get('volume', 0)),
                'dividend_amount': float(data_point.get('dividend_amount', 0)),
                'split_coefficient': float(data_point.get('split_coefficient', 1))
            }
            db_records.append(db_record)
        
        # Use upsert to handle duplicate dates
        response = client.table('historical_prices').upsert(
            db_records,
            on_conflict='symbol,date'
        ).execute()
        
        if hasattr(response, 'data') and response.data:
            stored_count = len(response.data)
            logger.info(f"[supa_api_historical_prices.py::supa_api_store_historical_prices] Successfully stored {stored_count} records for {symbol}")
            
            return {
                'success': True,
                'symbol': symbol,
                'records_stored': stored_count,
                'date_range': {
                    'start': min(record['date'] for record in db_records),
                    'end': max(record['date'] for record in db_records)
                }
            }
        else:
            logger.warning(f"[supa_api_historical_prices.py::supa_api_store_historical_prices] No data returned from upsert for {symbol}")
            return {
                'success': False,
                'symbol': symbol,
                'error': 'No data returned from database operation'
            }
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_historical_prices.py",
            function_name="supa_api_store_historical_prices",
            error=e,
            symbol=symbol,
            data_count=len(price_data)
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_HISTORICAL_PRICE_FOR_DATE")
async def supa_api_get_historical_price_for_date(symbol: str, target_date: str) -> Optional[Dict[str, Any]]:
    """
    Get historical price data for a specific symbol and date from database
    Uses database function to find exact date or closest trading day
    
    Args:
        symbol: Stock ticker symbol
        target_date: Date in YYYY-MM-DD format
    
    Returns:
        Price data dict or None if not found
    """
    logger.info(f"[supa_api_historical_prices.py::supa_api_get_historical_price_for_date] Getting price for {symbol} on {target_date}")
    
    client = get_supa_service_client()
    
    try:
        # Use the database function to get price data
        response = client.rpc(
            'get_historical_price_for_date',
            {
                'p_symbol': symbol.upper(),
                'p_date': target_date
            }
        ).execute()
        
        if hasattr(response, 'data') and response.data and len(response.data) > 0:
            price_record = response.data[0]
            
            result = {
                'symbol': price_record['symbol'],
                'date': str(price_record['date']),
                'requested_date': target_date,
                'open': float(price_record['open']),
                'high': float(price_record['high']),
                'low': float(price_record['low']),
                'close': float(price_record['close']),
                'adjusted_close': float(price_record['adjusted_close']),
                'volume': int(price_record['volume']),
                'is_exact_date': bool(price_record['is_exact_date'])
            }
            
           # logger.info(f"[supa_api_historical_prices.py::supa_api_get_historical_price_for_date] Found price: {symbol} @ ${result['close']} on {result['date']}")
            
            return result
        else:
            logger.info(f"[supa_api_historical_prices.py::supa_api_get_historical_price_for_date] No price data found for {symbol} on {target_date}")
            return None
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_historical_prices.py",
            function_name="supa_api_get_historical_price_for_date",
            error=e,
            symbol=symbol,
            target_date=target_date
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="CHECK_HISTORICAL_DATA_COVERAGE")
async def supa_api_check_historical_data_coverage(symbol: str, start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Check if we have complete historical data coverage for a symbol in a date range
    
    Args:
        symbol: Stock ticker symbol
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    
    Returns:
        Dict with coverage information
    """
    logger.info(f"[supa_api_historical_prices.py::supa_api_check_historical_data_coverage] Checking coverage for {symbol} from {start_date} to {end_date}")
    
    client = get_supa_service_client()
    
    try:
        # Get all dates we have for this symbol in the range
        response = client.table('historical_prices').select('date').eq(
            'symbol', symbol.upper()
        ).gte('date', start_date).lte('date', end_date).order('date').execute()
        
        existing_dates = []
        if hasattr(response, 'data') and response.data:
            existing_dates = [record['date'] for record in response.data]
        
        # Calculate expected trading days (rough estimate - exclude weekends)
        start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        expected_days = 0
        current_date = start_dt
        while current_date <= end_dt:
            # Count weekdays only (rough estimate of trading days)
            if current_date.weekday() < 5:  # Monday = 0, Friday = 4
                expected_days += 1
            current_date += timedelta(days=1)
        
        coverage_percentage = (len(existing_dates) / expected_days * 100) if expected_days > 0 else 0
        
        result = {
            'symbol': symbol,
            'start_date': start_date,
            'end_date': end_date,
            'existing_records': len(existing_dates),
            'expected_trading_days': expected_days,
            'coverage_percentage': round(coverage_percentage, 2),
            'has_complete_coverage': coverage_percentage >= 90,  # 90% threshold for "complete"
            'earliest_date': existing_dates[0] if existing_dates else None,
            'latest_date': existing_dates[-1] if existing_dates else None
        }
        
        logger.info(f"[supa_api_historical_prices.py::supa_api_check_historical_data_coverage] Coverage for {symbol}: {coverage_percentage:.1f}%")
        
        return result
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_historical_prices.py",
            function_name="supa_api_check_historical_data_coverage",
            error=e,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_SYMBOLS_NEEDING_HISTORICAL_DATA")
async def supa_api_get_symbols_needing_historical_data() -> List[Dict[str, Any]]:
    """
    Get list of symbols that users have transactions for, along with date ranges needed
    This helps identify which symbols need historical data fetching
    
    Returns:
        List of symbols with their earliest transaction dates
    """
   # logger.info(f"[supa_api_historical_prices.py::supa_api_get_symbols_needing_historical_data] Getting symbols needing historical data")
    
    client = get_supa_service_client()
    
    try:
        # Get all unique symbols from transactions with their earliest dates
        response = client.table('transactions').select(
            'symbol, date'
        ).order('symbol, date').execute()
        
        if not (hasattr(response, 'data') and response.data):
            return []
        
        # Group by symbol and find earliest date for each
        symbol_dates = {}
        for transaction in response.data:
            symbol = transaction['symbol'].upper()
            trans_date = transaction['date']
            
            if symbol not in symbol_dates:
                symbol_dates[symbol] = trans_date
            else:
                # Keep the earliest date
                if trans_date < symbol_dates[symbol]:
                    symbol_dates[symbol] = trans_date
        
        # Convert to list format
        symbols_list = []
        today = datetime.now().date().strftime('%Y-%m-%d')
        
        for symbol, earliest_date in symbol_dates.items():
            symbols_list.append({
                'symbol': symbol,
                'earliest_transaction_date': earliest_date,
                'data_needed_until': today
            })
        
        logger.info(f"[supa_api_historical_prices.py::supa_api_get_symbols_needing_historical_data] Found {len(symbols_list)} symbols needing data")
        
        return symbols_list
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_historical_prices.py",
            function_name="supa_api_get_symbols_needing_historical_data",
            error=e
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_PRICE_HISTORY_FOR_PORTFOLIO")
async def supa_api_get_price_history_for_portfolio(symbols: List[str], start_date: str, end_date: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get historical price data for multiple symbols for portfolio calculations
    
    Args:
        symbols: List of stock ticker symbols
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
    
    Returns:
        Dict mapping symbols to their price history
    """
    logger.info(f"[supa_api_historical_prices.py::supa_api_get_price_history_for_portfolio] Getting price history for {len(symbols)} symbols from {start_date} to {end_date}")
    
    client = get_supa_service_client()
    
    try:
        # Get price data for all symbols in the date range
        response = client.table('historical_prices').select(
            'symbol, date, open, high, low, close, adjusted_close, volume'
        ).in_('symbol', [s.upper() for s in symbols]).gte(
            'date', start_date
        ).lte('date', end_date).order('symbol, date').execute()
        
        # Group by symbol
        symbol_prices = {}
        
        if hasattr(response, 'data') and response.data:
            for record in response.data:
                symbol = record['symbol']
                if symbol not in symbol_prices:
                    symbol_prices[symbol] = []
                
                symbol_prices[symbol].append({
                    'date': record['date'],
                    'open': float(record['open']),
                    'high': float(record['high']),
                    'low': float(record['low']),
                    'close': float(record['close']),
                    'adjusted_close': float(record['adjusted_close']),
                    'volume': int(record['volume'])
                })
        
        logger.info(f"[supa_api_historical_prices.py::supa_api_get_price_history_for_portfolio] Retrieved price history for {len(symbol_prices)} symbols")
        
        return symbol_prices
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_historical_prices.py",
            function_name="supa_api_get_price_history_for_portfolio",
            error=e,
            symbols=symbols,
            start_date=start_date,
            end_date=end_date
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_HISTORICAL_PRICES_RANGE")
async def supa_api_get_historical_prices(
    symbol: str,
    start_date: str,
    end_date: str,
    user_token: str = None
) -> List[Dict[str, Any]]:
    """
    Get historical price data from database for a symbol within date range
    
    Args:
        symbol: Stock ticker symbol
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        user_token: JWT token (not used for price data but kept for consistency)
        
    Returns:
        List of price records sorted by date (newest first)
    """
    logger.info(f"[supa_api_historical_prices.py::supa_api_get_historical_prices] Querying price data for {symbol} from {start_date} to {end_date}")
    
    client = get_supa_service_client()
    
    try:
        # Query historical prices table
        response = client.table('historical_prices') \
            .select('*') \
            .eq('symbol', symbol.upper()) \
            .gte('date', start_date) \
            .lte('date', end_date) \
            .order('date', desc=True) \
            .execute()
        
        if hasattr(response, 'data') and response.data:
            logger.info(f"[supa_api_historical_prices.py::supa_api_get_historical_prices] Found {len(response.data)} price records for {symbol}")
            return response.data
        else:
            logger.info(f"[supa_api_historical_prices.py::supa_api_get_historical_prices] No price data found for {symbol} in date range")
            return []
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_historical_prices.py",
            function_name="supa_api_get_historical_prices",
            error=e,
            symbol=symbol,
            start_date=start_date,
            end_date=end_date
        )
        return []

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="STORE_HISTORICAL_PRICES_BATCH")
async def supa_api_store_historical_prices_batch(
    price_data: List[Dict[str, Any]],
    user_token: str = None
) -> bool:
    """
    Store historical price data in database with upsert logic (batch version)
    
    Args:
        price_data: List of price records with symbol, date, open, high, low, close, volume
        user_token: JWT token (not used for price data but kept for consistency)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        if not price_data:
            logger.warning("[supa_api_historical_prices.py::supa_api_store_historical_prices_batch] No price data provided to store")
            return True
        
        client = get_supa_service_client()
        
        # Prepare data for upsert
        formatted_data = []
        for record in price_data:
            formatted_record = {
                'symbol': record['symbol'].upper(),
                'date': record['date'],
                'open': float(record.get('open', 0)),
                'high': float(record.get('high', 0)),
                'low': float(record.get('low', 0)),
                'close': float(record.get('close', 0)),
                'volume': int(record.get('volume', 0)),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            
            # Add optional fields if present
            if 'adjusted_close' in record:
                formatted_record['adjusted_close'] = float(record['adjusted_close'])
            if 'dividend_amount' in record:
                formatted_record['dividend_amount'] = float(record['dividend_amount'])
            if 'split_coefficient' in record:
                formatted_record['split_coefficient'] = float(record['split_coefficient'])
                
            formatted_data.append(formatted_record)
        
        logger.info(f"[supa_api_historical_prices.py::supa_api_store_historical_prices_batch] Storing {len(formatted_data)} price records")
        
        # Use upsert to handle duplicates (on conflict with symbol+date, update the record)
        response = client.table('historical_prices') \
            .upsert(formatted_data, on_conflict='symbol,date') \
            .execute()
        
        if hasattr(response, 'data') and response.data:
            logger.info(f"[supa_api_historical_prices.py::supa_api_store_historical_prices_batch] Successfully stored {len(response.data)} price records")
            return True
        else:
            logger.warning("[supa_api_historical_prices.py::supa_api_store_historical_prices_batch] Upsert returned no data")
            return False
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_historical_prices.py",
            function_name="supa_api_store_historical_prices_batch",
            error=e,
            records_count=len(price_data) if price_data else 0
        )
        return False 