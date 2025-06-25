from unittest.mock import patch, MagicMock
from django.test import TestCase
from ninja.testing import TestClient
from datetime import date, timedelta
from decimal import Decimal
from ..api import api
from ..models import Portfolio, Holding, Transaction
from django.test import Client
from ..services.portfolio_benchmarking import (
    _parse_period_to_dates, 
    _calculate_cagr, 
    calculate_enhanced_portfolio_performance,
    SUPPORTED_BENCHMARKS,
    PortfolioBenchmarkingService
)
import pytest

class PeriodParsingTest(TestCase):
    def test_parse_1m_period(self):
        """Test parsing of 1M period."""
        start_date, days = _parse_period_to_dates('1M')
        expected_start = date.today() - timedelta(days=30)
        self.assertEqual(start_date, expected_start)
        self.assertEqual(days, 30)
    
    def test_parse_ytd_period(self):
        """Test parsing of YTD period."""
        start_date, days = _parse_period_to_dates('YTD')
        expected_start = date(date.today().year, 1, 1)
        expected_days = (date.today() - expected_start).days
        self.assertEqual(start_date, expected_start)
        self.assertEqual(days, expected_days)
    
    def test_parse_5y_period(self):
        """Test parsing of 5Y period."""
        start_date, days = _parse_period_to_dates('5Y')
        expected_start = date.today() - timedelta(days=365*5)
        self.assertEqual(start_date, expected_start)
        self.assertEqual(days, 365*5)
    
    def test_parse_invalid_period_defaults_to_1y(self):
        """Test that invalid period defaults to 1Y."""
        start_date, days = _parse_period_to_dates('INVALID')
        expected_start = date.today() - timedelta(days=365)
        self.assertEqual(start_date, expected_start)
        self.assertEqual(days, 365)

class CAGRCalculationTest(TestCase):
    def test_calculate_cagr_positive_growth(self):
        """Test CAGR calculation with positive growth."""
        cagr = _calculate_cagr(100, 121, 2)
        self.assertIsNotNone(cagr)
        assert cagr is not None  # Hint for the type checker
        self.assertAlmostEqual(cagr, 0.1, places=4)
    
    def test_calculate_cagr_negative_growth(self):
        """Test CAGR calculation with negative growth."""
        cagr = _calculate_cagr(100, 81, 2)
        self.assertIsNotNone(cagr)
        assert cagr is not None  # Hint for the type checker
        self.assertAlmostEqual(cagr, -0.1, places=4)
    
    def test_calculate_cagr_zero_start_value(self):
        """Test CAGR calculation with zero start value returns None."""
        cagr = _calculate_cagr(0, 100, 2)
        self.assertIsNone(cagr)
    
    def test_calculate_cagr_zero_years(self):
        """Test CAGR calculation with zero years returns None."""
        cagr = _calculate_cagr(100, 121, 0)
        self.assertIsNone(cagr)

class PortfolioBenchmarkingServiceTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.user_id = "benchmark_test_user"
        # Clear existing data to avoid conflicts
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Benchmark Test Portfolio")
        self.service = PortfolioBenchmarkingService()
        
        # Create test holdings and transactions
        self.holding = Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal("10"),
            purchase_price=Decimal("150.00"),
            purchase_date=date.today() - timedelta(days=365)
        )
        
        # Create corresponding transaction
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today() - timedelta(days=365),
            total_amount=Decimal('1500.00')
        )

    def test_calculate_enhanced_portfolio_performance_success_real_api(self):
        """Test enhanced portfolio performance calculation with real Alpha Vantage API"""
        try:
            # Use a more reliable benchmark
            result = self.service.calculate_enhanced_portfolio_performance(
                user_id=self.user_id,
                benchmark_symbol='SPY',  # Use SPY instead of ^GSPC
                period='1y'
            )
            
            self.assertIsInstance(result, dict)
            self.assertIn('portfolio_return', result)
            self.assertIn('benchmark_return', result)
            self.assertIn('alpha', result)
            self.assertIn('beta', result)
            
            # Portfolio return should be a reasonable number
            if result['portfolio_return'] is not None:
                self.assertIsInstance(result['portfolio_return'], (int, float))
                self.assertGreater(result['portfolio_return'], -100)  # Not worse than -100%
                self.assertLess(result['portfolio_return'], 1000)     # Not better than 1000%
                
        except Exception as e:
            # If there's an API issue, we expect a ValueError with specific message
            if "Failed to retrieve market data" in str(e):
                self.assertIn("benchmark symbol", str(e))
            else:
                raise e

    def test_get_portfolio_holdings_with_prices_real_api(self):
        """Test getting portfolio holdings with current prices using real API"""
        holdings_with_prices = self.service.get_portfolio_holdings_with_prices(self.user_id)
        
        self.assertIsInstance(holdings_with_prices, list)
        self.assertGreater(len(holdings_with_prices), 0)
        
        # Check the structure of the first holding
        holding = holdings_with_prices[0]
        self.assertIn('ticker', holding)
        self.assertIn('shares', holding)
        self.assertIn('purchase_price', holding)
        self.assertIn('current_price', holding)
        
        self.assertEqual(holding['ticker'], 'AAPL')
        self.assertEqual(holding['shares'], Decimal('10'))

    def test_calculate_portfolio_value_real_api(self):
        """Test portfolio value calculation with real market prices"""
        portfolio_value = self.service.calculate_portfolio_value(self.user_id)
        
        self.assertIsInstance(portfolio_value, dict)
        self.assertIn('total_value', portfolio_value)
        self.assertIn('total_cost', portfolio_value)
        self.assertIn('total_gain_loss', portfolio_value)
        
        # Values should be reasonable
        self.assertGreater(portfolio_value['total_cost'], 0)
        if portfolio_value['total_value'] is not None:
            self.assertGreater(portfolio_value['total_value'], 0)

    def test_get_benchmark_performance_real_api(self):
        """Test benchmark performance retrieval with real API"""
        try:
            # Use SPY as a more reliable benchmark
            benchmark_performance = self.service.get_benchmark_performance('SPY', '1y')
            
            self.assertIsInstance(benchmark_performance, dict)
            self.assertIn('return', benchmark_performance)
            self.assertIn('volatility', benchmark_performance)
            
        except ValueError as e:
            # Expected for some benchmark symbols that might not be available
            self.assertIn("Failed to retrieve market data", str(e))

@pytest.mark.django_db
class PortfolioBenchmarkingEndpointTest:
    def setup_method(self):
        """Set up test data"""
        self.user_id = "endpoint_test_user"
        # Clear existing data to avoid conflicts
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Endpoint Test Portfolio")
        
        # Create test holding
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal("5"),
            purchase_price=Decimal("160.00"),
            purchase_date=date.today() - timedelta(days=180)
        )

    def test_portfolio_performance_endpoint_success(self, ninja_client):
        """Test portfolio performance endpoint with valid parameters"""
        response = ninja_client.get(f"/portfolio/{self.user_id}/performance?benchmark=SPY&period=6m")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'performance' in data
        assert 'portfolio_return' in data['performance']
        assert 'benchmark_return' in data['performance']

    def test_portfolio_performance_endpoint_invalid_benchmark(self, ninja_client):
        """Test portfolio performance endpoint with invalid benchmark"""
        response = ninja_client.get(f"/portfolio/{self.user_id}/performance?benchmark=INVALID&period=1y")
        
        # Should handle gracefully, likely return error or empty data
        assert response.status_code in [200, 400, 404]

    def test_portfolio_performance_endpoint_invalid_period(self, ninja_client):
        """Test portfolio performance endpoint with invalid period"""
        response = ninja_client.get(f"/portfolio/{self.user_id}/performance?benchmark=SPY&period=invalid")
        
        # Should handle gracefully
        assert response.status_code in [200, 400, 404]

    def test_portfolio_performance_endpoint_portfolio_not_found(self, ninja_client):
        """Test portfolio performance endpoint with non-existent portfolio"""
        response = ninja_client.get("/portfolio/nonexistent_user/performance?benchmark=SPY&period=1y")
        
        # Should return 404 or handle gracefully
        assert response.status_code in [404, 400]

class SupportedBenchmarksTest(TestCase):
    def test_supported_benchmarks_exist(self):
        """Test that supported benchmarks dictionary is properly defined."""
        self.assertIsInstance(SUPPORTED_BENCHMARKS, dict)
        self.assertGreater(len(SUPPORTED_BENCHMARKS), 0)
        
        # Check that all required benchmarks are present
        required_benchmarks = ['^GSPC', '^IXIC', '^DJI', '^AXJO', '^FTSE', '^N225']
        for benchmark in required_benchmarks:
            self.assertIn(benchmark, SUPPORTED_BENCHMARKS)
            self.assertIsInstance(SUPPORTED_BENCHMARKS[benchmark], str)
            self.assertGreater(len(SUPPORTED_BENCHMARKS[benchmark]), 0) 