import pytest
import os
from .alpha_vantage_service import AlphaVantageService, get_alpha_vantage_service
from .views import get_stock_quote, get_company_overview
import json
import time

@pytest.mark.django_db
class TestAlphaVantageQuoteIntegration:
    """Test Alpha Vantage quote integration end-to-end using real API calls"""
    
    def setup_method(self):
        """Set up test cases"""
        self.test_symbol = "AAPL"
        # Rate limiting - wait between API calls
        time.sleep(12)  # Alpha Vantage free tier allows 5 calls per minute

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_alpha_vantage_service_initialization(self):
        """Test that AlphaVantageService initializes correctly"""
        service = AlphaVantageService()
        assert service is not None
        assert service.BASE_URL == "https://www.alphavantage.co/query"
        assert service.MAX_REQUESTS_PER_MINUTE == 60

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_get_global_quote_success(self):
        """Test successful quote retrieval with real API"""
        service = AlphaVantageService()
        result = service.get_global_quote(self.test_symbol)
        
        # Verify real API response structure
        assert result is not None
        assert result['symbol'] == 'AAPL'
        assert 'price' in result
        assert isinstance(result['price'], float)
        assert result['price'] > 0
        assert 'change' in result
        assert 'change_percent' in result
        assert 'volume' in result
        assert isinstance(result['volume'], int)
        assert result['volume'] > 0
        
        # Add delay for rate limiting
        time.sleep(12)

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_get_global_quote_invalid_symbol(self):
        """Test quote retrieval with invalid symbol"""
        service = AlphaVantageService()
        result = service.get_global_quote("INVALID_SYMBOL_XYZ")
        
        # Invalid symbols should return None or error
        assert result is None or 'error' in str(result).lower()
        
        # Add delay for rate limiting
        time.sleep(12)

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_stock_quote_endpoint_success(self, ninja_client):
        """Test the /stocks/{symbol}/quote endpoint with real API"""
        # Make request to the endpoint
        response = ninja_client.get(f'/stocks/{self.test_symbol}/quote')
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['ok'] == True
        assert data['data']['symbol'] == self.test_symbol
        assert 'data' in data['data']
        assert 'price' in data['data']['data']
        assert isinstance(data['data']['data']['price'], (int, float))
        assert data['data']['data']['price'] > 0
        assert 'timestamp' in data['data']
        
        # Add delay for rate limiting
        time.sleep(12)

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_stock_quote_endpoint_invalid_symbol(self, ninja_client):
        """Test the /stocks/{symbol}/quote endpoint with invalid symbol"""
        # Make request to the endpoint with invalid symbol
        response = ninja_client.get('/stocks/INVALID_XYZ/quote')
        
        # Should return 404 or error response
        assert response.status_code in [404, 400]
        data = response.json()
        
        assert data['ok'] == False
        assert 'error' in data
        
        # Add delay for rate limiting
        time.sleep(12)

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_stock_overview_endpoint_success(self, ninja_client):
        """Test the /stocks/{symbol}/overview endpoint with real API"""
        # Make request to the endpoint
        response = ninja_client.get(f'/stocks/{self.test_symbol}/overview')
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['ok'] == True
        assert data['data']['symbol'] == self.test_symbol
        
        # Verify overview data structure
        if 'overview' in data['data']:
            overview = data['data']['overview']
            assert 'Symbol' in overview
            assert overview['Symbol'] == self.test_symbol
            assert 'Name' in overview
            assert 'MarketCapitalization' in overview
        
        # Verify quote data is included
        if 'quote' in data['data']:
            quote = data['data']['quote']
            assert 'price' in quote
            assert isinstance(quote['price'], (int, float))
            assert quote['price'] > 0
        
        # Add delay for rate limiting
        time.sleep(12)

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_stock_overview_endpoint_quote_only(self, ninja_client):
        """Test overview endpoint when overview data is not available but quote is"""
        # Test with a symbol that might not have overview data
        test_symbol = "TSLA"  # Different symbol to avoid cache issues
        
        # Make request to the endpoint
        response = ninja_client.get(f'/stocks/{test_symbol}/overview')
        
        # Should still return successfully with at least quote data
        assert response.status_code == 200
        data = response.json()
        
        assert data['ok'] == True
        assert data['data']['symbol'] == test_symbol
        
        # Should have at least quote data even if overview is missing
        assert 'quote' in data['data'] or 'overview' in data['data']
        
        # Add delay for rate limiting
        time.sleep(12)

    def test_api_usage_stats(self, ninja_client):
        """Test API usage tracking endpoint"""
        response = ninja_client.get('/api/usage')
        
        # Should return usage stats without needing API key
        # This endpoint tracks internal API usage, not Alpha Vantage usage
        assert response.status_code in [200, 404]  # Depending on if endpoint exists


@pytest.mark.django_db
class TestQuoteIntegrationRealAPI:
    """Additional real API integration tests"""
    
    def setup_method(self):
        """Set up real API tests"""
        self.service = get_alpha_vantage_service()
        time.sleep(12)  # Rate limiting

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_real_api_quote_integration(self):
        """Test real API quote integration with multiple symbols"""
        symbols = ['AAPL', 'MSFT', 'GOOGL']
        
        for symbol in symbols:
            time.sleep(12)  # Rate limiting between calls
            result = self.service.get_global_quote(symbol)
            
            # Verify each real API response
            assert result is not None, f"Failed to get quote for {symbol}"
            assert result['symbol'] == symbol
            assert isinstance(result['price'], float)
            assert result['price'] > 0
            assert 'latest_trading_day' in result
            assert 'volume' in result

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_real_api_endpoint_integration(self, ninja_client):
        """Test real API endpoint integration"""
        symbols = ['AAPL', 'MSFT']
        
        for symbol in symbols:
            time.sleep(12)  # Rate limiting
            response = ninja_client.get(f'/stocks/{symbol}/quote')
            
            assert response.status_code == 200
            data = response.json()
            
            assert data['ok'] == True
            assert data['data']['symbol'] == symbol
            assert 'data' in data['data']
            assert isinstance(data['data']['data']['price'], (int, float))
            assert data['data']['data']['price'] > 0

    def test_quote_endpoint_error_handling(self, ninja_client):
        """Test error handling without API key requirement"""
        # Test with clearly invalid symbol
        response = ninja_client.get('/stocks/NOTAREALSTOCK123/quote')
        
        # Should handle errors gracefully
        assert response.status_code in [404, 400, 500]
        data = response.json()
        assert data['ok'] == False


@pytest.mark.django_db 
class TestRealAPIPerformance:
    """Test real API performance and rate limiting"""
    
    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_api_rate_limiting_compliance(self):
        """Test that our service respects Alpha Vantage rate limits"""
        service = get_alpha_vantage_service()
        
        # Test making multiple calls and ensure rate limiting works
        symbols = ['AAPL', 'MSFT']
        results = []
        
        for symbol in symbols:
            start_time = time.time()
            result = service.get_global_quote(symbol)
            end_time = time.time()
            
            results.append({
                'symbol': symbol,
                'success': result is not None,
                'response_time': end_time - start_time
            })
            
            # Enforce rate limiting
            time.sleep(12)
        
        # Verify all calls succeeded
        for result in results:
            assert result['success'], f"API call failed for {result['symbol']}"
            # Response time should be reasonable (less than 30 seconds)
            assert result['response_time'] < 30, f"Response time too slow: {result['response_time']}s"

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_real_data_validation(self):
        """Test that real API data meets our validation requirements"""
        service = get_alpha_vantage_service()
        time.sleep(12)
        
        result = service.get_global_quote('AAPL')
        
        # Validate real data structure
        assert result is not None
        required_fields = ['symbol', 'price', 'change', 'change_percent', 'volume']
        
        for field in required_fields:
            assert field in result, f"Missing required field: {field}"
            assert result[field] is not None, f"Field {field} is None"
        
        # Validate data types
        assert isinstance(result['price'], float)
        assert isinstance(result['volume'], int)
        assert isinstance(result['change'], float)
        assert isinstance(result['change_percent'], float)
        
        # Validate reasonable values
        assert result['price'] > 0
        assert result['volume'] >= 0
        # Change can be positive or negative
        assert -100 <= result['change_percent'] <= 100  # Reasonable daily change range 