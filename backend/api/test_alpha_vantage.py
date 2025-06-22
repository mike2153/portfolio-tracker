import unittest
from unittest.mock import patch, Mock
import time
from api.alpha_vantage_service import AlphaVantageService, RateLimitError
import requests


class TestAlphaVantageService(unittest.TestCase):
    """Test suite for AlphaVantageService"""
    
    def setUp(self):
        """Set up test fixtures"""
        print(f"\n=== Setting up test: {self._testMethodName} ===")
        with patch.dict('os.environ', {'ALPHA_VANTAGE_API_KEY': 'test_key'}):
            self.service = AlphaVantageService()
        print(f"Service initialized successfully for test: {self._testMethodName}")
    
    def tearDown(self):
        """Clean up after each test"""
        print(f"=== Completed test: {self._testMethodName} ===\n")
    
    def test_initialization_without_api_key(self):
        """Test that service raises error without API key"""
        print("Testing initialization without API key...")
        with patch.dict('os.environ', {}, clear=True):
            with self.assertRaises(ValueError) as context:
                AlphaVantageService()
            self.assertIn("ALPHA_VANTAGE_API_KEY", str(context.exception))
            print(f"✓ Correctly raised ValueError: {context.exception}")
    
    def test_rate_limit_check_normal_usage(self):
        """Test rate limit check under normal usage"""
        print("Testing rate limit check under normal usage...")
        # Clear any existing timestamps
        self.service.request_timestamps = []
        
        # Add some requests within limit
        current_time = time.time()
        for i in range(30):  # Well below limit
            self.service.request_timestamps.append(current_time - i)
        
        print(f"Added 30 timestamp entries, current count: {len(self.service.request_timestamps)}")
        
        # Should not raise exception
        try:
            self.service._check_rate_limit()
            print("✓ Rate limit check passed successfully")
        except RateLimitError as e:
            print(f"✗ Unexpected rate limit error: {e}")
            self.fail("Rate limit check failed unexpectedly")
    
    def test_rate_limit_check_exceeded(self):
        """Test rate limit check when limit is exceeded"""
        print("Testing rate limit check when limit is exceeded...")
        # Clear any existing timestamps
        self.service.request_timestamps = []
        
        # Add requests that exceed the limit
        current_time = time.time()
        requests_count = self.service.MAX_REQUESTS_PER_MINUTE + 1
        for i in range(requests_count):
            self.service.request_timestamps.append(current_time - i)
        
        print(f"Added {requests_count} timestamp entries (limit: {self.service.MAX_REQUESTS_PER_MINUTE})")
        
        # Should raise RateLimitError
        with self.assertRaises(RateLimitError) as context:
            self.service._check_rate_limit()
        print(f"✓ Correctly raised RateLimitError: {context.exception}")
    
    def test_cache_functionality(self):
        """Test caching functionality"""
        print("Testing cache functionality...")
        # Test cache key generation
        params = {'function': 'GLOBAL_QUOTE', 'symbol': 'AAPL'}
        cache_key = self.service._get_cache_key(params)
        self.assertIsInstance(cache_key, str)
        print(f"Generated cache key: {cache_key}")
        
        # Test cache storage and retrieval
        test_data = {'test': 'data', 'timestamp': time.time()}
        self.service._store_in_cache(cache_key, test_data)
        print("Stored test data in cache")
        
        cached_data = self.service._get_from_cache(cache_key)
        self.assertEqual(cached_data, test_data)
        print(f"✓ Successfully retrieved cached data: {cached_data}")
        
        # Test cache expiration
        print("Testing cache expiration...")
        future_time = time.time() + self.service.CACHE_DURATION + 1
        with patch('time.time', return_value=future_time):
            expired_data = self.service._get_from_cache(cache_key)
            self.assertIsNone(expired_data)
            print("✓ Cache correctly expired and returned None")
    
    @patch('requests.get')
    def test_successful_api_request(self, mock_get):
        """Test successful API request"""
        print("Testing successful API request...")
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
        print("Cleared rate limiting timestamps")
        
        result = self.service.get_global_quote('AAPL')
        print(f"API request result: {result}")
        
        self.assertIsNotNone(result, "API request returned None")
        if result:
            self.assertEqual(result['symbol'], 'AAPL')
            self.assertEqual(result['price'], 150.00)
        print("✓ Successfully parsed API response")
    
    @patch('requests.get')
    def test_api_error_response(self, mock_get):
        """Test API error response handling"""
        print("Testing API error response handling...")
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
        print(f"Error response result: {result}")
        
        self.assertIsNone(result)
        print("✓ Correctly handled API error response")
    
    @patch('requests.get')
    def test_rate_limit_response(self, mock_get):
        """Test rate limit response from API"""
        print("Testing rate limit response from API...")
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
        print(f"Rate limit response result: {result}")
        
        self.assertIsNone(result)
        print("✓ Correctly handled rate limit response")
    
    @patch('requests.get')
    def test_network_error_handling(self, mock_get):
        """Test network error handling"""
        print("Testing network error handling...")
        # Mock network error
        mock_get.side_effect = requests.RequestException("Network error")
        
        # Clear rate limiting timestamps
        self.service.request_timestamps = []
        
        result = self.service.get_global_quote('AAPL')
        print(f"Network error result: {result}")
        
        self.assertIsNone(result)
        print("✓ Correctly handled network error")
    
    @patch('requests.get')
    def test_retry_logic(self, mock_get):
        """Test retry logic with exponential backoff"""
        print("Testing retry logic with exponential backoff...")
        # Mock initial failures followed by success
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
        with patch('time.sleep') as mock_sleep:
            result = self.service.get_global_quote('AAPL')
            print(f"Retry logic result: {result}")
            print(f"Number of sleep calls: {mock_sleep.call_count}")
            print(f"Total API calls made: {mock_get.call_count}")
        
        self.assertIsNotNone(result, "API request returned None")
        if result:
            self.assertEqual(result['symbol'], 'AAPL')
            self.assertEqual(mock_get.call_count, 3)
        print("✓ Retry logic worked correctly")
    
    def test_api_usage_stats(self):
        """Test API usage statistics"""
        print("Testing API usage statistics...")
        # Clear and add some test timestamps
        current_time = time.time()
        self.service.request_timestamps = [
            current_time - 30,  # 30 seconds ago
            current_time - 45,  # 45 seconds ago
        ]
        
        stats = self.service.get_api_usage_stats()
        print(f"API usage stats: {stats}")
        
        self.assertIn('requests_last_minute', stats)
        self.assertIn('rate_limit', stats)
        self.assertIn('cache_entries', stats)
        self.assertIn('service_status', stats)
        
        self.assertEqual(stats['requests_last_minute'], 2)
        self.assertEqual(stats['rate_limit'], self.service.MAX_REQUESTS_PER_MINUTE)
        print("✓ API usage stats are correct")
    
    @patch('requests.get')
    def test_historical_data_parsing(self, mock_get):
        """Test historical data parsing and error handling"""
        print("Testing historical data parsing...")
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
        print(f"Historical data result keys: {result.keys() if result else 'None'}")
        if result and 'data' in result:
            print(f"Number of data points: {len(result['data'])}")
            print(f"First data point: {result['data'][0] if result['data'] else 'None'}")
        
        self.assertIsNotNone(result, "API request returned None")
        if result:
            self.assertEqual(result['symbol'], 'AAPL')
            self.assertIn('data', result)
            self.assertEqual(len(result['data']), 2)
            
            # Check data is sorted by date (oldest first)
            self.assertEqual(result['data'][0]['date'], '2023-12-01')
            self.assertEqual(result['data'][1]['date'], '2023-12-02')
            
            # Check data parsing
            self.assertEqual(result['data'][0]['close'], 154.00)
            self.assertEqual(result['data'][0]['dividend_amount'], 0.25)
        print("✓ Historical data parsing is correct")


if __name__ == '__main__':
    print("Starting Alpha Vantage Service Test Suite...")
    print("=" * 60)
    unittest.main(verbosity=2) 