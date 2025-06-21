import unittest
from unittest.mock import patch, Mock, MagicMock
import time
import json
from api.alpha_vantage_service import AlphaVantageService, RateLimitError
import requests


class TestAlphaVantageService(unittest.TestCase):
    """Test suite for AlphaVantageService"""
    
    def setUp(self):
        """Set up test fixtures"""
        with patch.dict('os.environ', {'ALPHA_VANTAGE_API_KEY': 'test_key'}):
            self.service = AlphaVantageService()
    
    def test_initialization_without_api_key(self):
        """Test that service raises error without API key"""
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaises(ValueError) as context:
                AlphaVantageService()
            self.assertIn("ALPHA_VANTAGE_API_KEY", str(context.exception))
    
    def test_rate_limit_check_normal_usage(self):
        """Test rate limit check under normal usage"""
        # Clear any existing timestamps
        self.service.request_timestamps = []
        
        # Add some requests within limit
        current_time = time.time()
        for i in range(30):  # Well below limit
            self.service.request_timestamps.append(current_time - i)
        
        # Should not raise exception
        try:
            self.service._check_rate_limit()
        except RateLimitError:
            self.fail("Rate limit check failed unexpectedly")
    
    def test_rate_limit_check_exceeded(self):
        """Test rate limit check when limit is exceeded"""
        # Clear any existing timestamps
        self.service.request_timestamps = []
        
        # Add requests that exceed the limit
        current_time = time.time()
        for i in range(self.service.MAX_REQUESTS_PER_MINUTE + 1):
            self.service.request_timestamps.append(current_time - i)
        
        # Should raise RateLimitError
        with self.assertRaises(RateLimitError):
            self.service._check_rate_limit()
    
    def test_cache_functionality(self):
        """Test caching functionality"""
        # Test cache key generation
        params = {'function': 'GLOBAL_QUOTE', 'symbol': 'AAPL'}
        cache_key = self.service._get_cache_key(params)
        self.assertIsInstance(cache_key, str)
        
        # Test cache storage and retrieval
        test_data = {'test': 'data'}
        self.service._store_in_cache(cache_key, test_data)
        
        cached_data = self.service._get_from_cache(cache_key)
        self.assertEqual(cached_data, test_data)
        
        # Test cache expiration
        with patch('time.time', return_value=time.time() + self.service.CACHE_DURATION + 1):
            expired_data = self.service._get_from_cache(cache_key)
            self.assertIsNone(expired_data)
    
    @patch('requests.get')
    def test_successful_api_request(self, mock_get):
        """Test successful API request"""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.00'
            }
        }
        mock_get.return_value = mock_response
        
        # Clear rate limiting timestamps
        self.service.request_timestamps = []
        
        result = self.service.get_global_quote('AAPL')
        
        self.assertIsNotNone(result)
        self.assertEqual(result['symbol'], 'AAPL')
        self.assertEqual(result['price'], 150.00)
    
    @patch('requests.get')
    def test_api_error_response(self, mock_get):
        """Test API error response handling"""
        # Mock error response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'Error Message': 'Invalid API call'
        }
        mock_get.return_value = mock_response
        
        # Clear rate limiting timestamps
        self.service.request_timestamps = []
        
        result = self.service.get_global_quote('INVALID')
        
        self.assertIsNone(result)
    
    @patch('requests.get')
    def test_rate_limit_response(self, mock_get):
        """Test rate limit response from API"""
        # Mock rate limit response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'Note': 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute'
        }
        mock_get.return_value = mock_response
        
        # Clear rate limiting timestamps
        self.service.request_timestamps = []
        
        result = self.service.get_global_quote('AAPL')
        
        self.assertIsNone(result)
    
    @patch('requests.get')
    def test_network_error_handling(self, mock_get):
        """Test network error handling"""
        # Mock network error
        mock_get.side_effect = requests.RequestException("Network error")
        
        # Clear rate limiting timestamps
        self.service.request_timestamps = []
        
        result = self.service.get_global_quote('AAPL')
        
        self.assertIsNone(result)
    
    @patch('requests.get')
    def test_retry_logic(self, mock_get):
        """Test retry logic with exponential backoff"""
        # Mock initial failures followed by success
        mock_response_fail = Mock()
        mock_response_fail.side_effect = requests.RequestException("Temporary error")
        
        mock_response_success = Mock()
        mock_response_success.status_code = 200
        mock_response_success.json.return_value = {
            'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.00'
            }
        }
        
        # First two calls fail, third succeeds
        mock_get.side_effect = [
            requests.RequestException("Error 1"),
            requests.RequestException("Error 2"),
            mock_response_success
        ]
        
        # Clear rate limiting timestamps
        self.service.request_timestamps = []
        
        # Mock time.sleep to speed up test
        with patch('time.sleep'):
            result = self.service.get_global_quote('AAPL')
        
        self.assertIsNotNone(result)
        self.assertEqual(result['symbol'], 'AAPL')
        self.assertEqual(mock_get.call_count, 3)
    
    def test_api_usage_stats(self):
        """Test API usage statistics"""
        # Clear and add some test timestamps
        current_time = time.time()
        self.service.request_timestamps = [
            current_time - 30,  # 30 seconds ago
            current_time - 45,  # 45 seconds ago
        ]
        
        stats = self.service.get_api_usage_stats()
        
        self.assertIn('requests_last_minute', stats)
        self.assertIn('rate_limit', stats)
        self.assertIn('cache_entries', stats)
        self.assertIn('service_status', stats)
        
        self.assertEqual(stats['requests_last_minute'], 2)
        self.assertEqual(stats['rate_limit'], self.service.MAX_REQUESTS_PER_MINUTE)
    
    @patch('requests.get')
    def test_historical_data_parsing(self, mock_get):
        """Test historical data parsing and error handling"""
        # Mock historical data response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'Time Series (Daily)': {
                '2023-12-01': {
                    '1. open': '150.00',
                    '2. high': '155.00',
                    '3. low': '149.00',
                    '4. close': '154.00',
                    '5. adjusted close': '154.00',
                    '6. volume': '1000000',
                    '7. dividend amount': '0.25',
                    '8. split coefficient': '1.0'
                },
                '2023-12-02': {
                    '1. open': '154.00',
                    '2. high': '156.00',
                    '3. low': '153.00',
                    '4. close': '155.50',
                    '5. adjusted close': '155.50',
                    '6. volume': '1100000',
                    '7. dividend amount': '0.00',
                    '8. split coefficient': '1.0'
                }
            },
            'Meta Data': {
                '3. Last Refreshed': '2023-12-02',
                '5. Time Zone': 'US/Eastern'
            }
        }
        mock_get.return_value = mock_response
        
        # Clear rate limiting timestamps
        self.service.request_timestamps = []
        
        result = self.service.get_daily_adjusted('AAPL')
        
        self.assertIsNotNone(result)
        self.assertEqual(result['symbol'], 'AAPL')
        self.assertIn('data', result)
        self.assertEqual(len(result['data']), 2)
        
        # Check data is sorted by date (oldest first)
        self.assertEqual(result['data'][0]['date'], '2023-12-01')
        self.assertEqual(result['data'][1]['date'], '2023-12-02')
        
        # Check data parsing
        self.assertEqual(result['data'][0]['close'], 154.00)
        self.assertEqual(result['data'][0]['dividend_amount'], 0.25)


if __name__ == '__main__':
    unittest.main() 