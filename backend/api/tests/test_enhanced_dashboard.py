import pytest
import logging
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from unittest.mock import AsyncMock, patch

from ..models import Transaction
from ..services.advanced_financial_metrics import get_advanced_financial_metrics_service

logger = logging.getLogger(__name__)

class EnhancedDashboardTest(TestCase):
    """Test enhanced dashboard KPI calculations with comprehensive debugging"""
    
    def setUp(self):
        """Set up test data with extensive logging"""
        logger.info("[EnhancedDashboardTest] 🚀 Setting up test environment")
        
        self.test_user_id = 'test_enhanced_dashboard_user'
        self.service = get_advanced_financial_metrics_service()
        
        # Clear any existing transactions for this test user
        Transaction.objects.filter(user_id=self.test_user_id).delete()
        logger.debug(f"[EnhancedDashboardTest] Cleared existing transactions for {self.test_user_id}")
        
        # Create comprehensive test transaction data
        self._create_test_transactions()
        
        logger.info("[EnhancedDashboardTest] ✅ Test setup completed")
    
    def _create_test_transactions(self):
        """Create realistic test transaction data"""
        logger.debug("[EnhancedDashboardTest] 📊 Creating test transaction data")
        
        # Apple stock transactions
        Transaction.objects.create(
            user_id=self.test_user_id,
            transaction_type='BUY',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('150.00'),
            transaction_date=date.today() - timedelta(days=365),  # 1 year ago
            total_amount=Decimal('1500.00'),
            transaction_currency='USD'
        )
        
        # Microsoft stock transactions
        Transaction.objects.create(
            user_id=self.test_user_id,
            transaction_type='BUY',
            ticker='MSFT',
            company_name='Microsoft Corporation',
            shares=Decimal('5'),
            price_per_share=Decimal('200.00'),
            transaction_date=date.today() - timedelta(days=300),
            total_amount=Decimal('1000.00'),
            transaction_currency='USD'
        )
        
        # Dividend transactions
        Transaction.objects.create(
            user_id=self.test_user_id,
            transaction_type='DIVIDEND',
            ticker='AAPL',
            company_name='Apple Inc.',
            shares=Decimal('10'),
            price_per_share=Decimal('0.25'),  # $0.25 per share dividend
            transaction_date=date.today() - timedelta(days=90),
            total_amount=Decimal('2.50'),  # 10 shares * $0.25
            transaction_currency='USD'
        )
        
        Transaction.objects.create(
            user_id=self.test_user_id,
            transaction_type='DIVIDEND',
            ticker='MSFT',
            company_name='Microsoft Corporation',
            shares=Decimal('5'),
            price_per_share=Decimal('0.30'),
            transaction_date=date.today() - timedelta(days=60),
            total_amount=Decimal('1.50'),
            transaction_currency='USD'
        )
        
        logger.info("[EnhancedDashboardTest] ✅ Created 4 test transactions (2 BUY, 2 DIVIDEND)")
    
    @pytest.mark.asyncio
    async def test_enhanced_kpi_calculation_success(self):
        """Test successful enhanced KPI calculation with detailed validation"""
        logger.info("[EnhancedDashboardTest] 🧪 Testing enhanced KPI calculation")
        
        # Mock Alpha Vantage service to return predictable data
        with patch.object(self.service, '_get_current_price_safe') as mock_price:
            # Set mock prices
            async def mock_price_func(ticker):
                prices = {
                    'AAPL': Decimal('180.00'),  # 20% gain from $150
                    'MSFT': Decimal('240.00')   # 20% gain from $200
                }
                return prices.get(ticker, Decimal('100.00'))
            
            mock_price.side_effect = mock_price_func
            
            # Calculate enhanced metrics
            result = await self.service.calculate_enhanced_kpi_metrics(self.test_user_id, "SPY")
            
            logger.debug(f"[EnhancedDashboardTest] Enhanced KPI result: {result}")
            
            # Validate structure
            self.assertIsInstance(result, dict)
            self.assertIn('marketValue', result)
            self.assertIn('irr', result)
            self.assertIn('dividendYield', result)
            self.assertIn('portfolioBeta', result)
            
            # Validate market value calculation
            market_value_data = result['marketValue']
            self.assertIn('value', market_value_data)
            self.assertIn('sub_label', market_value_data)
            self.assertIn('is_positive', market_value_data)
            
            # Expected market value: (10 * 180) + (5 * 240) = 1800 + 1200 = 3000
            # Expected invested: 1500 + 1000 = 2500
            # Expected profit: 3000 - 2500 = 500 (20% gain)
            expected_market_value = 3000.0
            actual_market_value = float(market_value_data['value'])
            
            self.assertAlmostEqual(actual_market_value, expected_market_value, places=2)
            logger.info(f"[EnhancedDashboardTest] ✅ Market value calculation correct: ${actual_market_value}")
            
            # Validate IRR calculation
            irr_data = result['irr']
            self.assertIn('value', irr_data)
            self.assertIn('sub_label', irr_data)
            self.assertTrue(irr_data['value'].endswith('%'))
            
            # Should show positive IRR due to 20% gains
            self.assertTrue(irr_data['is_positive'])
            logger.info(f"[EnhancedDashboardTest] ✅ IRR calculation shows positive return: {irr_data['value']}")
            
            # Validate dividend yield calculation
            dividend_data = result['dividendYield']
            self.assertIn('value', dividend_data)
            self.assertIn('sub_label', dividend_data)
            
            # Total dividends received: $2.50 + $1.50 = $4.00
            self.assertTrue(dividend_data['value'].startswith('AU$'))
            logger.info(f"[EnhancedDashboardTest] ✅ Dividend calculation: {dividend_data['value']}")
            
            # Validate beta calculation
            beta_data = result['portfolioBeta']
            self.assertIn('value', beta_data)
            self.assertIn('sub_label', beta_data)
            
            # Beta should be a numeric value (around 1.0 for market-like volatility)
            beta_value = float(beta_data['value'])
            self.assertGreater(beta_value, 0.0)
            self.assertLess(beta_value, 3.0)  # Reasonable range
            logger.info(f"[EnhancedDashboardTest] ✅ Beta calculation: {beta_data['value']}")
            
            logger.info("[EnhancedDashboardTest] ✅ All enhanced KPI validations passed")
    
    @pytest.mark.asyncio
    async def test_enhanced_kpi_no_transactions(self):
        """Test enhanced KPI calculation with no transaction data"""
        logger.info("[EnhancedDashboardTest] 🧪 Testing KPI calculation with no transactions")
        
        # Create user with no transactions
        empty_user_id = 'empty_test_user'
        
        result = await self.service.calculate_enhanced_kpi_metrics(empty_user_id, "SPY")
        
        logger.debug(f"[EnhancedDashboardTest] Empty user result: {result}")
        
        # Should return default values
        self.assertIsInstance(result, dict)
        
        # All values should be zero/default
        self.assertEqual(result['marketValue']['value'], "0.00")
        self.assertEqual(result['irr']['value'], "0.00%")
        self.assertEqual(result['dividendYield']['value'], "AU$0.00")
        self.assertEqual(result['portfolioBeta']['value'], "1.00")
        
        logger.info("[EnhancedDashboardTest] ✅ Default values returned correctly for empty user")
    
    @pytest.mark.asyncio
    async def test_enhanced_kpi_api_failure_fallback(self):
        """Test enhanced KPI calculation handles API failures gracefully"""
        logger.info("[EnhancedDashboardTest] 🧪 Testing API failure fallback")
        
        # Mock Alpha Vantage service to fail
        with patch.object(self.service, '_get_current_price_safe') as mock_price:
            mock_price.return_value = None  # Simulate API failure
            
            result = await self.service.calculate_enhanced_kpi_metrics(self.test_user_id, "SPY")
            
            logger.debug(f"[EnhancedDashboardTest] API failure result: {result}")
            
            # Should still return valid structure
            self.assertIsInstance(result, dict)
            self.assertIn('marketValue', result)
            self.assertIn('irr', result)
            self.assertIn('dividendYield', result)
            self.assertIn('portfolioBeta', result)
            
            logger.info("[EnhancedDashboardTest] ✅ API failure handled gracefully with fallback")
    
    def test_transaction_validation(self):
        """Test transaction validation with comprehensive edge cases"""
        logger.info("[EnhancedDashboardTest] 🧪 Testing transaction validation")
        
        # Test valid transaction
        valid_txn = Transaction(
            user_id=self.test_user_id,
            transaction_type='BUY',
            ticker='TEST',
            shares=Decimal('10'),
            price_per_share=Decimal('100'),
            transaction_date=date.today()
        )
        
        self.assertTrue(self.service._validate_transaction(valid_txn))
        logger.info("[EnhancedDashboardTest] ✅ Valid transaction passed validation")
        
        # Test invalid transaction - zero shares
        invalid_txn = Transaction(
            user_id=self.test_user_id,
            transaction_type='BUY',
            ticker='TEST',
            shares=Decimal('0'),
            price_per_share=Decimal('100'),
            transaction_date=date.today()
        )
        
        self.assertFalse(self.service._validate_transaction(invalid_txn))
        logger.info("[EnhancedDashboardTest] ✅ Invalid transaction (zero shares) rejected")
        
        # Test invalid transaction - missing ticker
        invalid_txn2 = Transaction(
            user_id=self.test_user_id,
            transaction_type='BUY',
            ticker='',
            shares=Decimal('10'),
            price_per_share=Decimal('100'),
            transaction_date=date.today()
        )
        
        self.assertFalse(self.service._validate_transaction(invalid_txn2))
        logger.info("[EnhancedDashboardTest] ✅ Invalid transaction (missing ticker) rejected")
    
    def tearDown(self):
        """Clean up test data"""
        logger.info("[EnhancedDashboardTest] 🧹 Cleaning up test data")
        
        # Clean up test transactions
        Transaction.objects.filter(user_id=self.test_user_id).delete()
        Transaction.objects.filter(user_id='empty_test_user').delete()
        
        logger.info("[EnhancedDashboardTest] ✅ Test cleanup completed")


# Additional utility tests
class FinancialCalculationUtilsTest(TestCase):
    """Test utility functions for financial calculations"""
    
    def setUp(self):
        self.service = get_advanced_financial_metrics_service()
    
    def test_beta_estimation(self):
        """Test beta estimation for various ticker types"""
        logger.info("[FinancialCalculationUtilsTest] 🧪 Testing beta estimation")
        
        # Technology stocks should have higher beta
        tech_beta = self.service._estimate_ticker_beta_safe('AAPL')
        self.assertGreater(tech_beta, 1.0)
        logger.info(f"[FinancialCalculationUtilsTest] Tech stock beta: {tech_beta}")
        
        # Utilities should have lower beta
        utility_beta = self.service._estimate_ticker_beta_safe('DUK')
        self.assertLess(utility_beta, 1.0)
        logger.info(f"[FinancialCalculationUtilsTest] Utility stock beta: {utility_beta}")
        
        # Unknown ticker should default to market beta
        unknown_beta = self.service._estimate_ticker_beta_safe('UNKNOWN')
        self.assertEqual(unknown_beta, 1.0)
        logger.info(f"[FinancialCalculationUtilsTest] Unknown stock beta: {unknown_beta}")
        
        logger.info("[FinancialCalculationUtilsTest] ✅ Beta estimation tests passed")


if __name__ == '__main__':
    import django
    django.setup()
    
    # Configure logging for tests
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Run tests
    import unittest
    unittest.main() 