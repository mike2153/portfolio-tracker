from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.core.management import call_command
from django.utils import timezone
from ninja.testing import TestClient
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO

from ..api import api
from ..models import CachedDailyPrice, CachedCompanyFundamentals
from ..services.market_data_cache import MarketDataCacheService

class CachedDailyPriceModelTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.price_data = CachedDailyPrice.objects.create(
            symbol='AAPL',
            date=date.today(),
            open=Decimal('150.00'),
            high=Decimal('155.00'),
            low=Decimal('149.00'),
            close=Decimal('154.00'),
            adjusted_close=Decimal('154.00'),
            volume=1000000,
            dividend_amount=Decimal('0.00')
        )

    def test_cached_daily_price_creation(self):
        """Test creating a CachedDailyPrice record"""
        self.assertEqual(self.price_data.symbol, 'AAPL')
        self.assertEqual(self.price_data.close, Decimal('154.00'))
        self.assertIsNotNone(self.price_data.created_at)

    def test_cached_daily_price_str_representation(self):
        """Test string representation of CachedDailyPrice"""
        expected = f"AAPL - {date.today()} (Adj Close: 154.00)"
        self.assertEqual(str(self.price_data), expected)

    def test_unique_constraint(self):
        """Test that symbol+date combination is unique"""
        from django.db import IntegrityError
        
        with self.assertRaises(IntegrityError):
            CachedDailyPrice.objects.create(
                symbol='AAPL',
                date=date.today(),  # Same symbol and date
                open=Decimal('160.00'),
                high=Decimal('165.00'),
                low=Decimal('159.00'),
                close=Decimal('164.00'),
                adjusted_close=Decimal('164.00'),
                volume=2000000
            )

class CachedCompanyFundamentalsModelTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.fundamentals_data = {
            'overview': {'MarketCapitalization': '3000000000000', 'PERatio': '25.5'},
            'advanced_metrics': {'valuation': {'pe_ratio': 25.5}}
        }
        
        self.fundamentals = CachedCompanyFundamentals.objects.create(
            symbol='AAPL',
            last_updated=timezone.now(),
            data=self.fundamentals_data,
            market_capitalization=Decimal('3000000000000'),
            pe_ratio=Decimal('25.5')
        )

    def test_cached_fundamentals_creation(self):
        """Test creating a CachedCompanyFundamentals record"""
        self.assertEqual(self.fundamentals.symbol, 'AAPL')
        self.assertEqual(self.fundamentals.pe_ratio, Decimal('25.5'))
        self.assertIsNotNone(self.fundamentals.data)

    def test_json_field_storage(self):
        """Test that JSON data is properly stored and retrieved"""
        retrieved = CachedCompanyFundamentals.objects.get(symbol='AAPL')
        self.assertEqual(retrieved.data['overview']['PERatio'], '25.5')

class MarketDataCacheServiceTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.cache_service = MarketDataCacheService()
        
        # Create some cached price data
        CachedDailyPrice.objects.create(
            symbol='AAPL',
            date=date.today(),
            open=Decimal('150.00'),
            high=Decimal('155.00'),
            low=Decimal('149.00'),
            close=Decimal('154.00'),
            adjusted_close=Decimal('154.00'),
            volume=1000000
        )
        
        # Create cached fundamentals
        CachedCompanyFundamentals.objects.create(
            symbol='AAPL',
            last_updated=timezone.now(),
            data={
                'overview': {'MarketCapitalization': '3000000000000'},
                'advanced_metrics': {'valuation': {'pe_ratio': 25.5}}
            }
        )

    def test_get_cached_prices_hit(self):
        """Test cache hit for daily prices"""
        result = self.cache_service.get_daily_prices('AAPL', use_cache=True)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['source'], 'cache')
        self.assertIn('data', result)
        self.assertGreater(len(result['data']), 0)

    def test_get_cached_prices_miss_old_data(self):
        """Test cache miss when data is too old"""
        # Create old price data
        old_date = date.today() - timedelta(days=5)
        CachedDailyPrice.objects.filter(symbol='AAPL').update(date=old_date)
        
        with patch.object(self.cache_service.av_service, 'get_daily_adjusted') as mock_av:
            mock_av.return_value = {
                'data': [{'date': '2024-01-01', 'adjusted_close': '160.00', 'open': '159.00', 
                         'high': '161.00', 'low': '158.00', 'close': '160.00', 'volume': '1000000',
                         'dividend_amount': '0.00'}]
            }
            
            result = self.cache_service.get_daily_prices('AAPL', use_cache=True)
            
            self.assertEqual(result['source'], 'alpha_vantage')
            mock_av.assert_called_once()

    @patch('api.services.market_data_cache.get_alpha_vantage_service')
    def test_get_cached_prices_no_cache(self, mock_get_av):
        """Test bypassing cache when use_cache=False"""
        mock_av_service = MagicMock()
        mock_av_service.get_daily_adjusted.return_value = {
            'data': [{'date': '2024-01-01', 'adjusted_close': '160.00', 'open': '159.00',
                     'high': '161.00', 'low': '158.00', 'close': '160.00', 'volume': '1000000',
                     'dividend_amount': '0.00'}]
        }
        mock_get_av.return_value = mock_av_service
        
        cache_service = MarketDataCacheService()
        result = cache_service.get_daily_prices('AAPL', use_cache=False)
        
        self.assertEqual(result['source'], 'alpha_vantage')
        mock_av_service.get_daily_adjusted.assert_called_once()

    def test_get_company_fundamentals_cache_hit(self):
        """Test cache hit for company fundamentals"""
        result = self.cache_service.get_company_fundamentals('AAPL', use_cache=True)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['source'], 'cache')
        self.assertIn('cache_age_hours', result)

    def test_get_company_fundamentals_cache_miss_old_data(self):
        """Test cache miss when fundamentals data is too old"""
        # Make the cached data old
        old_time = timezone.now() - timedelta(hours=25)
        CachedCompanyFundamentals.objects.filter(symbol='AAPL').update(last_updated=old_time)
        
        with patch.object(self.cache_service.av_service, 'get_company_overview') as mock_av:
            mock_av.return_value = {'MarketCapitalization': '3100000000000', 'PERatio': '26.0'}
            
            result = self.cache_service.get_company_fundamentals('AAPL', use_cache=True, max_age_hours=24)
            
            self.assertEqual(result['source'], 'alpha_vantage')
            mock_av.assert_called_once()

    def test_get_advanced_financials_cache_hit(self):
        """Test cache hit for advanced financials"""
        result = self.cache_service.get_advanced_financials('AAPL', use_cache=True)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['source'], 'cache')
        self.assertIn('valuation', result)

    def test_get_cache_stats(self):
        """Test cache statistics"""
        stats = self.cache_service.get_cache_stats()
        
        self.assertIn('daily_prices', stats)
        self.assertIn('fundamentals', stats)
        self.assertEqual(stats['daily_prices']['unique_symbols'], 1)
        self.assertEqual(stats['fundamentals']['unique_symbols'], 1)

class UpdateMarketDataCommandTest(TestCase):
    @patch('api.management.commands.update_market_data.get_alpha_vantage_service')
    def test_update_market_data_command_basic(self, mock_get_av):
        """Test basic functionality of update_market_data command"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        
        # Mock historical data
        mock_av_service.get_daily_adjusted.return_value = {
            'data': [
                {
                    'date': '2024-01-15',
                    'open': '150.00',
                    'high': '155.00',
                    'low': '149.00',
                    'close': '154.00',
                    'adjusted_close': '154.00',
                    'volume': '1000000',
                    'dividend_amount': '0.00'
                }
            ]
        }
        
        # Mock overview data
        mock_av_service.get_company_overview.return_value = {
            'MarketCapitalization': '3000000000000',
            'PERatio': '25.5'
        }
        
        # Mock financial statements
        mock_av_service.get_income_statement.return_value = {
            'annual_reports': [{'fiscalDateEnding': '2023-12-31', 'totalRevenue': '1000000000'}],
            'quarterly_reports': []
        }
        mock_av_service.get_balance_sheet.return_value = {'annual_reports': [], 'quarterly_reports': []}
        mock_av_service.get_cash_flow.return_value = {'annual_reports': [], 'quarterly_reports': []}
        
        mock_get_av.return_value = mock_av_service
        
        # Capture command output
        out = StringIO()
        
        # Run command with limited symbols
        call_command('update_market_data', 
                    symbols='AAPL', 
                    max_symbols=1,
                    stdout=out)
        
        # Check that data was created
        self.assertTrue(CachedDailyPrice.objects.filter(symbol='AAPL').exists())
        self.assertTrue(CachedCompanyFundamentals.objects.filter(symbol='AAPL').exists())
        
        # Check command output
        output = out.getvalue()
        self.assertIn('AAPL', output)
        self.assertIn('Complete', output)

    def test_update_market_data_command_skip_options(self):
        """Test command with skip options"""
        out = StringIO()
        
        # Run command with skip options (should not fail even without mocks)
        call_command('update_market_data', 
                    symbols='AAPL',
                    skip_prices=True,
                    skip_fundamentals=True,
                    max_symbols=1,
                    stdout=out)
        
        output = out.getvalue()
        self.assertIn('Complete', output)

class CacheStatsEndpointTest(TestCase):
    def setUp(self):
        """Set up test client"""
        self.client = TestClient(api)
        
        # Create some test cache data
        CachedDailyPrice.objects.create(
            symbol='AAPL',
            date=date.today(),
            open=Decimal('150.00'),
            high=Decimal('155.00'),
            low=Decimal('149.00'),
            close=Decimal('154.00'),
            adjusted_close=Decimal('154.00'),
            volume=1000000
        )

    def test_cache_stats_endpoint(self):
        """Test the cache stats endpoint"""
        response = self.client.get("/cache/stats")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn('cache', data)
        self.assertIn('alpha_vantage', data)
        self.assertIn('status', data)
        self.assertEqual(data['status'], 'healthy')
        
        # Check cache stats structure
        cache_stats = data['cache']
        self.assertIn('daily_prices', cache_stats)
        self.assertIn('fundamentals', cache_stats)

class CacheIntegrationTest(TestCase):
    """Integration tests for caching with API endpoints"""
    
    def setUp(self):
        """Set up test client and cache data"""
        self.client = TestClient(api)
        
        # Create cached fundamentals with advanced metrics
        CachedCompanyFundamentals.objects.create(
            symbol='AAPL',
            last_updated=timezone.now(),
            data={
                'overview': {'MarketCapitalization': '3000000000000'},
                'advanced_metrics': {
                    'valuation': {'pe_ratio': 25.5, 'pb_ratio': 5.2},
                    'financial_health': {'current_ratio': 1.5},
                    'performance': {'revenue_growth_yoy': 8.5},
                    'profitability': {'gross_margin': 42.5},
                    'dividends': {'dividend_payout_ratio': 15.2},
                    'raw_data_summary': {'beta': 1.2}
                }
            }
        )

    def test_advanced_financials_endpoint_cache_hit(self):
        """Test that advanced financials endpoint uses cache when available"""
        response = self.client.get("/stocks/AAPL/advanced_financials")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Should have cache source
        self.assertEqual(data['source'], 'cache')
        self.assertIn('cache_age_hours', data)
        
        # Should have all metric categories
        self.assertIn('valuation', data)
        self.assertIn('financial_health', data)
        self.assertIn('performance', data)
        self.assertIn('profitability', data)
        self.assertIn('dividends', data)
        self.assertIn('raw_data_summary', data) 