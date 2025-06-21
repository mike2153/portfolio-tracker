import os
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging
import json
import time
import threading
from functools import wraps

logger = logging.getLogger(__name__)

class RateLimitError(Exception):
    """Raised when API rate limit is exceeded"""
    pass

class AlphaVantageService:
    """Enhanced service class for Alpha Vantage API interactions with rate limiting and caching"""
    
    BASE_URL = "https://www.alphavantage.co/query"
    MAX_REQUESTS_PER_MINUTE = 60  # Conservative limit
    RETRY_DELAYS = [1, 2, 4, 8, 16]  # Exponential backoff delays in seconds
    CACHE_DURATION = 300  # 5 minutes cache for popular endpoints
    
    def __init__(self):
        self.api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        if not self.api_key:
            raise ValueError("ALPHA_VANTAGE_API_KEY environment variable is required")
        
        self.request_timestamps: List[float] = []
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_lock = threading.Lock()
        
    def _get_cache_key(self, params: Dict[str, str]) -> str:
        """Generate a cache key from request parameters"""
        # Exclude API key from cache key
        cache_params = {k: v for k, v in params.items() if k != 'apikey'}
        return json.dumps(cache_params, sort_keys=True)
    
    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get data from cache if valid"""
        with self.cache_lock:
            if cache_key in self.cache:
                cached_data, timestamp = self.cache[cache_key]['data'], self.cache[cache_key]['timestamp']
                if time.time() - timestamp < self.CACHE_DURATION:
                    logger.info(f"Cache hit for key: {cache_key[:50]}...")
                    return cached_data
                else:
                    # Remove expired cache entry
                    del self.cache[cache_key]
        return None
    
    def _store_in_cache(self, cache_key: str, data: Dict[str, Any]) -> None:
        """Store data in cache"""
        with self.cache_lock:
            self.cache[cache_key] = {
                'data': data,
                'timestamp': time.time()
            }
            logger.info(f"Cached data for key: {cache_key[:50]}...")
    
    def _check_rate_limit(self) -> None:
        """Check if we're within rate limits"""
        current_time = time.time()
        # Clear out timestamps older than 60 seconds
        self.request_timestamps = [t for t in self.request_timestamps if current_time - t < 60]
        
        requests_in_last_minute = len(self.request_timestamps)
        logger.info(f"Alpha Vantage requests in last 60s: {requests_in_last_minute}/{self.MAX_REQUESTS_PER_MINUTE}")
        
        if requests_in_last_minute >= self.MAX_REQUESTS_PER_MINUTE:
            raise RateLimitError(f"Rate limit exceeded: {requests_in_last_minute} requests in the last minute")
        
        if requests_in_last_minute > self.MAX_REQUESTS_PER_MINUTE * 0.8:  # Warn at 80%
            logger.warning(f"Nearing rate limit: {requests_in_last_minute} requests in the last minute")
    
    def _make_request_with_retry(self, params: Dict[str, str], timeout: int = 30, max_retries: int = 3) -> Dict[str, Any]:
        """Make API request with exponential backoff retry logic"""
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                self._check_rate_limit()
                return self._make_single_request(params, timeout)
            except RateLimitError as e:
                logger.warning(f"Rate limit hit on attempt {attempt + 1}: {e}")
                if attempt < max_retries:
                    delay = self.RETRY_DELAYS[min(attempt, len(self.RETRY_DELAYS) - 1)]
                    logger.info(f"Waiting {delay} seconds before retry...")
                    time.sleep(delay)
                    continue
                else:
                    raise e
            except requests.RequestException as e:
                logger.warning(f"Request failed on attempt {attempt + 1}: {e}")
                last_exception = e
                if attempt < max_retries:
                    delay = self.RETRY_DELAYS[min(attempt, len(self.RETRY_DELAYS) - 1)]
                    logger.info(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                    continue
                else:
                    break
        
        if last_exception:
            raise last_exception
        
        return {}
    
    def _make_single_request(self, params: Dict[str, str], timeout: int = 30) -> Dict[str, Any]:
        """Make a single API request to Alpha Vantage"""
        if not self.api_key:
            raise ValueError("Alpha Vantage API key is not configured")
        
        # Check cache first for cacheable endpoints
        cache_key = self._get_cache_key(params)
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data
        
        # Track request timing
        current_time = time.time()
        self.request_timestamps.append(current_time)
        
        # Prepare params for logging, excluding the API key
        log_params = {k: v for k, v in params.items() if k != 'apikey'}
        logger.info(f"Making Alpha Vantage request to function '{params.get('function')}' with params: {log_params}")

        request_params = params.copy()
        request_params['apikey'] = self.api_key
        request_params['entitlement'] = 'delayed'
        
        try:
            response = requests.get(self.BASE_URL, params=request_params, timeout=timeout)
            
            if response.status_code != 200:
                logger.error(f"Alpha Vantage API request failed with status {response.status_code}. Response: {response.text}")
                raise requests.RequestException(f"HTTP {response.status_code}: {response.text}")

            data = response.json()
            
            if 'Error Message' in data:
                error_msg = data['Error Message']
                logger.error(f"Alpha Vantage API returned an error: {error_msg}")
                raise requests.RequestException(f"API Error: {error_msg}")
            
            if 'Note' in data:
                note_msg = data['Note']
                logger.warning(f"Alpha Vantage API rate limit note: {note_msg}")
                if "rate limit" in note_msg.lower():
                    raise RateLimitError(f"Rate limit exceeded: {note_msg}")
                return {}
            
            # Cache successful responses for cacheable endpoints
            if params.get('function') in ['GLOBAL_QUOTE', 'OVERVIEW']:
                self._store_in_cache(cache_key, data)
            
            logger.info(f"Successfully received data for function '{params.get('function')}'")
            return data
            
        except requests.RequestException:
            raise  # Re-raise request exceptions for retry logic
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode JSON response from Alpha Vantage. Response: {response.text}")
            raise requests.RequestException(f"JSON decode error: {e}")
    
    def _make_request(self, params: Dict[str, str], timeout: int = 30) -> Dict[str, Any]:
        """Make a request with retry logic and error handling"""
        try:
            return self._make_request_with_retry(params, timeout)
        except RateLimitError as e:
            logger.error(f"Rate limit exceeded after retries: {e}")
            return {"error": "rate_limit_exceeded", "message": str(e)}
        except requests.RequestException as e:
            logger.error(f"Request failed after retries: {e}")
            return {"error": "request_failed", "message": str(e)}
        except Exception as e:
            logger.error(f"Unexpected error in Alpha Vantage request: {e}", exc_info=True)
            return {"error": "unexpected_error", "message": str(e)}
    
    def get_company_overview(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get company fundamentals and overview"""
        params = {'function': 'OVERVIEW', 'symbol': symbol}
        data = self._make_request(params)

        if not data or 'error' in data:
            logger.warning(f"No company overview data returned for {symbol}. Error: {data.get('error', 'Unknown')}")
            return None

        if not any(v not in [None, 'None', ''] for v in data.values()):
            logger.warning(f"Empty company overview data returned for {symbol}.")
            return None

        overview = {}
        for key, value in data.items():
            if value and value != 'None':
                try:
                    if key in ['MarketCapitalization', 'EBITDA', 'PERatio', 'PEGRatio', 'BookValue', 'DividendPerShare', 'DividendYield', 'EPS', 'RevenuePerShareTTM', 'ProfitMargin', 'ReturnOnEquityTTM', '52WeekHigh', '52WeekLow', 'Beta', 'SharesOutstanding']:
                        overview[key] = float(value)
                    else:
                        overview[key] = value
                except (ValueError, TypeError):
                    overview[key] = value
        
        return overview
    
    def get_global_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get real-time stock quote. Returns None if no data."""
        params = {'function': 'GLOBAL_QUOTE', 'symbol': symbol}
        data = self._make_request(params)
        
        if not data or 'error' in data:
            logger.warning(f"No quote data available for {symbol} from Alpha Vantage. Error: {data.get('error', 'Unknown')}")
            return None
            
        quote_data = data.get('Global Quote', {})
        
        if not quote_data:
            logger.warning(f"Empty quote data available for {symbol} from Alpha Vantage.")
            return None
        
        try:
            return {
                'symbol': quote_data.get('01. symbol', symbol),
                'price': float(quote_data.get('05. price', 0)),
                'change': float(quote_data.get('09. change', 0)),
                'change_percent': float(quote_data.get('10. change percent', '0%').replace('%', '')),
                'volume': int(quote_data.get('06. volume', 0)),
                'latest_trading_day': quote_data.get('07. latest trading day'),
                'previous_close': float(quote_data.get('08. previous close', 0)),
                'open': float(quote_data.get('02. open', 0)),
                'high': float(quote_data.get('03. high', 0)),
                'low': float(quote_data.get('04. low', 0))
            }
        except (ValueError, TypeError) as e:
            logger.error(f"Could not parse quote data for {symbol}: {e}. Data: {quote_data}")
            return None
    
    def get_daily_adjusted(self, symbol: str, outputsize: str = 'full') -> Optional[Dict[str, Any]]:
        """Get daily adjusted time series with dividends. Returns None if no data."""
        params = {
            'function': 'TIME_SERIES_DAILY_ADJUSTED',
            'symbol': symbol,
            'outputsize': outputsize
        }
        
        data = self._make_request(params, timeout=60)
        
        if not data or 'error' in data:
            logger.warning(f"No time series data available for {symbol} from Alpha Vantage. Error: {data.get('error', 'Unknown')}")
            return None
            
        time_series = data.get('Time Series (Daily)', {})
        
        if not time_series:
            logger.warning(f"Empty time series data available for {symbol} from Alpha Vantage.")
            return None
        
        # Convert to our format
        parsed_data = []
        for date_str, values in time_series.items():
            try:
                parsed_data.append({
                    'date': date_str,
                    'open': float(values['1. open']),
                    'high': float(values['2. high']),
                    'low': float(values['3. low']),
                    'close': float(values['4. close']),
                    'adjusted_close': float(values['5. adjusted close']),
                    'volume': int(values['6. volume']),
                    'dividend_amount': float(values['7. dividend amount']),
                    'split_coefficient': float(values['8. split coefficient'])
                })
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid data point for {symbol} on {date_str}: {e}")
                continue
        
        # Sort by date (oldest first)
        parsed_data.sort(key=lambda x: x['date'])
        
        return {
            'symbol': symbol,
            'data': parsed_data,
            'last_refreshed': data.get('Meta Data', {}).get('3. Last Refreshed'),
            'time_zone': data.get('Meta Data', {}).get('5. Time Zone')
        }
    
    def get_income_statement(self, symbol: str) -> Dict[str, Any]:
        """Get annual and quarterly income statements"""
        params = {
            'function': 'INCOME_STATEMENT',
            'symbol': symbol
        }
        
        data = self._make_request(params, timeout=45)
        
        if 'error' in data:
            return {
                'symbol': symbol,
                'error': data['error'],
                'message': data.get('message', 'Failed to fetch income statement'),
                'annual_reports': [],
                'quarterly_reports': []
            }
        
        return {
            'symbol': data.get('symbol', symbol),
            'annual_reports': data.get('annualReports', []),
            'quarterly_reports': data.get('quarterlyReports', [])
        }
    
    def get_balance_sheet(self, symbol: str) -> Dict[str, Any]:
        """Get annual and quarterly balance sheets"""
        params = {
            'function': 'BALANCE_SHEET',
            'symbol': symbol
        }
        
        data = self._make_request(params, timeout=45)
        
        if 'error' in data:
            return {
                'symbol': symbol,
                'error': data['error'],
                'message': data.get('message', 'Failed to fetch balance sheet'),
                'annual_reports': [],
                'quarterly_reports': []
            }
        
        return {
            'symbol': data.get('symbol', symbol),
            'annual_reports': data.get('annualReports', []),
            'quarterly_reports': data.get('quarterlyReports', [])
        }
    
    def get_cash_flow(self, symbol: str) -> Dict[str, Any]:
        """Get annual and quarterly cash flow statements"""
        params = {
            'function': 'CASH_FLOW',
            'symbol': symbol
        }
        
        data = self._make_request(params, timeout=45)
        
        if 'error' in data:
            return {
                'symbol': symbol,
                'error': data['error'],
                'message': data.get('message', 'Failed to fetch cash flow statement'),
                'annual_reports': [],
                'quarterly_reports': []
            }
        
        return {
            'symbol': data.get('symbol', symbol),
            'annual_reports': data.get('annualReports', []),
            'quarterly_reports': data.get('quarterlyReports', [])
        }
    
    def get_news_sentiment(self, tickers: Optional[str] = None, topics: Optional[str] = None, time_from: Optional[str] = None, 
                          time_to: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """Get news sentiment data for given tickers"""
        params = {
            'function': 'NEWS_SENTIMENT',
            'limit': str(limit),
        }
        
        if tickers:
            params['tickers'] = tickers
        if topics:
            params['topics'] = topics
        if time_from:
            params['time_from'] = time_from
        if time_to:
            params['time_to'] = time_to
        
        data = self._make_request(params, timeout=60)
        
        if 'error' in data:
            return {
                'error': data['error'],
                'message': data.get('message', 'Failed to fetch news sentiment'),
                'feed': [],
                'sentiment_score_definition': '',
                'relevance_score_definition': ''
            }
        
        return {
            'feed': data.get('feed', []),
            'sentiment_score_definition': data.get('sentiment_score_definition', ''),
            'relevance_score_definition': data.get('relevance_score_definition', '')
        }
    
    def get_api_usage_stats(self) -> Dict[str, Any]:
        """Get current API usage statistics"""
        current_time = time.time()
        recent_requests = [t for t in self.request_timestamps if current_time - t < 60]
        
        return {
            'requests_last_minute': len(recent_requests),
            'rate_limit': self.MAX_REQUESTS_PER_MINUTE,
            'cache_entries': len(self.cache),
            'cache_hit_ratio': 'N/A',  # Would need to track hits/misses for this
            'service_status': 'healthy' if len(recent_requests) < self.MAX_REQUESTS_PER_MINUTE else 'rate_limited'
        }

# Global instance
try:
    alpha_vantage = AlphaVantageService()
except ValueError:
    # Don't create global instance if API key is not available (e.g., during testing)
    alpha_vantage = None 