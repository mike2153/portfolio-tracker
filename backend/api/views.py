from ninja import Schema, Router, Depends
from ninja.errors import HttpError
from django.db.models import Q, Sum, Count, Case, When, Value, IntegerField
from .utils import success_response, error_response, validation_error_response
from django.http import JsonResponse
from .services.transaction_service import get_transaction_service, get_price_update_service
from .models import Transaction, UserSettings, UserApiRateLimit
from django.http import JsonResponse
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from decimal import Decimal
import os
import logging
from .services.metrics_calculator import calculate_advanced_metrics
import requests
from ninja.security import HttpBearer
from cachetools.func import ttl_cache
from asgiref.sync import sync_to_async
from functools import wraps
from pydantic import Field
from .alpha_vantage_service import alpha_vantage, get_alpha_vantage_service
from .dashboard_views import dashboard_api_router

logger = logging.getLogger(__name__)

router = Router()
router.add_router("/", dashboard_api_router)

# =================
# AUTHENTICATION
# =================

# TODO: Implement proper Supabase JWT authentication
# This is a placeholder for development.
class MockUser:
    def __init__(self, id, email="test@example.com"):
        self.id = id
        self.email = email

async def get_current_user(request) -> MockUser:
    """
    Placeholder dependency to simulate getting a user from a JWT.
    In a real scenario, this would decode the token from the Authorization header.
    """
    # For now, we'll use a fixed user_id.
    # In a real app, you'd get this from the JWT payload.
    # The `user_id` in the database seems to be a string, not an integer.
    return MockUser(id="0b8a164c-8e81-4328-a28f-1555560b7952") # Example UUID


def async_ttl_cache(ttl: int):
    """
    A wrapper to make cachetools.func.ttl_cache compatible with async functions.
    """
    def decorator(func):
        sync_cache = ttl_cache(maxsize=None, ttl=ttl)
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # A simplistic way to create a cache key from args/kwargs.
            # May need to be more robust depending on argument types.
            key = args + tuple(sorted(kwargs.items()))
            try:
                return sync_cache[key]
            except KeyError:
                res = await func(*args, **kwargs)
                sync_cache[key] = res
                return res
        return wrapper
    return decorator


# =================
# DASHBOARD ENDPOINTS
# =================

# --- Pydantic Schemas for Dashboard ---

class KPIValue(Schema):
    value: Decimal
    sub_label: str
    delta: Optional[Decimal] = None
    delta_percent: Optional[Decimal] = None
    is_positive: bool

class OverviewResponse(Schema):
    market_value: KPIValue
    total_profit: KPIValue
    irr: KPIValue
    passive_income: KPIValue

class AllocationRow(Schema):
    group_key: str = Field(..., alias="groupKey")
    value: Decimal
    invested: Decimal
    gain_value: Decimal
    gain_percent: Decimal
    allocation: Decimal
    accent_color: str

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


@router.get("/dashboard/overview", response=OverviewResponse, summary="Get Dashboard KPI Overview")
@async_ttl_cache(ttl=60) # Cache for 60 seconds
async def get_dashboard_overview(request, user: MockUser = Depends(get_current_user)):
    """
    Provides the four main KPI cards for the user's dashboard.
    """
    # NOTE: This implementation requires complex calculations.
    # It will fetch all holdings, their current prices, and historical data.
    # This is a simplified version for demonstration.
    # A full implementation would need a robust service layer.
    
    # Placeholder data - replace with actual calculations
    return OverviewResponse(
        market_value=KPIValue(value=Decimal("138214.02"), sub_label="AU$138,477.40 invested", is_positive=True),
        total_profit=KPIValue(value=Decimal("12257.01"), sub_label="+AU$178.07 daily", delta_percent=Decimal("8.9"), is_positive=True),
        irr=KPIValue(value=Decimal("11.48"), sub_label="-0.33% current holdings", is_positive=False),
        passive_income=KPIValue(value=Decimal("1.6"), sub_label="AU$2,022.86 annually", delta=Decimal("9"), is_positive=True)
    )


@router.get("/dashboard/allocation", response=AllocationResponse, summary="Get Portfolio Allocation")
@async_ttl_cache(ttl=60)
async def get_portfolio_allocation(request, groupBy: str = "sector", user: MockUser = Depends(get_current_user)):
    """
    Provides data for the portfolio allocation table, grouped by a given category.
    """
    # TODO: Replace with real data fetching and processing
    allocation_data = [
        {"groupKey": "Funds", "value": 51142.06, "invested": 57257.15, "gain_value": 3195.08, "gain_percent": 5.58, "allocation": 44.24, "accent_color": "blue"},
        {"groupKey": "Industrials", "value": 18729.62, "invested": 19470.87, "gain_value": -1225.94, "gain_percent": -6.3, "allocation": 14.27, "accent_color": "green"},
        {"groupKey": "Financials", "value": 14563.92, "invested": 13613.49, "gain_value": 10311.09, "gain_percent": 75.74, "allocation": 10.54, "accent_color": "purple"},
        {"groupKey": "Cash", "value": 11804.06, "invested": 11804.06, "gain_value": 0, "gain_percent": 0, "allocation": 8.54, "accent_color": "gray"},
        {"groupKey": "Healthcare", "value": 9797.59, "invested": 8463.80, "gain_value": 2275.97, "gain_percent": 26.89, "allocation": 7.09, "accent_color": "teal"},
    ]
    
    # Convert dicts to Pydantic models
    rows = [AllocationRow(**row) for row in allocation_data]
    
    return AllocationResponse(rows=rows)


@router.get("/dashboard/gainers", response=GainersLosersResponse, summary="Get Top 5 Day Gainers")
@async_ttl_cache(ttl=60)
async def get_top_gainers(request, limit: int = 5, user: MockUser = Depends(get_current_user)):
    """Provides the top 5 daily gainers from the user's portfolio."""
    # TODO: Implement real logic
    gainers_data = [
        {"name": "iShares Core S&P 500 AUD", "ticker": "IVV", "value": 29550.15, "changePercent": 0.9, "changeValue": 262.33},
        {"name": "Vanguard US Total Market Shares Index ETF", "ticker": "VTS", "value": 14624.96, "changePercent": 0.95, "changeValue": 127.60},
        {"name": "Hims & Hers Health, Inc", "ticker": "HIMS", "value": 1605.50, "changePercent": 5.16, "changeValue": 78.75},
        {"name": "Betashares Nasdaq 100", "ticker": "NDQ", "value": 16966.95, "changePercent": 0.6, "changeValue": 101.70},
        {"name": "Tasmia Ltd", "ticker": "TEA", "value": 4779.16, "changePercent": 1.88, "changeValue": 87.96},
    ]
    items = [GainerLoserRow(**item) for item in gainers_data]
    return GainersLosersResponse(items=items)


@router.get("/dashboard/losers", response=GainersLosersResponse, summary="Get Top 5 Day Losers")
@async_ttl_cache(ttl=60)
async def get_top_losers(request, limit: int = 5, user: MockUser = Depends(get_current_user)):
    """Provides the top 5 daily losers from the user's portfolio."""
    # TODO: Implement real logic
    losers_data = [
        {"name": "Arista Networks, Inc", "ticker": "ANET", "value": 3622.50, "changePercent": -4.42, "changeValue": -167.58},
        {"name": "Brookside Energy Ltd", "ticker": "BRK", "value": 5983.29, "changePercent": -3.48, "changeValue": -216.20},
        {"name": "Terawulf Inc", "ticker": "WULF", "value": 4222.46, "changePercent": -2.6, "changeValue": -115.04},
        {"name": "Acrow Limited", "ticker": "ACF", "value": 5493.16, "changePercent": -2.05, "changeValue": -115.04},
        {"name": "Nu Holdings Ltd.", "ticker": "NU", "value": 3537.02, "changePercent": -0.82, "changeValue": -29.30},
    ]
    items = [GainerLoserRow(**item) for item in losers_data]
    return GainersLosersResponse(items=items)


@router.get("/dashboard/dividend-forecast", response=DividendForecastResponse, summary="Get 12-Month Dividend Forecast")
@async_ttl_cache(ttl=3600) # Cache for 1 hour
async def get_dividend_forecast(request, months: int = 12, user: MockUser = Depends(get_current_user)):
    """
    Provides a 12-month forecast of expected dividend payments.
    """
    # TODO: Implement real logic based on holding dividend schedules
    forecast_data = [
        {"month": "Jul", "amount": 619}, {"month": "Aug", "amount": 290}, {"month": "Sep", "amount": 150},
        {"month": "Oct", "amount": 520}, {"month": "Nov", "amount": 175}, {"month": "Dec", "amount": 125},
        {"month": "Jan", "amount": 167},
    ]
    total = sum(d['amount'] for d in forecast_data)
    avg = total / 12
    
    return DividendForecastResponse(
        forecast=[DividendForecastItem(**d) for d in forecast_data],
        next12mTotal=Decimal(str(total)),
        monthlyAvg=Decimal(str(avg))
    )

@router.get("/fx/latest", response=FxResponse, summary="Get Latest FX Rates")
@async_ttl_cache(ttl=300) # Cache for 5 minutes
async def get_latest_fx_rates(request, base: str = "AUD"):
    """
    Provides latest foreign exchange rates relative to a base currency.
    """
    # TODO: Implement real logic
    fx_data = [
        {"pair": "USDAUD", "rate": 1.57, "change": 0.75},
        {"pair": "EURAUD", "rate": 1.79, "change": 0.62},
        {"pair": "GBPAUD", "rate": 2.09, "change": 0.48},
    ]
    return FxResponse(rates=[FxRate(**rate) for rate in fx_data])


# =================
# STOCK ANALYSIS ENDPOINTS
# =================

@router.get("/stocks/{symbol}/quote", summary="Get Real-time Stock Quote")
def get_stock_quote(request, symbol: str):
    """Get real-time stock quote with current price"""
    try:
        symbol_upper = symbol.upper()
        quote = alpha_vantage.get_global_quote(symbol_upper)
        
        if not quote:
            return error_response(
                f"Quote data could not be found for ticker {symbol_upper} from our provider.",
                status_code=404
            )

        return success_response({
            "symbol": symbol_upper,
            "data": quote,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting stock quote for {symbol}: {e}", exc_info=True)
        return error_response(
            f"An unexpected error occurred while retrieving the quote for {symbol}.",
            status_code=500
        )

@router.get("/stocks/{symbol}/overview", summary="Get Company Overview and Quote")
def get_company_overview(request, symbol: str):
    """Get comprehensive stock overview including fundamentals"""
    try:
        symbol_upper = symbol.upper()
        overview = alpha_vantage.get_company_overview(symbol_upper)
        quote = alpha_vantage.get_global_quote(symbol_upper)
        
        if not overview and not quote:
            return error_response(
                f"Complete data could not be found for ticker {symbol_upper} from our provider.",
                status_code=404
            )

        # Combine any data we did find - prioritize quote data for price info
        combined_data = {}
        if overview:
            combined_data.update(overview)
        if quote:
            combined_data.update(quote)

        # Ensure we have a price field
        if not combined_data.get('price') and quote:
            combined_data['price'] = quote.get('price')

        return success_response({
            "symbol": symbol_upper,
            "data": combined_data,
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting stock overview for {symbol}: {e}", exc_info=True)
        return error_response(
            f"An unexpected error occurred while retrieving the overview for {symbol}.",
            status_code=500
        )

@router.get("/stocks/{symbol}/historical")
def get_stock_historical(request, symbol: str, period: str = "1Y"):
    """Get historical price data for different time periods"""
    try:
        # Map frontend periods to data filtering
        period_days = {
            "1W": 7, "1M": 30, "3M": 90, "6M": 180,
            "1Y": 365, "3Y": 1095, "5Y": 1825
        }
        
        days = period_days.get(period.upper(), 365)
        
        historical_data = alpha_vantage.get_daily_adjusted(symbol.upper())
        
        if not historical_data or not historical_data.get('data'):
             raise HttpError(404, f"No historical data available for {symbol}")

        # Filter data based on period
        cutoff_date_dt = datetime.now() - timedelta(days=days)
        
        filtered_data = [
            item for item in historical_data['data']
            if datetime.strptime(item['date'], '%Y-%m-%d') >= cutoff_date_dt
        ]
        
        return {
            "symbol": symbol.upper(),
            "period": period,
            "data": filtered_data,
            "last_refreshed": historical_data.get('last_refreshed')
        }
    except Exception as e:
        raise HttpError(500, str(e))

@router.get("/stocks/{symbol}/financials/{statement_type}")
def get_stock_financials(request, symbol: str, statement_type: str):
    """Get financial statements (income, balance, cash flow)"""
    try:
        fetcher_map = {
            "income": alpha_vantage.get_income_statement,
            "balance": alpha_vantage.get_balance_sheet,
            "cashflow": alpha_vantage.get_cash_flow
        }
        
        fetcher = fetcher_map.get(statement_type.lower())
        
        if not fetcher:
            raise HttpError(400, "Invalid statement type. Use 'income', 'balance', or 'cashflow'.")
            
        financials = fetcher(symbol.upper())
        
        return {
            "symbol": symbol.upper(),
            "statement_type": statement_type,
            "data": financials,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HttpError(500, str(e))

@router.get("/stocks/{symbol}/news")
def get_stock_news(request, symbol: str, limit: int = 20):
    """Get news sentiment for a specific stock"""
    try:
        news_data = alpha_vantage.get_news_sentiment(
            tickers=symbol.upper(),
            limit=limit
        )
        
        return {
            "symbol": symbol.upper(),
            "news": news_data.get('feed', []),
            "count": len(news_data.get('feed', [])),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HttpError(500, str(e))


# =================
# PORTFOLIO MANAGEMENT ENDPOINTS
# =================

@router.get("/portfolios/{user_id}")
def get_user_portfolio(request, user_id: str):
    """Get detailed portfolio holdings and summary"""
    try:
        portfolio, _ = Portfolio.objects.get_or_create(user_id=user_id)
        
        holdings_qs = portfolio.holdings.all()
        
        total_portfolio_value = Decimal('0.0')
        holdings_data = []
        
        for holding in holdings_qs:
            quote = alpha_vantage.get_global_quote(holding.ticker)
            
            # Defensively get the current price
            current_price = holding.purchase_price # Default to purchase price
            if quote and isinstance(quote.get('price'), (int, float)) and quote['price'] > 0:
                current_price = Decimal(str(quote['price']))
            
            market_value = holding.shares * current_price
            total_portfolio_value += market_value
            
            holdings_data.append({
                "id": holding.id,
                "ticker": holding.ticker,
                "company_name": holding.company_name,
                "shares": float(holding.shares),
                "purchase_price": float(holding.purchase_price),
                "market_value": float(market_value),
                "current_price": float(current_price)
            })
        # Fix: Default cash_balance to Decimal('0.00') if None
        cash_balance = portfolio.cash_balance if portfolio.cash_balance is not None else Decimal('0.00')
        return {
            "cash_balance": float(cash_balance),
            "holdings": holdings_data,
            "summary": {
                "total_holdings": len(holdings_data),
                "total_value": float(total_portfolio_value + cash_balance)
            }
        }
    except Exception as e:
        logger.error(f"Failed to get user portfolio for {user_id}: {e}", exc_info=True)
        raise HttpError(500, "An error occurred while fetching portfolio data.")

@router.get("/portfolios/{user_id}/performance")
def get_portfolio_performance(request, user_id: str, period: str = "1Y", benchmark: str = "^GSPC"):
    """Get enhanced time-weighted portfolio performance with comprehensive benchmark comparison"""
    try:
        from .services.portfolio_benchmarking import calculate_enhanced_portfolio_performance, SUPPORTED_BENCHMARKS
        
        # Validate benchmark
        if benchmark not in SUPPORTED_BENCHMARKS:
            raise HttpError(400, f"Unsupported benchmark: {benchmark}. Supported benchmarks: {list(SUPPORTED_BENCHMARKS.keys())}")
        
        # Validate period
        valid_periods = ['1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'ALL']
        if period not in valid_periods:
            raise HttpError(400, f"Invalid period: {period}. Valid periods: {valid_periods}")
        
        logger.debug(f"Getting enhanced portfolio performance for user {user_id}, period {period}, benchmark {benchmark}")
        
        result = calculate_enhanced_portfolio_performance(user_id, period, benchmark)
        
        logger.info(f"Successfully calculated portfolio performance for user {user_id}")
        return result
        
    except ValueError as e:
        logger.warning(f"Validation error in portfolio performance: {e}")
        if "Portfolio not found" in str(e):
            raise HttpError(404, str(e))
        else:
            raise HttpError(400, str(e))
    except Exception as e:
        logger.error(f"Error in get_portfolio_performance: {e}", exc_info=True)
        raise HttpError(500, f"An unexpected error occurred: {e}")

@router.post("/portfolios/{user_id}/holdings")
def add_holding(request, user_id: str, holding_data: HoldingSchema):
    """Add a new stock holding to portfolio"""
    print("UPDATE HOLDING CALLED")
    try:
        # Validate input data
        if holding_data.shares <= 0:
            return validation_error_response({"shares": "Shares must be greater than 0"})
        
        if holding_data.purchase_price <= 0:
            return validation_error_response({"purchase_price": "Purchase price must be greater than 0"})
        
        if holding_data.fx_rate <= 0:
            return validation_error_response({"fx_rate": "Exchange rate must be greater than 0"})
        
        portfolio, _ = Portfolio.objects.get_or_create(user_id=user_id)
        total_cost = (Decimal(str(holding_data.shares)) * Decimal(str(holding_data.purchase_price))) + Decimal(str(holding_data.commission))
        
        if holding_data.used_cash_balance:
            if portfolio.cash_balance < total_cost:
                return error_response(
                    f"Insufficient cash balance. Required: ${total_cost}, Available: ${portfolio.cash_balance}",
                    status_code=400
                )
            portfolio.cash_balance -= total_cost
            portfolio.save()
            
        holding = Holding.objects.create(
            portfolio=portfolio,
            ticker=holding_data.ticker.upper(),
            company_name=holding_data.company_name,
            exchange=holding_data.exchange,
            shares=Decimal(str(holding_data.shares)),
            purchase_price=Decimal(str(holding_data.purchase_price)),
            purchase_date=holding_data.purchase_date,
            commission=Decimal(str(holding_data.commission)),
            used_cash_balance=holding_data.used_cash_balance,
            currency=holding_data.currency,
            fx_rate=Decimal(str(holding_data.fx_rate))
        )
        _create_dividend_records_for_holding(holding)
        
        return success_response({
            "holding_id": holding.id,
            "remaining_cash": float(portfolio.cash_balance),
            "ticker": holding.ticker,
            "shares": float(holding.shares)
        }, message="Holding added successfully")
        
    except Exception as e:
        logger.error(f"Error adding holding for user {user_id}: {e}", exc_info=True)
        return error_response(
            "Could not add holding. Please try again.",
            status_code=500
        )

@router.delete("/portfolios/{user_id}/holdings/{holding_id}")
def delete_holding(request, user_id: str, holding_id: int):
    try:
        holding = Holding.objects.get(id=holding_id, portfolio__user_id=user_id)
        holding.delete()
        return JsonResponse({"ok": True, "message": "Holding deleted"})
    except Holding.DoesNotExist:
        return JsonResponse({"ok": False, "error": "Holding not found"}, status=404)

@router.put("/portfolios/{user_id}/holdings/{holding_id}")
def update_holding(request, user_id: str, holding_id: int, holding_data: HoldingSchema):
    """Update an existing holding"""
    try:
        print(f"UPDATE HOLDING CALLED")
        holding = Holding.objects.get(id=holding_id, portfolio__user_id=user_id)

        # Validate input data
        if holding_data.shares <= 0:
            return validation_error_response({"shares": "Shares must be greater than 0"})
        if holding_data.purchase_price <= 0:
            return validation_error_response({"purchase_price": "Purchase price must be greater than 0"})
        if holding_data.fx_rate <= 0:
            return validation_error_response({"fx_rate": "Exchange rate must be greater than 0"})

        # Get or create the stock symbol
        stock_symbol, _ = StockSymbol.objects.get_or_create(
            symbol=holding_data.ticker.upper(),
            defaults={
                'name': holding_data.company_name,
                'exchange_name': holding_data.exchange,
                'is_active': True
            }
        )

        # Update holding fields (only editable ones)
        holding.stock_symbol = stock_symbol
        holding.ticker = holding_data.ticker.upper()
        holding.company_name = holding_data.company_name
        holding.shares = Decimal(str(holding_data.shares))
        holding.purchase_price = Decimal(str(holding_data.purchase_price))
        holding.purchase_date = holding_data.purchase_date
        holding.commission = Decimal(str(holding_data.commission))
        holding.currency = holding_data.currency
        holding.fx_rate = Decimal(str(holding_data.fx_rate))
        holding.used_cash_balance = holding_data.used_cash_balance

        holding.save()

        # Create dividend records if not exists
        try:
            _create_dividend_records_for_holding(holding)
        except Exception as e:
            logger.warning(f"Could not create dividend records for {holding.ticker}: {e}")
            # Don't fail the update if dividend record creation fails

        return success_response({
            "message": "Holding updated successfully",
            "holding_id": holding.id,
            "ticker": holding.ticker,
            "shares": float(holding.shares),
            "current_price": float(holding.purchase_price),
            "market_value": float(holding.shares * holding.purchase_price)
        })

    except Holding.DoesNotExist:
        print("Holding not found!")
        return error_response("Holding not found", status_code=404)
    except Exception as e:
        print(f"Error updating holding: {e}")
        import traceback; traceback.print_exc()
        return error_response(
            "Could not update holding. Please try again.",
            status_code=500
        )


# =================
# CASH & DIVIDEND MANAGEMENT
# =================

@router.post("/portfolios/{user_id}/cash")
def add_cash_contribution(request, user_id: str, cash_data: CashContributionSchema):
    """Add cash contribution to portfolio"""
    try:
        portfolio, _ = Portfolio.objects.get_or_create(user_id=user_id)
        
        contribution = CashContribution.objects.create(
            portfolio=portfolio, amount=Decimal(str(cash_data.amount)),
            contribution_date=cash_data.contribution_date, description=cash_data.description
        )
        
        portfolio.cash_balance += Decimal(str(cash_data.amount))
        portfolio.save()
        
        return {"message": "Cash contribution added successfully", "contribution_id": contribution.id, "new_cash_balance": float(portfolio.cash_balance)}
    except Exception as e:
        raise HttpError(500, str(e))

@router.get("/portfolios/{user_id}/dividends")
def get_dividend_history(request, user_id: str, ticker: str = "", confirmed_only: bool = False):
    """Get dividend history for portfolio"""
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
        
        dividends_query = DividendPayment.objects.filter(holding__portfolio=portfolio)
        
        if ticker:
            dividends_query = dividends_query.filter(holding__ticker__iexact=ticker)
        if confirmed_only:
            dividends_query = dividends_query.filter(confirmed_received=True)
        
        dividends = list(dividends_query.select_related('holding').order_by('-ex_date').values(
            'id', 'ex_date', 'payment_date', 'amount_per_share', 'total_amount', 
            'confirmed_received', 'holding__ticker', 'holding__company_name'
        ))
        
        summary = dividends_query.aggregate(
            total_confirmed_dividends=Sum('total_amount', filter=Q(confirmed_received=True), default=Decimal('0.0')),
            total_records=Count('id'), confirmed_records=Count('id', filter=Q(confirmed_received=True))
        )
        
        return {
            "dividends": dividends,
            "summary": {
                "total_confirmed_dividends": summary.get('total_confirmed_dividends') or 0,
                "total_records": summary.get('total_records') or 0,
                "confirmed_records": summary.get('confirmed_records') or 0,
            }
        }
    except Portfolio.DoesNotExist:
        raise HttpError(404, "Portfolio not found")
    except Exception as e:
        logger.error(f"Error fetching dividend history for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, "Could not retrieve dividend history.")

@router.post("/dividends/confirm")
def confirm_dividend(request, confirmation: DividendConfirmationSchema):
    """Confirm dividend receipt"""
    try:
        dividend = DividendPayment.objects.get(id=confirmation.holding_id, ex_date=confirmation.ex_date)
        dividend.confirmed_received = confirmation.confirmed
        dividend.save()
        return {"message": "Dividend confirmation updated successfully"}
    except DividendPayment.DoesNotExist:
        raise HttpError(404, "Dividend record not found")
    except Exception as e:
        raise HttpError(500, str(e))


# =================
# PRICE ALERTS & NEWS
# =================

@router.post("/portfolios/{user_id}/alerts")
def create_price_alert(request, user_id: str, alert_data: PriceAlertSchema):
    """Create a price alert using the enhanced alert service"""
    try:
        from .services.price_alert_service import get_price_alert_service
        
        alert_service = get_price_alert_service()
        alert = alert_service.create_alert(
            user_id=user_id,
            ticker=alert_data.ticker,
            alert_type=alert_data.alert_type,
            target_price=alert_data.target_price
        )
        
        return {
            "message": "Price alert created successfully",
            "alert_id": alert.id,
            "ticker": alert.ticker,
            "alert_type": alert.alert_type,
            "target_price": float(alert.target_price)
        }
    except ValueError as e:
        raise HttpError(400, str(e))
    except Exception as e:
        logger.error(f"Error creating price alert for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, str(e))

@router.get("/portfolios/{user_id}/alerts")
def get_price_alerts(request, user_id: str, active_only: bool = True):
    """Get price alerts for user with enhanced filtering"""
    try:
        from .services.price_alert_service import get_price_alert_service
        
        alert_service = get_price_alert_service()
        alerts = alert_service.get_user_alerts(user_id, active_only=active_only)
        
        alert_data = []
        for alert in alerts:
            alert_data.append({
                'id': alert.id,
                'ticker': alert.ticker,
                'alert_type': alert.alert_type,
                'target_price': float(alert.target_price),
                'is_active': alert.is_active,
                'created_at': alert.created_at,
                'triggered_at': alert.triggered_at
            })
        
        return {
            "alerts": alert_data,
            "total_count": len(alert_data),
            "active_count": len([a for a in alert_data if a['is_active']])
        }
    except Exception as e:
        logger.error(f"Error getting price alerts for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, str(e))

@router.get("/portfolios/{user_id}/news")
def get_portfolio_news(request, user_id: str, limit: int = 50):
    """Get aggregated news for all portfolio stocks"""
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
        tickers = list(portfolio.holdings.values_list('ticker', flat=True).distinct())
        if not tickers:
            return {"news": [], "tickers": []}
        
        news_data = alpha_vantage.get_news_sentiment(tickers=",".join(tickers), limit=limit)
        
        return {"news": news_data.get('feed', []), "tickers": tickers, "count": len(news_data.get('feed', []))}
    except Portfolio.DoesNotExist:
        raise HttpError(404, "Portfolio not found")
    except Exception as e:
        raise HttpError(500, str(e))

@router.delete("/portfolios/{user_id}/alerts/{alert_id}")
def deactivate_price_alert(request, user_id: str, alert_id: int):
    """Deactivate a specific price alert"""
    try:
        from .services.price_alert_service import get_price_alert_service
        
        alert_service = get_price_alert_service()
        success = alert_service.deactivate_alert(alert_id, user_id)
        
        if success:
            return {"message": "Price alert deactivated successfully"}
        else:
            raise HttpError(404, "Price alert not found")
    except Exception as e:
        logger.error(f"Error deactivating price alert {alert_id} for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, str(e))

@router.post("/alerts/check")
def check_price_alerts_manually(request):
    """Manually trigger price alert checking (admin function)"""
    try:
        from .services.price_alert_service import get_price_alert_service
        
        alert_service = get_price_alert_service()
        results = alert_service.check_all_active_alerts()
        
        return {
            "message": "Price alert check completed",
            "results": results
        }
    except Exception as e:
        logger.error(f"Error in manual price alert check: {e}", exc_info=True)
        raise HttpError(500, str(e))

@router.get("/alerts/stats")
def get_alert_statistics(request):
    """Get price alert system statistics"""
    try:
        from .services.price_alert_service import get_price_alert_service
        
        alert_service = get_price_alert_service()
        stats = alert_service.get_alert_statistics()
        
        return {
            "statistics": stats,
            "status": "healthy"
        }
    except Exception as e:
        logger.error(f"Error getting alert statistics: {e}", exc_info=True)
        return {
            "statistics": {"error": str(e)},
            "status": "error"
        }

# =================
# HELPER FUNCTIONS
# =================

def _calculate_current_portfolio_value(portfolio: Portfolio) -> Decimal:
    """Calculate current portfolio value"""
    total_value = portfolio.cash_balance
    for holding in portfolio.holdings.all():
        try:
            quote = alpha_vantage.get_global_quote(holding.ticker)
            current_price = Decimal(str(quote['price'])) if quote and quote.get('price') else holding.purchase_price
            total_value += holding.shares * current_price
        except Exception:
            total_value += holding.shares * holding.purchase_price
    return total_value

def _create_dividend_records_for_holding(holding: Holding):
    """Auto-create dividend records for a holding based on historical data"""
    try:
        historical_data = alpha_vantage.get_daily_adjusted(holding.ticker)
        if not historical_data:
            logger.warning(f"No historical data found for {holding.ticker} when creating dividend records.")
            return

        dividends_found = 0
        for data_point in historical_data.get('data', []):
            data_date = datetime.strptime(data_point['date'], '%Y-%m-%d').date()
            dividend_amount = Decimal(str(data_point.get('dividend_amount', '0')))

            if data_date >= holding.purchase_date and dividend_amount > 0:
                total_dividend = holding.shares * dividend_amount
                _, created = DividendPayment.objects.get_or_create(
                    holding=holding, ex_date=data_date,
                    defaults={'payment_date': data_date, 'amount_per_share': dividend_amount, 'total_amount': total_dividend}
                )
                if created:
                    dividends_found += 1
        
        if dividends_found > 0:
            logger.info(f"Successfully created {dividends_found} dividend records for {holding.ticker}.")
        else:
            logger.info(f"No new dividend payments found for {holding.ticker} since purchase date {holding.purchase_date}.")

    except Exception as e:
        logger.error(f"Error creating dividend records for {holding.ticker}: {e}", exc_info=True)

@router.get("/alpha_vantage/stats")
def get_alpha_vantage_stats(request):
    """Get Alpha Vantage API usage statistics"""
    av_service = get_alpha_vantage_service()
    return av_service.get_api_usage_stats()

@router.get("/cache/stats")
def get_cache_stats(request):
    """Get market data cache statistics"""
    try:
        from .services.market_data_cache import get_market_data_cache_service
        
        cache_service = get_market_data_cache_service()
        cache_stats = cache_service.get_cache_stats()
        
        # Add Alpha Vantage stats for comparison
        av_service = get_alpha_vantage_service()
        av_stats = av_service.get_api_usage_stats()
        
        return {
            "cache": cache_stats,
            "alpha_vantage": av_stats,
            "status": "healthy"
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}", exc_info=True)
        return {
            "cache": {"error": str(e)},
            "alpha_vantage": {"error": "Unable to fetch stats"},
            "status": "error"
        }

# Schemas for the Advanced Financials Endpoint
class ValuationMetrics(Schema):
    market_capitalization: Optional[float]
    pe_ratio: Optional[float]
    pb_ratio: Optional[float]
    peg_ratio: Optional[float]
    ev_to_ebitda: Optional[float]
    dividend_yield: Optional[float]

class HealthMetrics(Schema):
    current_ratio: Optional[float]
    debt_to_equity_ratio: Optional[float]
    interest_coverage_ratio: Optional[float]
    free_cash_flow_ttm: Optional[float]

class PerformanceMetrics(Schema):
    revenue_growth_yoy: Optional[float]
    revenue_growth_5y_cagr: Optional[float]
    eps_growth_yoy: Optional[float]
    eps_growth_5y_cagr: Optional[float]
    return_on_equity_ttm: Optional[float]
    return_on_assets_ttm: Optional[float]

class ProfitabilityMetrics(Schema):
    gross_margin: Optional[float]
    operating_margin: Optional[float]
    net_profit_margin: Optional[float]

class DividendMetrics(Schema):
    dividend_payout_ratio: Optional[float]
    dividend_growth_rate_3y_cagr: Optional[float]

class RawDataSummary(Schema):
    beta: Optional[float]
    eps_ttm: Optional[float]
    shares_outstanding: Optional[float]

class AdvancedFinancialsResponse(Schema):
    valuation: ValuationMetrics
    financial_health: HealthMetrics
    performance: PerformanceMetrics
    profitability: ProfitabilityMetrics
    dividends: DividendMetrics
    raw_data_summary: RawDataSummary

class ErrorResponse(Schema):
    ok: bool = False
    error: str

@router.get(
    "/stocks/{symbol}/advanced_financials",
    response={200: AdvancedFinancialsResponse, 400: ErrorResponse, 404: ErrorResponse, 500: ErrorResponse},
    summary="Get Advanced Financial Metrics for a Stock"
)
def advanced_financials(request, symbol: str):
    """
    Provides a comprehensive set of derived financial metrics for a given stock,
    logically grouped into categories.
    """
    logger.debug(f"Starting advanced financials fetch for symbol: {symbol}")
    try:
        from .services.market_data_cache import get_market_data_cache_service
        
        cache_service = get_market_data_cache_service()
        
        # Try to get cached advanced metrics first
        cached_metrics = cache_service.get_advanced_financials(symbol)
        if cached_metrics:
            logger.info(f"Successfully retrieved cached advanced metrics for {symbol}")
            return 200, cached_metrics
        
        # Fallback to live calculation if not in cache
        logger.debug(f"No cached metrics found for {symbol}, calculating from live data")
        av_service = get_alpha_vantage_service()
        
        # 1. Fetch all required raw data
        logger.debug(f"Fetching company overview for {symbol}")
        overview = av_service.get_company_overview(symbol)
        if not overview or "MarketCapitalization" not in overview:
             logger.warning(f"Could not retrieve valid company overview for {symbol}.")
             raise HttpError(404, f"Could not retrieve fundamental data for symbol: {symbol}. It may be an unsupported ticker.")

        logger.debug(f"Fetching income statements for {symbol}")
        income_statement = av_service.get_income_statement(symbol)

        logger.debug(f"Fetching balance sheets for {symbol}")
        balance_sheet = av_service.get_balance_sheet(symbol)

        logger.debug(f"Fetching cash flow statements for {symbol}")
        cash_flow = av_service.get_cash_flow(symbol)

        # Check if we have the essential data to proceed
        if not all([income_statement, balance_sheet, cash_flow]):
            logger.warning(f"Missing one or more financial statements for {symbol}.")

        # 2. Calculate the metrics using the service
        logger.debug(f"Calculating advanced metrics for {symbol}")
        metrics = calculate_advanced_metrics(
            overview=overview,
            income_annual=income_statement.get('annual_reports', []),
            income_quarterly=income_statement.get('quarterly_reports', []),
            balance_annual=balance_sheet.get('annual_reports', []),
            balance_quarterly=balance_sheet.get('quarterly_reports', []),
            cash_flow_annual=cash_flow.get('annual_reports', []),
            cash_flow_quarterly=cash_flow.get('quarterly_reports', []),
        )
        
        # Add source information
        metrics['source'] = 'alpha_vantage'
        metrics['cache_note'] = 'Consider running update_market_data command to cache this data'
        
        logger.info(f"Successfully calculated advanced metrics for {symbol}")
        return 200, metrics

    except HttpError as e:
        logger.error(f"HttpError in advanced_financials for {symbol}: {e.message}", exc_info=True)
        return e.status_code, {"ok": False, "error": e.message}
    except Exception as e:
        logger.exception(f"An unexpected error occurred in advanced_financials for {symbol}: {e}")
        return 500, {"ok": False, "error": "An internal server error occurred."}

@router.get("/portfolios/{user_id}/optimization")
def get_portfolio_optimization(request, user_id: str):
    """Get comprehensive portfolio optimization analysis including risk assessment"""
    try:
        from .services.portfolio_optimization import get_portfolio_optimization_service
        
        optimization_service = get_portfolio_optimization_service()
        analysis = optimization_service.analyze_portfolio(user_id)
        
        return {
            "analysis": analysis,
            "status": "success"
        }
    except ValueError as e:
        logger.error(f"Portfolio not found for optimization analysis: {user_id}")
        raise HttpError(404, str(e))
    except Exception as e:
        logger.error(f"Error in portfolio optimization for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, f"Portfolio optimization analysis failed: {str(e)}")


@router.get("/portfolios/{user_id}/risk-assessment")
def get_portfolio_risk_assessment(request, user_id: str):
    """Get detailed portfolio risk assessment"""
    try:
        from .services.portfolio_optimization import get_portfolio_optimization_service
        
        optimization_service = get_portfolio_optimization_service()
        analysis = optimization_service.analyze_portfolio(user_id)
        
        # Extract just the risk-related information
        risk_data = {
            'portfolio_metrics': {
                'volatility': analysis['portfolio_metrics']['volatility'],
                'beta': analysis['portfolio_metrics']['beta'],
                'var_95': analysis['portfolio_metrics']['var_95'],
                'sharpe_ratio': analysis['portfolio_metrics']['sharpe_ratio']
            },
            'risk_assessment': analysis['risk_assessment'],
            'diversification': analysis['diversification'],
            'analysis_date': analysis['analysis_date']
        }
        
        return {
            "risk_analysis": risk_data,
            "status": "success"
        }
    except ValueError as e:
        logger.error(f"Portfolio not found for risk assessment: {user_id}")
        raise HttpError(404, str(e))
    except Exception as e:
        logger.error(f"Error in portfolio risk assessment for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, f"Portfolio risk assessment failed: {str(e)}")


@router.get("/portfolios/{user_id}/diversification")
def get_portfolio_diversification(request, user_id: str):
    """Get portfolio diversification analysis"""
    try:
        from .services.portfolio_optimization import get_portfolio_optimization_service
        
        optimization_service = get_portfolio_optimization_service()
        analysis = optimization_service.analyze_portfolio(user_id)
        
        # Extract diversification information
        diversification_data = {
            'diversification': analysis['diversification'],
            'holdings_analysis': analysis['holdings_analysis'],
            'total_holdings': analysis['total_holdings'],
            'analysis_date': analysis['analysis_date']
        }
        
        return {
            "diversification_analysis": diversification_data,
            "status": "success"
        }
    except ValueError as e:
        logger.error(f"Portfolio not found for diversification analysis: {user_id}")
        raise HttpError(404, str(e))
    except Exception as e:
        logger.error(f"Error in portfolio diversification analysis for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, f"Portfolio diversification analysis failed: {str(e)}")


@router.post("/transactions/create")
def create_transaction(request):
    """
    Create a new transaction (BUY/SELL/DIVIDEND).
    
    Handles transaction creation with historical data fetching and portfolio updates.
    """
    logger.info(f"[TransactionAPI] Creating transaction for user")
    logger.debug(f"[TransactionAPI] Request data: {request.body}")
    
    try:
        import json
        data = json.loads(request.body) if request.body else {}
        
        # Extract user ID from request - assuming it's in headers or session
        # For now using a test user ID - this should come from authentication
        user_id = data.get('user_id', 'test_user_123')
        
        # Validate required fields
        required_fields = ['transaction_type', 'ticker', 'shares', 'price_per_share', 'transaction_date']
        for field in required_fields:
            if field not in data:
                logger.warning(f"[TransactionAPI] Missing required field: {field}")
                return {
                    'ok': False,
                    'error': f'Missing required field: {field}',
                    'required_fields': required_fields
                }
        
        # Get company name from ticker if not provided
        transaction_data = data.copy()
        if 'company_name' not in transaction_data or not transaction_data['company_name']:
            logger.debug(f"[TransactionAPI] Fetching company name for ticker {transaction_data['ticker']}")
            try:
                service = get_alpha_vantage_service()
                overview = service.get_company_overview(transaction_data['ticker'])
                transaction_data['company_name'] = overview.get('Name', transaction_data['ticker'])
                logger.debug(f"[TransactionAPI] Company name: {transaction_data['company_name']}")
            except Exception as e:
                logger.warning(f"[TransactionAPI] Could not fetch company name: {e}")
                transaction_data['company_name'] = transaction_data['ticker']
        
        # Create transaction using service
        transaction_service = get_transaction_service()
        result = transaction_service.create_transaction(user_id, transaction_data)
        
        if result['success']:
            logger.info(f"[TransactionAPI] ✅ Transaction created successfully: {result['transaction_id']}")
            return {
                'ok': True,
                'message': result['message'],
                'data': {
                    'transaction_id': result['transaction_id'],
                    'ticker': result['ticker']
                }
            }
        else:
            logger.error(f"[TransactionAPI] ❌ Transaction creation failed: {result['error']}")
            return {
                'ok': False,
                'error': result['error'],
                'message': result['message']
            }
    
    except Exception as e:
        logger.error(f"[TransactionAPI] Unexpected error creating transaction: {e}", exc_info=True)
        return {
            'ok': False,
            'error': 'internal_server_error',
            'message': 'An unexpected error occurred while creating the transaction'
        }


@router.get("/transactions/user")
def get_user_transactions(request):
    """
    Get user's transaction history with optional filtering.
    
    Query parameters:
    - transaction_type: BUY, SELL, DIVIDEND (optional)
    - ticker: Filter by specific ticker (optional)
    - start_date: Filter from date (optional)
    - end_date: Filter to date (optional)
    """
    logger.info(f"[TransactionAPI] Getting user transactions")
    
    try:
        # Get user ID - for now using test user
        user_id = request.GET.get('user_id', 'test_user_123')
        
        # Get filter parameters
        transaction_type = request.GET.get('transaction_type')
        ticker = request.GET.get('ticker')
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        
        logger.debug(f"[TransactionAPI] Filters - type: {transaction_type}, ticker: {ticker}, dates: {start_date} to {end_date}")
        
        # Get transactions from service
        transaction_service = get_transaction_service()
        transactions = transaction_service.get_user_transactions(user_id, transaction_type, ticker)
        
        # Apply date filtering if provided
        if start_date or end_date:
            filtered_transactions = []
            for txn in transactions:
                txn_date = txn['transaction_date']
                if isinstance(txn_date, str):
                    txn_date = datetime.strptime(txn_date, '%Y-%m-%d').date()
                
                include = True
                if start_date and txn_date < datetime.strptime(start_date, '%Y-%m-%d').date():
                    include = False
                if end_date and txn_date > datetime.strptime(end_date, '%Y-%m-%d').date():
                    include = False
                
                if include:
                    filtered_transactions.append(txn)
            
            transactions = filtered_transactions
        
        logger.info(f"[TransactionAPI] ✅ Retrieved {len(transactions)} transactions")
        
        return {
            'ok': True,
            'message': 'Transactions retrieved successfully',
            'data': {
                'transactions': transactions,
                'count': len(transactions),
                'filters_applied': {
                    'transaction_type': transaction_type,
                    'ticker': ticker,
                    'start_date': start_date,
                    'end_date': end_date
                }
            }
        }
    
    except Exception as e:
        logger.error(f"[TransactionAPI] Error getting transactions: {e}", exc_info=True)
        return {
            'ok': False,
            'error': 'internal_server_error',
            'message': 'Failed to retrieve transactions'
        }


@router.post("/transactions/update-prices")
def update_current_prices(request):
    """
    Update current prices for user's holdings with rate limiting.
    
    Rate limited to once per minute per user.
    """
    logger.info(f"[TransactionAPI] Updating current prices")
    
    try:
        import json
        data = json.loads(request.body) if request.body else {}
        
        # Get user ID
        user_id = data.get('user_id', 'test_user_123')
        
        # Update prices using service
        price_service = get_price_update_service()
        result = price_service.update_user_current_prices(user_id)
        
        if result['success']:
            logger.info(f"[TransactionAPI] ✅ Prices updated successfully")
            return {
                'ok': True,
                'message': 'Current prices updated successfully',
                'data': result
            }
        else:
            if result.get('error') == 'rate_limited':
                logger.warning(f"[TransactionAPI] ⚠️ Rate limit exceeded for user {user_id}")
                return {
                    'ok': False,
                    'error': 'rate_limited',
                    'message': result['message'],
                    'retry_after': result.get('retry_after', 60)
                }
            else:
                logger.error(f"[TransactionAPI] ❌ Price update failed: {result['error']}")
                return {
                    'ok': False,
                    'error': result['error'],
                    'message': result['message']
                }
    
    except Exception as e:
        logger.error(f"[TransactionAPI] Error updating prices: {e}", exc_info=True)
        return {
            'ok': False,
            'error': 'internal_server_error',
            'message': 'Failed to update current prices'
        }


@router.get("/transactions/cached-prices")
def get_current_prices(request):
    """
    Get cached current prices for user's holdings.
    """
    logger.debug(f"[TransactionAPI] Getting cached current prices")
    
    try:
        user_id = request.GET.get('user_id', 'test_user_123')
        
        price_service = get_price_update_service()
        result = price_service.get_cached_prices(user_id)
        
        logger.debug(f"[TransactionAPI] ✅ Retrieved {len(result['prices'])} cached prices")
        
        return {
            'ok': True,
            'message': 'Cached prices retrieved successfully',
            'data': result
        }
    
    except Exception as e:
        logger.error(f"[TransactionAPI] Error getting cached prices: {e}", exc_info=True)
        return {
            'ok': False,
            'error': 'internal_server_error',
            'message': 'Failed to retrieve cached prices'
        }


@router.get("/transactions/summary")
def get_transaction_summary(request):
    """
    Get transaction summary and portfolio calculations based on transactions.
    """
    logger.info(f"[TransactionAPI] Getting transaction summary")
    
    try:
        user_id = request.GET.get('user_id', 'test_user_123')
        
        # Get user's transactions
        transactions = Transaction.objects.filter(user_id=user_id).order_by('-transaction_date')
        
        # Calculate summary statistics
        total_transactions = transactions.count()
        buy_transactions = transactions.filter(transaction_type='BUY').count()
        sell_transactions = transactions.filter(transaction_type='SELL').count()
        dividend_transactions = transactions.filter(transaction_type='DIVIDEND').count()
        
        # Calculate total invested and received
        from decimal import Decimal
        total_invested = transactions.filter(transaction_type='BUY').aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0')
        
        total_received = transactions.filter(transaction_type='SELL').aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0')
        
        total_dividends = transactions.filter(transaction_type='DIVIDEND').aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0')
        
        # Get unique tickers
        unique_tickers = transactions.filter(
            transaction_type__in=['BUY', 'SELL']
        ).values_list('ticker', flat=True).distinct()
        
        logger.info(f"[TransactionAPI] ✅ Summary calculated: {total_transactions} transactions across {len(unique_tickers)} tickers")
        
        return {
            'ok': True,
            'message': 'Transaction summary retrieved successfully',
            'data': {
                'summary': {
                    'total_transactions': total_transactions,
                    'buy_transactions': buy_transactions,
                    'sell_transactions': sell_transactions,
                    'dividend_transactions': dividend_transactions,
                    'unique_tickers': len(unique_tickers),
                    'total_invested': float(total_invested),
                    'total_received': float(total_received),
                    'total_dividends': float(total_dividends),
                    'net_invested': float(total_invested - total_received)
                },
                'tickers': list(unique_tickers)
            }
        }
    
    except Exception as e:
        logger.error(f"[TransactionAPI] Error getting transaction summary: {e}", exc_info=True)
        return {
            'ok': False,
            'error': 'internal_server_error',
            'message': 'Failed to retrieve transaction summary'
        }


@router.post("/transactions/migrate")
def migrate_existing_holdings(request):
    """
    One-time migration script to populate the new Transaction model
    from the old Holding and CashContribution models.
    """
    transaction_service = get_transaction_service(user_id="migration_user")
    
    try:
        summary = transaction_service.migrate_from_holdings()
        return success_response(data=summary)
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        return error_response(message=f"Migration failed: {e}", status_code=500)


@router.get("/health")
def health_check(request):
    # ... existing code ...

