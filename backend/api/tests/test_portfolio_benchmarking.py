from unittest.mock import patch, MagicMock
from django.test import TestCase
from ninja.testing import TestClient
from datetime import date, timedelta
from decimal import Decimal
from ..api import api
from ..models import Portfolio, Holding
from django.test import Client
from ..services.portfolio_benchmarking import (
    _parse_period_to_dates, 
    _calculate_cagr, 
    calculate_enhanced_portfolio_performance,
    SUPPORTED_BENCHMARKS
)

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
        """Set up test data."""
        self.portfolio = Portfolio.objects.create(
            user_id="test_user",
            cash_balance=Decimal('1000.00')
        )
        self.holding1 = Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal('10'),
            purchase_price=Decimal('150.00'),
            purchase_date=date.today() - timedelta(days=365)
        )
        self.holding2 = Holding.objects.create(
            portfolio=self.portfolio,
            ticker="MSFT",
            company_name="Microsoft Corp.",
            shares=Decimal('5'),
            purchase_price=Decimal('200.00'),
            purchase_date=date.today() - timedelta(days=180)
        )

    @patch('api.services.portfolio_benchmarking.get_alpha_vantage_service')
    def test_calculate_enhanced_portfolio_performance_success(self, mock_get_service):
        """Test successful portfolio performance calculation."""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        
        # Mock historical data for AAPL
        mock_aapl_data = {
            'data': [
                {'date': '2024-01-15', 'adjusted_close': '160.00'},
                {'date': '2024-01-10', 'adjusted_close': '155.00'},
                {'date': '2023-12-15', 'adjusted_close': '150.00'},
                {'date': '2023-06-15', 'adjusted_close': '145.00'},
            ]
        }
        
        # Mock historical data for MSFT
        mock_msft_data = {
            'data': [
                {'date': '2024-01-15', 'adjusted_close': '220.00'},
                {'date': '2024-01-10', 'adjusted_close': '215.00'},
                {'date': '2023-12-15', 'adjusted_close': '210.00'},
                {'date': '2023-06-15', 'adjusted_close': '200.00'},
            ]
        }
        
        # Mock benchmark data (S&P 500)
        mock_benchmark_data = {
            'data': [
                {'date': '2024-01-15', 'adjusted_close': '4800.00'},
                {'date': '2024-01-10', 'adjusted_close': '4750.00'},
                {'date': '2023-12-15', 'adjusted_close': '4700.00'},
                {'date': '2023-06-15', 'adjusted_close': '4500.00'},
            ]
        }
        
        # Configure mock to return different data based on ticker
        def mock_get_daily_adjusted(ticker, outputsize='full'):
            if ticker == 'AAPL':
                return mock_aapl_data
            elif ticker == 'MSFT':
                return mock_msft_data
            elif ticker == '^GSPC':
                return mock_benchmark_data
            return None
        
        mock_av_service.get_daily_adjusted.side_effect = mock_get_daily_adjusted
        mock_get_service.return_value = mock_av_service
        
        # Test the calculation
        result = calculate_enhanced_portfolio_performance("test_user", "1Y", "^GSPC")
        
        # Assertions
        self.assertIsInstance(result, dict)
        self.assertIn('portfolio_performance', result)
        self.assertIn('benchmark_performance', result)
        self.assertIn('comparison', result)
        self.assertIn('summary', result)
        
        self.assertGreater(len(result['portfolio_performance']), 0)
        self.assertGreater(len(result['benchmark_performance']), 0)
        
        comparison = result['comparison']
        self.assertIn('portfolio_return', comparison)
        self.assertIn('benchmark_return', comparison)
        self.assertIn('outperformance', comparison)
        self.assertIn('portfolio_cagr', comparison)
        self.assertIn('benchmark_cagr', comparison)
        
        summary = result['summary']
        self.assertIn('start_date', summary)
        self.assertIn('end_date', summary)
        self.assertIn('days_analyzed', summary)
        self.assertIn('years_analyzed', summary)

    def test_calculate_enhanced_portfolio_performance_invalid_benchmark(self):
        """Test portfolio performance calculation with invalid benchmark."""
        with self.assertRaises(ValueError) as context:
            calculate_enhanced_portfolio_performance("test_user", "1Y", "INVALID_BENCHMARK")
        
        self.assertIn("Unsupported benchmark", str(context.exception))

    def test_calculate_enhanced_portfolio_performance_portfolio_not_found(self):
        """Test portfolio performance calculation with non-existent portfolio."""
        with self.assertRaises(ValueError) as context:
            calculate_enhanced_portfolio_performance("nonexistent_user", "1Y", "^GSPC")
        
        self.assertIn("Portfolio not found", str(context.exception))

class PortfolioBenchmarkingEndpointTest(TestCase):
    def setUp(self):
        """Set up test client and test data."""
        self.client = Client()  # Use Django's Client
        self.portfolio = Portfolio.objects.create(
            user_id="test_user",
            cash_balance=Decimal('1000.00')
        )
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal('10'),
            purchase_price=Decimal('150.00'),
            purchase_date=date.today() - timedelta(days=365)
        )

    @patch('api.services.portfolio_benchmarking.get_alpha_vantage_service')
    def test_portfolio_performance_endpoint_success(self, mock_get_service):
        """Test successful portfolio performance endpoint call."""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_data = {
            'data': [
                {'date': '2024-01-15', 'adjusted_close': '160.00'},
                {'date': '2023-06-15', 'adjusted_close': '150.00'},
            ]
        }
        mock_av_service.get_daily_adjusted.return_value = mock_data
        mock_get_service.return_value = mock_av_service
        
        # Make request
        response = self.client.get("/portfolios/test_user/performance?period=1Y&benchmark=^GSPC")
        
        # Assertions
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('portfolio_performance', data)
        self.assertIn('benchmark_performance', data)
        self.assertIn('comparison', data)
        self.assertEqual(data['benchmark_symbol'], '^GSPC')
        self.assertEqual(data['benchmark_name'], 'S&P 500')

    def test_portfolio_performance_endpoint_invalid_benchmark(self):
        """Test portfolio performance endpoint with invalid benchmark."""
        response = self.client.get("/portfolios/test_user/performance?benchmark=INVALID")
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Unsupported benchmark', data['detail'])

    def test_portfolio_performance_endpoint_invalid_period(self):
        """Test portfolio performance endpoint with invalid period."""
        response = self.client.get("/portfolios/test_user/performance?period=INVALID")
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('Invalid period', data['detail'])

    def test_portfolio_performance_endpoint_portfolio_not_found(self):
        """Test portfolio performance endpoint with non-existent portfolio."""
        response = self.client.get("/portfolios/nonexistent_user/performance")
        
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertIn('Portfolio not found', data['detail'])

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