from ninja import Router, Schema
from typing import List, Optional, Dict, Any
from pydantic import Field
from decimal import Decimal
from functools import wraps
from cachetools import TTLCache

# =================
# AUTHENTICATION
# =================

# TODO: Implement proper Supabase JWT authentication
class MockUser:
    def __init__(self, id, email="test@example.com"):
        self.id = id
        self.email = email

async def get_current_user(request) -> MockUser:
    """Placeholder dependency to simulate getting a user from a JWT."""
    return MockUser(id="0b8a164c-8e81-4328-a28f-1555560b7952") # Example UUID

# --- ASYNC CACHING WRAPPER ---
def async_ttl_cache(ttl: int):
    """A wrapper to make cachetools.func.ttl_cache compatible with async functions."""
    def decorator(func):
        sync_cache = TTLCache(maxsize=128, ttl=ttl)
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key_args = [a for a in args if not isinstance(a, MockUser)]
            key_kwargs = {k: v for k, v in kwargs.items() if not isinstance(v, MockUser)}
            key = tuple(key_args) + tuple(sorted(key_kwargs.items()))
            try:
                return sync_cache[key]
            except KeyError:
                res = await func(*args, **kwargs)
                sync_cache[key] = res
                return res
        return wrapper
    return decorator

# =================
# DASHBOARD API
# =================

dashboard_api_router = Router()

# --- Pydantic Schemas for Dashboard ---

class KPIValue(Schema):
    value: Decimal
    sub_label: str
    delta: Optional[Decimal] = None
    delta_percent: Optional[Decimal] = Field(None, alias="deltaPercent")
    is_positive: bool

class OverviewResponse(Schema):
    market_value: KPIValue = Field(..., alias="marketValue")
    total_profit: KPIValue = Field(..., alias="totalProfit")
    irr: KPIValue
    passive_income: KPIValue = Field(..., alias="passiveIncome")

class AllocationRow(Schema):
    group_key: str = Field(..., alias="groupKey")
    value: Decimal
    invested: Decimal
    gain_value: Decimal = Field(..., alias="gainValue")
    gain_percent: Decimal = Field(..., alias="gainPercent")
    allocation: Decimal
    accent_color: str = Field(..., alias="accentColor")

class AllocationResponse(Schema):
    rows: List[AllocationRow]

class GainerLoserRow(Schema):
    logo_url: Optional[str] = Field(None, alias="logoUrl")
    name: str
    ticker: str
    value: Decimal
    change_percent: Decimal = Field(..., alias="changePercent")
    change_value: Decimal = Field(..., alias="changeValue")

class GainersLosersResponse(Schema):
    items: List[GainerLoserRow]

class DividendForecastItem(Schema):
    month: str
    amount: Decimal

class DividendForecastResponse(Schema):
    forecast: List[DividendForecastItem]
    next_12m_total: Decimal = Field(..., alias="next12mTotal")
    monthly_avg: Decimal = Field(..., alias="monthlyAvg")

class FxRate(Schema):
    pair: str
    rate: Decimal
    change: Decimal

class FxResponse(Schema):
    rates: List[FxRate]

# --- Dashboard Endpoints ---

@dashboard_api_router.get("/dashboard/overview", response=OverviewResponse, summary="Get Dashboard KPI Overview")
@async_ttl_cache(ttl=60)
async def get_dashboard_overview(request):
    return {
        "marketValue": {"value": "138214.02", "sub_label": "AU$138,477.40 invested", "is_positive": True},
        "totalProfit": {"value": "12257.01", "sub_label": "+AU$178.07 daily", "delta_percent": "8.9", "is_positive": True},
        "irr": {"value": "11.48", "sub_label": "-0.33% current holdings", "is_positive": False},
        "passiveIncome": {"value": "1.6", "sub_label": "AU$2,022.86 annually", "delta": "9.0", "is_positive": True}
    }

@dashboard_api_router.get("/dashboard/allocation", response=AllocationResponse, summary="Get Portfolio Allocation")
@async_ttl_cache(ttl=60)
async def get_portfolio_allocation(request, groupBy: str = "sector"):
    allocation_data = [
        {"groupKey": "Funds", "value": "51142.06", "invested": "57257.15", "gainValue": "3195.08", "gainPercent": "5.58", "allocation": "44.24", "accentColor": "blue"},
        {"groupKey": "Industrials", "value": "18729.62", "invested": "19470.87", "gainValue": "-1225.94", "gainPercent": "-6.3", "allocation": "14.27", "accentColor": "green"},
        {"groupKey": "Financials", "value": "14563.92", "invested": "13613.49", "gainValue": "10311.09", "gainPercent": "75.74", "allocation": "10.54", "accentColor": "purple"},
        {"groupKey": "Cash", "value": "11804.06", "invested": "11804.06", "gainValue": "0", "gainPercent": "0", "allocation": "8.54", "accentColor": "gray"},
        {"groupKey": "Healthcare", "value": "9797.59", "invested": "8463.80", "gainValue": "2275.97", "gainPercent": "26.89", "allocation": "7.09", "accentColor": "teal"},
    ]
    return {"rows": allocation_data}

@dashboard_api_router.get("/dashboard/gainers", response=GainersLosersResponse, summary="Get Top 5 Day Gainers")
@async_ttl_cache(ttl=60)
async def get_top_gainers(request, limit: int = 5):
    gainers_data = [
        {"name": "iShares Core S&P 500 AUD", "ticker": "IVV", "value": "29550.15", "changePercent": "0.9", "changeValue": "262.33"},
        {"name": "Vanguard US Total Market Shares Index ETF", "ticker": "VTS", "value": "14624.96", "changePercent": "0.95", "changeValue": "127.60"},
        {"name": "Hims & Hers Health, Inc", "ticker": "HIMS", "value": "1605.50", "changePercent": "5.16", "changeValue": "78.75"},
        {"name": "Betashares Nasdaq 100", "ticker": "NDQ", "value": "16966.95", "changePercent": "0.6", "changeValue": "101.70"},
        {"name": "Tasmia Ltd", "ticker": "TEA", "value": "4779.16", "changePercent": "1.88", "changeValue": "87.96"},
    ]
    return {"items": gainers_data}

@dashboard_api_router.get("/dashboard/losers", response=GainersLosersResponse, summary="Get Top 5 Day Losers")
@async_ttl_cache(ttl=60)
async def get_top_losers(request, limit: int = 5):
    losers_data = [
        {"name": "Arista Networks, Inc", "ticker": "ANET", "value": "3622.50", "changePercent": "-4.42", "changeValue": "-167.58"},
        {"name": "Brookside Energy Ltd", "ticker": "BRK", "value": "5983.29", "changePercent": "-3.48", "changeValue": "-216.20"},
        {"name": "Terawulf Inc", "ticker": "WULF", "value": "4222.46", "changePercent": "-2.6", "changeValue": "-115.04"},
        {"name": "Acrow Limited", "ticker": "ACF", "value": "5493.16", "changePercent": "-2.05", "changeValue": "-115.04"},
        {"name": "Nu Holdings Ltd.", "ticker": "NU", "value": "3537.02", "changePercent": "-0.82", "changeValue": "-29.30"},
    ]
    return {"items": losers_data}

@dashboard_api_router.get("/dashboard/dividend-forecast", response=DividendForecastResponse, summary="Get 12-Month Dividend Forecast")
@async_ttl_cache(ttl=3600)
async def get_dividend_forecast(request, months: int = 12):
    forecast_data = [
        {"month": "Jul", "amount": "619"}, {"month": "Aug", "amount": "290"}, {"month": "Sep", "amount": "150"},
        {"month": "Oct", "amount": "520"}, {"month": "Nov", "amount": "175"}, {"month": "Dec", "amount": "125"},
        {"month": "Jan", "amount": "167"},
    ]
    total = sum(Decimal(d['amount']) for d in forecast_data)
    avg = total / Decimal("12")
    return {"forecast": forecast_data, "next12mTotal": total, "monthlyAvg": avg}

@dashboard_api_router.get("/fx/latest", response=FxResponse, summary="Get Latest FX Rates")
@async_ttl_cache(ttl=300)
async def get_latest_fx_rates(request, base: str = "AUD"):
    fx_data = [
        {"pair": "USDAUD", "rate": "1.57", "change": "0.75"},
        {"pair": "EURAUD", "rate": "1.79", "change": "0.62"},
        {"pair": "GBPAUD", "rate": "2.09", "change": "0.48"},
    ]
    return {"rates": fx_data} 