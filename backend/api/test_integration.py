import unittest
from unittest.mock import patch, Mock
import json
import django
from django.conf import settings
from api.alpha_vantage_service import AlphaVantageService, RateLimitError
from api.utils import success_response, error_response, validation_error_response
import time

# Configure Django settings for testing
if not settings.configured:
    settings.configure(
        DEBUG=True,
        SECRET_KEY='test-secret-key',
        DEFAULT_CHARSET='utf-8',
        USE_TZ=True,
    )
    django.setup()


class TestIntegrationErrorHandling(unittest.TestCase):
    """Test suite for integration error handling and standardized responses"""
    
    def setUp(self):
        """Set up test fixtures"""
        print(f"\n=== Setting up integration test: {self._testMethodName} ===")
        # Create Alpha Vantage service instance for testing
        with patch.dict('os.environ', {'ALPHA_VANTAGE_API_KEY': 'test_key'}):
            self.alpha_service = AlphaVantageService()
        print(f"Integration test setup complete for: {self._testMethodName}")
    
    def tearDown(self):
        """Clean up after each test"""
        print(f"=== Completed integration test: {self._testMethodName} ===\n")
    
    def test_standardized_response_format(self):
        """Test that all response utilities return standardized format"""
        print("Testing standardized response formats...")
        
        # Test success response
        success = success_response({"id": 123}, "Operation completed")
        self.assertEqual(success['ok'], True)
        self.assertEqual(success['message'], "Operation completed")
        self.assertEqual(success['data']['id'], 123)
        print(f"✓ Success response format: {success}")
        
        # Test error response (returns JsonResponse, so we need to check the content)
        error = error_response("Something went wrong", 500)
        self.assertEqual(error.status_code, 500)
        error_content = json.loads(error.content.decode())
        self.assertEqual(error_content['ok'], False)
        self.assertEqual(error_content['error'], "Something went wrong")
        print(f"✓ Error response format: {error_content}")
        
        # Test validation error response
        validation_error = validation_error_response({"field": ["Field is required"]})
        self.assertEqual(validation_error.status_code, 422)
        validation_content = json.loads(validation_error.content.decode())
        self.assertEqual(validation_content['ok'], False)
        self.assertEqual(validation_content['error'], "Validation failed")
        self.assertIn('field', validation_content['data']['validation_errors'])
        print(f"✓ Validation error response format: {validation_content}")
    
    def test_alpha_vantage_service_error_handling(self):
        """Test Alpha Vantage service error handling"""
        print("Testing Alpha Vantage service error handling...")
        
        # Test with mock network error
        with patch('requests.get') as mock_get:
            mock_get.side_effect = Exception("Network error")
            self.alpha_service.request_timestamps = []
            
            result = self.alpha_service.get_global_quote('INVALID')
            print(f"Network error result: {result}")
            self.assertIsNone(result)
            print("✓ Network error handled correctly")
    
    def test_alpha_vantage_rate_limiting(self):
        """Test Alpha Vantage rate limiting functionality"""
        print("Testing Alpha Vantage rate limiting...")
        
        # Clear timestamps and add many requests with current time
        self.alpha_service.request_timestamps = []
        current_time = time.time()  # Use actual current time
        
        # Add requests that exceed the limit (all within the last minute)
        for i in range(self.alpha_service.MAX_REQUESTS_PER_MINUTE + 1):
            self.alpha_service.request_timestamps.append(current_time - i)  # Subtract seconds
        
        print(f"Added {len(self.alpha_service.request_timestamps)} requests")
        
        # Should raise rate limit error
        with self.assertRaises(RateLimitError):
            self.alpha_service._check_rate_limit()
        print("✓ Rate limiting works correctly")
    
    def test_alpha_vantage_caching(self):
        """Test Alpha Vantage caching functionality"""
        print("Testing Alpha Vantage caching...")
        
        # Test cache operations
        cache_key = "test_cache_key"
        test_data = {"symbol": "AAPL", "price": 150.00}
        
        # Store in cache
        self.alpha_service._store_in_cache(cache_key, test_data)
        print("Stored data in cache")
        
        # Retrieve from cache
        cached_data = self.alpha_service._get_from_cache(cache_key)
        self.assertEqual(cached_data, test_data)
        print(f"✓ Cache retrieval successful: {cached_data}")
        
        # Test cache expiration by mocking time.time in the cache retrieval method
        future_time = time.time() + self.alpha_service.CACHE_DURATION + 1
        
        # We need to patch time.time specifically in the cache method
        with patch('api.alpha_vantage_service.time.time', return_value=future_time):
            expired_data = self.alpha_service._get_from_cache(cache_key)
            self.assertIsNone(expired_data)
            print("✓ Cache expiration works correctly")
    
    @patch('requests.get')
    def test_alpha_vantage_successful_request(self, mock_get):
        """Test successful Alpha Vantage API request"""
        print("Testing successful Alpha Vantage API request...")
        
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.00',
                '09. change': '2.50',
                '10. change percent': '1.69%'
            }
        }
        mock_get.return_value = mock_response
        
        # Clear rate limiting
        self.alpha_service.request_timestamps = []
        
        result = self.alpha_service.get_global_quote('AAPL')
        print(f"API request result: {result}")
        
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result['symbol'], 'AAPL')
        self.assertEqual(result['price'], 150.00)
        self.assertEqual(result['change'], 2.50)
        print("✓ Successful API request handled correctly")
    
    def test_alpha_vantage_api_usage_stats(self):
        """Test Alpha Vantage API usage statistics"""
        print("Testing Alpha Vantage API usage statistics...")
        
        # Add some test requests
        current_time = time.time()
        self.alpha_service.request_timestamps = [
            current_time - 30,  # 30 seconds ago
            current_time - 45,  # 45 seconds ago
        ]
        
        stats = self.alpha_service.get_api_usage_stats()
        print(f"API usage stats: {stats}")
        
        self.assertIn('requests_last_minute', stats)
        self.assertIn('rate_limit', stats)
        self.assertIn('cache_entries', stats)
        self.assertIn('service_status', stats)
        
        self.assertEqual(stats['requests_last_minute'], 2)
        self.assertEqual(stats['rate_limit'], self.alpha_service.MAX_REQUESTS_PER_MINUTE)
        print("✓ API usage statistics are correct")


if __name__ == '__main__':
    print("Starting Integration Test Suite...")
    print("=" * 60)
    unittest.main(verbosity=2) 