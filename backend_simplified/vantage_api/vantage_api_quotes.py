"""
Alpha Vantage API functions for stock quotes and company overviews
Handles real-time price data and fundamental information
"""
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from .vantage_api_client import get_vantage_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="GLOBAL_QUOTE")
async def vantage_api_get_quote(symbol: str) -> Dict[str, Any]:
    """Get real-time quote data for a stock symbol"""
    logger.info(f"[vantage_api_quotes.py::vantage_api_get_quote] Getting quote for: {symbol}")
    
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
        
        # Parse and format the data
        formatted_quote = {
            'symbol': quote.get('01. symbol', symbol),
            'price': float(quote.get('05. price', 0)),
            'change': float(quote.get('09. change', 0)),
            'change_percent': quote.get('10. change percent', '0%').replace('%', ''),
            'volume': int(quote.get('06. volume', 0)),
            'latest_trading_day': quote.get('07. latest trading day', ''),
            'previous_close': float(quote.get('08. previous close', 0)),
            'open': float(quote.get('02. open', 0)),
            'high': float(quote.get('03. high', 0)),
            'low': float(quote.get('04. low', 0))
        }
        
        # Cache the result
        await client._save_to_cache(cache_key, formatted_quote)
        
        logger.info(f"[vantage_api_quotes.py::vantage_api_get_quote] Quote retrieved: {symbol} @ ${formatted_quote['price']}")
        
        return formatted_quote
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_get_quote",
            error=e,
            symbol=symbol
        )
        raise

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="OVERVIEW")
async def vantage_api_get_overview(symbol: str) -> Dict[str, Any]:
    """Get company overview and fundamental data"""
    logger.info(f"[vantage_api_quotes.py::vantage_api_get_overview] Getting overview for: {symbol}")
    
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
        
        # Check if we got valid data
        if not response or 'Symbol' not in response:
            logger.warning(f"[vantage_api_quotes.py::vantage_api_get_overview] No overview data for {symbol}")
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
            'market_cap': _safe_float(response.get('MarketCapitalization', 0)),
            'pe_ratio': _safe_float(response.get('PERatio', 0)),
            'peg_ratio': _safe_float(response.get('PEGRatio', 0)),
            'book_value': _safe_float(response.get('BookValue', 0)),
            'price_to_book': _safe_float(response.get('PriceToBookRatio', 0)),
            'price_to_sales': _safe_float(response.get('PriceToSalesRatioTTM', 0)),
            'enterprise_value': _safe_float(response.get('EnterpriseValue', 0)),
            'enterprise_to_revenue': _safe_float(response.get('EnterpriseValueToRevenueTTM', 0)),
            'enterprise_to_ebitda': _safe_float(response.get('EnterpriseValueToEBITDA', 0)),
            
            # Financial metrics
            'revenue_ttm': _safe_float(response.get('RevenueTTM', 0)),
            'profit_margin': _safe_float(response.get('ProfitMargin', 0)),
            'operating_margin': _safe_float(response.get('OperatingMarginTTM', 0)),
            'return_on_assets': _safe_float(response.get('ReturnOnAssetsTTM', 0)),
            'return_on_equity': _safe_float(response.get('ReturnOnEquityTTM', 0)),
            'revenue_per_share': _safe_float(response.get('RevenuePerShareTTM', 0)),
            'quarterly_earnings_growth': _safe_float(response.get('QuarterlyEarningsGrowthYOY', 0)),
            'quarterly_revenue_growth': _safe_float(response.get('QuarterlyRevenueGrowthYOY', 0)),
            
            # Per share data
            'eps': _safe_float(response.get('EPS', 0)),
            'eps_diluted': _safe_float(response.get('DilutedEPSTTM', 0)),
            'dividend_per_share': _safe_float(response.get('DividendPerShare', 0)),
            'dividend_yield': _safe_float(response.get('DividendYield', 0)),
            
            # Trading information
            'beta': _safe_float(response.get('Beta', 0)),
            '52_week_high': _safe_float(response.get('52WeekHigh', 0)),
            '52_week_low': _safe_float(response.get('52WeekLow', 0)),
            '50_day_ma': _safe_float(response.get('50DayMovingAverage', 0)),
            '200_day_ma': _safe_float(response.get('200DayMovingAverage', 0)),
            
            # Shares data
            'shares_outstanding': _safe_float(response.get('SharesOutstanding', 0)),
            'shares_float': _safe_float(response.get('SharesFloat', 0)),
            
            # Dates
            'dividend_date': response.get('DividendDate', ''),
            'ex_dividend_date': response.get('ExDividendDate', ''),
            'earnings_date': response.get('EarningsDate', ''),
            'fiscal_year_end': response.get('FiscalYearEnd', ''),
            'latest_quarter': response.get('LatestQuarter', '')
        }
        
        # Cache the result with longer TTL for overview data
        await client._save_to_cache(cache_key, formatted_overview)
        
        logger.info(f"[vantage_api_quotes.py::vantage_api_get_overview] Overview retrieved for {symbol}: {formatted_overview['name']}")
        
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
async def vantage_api_fetch_and_store_historical_data(symbol: str, start_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch FULL historical data from Alpha Vantage and store in database
    This fetches ALL available historical data, not just recent data
    
    Args:
        symbol: Stock ticker symbol (e.g., 'AAPL')
        start_date: Optional start date to limit fetching (YYYY-MM-DD format)
    
    Returns:
        Dict containing information about stored data
    """
    logger.info(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] Fetching FULL historical data for {symbol}")
    
    client = get_vantage_client()
    
    # Import here to avoid circular imports
    from supa_api.supa_api_historical_prices import supa_api_store_historical_prices, supa_api_check_historical_data_coverage
    
    try:
        # Check if we already have recent data for this symbol
        today = datetime.now().date().strftime('%Y-%m-%d')
        thirty_days_ago = (datetime.now().date() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        coverage = await supa_api_check_historical_data_coverage(symbol, thirty_days_ago, today)
        
        if coverage['has_complete_coverage']:
            logger.info(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] {symbol} already has recent data, skipping fetch")
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
        
        logger.info(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] Requesting FULL historical data for {symbol}")
        
        response = await client._make_request(params)
        
        if 'Time Series (Daily)' not in response:
            logger.warning(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] No time series data found for {symbol}")
            raise Exception(f"No historical data found for {symbol}")
        
        time_series = response['Time Series (Daily)']
        logger.info(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] Retrieved {len(time_series)} days of data for {symbol}")
        
        # Convert to list format for database storage
        price_records = []
        for date_str, price_data in time_series.items():
            # Filter by start_date if provided
            if start_date and date_str < start_date:
                continue
                
            record = {
                'date': date_str,
                'open': float(price_data.get('1. open', 0)),
                'high': float(price_data.get('2. high', 0)),
                'low': float(price_data.get('3. low', 0)),
                'close': float(price_data.get('4. close', 0)),
                'adjusted_close': float(price_data.get('5. adjusted close', price_data.get('4. close', 0))),
                'volume': int(price_data.get('5. volume', 0)) if '5. volume' in price_data else int(price_data.get('6. volume', 0))
            }
            price_records.append(record)
        
        # Store in database
        if price_records:
            store_result = await supa_api_store_historical_prices(symbol, price_records)
            
            logger.info(f"[vantage_api_quotes.py::vantage_api_fetch_and_store_historical_data] Stored {store_result.get('records_stored', 0)} records for {symbol}")
            
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
    """
    Get historical closing price for a stock on a specific date
    First checks database, then fetches from Alpha Vantage if needed
    
    ENHANCED VERSION: Implements smart bulk fetching strategy:
    1. Check database for requested date
    2. If missing, fetch ENTIRE historical range from user's earliest transaction to today
    3. Store all prices in database for future portfolio calculations
    4. Return the specific requested price
    
    Args:
        symbol: Stock ticker symbol (e.g., 'AAPL')
        date: Date in YYYY-MM-DD format (e.g., '2024-01-15')
    
    Returns:
        Dict containing price data for the requested date, or closest available trading day
    """
    logger.info(f"🔥🔥🔥 [vantage_api_get_historical_price] ================= COMPREHENSIVE DEBUG START =================")
    logger.info(f"🔥 [vantage_api_get_historical_price] Function called with parameters:")
    logger.info(f"🔥 [vantage_api_get_historical_price] - symbol parameter: '{symbol}'")
    logger.info(f"🔥 [vantage_api_get_historical_price] - symbol type: {type(symbol)}")
    logger.info(f"🔥 [vantage_api_get_historical_price] - symbol length: {len(symbol) if symbol else 'N/A'}")
    logger.info(f"🔥 [vantage_api_get_historical_price] - date parameter: '{date}'")
    logger.info(f"🔥 [vantage_api_get_historical_price] - date type: {type(date)}")
    logger.info(f"🔥 [vantage_api_get_historical_price] - date length: {len(date) if date else 'N/A'}")
    
    # Import here to avoid circular imports
    from supa_api.supa_api_historical_prices import supa_api_get_historical_price_for_date
    
    try:
        # 🔥 EXTENSIVE PARAMETER VALIDATION WITH DEBUGGING
        logger.info(f"💰 [vantage_api_get_historical_price] === PARAMETER VALIDATION ===")
        
        if not symbol:
            logger.error(f"❌ [vantage_api_get_historical_price] VALIDATION FAILED: symbol is empty")
            raise ValueError("Symbol parameter is required")
        
        if not date:
            logger.error(f"❌ [vantage_api_get_historical_price] VALIDATION FAILED: date is empty")
            raise ValueError("Date parameter is required")
        
        # Normalize symbol
        normalized_symbol = symbol.upper().strip()
        logger.info(f"✅ [vantage_api_get_historical_price] VALIDATION PASSED")
        logger.info(f"📋 [vantage_api_get_historical_price] Normalized symbol: '{normalized_symbol}'")
        logger.info(f"📋 [vantage_api_get_historical_price] Target date: '{date}'")
        
        # 🔥 STEP 1: CHECK DATABASE FIRST
        logger.info(f"💾 [vantage_api_get_historical_price] === STEP 1: DATABASE LOOKUP ===")
        logger.info(f"💾 [vantage_api_get_historical_price] Checking database for {normalized_symbol} on {date}")
        
        db_result = await supa_api_get_historical_price_for_date(normalized_symbol, date)
        
        if db_result:
            logger.info(f"✅ [vantage_api_get_historical_price] === DATABASE HIT - RETURNING CACHED DATA ===")
            logger.info(f"💾 [vantage_api_get_historical_price] Found price in database:")
            logger.info(f"💾 [vantage_api_get_historical_price] - Symbol: {db_result['symbol']}")
            logger.info(f"💾 [vantage_api_get_historical_price] - Date: {db_result['date']}")
            logger.info(f"💾 [vantage_api_get_historical_price] - Close Price: ${db_result['close']}")
            logger.info(f"💾 [vantage_api_get_historical_price] - Is Exact Date: {db_result['is_exact_date']}")
            logger.info(f"💾 [vantage_api_get_historical_price] - Full data: {db_result}")
            logger.info(f"🔥🔥🔥 [vantage_api_get_historical_price] ================= COMPREHENSIVE DEBUG END (DATABASE HIT) =================")
            return db_result
        
        # 🔥 STEP 2: DATABASE MISS - FETCH FROM ALPHA VANTAGE
        logger.info(f"❌ [vantage_api_get_historical_price] === DATABASE MISS - FETCHING FROM ALPHA VANTAGE ===")
        logger.info(f"🌐 [vantage_api_get_historical_price] Price not in database, implementing smart bulk fetch strategy")
        logger.info(f"🌐 [vantage_api_get_historical_price] Target: Fetch ALL historical prices from earliest user transaction to today")
        
        # 🔥 STEP 3: DETERMINE OPTIMAL DATE RANGE FOR FETCHING
        logger.info(f"📅 [vantage_api_get_historical_price] === STEP 3: DETERMINE OPTIMAL FETCH RANGE ===")
        
        from supa_api.supa_api_historical_prices import supa_api_get_symbols_needing_historical_data
        
        logger.info(f"📊 [vantage_api_get_historical_price] Getting symbols needing historical data...")
        symbols_data = await supa_api_get_symbols_needing_historical_data()
        logger.info(f"📊 [vantage_api_get_historical_price] Found {len(symbols_data)} symbols with transactions")
        
        start_date = None
        
        # Find the earliest transaction date for this symbol
        for symbol_info in symbols_data:
            logger.info(f"📊 [vantage_api_get_historical_price] Checking symbol: {symbol_info}")
            if symbol_info['symbol'] == normalized_symbol:
                start_date = symbol_info['earliest_transaction_date']
                logger.info(f"✅ [vantage_api_get_historical_price] Found earliest transaction date for {normalized_symbol}: {start_date}")
                break
        
        if not start_date:
            # Default to 5 years ago if no transactions found for this symbol
            from datetime import datetime, timedelta
            default_start = (datetime.now().date() - timedelta(days=5*365)).strftime('%Y-%m-%d')
            start_date = default_start
            logger.info(f"⚠️ [vantage_api_get_historical_price] No transactions found for {normalized_symbol}, using default 5-year range from {start_date}")
        
        today = datetime.now().date().strftime('%Y-%m-%d')
        logger.info(f"📅 [vantage_api_get_historical_price] === DETERMINED FETCH RANGE ===")
        logger.info(f"📅 [vantage_api_get_historical_price] Symbol: {normalized_symbol}")
        logger.info(f"📅 [vantage_api_get_historical_price] Start Date: {start_date}")
        logger.info(f"📅 [vantage_api_get_historical_price] End Date: {today} (today)")
        logger.info(f"📅 [vantage_api_get_historical_price] Requested Date: {date}")
        logger.info(f"📅 [vantage_api_get_historical_price] Strategy: Fetch entire range, store in DB, then return requested date")
        
        # 🔥 STEP 4: FETCH AND STORE BULK HISTORICAL DATA
        logger.info(f"🚀 [vantage_api_get_historical_price] === STEP 4: BULK HISTORICAL DATA FETCH ===")
        logger.info(f"🚀 [vantage_api_get_historical_price] Calling vantage_api_fetch_and_store_historical_data...")
        logger.info(f"🚀 [vantage_api_get_historical_price] Parameters: symbol='{normalized_symbol}', start_date='{start_date}'")
        
        fetch_result = await vantage_api_fetch_and_store_historical_data(normalized_symbol, start_date)
        
        logger.info(f"📥 [vantage_api_get_historical_price] === BULK FETCH RESULT ===")
        logger.info(f"📥 [vantage_api_get_historical_price] Fetch result: {fetch_result}")
        logger.info(f"📥 [vantage_api_get_historical_price] Success: {fetch_result.get('success', False)}")
        logger.info(f"📥 [vantage_api_get_historical_price] Records fetched: {fetch_result.get('records_fetched', 0)}")
        logger.info(f"📥 [vantage_api_get_historical_price] Records stored: {fetch_result.get('records_stored', 0)}")
        logger.info(f"📥 [vantage_api_get_historical_price] Date range: {fetch_result.get('date_range', {})}")
        
        if not fetch_result.get('success', False):
            logger.error(f"❌ [vantage_api_get_historical_price] === BULK FETCH FAILED ===")
            logger.error(f"❌ [vantage_api_get_historical_price] Error: {fetch_result.get('error', 'Unknown error')}")
            raise Exception(f"Failed to fetch historical data for {normalized_symbol}: {fetch_result.get('error', 'Unknown error')}")
        
        logger.info(f"✅ [vantage_api_get_historical_price] === BULK FETCH SUCCESS ===")
        logger.info(f"✅ [vantage_api_get_historical_price] Successfully fetched and stored {fetch_result.get('records_stored', 0)} price records")
        logger.info(f"✅ [vantage_api_get_historical_price] Historical database now contains comprehensive price data for {normalized_symbol}")
        
        # 🔥 STEP 5: RETRIEVE REQUESTED DATE FROM NEWLY POPULATED DATABASE
        logger.info(f"🔍 [vantage_api_get_historical_price] === STEP 5: RETRIEVE REQUESTED DATE FROM DATABASE ===")
        logger.info(f"🔍 [vantage_api_get_historical_price] Now querying database again for specific date: {date}")
        
        db_result = await supa_api_get_historical_price_for_date(normalized_symbol, date)
        
        if db_result:
            logger.info(f"🎉 [vantage_api_get_historical_price] === SUCCESS - FOUND REQUESTED DATE ===")
            logger.info(f"💰 [vantage_api_get_historical_price] Retrieved after bulk fetch:")
            logger.info(f"💰 [vantage_api_get_historical_price] - Symbol: {db_result['symbol']}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Requested Date: {date}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Actual Date: {db_result['date']}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Close Price: ${db_result['close']}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Is Exact Date: {db_result['is_exact_date']}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Open: ${db_result['open']}")
            logger.info(f"💰 [vantage_api_get_historical_price] - High: ${db_result['high']}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Low: ${db_result['low']}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Volume: {db_result['volume']:,}")
            logger.info(f"💰 [vantage_api_get_historical_price] - Full result: {db_result}")
            
            logger.info(f"""
========== COMPREHENSIVE HISTORICAL PRICE SUCCESS ==========
OPERATION: Smart Bulk Historical Data Fetch and Retrieval
SYMBOL: {normalized_symbol}
REQUESTED_DATE: {date}
ACTUAL_DATE: {db_result['date']}
CLOSING_PRICE: ${db_result['close']}
IS_EXACT_DATE: {db_result['is_exact_date']}
RECORDS_FETCHED: {fetch_result.get('records_fetched', 0)}
RECORDS_STORED: {fetch_result.get('records_stored', 0)}
STRATEGY: ✅ Database-first with intelligent bulk fetching
PERFORMANCE: ✅ Future requests for this symbol will be instant
PORTFOLIO_READY: ✅ Complete historical data now available for calculations
=============================================================""")
            
            logger.info(f"🔥🔥🔥 [vantage_api_get_historical_price] ================= COMPREHENSIVE DEBUG END (SUCCESS) =================")
            return db_result
        else:
            logger.error(f"💥 [vantage_api_get_historical_price] === CRITICAL ERROR - NO DATA AFTER BULK FETCH ===")
            logger.error(f"💥 [vantage_api_get_historical_price] This should not happen - we just fetched historical data but can't find requested date")
            logger.error(f"💥 [vantage_api_get_historical_price] Requested symbol: {normalized_symbol}")
            logger.error(f"💥 [vantage_api_get_historical_price] Requested date: {date}")
            logger.error(f"💥 [vantage_api_get_historical_price] Bulk fetch records: {fetch_result.get('records_stored', 0)}")
            raise Exception(f"No trading data found for {normalized_symbol} near date {date} even after fetching from Alpha Vantage")
        
    except Exception as e:
        logger.error(f"💥 [vantage_api_get_historical_price] === EXCEPTION OCCURRED ===")
        logger.error(f"💥 [vantage_api_get_historical_price] Exception type: {type(e).__name__}")
        logger.error(f"💥 [vantage_api_get_historical_price] Exception message: {str(e)}")
        logger.error(f"💥 [vantage_api_get_historical_price] Exception details: {e}")
        logger.error(f"💥 [vantage_api_get_historical_price] Symbol: {symbol}")
        logger.error(f"💥 [vantage_api_get_historical_price] Date: {date}")
        
        DebugLogger.log_error(
            file_name="vantage_api_quotes.py",
            function_name="vantage_api_get_historical_price",
            error=e,
            symbol=symbol,
            date=date
        )
        logger.info(f"🔥🔥🔥 [vantage_api_get_historical_price] ================= COMPREHENSIVE DEBUG END (ERROR) =================")
        raise

def _safe_float(value: Any) -> float:
    """Safely convert value to float, return 0 if not possible"""
    if value is None or value == 'None' or value == '':
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0 