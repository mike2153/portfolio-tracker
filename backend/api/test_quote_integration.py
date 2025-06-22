import pytest
import os
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from django.http import JsonResponse
from api.alpha_vantage_service import AlphaVantageService, get_alpha_vantage_service
from api.views import get_stock_quote, get_company_overview
import json

class TestAlphaVantageQuoteIntegration(TestCase):
    """Test Alpha Vantage quote integration end-to-end"""
    
    def setUp(self):
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
        self.assertIsNotNone(service)
        self.assertEqual(service.BASE_URL, "https://www.alphavantage.co/query")
        self.assertEqual(service.MAX_REQUESTS_PER_MINUTE, 60)

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
        
        self.assertIsNotNone(result)
        self.assertEqual(result['symbol'], 'AAPL')
        self.assertEqual(result['price'], 150.25)
        self.assertEqual(result['change'], 2.15)
        self.assertEqual(result['change_percent'], 1.45)

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
        
        self.assertIsNone(result)

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
        
        self.assertIsNone(result)

    @patch('api.alpha_vantage_service.requests.get')
    @patch.dict(os.environ, {'ALPHA_VANTAGE_API_KEY': 'test_api_key'})
    def test_get_global_quote_network_error(self, mock_get):
        """Test quote retrieval when network error occurs"""
        # Mock network error
        mock_get.side_effect = Exception("Network error")
        
        service = AlphaVantageService()
        result = service.get_global_quote(self.test_symbol)
        
        self.assertIsNone(result)

    @patch('api.views.alpha_vantage')
    def test_stock_quote_endpoint_success(self, mock_alpha_vantage):
        """Test the /stocks/{symbol}/quote endpoint success case"""
        # Mock the alpha_vantage service
        mock_alpha_vantage.get_global_quote.return_value = self.mock_quote_response
        
        # Make request to the endpoint
        response = self.client.get(f'/api/stocks/{self.test_symbol}/quote')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data['ok'])
        self.assertEqual(data['data']['symbol'], self.test_symbol)
        self.assertEqual(data['data']['data']['price'], 150.25)
        self.assertIn('timestamp', data['data'])

    @patch('api.views.alpha_vantage')
    def test_stock_quote_endpoint_not_found(self, mock_alpha_vantage):
        """Test the /stocks/{symbol}/quote endpoint when quote not found"""
        # Mock the alpha_vantage service to return None
        mock_alpha_vantage.get_global_quote.return_value = None
        
        # Make request to the endpoint
        response = self.client.get(f'/api/stocks/{self.test_symbol}/quote')
        
        self.assertEqual(response.status_code, 404)
        data = response.json()
        
        self.assertFalse(data['ok'])
        self.assertIn('error', data)

    @patch('api.views.alpha_vantage')
    def test_stock_overview_endpoint_success(self, mock_alpha_vantage):
        """Test the /stocks/{symbol}/overview endpoint success case"""
        # Mock the alpha_vantage service
        mock_alpha_vantage.get_company_overview.return_value = self.mock_overview_response
        mock_alpha_vantage.get_global_quote.return_value = self.mock_quote_response
        
        # Make request to the endpoint
        response = self.client.get(f'/api/stocks/{self.test_symbol}/overview')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data['ok'])
        self.assertEqual(data['data']['symbol'], self.test_symbol)
        self.assertEqual(data['data']['data']['price'], 150.25)
        self.assertEqual(data['data']['data']['Symbol'], 'AAPL')
        self.assertIn('timestamp', data['data'])

    @patch('api.views.alpha_vantage')
    def test_stock_overview_endpoint_quote_only(self, mock_alpha_vantage):
        """Test the /stocks/{symbol}/overview endpoint with quote data only"""
        # Mock the alpha_vantage service - overview fails, quote succeeds
        mock_alpha_vantage.get_company_overview.return_value = None
        mock_alpha_vantage.get_global_quote.return_value = self.mock_quote_response
        
        # Make request to the endpoint
        response = self.client.get(f'/api/stocks/{self.test_symbol}/overview')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data['ok'])
        self.assertEqual(data['data']['symbol'], self.test_symbol)
        self.assertEqual(data['data']['data']['price'], 150.25)
        self.assertIn('timestamp', data['data'])

    def test_api_usage_stats(self):
        """Test API usage statistics tracking"""
        service = AlphaVantageService()
        stats = service.get_api_usage_stats()
        
        self.assertIn('total_requests_today', stats)
        self.assertIn('requests_last_minute', stats)
        self.assertIn('cache_size', stats)
        self.assertIn('rate_limit_max', stats)
        self.assertEqual(stats['rate_limit_max'], 60)


class TestQuoteIntegrationRealAPI(TestCase):
    """Test real API integration (only runs if API key is set)"""
    
    def setUp(self):
        self.api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        self.test_symbol = "AAPL"  # Use a reliable stock symbol
    
    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_real_api_quote_integration(self):
        """Test real API quote integration (only if API key is available)"""
        if not self.api_key:
            self.skipTest("Alpha Vantage API key not available")
        
        service = get_alpha_vantage_service()
        quote = service.get_global_quote(self.test_symbol)
        
        if quote:  # API might be rate limited or symbol not found
            self.assertIn('symbol', quote)
            self.assertIn('price', quote)
            self.assertIsInstance(quote['price'], (int, float))
            self.assertGreater(quote['price'], 0)
            print(f"Real API test - {self.test_symbol}: ${quote['price']}")
        else:
            print(f"Real API test - No data returned for {self.test_symbol}")

    @pytest.mark.skipif(not os.getenv('ALPHA_VANTAGE_API_KEY'), 
                       reason="Alpha Vantage API key not set")
    def test_real_api_endpoint_integration(self):
        """Test real API endpoint integration through Django views"""
        if not self.api_key:
            self.skipTest("Alpha Vantage API key not available")
        
        # Test the quote endpoint
        response = self.client.get(f'/api/stocks/{self.test_symbol}/quote')
        
        if response.status_code == 200:
            data = response.json()
            self.assertTrue(data.get('ok'))
            self.assertIn('data', data)
            
            quote_data = data['data']['data']
            if 'price' in quote_data:
                self.assertIsInstance(quote_data['price'], (int, float))
                self.assertGreater(quote_data['price'], 0)
                print(f"Real endpoint test - {self.test_symbol}: ${quote_data['price']}")
        else:
            print(f"Real endpoint test - Error {response.status_code} for {self.test_symbol}")


if __name__ == '__main__':
    # Run specific tests
    import django
    from django.conf import settings
    from django.test.utils import get_runner
    
    if not settings.configured:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
        django.setup()
    
    TestCase = get_runner(settings)
    test_runner = TestCase()
    
    # Run the tests
    failures = test_runner.run_tests(['api.test_quote_integration'])
    if failures:
        exit(1) 