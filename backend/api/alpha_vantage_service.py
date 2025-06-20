import os
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging
import json
import time

logger = logging.getLogger(__name__)

class AlphaVantageService:
    """Secure service class for Alpha Vantage API interactions"""
    
    BASE_URL = "https://www.alphavantage.co/query"
    
    def __init__(self):
        self.api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        if not self.api_key:
            raise ValueError("ALPHA_VANTAGE_API_KEY environment variable is required")
        self.request_timestamps: List[float] = []
    
    def _make_request(self, params: Dict[str, str], timeout: int = 30) -> Dict[str, Any]:
        """Make a secure API request to Alpha Vantage and track usage."""
        
        # --- Request Rate Tracking ---
        current_time = time.time()
        # Clear out timestamps older than 60 seconds
        self.request_timestamps = [t for t in self.request_timestamps if current_time - t < 60]
        self.request_timestamps.append(current_time)
        
        requests_in_last_minute = len(self.request_timestamps)
        logger.info(f"Alpha Vantage requests in last 60s: {requests_in_last_minute}/70")
        if requests_in_last_minute > 60: # Warn when getting close
            logger.warning(f"Nearing rate limit: {requests_in_last_minute} requests in the last minute.")
        # --- End Tracking ---

        if not self.api_key:
            raise ValueError("Alpha Vantage API key is not configured")
        
        # Prepare params for logging, excluding the API key
        log_params = {k: v for k, v in params.items() if k != 'apikey'}
        logger.info(f"Making Alpha Vantage request to function '{params.get('function')}' with params: {log_params}")

        params['apikey'] = self.api_key
        params['entitlement'] = 'delayed'
        
        try:
            response = requests.get(self.BASE_URL, params=params, timeout=timeout)
            
            if response.status_code != 200:
                logger.error(f"Alpha Vantage API request failed with status {response.status_code}. Response: {response.text}")
                return {}

            data = response.json()
            
            if 'Error Message' in data:
                logger.error(f"Alpha Vantage API returned an error: {data['Error Message']}")
                return {}
            
            if 'Note' in data:
                logger.warning(f"Alpha Vantage API rate limit note: {data['Note']}")
                return {}
            
            logger.info(f"Successfully received data for function '{params.get('function')}'.")
            return data
            
        except requests.RequestException as e:
            logger.error(f"Alpha Vantage API request failed: {e}", exc_info=True)
            return {}
        except json.JSONDecodeError:
            logger.error(f"Failed to decode JSON response from Alpha Vantage. Response: {response.text}")
            return {}
    
    def get_company_overview(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get company fundamentals and overview"""
        params = {'function': 'OVERVIEW', 'symbol': symbol}
        data = self._make_request(params)

        if not data or not any(v not in [None, 'None', ''] for v in data.values()):
            logger.warning(f"No company overview data returned for {symbol}.")
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
        quote_data = data.get('Global Quote', {})
        
        if not quote_data:
            logger.warning(f"No quote data available for {symbol} from Alpha Vantage.")
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
        time_series = data.get('Time Series (Daily)', {})
        
        if not time_series:
            logger.warning(f"No time series data available for {symbol} from Alpha Vantage.")
            return None
        
        # Convert to our format
        parsed_data = []
        for date_str, values in time_series.items():
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
        
        return {
            'symbol': data.get('symbol', symbol),
            'annual_reports': data.get('annualReports', []),
            'quarterly_reports': data.get('quarterlyReports', [])
        }
    
    def get_news_sentiment(self, tickers: Optional[str] = None, topics: Optional[str] = None, time_from: Optional[str] = None, 
                          time_to: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """Get news sentiment data"""
        params = {
            'function': 'NEWS_SENTIMENT',
            'limit': str(limit)
        }
        
        if tickers:
            params['tickers'] = tickers
        if topics:
            params['topics'] = topics
        if time_from:
            params['time_from'] = time_from
        if time_to:
            params['time_to'] = time_to
        
        data = self._make_request(params, timeout=30)
        
        return {
            'feed': data.get('feed', []),
            'items': data.get('items', '0'),
            'sentiment_score_definition': data.get('sentiment_score_definition'),
            'relevance_score_definition': data.get('relevance_score_definition')
        }

# Create a singleton instance
alpha_vantage = AlphaVantageService() 