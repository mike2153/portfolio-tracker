"""
Portfolio Performance Service - Historical portfolio value and benchmark comparison
Generates time-series data for charts showing portfolio performance vs market benchmarks.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
import asyncio

from supa_api.supa_api_transactions import supa_api_get_user_transactions
from supa_api.supa_api_historical_prices import (
    supa_api_get_historical_prices_batch,
    supa_api_get_price_history_for_portfolio
)
from vantage_api.vantage_api_quotes import vantage_api_get_daily_adjusted
from services.price_manager import price_manager
from utils.auth_helpers import validate_user_id
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

# Valid period and benchmark mappings
VALID_PERIODS = {
    "7D": timedelta(days=7),
    "1M": timedelta(days=30),
    "3M": timedelta(days=90),
    "1Y": timedelta(days=365),
    "YTD": None,  # Special case - from start of year
    "MAX": None   # Special case - from first transaction
}

VALID_BENCHMARKS = {
    "SPY": "S&P 500",
    "QQQ": "Nasdaq 100", 
    "A200": "ASX 200",
    "URTH": "MSCI World",
    "VTI": "Total Stock Market",
    "VXUS": "International"
}

class PortfolioPerformanceService:
    """Service for calculating historical portfolio performance vs benchmarks."""
    
    @DebugLogger.log_api_call(api_name="SERVICE", sender="BACKEND", receiver="PORTFOLIO_PERFORMANCE", operation="GET_HISTORICAL_PERFORMANCE")
    async def get_historical_performance(
        self, 
        user_id: str, 
        user_token: str,
        period: str = "1Y",
        benchmark: str = "SPY"
    ) -> Dict[str, Any]:
        """
        Get historical portfolio performance data vs benchmark.
        
        Args:
            user_id: User identifier (must be non-empty string)
            user_token: User authentication token
            period: Time period (7D, 1M, 3M, 1Y, YTD, MAX)
            benchmark: Benchmark ticker (SPY, QQQ, A200, URTH, VTI, VXUS)
            
        Returns:
            Dict containing portfolio and benchmark performance data
        """
        # Validate inputs
        validated_user_id = validate_user_id(user_id)
        
        if period not in VALID_PERIODS:
            raise ValueError(f"Invalid period: {period}. Valid options: {list(VALID_PERIODS.keys())}")
        
        if benchmark not in VALID_BENCHMARKS:
            raise ValueError(f"Invalid benchmark: {benchmark}. Valid options: {list(VALID_BENCHMARKS.keys())}")
            
        logger.info(f"[portfolio_performance_service.py::get_historical_performance] Getting performance for user {validated_user_id}, period {period}, benchmark {benchmark}")
        
        try:
            # Get user transactions to determine date range and symbols
            transactions = await supa_api_get_user_transactions(
                user_id=validated_user_id,
                user_token=user_token
            )
            
            if not transactions:
                logger.info(f"[portfolio_performance_service.py::get_historical_performance] No transactions found for user {validated_user_id}")
                return self._empty_performance_response(period, benchmark, "No transactions found")
            
            # Calculate date range
            start_date, end_date = self._calculate_date_range(transactions, period)
            
            # Get unique symbols from transactions
            symbols = list(set(txn.get('symbol', '').upper() for txn in transactions if txn.get('symbol')))
            
            logger.info(f"[portfolio_performance_service.py::get_historical_performance] Date range: {start_date} to {end_date}")
            logger.info(f"[portfolio_performance_service.py::get_historical_performance] Portfolio symbols: {symbols}")
            
            # Get historical portfolio performance and benchmark data in parallel
            portfolio_task = self._calculate_portfolio_time_series(
                transactions=transactions,
                symbols=symbols,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            benchmark_task = self._get_benchmark_time_series(
                benchmark=benchmark,
                start_date=start_date,
                end_date=end_date
            )
            
            portfolio_data, benchmark_data = await asyncio.gather(
                portfolio_task, 
                benchmark_task,
                return_exceptions=True
            )
            
            # Handle exceptions from parallel tasks
            if isinstance(portfolio_data, Exception):
                logger.error(f"Portfolio calculation failed: {portfolio_data}")
                portfolio_data = []
                
            if isinstance(benchmark_data, Exception):
                logger.error(f"Benchmark data failed: {benchmark_data}")
                benchmark_data = []
            
            # Calculate performance metrics
            metrics = self._calculate_performance_metrics(portfolio_data, benchmark_data)
            
            # Build response
            response = {
                "portfolio_performance": portfolio_data,
                "benchmark_performance": benchmark_data,
                "metadata": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "total_points": len(portfolio_data),
                    "portfolio_final_value": portfolio_data[-1]["value"] if portfolio_data else 0,
                    "index_final_value": benchmark_data[-1]["value"] if benchmark_data else 0,
                    "benchmark_name": VALID_BENCHMARKS[benchmark],
                    "calculation_timestamp": datetime.utcnow().isoformat(),
                    "cached": False,
                    "no_data": len(portfolio_data) == 0,
                    "index_only": len(portfolio_data) == 0 and len(benchmark_data) > 0,
                    "reason": "success" if portfolio_data else "no_portfolio_data",
                    "chart_type": "performance_comparison"
                },
                "performance_metrics": metrics
            }
            
            logger.info(f"[portfolio_performance_service.py::get_historical_performance] Generated {len(portfolio_data)} portfolio points and {len(benchmark_data)} benchmark points")
            return response
            
        except Exception as e:
            logger.error(f"[portfolio_performance_service.py::get_historical_performance] Error: {e}")
            raise
    
    def _calculate_date_range(self, transactions: List[Dict[str, Any]], period: str) -> Tuple[date, date]:
        """Calculate start and end dates for the performance period."""
        end_date = date.today()
        
        if period == "YTD":
            start_date = date(end_date.year, 1, 1)
        elif period == "MAX":
            # Find earliest transaction date
            transaction_dates = [
                datetime.strptime(txn['date'], '%Y-%m-%d').date() 
                for txn in transactions 
                if txn.get('date')
            ]
            start_date = min(transaction_dates) if transaction_dates else end_date - timedelta(days=365)
        else:
            # Use predefined period
            delta = VALID_PERIODS[period]
            start_date = end_date - delta
        
        return start_date, end_date
    
    async def _calculate_portfolio_time_series(
        self,
        transactions: List[Dict[str, Any]],
        symbols: List[str],
        start_date: date,
        end_date: date,
        user_token: str
    ) -> List[Dict[str, Any]]:
        """Calculate portfolio value over time based on transactions and price history."""
        logger.info(f"[portfolio_performance_service.py::_calculate_portfolio_time_series] Calculating portfolio time series")
        
        try:
            # Get historical price data for all symbols
            price_history = await supa_api_get_price_history_for_portfolio(
                symbols=symbols,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            )
            
            # Build portfolio time series
            portfolio_series = []
            current_date = start_date
            
            while current_date <= end_date:
                # Calculate portfolio value on this date
                portfolio_value = self._calculate_portfolio_value_on_date(
                    transactions=transactions,
                    target_date=current_date,
                    price_history=price_history
                )
                
                if portfolio_value > 0:  # Only include dates with portfolio value
                    portfolio_series.append({
                        "date": current_date.isoformat(),
                        "value": float(portfolio_value)
                    })
                
                # Move to next trading day (skip weekends for now)
                current_date += timedelta(days=1)
                if current_date.weekday() > 4:  # Skip weekends
                    current_date += timedelta(days=2 if current_date.weekday() == 5 else 1)
            
            logger.info(f"[portfolio_performance_service.py::_calculate_portfolio_time_series] Generated {len(portfolio_series)} data points")
            return portfolio_series
            
        except Exception as e:
            logger.error(f"[portfolio_performance_service.py::_calculate_portfolio_time_series] Error: {e}")
            return []
    
    def _calculate_portfolio_value_on_date(
        self,
        transactions: List[Dict[str, Any]],
        target_date: date,
        price_history: Dict[str, List[Dict[str, Any]]]
    ) -> Decimal:
        """Calculate total portfolio value on a specific date."""
        total_value = Decimal('0')
        
        # Calculate holdings as of target date
        holdings = {}
        
        for txn in transactions:
            txn_date = datetime.strptime(txn['date'], '%Y-%m-%d').date()
            if txn_date > target_date:
                continue  # Skip future transactions
                
            symbol = txn['symbol'].upper()
            quantity = Decimal(str(txn['quantity']))
            
            if txn['transaction_type'].upper() == 'SELL':
                quantity = -quantity
            
            holdings[symbol] = holdings.get(symbol, Decimal('0')) + quantity
        
        # Calculate value using prices on target date
        for symbol, quantity in holdings.items():
            if quantity <= 0:
                continue
                
            # Find price on or before target date
            symbol_prices = price_history.get(symbol, [])
            price_on_date = None
            
            for price_record in symbol_prices:
                price_date = datetime.strptime(price_record['date'], '%Y-%m-%d').date()
                if price_date <= target_date:
                    price_on_date = Decimal(str(price_record['close']))
                    break
            
            if price_on_date:
                total_value += quantity * price_on_date
        
        return total_value
    
    async def _get_benchmark_time_series(
        self,
        benchmark: str,
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Get benchmark index historical data."""
        logger.info(f"[portfolio_performance_service.py::_get_benchmark_time_series] Getting benchmark data for {benchmark}")
        
        try:
            # Try to get from database first
            from supa_api.supa_api_historical_prices import supa_api_get_historical_prices
            
            price_data = await supa_api_get_historical_prices(
                symbol=benchmark,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=""  # Public data doesn't need user token
            )
            
            if price_data:
                # Convert to time series format
                benchmark_series = [
                    {
                        "date": record['date'],
                        "value": float(record['close'])
                    }
                    for record in price_data
                ]
                
                logger.info(f"[portfolio_performance_service.py::_get_benchmark_time_series] Retrieved {len(benchmark_series)} benchmark points from database")
                return sorted(benchmark_series, key=lambda x: x['date'])
            
            # Fallback to Alpha Vantage if not in database
            logger.info(f"[portfolio_performance_service.py::_get_benchmark_time_series] No database data, fetching from Alpha Vantage")
            
            time_series_data = await vantage_api_get_daily_adjusted(benchmark, outputsize='full')
            
            if time_series_data.get('Time Series (Daily)'):
                benchmark_series = []
                
                for date_str, price_data in time_series_data['Time Series (Daily)'].items():
                    price_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    
                    if start_date <= price_date <= end_date:
                        benchmark_series.append({
                            "date": date_str,
                            "value": float(price_data['4. close'])
                        })
                
                logger.info(f"[portfolio_performance_service.py::_get_benchmark_time_series] Retrieved {len(benchmark_series)} benchmark points from Alpha Vantage")
                return sorted(benchmark_series, key=lambda x: x['date'])
            
            logger.warning(f"[portfolio_performance_service.py::_get_benchmark_time_series] No benchmark data available for {benchmark}")
            return []
            
        except Exception as e:
            logger.error(f"[portfolio_performance_service.py::_get_benchmark_time_series] Error getting benchmark data: {e}")
            return []
    
    def _calculate_performance_metrics(
        self,
        portfolio_data: List[Dict[str, Any]],
        benchmark_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate performance comparison metrics."""
        if not portfolio_data or not benchmark_data:
            return {
                "portfolio_start_value": 0,
                "portfolio_end_value": 0,
                "portfolio_return_pct": 0,
                "index_start_value": 0,
                "index_end_value": 0,
                "index_return_pct": 0,
                "outperformance_pct": 0,
                "absolute_outperformance": 0
            }
        
        # Get start and end values
        portfolio_start = portfolio_data[0]["value"] if portfolio_data else 0
        portfolio_end = portfolio_data[-1]["value"] if portfolio_data else 0
        
        benchmark_start = benchmark_data[0]["value"] if benchmark_data else 0
        benchmark_end = benchmark_data[-1]["value"] if benchmark_data else 0
        
        # Calculate returns
        portfolio_return = ((portfolio_end - portfolio_start) / portfolio_start * 100) if portfolio_start > 0 else 0
        benchmark_return = ((benchmark_end - benchmark_start) / benchmark_start * 100) if benchmark_start > 0 else 0
        
        outperformance = portfolio_return - benchmark_return
        absolute_outperformance = portfolio_end - benchmark_end
        
        return {
            "portfolio_start_value": portfolio_start,
            "portfolio_end_value": portfolio_end,
            "portfolio_return_pct": round(portfolio_return, 2),
            "index_start_value": benchmark_start,
            "index_end_value": benchmark_end,
            "index_return_pct": round(benchmark_return, 2),
            "outperformance_pct": round(outperformance, 2),
            "absolute_outperformance": round(absolute_outperformance, 2)
        }
    
    def _empty_performance_response(self, period: str, benchmark: str, reason: str) -> Dict[str, Any]:
        """Return empty performance response with proper structure."""
        return {
            "portfolio_performance": [],
            "benchmark_performance": [],
            "metadata": {
                "start_date": date.today().isoformat(),
                "end_date": date.today().isoformat(),
                "total_points": 0,
                "portfolio_final_value": 0,
                "index_final_value": 0,
                "benchmark_name": VALID_BENCHMARKS.get(benchmark, benchmark),
                "calculation_timestamp": datetime.utcnow().isoformat(),
                "cached": False,
                "no_data": True,
                "index_only": False,
                "reason": reason,
                "chart_type": "performance_comparison"
            },
            "performance_metrics": {
                "portfolio_start_value": 0,
                "portfolio_end_value": 0,
                "portfolio_return_pct": 0,
                "index_start_value": 0,
                "index_end_value": 0,
                "index_return_pct": 0,
                "outperformance_pct": 0,
                "absolute_outperformance": 0
            }
        }

# Create singleton instance
portfolio_performance_service = PortfolioPerformanceService()