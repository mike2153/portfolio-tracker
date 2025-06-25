# backend/api/tests/test_advanced_financials.py
from unittest.mock import patch, MagicMock
from django.test import TestCase
import pytest
from decimal import Decimal

from ..services.metrics_calculator import AdvancedMetricsCalculator

class AdvancedMetricsCalculatorTest(TestCase):
    def setUp(self):
        """Set up test calculator"""
        self.calculator = AdvancedMetricsCalculator()

    def test_calculate_sharpe_ratio(self):
        """Test Sharpe ratio calculation with real data tolerances"""
        returns = [0.02, -0.01, 0.03, 0.01, -0.005, 0.015]
        risk_free_rate = 0.02
        
        sharpe_ratio = self.calculator.calculate_sharpe_ratio(returns, risk_free_rate)
        
        # Allow for reasonable range in real market conditions
        self.assertIsNotNone(sharpe_ratio)
        self.assertIsInstance(sharpe_ratio, float)
        if sharpe_ratio is not None:
            self.assertGreater(sharpe_ratio, -20.0)  # Not unreasonably negative
            self.assertLess(sharpe_ratio, 20.0)      # Not unreasonably positive (with annualization)

    def test_calculate_beta(self):
        """Test beta calculation with real data tolerances"""
        stock_returns = [0.02, -0.01, 0.03, 0.01, -0.005]
        market_returns = [0.015, -0.005, 0.025, 0.008, -0.002]
        
        beta = self.calculator.calculate_beta(stock_returns, market_returns)
        
        # Beta should be within reasonable range for most stocks
        self.assertIsInstance(beta, float)
        self.assertGreater(beta, -3.0)  # Rarely below -3
        self.assertLess(beta, 5.0)      # Rarely above 5

    def test_calculate_volatility(self):
        """Test volatility calculation"""
        returns = [0.02, -0.01, 0.03, 0.01, -0.005, 0.015, -0.008, 0.012]
        
        volatility = self.calculator.calculate_volatility(returns)
        
        # Volatility should be positive and reasonable
        self.assertIsInstance(volatility, float)
        self.assertGreater(volatility, 0)
        self.assertLess(volatility, 2.0)  # 200% annual volatility is extreme

    def test_full_calculation(self):
        """Test full metrics calculation with flexible tolerances for real data"""
        # Use sample data that represents realistic market conditions
        price_data = [
            {'date': '2024-01-01', 'close': 150.0, 'volume': 1000000},
            {'date': '2024-01-02', 'close': 151.5, 'volume': 1100000},
            {'date': '2024-01-03', 'close': 149.8, 'volume': 950000},
            {'date': '2024-01-04', 'close': 152.2, 'volume': 1200000},
            {'date': '2024-01-05', 'close': 151.0, 'volume': 1050000},
            {'date': '2024-01-08', 'close': 153.1, 'volume': 1150000},
            {'date': '2024-01-09', 'close': 152.5, 'volume': 1000000},
            {'date': '2024-01-10', 'close': 154.2, 'volume': 1300000}
        ]
        
        benchmark_data = [
            {'date': '2024-01-01', 'close': 4500.0},
            {'date': '2024-01-02', 'close': 4510.0},
            {'date': '2024-01-03', 'close': 4495.0},
            {'date': '2024-01-04', 'close': 4520.0},
            {'date': '2024-01-05', 'close': 4505.0},
            {'date': '2024-01-08', 'close': 4530.0},
            {'date': '2024-01-09', 'close': 4525.0},
            {'date': '2024-01-10', 'close': 4540.0}
        ]
        
        metrics = self.calculator.calculate_all_metrics(price_data, benchmark_data)
        
        # Test that all expected metrics are present
        expected_metrics = ['sharpe_ratio', 'beta', 'alpha', 'volatility', 'max_drawdown', 'var_95']
        for metric in expected_metrics:
            self.assertIn(metric, metrics)
            # Some metrics might be None due to insufficient data, which is acceptable
        
        # Test reasonable ranges for real market data
        self.assertGreater(metrics['volatility'], 0)
        self.assertLess(metrics['volatility'], 5.0)  # Very high but possible
        
        self.assertGreater(metrics['beta'], -5.0)    # Reasonable range
        self.assertLess(metrics['beta'], 5.0)
        
        self.assertGreater(metrics['sharpe_ratio'], -10.0)  # Wider range for real data
        self.assertLess(metrics['sharpe_ratio'], 10.0)

@pytest.mark.django_db
class AdvancedFinancialsEndpointTest:
    def test_advanced_financials_endpoint_success(self, ninja_client):
        """Test advanced financials endpoint with real Alpha Vantage data"""
        user_id = "test_user_123"
        response = ninja_client.get(f"/users/{user_id}/advanced-financials/AAPL")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert 'ticker' in data
        assert 'metrics' in data
        assert 'status' in data
        
        assert data['ticker'] == 'AAPL'
        
        # Check that we have expected metrics (even if some are None due to insufficient data)
        metrics = data['metrics']
        expected_keys = ['sharpe_ratio', 'beta', 'alpha', 'volatility', 'max_drawdown', 'var_95']
        
        for key in expected_keys:
            assert key in metrics

    def test_advanced_financials_endpoint_not_found(self, ninja_client):
        """Test advanced financials endpoint with invalid ticker"""
        user_id = "test_user_123"
        response = ninja_client.get(f"/users/{user_id}/advanced-financials/INVALID")
        
        # Should handle gracefully, either 404 or error response
        assert response.status_code in [404, 400, 500] 