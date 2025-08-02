"""
Alpha Vantage API functions for stock quotes and company overviews
Handles real-time price data and fundamental information
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json
from decimal import Decimal, InvalidOperation

from .vantage_api_client import get_vantage_client
from debug_logger import DebugLogger
try:
    from services.feature_flag_service import is_feature_enabled
except ImportError:
    # Fallback for Docker builds - disable feature flags
    def is_feature_enabled(flag_name: str, user_id: str = None) -> bool:
        """Fallback feature flag function that always returns True"""
        return True
from utils.auth_helpers import validate_user_id

logger = logging.getLogger(__name__)

def _prepare_for_cache(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Decimal objects to float for JSON serialization before caching"""
    result = {}
    for key, value in data.items():
        if isinstance(value, Decimal):
            result[key] = float(value)
        elif isinstance(value, dict):
            result[key] = _prepare_for_cache(value)
        elif isinstance(value, list):
            result[key] = [float(item) if isinstance(item, Decimal) else item for item in value]
        else:
            result[key] = value
    return result

def _safe_decimal_conversion(value: Any, user_id: Optional[str] = None) -> Decimal:
    """
    Safely convert Alpha Vantage API values to Decimal with feature flag support.
    
    Args:
        value: Value to convert to Decimal
        user_id: Optional user ID for feature flag evaluation
        
    Returns:
        Decimal representation of the value
    """
    try:
        # Handle None values first
        if value is None or value == 'None' or value == '':
            return Decimal('0')
        
        # Validate user_id if provided
        if user_id:
            user_id = validate_user_id(user_id)
        
        if is_feature_enabled("decimal_migration", user_id):
            # Precise conversion - maintain original precision
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
        else:
            # Legacy fallback - preserve precision without float conversion
            if isinstance(value, Decimal):
                return value
            elif isinstance(value, str):
                cleaned_value = value.replace('%', '').replace(',', '').strip()
                return Decimal(cleaned_value) if cleaned_value else Decimal('0')
            elif isinstance(value, (int, float)):
                return Decimal(str(value))
            else:
                return Decimal(str(value))
                
    except (ValueError, TypeError, InvalidOperation) as e:
        logger.error(f"Failed to convert Alpha Vantage value {value} to Decimal: {e}")
        return Decimal('0')

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="GLOBAL_QUOTE")
async def vantage_api_get_quote(symbol: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Get real-time quote data for a stock symbol"""
    
    client = get_vantage_client()
    
    # Check cache first
    cache_key = f"quote:{symbol}"
    cached_data = await client._get_from_cache(cache_key)
    
    if cached_data:
        return cached_data
    
    # Make API request
    params = {
        'function': 'GLOBAL_QUOTE',
        'symbol': symbol
    }
    
    try:
        response = await client._make_request(params)
        
        if 'Global Quote' not in response:
            raise Exception(f"No quote data found for {symbol}")
        
        quote = response['Global Quote']
        
        # Parse and format the data with Decimal precision
        formatted_quote = {
            'symbol': quote.get('01. symbol', symbol),
            'price': _safe_decimal_conversion(quote.get('05. price', 0), user_id),
            'change': _safe_decimal_conversion(quote.get('09. change', 0), user_id),
            'change_percent': _safe_decimal_conversion(quote.get('10. change percent', '0%'), user_id),
            'volume': Decimal(str(quote.get('06. volume', 0))),
            'latest_trading_day': quote.get('07. latest trading day', ''),
            'previous_close': _safe_decimal_conversion(quote.get('08. previous close', 0), user_id),
            'open': _safe_decimal_conversion(quote.get('02. open', 0), user_id),
            'high': _safe_decimal_conversion(quote.get('03. high', 0), user_id),
            'low': _safe_decimal_conversion(quote.get('04. low', 0), user_id)
        }
        
        # Cache the result (convert Decimals to floats for JSON serialization)
        cache_data = _prepare_for_cache(formatted_quote)
        await client._save_to_cache(cache_key, cache_data)
        
        return {
            "status": "success",
            "data": formatted_quote
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_get_quote",
            error=e,
            symbol=symbol
        )
        return {
            "status": "error", 
            "error": str(e),
            "data": None
        }

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="OVERVIEW")
async def vantage_api_get_overview(symbol: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Get company overview and fundamental data"""
    client = get_vantage_client()
    
    # Check cache first (longer TTL for overview data)
    cache_key = f"overview:{symbol}"
    cached_data = await client._get_from_cache(cache_key)
    
    if cached_data:
        return cached_data
    
    # Make API request
    params = {
        'function': 'OVERVIEW',
        'symbol': symbol
    }
    
    try:
        response = await client._make_request(params)
        logger.info(f"[vantage_api_get_overview] Raw API response for {symbol}: {type(response)} with keys: {list(response.keys()) if isinstance(response, dict) else 'not dict'}")
        
        # Check if we got valid data
        if not response or 'Symbol' not in response:
            logger.warning(f"[vantage_api_quotes.py::vantage_api_get_overview] No overview data for {symbol}. Response: {response}")
            return {}
        
        # Extract and format key metrics
        formatted_overview = {
            'symbol': response.get('Symbol', symbol),
            'name': response.get('Name', ''),
            'description': response.get('Description', ''),
            'exchange': response.get('Exchange', ''),
            'currency': response.get('Currency', 'USD'),
            'country': response.get('Country', ''),
            'sector': response.get('Sector', ''),
            'industry': response.get('Industry', ''),
            
            # Valuation metrics
            'market_cap': _safe_decimal_conversion(response.get('MarketCapitalization', 0), user_id),
            'pe_ratio': _safe_decimal_conversion(response.get('PERatio', 0), user_id),
            'peg_ratio': _safe_decimal_conversion(response.get('PEGRatio', 0), user_id),
            'book_value': _safe_decimal_conversion(response.get('BookValue', 0), user_id),
            'price_to_book': _safe_decimal_conversion(response.get('PriceToBookRatio', 0), user_id),
            'price_to_sales': _safe_decimal_conversion(response.get('PriceToSalesRatioTTM', 0), user_id),
            'enterprise_value': _safe_decimal_conversion(response.get('EnterpriseValue', 0), user_id),
            'enterprise_to_revenue': _safe_decimal_conversion(response.get('EnterpriseValueToRevenueTTM', 0), user_id),
            'enterprise_to_ebitda': _safe_decimal_conversion(response.get('EnterpriseValueToEBITDA', 0), user_id),
            
            # Financial metrics
            'revenue_ttm': _safe_decimal_conversion(response.get('RevenueTTM', 0), user_id),
            'profit_margin': _safe_decimal_conversion(response.get('ProfitMargin', 0), user_id),
            'operating_margin': _safe_decimal_conversion(response.get('OperatingMarginTTM', 0), user_id),
            'return_on_assets': _safe_decimal_conversion(response.get('ReturnOnAssetsTTM', 0), user_id),
            'return_on_equity': _safe_decimal_conversion(response.get('ReturnOnEquityTTM', 0), user_id),
            'revenue_per_share': _safe_decimal_conversion(response.get('RevenuePerShareTTM', 0), user_id),
            'quarterly_earnings_growth': _safe_decimal_conversion(response.get('QuarterlyEarningsGrowthYOY', 0), user_id),
            'quarterly_revenue_growth': _safe_decimal_conversion(response.get('QuarterlyRevenueGrowthYOY', 0), user_id),
            
            # Per share data
            'eps': _safe_decimal_conversion(response.get('EPS', 0), user_id),
            'eps_diluted': _safe_decimal_conversion(response.get('DilutedEPSTTM', 0), user_id),
            'dividend_per_share': _safe_decimal_conversion(response.get('DividendPerShare', 0), user_id),
            'dividend_yield': _safe_decimal_conversion(response.get('DividendYield', 0), user_id),
            
            # Trading information
            'beta': _safe_decimal_conversion(response.get('Beta', 0), user_id),
            '52_week_high': _safe_decimal_conversion(response.get('52WeekHigh', 0), user_id),
            '52_week_low': _safe_decimal_conversion(response.get('52WeekLow', 0), user_id),
            '50_day_ma': _safe_decimal_conversion(response.get('50DayMovingAverage', 0), user_id),
            '200_day_ma': _safe_decimal_conversion(response.get('200DayMovingAverage', 0), user_id),
            
            # Shares data
            'shares_outstanding': _safe_decimal_conversion(response.get('SharesOutstanding', 0), user_id),
            'shares_float': _safe_decimal_conversion(response.get('SharesFloat', 0), user_id),
            
            # Dates
            'dividend_date': response.get('DividendDate', ''),
            'ex_dividend_date': response.get('ExDividendDate', ''),
            'earnings_date': response.get('EarningsDate', ''),
            'fiscal_year_end': response.get('FiscalYearEnd', ''),
            'latest_quarter': response.get('LatestQuarter', '')
        }
        
        # Cache the result with longer TTL for overview data
        await client._save_to_cache(cache_key, formatted_overview)
        
    
        
        return formatted_overview
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_get_overview",
            error=e,
            symbol=symbol
        )
        # Return empty dict instead of raising to allow partial data
        return {}

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="FETCH_AND_STORE_HISTORICAL_DATA")
async def vantage_api_fetch_and_store_historical_data(symbol: str, start_date: Optional[str] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
    
    client = get_vantage_client()
    
    # Import here to avoid circular imports
    from supa_api.supa_api_historical_prices import supa_api_store_historical_prices, supa_api_check_historical_data_coverage
    
    try:
        # Check if we already have recent data for this symbol
        today = datetime.now().date().strftime('%Y-%m-%d')
        thirty_days_ago = (datetime.now().date() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        coverage = await supa_api_check_historical_data_coverage(symbol, thirty_days_ago, today)
        
        if coverage['has_complete_coverage']:
    
            return {
                'success': True,
                'symbol': symbol,
                'message': 'Data already exists',
                'records_stored': 0
            }
        
        # Make API request for FULL daily time series
        params = {
            'function': 'TIME_SERIES_DAILY_ADJUSTED',
            'symbol': symbol,
            'outputsize': 'full'  # Get ALL available historical data
        }
        
        response = await client._make_request(params)
        
        if 'Time Series (Daily)' not in response:
            logger.warning(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] No time series data found for {symbol}")
            raise Exception(f"No historical data found for {symbol}")
        
        time_series = response['Time Series (Daily)']
        
        # Convert to list format for database storage
        price_records = []
        for date_str, price_data in time_series.items():
            # Filter by start_date if provided
            if start_date and date_str < start_date:
                continue
                
            record = {
                'date': date_str,
                'open': _safe_decimal_conversion(price_data.get('1. open', 0), user_id),
                'high': _safe_decimal_conversion(price_data.get('2. high', 0), user_id),
                'low': _safe_decimal_conversion(price_data.get('3. low', 0), user_id),
                'close': _safe_decimal_conversion(price_data.get('4. close', 0), user_id),
                'adjusted_close': _safe_decimal_conversion(price_data.get('5. adjusted close', price_data.get('4. close', 0)), user_id),
                'volume': Decimal(str(price_data.get('5. volume', 0))) if '5. volume' in price_data else Decimal(str(price_data.get('6. volume', 0)))
            }
            price_records.append(record)
        # Store in database
        if price_records:
            store_result = await supa_api_store_historical_prices(symbol, price_records)
            
    
            return {
                'success': True,
                'symbol': symbol,
                'records_fetched': len(price_records),
                'records_stored': store_result.get('records_stored', 0),
                'date_range': store_result.get('date_range'),
                'message': f"Successfully stored historical data for {symbol}"
            }
        else:
            logger.warning(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] No price records to store for {symbol}")
            return {
                'success': False,
                'symbol': symbol,
                'error': 'No price records found to store'
            }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_fetch_and_store_historical_data",
            error=e,
            symbol=symbol,
            start_date=start_date
        )
        raise

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="GET_HISTORICAL_PRICE_FROM_DB")
async def vantage_api_get_historical_price(symbol: str, date: str) -> Dict[str, Any]:
    
    # Import here to avoid circular imports
    from supa_api.supa_api_historical_prices import supa_api_get_historical_price_for_date
    
    try:
        # Parameter validation
        if not symbol:
            raise ValueError("Symbol parameter is required")
        
        if not date:
            raise ValueError("Date parameter is required")
        
        # Normalize symbol
        normalized_symbol = symbol.upper().strip()
        
        # Check database first
        db_result = await supa_api_get_historical_price_for_date(normalized_symbol, date)
        
        if db_result:
            return db_result
        
        # Database miss - fetch from Alpha Vantage
        from supa_api.supa_api_historical_prices import supa_api_get_symbols_needing_historical_data
        
        symbols_data = await supa_api_get_symbols_needing_historical_data()
        
        start_date = None
        
        # Find the earliest transaction date for this symbol
        for symbol_info in symbols_data:
            if symbol_info['symbol'] == normalized_symbol:
                start_date = symbol_info['earliest_transaction_date']
                break
        
        if not start_date:
            # Default to 5 years ago if no transactions found for this symbol
            from datetime import datetime, timedelta
            default_start = (datetime.now().date() - timedelta(days=5*365)).strftime('%Y-%m-%d')
            start_date = default_start
        
        today = datetime.now().date().strftime('%Y-%m-%d')
        
        # Fetch and store bulk historical data
        fetch_result = await vantage_api_fetch_and_store_historical_data(normalized_symbol, start_date)
        
        if not fetch_result.get('success', False):
            logger.error(f"Failed to fetch historical data for {normalized_symbol}: {fetch_result.get('error', 'Unknown error')}")
            raise Exception(f"Failed to fetch historical data for {normalized_symbol}: {fetch_result.get('error', 'Unknown error')}")
        
        # Retrieve requested date from newly populated database
        db_result = await supa_api_get_historical_price_for_date(normalized_symbol, date)
        
        if db_result:
            return db_result
        else:
            logger.error(f"No trading data found for {normalized_symbol} near date {date} even after fetching from Alpha Vantage")
            raise Exception(f"No trading data found for {normalized_symbol} near date {date} even after fetching from Alpha Vantage")
        
    except Exception as e:
        logger.error(f"Error getting historical price for {symbol} on {date}: {str(e)}")
        
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_get_historical_price",
            error=e,
            symbol=symbol,
            date=date
        )
        raise

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="TIME_SERIES_DAILY_ADJUSTED")
async def vantage_api_get_daily_adjusted(symbol: str, outputsize: str = 'compact', user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get daily adjusted time series data from Alpha Vantage
    
    This function fetches comprehensive daily price data including:
    - Open, High, Low, Close prices
    - Adjusted close prices (accounting for splits and dividends)
    - Volume
    - Dividend amount
    - Split coefficient
    
    Args:
        symbol: Stock ticker symbol
        outputsize: 'compact' (last 100 days) or 'full' (all data)
        
    Returns:
        Dictionary with date keys and price data values
    """
    logger.info(f"[vantage_api_quotes.py::vantage_api_get_daily_adjusted] Fetching daily adjusted data for {symbol} (outputsize={outputsize})")
    
    client = get_vantage_client()
    
    # Check cache first
    cache_key = f"daily_adjusted:{symbol}:{outputsize}"
    cached_data = await client._get_from_cache(cache_key)
    
    if cached_data:
        logger.info(f"[vantange_api_quotes.py::vantage_api_get_daily_adjusted] Cache hit for {symbol}")
        # Ensure cached data is in the expected format
        if isinstance(cached_data, dict) and 'status' not in cached_data:
            # This is raw time series data from old cache format
            return {
                'status': 'success',
                'data': cached_data
            }
        return cached_data
    
    # Make API request
    params = {
        'function': 'TIME_SERIES_DAILY_ADJUSTED',
        'symbol': symbol,
        'outputsize': outputsize  # Default to compact (100 days)
    }
    
    try:
        response = await client._make_request(params)
        
        if 'Time Series (Daily)' not in response:
            logger.error(f"Alpha Vantage response missing time series for {symbol}")
            if 'Error Message' in response:
                logger.error(f"Alpha Vantage Error: {response['Error Message']}")
            elif 'Note' in response:
                logger.error(f"Alpha Vantage API rate limit: {response['Note']}")
            return {
                'status': 'error',
                'error': response.get('Error Message', response.get('Note', 'No time series data'))
            }
        
        time_series = response['Time Series (Daily)']
        
        # Cache the result (expires in 4 hours for historical data)
        await client._save_to_cache(cache_key, time_series)
        
        # Cache the result
        
        # Return in the expected format
        return {
            'status': 'success',
            'data': time_series
        }
        
    except Exception as e:
        logger.error(f"Alpha Vantage API error for {symbol}: {str(e)}")
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_get_daily_adjusted",
            error=e,
            symbol=symbol
        )
        return {
            'status': 'error',
            'error': str(e)
        }

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="DIVIDENDS")
async def vantage_api_get_dividends(symbol: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get dividend data for a stock symbol from Alpha Vantage"""
    client = get_vantage_client()
    
    # Check cache first (longer TTL for dividend data)
    cache_key = f"dividends:{symbol}"
    cached_data = await client._get_from_cache(cache_key)
    
    if cached_data and 'dividends' in cached_data:
        DebugLogger.info_if_enabled(f"[vantage_api_quotes.py] Cache HIT for {symbol} dividends", logger)
        return cached_data['dividends']
    
    DebugLogger.info_if_enabled(f"[vantage_api_quotes.py] Cache MISS for {symbol}, fetching from API", logger)
    params = {
        'function': 'DIVIDENDS',
        'symbol': symbol
    }
    
    try:
        response = await client._make_request(params)
        DebugLogger.info_if_enabled(f"[vantage_api_quotes.py] API response received for {symbol}: {len(response.get('data', []))} items", logger)
        
        if 'data' not in response:
            logger.warning(f"[vantage_api_quotes.py] No dividend data in response for {symbol}")
            return []
        
        dividends = []
        for item in response['data']:
            DebugLogger.info_if_enabled(f"[vantage_api_quotes.py] Parsing dividend: ex_date={item.get('ex_dividend_date')}, amount={item.get('amount')}", logger)
            dividends.append({
                'ex_date': item.get('ex_dividend_date'),
                'declaration_date': item.get('declaration_date'),
                'record_date': item.get('record_date'),
                'payment_date': item.get('payment_date'),
                'amount': _safe_decimal_conversion(item.get('amount', 0), user_id),
                'currency': 'USD'  # Assume USD or add from response if available
            })
        
        # Cache the result
        if dividends:
            await client._save_to_cache(cache_key, {'dividends': dividends})
            DebugLogger.info_if_enabled(f"[vantage_api_quotes.py] Cached {len(dividends)} dividends for {symbol}", logger)
        
        # logger.info(f"[vantage_api_quotes.py::vantage_api_get_dividends] Found {len(dividends)} dividends for {symbol}")
        return dividends
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_get_dividends",
            error=e,
            symbol=symbol
        )
        return []

def _safe_float(value: Any) -> Decimal:
    """DEPRECATED: Use _safe_decimal_conversion instead for proper financial calculations"""
    logger.warning("_safe_float is deprecated, use _safe_decimal_conversion instead")
    if value is None or value == 'None' or value == '':
        return Decimal('0')
    try:
        return Decimal(str(value))
    except (ValueError, TypeError, InvalidOperation):
        return Decimal('0') 