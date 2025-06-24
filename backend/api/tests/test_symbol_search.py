from unittest.mock import patch, MagicMock
import os
from django.test import TestCase
from ninja.testing import TestClient

from ..api import api
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




class SymbolSearchRankingTest(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["NINJA_SKIP_REGISTRY"] = "True"
        cls.client = TestClient(api)

    def test_local_ranking(self):
        create_symbol("AAPL", "Apple Inc")
        create_symbol("AAL", "American Airlines")
        create_symbol("AAP", "Advance Auto Parts")

        response = self.client.get("/api/symbols/search?q=AA&limit=3")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        symbols = [r["symbol"] for r in data["results"]]
        self.assertEqual(symbols, ["AAL", "AAP", "AAPL"])

    @patch("api.views.get_alpha_vantage_service")
    def test_remote_result_ranking(self, mock_get_av):
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

        response = self.client.get("/api/symbols/search?q=AAPL&limit=2")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        symbols = [r["symbol"] for r in data["results"]]
        self.assertEqual(symbols, ["AAPL"])
