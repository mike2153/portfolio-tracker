from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Any

import pytest
from unittest.mock import patch, MagicMock

from django.test import TestCase

from backend.api.models import Portfolio, Holding, Transaction
from backend.api.services.portfolio_benchmarking import (
    calculate_enhanced_portfolio_performance,
)


class RebasedBenchmarkTest(TestCase):
    """Validate that benchmark series is correctly rebased to the portfolio start value."""

    def setUp(self):
        self.user_id = "rebased_benchmark_user"
        # Clean up in case previous runs left data around
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Rebased Test Portfolio")

        # Add a single AAPL holding 30 days ago
        Holding.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal("2"),
            purchase_price=Decimal("150.00"),
            purchase_date=date.today() - timedelta(days=30),
        )

        # Corresponding transaction
        Transaction.objects.create(
            user_id=self.user_id,
            transaction_type="BUY",
            ticker="AAPL",
            company_name="Apple Inc.",
            shares=Decimal("2"),
            price_per_share=Decimal("150.00"),
            transaction_date=date.today() - timedelta(days=30),
            total_amount=Decimal("300.00"),
        )

    @staticmethod
    def _fake_daily_adjusted(symbol: str, *args, **kwargs) -> Dict[str, Any]:
        """Return a small deterministic price series suitable for tests."""
        # Generate 35 days of data so we cover the 1-month period
        today = date.today()
        data = []
        base_price = 100 if symbol == "SPY" else 150  # simple differentiation
        for delta in range(35):
            d = today - timedelta(days=delta)
            price = base_price + (35 - delta)  # decreasing price backwards in time
            data.append(
                {
                    "date": d.strftime("%Y-%m-%d"),
                    "open": price,
                    "high": price,
                    "low": price,
                    "close": price,
                    "adjusted_close": price,
                    "volume": 1_000_000,
                    "dividend_amount": 0,
                    "split_coefficient": 1,
                }
            )
        # Oldest first as expected by service implementation
        data = list(reversed(data))
        return {"symbol": symbol, "data": data}

    @patch("backend.api.services.portfolio_benchmarking.get_alpha_vantage_service")
    def test_rebased_benchmark_series_starts_at_same_value(self, mock_av_service):
        """Benchmark value on first chart date should equal portfolio value."""
        fake_service = MagicMock()
        fake_service.get_daily_adjusted.side_effect = self._fake_daily_adjusted
        fake_service.get_global_quote.return_value = {"price": 170}
        mock_av_service.return_value = fake_service

        result = calculate_enhanced_portfolio_performance(
            user_id=self.user_id, period="1M", benchmark="SPY", rebased=True
        )

        portfolio_series = result["portfolio_performance"]
        benchmark_series = result["benchmark_performance"]

        # Ensure both series have at least one data point
        self.assertGreater(len(portfolio_series), 0)
        self.assertGreater(len(benchmark_series), 0)

        # The first values should match (rebased)
        first_portfolio_val = portfolio_series[0]["total_value"]
        first_benchmark_val = benchmark_series[0]["total_value"]
        self.assertAlmostEqual(first_portfolio_val, first_benchmark_val, places=2)

        # Returns should also start at 0
        self.assertEqual(portfolio_series[0]["performance_return"], 0)
        self.assertEqual(benchmark_series[0]["performance_return"], 0) 