import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()
import pytest
from ninja.testing import TestClient
from unittest.mock import patch, MagicMock
from decimal import Decimal
from datetime import date

from ninja import NinjaAPI
from ..views import router as api_router
from ..dashboard_views import dashboard_api_router

test_api = NinjaAPI()
test_api.add_router("/", api_router)
test_api.add_router("/dashboard", dashboard_api_router)
from api.models import Transaction

client = TestClient(test_api)

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

@patch('api.dashboard_views.get_alpha_vantage_service')
@pytest.mark.django_db
def test_dashboard_overview(mock_get_av):
    mock_service = MagicMock()
    mock_service.get_global_quote.return_value = {
        'price': '100', 'change': '1', 'change_percent': '1'
    }
    mock_get_av.return_value = mock_service

    create_txn('AAPL', 10, 90)

    response = client.get("/api/dashboard/overview")
    assert response.status_code == 200
    data = response.json()
    assert 'marketValue' in data
    assert float(data['marketValue']['value']) > 0

@patch('api.dashboard_views.get_alpha_vantage_service')
@pytest.mark.django_db
def test_dashboard_allocation(mock_get_av):
    mock_service = MagicMock()
    mock_service.get_global_quote.return_value = {'price': '100', 'change': '1', 'change_percent': '1'}
    mock_get_av.return_value = mock_service

    create_txn('AAPL', 10, 90)

    response = client.get("/api/dashboard/allocation")
    assert response.status_code == 200
    data = response.json()
    assert 'rows' in data and len(data['rows']) == 1
    assert data['rows'][0]['groupKey'] == 'AAPL'

@patch('api.dashboard_views.get_alpha_vantage_service')
@pytest.mark.django_db
def test_dashboard_gainers(mock_get_av):
    mock_service = MagicMock()
    mock_service.get_global_quote.return_value = {'price': '100', 'change': '1', 'change_percent': '1'}
    mock_get_av.return_value = mock_service

    create_txn('AAPL', 10, 90)

    response = client.get("/api/dashboard/gainers")
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data and len(data['items']) == 1
    assert data['items'][0]['ticker'] == 'AAPL'

@patch('api.dashboard_views.get_alpha_vantage_service')
@pytest.mark.django_db
def test_dashboard_losers(mock_get_av):
    mock_service = MagicMock()
    mock_service.get_global_quote.return_value = {'price': '100', 'change': '-1', 'change_percent': '-1'}
    mock_get_av.return_value = mock_service

    create_txn('AAPL', 10, 90)

    response = client.get("/api/dashboard/losers")
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data and len(data['items']) == 1
    assert data['items'][0]['ticker'] == 'AAPL'

@patch('api.dashboard_views.get_alpha_vantage_service')
@pytest.mark.django_db
def test_dividend_forecast(mock_get_av):
    mock_service = MagicMock()
    mock_service.get_global_quote.return_value = {'price': '100', 'change': '1', 'change_percent': '1'}
    mock_get_av.return_value = mock_service

    response = client.get("/api/dashboard/dividend-forecast")
    assert response.status_code == 200
    data = response.json()
    assert 'forecast' in data
    assert 'next12mTotal' in data
    assert 'monthlyAvg' in data

