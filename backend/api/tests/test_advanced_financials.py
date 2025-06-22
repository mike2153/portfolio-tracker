# backend/api/tests/test_advanced_financials.py
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.test import Client
from ..api import api
from ..services.metrics_calculator import calculate_advanced_metrics

# Load mock data from a separate file or define inline
# For simplicity, defining inline here.
MOCK_OVERVIEW = {
    "Symbol": "TEST", "MarketCapitalization": "1000000000", "EPS": "5.5",
    "PERatio": "20", "PriceToBookRatio": "3", "PEGRatio": "1.5",
    "DividendYield": "0.02", "Beta": "1.1", "SharesOutstanding": "100000000",
    "AnalystTargetPrice": "110",
}
MOCK_INCOME_ANNUAL = {'annualReports': [
    {"fiscalDateEnding": "2023-12-31", "totalRevenue": "200000000", "grossProfit": "80000000", "operatingIncome": "40000000", "netIncome": "20000000", "eps": "2.0", "ebitda": "50000000", "ebit": "40000000", "interestExpense": "5000000"},
    {"fiscalDateEnding": "2022-12-31", "totalRevenue": "180000000", "netIncome": "18000000", "eps": "1.8"},
    # ... add 3 more years for 5-year CAGR
]}
MOCK_INCOME_QUARTERLY = {'quarterlyReports': [
    {"fiscalDateEnding": "2023-12-31", "totalRevenue": "50000000", "netIncome": "5000000", "ebitda": "12000000", "ebit": "10000000", "operatingCashflow": "15000000", "capitalExpenditures": "3000000"},
    {"fiscalDateEnding": "2023-09-30", "totalRevenue": "50000000", "netIncome": "5000000", "ebitda": "12000000", "ebit": "10000000", "operatingCashflow": "15000000", "capitalExpenditures": "3000000"},
    {"fiscalDateEnding": "2023-06-30", "totalRevenue": "50000000", "netIncome": "5000000", "ebitda": "12000000", "ebit": "10000000", "operatingCashflow": "15000000", "capitalExpenditures": "3000000"},
    {"fiscalDateEnding": "2023-03-31", "totalRevenue": "50000000", "netIncome": "5000000", "ebitda": "14000000", "ebit": "12000000", "operatingCashflow": "15000000", "capitalExpenditures": "3000000"},
]}
MOCK_BALANCE_ANNUAL = {'annualReports': [
    {"fiscalDateEnding": "2023-12-31", "totalAssets": "500000000", "totalCurrentAssets": "150000000", "totalLiabilities": "250000000", "totalCurrentLiabilities": "75000000", "totalShareholderEquity": "250000000", "cashAndCashEquivalentsAtCarryingValue": "20000000"},
    {"fiscalDateEnding": "2022-12-31", "totalAssets": "480000000", "totalShareholderEquity": "240000000"},
]}
MOCK_BALANCE_QUARTERLY = {'quarterlyReports': [{}]} # Not heavily used in current calcs
MOCK_CASH_FLOW_ANNUAL = {'annualReports': [
    {"fiscalDateEnding": "2023-12-31", "operatingCashflow": "60000000", "capitalExpenditures": "12000000", "dividendPayout": "10000000"},
]}
MOCK_CASH_FLOW_QUARTERLY = MOCK_INCOME_QUARTERLY # Re-using for simplicity

class AdvancedMetricsCalculatorTest(TestCase):
    def test_full_calculation(self):
        """Unit test for the main metrics calculation function with mock data."""
        metrics = calculate_advanced_metrics(
            overview=MOCK_OVERVIEW,
            income_annual=MOCK_INCOME_ANNUAL['annualReports'],
            income_quarterly=MOCK_INCOME_QUARTERLY['quarterlyReports'],
            balance_annual=MOCK_BALANCE_ANNUAL['annualReports'],
            balance_quarterly=MOCK_BALANCE_QUARTERLY['quarterlyReports'],
            cash_flow_annual=MOCK_CASH_FLOW_ANNUAL['annualReports'],
            cash_flow_quarterly=MOCK_CASH_FLOW_QUARTERLY['quarterlyReports']
        )
        
        # Valuation assertions
        self.assertAlmostEqual(metrics['valuation']['pe_ratio'], 20.0)
        self.assertAlmostEqual(metrics['valuation']['market_capitalization'], 1000000000)
        self.assertAlmostEqual(metrics['valuation']['pb_ratio'], 4.0)

        # Health assertions
        self.assertAlmostEqual(metrics['financial_health']['current_ratio'], 2.0)
        self.assertAlmostEqual(metrics['financial_health']['debt_to_equity_ratio'], 1.0)
        self.assertAlmostEqual(metrics['financial_health']['interest_coverage_ratio'], 8.8) # (44M TTM EBIT / 5M annual interest)
        self.assertAlmostEqual(metrics['financial_health']['free_cash_flow_ttm'], 48000000) # (60M TTM OCF - 12M TTM Capex)
        
        # Performance assertions
        self.assertAlmostEqual(metrics['performance']['revenue_growth_yoy'], 0.111, places=3)
        self.assertAlmostEqual(metrics['performance']['return_on_equity_ttm'], 0.0816, places=4) # (20M TTM NetIncome / 245M Avg Equity)
        
        # Profitability assertions
        self.assertAlmostEqual(metrics['profitability']['net_profit_margin'], 10.0)

        # Dividend assertions
        self.assertAlmostEqual(metrics['dividends']['dividend_payout_ratio'], 50.0)

class AdvancedFinancialsEndpointTest(TestCase):
    def setUp(self):
        self.client = Client()  # Use Django's Client

    @patch('api.views.get_alpha_vantage_service')
    def test_advanced_financials_endpoint_success(self, mock_get_service):
        """Integration test for the advanced_financials endpoint on success."""
        # Setup mock service
        mock_av_service = MagicMock()
        mock_av_service.get_company_overview.return_value = MOCK_OVERVIEW
        mock_av_service.get_income_statement.side_effect = [MOCK_INCOME_ANNUAL, MOCK_INCOME_QUARTERLY]
        mock_av_service.get_balance_sheet.side_effect = [MOCK_BALANCE_ANNUAL, MOCK_BALANCE_QUARTERLY]
        mock_av_service.get_cash_flow.side_effect = [MOCK_CASH_FLOW_ANNUAL, MOCK_CASH_FLOW_QUARTERLY]
        mock_get_service.return_value = mock_av_service

        # Make request
        response = self.client.get("/stocks/TEST/advanced_financials")

        # Assertions
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('valuation', data)
        self.assertIn('financial_health', data)
        self.assertAlmostEqual(data['valuation']['pe_ratio'], 20.0)
        self.assertAlmostEqual(data['financial_health']['current_ratio'], 2.0)

    @patch('api.views.get_alpha_vantage_service')
    def test_advanced_financials_endpoint_not_found(self, mock_get_service):
        """Test endpoint when the symbol is not found or AV service returns empty."""
        mock_av_service = MagicMock()
        mock_av_service.get_company_overview.return_value = {} # Simulate not found
        mock_get_service.return_value = mock_av_service

        response = self.client.get("/stocks/FAKESYMBOL/advanced_financials")

        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertEqual(data['ok'], False)
        self.assertIn("Could not retrieve fundamental data", data['error']) 