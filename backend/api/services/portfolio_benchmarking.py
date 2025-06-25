# backend/api/services/portfolio_benchmarking.py
import logging
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, Optional, Tuple, Any, List
from ..models import Portfolio, Holding
from ..alpha_vantage_service import get_alpha_vantage_service

logger = logging.getLogger(__name__)

# Supported benchmarks with their Alpha Vantage symbols
SUPPORTED_BENCHMARKS = {
    'SPY': 'S&P 500',
    'QQQ': 'NASDAQ Composite', 
    'DIA': 'Dow Jones Industrial Average',
    'EWA': 'ASX 200',
    'EWU': 'FTSE 100',
    'EWJ': 'Nikkei 225',

}

class PortfolioBenchmarkingService:
    """Service for portfolio benchmarking and performance analysis."""
    
    def __init__(self):
        """Initialize the benchmarking service."""
        self.av_service = get_alpha_vantage_service()
    
    def calculate_enhanced_portfolio_performance(
        self, 
        user_id: str, 
        benchmark_symbol: str = 'SPY', 
        period: str = '1y'
    ) -> Dict[str, Any]:
        """
        Calculate enhanced portfolio performance with benchmarking.
        
        Args:
            user_id: User identifier
            benchmark_symbol: Benchmark symbol (e.g., 'SPY', '^GSPC')
            period: Time period for analysis
            
        Returns:
            Dictionary containing performance metrics
        """
        try:
            # Get portfolio
            portfolio = Portfolio.objects.get(user_id=user_id)
            holdings = Holding.objects.filter(portfolio=portfolio)
            
            if not holdings.exists():
                return {
                    'portfolio_return': None,
                    'benchmark_return': None,
                    'alpha': None,
                    'beta': None,
                    'error': 'No holdings found in portfolio'
                }
            
            # Calculate current portfolio value
            portfolio_value = self.calculate_portfolio_value(user_id)
            current_value = portfolio_value.get('total_value', 0)
            
            # Get benchmark performance
            benchmark_perf = self.get_benchmark_performance(benchmark_symbol, period)
            
            # Simple portfolio return calculation (could be enhanced with historical data)
            cost_basis = portfolio_value.get('total_cost', 0)
            if cost_basis > 0:
                portfolio_return = ((current_value - cost_basis) / cost_basis) * 100
            else:
                portfolio_return = 0
            
            return {
                'portfolio_return': round(portfolio_return, 2),
                'benchmark_return': benchmark_perf.get('return'),
                'alpha': None,  # Would need historical data for proper calculation
                'beta': None,   # Would need historical data for proper calculation
                'volatility': benchmark_perf.get('volatility')
            }
            
        except Portfolio.DoesNotExist:
            raise ValueError("Portfolio not found")
        except Exception as e:
            logger.error(f"Error calculating portfolio performance: {e}")
            raise ValueError(f"Failed to calculate portfolio performance: {str(e)}")
    
    def get_portfolio_holdings_with_prices(self, user_id: str) -> List[Dict[str, Any]]:
        """Get portfolio holdings with current market prices."""
        try:
            portfolio = Portfolio.objects.get(user_id=user_id)
            holdings = Holding.objects.filter(portfolio=portfolio)
            
            holdings_with_prices = []
            
            for holding in holdings:
                try:
                    # Get current price
                    quote_data = self.av_service.get_global_quote(holding.ticker)
                    current_price = None
                    
                    if quote_data:
                        current_price = float(quote_data.get('price', 0))
                    
                    holdings_with_prices.append({
                        'ticker': holding.ticker,
                        'company_name': holding.company_name,
                        'shares': holding.shares,
                        'purchase_price': holding.purchase_price,
                        'purchase_date': holding.purchase_date,
                        'current_price': current_price,
                        'market_value': float(holding.shares * current_price) if current_price else None,
                        'cost_basis': float(holding.shares * holding.purchase_price),
                        'gain_loss': (float(holding.shares * current_price) - float(holding.shares * holding.purchase_price)) if current_price else None
                    })
                    
                except Exception as e:
                    logger.warning(f"Error getting price for {holding.ticker}: {e}")
                    holdings_with_prices.append({
                        'ticker': holding.ticker,
                        'company_name': holding.company_name,
                        'shares': holding.shares,
                        'purchase_price': holding.purchase_price,
                        'purchase_date': holding.purchase_date,
                        'current_price': None,
                        'market_value': None,
                        'cost_basis': float(holding.shares * holding.purchase_price),
                        'gain_loss': None
                    })
            
            return holdings_with_prices
            
        except Portfolio.DoesNotExist:
            raise ValueError("Portfolio not found")
    
    def calculate_portfolio_value(self, user_id: str) -> Dict[str, Any]:
        """Calculate total portfolio value and metrics."""
        try:
            portfolio = Portfolio.objects.get(user_id=user_id)
            holdings = Holding.objects.filter(portfolio=portfolio)
            
            total_cost = Decimal('0')
            total_value = Decimal('0')
            
            for holding in holdings:
                cost_basis = holding.shares * holding.purchase_price
                total_cost += cost_basis
                
                try:
                    # Get current price
                    quote_data = self.av_service.get_global_quote(holding.ticker)
                    if quote_data:
                        current_price = Decimal(str(quote_data.get('price', 0)))
                        market_value = holding.shares * current_price
                        total_value += market_value
                    else:
                        # If no current price, use purchase price as fallback
                        total_value += cost_basis
                        
                except Exception as e:
                    logger.warning(f"Error getting price for {holding.ticker}: {e}")
                    # Use purchase price as fallback
                    total_value += cost_basis
            
            # Add cash balance
            total_value += portfolio.cash_balance
            
            gain_loss = total_value - total_cost
            gain_loss_percent = (gain_loss / total_cost * 100) if total_cost > 0 else Decimal('0')
            
            return {
                'total_value': float(total_value),
                'total_cost': float(total_cost),
                'total_gain_loss': float(gain_loss),
                'gain_loss_percent': float(gain_loss_percent),
                'cash_balance': float(portfolio.cash_balance)
            }
            
        except Portfolio.DoesNotExist:
            raise ValueError("Portfolio not found")
    
    def get_benchmark_performance(self, symbol: str, period: str) -> Dict[str, Any]:
        """Get benchmark performance data."""
        try:
            # Get historical data for the benchmark
            historical_data = self.av_service.get_daily_adjusted(symbol, outputsize='compact')
            
            if not historical_data or not historical_data.get('data'):
                raise ValueError(f"Failed to retrieve market data for benchmark symbol '{symbol}'")
            
            data_points = historical_data['data']
            if len(data_points) < 2:
                return {'return': None, 'volatility': None}
            
            # Calculate simple return between first and last data points
            start_price = float(data_points[-1]['adjusted_close'])  # Oldest
            end_price = float(data_points[0]['adjusted_close'])     # Most recent
            
            simple_return = ((end_price - start_price) / start_price) * 100 if start_price > 0 else 0
            
            # Calculate volatility from daily returns
            returns = []
            for i in range(len(data_points) - 1):
                current_price = float(data_points[i]['adjusted_close'])
                prev_price = float(data_points[i + 1]['adjusted_close'])
                daily_return = (current_price - prev_price) / prev_price
                returns.append(daily_return)
            
            # Calculate standard deviation as volatility measure
            if len(returns) > 1:
                mean_return = sum(returns) / len(returns)
                variance = sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1)
                volatility = (variance ** 0.5) * (252 ** 0.5)  # Annualized
            else:
                volatility = 0
            
            return {
                'return': round(simple_return, 2),
                'volatility': round(volatility, 4)
            }
            
        except Exception as e:
            logger.error(f"Error calculating benchmark performance for {symbol}: {e}")
            raise ValueError(f"Failed to retrieve market data for benchmark symbol '{symbol}'")

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
    benchmark: str = "SPY"
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
    logger.info(f"[PORTFOLIO_BENCHMARK] Starting calculation for user {user_id}, period {period}, benchmark {benchmark}")
    
    # Validate benchmark
    if benchmark not in SUPPORTED_BENCHMARKS:
        logger.error(f"[PORTFOLIO_BENCHMARK] Unsupported benchmark: {benchmark}. Supported: {list(SUPPORTED_BENCHMARKS.keys())}")
        raise ValueError(f"Unsupported benchmark: {benchmark}. Supported benchmarks: {list(SUPPORTED_BENCHMARKS.keys())}")
    
    # Get portfolio
    try:
        portfolio = Portfolio.objects.get(user_id=user_id)
        holdings = Holding.objects.filter(portfolio=portfolio)
        logger.info(f"[PORTFOLIO_BENCHMARK] Found portfolio with {holdings.count()} holdings")
        logger.debug(f"[PORTFOLIO_BENCHMARK] Holdings: {[h.ticker for h in holdings]}")
    except Portfolio.DoesNotExist:
        logger.error(f"[PORTFOLIO_BENCHMARK] Portfolio not found for user {user_id}")
        raise ValueError("Portfolio not found")
    
    # Parse period
    start_date, days = _parse_period_to_dates(period)
    logger.info(f"[PORTFOLIO_BENCHMARK] Calculated date range: {start_date} to {date.today()} ({days} days)")
    
    # Get Alpha Vantage service
    av_service = get_alpha_vantage_service()
    logger.debug(f"[PORTFOLIO_BENCHMARK] Got Alpha Vantage service: {av_service}")
    
    # Collect all tickers (portfolio + benchmark)
    tickers = list(set([holding.ticker for holding in holdings]))
    all_tickers = tickers + [benchmark]
    
    # Fetch historical data for all tickers
    logger.info(f"[PORTFOLIO_BENCHMARK] Fetching historical data for tickers: {all_tickers}")
    all_historical_data = {}
    failed_tickers = []
    
    for ticker in all_tickers:
        try:
            logger.info(f"[PORTFOLIO_BENCHMARK] Fetching data for ticker: {ticker}")
            historical_data = av_service.get_daily_adjusted(ticker, outputsize='full')
            logger.debug(f"[PORTFOLIO_BENCHMARK] Raw API response for {ticker}: {historical_data}")
            
            if historical_data and historical_data.get('data'):
                # Convert to dict with date as key for easier lookup
                all_historical_data[ticker] = {
                    item['date']: float(item['adjusted_close']) 
                    for item in historical_data.get('data', [])
                }
                logger.info(f"[PORTFOLIO_BENCHMARK] Retrieved {len(all_historical_data[ticker])} data points for {ticker}")
                # Log sample data
                sample_dates = list(all_historical_data[ticker].keys())[:3]
                logger.debug(f"[PORTFOLIO_BENCHMARK] Sample data for {ticker}: {[(d, all_historical_data[ticker][d]) for d in sample_dates]}")
            else:
                failed_tickers.append(ticker)
                logger.warning(f"[PORTFOLIO_BENCHMARK] Could not retrieve historical data for '{ticker}' - empty response")
                logger.debug(f"[PORTFOLIO_BENCHMARK] Full response for {ticker}: {historical_data}")
        except Exception as e:
            logger.error(f"[PORTFOLIO_BENCHMARK] Error fetching data for {ticker}: {e}", exc_info=True)
            failed_tickers.append(ticker)
    
    # Check if benchmark data is available
    if benchmark in failed_tickers:
        logger.error(f"[PORTFOLIO_BENCHMARK] Benchmark {benchmark} failed to fetch data")
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
        perf = ((point['total_value'] / base_portfolio_value) - 1) * 100
        point['performance_return'] = perf
        # For frontend consistency, also expose indexed_performance
        point['indexed_performance'] = perf
    
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
            perf = ((price / base_benchmark_price) - 1) * 100
            benchmark_performance.append({
                'date': d,
                'total_value': price,
                'performance_return': perf,
                # Duplicate value for chart consistency
                'indexed_performance': perf
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