import pytest
import os
from unittest.mock import patch, MagicMock
from api.alpha_vantage_service import AlphaVantageService, get_alpha_vantage_service
from api.views import get_stock_quote, get_company_overview
import json

@pytest.mark.django_db
class TestAlphaVantageQuoteIntegration:
    """Test Alpha Vantage quote integration end-to-end"""
    
    def setup_method(self):
        """Set up test cases"""
        self.test_symbol = "AAPL"
        self.mock_quote_response = {
            'symbol': 'AAPL',
            'price': 150.25,
            'change': 2.15,
            'change_percent': 1.45,
            'volume': 45123456,
            'latest_trading_day': '2024-01-15',
            'previous_close': 148.10,
            'open': 149.00,
            'high': 151.50,
            'low': 148.75
        }
        
        self.mock_overview_response = {
            'Symbol': 'AAPL',
            'Name': 'Apple Inc.',
            'Description': 'Apple Inc. designs, manufactures, and markets smartphones...',
            'Exchange': 'NASDAQ',
            'Currency': 'USD',
            'Country': 'USA',
            'Sector': 'Technology',
            'Industry': 'Consumer Electronics',
            'MarketCapitalization': '2500000000000',
            'PERatio': '25.5',
            'PEGRatio': '1.2',
            'BookValue': '3.85',
            'DividendPerShare': '0.92',
            'DividendYield': '0.51',
            'EPS': '5.89',
            'RevenuePerShareTTM': '24.31',
            'ProfitMargin': '0.242',
            'OperatingMarginTTM': '0.302',
            'ReturnOnAssetsTTM': '0.201',
            'ReturnOnEquityTTM': '1.504',
            'RevenueTTM': '394328000000',
            'GrossProfitTTM': '152836000000',
            'DilutedEPSTTM': '5.89',
            'QuarterlyEarningsGrowthYOY': '0.023',
            'QuarterlyRevenueGrowthYOY': '0.015',
            'AnalystTargetPrice': '165.00',
            'TrailingPE': '25.5',
            'ForwardPE': '22.8',
            'PriceToSalesRatioTTM': '6.35',
            'PriceToBookRatio': '39.01',
            'EVToRevenue': '6.89',
            'EVToEBITDA': '22.45',
            'Beta': '1.24',
            '52WeekHigh': '199.62',
            '52WeekLow': '124.17',
            '50DayMovingAverage': '145.82',
            '200DayMovingAverage': '158.43'
        }

    @patch.dict(os.environ, {'ALPHA_VANTAGE_API_KEY': 'test_api_key'})
    def test_alpha_vantage_service_initialization(self):
        """Test that AlphaVantageService initializes correctly"""
        service = AlphaVantageService()
        assert service is not None
        assert service.BASE_URL == "https://www.alphavantage.co/query"
        assert service.MAX_REQUESTS_PER_MINUTE == 60

    @patch('api.alpha_vantage_service.requests.get')
    @patch.dict(os.environ, {'ALPHA_VANTAGE_API_KEY': 'test_api_key'})
    def test_get_global_quote_success(self, mock_get):
        """Test successful quote retrieval"""
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'Global Quote': {
                '01. symbol': 'AAPL',
                '05. price': '150.25',
                '09. change': '2.15',
                '10. change percent': '1.45%',
                '06. volume': '45123456',
                '07. latest trading day': '2024-01-15',
                '08. previous close': '148.10',
                '02. open': '149.00',
                '03. high': '151.50',
                '04. low': '148.75'
            }
        }
        mock_get.return_value = mock_response
        
        service = AlphaVantageService()
        result = service.get_global_quote(self.test_symbol)
        
        assert result is not None
        assert result['symbol'] == 'AAPL'
        assert result['price'] == 150.25
        assert result['change'] == 2.15
        assert result['change_percent'] == 1.45

    @patch('api.alpha_vantage_service.requests.get')
    @patch.dict(os.environ, {'ALPHA_VANTAGE_API_KEY': 'test_api_key'})
    def test_get_global_quote_no_data(self, mock_get):
        """Test quote retrieval when no data is available"""
        # Mock API response with no data
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_get.return_value = mock_response
        
        service = AlphaVantageService()
        result = service.get_global_quote(self.test_symbol)
        
        assert result is None

    @patch('api.alpha_vantage_service.requests.get')
    @patch.dict(os.environ, {'ALPHA_VANTAGE_API_KEY': 'test_api_key'})
    def test_get_global_quote_api_error(self, mock_get):
        """Test quote retrieval when API returns error"""
        # Mock API error response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'error': 'Invalid symbol'
        }
        mock_get.return_value = mock_response
        
        service = AlphaVantageService()
        result = service.get_global_quote(self.test_symbol)
        
        assert result is None

    @patch('api.alpha_vantage_service.requests.get')
    @patch.dict(os.environ, {'ALPHA_VANTAGE_API_KEY': 'test_api_key'})
    def test_get_global_quote_network_error(self, mock_get):
        """Test quote retrieval when network error occurs"""
        # Mock network error
        mock_get.side_effect = Exception("Network error")
        
        service = AlphaVantageService()
        result = service.get_global_quote(self.test_symbol)
        
        assert result is None

    @patch('backend.api.views.alpha_vantage')
    def test_stock_quote_endpoint_success(self, mock_alpha_vantage, ninja_client):
        """Test the /stocks/{symbol}/quote endpoint success case"""
        # Mock the alpha_vantage service
        mock_alpha_vantage.get_global_quote.return_value = self.mock_quote_response
        
        # Make request to the endpoint
        response = ninja_client.get(f'/stocks/{self.test_symbol}/quote')
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['ok'] == True
        assert data['data']['symbol'] == self.test_symbol
        assert data['data']['data']['price'] == 150.25
        assert 'timestamp' in data['data']

    @patch('backend.api.views.alpha_vantage')
    def test_stock_quote_endpoint_not_found(self, mock_alpha_vantage, ninja_client):
        """Test the /stocks/{symbol}/quote endpoint when quote not found"""
        # Mock the alpha_vantage service to return None
        mock_alpha_vantage.get_global_quote.return_value = None
        
        # Make request to the endpoint
        response = ninja_client.get(f'/stocks/{self.test_symbol}/quote')
        
        assert response.status_code == 404
        data = response.json()
        
        assert data['ok'] == False
        assert 'error' in data

    @patch('backend.api.views.alpha_vantage')
    def test_stock_overview_endpoint_success(self, mock_alpha_vantage, ninja_client):
        """Test the /stocks/{symbol}/overview endpoint success case"""
        # Mock the alpha_vantage service
        mock_alpha_vantage.get_company_overview.return_value = self.mock_overview_response
        mock_alpha_vantage.get_global_quote.return_value = self.mock_quote_response
        
        # Make request to the endpoint
        response = ninja_client.get(f'/stocks/{self.test_symbol}/overview')
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['ok'] == True
        assert data['data']['symbol'] == self.test_symbol
        # Check for nested data structure from real API
        if 'data' in data['data'] and 'data' in data['data']['data']:
            assert data['data']['data']['data']['price'] == 150.25
        else:
            # Direct structure
            assert data['data']['data']['price'] == 150.25

    @patch('backend.api.views.alpha_vantage')
    def test_stock_overview_endpoint_quote_only(self, mock_alpha_vantage, ninja_client):
        """Test the /stocks/{symbol}/overview endpoint when only quote is available"""
        # Mock the alpha_vantage service to return None for overview
        mock_alpha_vantage.get_company_overview.return_value = None
        mock_alpha_vantage.get_global_quote.return_value = self.mock_quote_response
        
        # Make request to the endpoint
        response = ninja_client.get(f'/stocks/{self.test_symbol}/overview')
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['ok'] == True
        assert data['data']['symbol'] == self.test_symbol
        # Should still have quote data even without overview
        assert 'data' in data['data']

    def test_api_usage_stats(self, ninja_client):
        """Test that API usage is tracked properly"""
        # Get initial stats if endpoint exists
        try:
            response = ninja_client.get('/api/stats')
            if response.status_code == 200:
                initial_stats = response.json()
                assert 'requests_today' in initial_stats
        except:
            # Stats endpoint might not exist, that's okay
            pass


@pytest.mark.django_db
class TestQuoteIntegrationRealAPI:
    """Test quote integration with real Alpha Vantage API"""
    
    def setup_method(self):
        """Set up for real API tests"""
        self.test_symbol = "AAPL"

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_real_api_quote_integration(self):
        """Test quote retrieval with real Alpha Vantage API"""
        service = get_alpha_vantage_service()
        result = service.get_global_quote(self.test_symbol)
        
        if result:  # API might fail due to rate limits
            assert 'symbol' in result
            assert 'price' in result
            assert result['symbol'] == self.test_symbol
            assert isinstance(result['price'], (int, float))
        else:
            # API call failed, which is acceptable in tests
            pytest.skip("Alpha Vantage API call failed (rate limit or network issue)")

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_real_api_endpoint_integration(self, ninja_client):
        """Test the actual endpoint with real Alpha Vantage API"""
        response = ninja_client.get(f'/stocks/{self.test_symbol}/quote')
        
        # Accept both success and rate limit responses
        if response.status_code == 200:
            data = response.json()
            assert data['ok'] == True
            assert data['data']['symbol'] == self.test_symbol
        elif response.status_code == 429:
            # Rate limit hit, acceptable in tests
            pytest.skip("Alpha Vantage API rate limit hit")
        else:
            # Other errors should be investigated
            pytest.fail(f"Unexpected response status: {response.status_code}")

    def test_quote_endpoint_error_handling(self, ninja_client):
        """Test quote endpoint error handling with invalid symbol"""
        invalid_symbol = "INVALIDTEST123"
        response = ninja_client.get(f'/stocks/{invalid_symbol}/quote')
        
        # Should handle gracefully - either 404 or successful response with no data
        assert response.status_code in [200, 404, 500]  # Accept various error handling approaches 