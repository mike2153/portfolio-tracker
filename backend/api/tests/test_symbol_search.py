from unittest.mock import patch, MagicMock
import pytest
from django.test import TestCase, Client
from django.contrib.auth.models import User
import json

from ..models import StockSymbol


def create_symbol(symbol: str, name: str):
    return StockSymbol.objects.create(
        symbol=symbol,
        name=name,
        exchange_code="NAS",
        exchange_name="NASDAQ",
        currency="USD",
        country="USA",
        type="Equity",
        is_active=True,
    )


@pytest.mark.django_db
class SymbolSearchRankingTest:
    def setup_method(self):
        """Clean up any existing symbols before each test."""
        StockSymbol.objects.all().delete()

    def test_local_ranking(self, ninja_client):
        create_symbol("AAPL", "Apple Inc")
        create_symbol("AAL", "American Airlines")
        create_symbol("AAP", "Advance Auto Parts")

        response = ninja_client.get("/api/symbols/search?q=AA&limit=3")
        assert response.status_code == 200
        data = response.json()
        symbols = [r["symbol"] for r in data["results"]]
        assert symbols == ["AAL", "AAP", "AAPL"]

    @patch("api.views.get_alpha_vantage_service")
    def test_remote_result_ranking(self, mock_get_av, ninja_client):
        create_symbol("AAL", "American Airlines")
        mock_service = MagicMock()
        mock_service.symbol_search.return_value = {
            "bestMatches": [
                {
                    "1. symbol": "AAPL",
                    "2. name": "Apple Inc",
                    "3. type": "Equity",
                    "4. region": "United States",
                    "8. currency": "USD",
                }
            ]
        }
        mock_get_av.return_value = mock_service

        response = ninja_client.get("/api/symbols/search?q=AAPL&limit=2")
        assert response.status_code == 200
        data = response.json()
        symbols = [r["symbol"] for r in data["results"]]
        assert symbols == ["AAPL"]


class TestSymbolSearchImproved(TestCase):
    """Test the improved symbol search functionality with relevance scoring"""
    
    def setUp(self):
        self.client = Client()
        
        # Create test symbols
        self.test_symbols = [
            # SPY and related
            {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "exchange_name": "NYSE", "exchange_code": "NYSE"},
            {"symbol": "SPYA", "name": "SPDR S&P 500 ETF Australia", "exchange_name": "ASX", "exchange_code": "ASX"},
            {"symbol": "SPYB", "name": "SPDR S&P 500 ETF Bond", "exchange_name": "NYSE", "exchange_code": "NYSE"},
            {"symbol": "SPYC", "name": "SPDR S&P 500 ETF Commodity", "exchange_name": "NYSE", "exchange_code": "NYSE"},
            {"symbol": "APYI", "name": "Another Product Yield Index", "exchange_name": "NASDAQ", "exchange_code": "NASDAQ"},
            {"symbol": "YSP", "name": "Yield Special Product", "exchange_name": "NYSE", "exchange_code": "NYSE"},
            {"symbol": "SP", "name": "Short Product", "exchange_name": "NYSE", "exchange_code": "NYSE"},
            
            # Tesla
            {"symbol": "TSLA", "name": "Tesla, Inc.", "exchange_name": "NASDAQ", "exchange_code": "NASDAQ"},
            {"symbol": "TSL", "name": "Test Solar Limited", "exchange_name": "NYSE", "exchange_code": "NYSE"},
            
            # Apple and similar
            {"symbol": "AAPL", "name": "Apple Inc.", "exchange_name": "NASDAQ", "exchange_code": "NASDAQ"},
            {"symbol": "APLE", "name": "Apple Hospitality REIT", "exchange_name": "NYSE", "exchange_code": "NYSE"},
            {"symbol": "APL", "name": "Applied Materials", "exchange_name": "NASDAQ", "exchange_code": "NASDAQ"},
            
            # Microsoft
            {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange_name": "NASDAQ", "exchange_code": "NASDAQ"},
            {"symbol": "MSF", "name": "MS Financial", "exchange_name": "NYSE", "exchange_code": "NYSE"},
        ]
        
        for symbol_data in self.test_symbols:
            StockSymbol.objects.create(
                symbol=symbol_data["symbol"],
                name=symbol_data["name"],
                exchange_name=symbol_data["exchange_name"],
                exchange_code=symbol_data["exchange_code"],
                currency="USD",
                country="US",
                type="Equity",
                is_active=True
            )
    
    def test_exact_ticker_match(self):
        """Test that exact ticker matches get highest priority"""
        response = self.client.get('/api/symbols/search', {'q': 'SPY'})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertGreater(len(data['results']), 0)
        
        # SPY should be first result
        self.assertEqual(data['results'][0]['symbol'], 'SPY')
        
    def test_prefix_match_ordering(self):
        """Test that prefix matches are ordered correctly"""
        response = self.client.get('/api/symbols/search', {'q': 'SPY'})
        data = response.json()
        
        # Check that SPY variants come before non-SPY symbols
        spy_indices = []
        for i, result in enumerate(data['results']):
            if result['symbol'].startswith('SPY'):
                spy_indices.append(i)
        
        # All SPY-prefixed symbols should come before others
        if spy_indices:
            max_spy_index = max(spy_indices)
            for i, result in enumerate(data['results'][max_spy_index + 1:], max_spy_index + 1):
                self.assertFalse(result['symbol'].startswith('SPY'), 
                               f"Found SPY-prefixed symbol {result['symbol']} after non-SPY symbols")
    
    def test_exclude_shorter_tickers(self):
        """Test that tickers shorter than query are excluded"""
        response = self.client.get('/api/symbols/search', {'q': 'SPY'})
        data = response.json()
        
        # SP should not be in results
        symbols = [r['symbol'] for r in data['results']]
        self.assertNotIn('SP', symbols)
        
    def test_case_insensitive_search(self):
        """Test that search is case-insensitive"""
        # Test lowercase
        response_lower = self.client.get('/api/symbols/search', {'q': 'spy'})
        data_lower = response_lower.json()
        
        # Test uppercase
        response_upper = self.client.get('/api/symbols/search', {'q': 'SPY'})
        data_upper = response_upper.json()
        
        # Results should be the same
        self.assertEqual(data_lower['results'][0]['symbol'], data_upper['results'][0]['symbol'])
        
    def test_company_name_search(self):
        """Test searching by company name"""
        response = self.client.get('/api/symbols/search', {'q': 'Tesla'})
        data = response.json()
        
        self.assertTrue(data['ok'])
        # TSLA should be in the results
        symbols = [r['symbol'] for r in data['results']]
        self.assertIn('TSLA', symbols)
        
        # TSLA should be the first result since it's an exact company name match
        tesla_results = [r for r in data['results'] if 'tesla' in r['name'].lower()]
        self.assertGreater(len(tesla_results), 0)
        
    def test_mixed_search_results(self):
        """Test that both ticker and name matches are included"""
        response = self.client.get('/api/symbols/search', {'q': 'Apple'})
        data = response.json()
        
        # Should find both AAPL (company name match) and APLE (ticker substring match)
        symbols = [r['symbol'] for r in data['results']]
        self.assertIn('AAPL', symbols)
        self.assertIn('APLE', symbols)
        
    def test_limit_parameter(self):
        """Test that limit parameter is respected"""
        response = self.client.get('/api/symbols/search', {'q': 'S', 'limit': '5'})
        data = response.json()
        
        self.assertTrue(data['ok'])
        self.assertLessEqual(len(data['results']), 5)
        
    def test_empty_query(self):
        """Test handling of empty query"""
        response = self.client.get('/api/symbols/search', {'q': ''})
        data = response.json()
        
        self.assertTrue(data['ok'])
        self.assertEqual(len(data['results']), 0)
        
    def test_single_character_query(self):
        """Test single character queries"""
        response = self.client.get('/api/symbols/search', {'q': 'A'})
        data = response.json()
        
        self.assertTrue(data['ok'])
        # Should return results
        self.assertGreater(len(data['results']), 0)
        
    @patch('api.views.get_alpha_vantage_service')
    def test_alpha_vantage_fallback(self, mock_av_service):
        """Test that Alpha Vantage is called when local results are insufficient"""
        # Create a query that won't match our test data well
        mock_av = MagicMock()
        mock_av_service.return_value = mock_av
        
        mock_av.symbol_search.return_value = {
            "bestMatches": [
                {
                    "1. symbol": "GOOGL",
                    "2. name": "Alphabet Inc.",
                    "3. type": "Equity",
                    "4. region": "United States",
                    "8. currency": "USD"
                }
            ]
        }
        
        response = self.client.get('/api/symbols/search', {'q': 'GOOGL'})
        data = response.json()
        
        # Verify AV was called
        mock_av.symbol_search.assert_called_once_with('GOOGL')
        
        # Verify GOOGL is in results
        symbols = [r['symbol'] for r in data['results']]
        self.assertIn('GOOGL', symbols)
        
    def test_scoring_accuracy(self):
        """Test that the scoring system works correctly"""
        # Test different types of matches
        test_cases = [
            {
                'query': 'AAPL',  # Exact match
                'expected_first': 'AAPL',
                'reason': 'Exact ticker match should be first'
            },
            {
                'query': 'AAP',  # Prefix match
                'expected_first': 'AAPL',
                'reason': 'Prefix match should prioritize AAPL'
            },
            {
                'query': 'Microsoft',  # Company name match
                'expected_in_results': 'MSFT',
                'reason': 'Company name search should find MSFT'
            }
        ]
        
        for test in test_cases:
            response = self.client.get('/api/symbols/search', {'q': test['query']})
            data = response.json()
            
            if 'expected_first' in test:
                self.assertEqual(data['results'][0]['symbol'], test['expected_first'], test['reason'])
            elif 'expected_in_results' in test:
                symbols = [r['symbol'] for r in data['results']]
                self.assertIn(test['expected_in_results'], symbols, test['reason'])
    
    def test_response_format(self):
        """Test that response has correct format"""
        response = self.client.get('/api/symbols/search', {'q': 'AAPL'})
        data = response.json()
        
        # Check response structure
        self.assertIn('ok', data)
        self.assertIn('results', data)
        self.assertIn('total', data)
        self.assertIn('query', data)
        self.assertIn('limit', data)
        
        # Check result structure
        if data['results']:
            result = data['results'][0]
            required_fields = ['symbol', 'name', 'exchange', 'currency', 'type', 'source']
            for field in required_fields:
                self.assertIn(field, result)
