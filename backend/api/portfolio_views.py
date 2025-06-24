from ninja import Router
from .alpha_vantage_service import alpha_vantage
from .models import Portfolio, Transaction
from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Max
from cachetools import TTLCache

portfolio_api_router = Router()

# Simple in-memory cache shared across endpoints
_CACHE = TTLCache(maxsize=64, ttl=300)


def _cache_key(prefix: str, user_id: str) -> tuple:
    last_change = Transaction.objects.filter(user_id=user_id).aggregate(m=Max('updated_at'))['m']
    return (prefix, user_id, str(last_change))


@portfolio_api_router.get('/summary')
def portfolio_summary(request, user_id: str = None):
    user_id = user_id or getattr(request, 'user_id', None) or getattr(request, 'auth', None) or getattr(request, 'user', None)
    if not user_id:
        # Fallback to mock user from other modules
        from .views import get_current_user
        user_id = get_current_user(request).id

    key = _cache_key('summary', user_id)
    if key in _CACHE:
        return _CACHE[key]

    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
    except Portfolio.DoesNotExist:
        return {'holdings_value': 0, 'cash_balance': 0, 'total_value': 0}

    total_cost = Decimal('0')
    holdings_value = Decimal('0')
    for holding in portfolio.holdings.all():
        quote = alpha_vantage.get_global_quote(holding.ticker)
        price = Decimal(str(quote['price'])) if quote and quote.get('price') else holding.purchase_price
        holdings_value += holding.shares * price
        total_cost += holding.shares * holding.purchase_price

    cash = portfolio.cash_balance or Decimal('0')
    data = {
        'holdings_value': float(holdings_value),
        'cash_balance': float(cash),
        'total_value': float(holdings_value + cash),
        'invested': float(total_cost),
        'profit': float((holdings_value + cash) - total_cost),
    }
    _CACHE[key] = data
    return data


@portfolio_api_router.get('/history')
def portfolio_history(request, days: int = 30, benchmark: str = '^GSPC', user_id: str = None):
    user_id = user_id or getattr(request, 'user_id', None) or getattr(request, 'auth', None) or getattr(request, 'user', None)
    if not user_id:
        from .views import get_current_user
        user_id = get_current_user(request).id

    key = _cache_key(f'history-{days}-{benchmark}', user_id)
    if key in _CACHE:
        return _CACHE[key]

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
    except Portfolio.DoesNotExist:
        return {'portfolio': [], 'benchmark': []}

    holdings = list(portfolio.holdings.all())
    price_data = {}
    for h in holdings:
        data = alpha_vantage.get_daily_adjusted(h.ticker)
        if not data or not data.get('data'):
            continue
        price_data[h.ticker] = {i['date']: Decimal(str(i['adjusted_close'])) for i in data['data']}

    index_data = alpha_vantage.get_daily_adjusted(benchmark)
    benchmark_prices = {i['date']: Decimal(str(i['adjusted_close'])) for i in index_data.get('data', [])} if index_data else {}

    history = []
    benchmark_history = []
    for offset in range(days + 1):
        d = (start_date + timedelta(days=offset)).strftime('%Y-%m-%d')
        value = Decimal('0')
        for h in holdings:
            pdict = price_data.get(h.ticker, {})
            if d in pdict:
                value += h.shares * pdict[d]
        value += portfolio.cash_balance
        history.append({'date': d, 'value': float(value)})
        if d in benchmark_prices:
            benchmark_history.append({'date': d, 'value': float(benchmark_prices[d])})

    result = {'portfolio': history, 'benchmark': benchmark_history}
    _CACHE[key] = result
    return result


@portfolio_api_router.get('/movers')
def portfolio_movers(request, limit: int = 5, user_id: str = None):
    user_id = user_id or getattr(request, 'user_id', None) or getattr(request, 'auth', None) or getattr(request, 'user', None)
    if not user_id:
        from .views import get_current_user
        user_id = get_current_user(request).id

    key = _cache_key(f'movers-{limit}', user_id)
    if key in _CACHE:
        return _CACHE[key]

    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
    except Portfolio.DoesNotExist:
        return {'gainers': [], 'losers': []}

    movers = []
    for h in portfolio.holdings.all():
        quote = alpha_vantage.get_global_quote(h.ticker)
        if not quote:
            continue
        movers.append({'ticker': h.ticker, 'change_percent': quote.get('change_percent', 0)})

    movers.sort(key=lambda x: x['change_percent'], reverse=True)
    result = {
        'gainers': movers[:limit],
        'losers': movers[-limit:][::-1] if movers else []
    }
    _CACHE[key] = result
    return result


@portfolio_api_router.get('/benchmarks')
def portfolio_benchmarks(request, period: str = '1Y', benchmark: str = '^GSPC', user_id: str = None):
    user_id = user_id or getattr(request, 'user_id', None) or getattr(request, 'auth', None) or getattr(request, 'user', None)
    if not user_id:
        from .views import get_current_user
        user_id = get_current_user(request).id

    key = _cache_key(f'benchmarks-{period}-{benchmark}', user_id)
    if key in _CACHE:
        return _CACHE[key]

    from .services.portfolio_benchmarking import calculate_enhanced_portfolio_performance
    result = calculate_enhanced_portfolio_performance(user_id, period, benchmark)
    _CACHE[key] = result
    return result
