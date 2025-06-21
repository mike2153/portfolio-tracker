from django.shortcuts import render
from ninja import NinjaAPI, Schema
from ninja.errors import HttpError
from django.http import JsonResponse
from django.db.models import Q, Sum, Avg, F, Count, DecimalField, Case, When, Value, IntegerField

# pyright: reportAttributeAccessIssue=false
# pyright: reportOperatorIssue=false  
# pyright: reportArgumentType=false
# pyright: reportReturnType=false
from .models import (
    StockSymbol, SymbolRefreshLog, Portfolio, Holding, 
    CashContribution, DividendPayment, PriceAlert, PortfolioSnapshot
)
from .alpha_vantage_service import alpha_vantage
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
import os
import json
import logging
import time

logger = logging.getLogger(__name__)

# Create your views here.

api = NinjaAPI()

@api.get("/health")
def health_check(request):
    """Health check endpoint for system status monitoring"""
    try:
        # Check database connectivity
        symbol_count = StockSymbol.objects.filter(is_active=True).count()
        
        # Check if we have any symbols loaded
        has_data = symbol_count > 0
        
        # Check if API keys are configured (without exposing them)
        has_alpha_vantage_key = bool(os.getenv('ALPHA_VANTAGE_API_KEY'))
        
        return {
            "status": "healthy",
            "message": "Portfolio Analytics API is running",
            "database": "connected",
            "symbols_loaded": symbol_count,
            "data_ready": has_data,
            "external_apis": "configured" if has_alpha_vantage_key else "pending_configuration",
            "api_provider": "Alpha Vantage",
            "version": "1.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy", 
            "message": f"System error: {str(e)}",
            "database": "error",
            "symbols_loaded": 0,
            "data_ready": False,
            "external_apis": "unknown",
            "api_provider": "Alpha Vantage",
            "version": "1.0.0"
        }

@api.get("/symbols/search")
def search_symbols(request, q: str = "", exchange: str = "", limit: int = 25):
    """
    Comprehensive symbol search across all loaded exchanges
    
    Args:
        q: Search query (symbol or company name)
        exchange: Filter by specific exchange code (optional)
        limit: Maximum number of results to return (default: 25, max: 100)
    """
    
    if not q or len(q.strip()) < 1:
        return {"results": [], "total": 0, "query": q}
    
    # Limit the number of results
    limit = min(limit, 100)
    query = q.strip()
    
    # Build search filter
    search_filter = Q(is_active=True)
    
    # Add exchange filter if specified
    if exchange:
        search_filter &= Q(exchange_code=exchange)
    
    # Search in symbol and name fields
    query_filter = (
        Q(symbol__icontains=query) |
        Q(name__icontains=query) |
        Q(symbol__istartswith=query) |
        Q(name__istartswith=query)
    )
    
    search_filter &= query_filter
    
    # Execute search with ordering for relevance
    symbols = StockSymbol.objects.filter(search_filter).annotate(
        relevance=Case(
            When(symbol__iexact=query, then=Value(1)),
            When(symbol__istartswith=query, then=Value(2)),
            When(name__istartswith=query, then=Value(3)),
            default=Value(4),
            output_field=IntegerField(),
        )
    ).order_by('relevance', 'symbol')[:limit]
    
    # Convert to response format
    results = []
    for symbol in symbols:
        results.append({
            'symbol': symbol.symbol,
            'name': symbol.name,
            'exchange': symbol.exchange_name,
            'exchange_code': symbol.exchange_code,
            'currency': symbol.currency,
            'country': symbol.country,
            'type': symbol.type
        })
    
    # Get total count for the query
    total_count = StockSymbol.objects.filter(search_filter).count()
    
    return {
        "results": results,
        "total": total_count,
        "query": query,
        "limit": limit,
        "source": "database"
    }


@api.get("/symbols/stats")
def symbol_stats(request):
    """Get statistics about loaded symbols"""
    
    # Get total symbols by exchange
    exchange_stats = list(
        StockSymbol.objects.values('exchange_code', 'exchange_name', 'country')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    
    # Get refresh logs
    refresh_logs = list(
        SymbolRefreshLog.objects.all()
        .order_by('-last_refresh')
        .values('exchange_code', 'last_refresh', 'total_symbols', 'success', 'error_message')
    )
    
    total_symbols = StockSymbol.objects.filter(is_active=True).count()
    
    return {
        "total_symbols": total_symbols,
        "exchanges": exchange_stats,
        "refresh_logs": refresh_logs,
        "last_updated": max(
            (log['last_refresh'] for log in refresh_logs if log['last_refresh']), 
            default=None
        )
    }


@api.get("/symbols/refresh")
def refresh_symbols(request, exchange: str = ""):
    """
    Trigger a refresh of symbol data from external APIs
    Note: This is a simplified endpoint. In production, this should be a POST with authentication
    """
    
    # This would trigger the management command
    # For now, just return information about when to refresh
    
    refresh_logs = SymbolRefreshLog.objects.all()
    if exchange:
        refresh_logs = refresh_logs.filter(exchange_code=exchange)
    
    logs = list(refresh_logs.values())
    
    return {
        "message": "To refresh symbols, run: python manage.py load_symbols",
        "current_status": logs,
        "refresh_command": f"python manage.py load_symbols {'--exchange ' + exchange if exchange else ''}",
    }


# Pydantic schemas for request/response validation
class CashContributionSchema(Schema):
    amount: float
    contribution_date: date
    description: str = ""

class HoldingSchema(Schema):
    ticker: str
    company_name: str
    exchange: str = ""
    shares: float
    purchase_price: float
    purchase_date: date
    commission: float = 0.0
    used_cash_balance: bool = False
    currency: str = "USD"
    fx_rate: float = 1.0

class PriceAlertSchema(Schema):
    ticker: str
    alert_type: str  # 'above' or 'below'
    target_price: float

class DividendConfirmationSchema(Schema):
    holding_id: int
    ex_date: date
    confirmed: bool


# =================
# STOCK ANALYSIS ENDPOINTS
# =================

@api.get("/stocks/{symbol}/overview")
def get_stock_overview(request, symbol: str):
    """Get comprehensive stock overview including fundamentals"""
    try:
        symbol_upper = symbol.upper()
        overview = alpha_vantage.get_company_overview(symbol_upper)
        quote = alpha_vantage.get_global_quote(symbol_upper)
        
        if not overview and not quote:
            raise HttpError(404, f"Complete data could not be found for ticker {symbol_upper} from our provider.")

        # Combine any data we did find
        combined_data = {**(overview or {}), **(quote or {})}

        return {
            "symbol": symbol_upper,
            "data": combined_data,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting stock overview for {symbol}: {e}", exc_info=True)
        raise HttpError(500, f"An unexpected error occurred while retrieving the overview for {symbol}.")

@api.get("/stocks/{symbol}/historical")
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

@api.get("/stocks/{symbol}/financials/{statement_type}")
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

@api.get("/stocks/{symbol}/news")
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

@api.get("/portfolios/{user_id}")
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

@api.get("/portfolios/{user_id}/performance")
def get_portfolio_performance(request, user_id: str, period: str = "1Y", benchmark: str = "^GSPC"):
    """Get time-weighted portfolio performance with benchmark comparison"""
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
        
        period_days = {"1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "3Y": 1095, "5Y": 1825}
        days = period_days.get(period.upper(), 365)
        start_date = date.today() - timedelta(days=days)
        
        holdings = portfolio.holdings.filter(purchase_date__lt=date.today()).order_by('purchase_date')
        
        if not holdings.exists():
            return {"portfolio_performance": [], "benchmark_performance": [], "period": period, "benchmark_symbol": benchmark, "comparison": {"portfolio_return": 0, "benchmark_return": 0, "outperformance": 0}}
            
        tickers = list(holdings.values_list('ticker', flat=True).distinct())
        
        all_historical_data = {}
        failed_tickers = []
        for ticker in tickers + [benchmark]:
            historical_data = alpha_vantage.get_daily_adjusted(ticker, outputsize='full')
            if historical_data and historical_data.get('data'):
                all_historical_data[ticker] = {item['date']: item['adjusted_close'] for item in historical_data.get('data', [])}
            else:
                failed_tickers.append(ticker)
                logger.warning(f"Could not retrieve historical data for '{ticker}'. It will be excluded from performance calculation.")
        
        if benchmark in failed_tickers:
             raise HttpError(503, f"Failed to retrieve market data for benchmark symbol '{benchmark}'.")
        
        date_range = [start_date + timedelta(days=x) for x in range(days + 1)]
        portfolio_performance = []
        
        for current_date in date_range:
            date_str = current_date.strftime('%Y-%m-%d')
            daily_portfolio_value = Decimal('0.0')
            
            for holding in holdings.filter(purchase_date__lte=current_date):
                price_data = all_historical_data.get(holding.ticker, {})
                price_date_keys = sorted([d for d in price_data.keys() if d <= date_str], reverse=True)
                if price_date_keys:
                    latest_price = Decimal(str(price_data[price_date_keys[0]]))
                    daily_portfolio_value += holding.shares * latest_price

            daily_portfolio_value += portfolio.cash_balance
            if daily_portfolio_value > 0:
                portfolio_performance.append({'date': date_str, 'total_value': daily_portfolio_value})

        if not portfolio_performance:
            return {"portfolio_performance": [], "benchmark_performance": [], "period": period, "benchmark_symbol": benchmark, "comparison": {"portfolio_return": 0, "benchmark_return": 0, "outperformance": 0}}

        base_portfolio_value = portfolio_performance[0]['total_value']
        for point in portfolio_performance:
            point['performance_return'] = float(((point['total_value'] / base_portfolio_value) - 1) * 100)
            point['total_value'] = float(point['total_value'])

        benchmark_performance = []
        benchmark_prices = all_historical_data.get(benchmark, {})
        relevant_benchmark_prices = {d: p for d, p in benchmark_prices.items() if start_date <= datetime.strptime(d, '%Y-%m-%d').date() <= date.today()}
        
        if relevant_benchmark_prices:
            sorted_benchmark_dates = sorted(relevant_benchmark_prices.keys())
            base_benchmark_price = Decimal(str(relevant_benchmark_prices[sorted_benchmark_dates[0]]))
            for d in sorted_benchmark_dates:
                price = Decimal(str(relevant_benchmark_prices[d]))
                benchmark_performance.append({'date': d, 'performance_return': float(((price / base_benchmark_price) - 1) * 100)})

        portfolio_return = portfolio_performance[-1]['performance_return'] if portfolio_performance else 0
        benchmark_return = benchmark_performance[-1]['performance_return'] if benchmark_performance else 0
        outperformance = portfolio_return - benchmark_return
        
        return {
            "portfolio_performance": portfolio_performance, "benchmark_performance": benchmark_performance, "period": period, "benchmark_symbol": benchmark,
            "comparison": {"portfolio_return": round(float(portfolio_return), 2), "benchmark_return": round(float(benchmark_return), 2), "outperformance": round(float(outperformance), 2)}
        }
    except Portfolio.DoesNotExist:
        raise HttpError(404, "Portfolio not found")
    except Exception as e:
        logger.error(f"Error in get_portfolio_performance: {e}", exc_info=True)
        raise HttpError(500, f"An unexpected error occurred: {e}")

@api.post("/portfolios/{user_id}/holdings")
def add_holding(request, user_id: str, holding_data: HoldingSchema):
    """Add a new stock holding to portfolio"""
    try:
        portfolio, _ = Portfolio.objects.get_or_create(user_id=user_id)
        total_cost = (Decimal(str(holding_data.shares)) * Decimal(str(holding_data.purchase_price))) + Decimal(str(holding_data.commission))
        if holding_data.used_cash_balance:
            if portfolio.cash_balance < total_cost:
                raise HttpError(400, "Insufficient cash balance")
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
        return {"message": "Holding added successfully", "holding_id": holding.id, "remaining_cash": float(portfolio.cash_balance)}
    except Exception as e:
        logger.error(f"Error adding holding for user {user_id}: {e}", exc_info=True)
        raise HttpError(500, "Could not add holding.")


# =================
# CASH & DIVIDEND MANAGEMENT
# =================

@api.post("/portfolios/{user_id}/cash")
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

@api.get("/portfolios/{user_id}/dividends")
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

@api.post("/dividends/confirm")
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

@api.post("/portfolios/{user_id}/alerts")
def create_price_alert(request, user_id: str, alert_data: PriceAlertSchema):
    """Create a price alert"""
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
        alert = PriceAlert.objects.create(
            portfolio=portfolio, ticker=alert_data.ticker.upper(),
            alert_type=alert_data.alert_type, target_price=Decimal(str(alert_data.target_price))
        )
        return {"message": "Price alert created successfully", "alert_id": alert.id}
    except Portfolio.DoesNotExist:
        raise HttpError(404, "Portfolio not found")
    except Exception as e:
        raise HttpError(500, str(e))

@api.get("/portfolios/{user_id}/alerts")
def get_price_alerts(request, user_id: str):
    """Get active price alerts"""
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
        alerts = list(portfolio.price_alerts.filter(is_active=True).order_by('-created_at').values())
        return {"alerts": alerts}
    except Portfolio.DoesNotExist:
        raise HttpError(404, "Portfolio not found")
    except Exception as e:
        raise HttpError(500, str(e))

@api.get("/portfolios/{user_id}/news")
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
        except:
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

@api.get("/alpha_vantage/stats")
def get_alpha_vantage_stats(request):
    """Provides statistics on Alpha Vantage API usage."""
    # The alpha_vantage object is a singleton, so we can access its state directly.
    current_time = time.time()
    
    # Filter out timestamps older than 60 seconds to get the current count
    recent_timestamps = [
        t for t in alpha_vantage.request_timestamps if current_time - t < 60
    ]
    alpha_vantage.request_timestamps = recent_timestamps # Prune the list
    
    request_count = len(alpha_vantage.request_timestamps)
    
    return {
        "requests_in_last_60_seconds": request_count,
        "rate_limit_per_minute": 70,
        "remaining_in_window": 70 - request_count,
        "status": "OK" if request_count < 60 else "WARNING: Nearing rate limit."
    }
