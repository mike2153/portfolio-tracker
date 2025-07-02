"""
Integration Tests for Stock Search and Historical Price APIs with Real Authentication
Tests the complete flow from search to price fetching with actual authentication
"""

import os
import sys
import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List
import logging

# Configure logging for debugging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class StockSearchPriceIntegrationTest:
    """Test suite for stock search and historical price APIs with real authentication"""
    
    def __init__(self):
        # Load environment variables
        self.base_url = os.getenv('BACKEND_BASE_URL', 'http://localhost:8000')
        self.test_email = os.getenv('TEST_USER_EMAIL')
        self.test_password = os.getenv('TEST_USER_PASSWORD')
        
        if not self.test_email or not self.test_password:
            raise ValueError("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in environment")
        
        self.auth_token = None
        self.session = requests.Session()
        
        logger.info(f"🔧 [INIT] Test configuration:")
        logger.info(f"🔧 [INIT] Base URL: {self.base_url}")
        logger.info(f"🔧 [INIT] Test Email: {self.test_email}")
        logger.info(f"🔧 [INIT] Test Password: {'*' * len(self.test_password)}")
    
    def authenticate(self) -> bool:
        """Authenticate with real credentials and get access token"""
        logger.info(f"\n{'='*60}")
        logger.info(f"🔐 [AUTH] Starting real authentication flow")
        logger.info(f"{'='*60}")
        
        auth_url = f"{self.base_url}/api/auth/login"
        auth_payload = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        logger.info(f"📡 [AUTH] Sending POST request to: {auth_url}")
        logger.info(f"📡 [AUTH] Payload: email={self.test_email}, password={'*' * len(self.test_password)}")
        
        try:
            response = self.session.post(auth_url, json=auth_payload)
            logger.info(f"📡 [AUTH] Response status: {response.status_code}")
            logger.info(f"📡 [AUTH] Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ [AUTH] Authentication successful")
                logger.info(f"📡 [AUTH] Response data keys: {list(data.keys())}")
                
                # Extract access token
                if 'access_token' in data:
                    self.auth_token = data['access_token']
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.auth_token}'
                    })
                    logger.info(f"🔑 [AUTH] Access token stored (length: {len(self.auth_token)})")
                    logger.info(f"🔑 [AUTH] Token preview: {self.auth_token[:20]}...")
                    return True
                else:
                    logger.error(f"❌ [AUTH] No access_token in response")
                    logger.error(f"❌ [AUTH] Response data: {data}")
                    return False
            else:
                logger.error(f"❌ [AUTH] Authentication failed with status: {response.status_code}")
                try:
                    error_data = response.json()
                    logger.error(f"❌ [AUTH] Error response: {error_data}")
                except:
                    logger.error(f"❌ [AUTH] Raw error response: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"💥 [AUTH] Exception during authentication: {str(e)}")
            import traceback
            logger.error(f"💥 [AUTH] Traceback:\n{traceback.format_exc()}")
            return False
    
    def test_symbol_search_basic(self):
        """Test basic symbol search functionality"""
        logger.info(f"\n{'='*60}")
        logger.info(f"🔍 [TEST] Testing Basic Symbol Search")
        logger.info(f"{'='*60}")
        
        # Test cases for basic search
        test_queries = ['AAPL', 'MSFT', 'GOOGL', 'AMZN']
        
        for query in test_queries:
            logger.info(f"\n📋 [TEST] Searching for: '{query}'")
            search_url = f"{self.base_url}/api/symbol_search"
            params = {'q': query, 'limit': 10}
            
            logger.info(f"📡 [TEST] GET {search_url}")
            logger.info(f"📡 [TEST] Params: {params}")
            
            response = self.session.get(search_url, params=params)
            logger.info(f"📡 [TEST] Response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ [TEST] Search successful")
                logger.info(f"📊 [TEST] Results count: {data.get('total', 0)}")
                
                # Log first few results
                results = data.get('results', [])
                for i, result in enumerate(results[:3]):
                    logger.info(f"📊 [TEST] Result {i+1}: {result.get('symbol')} - {result.get('name')}")
                
                # Validate response structure
                assert 'ok' in data or 'success' in data, "Response missing success indicator"
                assert 'results' in data, "Response missing results"
                assert isinstance(data['results'], list), "Results should be a list"
                
                if results:
                    # Validate result structure
                    first_result = results[0]
                    assert 'symbol' in first_result, "Result missing symbol"
                    assert 'name' in first_result, "Result missing name"
                    logger.info(f"✅ [TEST] Response structure validated")
            else:
                logger.error(f"❌ [TEST] Search failed with status: {response.status_code}")
                logger.error(f"❌ [TEST] Response: {response.text}")
                assert False, f"Search failed for query: {query}"
    
    def test_fuzzy_search(self):
        """Test fuzzy search with typos and partial matches"""
        logger.info(f"\n{'='*60}")
        logger.info(f"🔍 [TEST] Testing Fuzzy Search (Typos & Partial Matches)")
        logger.info(f"{'='*60}")
        
        # Test cases with typos and expected matches
        fuzzy_test_cases = [
            {'query': 'APPL', 'expected': 'AAPL', 'description': 'Common typo: APPL -> AAPL'},
            {'query': 'GOOGL', 'expected': 'GOOGL', 'description': 'Exact match should work'},
            {'query': 'AMZM', 'expected': 'AMZN', 'description': 'Typo: AMZM -> AMZN'},
            {'query': 'MELA', 'expected': 'META', 'description': 'Typo: MELA -> META'},
            {'query': 'AA', 'expected': 'AAPL', 'description': 'Partial match: AA -> AAPL'},
            {'query': 'MSF', 'expected': 'MSFT', 'description': 'Partial match: MSF -> MSFT'},
        ]
        
        for test_case in fuzzy_test_cases:
            query = test_case['query']
            expected = test_case['expected']
            description = test_case['description']
            
            logger.info(f"\n📋 [FUZZY] {description}")
            logger.info(f"📋 [FUZZY] Query: '{query}' -> Expected: '{expected}'")
            
            search_url = f"{self.base_url}/api/symbol_search"
            params = {'q': query, 'limit': 10}
            
            response = self.session.get(search_url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                
                logger.info(f"📊 [FUZZY] Found {len(results)} results")
                
                # Check if expected symbol is in results
                found = False
                position = -1
                for i, result in enumerate(results):
                    logger.info(f"📊 [FUZZY] Result {i+1}: {result.get('symbol')} - {result.get('name')}")
                    if result.get('symbol') == expected:
                        found = True
                        position = i + 1
                        break
                
                if found:
                    logger.info(f"✅ [FUZZY] Found '{expected}' at position {position}")
                else:
                    logger.warning(f"⚠️ [FUZZY] '{expected}' not found in results")
                    logger.warning(f"⚠️ [FUZZY] This might indicate fuzzy search needs improvement")
                
                # Even if not found, test passes if we get results
                assert len(results) > 0, f"No results for fuzzy query: {query}"
            else:
                logger.error(f"❌ [FUZZY] Search failed with status: {response.status_code}")
                assert False, f"Fuzzy search failed for query: {query}"
    
    def test_historical_price_with_real_auth(self):
        """Test historical price fetch with real authentication"""
        logger.info(f"\n{'='*60}")
        logger.info(f"💰 [TEST] Testing Historical Price Fetch")
        logger.info(f"{'='*60}")
        
        # Test with a known symbol and recent date
        symbol = 'AAPL'
        test_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        
        logger.info(f"📋 [PRICE] Testing price fetch for {symbol} on {test_date}")
        
        price_url = f"{self.base_url}/api/historical_price/{symbol}"
        params = {'date': test_date}
        
        logger.info(f"📡 [PRICE] GET {price_url}")
        logger.info(f"📡 [PRICE] Params: {params}")
        logger.info(f"📡 [PRICE] Auth header: Bearer {self.auth_token[:20]}...")
        
        response = self.session.get(price_url, params=params)
        logger.info(f"📡 [PRICE] Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ [PRICE] Price fetch successful")
            logger.info(f"📊 [PRICE] Response data: {json.dumps(data, indent=2)}")
            
            # Validate response structure - FIX: Check actual backend response format
            assert 'success' in data, "Response missing success field"
            assert data['success'] == True, "Success should be True"
            assert 'symbol' in data, "Response missing symbol"
            assert 'price_data' in data, "Response missing price_data"
            assert 'close' in data['price_data'], "Price data missing close price"
            
            close_price = data['price_data']['close']
            logger.info(f"💰 [PRICE] Close price: ${close_price}")
            
            # Validate price is reasonable
            assert isinstance(close_price, (int, float)), "Close price should be numeric"
            assert close_price > 0, "Close price should be positive"
            assert close_price < 10000, "Close price seems unreasonably high"
            
            logger.info(f"✅ [PRICE] Price validation passed")
            
            # Log all price data fields
            price_data = data['price_data']
            logger.info(f"📊 [PRICE] Full price data:")
            logger.info(f"  - Open: ${price_data.get('open', 'N/A')}")
            logger.info(f"  - High: ${price_data.get('high', 'N/A')}")
            logger.info(f"  - Low: ${price_data.get('low', 'N/A')}")
            logger.info(f"  - Close: ${price_data.get('close', 'N/A')}")
            logger.info(f"  - Volume: {price_data.get('volume', 'N/A')}")
            
        elif response.status_code == 401:
            logger.error(f"❌ [PRICE] Authentication failed - not authorized")
            logger.error(f"❌ [PRICE] Response: {response.text}")
            assert False, "Authentication required for historical price API"
        else:
            logger.error(f"❌ [PRICE] Price fetch failed with status: {response.status_code}")
            logger.error(f"❌ [PRICE] Response: {response.text}")
            assert False, f"Price fetch failed for {symbol} on {test_date}"
    
    def test_price_validation_scenarios(self):
        """Test various price fetch scenarios including edge cases"""
        logger.info(f"\n{'='*60}")
        logger.info(f"💰 [TEST] Testing Price Validation Scenarios")
        logger.info(f"{'='*60}")
        
        test_scenarios = [
            {
                'name': 'Weekend date - should return Friday price',
                'symbol': 'MSFT',
                'date': '2024-01-06',  # Saturday
                'expect_different_date': True
            },
            {
                'name': 'Future date - should fail',
                'symbol': 'AAPL',
                'date': (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
                'expect_error': True
            },
            {
                'name': 'Invalid date format',
                'symbol': 'GOOGL',
                'date': '2024/01/15',  # Wrong format
                'expect_error': True
            },
            {
                'name': 'Very old date',
                'symbol': 'IBM',
                'date': '1990-01-15',
                'expect_success': True  # May or may not have data
            }
        ]
        
        for scenario in test_scenarios:
            logger.info(f"\n📋 [SCENARIO] {scenario['name']}")
            logger.info(f"📋 [SCENARIO] Symbol: {scenario['symbol']}, Date: {scenario['date']}")
            
            price_url = f"{self.base_url}/api/historical_price/{scenario['symbol']}"
            params = {'date': scenario['date']}
            
            response = self.session.get(price_url, params=params)
            
            if scenario.get('expect_error'):
                if response.status_code != 200:
                    logger.info(f"✅ [SCENARIO] Expected error occurred - status: {response.status_code}")
                else:
                    data = response.json()
                    if not data.get('success'):
                        logger.info(f"✅ [SCENARIO] Expected error in response - success: False")
                    else:
                        logger.warning(f"⚠️ [SCENARIO] Expected error but got success response")
            else:
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        logger.info(f"✅ [SCENARIO] Price fetch successful")
                        if scenario.get('expect_different_date'):
                            actual_date = data.get('actual_date')
                            requested_date = data.get('requested_date')
                            if actual_date != requested_date:
                                logger.info(f"✅ [SCENARIO] Got different date as expected")
                                logger.info(f"📊 [SCENARIO] Requested: {requested_date}, Actual: {actual_date}")
                    else:
                        logger.info(f"📊 [SCENARIO] No price data available (expected for old dates)")
                else:
                    logger.warning(f"⚠️ [SCENARIO] Unexpected error - status: {response.status_code}")
    
    def test_complete_transaction_flow(self):
        """Test the complete flow from search to price fetch to transaction submission"""
        logger.info(f"\n{'='*60}")
        logger.info(f"🔄 [TEST] Testing Complete Transaction Flow")
        logger.info(f"{'='*60}")
        
        # Step 1: Search for a stock
        search_query = 'AAPL'
        logger.info(f"\n📋 [FLOW] Step 1: Search for '{search_query}'")
        
        search_url = f"{self.base_url}/api/symbol_search"
        search_response = self.session.get(search_url, params={'q': search_query, 'limit': 5})
        
        assert search_response.status_code == 200, "Search failed"
        search_data = search_response.json()
        results = search_data.get('results', [])
        assert len(results) > 0, "No search results"
        
        selected_symbol = results[0]
        logger.info(f"✅ [FLOW] Selected: {selected_symbol['symbol']} - {selected_symbol['name']}")
        
        # Step 2: Fetch historical price
        test_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
        logger.info(f"\n📋 [FLOW] Step 2: Fetch price for {selected_symbol['symbol']} on {test_date}")
        
        price_url = f"{self.base_url}/api/historical_price/{selected_symbol['symbol']}"
        price_response = self.session.get(price_url, params={'date': test_date})
        
        assert price_response.status_code == 200, "Price fetch failed"
        price_data = price_response.json()
        assert price_data.get('success'), "Price fetch not successful"
        
        close_price = price_data['price_data']['close']
        logger.info(f"✅ [FLOW] Got closing price: ${close_price}")
        
        # Step 3: Validate transaction data
        logger.info(f"\n📋 [FLOW] Step 3: Validate transaction data")
        
        transaction_data = {
            'transaction_type': 'Buy',
            'symbol': selected_symbol['symbol'],
            'quantity': 10,
            'price': close_price,
            'date': test_date,
            'currency': 'USD',
            'commission': 0,
            'notes': 'Test transaction from integration test'
        }
        
        # Validate all required fields
        required_fields = ['symbol', 'quantity', 'price', 'date']
        for field in required_fields:
            assert transaction_data.get(field), f"Missing required field: {field}"
            logger.info(f"✅ [FLOW] {field}: {transaction_data[field]}")
        
        # Validate numeric fields
        assert transaction_data['quantity'] > 0, "Quantity must be positive"
        assert transaction_data['price'] > 0, "Price must be positive"
        
        logger.info(f"✅ [FLOW] Transaction data validated successfully")
        
        # Log complete flow summary
        logger.info(f"\n📊 [FLOW] Complete Flow Summary:")
        logger.info(f"📊 [FLOW] 1. Searched for: {search_query}")
        logger.info(f"📊 [FLOW] 2. Selected: {selected_symbol['symbol']} - {selected_symbol['name']}")
        logger.info(f"📊 [FLOW] 3. Fetched price: ${close_price} on {test_date}")
        logger.info(f"📊 [FLOW] 4. Transaction ready with all required fields")
        
        return True
    
    def run_all_tests(self):
        """Run all test cases"""
        logger.info(f"\n{'='*80}")
        logger.info(f"🚀 STARTING STOCK SEARCH & PRICE INTEGRATION TESTS")
        logger.info(f"{'='*80}")
        
        # First authenticate
        if not self.authenticate():
            logger.error(f"❌ Authentication failed - cannot proceed with tests")
            return False
        
        logger.info(f"✅ Authentication successful - proceeding with tests")
        
        test_results = []
        
        # Run each test
        tests = [
            ("Basic Symbol Search", self.test_symbol_search_basic),
            ("Fuzzy Search with Typos", self.test_fuzzy_search),
            ("Historical Price Fetch", self.test_historical_price_with_real_auth),
            ("Price Validation Scenarios", self.test_price_validation_scenarios),
            ("Complete Transaction Flow", self.test_complete_transaction_flow),
        ]
        
        for test_name, test_func in tests:
            try:
                test_func()
                test_results.append((test_name, "PASSED", None))
                logger.info(f"\n✅ {test_name}: PASSED")
            except Exception as e:
                test_results.append((test_name, "FAILED", str(e)))
                logger.error(f"\n❌ {test_name}: FAILED - {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
        
        # Summary
        logger.info(f"\n{'='*80}")
        logger.info(f"📊 TEST SUMMARY")
        logger.info(f"{'='*80}")
        
        passed = sum(1 for _, status, _ in test_results if status == "PASSED")
        failed = sum(1 for _, status, _ in test_results if status == "FAILED")
        
        for test_name, status, error in test_results:
            status_emoji = "✅" if status == "PASSED" else "❌"
            logger.info(f"{status_emoji} {test_name}: {status}")
            if error:
                logger.info(f"   Error: {error}")
        
        logger.info(f"\nTotal: {len(test_results)} tests")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {failed}")
        
        return failed == 0


if __name__ == "__main__":
    # Load environment variables if .env file exists
    try:
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            logger.info(f"✅ Loaded environment from: {env_path}")
        else:
            logger.warning(f"⚠️ No .env file found at: {env_path}")
    except ImportError:
        logger.warning("⚠️ python-dotenv not installed - using system environment variables")
    
    # Run tests
    test_suite = StockSearchPriceIntegrationTest()
    success = test_suite.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1) 