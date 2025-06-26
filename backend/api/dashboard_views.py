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
            # Create a safe cache key excluding request objects and users
            key_parts = []
            for arg in args:
                if not hasattr(arg, 'method'):  # Skip request objects
                    if not isinstance(arg, SupabaseUser):
                        key_parts.append(str(arg))
            
            for k, v in kwargs.items():
                if not isinstance(v, SupabaseUser) and not hasattr(v, 'method'):
                    key_parts.append(f"{k}:{v}")
            
            cache_key = tuple(key_parts) or ('default',)
            
            try:
                return sync_cache[cache_key]
            except KeyError:
                res = await func(*args, **kwargs)
                sync_cache[cache_key] = res
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
    
    class Config:
        populate_by_name = True
        json_encoders = {
            Decimal: str
        }

class AllocationRow(Schema):
    groupKey: str
    value: Decimal
    invested: Decimal
    gainValue: Decimal
    gainPercent: Decimal
    allocation: Decimal
    accentColor: str

class AllocationResponse(Schema):
    rows: List[AllocationRow]

class GainerLoserRow(Schema):
    logoUrl: Optional[str] = None
    name: str
    ticker: str
    value: Decimal
    changePercent: Decimal
    changeValue: Decimal

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

@dashboard_api_router.get("/overview", response=OverviewResponse, summary="Get Enhanced Dashboard KPI Overview")
@async_ttl_cache(ttl=1800)
@require_auth
async def get_dashboard_overview(request):
    print(f"[DASHBOARD DEBUG] ✨ Enhanced get_dashboard_overview called for request: {request}")
    print(f"[DASHBOARD DEBUG] 🔍 Request method: {request.method}")
    print(f"[DASHBOARD DEBUG] 🔍 Request headers: {dict(request.headers)}")
    print(f"[DASHBOARD DEBUG] 🔍 Request path: {request.get_full_path()}")
    
    try:
        # Get current user with extensive debugging
        user = await get_current_user(request)
        print(f"[DASHBOARD DEBUG] User retrieved: {user.id if user else 'None'}")
        
        if not user or not user.id:
            print(f"[DASHBOARD DEBUG] ❌ No valid user found, returning default metrics")
            return _get_dashboard_fallback_response()
        
        user_id = user.id
        print(f"[DASHBOARD DEBUG] 🎯 Using user_id: {user_id}")
        
        # Check if user has portfolio data
        print(f"[DASHBOARD DEBUG] 🔍 Checking database for user portfolio/transaction data...")
        from .models import Portfolio, Holding, Transaction
        
        try:
            portfolio_count = await sync_to_async(Portfolio.objects.filter(user_id=user_id).count)()
            holding_count = await sync_to_async(Holding.objects.filter(portfolio__user_id=user_id).count)()
            transaction_count = await sync_to_async(Transaction.objects.filter(user_id=user_id).count)()
            
            print(f"[DASHBOARD DEBUG] 📊 Database check results:")
            print(f"[DASHBOARD DEBUG]   - Portfolios: {portfolio_count}")
            print(f"[DASHBOARD DEBUG]   - Holdings: {holding_count}")
            print(f"[DASHBOARD DEBUG]   - Transactions: {transaction_count}")
            
            if portfolio_count == 0 and holding_count == 0 and transaction_count == 0:
                print(f"[DASHBOARD DEBUG] ⚠️ No portfolio data found for user {user_id}")
                print(f"[DASHBOARD DEBUG] 💡 User needs to add holdings or transactions first")
                print(f"[DASHBOARD DEBUG] 🔄 Returning fallback response with explanatory message")
                return _get_dashboard_fallback_response()
            
            # If we have data, let's see what it is
            if transaction_count > 0:
                # Get a sample of transactions
                sample_transactions = await sync_to_async(list)(
                    Transaction.objects.filter(user_id=user_id)[:3]
                )
                print(f"[DASHBOARD DEBUG] 📝 Sample transactions:")
                for txn in sample_transactions:
                    print(f"[DASHBOARD DEBUG]   - {txn.transaction_type} {txn.shares} {txn.ticker} @ ${txn.price_per_share} on {txn.transaction_date}")
                    
        except Exception as db_error:
            print(f"[DASHBOARD DEBUG] ❌ Database check failed: {db_error}")
            import traceback
            print(f"[DASHBOARD DEBUG] Database error traceback: {traceback.format_exc()}")
        
        print(f"[DASHBOARD DEBUG] 🚀 Starting enhanced financial metrics calculation for user {user_id}")
        
        # Use the new advanced financial metrics service
        from .services.advanced_financial_metrics import get_advanced_financial_metrics_service
        
        financial_service = get_advanced_financial_metrics_service()
        print(f"[DASHBOARD DEBUG] Advanced financial metrics service loaded: {financial_service}")
        
        # Get enhanced metrics with comprehensive error handling
        enhanced_metrics = await financial_service.calculate_enhanced_kpi_metrics(user_id, "SPY")
        print(f"[DASHBOARD DEBUG] ✅ Enhanced metrics calculated successfully: {enhanced_metrics}")
        
        # Validate the response structure
        if not enhanced_metrics or not isinstance(enhanced_metrics, dict):
            print(f"[DASHBOARD DEBUG] ❌ Invalid enhanced metrics returned, using fallback")
            return _get_dashboard_fallback_response()
        
        # Map enhanced metrics to the expected dashboard structure correctly
        # Fix the mapping to align with the OverviewResponse schema
        # Extract numeric values and format sub_labels properly
        
        # Helper function to extract numeric value from formatted string
        def extract_numeric_value(value_str: str) -> Decimal:
            if isinstance(value_str, (int, float)):
                return Decimal(str(value_str))
            
            # Remove currency symbols, percentages, and other formatting
            import re
            numeric_part = re.sub(r'[^\d.-]', '', str(value_str))
            try:
                return Decimal(numeric_part) if numeric_part else Decimal('0')
            except:
                return Decimal('0')
        
        market_value_data = enhanced_metrics.get("marketValue", {})
        irr_data = enhanced_metrics.get("irr", {})
        beta_data = enhanced_metrics.get("portfolioBeta", {})
        dividend_data = enhanced_metrics.get("dividendYield", {})
        
        print(f"[DASHBOARD DEBUG] 🔍 Enhanced metrics breakdown:")
        print(f"[DASHBOARD DEBUG]   - marketValue: {market_value_data}")
        print(f"[DASHBOARD DEBUG]   - irr: {irr_data}")
        print(f"[DASHBOARD DEBUG]   - portfolioBeta: {beta_data}")
        print(f"[DASHBOARD DEBUG]   - dividendYield: {dividend_data}")
        
        # Calculate total profit/loss from market value data
        # Extract P&L from market value sub_label if available
        market_value_str = market_value_data.get("value", "0")
        market_sub_label = market_value_data.get("sub_label", "+AU$0.00 (+0.00%)")
        
        # Try to extract profit/loss from sub_label like "+AU$47560.47 (+50.77%)"
        import re
        profit_match = re.search(r'([+-]?)AU\$([0-9,\.]+)', market_sub_label)
        profit_percent_match = re.search(r'\(([+-]?)([0-9,\.]+)%\)', market_sub_label)
        
        total_profit_value = "0.00"
        total_profit_percent = "0.00%"
        is_profit_positive = False
        
        if profit_match and profit_percent_match:
            profit_sign = profit_match.group(1) if profit_match.group(1) else "+"
            profit_amount = profit_match.group(2)
            percent_sign = profit_percent_match.group(1) if profit_percent_match.group(1) else "+"
            percent_value = profit_percent_match.group(2)
            
            total_profit_value = profit_amount
            total_profit_percent = f"{percent_sign}{percent_value}%"
            is_profit_positive = profit_sign == "+" or (profit_sign == "" and float(profit_amount.replace(",", "")) > 0)
            
            print(f"[DASHBOARD DEBUG] 💰 Extracted profit: {profit_sign}AU${profit_amount} ({percent_sign}{percent_value}%)")
        
        # Use snake_case field names to match the schema definition
        validated_response = {
            "market_value": {
                "value": extract_numeric_value(market_value_data.get("value", "0")),
                "sub_label": market_value_data.get("sub_label", "+AU$0.00 (+0.00%)"),
                "is_positive": market_value_data.get("is_positive", True)
            },
            "total_profit": {  # Use the extracted profit/loss from market value
                "value": extract_numeric_value(total_profit_value),
                "sub_label": f"Total P&L: {total_profit_percent}",
                "is_positive": is_profit_positive
            },
            "irr": {  # Use the actual IRR data
                "value": extract_numeric_value(irr_data.get("value", "0")),
                "sub_label": irr_data.get("sub_label", "vs SPY: +0.0%"),
                "is_positive": irr_data.get("is_positive", False)
            },
            "passive_income": {
                "value": extract_numeric_value(dividend_data.get("value", "0")),
                "sub_label": dividend_data.get("sub_label", "0.00% yield (AU$0.00 annual)"),
                "is_positive": dividend_data.get("is_positive", False)
            }
        }
        
        print(f"[DASHBOARD DEBUG] 📊 Mapped enhanced metrics to dashboard schema:")
        print(f"[DASHBOARD DEBUG]   - Portfolio Value: {validated_response['market_value']}")
        print(f"[DASHBOARD DEBUG]   - IRR (from enhanced): {validated_response['total_profit']}")
        print(f"[DASHBOARD DEBUG]   - Portfolio Beta (IRR slot): {validated_response['irr']}")
        print(f"[DASHBOARD DEBUG]   - Dividend Yield: {validated_response['passive_income']}")
        
        print(f"[DASHBOARD DEBUG] 🎯 Final validated response: {validated_response}")
        print(f"[DASHBOARD DEBUG] ✅ Enhanced dashboard overview completed successfully")
        
        return validated_response
        
    except Exception as e:
        print(f"[DASHBOARD DEBUG] ❌ Critical error in enhanced dashboard overview: {e}")
        print(f"[DASHBOARD DEBUG] 🔄 Falling back to default response")
        import traceback
        print(f"[DASHBOARD DEBUG] Error traceback: {traceback.format_exc()}")
        return _get_dashboard_fallback_response()


def _get_dashboard_fallback_response():
    """Get fallback dashboard response when enhanced calculations fail"""
    print(f"[DASHBOARD DEBUG] 🔄 Generating fallback dashboard response")
    
    return {
        "market_value": {
            "value": Decimal("0.00"),
            "sub_label": "+AU$0.00 (+0.00%)",
            "is_positive": True
        },
        "total_profit": {
            "value": Decimal("0.00"),
            "sub_label": "vs SPY: +0.0%",
            "is_positive": False
        },
        "irr": {
            "value": Decimal("1.00"),
            "sub_label": "vs SPY",
            "is_positive": False
        },
        "passive_income": {
            "value": Decimal("0.00"),
            "sub_label": "0.00% yield (AU$0.00 annual)",
            "is_positive": False
        }
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

    print(f"[DASHBOARD DEBUG] Allocation: Total portfolio value calculated: {total_value}")

    rows = []
    for idx, (ticker, shares) in enumerate(holdings.items()):
        if shares <= 0:
            continue
        value = shares * prices.get(ticker, Decimal('0'))
        invested_amt = invested.get(ticker, Decimal('0'))
        gain_value = value - invested_amt
        gain_percent = (gain_value / invested_amt * Decimal('100')) if invested_amt != 0 else Decimal('0')
        allocation = (value / total_value * Decimal('100')) if total_value != 0 else Decimal('0')
        
        # Fix: Ensure allocation is properly converted to Decimal for consistent number type
        allocation_decimal = Decimal(str(round(float(allocation), 2)))
        
        print(f"[DASHBOARD DEBUG] Allocation: Processing {ticker} - value: {value}, allocation: {allocation_decimal} (type: {type(allocation_decimal)})")
        
        row_data = {
            "groupKey": ticker,
            "value": str(round(value, 2)),
            "invested": str(round(invested_amt, 2)),
            "gainValue": str(round(gain_value, 2)),
            "gainPercent": str(round(gain_percent, 2)),
            "allocation": allocation_decimal,  # Now properly returning as Decimal
            "accentColor": "blue"
        }
        
        print(f"[DASHBOARD DEBUG] Allocation: Row data for {ticker}: {row_data}")
        rows.append(row_data)

    print(f"[DASHBOARD DEBUG] Allocation: Generated {len(rows)} allocation rows")
    print(f"[DASHBOARD DEBUG] Allocation: Final rows data types - checking allocation types:")
    for row in rows:
        print(f"[DASHBOARD DEBUG] Allocation: {row['groupKey']} allocation type: {type(row['allocation'])}, value: {row['allocation']}")
    
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
        
        # Fix: Ensure all numeric fields are returned as proper Decimal types
        price_decimal = Decimal(str(round(float(price), 2)))
        change_decimal = Decimal(str(round(float(change), 2)))
        change_percent_decimal = Decimal(str(round(float(change_percent), 2)))
        
        print(f"[DASHBOARD DEBUG] Gainers: Processing {ticker} - price: {price_decimal} (type: {type(price_decimal)}), change: {change_decimal} (type: {type(change_decimal)}), change_percent: {change_percent_decimal} (type: {type(change_percent_decimal)})")
        
        item_data = {
            "logoUrl": None,
            "name": ticker,
            "ticker": ticker,
            "value": str(round(price, 2)),  # Keep as string for display formatting
            "changePercent": change_percent_decimal,  # Now returning as Decimal
            "changeValue": change_decimal  # Now returning as Decimal
        }
        
        print(f"[DASHBOARD DEBUG] Gainers: Item data for {ticker}: {item_data}")
        data.append(item_data)

    print(f"[DASHBOARD DEBUG] Gainers: Processed {len(data)} tickers for gainers analysis")
    data.sort(key=lambda x: float(x["changePercent"]), reverse=True)
    print(f"[DASHBOARD DEBUG] Gainers: Returning top {limit} gainers: {[item['ticker'] for item in data[:limit]]}")
    
    final_items = data[:limit]
    print(f"[DASHBOARD DEBUG] Gainers: Final items data types - checking numeric fields:")
    for item in final_items:
        print(f"[DASHBOARD DEBUG] Gainers: {item['ticker']} changePercent type: {type(item['changePercent'])}, changeValue type: {type(item['changeValue'])}")
    
    return {"items": final_items}

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
        
        # Fix: Ensure all numeric fields are returned as proper Decimal types
        price_decimal = Decimal(str(round(float(price), 2)))
        change_decimal = Decimal(str(round(float(change), 2)))
        change_percent_decimal = Decimal(str(round(float(change_percent), 2)))
        
        print(f"[DASHBOARD DEBUG] Losers: Processing {ticker} - price: {price_decimal} (type: {type(price_decimal)}), change: {change_decimal} (type: {type(change_decimal)}), change_percent: {change_percent_decimal} (type: {type(change_percent_decimal)})")
        
        item_data = {
            "logoUrl": None,
            "name": ticker,
            "ticker": ticker,
            "value": str(round(price, 2)),  # Keep as string for display formatting
            "changePercent": change_percent_decimal,  # Now returning as Decimal
            "changeValue": change_decimal  # Now returning as Decimal
        }
        
        print(f"[DASHBOARD DEBUG] Losers: Item data for {ticker}: {item_data}")
        data.append(item_data)

    print(f"[DASHBOARD DEBUG] Losers: Processed {len(data)} tickers for losers analysis")
    data.sort(key=lambda x: float(x["changePercent"]))
    print(f"[DASHBOARD DEBUG] Losers: Returning top {limit} losers: {[item['ticker'] for item in data[:limit]]}")
    
    final_items = data[:limit]
    print(f"[DASHBOARD DEBUG] Losers: Final items data types - checking numeric fields:")
    for item in final_items:
        print(f"[DASHBOARD DEBUG] Losers: {item['ticker']} changePercent type: {type(item['changePercent'])}, changeValue type: {type(item['changeValue'])}")
    
    return {"items": final_items}

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
