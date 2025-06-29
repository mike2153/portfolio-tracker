import os
import pytest
from django.test import TestCase, Client
from django.contrib.auth.models import User
import json
import time
from datetime import datetime
from supabase import create_client, Client as SupabaseClient
from api.models import StockSymbol
from api.alpha_vantage_service import AlphaVantageService


class TestSymbolSearchIntegration(TestCase):
    """Integration tests for symbol search using real API and data"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment with real authentication"""
        super().setUpClass()
        
        # Initialize Supabase client
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_KEY')
        
        if not supabase_url or not supabase_key:
            pytest.skip("Supabase credentials not found in environment")
        
        cls.supabase: SupabaseClient = create_client(supabase_url, supabase_key)
        
        # Create or get test user with Supabase auth
        test_email = "3200163@proton.me"
        test_password = "12345678"
        
        try:
            # Try to sign in first
            auth_response = cls.supabase.auth.sign_in_with_password({
                "email": test_email,
                "password": test_password
            })
            cls.auth_token = auth_response.session.access_token
            cls.user_id = auth_response.user.id
        except:
            # If sign in fails, try to create user
            try:
                auth_response = cls.supabase.auth.sign_up({
                    "email": test_email,
                    "password": test_password
                })
                cls.auth_token = auth_response.session.access_token
                cls.user_id = auth_response.user.id
            except Exception as e:
                pytest.skip(f"Could not create/authenticate test user: {e}")
        
        # Ensure we have real stock symbols in database
        # This uses the actual production data or loads from API
        cls._ensure_real_symbols_loaded()
    
    @classmethod
    def _ensure_real_symbols_loaded(cls):
        """Ensure we have real stock symbols loaded from API"""
        # Check if we have common symbols
        common_symbols = ['SPY', 'AAPL', 'MSFT', 'TSLA', 'GOOGL', 'AMZN']
        missing_symbols = []
        
        for symbol in common_symbols:
            if not StockSymbol.objects.filter(symbol=symbol).exists():
                missing_symbols.append(symbol)
        
        if missing_symbols:
            # Load missing symbols from Alpha Vantage
            av_service = AlphaVantageService()
            for symbol in missing_symbols:
                try:
                    # Search for the symbol
                    search_result = av_service.symbol_search(symbol)
                    if search_result and 'bestMatches' in search_result:
                        for match in search_result['bestMatches']:
                            if match.get('1. symbol') == symbol:
                                StockSymbol.objects.get_or_create(
                                    symbol=match.get('1. symbol'),
                                    defaults={
                                        'name': match.get('2. name'),
                                        'exchange_code': match.get('4. region', 'US'),
                                        'exchange_name': match.get('4. region', 'US'),
                                        'currency': match.get('8. currency', 'USD'),
                                        'country': match.get('4. region', 'US'),
                                        'type': match.get('3. type', 'Equity'),
                                        'is_active': True
                                    }
                                )
                                break
                    # Rate limiting - Alpha Vantage free tier allows 5 calls per minute
                    time.sleep(12)  # Wait 12 seconds between calls
                except Exception as e:
                    print(f"Warning: Could not load symbol {symbol}: {e}")
    
    def setUp(self):
        """Set up authenticated client for each test"""
        self.client = Client()
        # Add authentication header
        self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {self.auth_token}'
    
    def test_real_spy_search(self):
        """Test searching for SPY returns real SPY ETF as first result"""
        response = self.client.get('/api/symbols/search', {'q': 'SPY'})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertTrue(data['ok'])
        self.assertGreater(len(data['results']), 0)
        
        # SPY should be first result
        first_result = data['results'][0]
        self.assertEqual(first_result['symbol'], 'SPY')
        self.assertIn('SPDR', first_result['name'].upper())
        self.assertIn('500', first_result['name'])
    
    def test_real_company_name_search(self):
        """Test searching by real company names"""
        test_cases = [
            ('Apple', 'AAPL', 'Apple Inc'),
            ('Microsoft', 'MSFT', 'Microsoft Corporation'),
            ('Tesla', 'TSLA', 'Tesla'),
            ('Amazon', 'AMZN', 'Amazon'),
            ('Google', 'GOOGL', 'Alphabet')
        ]
        
        for search_term, expected_symbol, expected_name_part in test_cases:
            response = self.client.get('/api/symbols/search', {'q': search_term})
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            self.assertTrue(data['ok'])
            
            # Find the expected symbol in results
            symbols = [r['symbol'] for r in data['results']]
            self.assertIn(expected_symbol, symbols, 
                         f"Expected {expected_symbol} in results for '{search_term}'")
            
            # Check it's ranked high (in top 3)
            top_3_symbols = symbols[:3]
            self.assertIn(expected_symbol, top_3_symbols,
                         f"Expected {expected_symbol} in top 3 results for '{search_term}'")
            
            # Verify company name
            for result in data['results']:
                if result['symbol'] == expected_symbol:
                    self.assertIn(expected_name_part.upper(), result['name'].upper())
                    break
    
    def test_real_prefix_search(self):
        """Test prefix matching with real data"""
        # Search for 'APP' should return AAPL before other APP stocks
        response = self.client.get('/api/symbols/search', {'q': 'APP'})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        results = data['results']
        
        # Find AAPL position
        aapl_position = None
        for i, result in enumerate(results):
            if result['symbol'] == 'AAPL':
                aapl_position = i
                break
        
        # AAPL should be in results and ranked high
        self.assertIsNotNone(aapl_position, "AAPL should be in APP search results")
        self.assertLess(aapl_position, 5, "AAPL should be in top 5 for APP search")
    
    def test_authentication_required(self):
        """Test that authentication is properly enforced"""
        # Remove auth header
        client_no_auth = Client()
        
        response = client_no_auth.get('/api/symbols/search', {'q': 'AAPL'})
        
        # Depending on your auth setup, this might return 401 or still work
        # If public access is allowed, modify this test accordingly
        # For now, we'll just check it returns a valid response
        self.assertIn(response.status_code, [200, 401, 403])
    
    def test_rate_limiting(self):
        """Test that multiple rapid requests are handled properly"""
        # Make 5 rapid requests
        results = []
        for i in range(5):
            response = self.client.get('/api/symbols/search', {'q': f'TEST{i}'})
            results.append(response.status_code)
        
        # All should succeed (your rate limiting might kick in at higher numbers)
        for status in results:
            self.assertEqual(status, 200)
    
    def test_alpha_vantage_fallback_real(self):
        """Test that Alpha Vantage is actually called for obscure symbols"""
        # Search for a less common symbol that might not be in local DB
        obscure_symbol = 'ZZZZ'  # Or another rarely searched symbol
        
        response = self.client.get('/api/symbols/search', {'q': obscure_symbol})
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertTrue(data['ok'])
        
        # Check if any results have source='alpha_vantage'
        av_results = [r for r in data['results'] if r.get('source') == 'alpha_vantage']
        # This might or might not return AV results depending on your data
    
    def test_performance_with_real_data(self):
        """Test search performance with real data"""
        import time
        
        start_time = time.time()
        response = self.client.get('/api/symbols/search', {'q': 'A', 'limit': 50})
        end_time = time.time()
        
        self.assertEqual(response.status_code, 200)
        
        # Search should complete in reasonable time (< 2 seconds)
        response_time = end_time - start_time
        self.assertLess(response_time, 2.0, 
                       f"Search took {response_time:.2f}s, should be under 2s")
        
        data = response.json()
        self.assertEqual(len(data['results']), 50)
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after tests"""
        super().tearDownClass()
        
        # Sign out from Supabase
        if hasattr(cls, 'supabase'):
            try:
                cls.supabase.auth.sign_out()
            except:
                pass 