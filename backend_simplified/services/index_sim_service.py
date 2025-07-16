"""Index Simulation Service - "What if I just bought the index?" Analysis.

Simulates buying fractional shares of a benchmark index (SPY, QQQ, etc.) using
the same cash flows as the user's actual transactions.
"""
from typing import Dict, Any, List, Tuple, Optional, cast
from datetime import datetime, date, timedelta
from decimal import Decimal
from collections import defaultdict
import logging

# Import portfolio service to fetch the user's portfolio value on the
# simulation start date.  This avoids a circular dependency because
# portfolio_service does not import this module.
from services.portfolio_service import PortfolioTimeSeriesService

from debug_logger import DebugLogger
from supa_api.supa_api_jwt_helpers import (
    create_authenticated_client,
    log_jwt_operation,
)
from supabase.client import create_client
from os import getenv


logger = logging.getLogger(__name__)


class IndexSimulationService:
    """Service for simulating index portfolio performance using user's cash flows"""

    @staticmethod
    @DebugLogger.log_api_call(
        api_name="INDEX_SIM_SERVICE",
        sender="BACKEND",
        receiver="DATABASE",
        operation="GET_INDEX_SIMULATION",
    )
    async def get_index_sim_series(
        user_id: str,
        benchmark: str,
        start_date: date,
        end_date: date,
        user_token: Optional[str] = None
    ) -> List[Tuple[date, Decimal]]:
        """
        Hybrid index simulation:
        1. On start_date, buy the index with the user's portfolio value at that date.
        2. For each transaction after start_date and up to end_date, simulate buying/selling the index with the cash flow amount.
        3. Simulate index value day by day as before.
        """
        logger.info(f"[DEBUG] get_index_sim_series called: user_id={user_id}, benchmark={benchmark}, start={start_date}, end={end_date}")
        if not user_token:
            logger.error(f"[index_sim_service] ❌ JWT token required for RLS compliance")
            from fastapi import HTTPException
            raise HTTPException(
                status_code=401,
                detail="JWT token required for index simulation"
            )

        log_jwt_operation("INDEX_SIMULATION", user_id, bool(user_token))

        try:
            client = create_authenticated_client(user_token)
            supa_client = create_client(
                cast(str, getenv("SUPA_API_URL")),
                cast(str, getenv("SUPA_API_SERVICE_KEY"))
            )  # type: ignore[arg-type]

            # Step 1: Get user's portfolio value at start_date
            #logger.info(f"[index_sim_service] 📊 Step 1: Fetching portfolio value at {start_date}")
            start_series, start_meta = await PortfolioTimeSeriesService.get_portfolio_series(
                user_id=user_id,
                range_key="MAX",
                user_token=user_token
            )
            if not start_series or start_meta.get("no_data"):
                start_value = Decimal('0')
                logger.warning(f"[index_sim_service] 🛫 No portfolio value available for {start_date}, seeding with $0")
            else:
                # Find the value at or just after start_date
                start_value = None
                for d, v in start_series:
                    if d >= start_date:
                        start_value = v
                        break
                if start_value is None:
                    start_value = start_series[-1][1]
                    logger.warning(f"[index_sim_service] ⚠️ No portfolio value on/after {start_date}, using last available value: ${start_value}")

            # Step 2: Get all user transactions after start_date and up to end_date
            transactions_response = client.table('transactions') \
                .select('symbol, quantity, price, date, transaction_type') \
                .eq('user_id', user_id) \
                .gte('date', start_date.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .order('date', desc=False) \
                .execute()
            transactions = transactions_response.data

            # Step 3: Ensure benchmark prices are up to date
            # logger.info(f"[index_sim_service] Ensuring {benchmark} prices are current...")
            from services.current_price_manager import current_price_manager
            
            # Use CurrentPriceManager to ensure we have latest index prices
            update_result = await current_price_manager.update_prices_with_session_check(
                symbols=[benchmark],
                user_token=user_token,
                include_indexes=False  # Already processing an index
            )
            if update_result.get("data", {}).get("updated"):
                 logger.info(f"[index_sim_service] Updated {benchmark} prices with {update_result['data']['sessions_filled']} sessions")
            else:
                logger.warning(f"[index_sim_service] ⚠️ No price data for {benchmark} even after update {update_result}")
            
            # Now get benchmark historical prices for the entire range
            extended_start = start_date - timedelta(days=30)
            prices_response = client.table('historical_prices') \
                .select('date, close') \
                .eq('symbol', benchmark) \
                .gte('date', extended_start.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .order('date', desc=False) \
                .execute()
            price_data = prices_response.data
            
            if not price_data:
                logger.error(f"[index_sim_service] ❌ No price data for {benchmark} even after update")
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=404,
                    detail=f"No historical price data found for benchmark {benchmark}"
                )
            benchmark_prices = {}
            for price_record in price_data:
                price_date = datetime.strptime(price_record['date'], '%Y-%m-%d').date()
                close_price = Decimal(str(price_record['close']))
                benchmark_prices[price_date] = close_price

            # Step 4: Build cash flows: seed with start_value, then apply each transaction after start_date
            cash_flows = []
            # Seed: buy index with start_value on start_date
            cash_flows.append((start_date, start_value))
            # For each transaction after start_date, simulate cash flow
            for tx in transactions:
                tx_date = datetime.strptime(tx['date'], '%Y-%m-%d').date()
                if tx_date == start_date:
                    continue  # Already seeded
                amount_invested = tx.get('amount_invested')
                if amount_invested is not None:
                    cash_delta_amount = Decimal(str(amount_invested))
                else:
                    shares = Decimal(str(tx['quantity']))
                    user_price = Decimal(str(tx['price']))
                    cash_delta_amount = abs(shares) * user_price
                transaction_type = tx.get('transaction_type', 'Buy').upper()
                cash_delta_amount = abs(cash_delta_amount)
                if transaction_type in ['BUY', 'Buy']:
                    cash_delta = cash_delta_amount
                elif transaction_type in ['SELL', 'Sell']:
                    cash_delta = -cash_delta_amount
                else:
                    cash_delta = cash_delta_amount
                cash_flows.append((tx_date, cash_delta))
            # Sort cash flows by date
            cash_flows.sort(key=lambda x: x[0])
            # Step 5: Simulate index purchases
            cumulative_shares = await IndexSimulationService._simulate_index_transactions(
                cash_flows, benchmark, benchmark_prices
            )
            # Step 6: Generate daily portfolio values
            index_series = await IndexSimulationService._calculate_daily_values(
                start_date, end_date, cumulative_shares, benchmark_prices
            )
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
    def _calculate_cash_flows(
        transactions: List[Dict[str, Any]],
        benchmark_prices: Dict[date, Decimal]
    ) -> List[Tuple[date, Decimal]]:
        """
        Calculate net cash flows from transactions using benchmark closing prices.
        Args:
            transactions: List of transaction records
            benchmark_prices: Dictionary of {date: benchmark_closing_price}
        Returns:
            List of (date, net_cash_delta) tuples, sorted by date
        """
        cash_flows_by_date = defaultdict(Decimal)

        for tx in transactions:
            tx_date = datetime.strptime(tx['date'], '%Y-%m-%d').date()
            amount_invested = tx.get('amount_invested')
            if amount_invested is not None:
                cash_delta_amount = Decimal(str(amount_invested))
            else:
                shares = Decimal(str(tx['quantity']))
                user_price = Decimal(str(tx['price']))
                cash_delta_amount = abs(shares) * user_price
            transaction_type = tx.get('transaction_type', 'Buy').upper()

            # Calculate cash delta using benchmark closing price
            cash_delta_amount = abs(cash_delta_amount)
            # Cash flow logic for index simulation:
            # - BUY transactions = positive cash flow (invest same amount in index)
            # - SELL transactions = negative cash flow (sell same amount from index)
            if transaction_type in ['BUY', 'Buy']:
                cash_delta = cash_delta_amount   # Invest same amount in index
            elif transaction_type in ['SELL', 'Sell']:
                cash_delta = -cash_delta_amount  # Sell same amount from index
            else:
                # For dividends or other types, treat as reinvestment (invest in index)
                cash_delta = cash_delta_amount
            cash_flows_by_date[tx_date] += cash_delta
        # Convert to sorted list
        cash_flows = [(date, amount) for date, amount in sorted(cash_flows_by_date.items())]

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

            shares_delta = cash_amount / benchmark_price
            cumulative_shares += shares_delta
            share_positions[cash_flow_date] = cumulative_shares

        return share_positions

    @staticmethod
    def _get_price_for_transaction_date(
        transaction_date: date,
        prices: Dict[date, Decimal]
    ) -> Optional[Decimal]:

        # Try exact date first
        if transaction_date in prices:
            return prices[transaction_date]

        # Fallback: find next available trading day (within reasonable range)
        for days_ahead in range(1, 8):  # Look up to 7 days ahead
            future_date = transaction_date + timedelta(days=days_ahead)
            if future_date in prices:
                return prices[future_date]

        # Fallback: find most recent price before transaction date
        available_dates = [d for d in prices.keys() if d <= transaction_date]
        if available_dates:
            most_recent_date = max(available_dates)
            return prices[most_recent_date]

        return None

    @staticmethod
    async def _calculate_daily_values(
        start_date: date,
        end_date: date,
        share_positions: Dict[date, Decimal],
        benchmark_prices: Dict[date, Decimal]
    ) -> List[Tuple[date, Decimal]]:

        # Find first transaction date to avoid leading zeros
        if share_positions:
            first_position_date = min(share_positions.keys())
            effective_start_date = max(start_date, first_position_date)
        else:
            effective_start_date = start_date

        daily_values = []
        # Seed current shares with the most recent position on or before start_date
        current_shares = Decimal('0')

        if share_positions:
            prior_dates = [d for d in share_positions.keys() if d <= start_date]
            if prior_dates:
                most_recent = max(prior_dates)
                current_shares = share_positions[most_recent]
                logger.info(
                    f"[index_sim_service] 📈 DEBUG: Seeding shares from {most_recent}: {current_shares:.6f}"
                )
            else:
                #logger.info(f"[index_sim_service] 📈 DEBUG: No prior positions found before {start_date}, starting with 0 shares")
                pass
        else:
            #logger.info(f"[index_sim_service] 📈 DEBUG: No share positions available, starting with 0 shares")
            pass

        # Seed last known price using nearest available price on or before the
        # start date.  If no prior price exists, fall back to the next
        # available price after the start date.
        last_known_price = IndexSimulationService._get_price_for_valuation_date(
            start_date, benchmark_prices
        )

        if last_known_price is None:
            logger.error(
                f"[index_sim_service] ❌ No benchmark price available near {start_date}"
            )
            return []

        # Generate all dates from effective start onwards
        current_date = effective_start_date
        while current_date <= end_date:
            # Update shares position if there was a transaction on this date
            if current_date in share_positions:
                current_shares = share_positions[current_date]
                #logger.info(f"[index_sim_service] 📈 DEBUG: {current_date}: Updated position to {current_shares:.6f} shares")

            # Get price for this date with forward-fill
            if current_date in benchmark_prices:
                last_known_price = benchmark_prices[current_date]
                price = last_known_price
            elif last_known_price is not None:
                # Forward-fill from last known price
                price = last_known_price

            else:
                # Skip until we get first price data (no double increment)
                #logger.info(f"[index_sim_service] 📅 DEBUG: {current_date}: No price data available, skipping")
                current_date += timedelta(days=1)
                continue

            daily_value = current_shares * price
            daily_values.append((current_date, daily_value))

            # Log first few and last few calculations for debugging
            #if len(daily_values) <= 3 or len(daily_values) >= len(daily_values) - 3:
            #    logger.info(f"[index_sim_service] 💵 DEBUG: {current_date}: {current_shares:.6f} × ${price} = ${daily_value}")
            current_date += timedelta(days=1)

        # Validate first point is not zero
        if daily_values and daily_values[0][1] == 0:
            logger.warning(f"[index_sim_service] ⚠️ First index value is $0 on {daily_values[0][0]}")
        elif daily_values:
            #logger.info(f"[index_sim_service] ✅ First index value: ${daily_values[0][1]} on {daily_values[0][0]}")
            pass

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

        # If nothing exists before the valuation date, look forward for the
        # earliest available price.  This handles cases where the requested
        # start date is before the first available price in the data set.
        future_dates = [d for d in prices.keys() if d > valuation_date]
        if future_dates:
            nearest_future = min(future_dates)
            return prices[nearest_future]

        # No price data at all
        return None

    @staticmethod
    async def _generate_zero_series(start_date: date, end_date: date) -> List[Tuple[date, Decimal]]:
        """Generate a time series of zero values for the given date range"""
        #logger.info(f"[index_sim_service] 🔢 Generating zero value series from {start_date} to {end_date}")

        series = []
        current_date = start_date
        while current_date <= end_date:
            series.append((current_date, Decimal('0')))
            current_date += timedelta(days=1)
        return series

    @staticmethod
    async def get_rebalanced_index_series(
        user_id: str,
        benchmark: str,
        start_date: date,
        end_date: date,
        user_token: Optional[str] = None
    ) -> List[Tuple[date, Decimal]]:
        """
        Create a properly rebalanced index series for the exact timeframe.
        
        This method:
        1. Gets the user's actual portfolio value at the start_date
        2. Buys that exact dollar amount of the index (fractional shares allowed)
        3. Simulates the index returns from that purchase date forward
        
        This ensures proper comparison between portfolio and index performance
        for any selected timeframe without rounding errors.
        
        Args:
            user_id: User's UUID
            benchmark: Index ticker (SPY, QQQ, etc.)
            start_date: Start date for the comparison
            end_date: End date for the comparison
            user_token: JWT token for RLS compliance
            
        Returns:
            List of (date, index_portfolio_value) tuples for the timeframe
        """
        
        logger.info(f"[DEBUG] get_rebalanced_index_series called: user_id={user_id}, benchmark={benchmark}, start={start_date}, end={end_date}")
        
        if not user_token:
            logger.error(f"[index_sim_service] ❌ JWT token required for rebalanced index simulation")
            raise ValueError("JWT token required for rebalanced index simulation")
        
        try:
            # Use authenticated client for RLS compliance
            client = create_authenticated_client(user_token)
            
            # Step 1: Get the user's actual portfolio value at the start_date
            #logger.info(f"[index_sim_service] 📊 Step 1: Getting user's portfolio value at {start_date}")
            
            # Get portfolio data for the exact timeframe we need
            portfolio_series, portfolio_meta = await PortfolioTimeSeriesService.get_portfolio_series(
                user_id=user_id,
                range_key="MAX",  # Get all data to ensure we find the start_date
                user_token=user_token
            )
            
            if portfolio_meta.get("no_data") or not portfolio_series:
                logger.warning(f"[index_sim_service] ⚠️ No portfolio data available for user {user_id}")
                return await IndexSimulationService._generate_zero_series(start_date, end_date)
            
            # DEBUG: Log all portfolio data points around the start date
            for i, (portfolio_date, portfolio_value) in enumerate(portfolio_series):
                if abs((portfolio_date - start_date).days) <= 3:  # Show dates within 3 days of start_date
                    #logger.info(f"[index_sim_service] 🔍 DEBUG: Portfolio[{i}] {portfolio_date} = ${portfolio_value}")
                    pass
            
            # Find the portfolio value closest to our start_date
            start_portfolio_value = None
            actual_start_date = None
            
            # Look for exact match first
            for portfolio_date, portfolio_value in portfolio_series:
                if portfolio_date == start_date:
                    start_portfolio_value = portfolio_value
                    actual_start_date = portfolio_date
                    #logger.info(f"[index_sim_service] ✅ Found EXACT match for {start_date}: ${start_portfolio_value}")
                    pass
                    break
            
            # If no exact match, find the closest date on or after start_date
            if start_portfolio_value is None:
                for portfolio_date, portfolio_value in portfolio_series:
                    if portfolio_date >= start_date:
                        start_portfolio_value = portfolio_value
                        actual_start_date = portfolio_date
                        #logger.info(f"[index_sim_service] ⚠️ No exact match, using closest date {actual_start_date} (${start_portfolio_value})")
                        pass
                        break
            
            # If still no match, use the last available value
            if start_portfolio_value is None:
                start_portfolio_value = portfolio_series[-1][1]
                actual_start_date = portfolio_series[-1][0]
                logger.warning(f"[index_sim_service] ⚠️ Using LAST available portfolio value from {actual_start_date}: ${start_portfolio_value}")
            
            if start_portfolio_value <= 0:
                logger.warning(f"[index_sim_service] ⚠️ Portfolio value is zero or negative: ${start_portfolio_value}")
                return await IndexSimulationService._generate_zero_series(start_date, end_date)
            
            # Step 2: Ensure benchmark prices are up to date
            # logger.info(f"[index_sim_service] Ensuring {benchmark} prices are current for rebalanced series...")
            from services.current_price_manager import current_price_manager
            
            # Use CurrentPriceManager to ensure we have latest index prices
            logger.info(f"[DEBUG] index_sim_service: Calling update_prices_with_session_check for benchmark={benchmark}")
            update_result = await current_price_manager.update_prices_with_session_check(
                symbols=[benchmark],
                user_token=user_token,
                include_indexes=False  # Already processing an index
            )
            
            logger.info(f"[DEBUG] index_sim_service: Update result for {benchmark}: {update_result}")
            if update_result.get("data", {}).get("updated"):
                sessions_filled = update_result.get("data", {}).get("sessions_filled", 0)
                logger.info(f"[DEBUG] index_sim_service: Successfully updated {benchmark} prices, filled {sessions_filled} sessions")
                pass
            
            # Get benchmark prices for the timeframe
            # CRITICAL FIX: Use the actual portfolio start date, not the requested start_date
            # This ensures perfect alignment between portfolio and benchmark baselines
            if actual_start_date is None:
                logger.error(f"[index_sim_service] ❌ No actual_start_date found, cannot align benchmark")
                return await IndexSimulationService._generate_zero_series(start_date, end_date)
            
            benchmark_start_date = actual_start_date  # Use portfolio's actual start date
            
            prices_response = client.table('historical_prices') \
                .select('date, close') \
                .eq('symbol', benchmark) \
                .gte('date', benchmark_start_date.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .order('date', desc=False) \
                .execute()
            
            price_data = prices_response.data
            #logger.info(f"[index_sim_service] ✅ Found {len(price_data)} {benchmark} price records")
            
            if not price_data:
                #logger.info(f"[index_sim_service] 📊 Returning zero series")
                return await IndexSimulationService._generate_zero_series(start_date, end_date)
            
            # Build price lookup
            benchmark_prices = {}
            for price_record in price_data:
                price_date = datetime.strptime(price_record['date'], '%Y-%m-%d').date()
                close_price = Decimal(str(price_record['close']))
                benchmark_prices[price_date] = close_price
            
            # Step 3: Find the benchmark price at our start date (or closest trading day)
            
            # DEBUG: Log benchmark prices around the actual start date
            for price_date in sorted(benchmark_prices.keys()):
                if abs((price_date - actual_start_date).days) <= 5:  # Show dates within 3 days of actual_start_date
                    #logger.info(f"[index_sim_service] 🔍 DEBUG: {benchmark}[{price_date}] = ${benchmark_prices[price_date]}")
                    pass
            
            start_benchmark_price = None
            index_start_date = None
            
            # Look for exact match first using the aligned start date
            if actual_start_date in benchmark_prices:
                start_benchmark_price = benchmark_prices[actual_start_date]
                index_start_date = actual_start_date
            else:
                # Look for price on or after the actual_start_date
                for check_date in sorted(benchmark_prices.keys()):
                    if check_date >= actual_start_date:
                        start_benchmark_price = benchmark_prices[check_date]
                        index_start_date = check_date
                        break
            
            if start_benchmark_price is None:
                logger.error(f"[index_sim_service] ❌ No {benchmark} price found on or after {actual_start_date}")
                return await IndexSimulationService._generate_zero_series(start_date, end_date)
            
            #logger.info(f"[index_sim_service] 💱 FINAL: {benchmark} price at {index_start_date}: ${start_benchmark_price}")
            
            # Step 4: Calculate fractional shares to buy
            
            if actual_start_date != index_start_date:
                logger.warning(f"[index_sim_service] ⚠️ DATE MISMATCH! Portfolio and benchmark using different dates!")
                logger.warning(f"[index_sim_service] ⚠️ This will cause baseline alignment issues in the chart!")
            
            shares_to_buy = start_portfolio_value / start_benchmark_price
            
            # Step 5: Generate daily index portfolio values
            index_series = []
            for price_date in sorted(benchmark_prices.keys()):
                if price_date >= index_start_date:
                    current_price = benchmark_prices[price_date]
                    current_value = shares_to_buy * current_price
                    index_series.append((price_date, current_value))
    
            
            if not index_series:
                logger.warning(f"[index_sim_service] ⚠️ No index series generated")
                return await IndexSimulationService._generate_zero_series(start_date, end_date)
            
            # Calculate return for verification
            initial_value = float(index_series[0][1])
            final_value = float(index_series[-1][1])
            if initial_value > 0:
                index_return = ((final_value - initial_value) / initial_value) * 100
            
            
            return index_series
            
        except Exception as e:
            logger.error(f"[index_sim_service] ❌ Error in rebalanced index simulation: {e}")
            DebugLogger.log_error(
                file_name="index_sim_service.py",
                function_name="get_rebalanced_index_series",
                error=e,
                user_id=user_id,
                benchmark=benchmark,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            )
            raise

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

        if not portfolio_series or not index_series:
            logger.warning(f"[index_sim_service] ⚠️ Empty series provided for metrics calculation")
            return {}

        portfolio_start = portfolio_series[0][1]
        portfolio_end = portfolio_series[-1][1]
        index_start = index_series[0][1]
        index_end = index_series[-1][1]

        # CRITICAL FIX: Remove double multiplication by 100 - calculate as decimal percentage
        portfolio_return = ((portfolio_end - portfolio_start) / portfolio_start) if portfolio_start > 0 else Decimal('0')
        index_return = ((index_end - index_start) / index_start) if index_start > 0 else Decimal('0')

        # Convert to percentage for display (multiply by 100 only once)
        portfolio_return_pct = portfolio_return * 100
        index_return_pct = index_return * 100

        outperformance = portfolio_return - index_return
        outperformance_pct = outperformance * 100

        metrics = {
            'portfolio_start_value': float(portfolio_start),
            'portfolio_end_value': float(portfolio_end),
            'portfolio_return_pct': float(portfolio_return_pct),
            'index_start_value': float(index_start),
            'index_end_value': float(index_end),
            'index_return_pct': float(index_return_pct),
            'outperformance_pct': float(outperformance_pct),
            'absolute_outperformance': float(portfolio_end - index_end)
        }

        return metrics
