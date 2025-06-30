"""
Alpha Vantage API functions for stock quotes and company overviews
Handles real-time price data and fundamental information
"""
import asyncio
import logging
from typing import Dict, Any

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

def _safe_float(value: Any) -> float:
    """Safely convert value to float, return 0 if not possible"""
    if value is None or value == 'None' or value == '':
        return 0.0
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0 