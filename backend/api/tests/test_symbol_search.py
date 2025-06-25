from unittest.mock import patch, MagicMock
import pytest
from django.test import TestCase

from ..models import StockSymbol


def create_symbol(symbol: str, name: str):
    return StockSymbol.objects.create(
        symbol=symbol,
        name=name,
        exchange_code="NAS",
        exchange_name="NASDAQ",
        currency="USD",
        country="USA",
        type="Equity",
        is_active=True,
    )


@pytest.mark.django_db
class SymbolSearchRankingTest:
    def setup_method(self):
        """Clean up any existing symbols before each test."""
        StockSymbol.objects.all().delete()

    def test_local_ranking(self, ninja_client):
        create_symbol("AAPL", "Apple Inc")
        create_symbol("AAL", "American Airlines")
        create_symbol("AAP", "Advance Auto Parts")

        response = ninja_client.get("/api/symbols/search?q=AA&limit=3")
        assert response.status_code == 200
        data = response.json()
        symbols = [r["symbol"] for r in data["results"]]
        assert symbols == ["AAL", "AAP", "AAPL"]

    @patch("api.views.get_alpha_vantage_service")
    def test_remote_result_ranking(self, mock_get_av, ninja_client):
        create_symbol("AAL", "American Airlines")
        mock_service = MagicMock()
        mock_service.symbol_search.return_value = {
            "bestMatches": [
                {
                    "1. symbol": "AAPL",
                    "2. name": "Apple Inc",
                    "3. type": "Equity",
                    "4. region": "United States",
                    "8. currency": "USD",
                }
            ]
        }
        mock_get_av.return_value = mock_service

        response = ninja_client.get("/api/symbols/search?q=AAPL&limit=2")
        assert response.status_code == 200
        data = response.json()
        symbols = [r["symbol"] for r in data["results"]]
        assert symbols == ["AAPL"]
