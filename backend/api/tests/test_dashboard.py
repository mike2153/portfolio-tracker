import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()
import pytest
from decimal import Decimal
from datetime import date
# Import the main API instance and models

# Use the main API instance instead of creating a new one
from ..api import api
from api.models import Transaction

# Use consistent test user ID
USER_ID = "test_user_123"

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
def test_portfolio_overview(ninja_client):
    """Test portfolio overview with real Alpha Vantage API calls"""
    # Create test transaction
    create_txn('AAPL', 10, 150)

    response = ninja_client.get(f"/portfolios/{USER_ID}")
    assert response.status_code == 200
    data = response.json()
    
    # Main API uses success_response wrapper
    assert 'ok' in data
    assert data['ok'] == True
    assert 'data' in data
    
    portfolio_data = data['data']
    assert 'holdings' in portfolio_data
    assert 'summary' in portfolio_data
    assert 'total_value' in portfolio_data['summary']

@pytest.mark.django_db  
def test_portfolio_performance(ninja_client):
    """Test portfolio performance with real Alpha Vantage API calls"""
    create_txn('AAPL', 10, 150)

    response = ninja_client.get(f"/portfolios/{USER_ID}/performance?period=1Y&benchmark=^GSPC")
    # Accept either 200 (success) or 400 (benchmark data unavailable) as valid test outcomes
    assert response.status_code in [200, 400]
    
    if response.status_code == 200:
        data = response.json()
        # Should have performance data structure
        assert 'ok' in data
        assert 'data' in data

@pytest.mark.django_db
def test_portfolio_optimization(ninja_client):
    """Test portfolio optimization endpoint"""
    create_txn('AAPL', 10, 150)
    create_txn('MSFT', 5, 250)

    response = ninja_client.get(f"/portfolios/{USER_ID}/optimization")
    assert response.status_code == 200
    data = response.json()
    
    assert 'ok' in data
    assert 'data' in data

@pytest.mark.django_db
def test_portfolio_risk_assessment(ninja_client):
    """Test portfolio risk assessment endpoint"""
    create_txn('AAPL', 10, 150)
    create_txn('GOOGL', 3, 200)

    response = ninja_client.get(f"/portfolios/{USER_ID}/risk-assessment")
    assert response.status_code == 200
    data = response.json()
    
    assert 'ok' in data
    assert 'data' in data

@pytest.mark.django_db
def test_portfolio_diversification(ninja_client):
    """Test portfolio diversification endpoint"""
    create_txn('AAPL', 10, 150)
    create_txn('MSFT', 5, 250)

    response = ninja_client.get(f"/portfolios/{USER_ID}/diversification")
    assert response.status_code == 200
    data = response.json()
    
    assert 'ok' in data
    assert 'data' in data

@pytest.mark.django_db
def test_fx_latest(ninja_client):
    """Test the FX latest endpoint."""
    response = ninja_client.get("/fx/latest")
    assert response.status_code == 200
    data = response.json()
    
    assert 'ok' in data
    assert data['ok'] == True
    assert 'data' in data
    assert "rates" in data['data']
    assert len(data['data']["rates"]) > 0

@pytest.mark.django_db
def test_stock_quote(ninja_client):
    """Test getting a real stock quote"""
    response = ninja_client.get("/stocks/AAPL/quote")
    assert response.status_code == 200
    data = response.json()
    
    assert 'ok' in data
    assert data['ok'] == True
    assert 'data' in data
    assert 'symbol' in data['data']
    assert data['data']['symbol'] == 'AAPL'

@pytest.mark.django_db
def test_stock_overview(ninja_client):
    """Test getting stock company overview"""
    response = ninja_client.get("/stocks/AAPL/overview")
    assert response.status_code == 200
    data = response.json()
    
    assert 'ok' in data
    assert data['ok'] == True
    assert 'data' in data
    assert 'symbol' in data['data']
    assert data['data']['symbol'] == 'AAPL'
