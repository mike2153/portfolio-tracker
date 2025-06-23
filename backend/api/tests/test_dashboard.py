import pytest
from ninja.testing import TestClient
from api.api import api

client = TestClient(api)

@pytest.mark.django_db
def test_dashboard_overview():
    """Test the dashboard overview endpoint."""
    response = client.get("/api/dashboard/overview")
    assert response.status_code == 200
    data = response.json()
    assert 'marketValue' in data
    assert 'totalProfit' in data
    assert 'irr' in data
    assert 'passiveIncome' in data
    assert data['marketValue']['value'] == "138214.02"

@pytest.mark.django_db
def test_dashboard_allocation():
    """Test the dashboard allocation endpoint."""
    response = client.get("/api/dashboard/allocation")
    assert response.status_code == 200
    data = response.json()
    assert 'rows' in data
    assert len(data['rows']) > 0
    assert data['rows'][0]['groupKey'] == "Funds"

@pytest.mark.django_db
def test_dashboard_gainers():
    """Test the dashboard gainers endpoint."""
    response = client.get("/api/dashboard/gainers")
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    assert len(data['items']) > 0
    assert data['items'][0]['ticker'] == "IVV"

@pytest.mark.django_db
def test_dashboard_losers():
    """Test the dashboard losers endpoint."""
    response = client.get("/api/dashboard/losers")
    assert response.status_code == 200
    data = response.json()
    assert 'items' in data
    assert len(data['items']) > 0
    assert data['items'][0]['ticker'] == "ANET"

@pytest.mark.django_db
def test_dividend_forecast():
    """Test the dividend forecast endpoint."""
    response = client.get("/api/dashboard/dividend-forecast")
    assert response.status_code == 200
    data = response.json()
    assert 'forecast' in data
    assert 'next12mTotal' in data
    assert 'monthlyAvg' in data
    assert len(data['forecast']) > 0

@pytest.mark.django_db
def test_fx_latest():
    """Test the FX latest endpoint."""
    response = client.get("/api/fx/latest")
    assert response.status_code == 200
    data = response.json()
    assert 'rates' in data
    assert len(data['rates']) > 0
    assert data['rates'][0]['pair'] == "USDAUD" 