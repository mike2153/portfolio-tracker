"""
Index Simulation Service - "What if I just bought the index?" Analysis
Simulates buying fractional shares of a benchmark index (SPY, QQQ, etc.) 
using the same cash flows as the user's actual transactions.
"""
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
import logging

from debug_logger import DebugLogger
from supa_api.supa_api_jwt_helpers import create_authenticated_client, log_jwt_operation

logger = logging.getLogger(__name__)

class IndexSimulationService:
    """Service for simulating index portfolio performance using user's cash flows"""
    
    @staticmethod
    @DebugLogger.log_api_call(api_name="INDEX_SIM_SERVICE", sender="BACKEND", receiver="DATABASE", operation="GET_INDEX_SIMULATION")
    async def get_index_sim_series(
        user_id: str,
        benchmark: str,
        start_date: date,
        end_date: date,
        user_token: Optional[str] = None
    ) -> List[Tuple[date, Decimal]]:
        """
        Simulate an index portfolio using the user's actual cash flow dates and amounts.
        
        Algorithm:
        1. Get all user transactions
        2. For each transaction date, calculate cash delta (shares * price_per_share)
        3. Buy/sell fractional benchmark shares using that cash delta on that date
        4. Track cumulative benchmark shares over time
        5. Calculate daily portfolio value using benchmark prices
        
        Args:
            user_id: User's UUID
            benchmark: Index ticker (SPY, QQQ, A200, URTH, etc.)
            start_date: Start date for simulation
            end_date: End date for simulation  
            user_token: JWT token for RLS compliance
            
        Returns:
            List of (date, simulated_portfolio_value_usd) tuples
        """
        logger.info(f"[index_sim_service] === INDEX SIMULATION START ===")
        logger.info(f"[index_sim_service] User ID: {user_id}")
        logger.info(f"[index_sim_service] Benchmark: {benchmark}")
        logger.info(f"[index_sim_service] Date range: {start_date} to {end_date}")
        logger.info(f"[index_sim_service] JWT token present: {bool(user_token)}")
        logger.info(f"[index_sim_service] Timestamp: {datetime.now().isoformat()}")
        
        if not user_token:
            logger.error(f"[index_sim_service] ❌ JWT token required for RLS compliance")
            raise ValueError("JWT token required for index simulation")
        
        log_jwt_operation("INDEX_SIMULATION", user_id, bool(user_token))
        
        try:
            # Use authenticated client for RLS compliance
            client = create_authenticated_client(user_token)
            
            # Step 1: Get all user transactions up to end_date
            logger.info(f"[index_sim_service] 📊 Step 1: Fetching user transactions...")
            
            transactions_response = client.table('transactions') \
                .select('symbol, quantity, price, date, transaction_type') \
                .eq('user_id', user_id) \
                .lte('date', end_date.isoformat()) \
                .order('date', desc=False) \
                .execute()
            
            transactions = transactions_response.data
            logger.info(f"[index_sim_service] ✅ Found {len(transactions)} transactions")
            
            if not transactions:
                logger.info(f"[index_sim_service] ⚠️ No transactions found, returning zero values")
                return await IndexSimulationService._generate_zero_series(start_date, end_date)
            
            # Step 2: Get benchmark historical prices for the entire range
            logger.info(f"[index_sim_service] 💰 Step 2: Fetching {benchmark} historical prices...")
            
            # Extend date range slightly to ensure we have prices for transaction dates
            extended_start = start_date - timedelta(days=30)  # Buffer for price lookups
            
            prices_response = client.table('historical_prices') \
                .select('date, close') \
                .eq('symbol', benchmark) \
                .gte('date', extended_start.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .order('date', desc=False) \
                .execute()
            
            price_data = prices_response.data
            logger.info(f"[index_sim_service] ✅ Found {len(price_data)} price records for {benchmark}")
            
            if not price_data:
                logger.error(f"[index_sim_service] ❌ No price data found for benchmark {benchmark}")
                raise ValueError(f"No historical price data found for benchmark {benchmark}")
            
            # Step 3: Build price lookup dictionary
            benchmark_prices = {}
            for price_record in price_data:
                price_date = datetime.strptime(price_record['date'], '%Y-%m-%d').date()
                close_price = Decimal(str(price_record['close']))
                benchmark_prices[price_date] = close_price
            
            logger.info(f"[index_sim_service] 🗂️ Step 3: Built price lookup with {len(benchmark_prices)} dates")
            logger.info(f"[index_sim_service] Price range: {min(benchmark_prices.keys())} to {max(benchmark_prices.keys())}")
            
            # Step 4: Calculate cash flows and simulate index purchases
            logger.info(f"[index_sim_service] 🧮 Step 4: Simulating index purchases...")
            
            cash_flows = IndexSimulationService._calculate_cash_flows(transactions)
            logger.info(f"[index_sim_service] 💰 Calculated {len(cash_flows)} cash flow events")
            
            # Log sample cash flows
            for i, (cf_date, amount) in enumerate(cash_flows[:5]):
                logger.info(f"[index_sim_service] 📝 Cash flow {i+1}: {cf_date} = ${amount}")
            if len(cash_flows) > 5:
                logger.info(f"[index_sim_service] ... and {len(cash_flows) - 5} more cash flows")
            
            # Step 5: Execute index simulation
            cumulative_shares = await IndexSimulationService._simulate_index_transactions(
                cash_flows, benchmark, benchmark_prices
            )
            
            logger.info(f"[index_sim_service] 📈 Step 5: Simulated {len(cumulative_shares)} share position changes")
            
            # Step 6: Generate daily portfolio values
            logger.info(f"[index_sim_service] 💵 Step 6: Calculating daily portfolio values...")
            
            index_series = await IndexSimulationService._calculate_daily_values(
                start_date, end_date, cumulative_shares, benchmark_prices
            )
            
            logger.info(f"[index_sim_service] ✅ Index simulation complete")
            logger.info(f"[index_sim_service] 📊 Generated {len(index_series)} data points")
            logger.info(f"[index_sim_service] 💰 Final simulated value: ${index_series[-1][1] if index_series else 0}")
            logger.info(f"[index_sim_service] === INDEX SIMULATION END ===")
            
            return index_series
            
        except Exception as e:
            logger.error(f"[index_sim_service] ❌ Error in index simulation: {e}")
            DebugLogger.log_error(
                file_name="index_sim_service.py",
                function_name="get_index_sim_series",
                error=e,
                user_id=user_id,
                benchmark=benchmark,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            )
            raise
    
    @staticmethod
    def _calculate_cash_flows(transactions: List[Dict[str, Any]]) -> List[Tuple[date, Decimal]]:
        """
        Calculate net cash flows from transactions.
        
        Args:
            transactions: List of transaction records
            
        Returns:
            List of (date, net_cash_delta) tuples, sorted by date
        """
        logger.info(f"[index_sim_service] 🔢 Calculating cash flows from {len(transactions)} transactions")
        
        cash_flows_by_date = defaultdict(Decimal)
        
        for tx in transactions:
            tx_date = datetime.strptime(tx['date'], '%Y-%m-%d').date()
            shares = Decimal(str(tx['quantity']))
            price = Decimal(str(tx['price']))
            transaction_type = tx.get('transaction_type', 'Buy').upper()
            total_amount = abs(shares) * price  # Always use absolute value for amount calculation
            
            # Cash flow logic for index simulation:
            # - BUY transactions = positive cash flow (invest same amount in index)
            # - SELL transactions = negative cash flow (sell same amount from index)
            if transaction_type in ['BUY', 'Buy']:
                cash_delta = total_amount   # Invest same amount in index
            elif transaction_type in ['SELL', 'Sell']:
                cash_delta = -total_amount  # Sell same amount from index
            else:
                # For dividends or other types, treat as reinvestment (invest in index)
                cash_delta = total_amount
                logger.debug(f"[index_sim_service] ℹ️ Unknown transaction type '{transaction_type}', treating as reinvestment")
            
            cash_flows_by_date[tx_date] += cash_delta
            
            logger.debug(f"[index_sim_service] 💸 {tx_date}: {transaction_type} {shares} shares of {tx['symbol']} = ${cash_delta} cash flow")
        
        # Convert to sorted list
        cash_flows = [(date, amount) for date, amount in sorted(cash_flows_by_date.items())]
        
        total_invested = sum(amount for _, amount in cash_flows if amount > 0)
        total_withdrawn = sum(amount for _, amount in cash_flows if amount < 0)
        
        logger.info(f"[index_sim_service] 💰 Total invested: ${total_invested}")
        logger.info(f"[index_sim_service] 💰 Total withdrawn: ${abs(total_withdrawn)}")
        logger.info(f"[index_sim_service] 💰 Net cash flow: ${total_invested + total_withdrawn}")
        
        return cash_flows
    
    @staticmethod
    async def _simulate_index_transactions(
        cash_flows: List[Tuple[date, Decimal]], 
        benchmark: str, 
        benchmark_prices: Dict[date, Decimal]
    ) -> Dict[date, Decimal]:
        """
        Simulate buying/selling fractional shares of the benchmark index.
        
        Args:
            cash_flows: List of (date, cash_amount) tuples
            benchmark: Index ticker symbol
            benchmark_prices: Dictionary of {date: price}
            
        Returns:
            Dictionary of {date: cumulative_shares}
        """
        logger.info(f"[index_sim_service] 🏗️ Simulating {benchmark} transactions...")
        
        cumulative_shares = Decimal('0')
        share_positions = {}  # {date: cumulative_shares}
        
        for cash_flow_date, cash_amount in cash_flows:
            # Find price for transaction date (or next available trading day)
            benchmark_price = IndexSimulationService._get_price_for_transaction_date(
                cash_flow_date, benchmark_prices
            )
            
            if benchmark_price is None:
                logger.warning(f"[index_sim_service] ⚠️ No price found for {benchmark} on {cash_flow_date}, skipping")
                continue
            
            # Calculate fractional shares to buy/sell
            # Positive cash_amount = buying index (money invested)
            # Negative cash_amount = selling index (money withdrawn)
            shares_delta = cash_amount / benchmark_price
            cumulative_shares += shares_delta
            
            share_positions[cash_flow_date] = cumulative_shares
            
            logger.debug(f"[index_sim_service] 📊 {cash_flow_date}: ${cash_amount} ÷ ${benchmark_price} = {shares_delta:.6f} shares")
            logger.debug(f"[index_sim_service] 📈 {cash_flow_date}: Cumulative {benchmark} shares = {cumulative_shares:.6f}")
        
        logger.info(f"[index_sim_service] ✅ Simulated {len(share_positions)} index transactions")
        logger.info(f"[index_sim_service] 📊 Final {benchmark} position: {cumulative_shares:.6f} shares")
        
        return share_positions
    
    @staticmethod
    def _get_price_for_transaction_date(
        transaction_date: date, 
        prices: Dict[date, Decimal]
    ) -> Optional[Decimal]:
        """
        Get benchmark price for a transaction date, with fallback to next available trading day.
        
        Args:
            transaction_date: Date of transaction
            prices: Dictionary of {date: price}
            
        Returns:
            Price for the date, or None if not found
        """
        # Try exact date first
        if transaction_date in prices:
            return prices[transaction_date]
        
        # Fallback: find next available trading day (within reasonable range)
        for days_ahead in range(1, 8):  # Look up to 7 days ahead
            future_date = transaction_date + timedelta(days=days_ahead)
            if future_date in prices:
                logger.debug(f"[index_sim_service] 📅 Using price from {future_date} for transaction on {transaction_date}")
                return prices[future_date]
        
        # Fallback: find most recent price before transaction date
        available_dates = [d for d in prices.keys() if d <= transaction_date]
        if available_dates:
            most_recent_date = max(available_dates)
            logger.debug(f"[index_sim_service] 📅 Using price from {most_recent_date} for transaction on {transaction_date}")
            return prices[most_recent_date]
        
        return None
    
    @staticmethod
    async def _calculate_daily_values(
        start_date: date,
        end_date: date,
        share_positions: Dict[date, Decimal],
        benchmark_prices: Dict[date, Decimal]
    ) -> List[Tuple[date, Decimal]]:
        """
        Calculate daily portfolio values for the simulated index portfolio.
        
        Args:
            start_date: Start date for calculation
            end_date: End date for calculation
            share_positions: Dictionary of {date: cumulative_shares}
            benchmark_prices: Dictionary of {date: price}
            
        Returns:
            List of (date, portfolio_value) tuples
        """
        logger.info(f"[index_sim_service] 📊 Calculating daily values from {start_date} to {end_date}")
        
        daily_values = []
        current_shares = Decimal('0')
        
        # Generate all dates in range
        current_date = start_date
        while current_date <= end_date:
            # Update shares position if there was a transaction on this date
            if current_date in share_positions:
                current_shares = share_positions[current_date]
                logger.debug(f"[index_sim_service] 📈 {current_date}: Updated position to {current_shares:.6f} shares")
            
            # Get price for this date
            price = IndexSimulationService._get_price_for_valuation_date(current_date, benchmark_prices)
            
            if price is not None:
                daily_value = current_shares * price
                daily_values.append((current_date, daily_value))
                
                logger.debug(f"[index_sim_service] 💵 {current_date}: {current_shares:.6f} × ${price} = ${daily_value}")
            else:
                # No price available, use previous day's value or zero
                previous_value = daily_values[-1][1] if daily_values else Decimal('0')
                daily_values.append((current_date, previous_value))
                
                logger.debug(f"[index_sim_service] ⚠️ {current_date}: No price, using previous value ${previous_value}")
            
            current_date += timedelta(days=1)
        
        logger.info(f"[index_sim_service] ✅ Calculated {len(daily_values)} daily values")
        return daily_values
    
    @staticmethod
    def _get_price_for_valuation_date(
        valuation_date: date, 
        prices: Dict[date, Decimal]
    ) -> Optional[Decimal]:
        """
        Get price for portfolio valuation, using most recent available price.
        
        Args:
            valuation_date: Date to value portfolio
            prices: Dictionary of {date: price}
            
        Returns:
            Most recent price on or before valuation_date
        """
        # Try exact date first
        if valuation_date in prices:
            return prices[valuation_date]
        
        # Use most recent price before valuation date
        available_dates = [d for d in prices.keys() if d <= valuation_date]
        if available_dates:
            most_recent_date = max(available_dates)
            return prices[most_recent_date]
        
        return None
    
    @staticmethod
    async def _generate_zero_series(start_date: date, end_date: date) -> List[Tuple[date, Decimal]]:
        """Generate a time series of zero values for the given date range"""
        logger.info(f"[index_sim_service] 🔢 Generating zero value series from {start_date} to {end_date}")
        
        series = []
        current_date = start_date
        while current_date <= end_date:
            series.append((current_date, Decimal('0')))
            current_date += timedelta(days=1)
        
        logger.info(f"[index_sim_service] ✅ Generated {len(series)} zero value data points")
        return series

class IndexSimulationUtils:
    """Utility functions for index simulation operations"""
    
    @staticmethod
    def validate_benchmark(benchmark: str) -> bool:
        """
        Validate that benchmark ticker is supported.
        
        Args:
            benchmark: Ticker symbol to validate
            
        Returns:
            True if valid, False otherwise
        """
        valid_benchmarks = ['SPY', 'QQQ', 'A200', 'URTH', 'VTI', 'VXUS']
        
        is_valid = benchmark.upper() in valid_benchmarks
        
        logger.info(f"[index_sim_service] 🔍 Benchmark validation: {benchmark} = {'✅ Valid' if is_valid else '❌ Invalid'}")
        
        if not is_valid:
            logger.warning(f"[index_sim_service] ⚠️ Supported benchmarks: {valid_benchmarks}")
        
        return is_valid
    
    @staticmethod
    def calculate_performance_metrics(
        portfolio_series: List[Tuple[date, Decimal]], 
        index_series: List[Tuple[date, Decimal]]
    ) -> Dict[str, Any]:
        """
        Calculate comparative performance metrics.
        
        Args:
            portfolio_series: Portfolio value time series
            index_series: Index value time series
            
        Returns:
            Dictionary with performance metrics
        """
        logger.info(f"[index_sim_service] 📊 Calculating performance metrics")
        
        if not portfolio_series or not index_series:
            logger.warning(f"[index_sim_service] ⚠️ Empty series provided for metrics calculation")
            return {}
        
        portfolio_start = portfolio_series[0][1]
        portfolio_end = portfolio_series[-1][1]
        index_start = index_series[0][1]
        index_end = index_series[-1][1]
        
        portfolio_return = ((portfolio_end - portfolio_start) / portfolio_start * 100) if portfolio_start > 0 else Decimal('0')
        index_return = ((index_end - index_start) / index_start * 100) if index_start > 0 else Decimal('0')
        
        outperformance = portfolio_return - index_return
        
        metrics = {
            'portfolio_start_value': float(portfolio_start),
            'portfolio_end_value': float(portfolio_end),
            'portfolio_return_pct': float(portfolio_return),
            'index_start_value': float(index_start),
            'index_end_value': float(index_end),
            'index_return_pct': float(index_return),
            'outperformance_pct': float(outperformance),
            'absolute_outperformance': float(portfolio_end - index_end)
        }
        
        logger.info(f"[index_sim_service] 📈 Portfolio return: {portfolio_return:.2f}%")
        logger.info(f"[index_sim_service] 📊 Index return: {index_return:.2f}%")
        logger.info(f"[index_sim_service] 🎯 Outperformance: {outperformance:.2f}%")
        
        return metrics