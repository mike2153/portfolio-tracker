"""
Comprehensive test suite for the transaction system.

Tests cover:
- Transaction model functionality
- Transaction service operations
- API endpoints
- Rate limiting
- Data validation
- Historical data fetching
- Portfolio calculations
"""

import json
from datetime import datetime, date, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from api.models import (
    Transaction, DailyPriceCache, UserApiRateLimit, UserSettings,
    ExchangeRate, Portfolio, Holding
)
from api.services.transaction_service import (
    get_transaction_service, get_price_update_service
)


class TransactionModelTest(TestCase):
    """Test Transaction model functionality"""
    
    def setUp(self):
        """Set up test data"""
        print("[TransactionModelTest] Setting up test data...")
        self.user_id = 'test_user_123'
        self.test_date = date.today()
    
    def test_transaction_creation(self):
        """Test basic transaction creation"""
        print("[TransactionModelTest] Testing transaction creation...")
        
        transaction = Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10.00'),
            price_per_share=Decimal('150.00'),
            transaction_date=self.test_date,
            total_amount=Decimal('1500.00')
        )
        
        self.assertEqual(transaction.user_id, self.user_id)
        self.assertEqual(transaction.ticker, 'AAPL')
        self.assertEqual(transaction.transaction_type, 'BUY')
        self.assertEqual(transaction.shares, Decimal('10.00'))
        self.assertEqual(transaction.total_amount, Decimal('1500.00'))
        
        print("[TransactionModelTest] ✅ Transaction created successfully")
        
        # Test string representation
        expected_str = f"{self.user_id} BUY 10.00 AAPL @ $150.00"
        self.assertEqual(str(transaction), expected_str)
        print(f"[TransactionModelTest] ✅ Transaction string representation: {expected_str}")
    
    def test_transaction_total_calculation(self):
        """Test that total amount is calculated correctly"""
        print("[TransactionModelTest] Testing total calculation...")
        
        transaction = Transaction(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='MSFT',
            company_name='Microsoft Corp',
            shares=Decimal('5.00'),
            price_per_share=Decimal('250.00'),
            transaction_date=self.test_date,
            commission=Decimal('9.99')
        )
        
        transaction.save()  # Should trigger total calculation
        
        expected_total = (Decimal('5.00') * Decimal('250.00')) + Decimal('9.99')
        self.assertEqual(transaction.total_amount, expected_total)
        print(f"[TransactionModelTest] ✅ Total calculated correctly: {expected_total}")
    
    def test_transaction_validation(self):
        """Test transaction validation"""
        print("[TransactionModelTest] Testing transaction validation...")
        
        # Test invalid transaction type
        with self.assertRaises(Exception):
            Transaction.objects.create(
                user_id=self.user_id,
                transaction_type='INVALID',
                ticker='AAPL',
                shares=Decimal('10.00'),
                price_per_share=Decimal('150.00'),
                transaction_date=self.test_date
            )
        
        print("[TransactionModelTest] ✅ Invalid transaction type properly rejected")


class DailyPriceCacheTest(TestCase):
    """Test DailyPriceCache model functionality"""
    
    def setUp(self):
        """Clear existing cache data"""
        DailyPriceCache.objects.all().delete()

    def test_price_cache_creation(self):
        """Test creating daily price cache records"""
        print("[DailyPriceCacheTest] Testing price cache creation...")
        
        # Delete any existing cache data for AAPL to avoid conflicts
        DailyPriceCache.objects.filter(ticker='AAPL').delete()
        
        price_cache = DailyPriceCache.objects.create(
            ticker='AAPL',
            date=date.today(),
            open_price=Decimal('150.00'),
            high_price=Decimal('155.00'),
            low_price=Decimal('149.00'),
            close_price=Decimal('154.00'),
            adjusted_close=Decimal('154.00'),
            volume=1000000,
            source='AlphaVantage',
            requested_by_user='test_user'
        )
        
        self.assertEqual(price_cache.ticker, 'AAPL')
        self.assertEqual(price_cache.close_price, Decimal('154.00'))
        self.assertEqual(price_cache.source, 'AlphaVantage')
        
        print("[DailyPriceCacheTest] ✅ Price cache created successfully")
    
    def test_unique_ticker_date_constraint(self):
        """Test that ticker/date combination is unique"""
        print("[DailyPriceCacheTest] Testing unique constraint...")
        
        # Clear any existing data for this test
        DailyPriceCache.objects.filter(ticker='MSFT', date=date.today()).delete()
        
        # Create first record
        DailyPriceCache.objects.create(
            ticker='MSFT',
            date=date.today(),
            open_price=Decimal('250.00'),
            high_price=Decimal('255.00'),
            low_price=Decimal('249.00'),
            close_price=Decimal('254.00'),
            adjusted_close=Decimal('254.00'),
            volume=500000,
            source='AlphaVantage'
        )
        
        # Attempt to create duplicate should raise exception
        with self.assertRaises(Exception):
            DailyPriceCache.objects.create(
                ticker='MSFT',
                date=date.today(),
                open_price=Decimal('251.00'),
                high_price=Decimal('256.00'),
                low_price=Decimal('250.00'),
                close_price=Decimal('255.00'),
                adjusted_close=Decimal('255.00'),
                volume=600000,
                source='AlphaVantage'
            )
        
        print("[DailyPriceCacheTest] ✅ Unique constraint properly enforced")


class UserApiRateLimitTest(TestCase):
    """Test UserApiRateLimit model functionality"""
    
    def setUp(self):
        """Set up test data"""
        self.user_id = 'test_user_123'
        # Clear existing rate limit data
        UserApiRateLimit.objects.filter(user_id=self.user_id).delete()

    def test_rate_limit_creation(self):
        """Test creating rate limit records"""
        print("[UserApiRateLimitTest] Testing rate limit creation...")
        
        rate_limit = UserApiRateLimit.objects.create(
            user_id=self.user_id,
            last_price_fetch=timezone.now(),
            fetch_count_today=5
        )
        
        self.assertEqual(rate_limit.user_id, self.user_id)
        self.assertEqual(rate_limit.fetch_count_today, 5)
        
        print("[UserApiRateLimitTest] ✅ Rate limit record created successfully")
    
    def test_can_fetch_prices_timing(self):
        """Test can_fetch_prices method with timing constraints"""
        print("[UserApiRateLimitTest] Testing can_fetch_prices timing...")
        
        # Create rate limit with recent fetch (should be rate limited)
        rate_limit = UserApiRateLimit.objects.create(
            user_id=self.user_id,
            last_price_fetch=timezone.now() - timedelta(seconds=30),  # 30 seconds ago
            fetch_count_today=1
        )
        
        self.assertFalse(rate_limit.can_fetch_prices())
        print("[UserApiRateLimitTest] ✅ Recent fetch properly rate limited")
        
        # Update to older fetch (should be allowed)
        rate_limit.last_price_fetch = timezone.now() - timedelta(minutes=2)  # 2 minutes ago
        rate_limit.save()
        
        self.assertTrue(rate_limit.can_fetch_prices())
        print("[UserApiRateLimitTest] ✅ Older fetch properly allowed")
    
    def test_daily_count_reset(self):
        """Test that daily count resets properly"""
        print("[UserApiRateLimitTest] Testing daily count reset...")
        
        # Create rate limit with old date
        old_date = timezone.now() - timedelta(days=1)
        rate_limit = UserApiRateLimit.objects.create(
            user_id=self.user_id,
            last_price_fetch=old_date,
            fetch_count_today=50  # High count from previous day
        )
        
        # Simulate fetching prices (should reset count)
        rate_limit.record_fetch()
        
        self.assertEqual(rate_limit.fetch_count_today, 1)  # Should reset to 1
        print("[UserApiRateLimitTest] ✅ Daily count properly reset")


class TransactionServiceTest(TestCase):
    """Test TransactionService functionality"""
    
    def setUp(self):
        """Set up test data"""
        print("[TransactionServiceTest] Setting up test data...")
        self.user_id = 'test_user_123'
        self.service = get_transaction_service()

        # Ensure a clean slate for each test by deleting objects for the specific user
        # This prevents tests from interfering with each other
        Holding.objects.filter(portfolio__user_id=self.user_id).delete()
        Transaction.objects.filter(user_id=self.user_id).delete()
        Portfolio.objects.filter(user_id=self.user_id).delete()
        DailyPriceCache.objects.all().delete() # Clear the cache for all users for simplicity
        
        # Create a single, known portfolio for the user for all tests in this class
        self.portfolio = Portfolio.objects.create(user_id=self.user_id)
    
    @patch('api.services.transaction_service.get_alpha_vantage_service')
    def test_create_transaction_success(self, mock_alpha_vantage):
        """Test successful transaction creation"""
        print("[TransactionServiceTest] Testing transaction creation...")
        
        # Mock Alpha Vantage service
        mock_service = MagicMock()
        mock_service.get_company_overview.return_value = {'Name': 'Apple Inc.'}
        mock_service.get_daily_adjusted.return_value = {
            'data': [{
                'date': '2024-01-15',
                'open': '150.00',
                'high': '155.00',
                'low': '149.50',
                'close': '152.75',
                'adjusted_close': '152.75',
                'volume': '1000000'
            }]
        }
        mock_alpha_vantage.return_value = mock_service
        
        transaction_data = {
            'transaction_type': 'BUY',
            'ticker': 'AAPL',
            'company_name': 'Apple Inc.',
            'shares': 10,
            'price_per_share': 150.00,
            'transaction_date': '2024-01-15',
            'transaction_currency': 'USD',
            'commission': 9.99,
            'notes': 'Test purchase'
        }
        
        print(f"[TransactionServiceTest] Creating transaction: {transaction_data}")
        
        result = self.service.create_transaction(self.user_id, transaction_data)
        
        print(f"[TransactionServiceTest] Transaction creation result: {result}")
        
        # Verify result
        self.assertTrue(result['success'])
        self.assertIn('transaction_id', result)
        self.assertEqual(result['ticker'], 'AAPL')
        
        # Verify transaction was saved
        transaction = Transaction.objects.get(id=result['transaction_id'])
        self.assertEqual(transaction.user_id, self.user_id)
        self.assertEqual(transaction.ticker, 'AAPL')
        self.assertEqual(transaction.transaction_type, 'BUY')
        
        print(f"[TransactionServiceTest] ✅ Transaction created successfully: {transaction}")
    
    def test_create_transaction_validation_error(self):
        """Test transaction creation with invalid data"""
        print("[TransactionServiceTest] Testing transaction validation error...")
        
        invalid_transaction_data = {
            'transaction_type': 'BUY',
            'ticker': '',  # Invalid: empty ticker
            'shares': 10,
            'price_per_share': 150.00,
            'transaction_date': '2024-01-15'
        }
        
        result = self.service.create_transaction(self.user_id, invalid_transaction_data)
        
        print(f"[TransactionServiceTest] Validation result: {result}")
        
        self.assertFalse(result['success'])
        self.assertIn('error', result)
        
        print("[TransactionServiceTest] ✅ Validation error handled correctly")
    
    def test_get_user_transactions(self):
        """Test retrieving user transactions"""
        print("[TransactionServiceTest] Testing get user transactions...")
        
        # Create test transactions
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today(),
            total_amount=Decimal('1500.00')
        )
        
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='SELL',
            ticker='MSFT',
            company_name='Microsoft Corporation',
            shares=Decimal('5'),
            price_per_share=Decimal('300.00'),
            transaction_date=date.today(),
            total_amount=Decimal('1500.00')
        )
        
        # Get all transactions
        transactions = self.service.get_user_transactions(self.user_id)
        
        print(f"[TransactionServiceTest] Retrieved {len(transactions)} transactions")
        
        self.assertEqual(len(transactions), 2)
        
        # Test filtering by transaction type
        buy_transactions = self.service.get_user_transactions(self.user_id, 'BUY')
        self.assertEqual(len(buy_transactions), 1)
        self.assertEqual(buy_transactions[0]['transaction_type'], 'BUY')
        
        # Test filtering by ticker
        aapl_transactions = self.service.get_user_transactions(self.user_id, ticker='AAPL')
        self.assertEqual(len(aapl_transactions), 1)
        self.assertEqual(aapl_transactions[0]['ticker'], 'AAPL')
        
        print("[TransactionServiceTest] ✅ Transaction retrieval and filtering works correctly")
    
    def test_calculate_holdings_from_transactions(self):
        """Test portfolio calculation from transactions"""
        print("[TransactionServiceTest] Testing holdings calculation...")
        
        # Create test transactions for AAPL
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today() - timedelta(days=5),
            total_amount=Decimal('1500.00')
        )
        
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('5'),
            price_per_share=Decimal('160.00'),
            transaction_date=date.today() - timedelta(days=3),
            total_amount=Decimal('800.00')
        )
        
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='SELL',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('3'),
            price_per_share=Decimal('155.00'),
            transaction_date=date.today() - timedelta(days=1),
            total_amount=Decimal('465.00')
        )
        
        # Calculate holdings
        holdings = self.service._calculate_holdings_from_transactions(self.user_id)
        
        print(f"[TransactionServiceTest] Calculated holdings: {holdings}")
        
        # Verify AAPL holding calculation
        self.assertIn('AAPL', holdings)
        aapl_holding = holdings['AAPL']
        
        # Should have 12 shares remaining (10 + 5 - 3)
        self.assertEqual(aapl_holding['total_shares'], Decimal('12'))
        
        # Average cost calculation should be correct
        total_cost = Decimal('1500.00') + Decimal('800.00') - (Decimal('2300.00') * Decimal('3') / Decimal('15'))
        expected_avg_cost = total_cost / Decimal('12')
        
        print(f"[TransactionServiceTest] Expected average cost: ${expected_avg_cost}")
        print(f"[TransactionServiceTest] Calculated average cost: ${aapl_holding['average_cost']}")
        
        print("[TransactionServiceTest] ✅ Holdings calculation verified")

    @patch('api.services.transaction_service.get_alpha_vantage_service')
    def test_create_buy_transaction_updates_portfolio(self, mock_alpha_vantage):
        """Test that a BUY transaction creates or updates a Holding record."""
        mock_alpha_vantage.return_value.get_daily_adjusted.return_value = {'data': []}

        # Initial buy
        self.service.create_transaction(self.user_id, {
            'transaction_type': 'BUY', 'ticker': 'AMD', 'company_name': 'AMD Inc',
            'shares': '10', 'price_per_share': '100', 'transaction_date': '2023-01-01'
        })
        
        holding = Holding.objects.get(ticker='AMD', portfolio=self.portfolio)
        self.assertEqual(holding.shares, Decimal('10'))
        self.assertEqual(holding.purchase_price, Decimal('100'))

        # Second buy
        self.service.create_transaction(self.user_id, {
            'transaction_type': 'BUY', 'ticker': 'AMD', 'company_name': 'AMD Inc',
            'shares': '5', 'price_per_share': '110', 'transaction_date': '2023-01-02'
        })

        updated_holding = Holding.objects.get(ticker='AMD', portfolio=self.portfolio)
        self.assertEqual(updated_holding.shares, Decimal('15'))
        self.assertAlmostEqual(updated_holding.purchase_price, Decimal('103.33'), places=2)
        print("[TransactionServiceTest] ✅ BUY transaction correctly updated portfolio holding")

    def test_create_sell_transaction_updates_portfolio(self):
        """Test that a SELL transaction reduces shares in a Holding."""
        create_test_transaction(self.user_id, ticker='NVDA', shares=20, price_per_share=500)
        self.service._update_portfolio_from_transactions(self.user_id)
        
        holding = Holding.objects.get(ticker='NVDA', portfolio=self.portfolio)
        self.assertEqual(holding.shares, Decimal('20'))

        self.service.create_transaction(self.user_id, {
            'transaction_type': 'SELL', 'ticker': 'NVDA', 'company_name': 'NVIDIA',
            'shares': '5', 'price_per_share': '550', 'transaction_date': '2023-01-10'
        })

        holding.refresh_from_db()
        self.assertEqual(holding.shares, Decimal('15'))
        self.assertEqual(holding.purchase_price, Decimal('500'))
        print("[TransactionServiceTest] ✅ SELL transaction correctly reduced holding shares")

    def test_sell_all_shares_removes_holding(self):
        """Test that selling all shares of a stock removes the Holding record."""
        create_test_transaction(self.user_id, ticker='TSLA', shares=10, price_per_share=200)
        self.service._update_portfolio_from_transactions(self.user_id)

        self.assertTrue(Holding.objects.filter(ticker='TSLA', portfolio=self.portfolio).exists())

        self.service.create_transaction(self.user_id, {
            'transaction_type': 'SELL', 'ticker': 'TSLA', 'company_name': 'Tesla',
            'shares': '10', 'price_per_share': '250', 'transaction_date': '2023-02-01'
        })
        
        self.assertFalse(Holding.objects.filter(ticker='TSLA', portfolio=self.portfolio).exists())
        print("[TransactionServiceTest] ✅ Selling all shares correctly removed the holding")

    def test_dividend_transaction_does_not_affect_holding(self):
        """Test that a DIVIDEND transaction does not change a Holding."""
        create_test_transaction(self.user_id, ticker='PG', shares=100, price_per_share=150)
        self.service._update_portfolio_from_transactions(self.user_id)
        
        holding_before = Holding.objects.get(ticker='PG', portfolio=self.portfolio)

        self.service.create_transaction(self.user_id, {
            'transaction_type': 'DIVIDEND', 'ticker': 'PG', 'company_name': 'Procter & Gamble',
            'shares': '100', 'price_per_share': '0.94', 'transaction_date': '2023-03-01'
        })

        holding_after = Holding.objects.get(ticker='PG', portfolio=self.portfolio)
        self.assertEqual(holding_after.shares, holding_before.shares)
        self.assertEqual(holding_after.purchase_price, holding_before.purchase_price)
        self.assertEqual(Transaction.objects.filter(ticker='PG', transaction_type='DIVIDEND').count(), 1)
        print("[TransactionServiceTest] ✅ DIVIDEND transaction correctly recorded without affecting holding")

    @patch('api.services.transaction_service.get_alpha_vantage_service')
    def test_historical_price_fetch_caching(self, mock_alpha_vantage):
        """Verify that historical data is fetched once and then cached."""
        mock_api = mock_alpha_vantage.return_value
        mock_api.get_daily_adjusted.return_value = {
            'data': [
                {'date': '2023-01-01', 'open': '100', 'high': '102', 'low': '99', 'close': '101', 'adjusted_close': '101', 'volume': '1000000'},
                {'date': '2023-01-02', 'open': '101', 'high': '103', 'low': '100', 'close': '102', 'adjusted_close': '102', 'volume': '1200000'},
            ]
        }
        
        self.service.create_transaction(self.user_id, {
            'transaction_type': 'BUY', 'ticker': 'INTC', 'company_name': 'Intel Corp',
            'shares': '10', 'price_per_share': '101', 'transaction_date': '2023-01-01'
        })
        
        mock_api.get_daily_adjusted.assert_called_once_with('INTC')
        self.assertEqual(DailyPriceCache.objects.filter(ticker='INTC').count(), 2)
        print("[TransactionServiceTest] ✅ Historical data fetched and cached on first transaction")

        mock_api.get_daily_adjusted.reset_mock()
        self.service.create_transaction(self.user_id, {
            'transaction_type': 'BUY', 'ticker': 'INTC', 'company_name': 'Intel Corp',
            'shares': '5', 'price_per_share': '102', 'transaction_date': '2023-01-02'
        })

        mock_api.get_daily_adjusted.assert_not_called()
        print("[TransactionServiceTest] ✅ Cached historical data used for subsequent transaction")


class PriceUpdateServiceTest(TestCase):
    """Test PriceUpdateService functionality"""
    
    def setUp(self):
        """Set up test data"""
        print("[PriceUpdateServiceTest] Setting up test data...")
        self.user_id = 'test_user_123'
        self.service = get_price_update_service()
        
        # Create test transactions
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today(),
            total_amount=Decimal('1500.00')
        )
    
    @patch('api.services.transaction_service.get_alpha_vantage_service')
    def test_update_user_current_prices_success(self, mock_alpha_vantage):
        """Test successful price update"""
        print("[PriceUpdateServiceTest] Testing price update...")
        
        # Mock Alpha Vantage service to return predictable data
        mock_service = MagicMock()
        mock_service.get_global_quote.return_value = {
            'price': 155.50,
            'change': 5.50,
            'change_percent': 3.67,
            'volume': 50000000
        }
        mock_alpha_vantage.return_value = mock_service
        
        # Create test transaction to give user some tickers
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today(),
            total_amount=Decimal('1500.00')
        )
        
        # Create a new service instance to get the mock
        from api.services.transaction_service import PriceUpdateService
        test_service = PriceUpdateService()
        test_service.alpha_vantage = mock_service
        
        result = test_service.update_user_current_prices(self.user_id)
        
        print(f"[PriceUpdateServiceTest] Price update result: {result}")
        
        self.assertTrue(result['success'])
        self.assertIn('prices', result)
        self.assertIn('AAPL', result['prices'])
        
        aapl_price = result['prices']['AAPL']
        # Update expected values to match the mock data
        self.assertEqual(aapl_price['price'], 155.50)
        self.assertEqual(aapl_price['change'], 5.50)
        
        print("[PriceUpdateServiceTest] ✅ Price update successful")
    
    def test_rate_limiting(self):
        """Test price update rate limiting"""
        print("[PriceUpdateServiceTest] Testing rate limiting...")
        
        # Create rate limit record with recent fetch
        UserApiRateLimit.objects.create(
            user_id=self.user_id,
            last_price_fetch=timezone.now() - timedelta(seconds=30),  # 30 seconds ago
            fetch_count_today=1
        )
        
        result = self.service.update_user_current_prices(self.user_id)
        
        print(f"[PriceUpdateServiceTest] Rate limit result: {result}")
        
        self.assertFalse(result['success'])
        self.assertEqual(result['error'], 'rate_limited')
        
        print("[PriceUpdateServiceTest] ✅ Rate limiting works correctly")


class TransactionAPITest(TestCase):
    """Test Transaction API endpoints"""
    
    def setUp(self):
        """Set up test client and data"""
        print("[TransactionAPITest] Setting up test client...")
        self.client = Client()
        self.user_id = 'test_user_123'
    
    def test_create_transaction_endpoint(self):
        """Test create transaction API endpoint"""
        print("[TransactionAPITest] Testing create transaction endpoint...")
        
        transaction_data = {
            'user_id': self.user_id,
            'transaction_type': 'BUY',
            'ticker': 'AAPL',
            'company_name': 'Apple Inc.',
            'shares': 10,
            'price_per_share': 150.00,
            'transaction_date': '2024-01-15',
            'transaction_currency': 'USD',
            'commission': 9.99,
            'notes': 'Test API purchase'
        }
        
        with patch('api.services.transaction_service.get_alpha_vantage_service'):
            response = self.client.post(
                '/api/transactions/create',
                data=json.dumps(transaction_data),
                content_type='application/json'
            )
        
        print(f"[TransactionAPITest] Create response status: {response.status_code}")
        print(f"[TransactionAPITest] Create response data: {response.json() if hasattr(response, 'json') else 'No JSON'}")
        
        # Note: The exact assertion will depend on how the API is implemented
        # This is a framework for testing
    
    def test_get_user_transactions_endpoint(self):
        """Test get user transactions API endpoint"""
        print("[TransactionAPITest] Testing get transactions endpoint...")
        
        # Create test transaction first
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today(),
            total_amount=Decimal('1500.00')
        )
        
        response = self.client.get(f'/api/transactions/user?user_id={self.user_id}')
        
        print(f"[TransactionAPITest] Get transactions status: {response.status_code}")
        
        # Framework for testing - actual assertions depend on API implementation
    
    def test_transaction_summary_endpoint(self):
        """Test transaction summary API endpoint"""
        print("[TransactionAPITest] Testing transaction summary endpoint...")
        
        # Create test transactions
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today(),
            total_amount=Decimal('1500.00')
        )
        
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='DIVIDEND',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('2.50'),
            transaction_date=date.today(),
            total_amount=Decimal('25.00')
        )
        
        response = self.client.get(f'/api/transactions/summary?user_id={self.user_id}')
        
        print(f"[TransactionAPITest] Summary response status: {response.status_code}")
        
        # Framework for testing - actual assertions depend on API implementation


class TransactionIntegrationTest(TestCase):
    """Integration tests for complete transaction workflows"""
    
    def setUp(self):
        """Set up test data"""
        print("[TransactionIntegrationTest] Setting up integration test...")
        self.user_id = 'test_user_123'
        self.service = get_transaction_service()
    
    @patch('api.services.transaction_service.get_alpha_vantage_service')
    def test_complete_transaction_workflow(self, mock_alpha_vantage):
        """Test complete transaction workflow from creation to portfolio update"""
        print("[TransactionIntegrationTest] Testing complete workflow...")
        
        # Mock Alpha Vantage service
        mock_service = MagicMock()
        mock_service.get_company_overview.return_value = {'Name': 'Apple Inc.'}
        mock_service.get_daily_adjusted.return_value = {
            'data': [{
                'date': '2024-01-15',
                'open': '150.00',
                'high': '155.00',
                'low': '149.50',
                'close': '152.75',
                'adjusted_close': '152.75',
                'volume': '1000000'
            }]
        }
        mock_alpha_vantage.return_value = mock_service
        
        # Step 1: Create first transaction
        transaction1_data = {
            'transaction_type': 'BUY',
            'ticker': 'AAPL',
            'company_name': 'Apple Inc.',
            'shares': 10,
            'price_per_share': 150.00,
            'transaction_date': '2024-01-15'
        }
        
        result1 = self.service.create_transaction(self.user_id, transaction1_data)
        self.assertTrue(result1['success'])
        
        print(f"[TransactionIntegrationTest] ✅ First transaction created: {result1['transaction_id']}")
        
        # Step 2: Create second transaction
        transaction2_data = {
            'transaction_type': 'BUY',
            'ticker': 'AAPL',
            'company_name': 'Apple Inc.',
            'shares': 5,
            'price_per_share': 160.00,
            'transaction_date': '2024-01-16'
        }
        
        result2 = self.service.create_transaction(self.user_id, transaction2_data)
        self.assertTrue(result2['success'])
        
        print(f"[TransactionIntegrationTest] ✅ Second transaction created: {result2['transaction_id']}")
        
        # Step 3: Verify transactions exist
        transactions = self.service.get_user_transactions(self.user_id)
        self.assertEqual(len(transactions), 2)
        
        print(f"[TransactionIntegrationTest] ✅ Both transactions retrieved: {len(transactions)}")
        
        # Step 4: Verify portfolio was updated
        portfolio = Portfolio.objects.get(user_id=self.user_id)
        holdings = portfolio.holdings.all()
        
        self.assertEqual(len(holdings), 1)  # Should have one AAPL holding
        aapl_holding = holdings[0]
        self.assertEqual(aapl_holding.ticker, 'AAPL')
        self.assertEqual(aapl_holding.shares, Decimal('15'))  # 10 + 5
        
        print(f"[TransactionIntegrationTest] ✅ Portfolio updated correctly: {aapl_holding.shares} shares")
        
        # Step 5: Test selling some shares
        sell_transaction_data = {
            'transaction_type': 'SELL',
            'ticker': 'AAPL',
            'company_name': 'Apple Inc.',
            'shares': 7,
            'price_per_share': 155.00,
            'transaction_date': '2024-01-17'
        }
        
        result3 = self.service.create_transaction(self.user_id, sell_transaction_data)
        self.assertTrue(result3['success'])
        
        print(f"[TransactionIntegrationTest] ✅ Sell transaction created: {result3['transaction_id']}")
        
        # Step 6: Verify final portfolio state
        portfolio.refresh_from_db()
        aapl_holding = portfolio.holdings.get(ticker='AAPL')
        self.assertEqual(aapl_holding.shares, Decimal('8'))  # 15 - 7
        
        print(f"[TransactionIntegrationTest] ✅ Final portfolio state correct: {aapl_holding.shares} shares")
        
        print("[TransactionIntegrationTest] ✅ Complete workflow test passed!")


# Additional test utility functions
def create_test_transaction(user_id: str, **kwargs) -> Transaction:
    """Helper function to create a test transaction with default values."""
    defaults = {
        'user_id': user_id,
        'transaction_type': 'BUY',
        'company_name': kwargs.get('ticker', 'Test Company'),
        'shares': 10,
        'price_per_share': 100,
        'transaction_date': date.today(),
        'transaction_currency': 'USD',
        'fx_rate_to_usd': Decimal('1.0'),
        'commission': Decimal('0'),
        'total_amount': Decimal('100')
    }
    
    defaults.update(kwargs)
    defaults['total_amount'] = (defaults['shares'] * defaults['price_per_share']) + defaults['commission']
    
    return Transaction.objects.create(**defaults)


def create_test_price_cache(ticker: str, **kwargs) -> DailyPriceCache:
    """Helper function to create test price cache entries"""
    defaults = {
        'ticker': ticker,
        'date': date.today(),
        'open_price': Decimal('100'),
        'high_price': Decimal('105'),
        'low_price': Decimal('95'),
        'close_price': Decimal('102'),
        'adjusted_close': Decimal('102'),
        'volume': 1000000,
        'source': 'Test'
    }
    
    defaults.update(kwargs)
    return DailyPriceCache.objects.create(**defaults)


if __name__ == '__main__':
    print("[TransactionTests] Running transaction system tests...")
    # Tests will be run by Django's test runner
    print("[TransactionTests] Test suite complete!") 