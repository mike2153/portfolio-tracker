from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from decimal import Decimal
from datetime import date
import pytest

from ..api import api
from ..models import Portfolio, Holding, Transaction
from ..services.portfolio_optimization import (
    PortfolioOptimizationService, 
    HoldingAnalysis, 
    PortfolioMetrics,
    DiversificationAnalysis,
    RiskAssessment
)

class PortfolioOptimizationServiceTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.user_id = "test_user_123"
        # Clear existing data to avoid conflicts
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Test Portfolio")
        self.service = PortfolioOptimizationService()
        
        # Create test holdings with real tickers
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal("10"),
            purchase_price=Decimal("150.00"),
            purchase_date=date.today()
        )
        
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="MSFT",
            company_name="Microsoft Corp",
            shares=Decimal("5"),
            purchase_price=Decimal("200.00"),
            purchase_date=date.today()
        )

    @patch('backend.api.alpha_vantage_service.AlphaVantageService._get_from_cache', return_value=None)
    @patch('backend.api.alpha_vantage_service.AlphaVantageService._store_in_cache', return_value=None)
    def test_get_holdings_market_data_real_api(self, mock_store, mock_get):
        """Test getting holdings market data via analyze_portfolio"""
        analysis = self.service.analyze_portfolio(self.user_id)
        holdings_data = analysis.get('holdings_analysis', [])
        
        self.assertIsInstance(holdings_data, list)
        self.assertGreater(len(holdings_data), 0)
        
        # Check that we have our expected tickers
        tickers = [holding['ticker'] for holding in holdings_data]
        self.assertIn('AAPL', tickers)
        self.assertIn('MSFT', tickers)
        
        # Check that market data was fetched (prices should be positive)
        for holding in holdings_data:
            if holding.get('current_value'):
                self.assertGreater(holding['current_value'], 0)

    def test_analyze_portfolio_with_holdings(self):
        """Test portfolio analysis when holdings exist"""
        analysis = self.service.analyze_portfolio(self.user_id)
        
        self.assertIsInstance(analysis, dict)
        self.assertIn('holdings_analysis', analysis)
        self.assertIn('portfolio_metrics', analysis)
        self.assertIn('total_value', analysis['portfolio_metrics'])
        self.assertIn('diversification', analysis)
        
        # Should have our holdings
        self.assertGreaterEqual(len(analysis['holdings_analysis']), 2)

    def test_analyze_portfolio_no_holdings(self):
        """Test portfolio analysis when no holdings exist"""
        empty_user = "empty_user"
        # Clear any existing portfolio and create empty one
        Portfolio.objects.filter(user_id=empty_user).delete()
        Portfolio.objects.create(user_id=empty_user, name="Empty Portfolio")
        
        analysis = self.service.analyze_portfolio(empty_user)
        
        self.assertIsInstance(analysis, dict)
        self.assertEqual(len(analysis.get('holdings_analysis', [])), 0)
        self.assertEqual(analysis.get('portfolio_metrics', {}).get('total_value', 0), 0)

    @patch('backend.api.alpha_vantage_service.AlphaVantageService._get_from_cache', return_value=None)
    @patch('backend.api.alpha_vantage_service.AlphaVantageService._store_in_cache', return_value=None)
    def test_calculate_correlation_matrix_real_data(self, mock_store, mock_get):
        """Test correlation matrix calculation with real market data"""
        tickers = ['AAPL', 'MSFT']
        
        # This will use real API data
        result = self.service.calculate_correlation_matrix(tickers)
        
        # Correlation matrix should be symmetric and have proper dimensions
        if result is not None and result.get('status') == 'success':
            correlation_matrix = result['correlation_matrix']
            self.assertEqual(len(correlation_matrix), len(tickers))
            
            for ticker in tickers:
                self.assertIn(ticker, correlation_matrix)
                self.assertEqual(len(correlation_matrix[ticker]), len(tickers))
            
            # Diagonal should be close to 1 (perfect correlation with itself)
            for ticker in tickers:
                self.assertAlmostEqual(correlation_matrix[ticker][ticker], 1.0, places=1)

    @patch('backend.api.alpha_vantage_service.AlphaVantageService._get_from_cache', return_value=None)
    @patch('backend.api.alpha_vantage_service.AlphaVantageService._store_in_cache', return_value=None)
    def test_suggest_rebalancing_real_data(self, mock_store, mock_get):
        """Test rebalancing suggestions with real market data"""
        analysis = self.service.analyze_portfolio(self.user_id)
        
        self.assertIn('optimization_recommendations', analysis)
        suggestions = analysis['optimization_recommendations']
        
        self.assertIsInstance(suggestions, dict)
        self.assertIn('rebalancing_suggestions', suggestions)
        self.assertIn('target_allocation', suggestions)
        self.assertIsInstance(suggestions['rebalancing_suggestions'], list)

    def test_calculate_portfolio_metrics(self):
        """Test portfolio metrics calculation"""
        # Create sample holdings data
        holdings_data = [
            HoldingAnalysis(
                ticker='AAPL',
                weight=0.4,
                expected_return=0.12,
                volatility=0.25,
                beta=1.2,
                sector='Technology',
                market_cap='Large Cap',
                current_value=4000.0
            ),
            HoldingAnalysis(
                ticker='JNJ',
                weight=0.6,
                expected_return=0.08,
                volatility=0.15,
                beta=0.8,
                sector='Healthcare',
                market_cap='Large Cap',
                current_value=6000.0
            )
        ]
        
        metrics = self.service._calculate_portfolio_metrics(holdings_data)
        
        self.assertEqual(metrics.total_value, 10000.0)
        self.assertAlmostEqual(metrics.expected_return, 0.096, places=3)  # 0.4*0.12 + 0.6*0.08
        self.assertAlmostEqual(metrics.beta, 0.96, places=2)  # 0.4*1.2 + 0.6*0.8
        self.assertGreater(metrics.sharpe_ratio, 0)
        self.assertGreater(metrics.var_95, 0)

    def test_analyze_diversification(self):
        """Test diversification analysis"""
        holdings_data = [
            HoldingAnalysis('AAPL', 0.5, 0.12, 0.25, 1.2, 'Technology', 'Large Cap', 5000.0),
            HoldingAnalysis('JNJ', 0.3, 0.08, 0.15, 0.8, 'Healthcare', 'Large Cap', 3000.0),
            HoldingAnalysis('JPM', 0.2, 0.10, 0.20, 1.1, 'Financial Services', 'Large Cap', 2000.0)
        ]
        
        diversification = self.service._analyze_diversification(holdings_data)
        
        self.assertEqual(diversification.number_of_holdings, 3)
        self.assertEqual(len(diversification.sector_concentration), 3)
        self.assertIn('Technology', diversification.sector_concentration)
        self.assertIn('Healthcare', diversification.sector_concentration)
        self.assertIn('Financial Services', diversification.sector_concentration)
        
        # Check sector weights
        self.assertAlmostEqual(diversification.sector_concentration['Technology'], 0.5, places=2)
        self.assertAlmostEqual(diversification.sector_concentration['Healthcare'], 0.3, places=2)
        self.assertAlmostEqual(diversification.sector_concentration['Financial Services'], 0.2, places=2)
        
        # Concentration risk should be moderate with 3 holdings
        self.assertGreater(diversification.concentration_risk_score, 0)
        self.assertLess(diversification.concentration_risk_score, 100)

    def test_assess_portfolio_risk(self):
        """Test portfolio risk assessment"""
        portfolio_metrics = PortfolioMetrics(
            total_value=10000.0,
            expected_return=0.10,
            volatility=0.20,
            sharpe_ratio=0.4,
            beta=1.0,
            var_95=500.0,
            max_drawdown=0.15
        )
        
        diversification = DiversificationAnalysis(
            sector_concentration={'Technology': 0.7, 'Healthcare': 0.3},
            geographic_concentration={'United States': 1.0},
            market_cap_concentration={'Large Cap': 1.0},
            concentration_risk_score=60,
            number_of_holdings=2,
            herfindahl_index=0.58
        )
        
        holdings_data = [
            HoldingAnalysis('AAPL', 0.7, 0.12, 0.25, 1.2, 'Technology', 'Large Cap', 7000.0),
            HoldingAnalysis('JNJ', 0.3, 0.08, 0.15, 0.8, 'Healthcare', 'Large Cap', 3000.0)
        ]
        
        risk_assessment = self.service._assess_portfolio_risk(
            holdings_data, portfolio_metrics, diversification
        )
        
        self.assertGreater(risk_assessment.overall_risk_score, 0)
        self.assertLessEqual(risk_assessment.overall_risk_score, 100)
        self.assertIsInstance(risk_assessment.risk_factors, list)
        self.assertIsInstance(risk_assessment.recommendations, list)
        
        # Should identify concentration risk
        self.assertIn("High sector concentration", risk_assessment.risk_factors)

    def test_generate_optimization_recommendations(self):
        """Test optimization recommendations generation"""
        holdings_data = [
            HoldingAnalysis('AAPL', 0.6, 0.12, 0.25, 1.2, 'Technology', 'Large Cap', 6000.0),
            HoldingAnalysis('MSFT', 0.4, 0.11, 0.22, 1.1, 'Technology', 'Large Cap', 4000.0)
        ]
        
        portfolio_metrics = PortfolioMetrics(10000.0, 0.115, 0.235, 0.4, 1.15, 600.0, 0.18)
        
        diversification = DiversificationAnalysis(
            {'Technology': 1.0}, {'United States': 1.0}, {'Large Cap': 1.0},
            80, 2, 0.52
        )
        
        risk_assessment = RiskAssessment(
            70, 30, 24, 15, 5, 
            ['High concentration risk', 'High sector concentration'],
            ['Diversify across sectors']
        )
        
        recommendations = self.service._generate_optimization_recommendations(
            holdings_data, portfolio_metrics, diversification, risk_assessment
        )
        
        self.assertIsInstance(recommendations.rebalancing_suggestions, list)
        self.assertIsInstance(recommendations.diversification_suggestions, list)
        self.assertIsInstance(recommendations.risk_reduction_suggestions, list)
        self.assertIsInstance(recommendations.potential_new_holdings, list)
        self.assertIsInstance(recommendations.target_allocation, dict)
        
        # Should suggest reducing AAPL (over 15% allocation)
        aapl_suggestions = [r for r in recommendations.rebalancing_suggestions if r['ticker'] == 'AAPL']
        self.assertGreater(len(aapl_suggestions), 0)
        self.assertEqual(aapl_suggestions[0]['suggested_action'], 'reduce')

    def test_estimate_expected_return(self):
        """Test expected return estimation"""
        quote = {'price': '150.00'}
        overview = {'PERatio': '20', 'DividendYield': '0.01'}
        
        expected_return = self.service._estimate_expected_return('AAPL', quote, overview)
        
        self.assertGreater(expected_return, 0)
        self.assertLessEqual(expected_return, 0.20)

    def test_estimate_volatility(self):
        """Test volatility estimation"""
        overview = {'Beta': '1.2'}
        
        volatility = self.service._estimate_volatility('AAPL', overview)
        
        self.assertGreater(volatility, 0)
        self.assertLessEqual(volatility, 0.50)

    def test_classify_market_cap(self):
        """Test market cap classification"""
        # Test different market cap sizes
        self.assertEqual(self.service._classify_market_cap('300000000000'), 'Large Cap')
        self.assertEqual(self.service._classify_market_cap('50000000000'), 'Large Cap')
        self.assertEqual(self.service._classify_market_cap('5000000000'), 'Mid Cap')
        self.assertEqual(self.service._classify_market_cap('1000000000'), 'Small Cap')
        self.assertEqual(self.service._classify_market_cap('100000000'), 'Small Cap')
        self.assertEqual(self.service._classify_market_cap(None), 'Unknown')
        self.assertEqual(self.service._classify_market_cap('None'), 'Unknown')

@pytest.mark.django_db
class PortfolioOptimizationAPITest:
    def setup_method(self):
        """Set up test data"""
        self.user_id = "api_test_user"
        # Clear existing data to avoid conflicts
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="API Test Portfolio")
        
        # Create test holdings
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal("10"),
            purchase_price=Decimal("150.00"),
            purchase_date=date.today()
        )

    def test_portfolio_optimization_endpoint(self, ninja_client):
        """Test portfolio optimization API endpoint"""
        response = ninja_client.get(f"/portfolio/{self.user_id}/optimization")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'data' in data
        assert 'analysis' in data['data']
        assert 'portfolio_metrics' in data['data']['analysis']
        assert 'optimization_recommendations' in data['data']['analysis']

    def test_portfolio_optimization_nonexistent_user(self, ninja_client):
        """Test portfolio optimization with non-existent user"""
        response = ninja_client.get("/portfolio/nonexistent_user/optimization")
        
        # Should handle gracefully
        assert response.status_code in [404, 400]

    def test_portfolio_diversification_endpoint(self, ninja_client):
        """Test portfolio diversification API endpoint"""
        response = ninja_client.get(f"/portfolio/{self.user_id}/diversification")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'data' in data
        assert 'diversification_analysis' in data['data']
        assert 'diversification' in data['data']['diversification_analysis']
        assert 'total_holdings' in data['data']['diversification_analysis']

    def test_portfolio_diversification_nonexistent_user(self, ninja_client):
        """Test portfolio diversification with non-existent user"""
        response = ninja_client.get("/portfolio/nonexistent_user/diversification")
        
        # Should handle gracefully
        assert response.status_code in [404, 400]

    def test_portfolio_risk_assessment_endpoint(self, ninja_client):
        """Test portfolio risk assessment API endpoint"""
        response = ninja_client.get(f"/portfolio/{self.user_id}/risk-assessment")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'data' in data
        assert 'risk_analysis' in data['data']
        assert 'risk_assessment' in data['data']['risk_analysis']
        assert 'portfolio_metrics' in data['data']['risk_analysis']

    def test_portfolio_risk_assessment_nonexistent_user(self, ninja_client):
        """Test portfolio risk assessment with non-existent user"""
        response = ninja_client.get("/portfolio/nonexistent_user/risk-assessment")
        
        # Should handle gracefully
        assert response.status_code in [404, 400] 