# backend/api/services/portfolio_benchmarking.py
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any
from ..models import Portfolio, Holding
from ..alpha_vantage_service import get_alpha_vantage_service

logger = logging.getLogger(__name__)

# Supported benchmarks with their Alpha Vantage symbols
SUPPORTED_BENCHMARKS = {
    '^GSPC': 'S&P 500',
    '^IXIC': 'NASDAQ Composite', 
    '^DJI': 'Dow Jones Industrial Average',
    '^AXJO': 'ASX 200',
    '^FTSE': 'FTSE 100',
    '^N225': 'Nikkei 225'
}

def _parse_period_to_dates(period: str) -> Tuple[date, int]:
    """
    Parse period string to start date and number of days.
    
    Args:
        period: One of '1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'ALL'
    
    Returns:
        Tuple of (start_date, days_count)
    """
    today = date.today()
    
    if period == '1M':
        start_date = today - timedelta(days=30)
        days = 30
    elif period == '3M':
        start_date = today - timedelta(days=90)
        days = 90
    elif period == 'YTD':
        start_date = date(today.year, 1, 1)
        days = (today - start_date).days
    elif period == '1Y':
        start_date = today - timedelta(days=365)
        days = 365
    elif period == '3Y':
        start_date = today - timedelta(days=365*3)
        days = 365*3
    elif period == '5Y':
        start_date = today - timedelta(days=365*5)
        days = 365*5
    elif period == 'ALL':
        # Use a reasonable default for "all" - 10 years
        start_date = today - timedelta(days=365*10)
        days = 365*10
    else:
        # Default to 1Y
        start_date = today - timedelta(days=365)
        days = 365
    
    return start_date, days

def _calculate_cagr(start_value: float, end_value: float, years: float) -> Optional[float]:
    """
    Calculate Compound Annual Growth Rate (CAGR).
    
    Args:
        start_value: Initial value
        end_value: Final value
        years: Number of years
    
    Returns:
        CAGR as a decimal (e.g., 0.08 for 8%)
    """
    if start_value <= 0 or end_value <= 0 or years <= 0:
        return None
    
    try:
        cagr = (end_value / start_value) ** (1 / years) - 1
        return cagr
    except (ZeroDivisionError, ValueError):
        return None

def calculate_enhanced_portfolio_performance(
    user_id: str, 
    period: str = "1Y", 
    benchmark: str = "^GSPC"
) -> Dict[str, Any]:
    """
    Calculate enhanced portfolio performance with comprehensive benchmarking.
    
    Args:
        user_id: User identifier
        period: Time period ('1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'ALL')
        benchmark: Benchmark symbol (must be in SUPPORTED_BENCHMARKS)
    
    Returns:
        Dictionary containing portfolio and benchmark performance data
    """
    logger.debug(f"Calculating enhanced portfolio performance for user {user_id}, period {period}, benchmark {benchmark}")
    
    # Validate benchmark
    if benchmark not in SUPPORTED_BENCHMARKS:
        raise ValueError(f"Unsupported benchmark: {benchmark}. Supported benchmarks: {list(SUPPORTED_BENCHMARKS.keys())}")
    
    # Get portfolio
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
        holdings = Holding.objects.filter(portfolio=portfolio)
    except Portfolio.DoesNotExist:
        raise ValueError("Portfolio not found")
    
    # Parse period
    start_date, days = _parse_period_to_dates(period)
    logger.debug(f"Calculated date range: {start_date} to {date.today()} ({days} days)")
    
    # Get Alpha Vantage service
    av_service = get_alpha_vantage_service()
    
    # Collect all tickers (portfolio + benchmark)
    tickers = list(set([holding.ticker for holding in holdings]))
    all_tickers = tickers + [benchmark]
    
    # Fetch historical data for all tickers
    logger.debug(f"Fetching historical data for tickers: {all_tickers}")
    all_historical_data = {}
    failed_tickers = []
    
    for ticker in all_tickers:
        try:
            historical_data = av_service.get_daily_adjusted(ticker, outputsize='full')
            if historical_data and historical_data.get('data'):
                # Convert to dict with date as key for easier lookup
                all_historical_data[ticker] = {
                    item['date']: float(item['adjusted_close']) 
                    for item in historical_data.get('data', [])
                }
                logger.debug(f"Retrieved {len(all_historical_data[ticker])} data points for {ticker}")
            else:
                failed_tickers.append(ticker)
                logger.warning(f"Could not retrieve historical data for '{ticker}'")
        except Exception as e:
            logger.error(f"Error fetching data for {ticker}: {e}")
            failed_tickers.append(ticker)
    
    # Check if benchmark data is available
    if benchmark in failed_tickers:
        raise ValueError(f"Failed to retrieve market data for benchmark symbol '{benchmark}'")
    
    # Generate date range for analysis
    date_range = [start_date + timedelta(days=x) for x in range(days + 1)]
    
    # Calculate portfolio performance
    logger.debug("Calculating portfolio performance over time")
    portfolio_performance = []
    
    for current_date in date_range:
        date_str = current_date.strftime('%Y-%m-%d')
        daily_portfolio_value = Decimal('0.0')
        
        # Calculate portfolio value for this date
        for holding in holdings.filter(purchase_date__lte=current_date):
            if holding.ticker in failed_tickers:
                continue
                
            price_data = all_historical_data.get(holding.ticker, {})
            # Find the most recent price on or before current_date
            available_dates = [d for d in price_data.keys() if d <= date_str]
            
            if available_dates:
                latest_date = max(available_dates)
                latest_price = Decimal(str(price_data[latest_date]))
                daily_portfolio_value += holding.shares * latest_price
        
        # Add cash balance
        daily_portfolio_value += portfolio.cash_balance
        
        if daily_portfolio_value > 0:
            portfolio_performance.append({
                'date': date_str,
                'total_value': float(daily_portfolio_value)
            })
    
    if not portfolio_performance:
        logger.warning("No portfolio performance data generated")
        return _empty_performance_response(period, benchmark)
    
    # Calculate portfolio returns
    base_portfolio_value = portfolio_performance[0]['total_value']
    for point in portfolio_performance:
        point['performance_return'] = ((point['total_value'] / base_portfolio_value) - 1) * 100
    
    # Calculate benchmark performance
    logger.debug(f"Calculating benchmark performance for {benchmark}")
    benchmark_performance = []
    benchmark_prices = all_historical_data.get(benchmark, {})
    
    # Filter benchmark prices to the analysis period
    relevant_benchmark_prices = {
        d: p for d, p in benchmark_prices.items() 
        if start_date <= datetime.strptime(d, '%Y-%m-%d').date() <= date.today()
    }
    
    if relevant_benchmark_prices:
        sorted_benchmark_dates = sorted(relevant_benchmark_prices.keys())
        base_benchmark_price = relevant_benchmark_prices[sorted_benchmark_dates[0]]
        
        for d in sorted_benchmark_dates:
            price = relevant_benchmark_prices[d]
            benchmark_performance.append({
                'date': d,
                'total_value': price,
                'performance_return': ((price / base_benchmark_price) - 1) * 100
            })
    
    # Calculate summary metrics
    portfolio_total_return = portfolio_performance[-1]['performance_return'] if portfolio_performance else 0
    benchmark_total_return = benchmark_performance[-1]['performance_return'] if benchmark_performance else 0
    outperformance = portfolio_total_return - benchmark_total_return
    
    # Calculate CAGR
    years = days / 365.25  # Account for leap years
    portfolio_cagr = _calculate_cagr(
        portfolio_performance[0]['total_value'],
        portfolio_performance[-1]['total_value'],
        years
    ) if len(portfolio_performance) >= 2 else None
    
    benchmark_cagr = _calculate_cagr(
        benchmark_performance[0]['total_value'],
        benchmark_performance[-1]['total_value'],
        years
    ) if len(benchmark_performance) >= 2 else None
    
    logger.info(f"Portfolio performance calculation completed for user {user_id}")
    
    return {
        "portfolio_performance": portfolio_performance,
        "benchmark_performance": benchmark_performance,
        "period": period,
        "benchmark_symbol": benchmark,
        "benchmark_name": SUPPORTED_BENCHMARKS[benchmark],
        "comparison": {
            "portfolio_return": round(portfolio_total_return, 2),
            "benchmark_return": round(benchmark_total_return, 2),
            "outperformance": round(outperformance, 2),
            "portfolio_cagr": round(portfolio_cagr * 100, 2) if portfolio_cagr else None,
            "benchmark_cagr": round(benchmark_cagr * 100, 2) if benchmark_cagr else None,
        },
        "summary": {
            "start_date": start_date.strftime('%Y-%m-%d'),
            "end_date": date.today().strftime('%Y-%m-%d'),
            "days_analyzed": days,
            "years_analyzed": round(years, 2),
            "failed_tickers": failed_tickers
        }
    }

def _empty_performance_response(period: str, benchmark: str) -> Dict[str, Any]:
    """Return empty response structure when no data is available."""
    return {
        "portfolio_performance": [],
        "benchmark_performance": [],
        "period": period,
        "benchmark_symbol": benchmark,
        "benchmark_name": SUPPORTED_BENCHMARKS.get(benchmark, "Unknown"),
        "comparison": {
            "portfolio_return": 0,
            "benchmark_return": 0,
            "outperformance": 0,
            "portfolio_cagr": None,
            "benchmark_cagr": None,
        },
        "summary": {
            "start_date": None,
            "end_date": None,
            "days_analyzed": 0,
            "years_analyzed": 0,
            "failed_tickers": []
        }
    } 