"""
Real authentication and API tests for the simplified portfolio tracker
Uses actual Supabase auth and real Alpha Vantage API calls
No mocks, no stubs - everything hits real services
"""
import pytest
import os
import sys
from dotenv import load_dotenv
import asyncio
from httpx import AsyncClient
from supabase.client import create_client
import json
from datetime import datetime, date
import requests  # used only for health-check

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend_simplified'))

# Load test environment
load_dotenv('.env.test')

# Test configuration from environment
TEST_USER_EMAIL = os.getenv('TEST_USER_EMAIL')
TEST_USER_PASSWORD = os.getenv('TEST_USER_PASSWORD')
SUPA_API_URL = os.getenv('SUPA_API_URL')
SUPA_API_ANON_KEY = os.getenv('SUPA_API_ANON_KEY')
TEST_API_URL = os.getenv('TEST_API_URL', 'http://localhost:8000')

# Validate required environment variables
if not all([TEST_USER_EMAIL, TEST_USER_PASSWORD, SUPA_API_URL, SUPA_API_ANON_KEY]):
    raise ValueError("Missing required test environment variables")

# Test data
TEST_SYMBOL = os.getenv('TEST_STOCK_SYMBOL', 'AAPL')
TEST_PRICE = float(os.getenv('TEST_STOCK_PRICE', '150.00'))
TEST_QUANTITY = float(os.getenv('TEST_STOCK_QUANTITY', '10'))

class TestRealAuthenticationAPI:
    """Test suite using real authentication and real API calls"""
    
    @classmethod
    def setup_class(cls):
        """Setup with real Supabase authentication. Requires existing backend at TEST_API_URL"""
        print(f"[test_real_auth_api.py::setup_class] Setting up test suite")
        print(f"[test_real_auth_api.py::setup_class] Test user: {TEST_USER_EMAIL}")
        print(f"[test_real_auth_api.py::setup_class] API URL: {TEST_API_URL}")
        
        # Confirm backend is reachable (allow up to 15 s for first byte)
        try:
            health_resp = requests.get(f"{TEST_API_URL}/", timeout=(5,90))
            print(f"[test_real_auth_api.py::setup_class] ✓ Backend reachable, status {health_resp.status_code}")
        except Exception as e:
            raise RuntimeError(f"Backend at {TEST_API_URL} is not reachable (15 s timeout)") from e
        
        # Create Supabase client
        cls.supabase = create_client(str(SUPA_API_URL), str(SUPA_API_ANON_KEY))
        
        # Real authentication
        try:
            auth_response = cls.supabase.auth.sign_in_with_password({
                'email': str(TEST_USER_EMAIL),
                'password': str(TEST_USER_PASSWORD)
            })
            
            if not auth_response.session or not auth_response.user:
                raise ValueError("Authentication failed - no session or user returned")
            
            cls.access_token = auth_response.session.access_token
            cls.user_id = auth_response.user.id
            cls.headers = {'Authorization': f'Bearer {cls.access_token}'}
            
            print(f"[test_real_auth_api.py::setup_class] ✓ Authenticated as: {auth_response.user.email}")
            print(f"[test_real_auth_api.py::setup_class] ✓ User ID: {cls.user_id}")
            print(f"[test_real_auth_api.py::setup_class] ✓ Token obtained: {cls.access_token[:20]}...")
            
        except Exception as e:
            print(f"[test_real_auth_api.py::setup_class] ✗ Authentication failed: {e}")
            raise
    
    @pytest.mark.asyncio
    async def test_real_auth_validation(self):
        """Test that our authentication token is valid"""
        print("\n[test_real_auth_api.py::test_real_auth_validation] Testing auth validation")
        
        async with AsyncClient(base_url=TEST_API_URL) as client:
            response = await client.get('/api/auth/validate', headers=self.headers)
            
            print(f"[test_real_auth_api.py::test_real_auth_validation] Response status: {response.status_code}")
            print(f"[test_real_auth_api.py::test_real_auth_validation] Response body: {response.json()}")
            
            assert response.status_code == 200
            data = response.json()
            assert data['valid'] == True
            assert data['user_id'] == self.user_id
            assert data['email'] == TEST_USER_EMAIL
    
    @pytest.mark.asyncio
    async def test_real_symbol_search(self):
        """Test stock symbol search with real Alpha Vantage API"""
        print("\n[test_real_auth_api.py::test_real_symbol_search] Testing symbol search")
        
        search_queries = ['AAPL', 'MSFT', 'GOOGL', 'SPY']
        
        async with AsyncClient(base_url=TEST_API_URL, timeout=30.0) as client:
            for query in search_queries:
                print(f"\n[test_real_auth_api.py::test_real_symbol_search] Searching for: {query}")
                
                response = await client.get(
                    '/api/symbol_search',
                    params={'q': query, 'limit': 10}
                )
                
                print(f"[test_real_auth_api.py::test_real_symbol_search] Status: {response.status_code}")
                
                assert response.status_code == 200
                data = response.json()
                
                assert data['ok'] == True
                assert 'results' in data
                assert len(data['results']) > 0
                
                # Test scoring algorithm - exact match should be first
                if data['results']:
                    first_result = data['results'][0]
                    print(f"[test_real_auth_api.py::test_real_symbol_search] First result: {first_result['symbol']} - {first_result['name']}")
                    
                    # For exact ticker queries, first result should match
                    assert first_result['symbol'] == query
    
    @pytest.mark.asyncio
    async def test_real_stock_overview(self):
        """Test getting stock overview with real Alpha Vantage data"""
        print(f"\n[test_real_auth_api.py::test_real_stock_overview] Testing stock overview for {TEST_SYMBOL}")
        
        async with AsyncClient(base_url=TEST_API_URL, timeout=30.0) as client:
            response = await client.get(
                f'/api/stock_overview?symbol={TEST_SYMBOL}',
                headers=self.headers
            )
            
            print(f"[test_real_auth_api.py::test_real_stock_overview] Status: {response.status_code}")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data['success'] == True
            assert data['symbol'] == TEST_SYMBOL
            
            # Check price data
            assert 'price_data' in data
            price_data = data['price_data']
            print(f"[test_real_auth_api.py::test_real_stock_overview] Current price: ${price_data.get('price', 'N/A')}")
            print(f"[test_real_auth_api.py::test_real_stock_overview] Change: {price_data.get('change_percent', 'N/A')}%")
            
            # Check fundamentals
            assert 'fundamentals' in data
            fundamentals = data['fundamentals']
            print(f"[test_real_auth_api.py::test_real_stock_overview] Market Cap: ${fundamentals.get('market_cap', 'N/A')}")
            print(f"[test_real_auth_api.py::test_real_stock_overview] P/E Ratio: {fundamentals.get('pe_ratio', 'N/A')}")
            print(f"[test_real_auth_api.py::test_real_stock_overview] EPS: ${fundamentals.get('eps', 'N/A')}")
    
    @pytest.mark.asyncio
    async def test_real_transaction_flow(self):
        """Test complete transaction flow with real database"""
        print("\n[test_real_auth_api.py::test_real_transaction_flow] Testing transaction flow")
        
        async with AsyncClient(base_url=TEST_API_URL, timeout=30.0) as client:
            # 1. Add a buy transaction
            buy_transaction = {
                'transaction_type': 'Buy',
                'symbol': TEST_SYMBOL,
                'quantity': TEST_QUANTITY,
                'price': TEST_PRICE,
                'date': date.today().isoformat(),
                'currency': 'USD',
                'commission': 1.99,
                'notes': f'Real API test buy at {datetime.now()}'
            }
            
            print(f"[test_real_auth_api.py::test_real_transaction_flow] Adding buy transaction: {buy_transaction}")
            
            response = await client.post(
                '/api/transactions',
                json=buy_transaction,
                headers=self.headers
            )
            
            print(f"[test_real_auth_api.py::test_real_transaction_flow] Add response: {response.status_code}")
            assert response.status_code == 200
            
            add_data = response.json()
            assert add_data['success'] == True
            transaction_id = add_data['transaction']['id']
            print(f"[test_real_auth_api.py::test_real_transaction_flow] Transaction ID: {transaction_id}")
            
            # 2. Get transactions list
            print("\n[test_real_auth_api.py::test_real_transaction_flow] Getting transaction list")
            
            list_response = await client.get('/api/transactions', headers=self.headers)
            assert list_response.status_code == 200
            
            list_data = list_response.json()
            assert list_data['success'] == True
            assert len(list_data['transactions']) > 0
            
            # Find our transaction
            our_transaction = next(
                (t for t in list_data['transactions'] if t['id'] == transaction_id),
                None
            )
            assert our_transaction is not None
            print(f"[test_real_auth_api.py::test_real_transaction_flow] Found our transaction in list")
            
            # 3. Update the transaction
            print("\n[test_real_auth_api.py::test_real_transaction_flow] Updating transaction")
            
            update_data = {
                'transaction_type': 'Buy',
                'symbol': TEST_SYMBOL,
                'quantity': TEST_QUANTITY + 5,  # Change quantity
                'price': TEST_PRICE,
                'date': date.today().isoformat(),
                'currency': 'USD',
                'commission': 2.99,
                'notes': f'Updated at {datetime.now()}'
            }
            
            update_response = await client.put(
                f'/api/transactions/{transaction_id}',
                json=update_data,
                headers=self.headers
            )
            
            assert update_response.status_code == 200
            update_result = update_response.json()
            assert update_result['success'] == True
            assert update_result['transaction']['quantity'] == TEST_QUANTITY + 5
            
            # 4. Delete the transaction
            print("\n[test_real_auth_api.py::test_real_transaction_flow] Deleting transaction")
            
            delete_response = await client.delete(
                f'/api/transactions/{transaction_id}',
                headers=self.headers
            )
            
            assert delete_response.status_code == 200
            delete_result = delete_response.json()
            assert delete_result['success'] == True
            
            print("[test_real_auth_api.py::test_real_transaction_flow] ✓ Transaction flow completed")
    
    @pytest.mark.asyncio
    async def test_real_portfolio_calculation(self):
        """Test portfolio calculation with real data"""
        print("\n[test_real_auth_api.py::test_real_portfolio_calculation] Testing portfolio calculation")
        
        async with AsyncClient(base_url=TEST_API_URL, timeout=30.0) as client:
            # First, add some test transactions
            test_transactions = [
                {
                    'transaction_type': 'Buy',
                    'symbol': 'AAPL',
                    'quantity': 10,
                    'price': 150.00,
                    'date': '2024-01-01',
                    'currency': 'USD',
                    'commission': 1.99,
                    'notes': 'Test portfolio position 1'
                },
                {
                    'transaction_type': 'Buy',
                    'symbol': 'MSFT',
                    'quantity': 5,
                    'price': 350.00,
                    'date': '2024-01-02',
                    'currency': 'USD',
                    'commission': 1.99,
                    'notes': 'Test portfolio position 2'
                }
            ]
            
            added_ids = []
            
            for transaction in test_transactions:
                print(f"[test_real_auth_api.py::test_real_portfolio_calculation] Adding: {transaction['symbol']}")
                response = await client.post(
                    '/api/transactions',
                    json=transaction,
                    headers=self.headers
                )
                assert response.status_code == 200
                added_ids.append(response.json()['transaction']['id'])
            
            # Get portfolio
            print("\n[test_real_auth_api.py::test_real_portfolio_calculation] Getting portfolio")
            
            portfolio_response = await client.get('/api/portfolio', headers=self.headers)
            assert portfolio_response.status_code == 200
            
            portfolio_data = portfolio_response.json()
            assert portfolio_data['success'] == True
            
            print(f"[test_real_auth_api.py::test_real_portfolio_calculation] Holdings: {len(portfolio_data['holdings'])}")
            print(f"[test_real_auth_api.py::test_real_portfolio_calculation] Total value: ${portfolio_data['total_value']:.2f}")
            print(f"[test_real_auth_api.py::test_real_portfolio_calculation] Total cost: ${portfolio_data['total_cost']:.2f}")
            print(f"[test_real_auth_api.py::test_real_portfolio_calculation] Gain/Loss: ${portfolio_data['total_gain_loss']:.2f} ({portfolio_data['total_gain_loss_percent']:.2f}%)")
            
            # Clean up test transactions
            for transaction_id in added_ids:
                await client.delete(f'/api/transactions/{transaction_id}', headers=self.headers)
            
            print("[test_real_auth_api.py::test_real_portfolio_calculation] ✓ Portfolio test completed")
    
    @pytest.mark.asyncio
    async def test_real_dashboard_data(self):
        """Test dashboard endpoint with real data aggregation"""
        print("\n[test_real_auth_api.py::test_real_dashboard_data] Testing dashboard")
        
        async with AsyncClient(base_url=TEST_API_URL, timeout=30.0) as client:
            response = await client.get('/api/dashboard', headers=self.headers)
            
            print(f"[test_real_auth_api.py::test_real_dashboard_data] Status: {response.status_code}")
            assert response.status_code == 200
            
            data = response.json()
            assert 'portfolio' in data
            assert 'top_holdings' in data
            assert 'transaction_summary' in data
            assert 'market_data' in data
            
            print(f"[test_real_auth_api.py::test_real_dashboard_data] Portfolio value: ${data['portfolio']['total_value']:.2f}")
            print(f"[test_real_auth_api.py::test_real_dashboard_data] Holdings count: {data['portfolio']['holdings_count']}")
            print(f"[test_real_auth_api.py::test_real_dashboard_data] Total transactions: {data['transaction_summary']['total_transactions']}")
            
            if data['market_data'] and data['market_data']['spy']:
                print(f"[test_real_auth_api.py::test_real_dashboard_data] S&P 500: ${data['market_data']['spy']['price']:.2f} ({data['market_data']['spy']['change_percent']}%)")

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--log-cli-level=INFO']) 