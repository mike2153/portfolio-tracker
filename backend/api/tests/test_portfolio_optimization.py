from unittest.mock import patch, MagicMock
from django.test import TestCase, Client
from decimal import Decimal
from datetime import date

from ..api import api
from ..models import Portfolio, Holding
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
        self.user_id = "test_user_opt_123"
        self.portfolio = Portfolio.objects.create(
            user_id=self.user_id, 
            name="Test Optimization Portfolio",
            cash_balance=Decimal("10000.00")
        )
        
        # Create diverse holdings for testing
        self.holdings = [
            Holding.objects.create(
                portfolio=self.portfolio,
                ticker="AAPL",
                company_name="Apple Inc",
                shares=Decimal("10"),
                purchase_price=Decimal("150.00"),
                purchase_date=date.today(),
                exchange="NASDAQ"
            ),
            Holding.objects.create(
                portfolio=self.portfolio,
                ticker="JNJ",
                company_name="Johnson & Johnson",
                shares=Decimal("20"),
                purchase_price=Decimal("160.00"),
                purchase_date=date.today(),
                exchange="NYSE"
            ),
            Holding.objects.create(
                portfolio=self.portfolio,
                ticker="JPM",
                company_name="JPMorgan Chase",
                shares=Decimal("15"),
                purchase_price=Decimal("140.00"),
                purchase_date=date.today(),
                exchange="NYSE"
            )
        ]
        
        self.optimization_service = PortfolioOptimizationService()

    def test_analyze_portfolio_no_holdings(self):
        """Test portfolio analysis with no holdings"""
        result = self.optimization_service.analyze_portfolio("empty_user")
        
        self.assertIn('error', result)
        self.assertEqual(result['error'], 'No holdings found in portfolio')
        self.assertIn('recommendations', result)

    def test_analyze_portfolio_nonexistent_user(self):
        """Test portfolio analysis for non-existent user"""
        with self.assertRaises(ValueError):
            self.optimization_service.analyze_portfolio("nonexistent_user")

    @patch('api.services.portfolio_optimization.get_alpha_vantage_service')
    def test_get_holdings_market_data(self, mock_get_av):
        """Test getting market data for holdings"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        
        # Mock quotes
        mock_av_service.get_global_quote.side_effect = [
            {'price': '155.00', 'symbol': 'AAPL'},
            {'price': '165.00', 'symbol': 'JNJ'},
            {'price': '145.00', 'symbol': 'JPM'}
        ]
        
        # Mock overviews
        mock_av_service.get_company_overview.side_effect = [
            {'Beta': '1.2', 'MarketCapitalization': '3000000000000', 'PERatio': '25', 'DividendYield': '0.005'},
            {'Beta': '0.8', 'MarketCapitalization': '400000000000', 'PERatio': '15', 'DividendYield': '0.025'},
            {'Beta': '1.1', 'MarketCapitalization': '500000000000', 'PERatio': '12', 'DividendYield': '0.030'}
        ]
        
        mock_get_av.return_value = mock_av_service
        
        # Create new service instance to use the mock
        optimization_service = PortfolioOptimizationService()
        
        holdings_data = optimization_service._get_holdings_market_data(self.holdings)
        
        self.assertEqual(len(holdings_data), 3)
        
        # Check AAPL data
        aapl_data = next(h for h in holdings_data if h.ticker == 'AAPL')
        self.assertEqual(aapl_data.ticker, 'AAPL')
        self.assertEqual(aapl_data.beta, 1.2)
        self.assertEqual(aapl_data.sector, 'Technology')
        self.assertEqual(aapl_data.current_value, 1550.0)  # 10 * 155
        
        # Check that weights sum to 1 (approximately)
        total_weight = sum(h.weight for h in holdings_data)
        self.assertAlmostEqual(total_weight, 1.0, places=2)

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
        
        metrics = self.optimization_service._calculate_portfolio_metrics(holdings_data)
        
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
        
        diversification = self.optimization_service._analyze_diversification(holdings_data)
        
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
        
        risk_assessment = self.optimization_service._assess_portfolio_risk(
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
        
        recommendations = self.optimization_service._generate_optimization_recommendations(
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
        
        expected_return = self.optimization_service._estimate_expected_return('AAPL', quote, overview)
        
        self.assertGreater(expected_return, 0)
        self.assertLessEqual(expected_return, 0.20)

    def test_estimate_volatility(self):
        """Test volatility estimation"""
        overview = {'Beta': '1.2'}
        
        volatility = self.optimization_service._estimate_volatility('AAPL', overview)
        
        self.assertGreater(volatility, 0)
        self.assertLessEqual(volatility, 0.50)

    def test_classify_market_cap(self):
        """Test market cap classification"""
        # Test different market cap sizes
        self.assertEqual(self.optimization_service._classify_market_cap('300000000000'), 'Mega Cap')
        self.assertEqual(self.optimization_service._classify_market_cap('50000000000'), 'Large Cap')
        self.assertEqual(self.optimization_service._classify_market_cap('5000000000'), 'Mid Cap')
        self.assertEqual(self.optimization_service._classify_market_cap('1000000000'), 'Small Cap')
        self.assertEqual(self.optimization_service._classify_market_cap('100000000'), 'Micro Cap')
        self.assertEqual(self.optimization_service._classify_market_cap(None), 'Unknown')
        self.assertEqual(self.optimization_service._classify_market_cap('None'), 'Unknown')

class PortfolioOptimizationAPITest(TestCase):
    def setUp(self):
        """Set up test client and data"""
        self.client = Client()  # Use Django's Client
        self.user_id = "test_user_opt_api_456"
        self.portfolio = Portfolio.objects.create(
            user_id=self.user_id, 
            name="Test API Portfolio"
        )
        
        # Create test holdings
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc",
            shares=Decimal("10"),
            purchase_price=Decimal("150.00"),
            purchase_date=date.today()
        )

    @patch('api.services.portfolio_optimization.get_alpha_vantage_service')
    def test_portfolio_optimization_endpoint(self, mock_get_av):
        """Test the portfolio optimization API endpoint"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_av_service.get_global_quote.return_value = {'price': '155.00', 'symbol': 'AAPL'}
        mock_av_service.get_company_overview.return_value = {
            'Beta': '1.2', 'MarketCapitalization': '3000000000000', 
            'PERatio': '25', 'DividendYield': '0.005'
        }
        mock_get_av.return_value = mock_av_service
        
        response = self.client.get(f"/portfolios/{self.user_id}/optimization")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("analysis", data)
        self.assertIn("status", data)
        self.assertEqual(data["status"], "success")
        
        analysis = data["analysis"]
        self.assertIn("portfolio_metrics", analysis)
        self.assertIn("holdings_analysis", analysis)
        self.assertIn("diversification", analysis)
        self.assertIn("risk_assessment", analysis)
        self.assertIn("optimization_recommendations", analysis)

    @patch('api.services.portfolio_optimization.get_alpha_vantage_service')
    def test_portfolio_risk_assessment_endpoint(self, mock_get_av):
        """Test the portfolio risk assessment API endpoint"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_av_service.get_global_quote.return_value = {'price': '155.00', 'symbol': 'AAPL'}
        mock_av_service.get_company_overview.return_value = {
            'Beta': '1.2', 'MarketCapitalization': '3000000000000'
        }
        mock_get_av.return_value = mock_av_service
        
        response = self.client.get(f"/portfolios/{self.user_id}/risk-assessment")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("risk_analysis", data)
        self.assertIn("status", data)
        self.assertEqual(data["status"], "success")
        
        risk_analysis = data["risk_analysis"]
        self.assertIn("portfolio_metrics", risk_analysis)
        self.assertIn("risk_assessment", risk_analysis)
        self.assertIn("diversification", risk_analysis)

    @patch('api.services.portfolio_optimization.get_alpha_vantage_service')
    def test_portfolio_diversification_endpoint(self, mock_get_av):
        """Test the portfolio diversification API endpoint"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_av_service.get_global_quote.return_value = {'price': '155.00', 'symbol': 'AAPL'}
        mock_av_service.get_company_overview.return_value = {
            'Beta': '1.2', 'MarketCapitalization': '3000000000000'
        }
        mock_get_av.return_value = mock_av_service
        
        response = self.client.get(f"/portfolios/{self.user_id}/diversification")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("diversification_analysis", data)
        self.assertIn("status", data)
        self.assertEqual(data["status"], "success")
        
        diversification_analysis = data["diversification_analysis"]
        self.assertIn("diversification", diversification_analysis)
        self.assertIn("holdings_analysis", diversification_analysis)
        self.assertIn("total_holdings", diversification_analysis)

    def test_portfolio_optimization_nonexistent_user(self):
        """Test portfolio optimization for non-existent user"""
        response = self.client.get("/portfolios/nonexistent_user/optimization")
        
        self.assertEqual(response.status_code, 404)

    def test_portfolio_risk_assessment_nonexistent_user(self):
        """Test portfolio risk assessment for non-existent user"""
        response = self.client.get("/portfolios/nonexistent_user/risk-assessment")
        
        self.assertEqual(response.status_code, 404)

    def test_portfolio_diversification_nonexistent_user(self):
        """Test portfolio diversification for non-existent user"""
        response = self.client.get("/portfolios/nonexistent_user/diversification")
        
        self.assertEqual(response.status_code, 404) 