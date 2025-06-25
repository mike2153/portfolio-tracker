from ninja import Router, Schema
from typing import List, Optional, Dict, Any
from pydantic import Field
from decimal import Decimal
from functools import wraps
from cachetools import TTLCache
from collections import defaultdict
from asgiref.sync import sync_to_async
from datetime import date, timedelta
from .models import Transaction, DividendPayment
from .alpha_vantage_service import get_alpha_vantage_service
from .auth import SupabaseUser, get_current_user, require_auth

# =================
# AUTHENTICATION
# =================

# TODO: Proper Supabase JWT authentication is handled in auth.py

# --- ASYNC CACHING WRAPPER ---
def async_ttl_cache(ttl: int):
    """A wrapper to make cachetools.func.ttl_cache compatible with async functions."""
    def decorator(func):
        sync_cache = TTLCache(maxsize=128, ttl=ttl)
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key_args = [a for a in args if not isinstance(a, SupabaseUser)]
            key_kwargs = {k: v for k, v in kwargs.items() if not isinstance(v, SupabaseUser)}
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

@dashboard_api_router.get("/overview", response=OverviewResponse, summary="Get Dashboard KPI Overview")
@async_ttl_cache(ttl=1800)
@require_auth
async def get_dashboard_overview(request):
    print(f"[DASHBOARD DEBUG] get_dashboard_overview called for request: {request}")
    user = await get_current_user(request)
    print(f"[DASHBOARD DEBUG] User retrieved: {user.id if user else 'None'}")
    transactions = await sync_to_async(list)(Transaction.objects.filter(user_id=user.id))
    print(f"[DASHBOARD DEBUG] Found {len(transactions)} transactions for user")

    holdings = defaultdict(Decimal)
    invested = defaultdict(Decimal)

    for txn in transactions:
        print(f"[DASHBOARD DEBUG] Processing transaction: {txn.transaction_type} {txn.shares} shares of {txn.ticker}")
        if txn.transaction_type == 'BUY':
            holdings[txn.ticker] += txn.shares
            invested[txn.ticker] += txn.total_amount
        elif txn.transaction_type == 'SELL':
            holdings[txn.ticker] -= txn.shares
            invested[txn.ticker] -= txn.total_amount

    av_service = get_alpha_vantage_service()
    market_value = Decimal('0')
    for ticker, shares in holdings.items():
        if shares <= 0:
            continue
        quote = await sync_to_async(av_service.get_global_quote)(ticker)
        price = Decimal(str(quote.get('price', '0'))) if quote else Decimal('0')
        market_value += shares * price

    invested_total = sum(invested.values())
    profit = market_value - invested_total
    delta_percent = (profit / invested_total * Decimal('100')) if invested_total != 0 else Decimal('0')

    return {
        "marketValue": {"value": str(round(market_value, 2)), "sub_label": f"AU${round(invested_total,2)} invested", "is_positive": market_value >= invested_total},
        "totalProfit": {"value": str(round(profit, 2)), "sub_label": "", "deltaPercent": str(round(delta_percent, 2)), "is_positive": profit >= 0},
        "irr": {"value": "0", "sub_label": "", "is_positive": profit >= 0},
        "passiveIncome": {"value": "0", "sub_label": "", "is_positive": False}
    }

@dashboard_api_router.get("/allocation", response=AllocationResponse, summary="Get Portfolio Allocation")
@async_ttl_cache(ttl=1800)
@require_auth
async def get_portfolio_allocation(request, groupBy: str = "sector"):
    print(f"[DASHBOARD DEBUG] get_portfolio_allocation called with groupBy: {groupBy}")
    user = await get_current_user(request)
    print(f"[DASHBOARD DEBUG] User retrieved for allocation: {user.id if user else 'None'}")
    transactions = await sync_to_async(list)(Transaction.objects.filter(user_id=user.id))
    print(f"[DASHBOARD DEBUG] Allocation: Found {len(transactions)} transactions for user")

    holdings = defaultdict(Decimal)
    invested = defaultdict(Decimal)

    for txn in transactions:
        print(f"[DASHBOARD DEBUG] Allocation: Processing transaction: {txn.transaction_type} {txn.shares} shares of {txn.ticker}")
        if txn.transaction_type == 'BUY':
            holdings[txn.ticker] += txn.shares
            invested[txn.ticker] += txn.total_amount
        elif txn.transaction_type == 'SELL':
            holdings[txn.ticker] -= txn.shares
            invested[txn.ticker] -= txn.total_amount

    av_service = get_alpha_vantage_service()
    prices = {}
    total_value = Decimal('0')

    for ticker, shares in holdings.items():
        if shares <= 0:
            continue
        quote = await sync_to_async(av_service.get_global_quote)(ticker)
        price = Decimal(str(quote.get('price', '0'))) if quote else Decimal('0')
        prices[ticker] = price
        total_value += shares * price

    rows = []
    for idx, (ticker, shares) in enumerate(holdings.items()):
        if shares <= 0:
            continue
        value = shares * prices.get(ticker, Decimal('0'))
        invested_amt = invested.get(ticker, Decimal('0'))
        gain_value = value - invested_amt
        gain_percent = (gain_value / invested_amt * Decimal('100')) if invested_amt != 0 else Decimal('0')
        allocation = (value / total_value * Decimal('100')) if total_value != 0 else Decimal('0')
        rows.append({
            "groupKey": ticker,
            "value": str(round(value, 2)),
            "invested": str(round(invested_amt, 2)),
            "gainValue": str(round(gain_value, 2)),
            "gainPercent": str(round(gain_percent, 2)),
            "allocation": str(round(allocation, 2)),
            "accentColor": "blue"
        })

    print(f"[DASHBOARD DEBUG] Allocation: Generated {len(rows)} allocation rows")
    print(f"[DASHBOARD DEBUG] Allocation: Total portfolio value: {total_value}")
    return {"rows": rows}

@dashboard_api_router.get("/gainers", response=GainersLosersResponse, summary="Get Top 5 Day Gainers")
@async_ttl_cache(ttl=1800)
@require_auth
async def get_top_gainers(request, limit: int = 5):
    print(f"[DASHBOARD DEBUG] get_top_gainers called with limit: {limit}")
    user = await get_current_user(request)
    print(f"[DASHBOARD DEBUG] User retrieved for gainers: {user.id if user else 'None'}")
    transactions = await sync_to_async(list)(Transaction.objects.filter(user_id=user.id))
    print(f"[DASHBOARD DEBUG] Gainers: Found {len(transactions)} transactions for user")

    tickers = {txn.ticker for txn in transactions if txn.transaction_type in ['BUY', 'SELL']}
    print(f"[DASHBOARD DEBUG] Gainers: Extracted {len(tickers)} unique tickers: {list(tickers)}")
    av_service = get_alpha_vantage_service()
    data = []

    for ticker in tickers:
        print(f"[DASHBOARD DEBUG] Gainers: Fetching quote for ticker: {ticker}")
        quote = await sync_to_async(av_service.get_global_quote)(ticker)
        if not quote:
            continue
        price = Decimal(str(quote.get('price', '0')))
        change = Decimal(str(quote.get('change', '0')))
        change_percent = Decimal(str(quote.get('change_percent', '0')))
        data.append({
            "name": ticker,
            "ticker": ticker,
            "value": str(round(price, 2)),
            "changePercent": str(round(change_percent, 2)),
            "changeValue": str(round(change, 2))
        })

    print(f"[DASHBOARD DEBUG] Gainers: Processed {len(data)} tickers for gainers analysis")
    data.sort(key=lambda x: Decimal(x["changePercent"]), reverse=True)
    print(f"[DASHBOARD DEBUG] Gainers: Returning top {limit} gainers: {[item['ticker'] for item in data[:limit]]}")
    return {"items": data[:limit]}

@dashboard_api_router.get("/losers", response=GainersLosersResponse, summary="Get Top 5 Day Losers")
@async_ttl_cache(ttl=1800)
@require_auth
async def get_top_losers(request, limit: int = 5):
    print(f"[DASHBOARD DEBUG] get_top_losers called with limit: {limit}")
    user = await get_current_user(request)
    print(f"[DASHBOARD DEBUG] User retrieved for losers: {user.id if user else 'None'}")
    transactions = await sync_to_async(list)(Transaction.objects.filter(user_id=user.id))
    print(f"[DASHBOARD DEBUG] Losers: Found {len(transactions)} transactions for user")

    tickers = {txn.ticker for txn in transactions if txn.transaction_type in ['BUY', 'SELL']}
    print(f"[DASHBOARD DEBUG] Losers: Extracted {len(tickers)} unique tickers: {list(tickers)}")
    av_service = get_alpha_vantage_service()
    data = []

    for ticker in tickers:
        print(f"[DASHBOARD DEBUG] Losers: Fetching quote for ticker: {ticker}")
        quote = await sync_to_async(av_service.get_global_quote)(ticker)
        if not quote:
            continue
        price = Decimal(str(quote.get('price', '0')))
        change = Decimal(str(quote.get('change', '0')))
        change_percent = Decimal(str(quote.get('change_percent', '0')))
        data.append({
            "name": ticker,
            "ticker": ticker,
            "value": str(round(price, 2)),
            "changePercent": str(round(change_percent, 2)),
            "changeValue": str(round(change, 2))
        })

    print(f"[DASHBOARD DEBUG] Losers: Processed {len(data)} tickers for losers analysis")
    data.sort(key=lambda x: Decimal(x["changePercent"]))
    print(f"[DASHBOARD DEBUG] Losers: Returning top {limit} losers: {[item['ticker'] for item in data[:limit]]}")
    return {"items": data[:limit]}

@dashboard_api_router.get("/dividend-forecast", response=DividendForecastResponse, summary="Get 12-Month Dividend Forecast")
@async_ttl_cache(ttl=1800)
@require_auth
async def get_dividend_forecast(request, months: int = 12):
    print(f"[DASHBOARD DEBUG] get_dividend_forecast called with months: {months}")
    user = await get_current_user(request)
    print(f"[DASHBOARD DEBUG] User retrieved for dividend forecast: {user.id if user else 'None'}")
    start_date = date.today()
    end_date = start_date + timedelta(days=months * 30)

    payments = await sync_to_async(list)(
        DividendPayment.objects.filter(
            holding__portfolio__user_id=user.id,
            payment_date__gte=start_date,
            payment_date__lte=end_date
        )
    )

    month_totals: Dict[str, Decimal] = defaultdict(Decimal)
    for p in payments:
        month_key = p.payment_date.strftime("%b")
        month_totals[month_key] += p.total_amount

    forecast_data = [
        {"month": m, "amount": str(round(amt, 2))} for m, amt in month_totals.items()
    ]
    total = sum(month_totals.values())
    avg = (total / Decimal(str(months))) if months else Decimal('0')

    return {"forecast": forecast_data, "next12mTotal": str(round(total,2)), "monthlyAvg": str(round(avg,2))}

@dashboard_api_router.get("/fx/latest", response=FxResponse, summary="Get Latest FX Rates")
@require_auth
@async_ttl_cache(ttl=300)
async def get_latest_fx_rates(request, base: str = "AUD"):
    print(f"[DASHBOARD DEBUG] get_latest_fx_rates called with base: {base}")
    fx_data = [
        {"pair": "USDAUD", "rate": "1.57", "change": "0.75"},
        {"pair": "EURAUD", "rate": "1.79", "change": "0.62"},
        {"pair": "GBPAUD", "rate": "2.09", "change": "0.48"},
    ]
    print(f"[DASHBOARD DEBUG] FX: Returning {len(fx_data)} FX rate pairs")
    return {"rates": fx_data} 
