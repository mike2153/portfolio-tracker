import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()
import pytest
from ninja.testing import TestClient
from decimal import Decimal
from datetime import date
# Import the main API instance and models

# Use the main API instance instead of creating a new one
from ..api import api
from api.models import Transaction

client = TestClient(api)

USER_ID = "0b8a164c-8e81-4328-a28f-1555560b7952"

def create_txn(ticker: str, shares: int, price: int):
    return Transaction.objects.create(
        user_id=USER_ID,
        transaction_type="BUY",
        ticker=ticker,
        company_name=ticker,
        shares=Decimal(str(shares)),
        price_per_share=Decimal(str(price)),
        transaction_date=date.today(),
        total_amount=Decimal(str(shares * price))
    )

@pytest.mark.django_db
def test_dashboard_overview():
    """Test dashboard overview with real Alpha Vantage API calls"""
    # Create test transaction
    create_txn('AAPL', 10, 90)

    response = client.get("/api/dashboard/overview")
    assert response.status_code == 200
    data = response.json()
    assert 'marketValue' in data
    # Since we're using real API, market value should be calculated based on real current price
    assert 'value' in data['marketValue']

@pytest.mark.django_db
def test_dashboard_allocation():
    """Test dashboard allocation with real Alpha Vantage API calls"""
    create_txn('AAPL', 10, 90)

    response = client.get("/api/dashboard/allocation")
    assert response.status_code == 200
    data = response.json()
    assert 'rows' in data
    # We should have allocation data for AAPL
    if len(data['rows']) > 0:
        assert any(row['groupKey'] == 'AAPL' for row in data['rows'])

@pytest.mark.django_db
def test_dashboard_gainers():
    """Test dashboard gainers with real Alpha Vantage API calls"""
    create_txn('AAPL', 10, 90)
    # Add another stock to have variety in gainers/losers
    create_txn('MSFT', 5, 200)

    response = client.get("/api/dashboard/gainers")
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    # Real API may or may not show gainers depending on actual stock performance

@pytest.mark.django_db
def test_dashboard_losers():
    """Test dashboard losers with real Alpha Vantage API calls"""
    create_txn('AAPL', 10, 90)
    create_txn('GOOGL', 3, 150)

    response = client.get("/api/dashboard/losers")
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    # Real API may or may not show losers depending on actual stock performance

@pytest.mark.django_db
def test_dividend_forecast():
    """Test dividend forecast with real Alpha Vantage API calls"""
    # Create transactions for dividend-paying stocks
    create_txn('AAPL', 10, 90)
    create_txn('MSFT', 5, 200)

    response = client.get("/api/dashboard/dividend-forecast")
    assert response.status_code == 200
    data = response.json()
    assert 'forecast' in data
    assert 'next12mTotal' in data
    assert 'monthlyAvg' in data

@pytest.mark.django_db
def test_fx_latest():
    """Test the FX latest endpoint."""
    response = client.get("/api/fx/latest")
    assert response.status_code == 200
    data = response.json()
    assert "rates" in data
    assert len(data["rates"]) > 0
    assert data["rates"][0]["pair"] == "USDAUD"
