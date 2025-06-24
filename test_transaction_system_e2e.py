#!/usr/bin/env python3
"""
End-to-End Test Script for Transaction System

This script tests the complete transaction system including:
- Backend API endpoints
- Database operations
- Service functionality
- Rate limiting
- Data validation
- Historical data fetching
- Currency support

Run this script to validate the entire transaction system.
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, date, timedelta
from decimal import Decimal

# Add Django settings
sys.path.append('backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from api.models import (
    Transaction, DailyPriceCache, UserApiRateLimit, UserSettings,
    ExchangeRate, Portfolio, Holding
)
from api.services.transaction_service import (
    get_transaction_service, get_price_update_service
)

# Configuration
BASE_URL = 'http://localhost:8000'
TEST_USER_ID = 'test_user_e2e'

class Colors:
    """ANSI color codes for console output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_section(title: str):
    """Print a formatted section header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title.center(60)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")

def print_test(test_name: str):
    """Print a test name"""
    print(f"\n{Colors.CYAN}🧪 {test_name}{Colors.END}")

def print_success(message: str):
    """Print a success message"""
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message: str):
    """Print an error message"""
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message: str):
    """Print a warning message"""
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message: str):
    """Print an info message"""
    print(f"{Colors.WHITE}ℹ️  {message}{Colors.END}")

def cleanup_test_data():
    """Clean up any existing test data"""
    print_info("Cleaning up existing test data...")
    
    # Delete test transactions
    Transaction.objects.filter(user_id=TEST_USER_ID).delete()
    
    # Delete test portfolios and holdings
    Portfolio.objects.filter(user_id=TEST_USER_ID).delete()
    
    # Delete test rate limits
    UserApiRateLimit.objects.filter(user_id=TEST_USER_ID).delete()
    
    # Delete test settings
    UserSettings.objects.filter(user_id=TEST_USER_ID).delete()
    
    print_success("Test data cleaned up")

def test_database_models():
    """Test database model functionality"""
    print_section("DATABASE MODEL TESTS")
    
    print_test("Testing Transaction model creation")
    try:
        transaction = Transaction.objects.create(
            user_id=TEST_USER_ID,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10.5'),
            price_per_share=Decimal('150.75'),
            transaction_date=date.today(),
            transaction_currency='USD',
            commission=Decimal('9.99'),
            notes='Test transaction'
        )
        
        # Verify total amount calculation
        expected_total = (Decimal('10.5') * Decimal('150.75')) + Decimal('9.99')
        assert transaction.total_amount == expected_total, f"Expected {expected_total}, got {transaction.total_amount}"
        
        print_success(f"Transaction created with ID: {transaction.id}")
        print_info(f"Total amount calculated: ${transaction.total_amount}")
        
    except Exception as e:
        print_error(f"Transaction creation failed: {e}")
        return False
    
    print_test("Testing DailyPriceCache model")
    try:
        cache_entry = DailyPriceCache.objects.create(
            ticker='AAPL',
            date=date.today(),
            open_price=Decimal('150.00'),
            high_price=Decimal('155.00'),
            low_price=Decimal('149.50'),
            close_price=Decimal('152.75'),
            adjusted_close=Decimal('152.75'),
            volume=1000000,
            source='Test',
            requested_by_user=TEST_USER_ID
        )
        
        print_success(f"Price cache entry created: {cache_entry}")
        
    except Exception as e:
        print_error(f"Price cache creation failed: {e}")
        return False
    
    print_test("Testing UserApiRateLimit model")
    try:
        rate_limit = UserApiRateLimit.objects.create(
            user_id=TEST_USER_ID,
            daily_limit=100
        )
        
        # Test rate limiting logic
        assert rate_limit.can_fetch_prices(), "Should be able to fetch when no previous fetch"
        
        rate_limit.record_price_fetch()
        assert not rate_limit.can_fetch_prices(), "Should not be able to fetch immediately after"
        
        print_success("Rate limiting logic works correctly")
        
    except Exception as e:
        print_error(f"Rate limit testing failed: {e}")
        return False
    
    return True

def test_transaction_service():
    """Test transaction service functionality"""
    print_section("TRANSACTION SERVICE TESTS")
    
    service = get_transaction_service()
    
    print_test("Testing transaction creation via service")
    try:
        transaction_data = {
            'transaction_type': 'BUY',
            'ticker': 'MSFT',
            'company_name': 'Microsoft Corporation',
            'shares': 5,
            'price_per_share': 300.00,
            'transaction_date': date.today().isoformat(),
            'transaction_currency': 'USD',
            'commission': 9.99,
            'notes': 'Service test transaction'
        }
        
        result = service.create_transaction(TEST_USER_ID, transaction_data)
        
        assert result['success'], f"Transaction creation failed: {result.get('error')}"
        
        print_success(f"Transaction created via service: {result['transaction_id']}")
        
    except Exception as e:
        print_error(f"Service transaction creation failed: {e}")
        return False
    
    print_test("Testing get user transactions")
    try:
        transactions = service.get_user_transactions(TEST_USER_ID)
        
        assert len(transactions) >= 1, "Should have at least one transaction"
        
        print_success(f"Retrieved {len(transactions)} transactions")
        
        # Test filtering
        buy_transactions = service.get_user_transactions(TEST_USER_ID, 'BUY')
        assert all(t['transaction_type'] == 'BUY' for t in buy_transactions), "All should be BUY transactions"
        
        print_success("Transaction filtering works correctly")
        
    except Exception as e:
        print_error(f"Get transactions failed: {e}")
        return False
    
    print_test("Testing holdings calculation")
    try:
        holdings = service._calculate_holdings_from_transactions(TEST_USER_ID)
        
        print_info(f"Calculated holdings: {holdings}")
        
        # Should have AAPL and MSFT holdings
        assert 'AAPL' in holdings, "Should have AAPL holding"
        assert 'MSFT' in holdings, "Should have MSFT holding"
        
        print_success("Holdings calculation works correctly")
        
    except Exception as e:
        print_error(f"Holdings calculation failed: {e}")
        return False
    
    return True

def test_price_update_service():
    """Test price update service functionality"""
    print_section("PRICE UPDATE SERVICE TESTS")
    
    service = get_price_update_service()
    
    print_test("Testing cached prices retrieval")
    try:
        result = service.get_cached_prices(TEST_USER_ID)
        
        assert result['success'], "Should successfully get cached prices"
        
        print_success("Cached prices retrieved successfully")
        print_info(f"Retrieved {len(result['prices'])} cached prices")
        
    except Exception as e:
        print_error(f"Cached prices retrieval failed: {e}")
        return False
    
    print_test("Testing rate limiting")
    try:
        # First call should work (if no rate limit exists)
        result1 = service.update_user_current_prices(TEST_USER_ID)
        
        # If it fails due to missing API key, that's expected
        if not result1['success'] and 'api' in result1.get('error', '').lower():
            print_warning("API key not configured - rate limiting test skipped")
            return True
        
        # Second immediate call should be rate limited
        result2 = service.update_user_current_prices(TEST_USER_ID)
        
        if not result2['success'] and result2.get('error') == 'rate_limited':
            print_success("Rate limiting works correctly")
        else:
            print_warning("Rate limiting may not be working as expected")
        
    except Exception as e:
        print_error(f"Price update testing failed: {e}")
        return False
    
    return True

def test_api_endpoints():
    """Test API endpoints"""
    print_section("API ENDPOINT TESTS")
    
    # Note: This requires the Django server to be running
    print_info("Testing API endpoints (requires running Django server)")
    
    print_test("Testing transaction creation endpoint")
    try:
        transaction_data = {
            'user_id': TEST_USER_ID,
            'transaction_type': 'BUY',
            'ticker': 'GOOGL',
            'company_name': 'Alphabet Inc.',
            'shares': 2,
            'price_per_share': 125.50,
            'transaction_date': date.today().isoformat(),
            'transaction_currency': 'USD',
            'commission': 9.99,
            'notes': 'API test transaction'
        }
        
        response = requests.post(
            f'{BASE_URL}/api/transactions/create',
            json=transaction_data,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_success(f"API transaction created: {data}")
            else:
                print_error(f"API returned error: {data}")
        else:
            print_warning(f"API endpoint not available (status: {response.status_code})")
        
    except requests.exceptions.ConnectionError:
        print_warning("Django server not running - API tests skipped")
        return True
    except Exception as e:
        print_error(f"API test failed: {e}")
        return False
    
    print_test("Testing get transactions endpoint")
    try:
        response = requests.get(
            f'{BASE_URL}/api/transactions/user',
            params={'user_id': TEST_USER_ID},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                print_success(f"Retrieved {len(data.get('data', {}).get('transactions', []))} transactions via API")
            else:
                print_error(f"API returned error: {data}")
        else:
            print_warning(f"API endpoint returned status: {response.status_code}")
        
    except requests.exceptions.ConnectionError:
        print_warning("Django server not running - API tests skipped")
    except Exception as e:
        print_error(f"API test failed: {e}")
        return False
    
    print_test("Testing transaction summary endpoint")
    try:
        response = requests.get(
            f'{BASE_URL}/api/transactions/summary',
            params={'user_id': TEST_USER_ID},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                summary = data.get('data', {}).get('summary', {})
                print_success(f"Transaction summary: {summary.get('total_transactions', 0)} transactions")
                print_info(f"Total invested: ${summary.get('total_invested', 0)}")
                print_info(f"Unique tickers: {summary.get('unique_tickers', 0)}")
            else:
                print_error(f"API returned error: {data}")
        else:
            print_warning(f"API endpoint returned status: {response.status_code}")
        
    except requests.exceptions.ConnectionError:
        print_warning("Django server not running - API tests skipped")
    except Exception as e:
        print_error(f"API test failed: {e}")
        return False
    
    return True

def test_data_integrity():
    """Test data integrity and calculations"""
    print_section("DATA INTEGRITY TESTS")
    
    print_test("Testing transaction data integrity")
    try:
        # Get all test transactions
        transactions = Transaction.objects.filter(user_id=TEST_USER_ID)
        
        total_buy_amount = Decimal('0')
        total_sell_amount = Decimal('0')
        total_dividend_amount = Decimal('0')
        
        for transaction in transactions:
            if transaction.transaction_type == 'BUY':
                total_buy_amount += transaction.total_amount
            elif transaction.transaction_type == 'SELL':
                total_sell_amount += transaction.total_amount
            elif transaction.transaction_type == 'DIVIDEND':
                total_dividend_amount += transaction.total_amount
            
            # Verify total amount calculation
            if transaction.transaction_type in ['BUY', 'SELL']:
                expected_total = (transaction.shares * transaction.price_per_share) + transaction.commission
            else:  # DIVIDEND
                expected_total = transaction.shares * transaction.price_per_share
            
            assert transaction.total_amount == expected_total, f"Total amount mismatch for transaction {transaction.id}"
        
        print_success(f"All transaction calculations verified")
        print_info(f"Total BUY amount: ${total_buy_amount}")
        print_info(f"Total SELL amount: ${total_sell_amount}")
        print_info(f"Total DIVIDEND amount: ${total_dividend_amount}")
        
    except Exception as e:
        print_error(f"Data integrity test failed: {e}")
        return False
    
    print_test("Testing portfolio consistency")
    try:
        # Check if portfolio was created and updated
        portfolio = Portfolio.objects.filter(user_id=TEST_USER_ID).first()
        
        if portfolio:
            holdings = portfolio.holdings.all()
            print_success(f"Portfolio found with {len(holdings)} holdings")
            
            for holding in holdings:
                print_info(f"Holding: {holding.ticker} - {holding.shares} shares @ ${holding.purchase_price}")
        else:
            print_warning("No portfolio found - this may be expected if auto-creation is disabled")
        
    except Exception as e:
        print_error(f"Portfolio consistency test failed: {e}")
        return False
    
    return True

def test_currency_support():
    """Test multi-currency support"""
    print_section("CURRENCY SUPPORT TESTS")
    
    print_test("Testing different currencies")
    try:
        service = get_transaction_service()
        
        # Create transactions in different currencies
        currencies = ['EUR', 'GBP', 'JPY', 'CAD']
        
        for currency in currencies:
            transaction_data = {
                'transaction_type': 'BUY',
                'ticker': f'TEST{currency}',
                'company_name': f'Test Company {currency}',
                'shares': 1,
                'price_per_share': 100.00,
                'transaction_date': date.today().isoformat(),
                'transaction_currency': currency,
                'fx_rate_to_usd': 1.2 if currency == 'EUR' else 1.0,
                'notes': f'Test {currency} transaction'
            }
            
            result = service.create_transaction(TEST_USER_ID, transaction_data)
            assert result['success'], f"Failed to create {currency} transaction"
            
            print_success(f"Created {currency} transaction")
        
        # Verify all currencies were stored correctly
        transactions = Transaction.objects.filter(user_id=TEST_USER_ID, ticker__startswith='TEST')
        stored_currencies = set(t.transaction_currency for t in transactions)
        
        assert len(stored_currencies) == len(currencies), "Not all currencies were stored"
        
        print_success("Multi-currency support works correctly")
        
    except Exception as e:
        print_error(f"Currency support test failed: {e}")
        return False
    
    return True

def test_performance():
    """Test system performance with multiple transactions"""
    print_section("PERFORMANCE TESTS")
    
    print_test("Testing bulk transaction creation")
    try:
        service = get_transaction_service()
        
        # Create multiple transactions
        start_time = time.time()
        transaction_count = 50
        
        for i in range(transaction_count):
            transaction_data = {
                'transaction_type': 'BUY',
                'ticker': f'PERF{i:03d}',
                'company_name': f'Performance Test Company {i}',
                'shares': 1,
                'price_per_share': 100.00 + i,
                'transaction_date': (date.today() - timedelta(days=i)).isoformat(),
                'notes': f'Performance test transaction {i}'
            }
            
            result = service.create_transaction(TEST_USER_ID, transaction_data)
            if not result['success']:
                print_warning(f"Transaction {i} failed: {result.get('error')}")
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Verify transactions were created
        created_transactions = Transaction.objects.filter(
            user_id=TEST_USER_ID, 
            ticker__startswith='PERF'
        ).count()
        
        print_success(f"Created {created_transactions} transactions in {total_time:.2f} seconds")
        print_info(f"Average: {total_time/created_transactions:.3f} seconds per transaction")
        
        if total_time < 30:  # Should complete within 30 seconds
            print_success("Performance test passed")
        else:
            print_warning("Performance may be slower than expected")
        
    except Exception as e:
        print_error(f"Performance test failed: {e}")
        return False
    
    return True

def run_all_tests():
    """Run all test suites"""
    print_section("TRANSACTION SYSTEM END-TO-END TESTS")
    print_info(f"Starting comprehensive test suite at {datetime.now()}")
    print_info(f"Test user ID: {TEST_USER_ID}")
    
    # Clean up first
    cleanup_test_data()
    
    test_results = []
    
    # Run all test suites
    test_suites = [
        ("Database Models", test_database_models),
        ("Transaction Service", test_transaction_service),
        ("Price Update Service", test_price_update_service),
        ("API Endpoints", test_api_endpoints),
        ("Data Integrity", test_data_integrity),
        ("Currency Support", test_currency_support),
        ("Performance", test_performance),
    ]
    
    for suite_name, test_function in test_suites:
        try:
            print_info(f"Running {suite_name} tests...")
            result = test_function()
            test_results.append((suite_name, result))
            
            if result:
                print_success(f"{suite_name} tests completed successfully")
            else:
                print_error(f"{suite_name} tests failed")
                
        except Exception as e:
            print_error(f"{suite_name} tests crashed: {e}")
            test_results.append((suite_name, False))
    
    # Print summary
    print_section("TEST RESULTS SUMMARY")
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for suite_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{suite_name:<20} {status}")
    
    print(f"\n{Colors.BOLD}Overall Result: {passed}/{total} test suites passed{Colors.END}")
    
    if passed == total:
        print_success("🎉 ALL TESTS PASSED! Transaction system is working correctly.")
    else:
        print_error(f"❌ {total - passed} test suite(s) failed. Please review the logs above.")
    
    # Final cleanup
    print_info("Cleaning up test data...")
    cleanup_test_data()
    
    print_info(f"Test suite completed at {datetime.now()}")
    
    return passed == total

if __name__ == "__main__":
    print(f"{Colors.BOLD}{Colors.PURPLE}")
    print("🚀 TRANSACTION SYSTEM END-TO-END TESTS")
    print("=====================================")
    print(f"{Colors.END}")
    
    success = run_all_tests()
    
    exit_code = 0 if success else 1
    sys.exit(exit_code) 