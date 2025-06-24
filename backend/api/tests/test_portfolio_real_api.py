import os
from decimal import Decimal
from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase

from api.models import Portfolio, Holding
from api.alpha_vantage_service import (
    AlphaVantageService,
    RateLimitError,
    get_alpha_vantage_service,
)
from api.views import _calculate_current_portfolio_value
from api.services.portfolio_benchmarking import calculate_enhanced_portfolio_performance


class RealAlphaVantagePortfolioTest(TestCase):
    """Integration tests using real Alpha Vantage data."""

    def setUp(self):
        self.api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not self.api_key:
            self.skipTest("ALPHA_VANTAGE_API_KEY not set")

        self.user_id = "real_api_user"
        self.portfolio = Portfolio.objects.create(
            user_id=self.user_id, cash_balance=Decimal("500.00")
        )
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal("2"),
            purchase_price=Decimal("150.00"),
            purchase_date=date.today() - timedelta(days=45),
        )

    def test_portfolio_summary_and_pnl(self):
        """Verify portfolio summary and PnL with real data."""
        current_value = _calculate_current_portfolio_value(self.portfolio)
        cost_basis = (
            sum(h.shares * h.purchase_price for h in self.portfolio.holdings.all())
            + self.portfolio.cash_balance
        )
        pnl = current_value - cost_basis

        self.assertGreater(current_value, 0)
        self.assertIsInstance(pnl, Decimal)

    def test_historical_value_calculation(self):
        """Verify historical value calculation returns data."""
        result = calculate_enhanced_portfolio_performance(
            self.user_id, period="1M", benchmark="^GSPC"
        )
        self.assertIn("portfolio_performance", result)
        self.assertIn("benchmark_performance", result)
        self.assertGreater(len(result["portfolio_performance"]), 0)


class RateLimitMockTest(TestCase):
    """Ensure rate limit network failures are handled."""

    @patch.dict(os.environ, {"ALPHA_VANTAGE_API_KEY": "dummy_key"})
    @patch("api.alpha_vantage_service.AlphaVantageService._make_single_request")
    def test_rate_limit_error_handled(self, mock_request):
        mock_request.side_effect = RateLimitError("limit")
        service = AlphaVantageService()
        result = service.get_global_quote("AAPL")
        self.assertEqual(result.get("error"), "rate_limit_exceeded")

