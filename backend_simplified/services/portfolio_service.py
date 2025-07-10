"""
Portfolio Service - Time Series Portfolio Valuation
Extends existing portfolio calculations to provide daily portfolio values over time ranges.
Now uses CurrentPriceManager for unified price data handling.
"""
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from collections import defaultdict
import logging
import asyncio

from debug_logger import DebugLogger
from supa_api.supa_api_client import get_supa_client
from supa_api.supa_api_jwt_helpers import create_authenticated_client, log_jwt_operation
from supabase.client import create_client
from config import SUPA_API_URL, SUPA_API_ANON_KEY
from services.current_price_manager import current_price_manager

logger = logging.getLogger(__name__)

class PortfolioTimeSeriesService:
    """Service for calculating portfolio values over time"""
    
    @staticmethod
    #@DebugLogger.log_api_call(api_name="PORTFOLIO_SERVICE", sender="BACKEND", receiver="DATABASE", operation="GET_PORTFOLIO_SERIES")
    async def get_portfolio_series(
        user_id: str, 
        range_key: str,
        user_token: Optional[str] = None
    ) -> Tuple[List[Tuple[date, Decimal]], dict]:
        """
        Calculate portfolio value for each trading day in the specified range.
        
        Args:
            user_id: User's UUID
            range_key: One of '7D', '1M', '3M', '1Y', 'YTD', 'MAX'
            user_token: JWT token for RLS compliance
            
        Returns:
            Tuple containing list of (date, portfolio_value_usd) tuples, sorted by date, and a dictionary with metadata
        """
        if not user_token:
            logger.error(f"[portfolio_service] ❌ JWT token required for RLS compliance")
            raise ValueError("JWT token required for portfolio time series calculation")
        
        log_jwt_operation("PORTFOLIO_TIME_SERIES", user_id, bool(user_token))
        
        try:
            # Use authenticated client for RLS compliance
            client = create_authenticated_client(user_token)
            
            # Convert range key to number of trading days
            num_trading_days = PortfolioServiceUtils.get_trading_days_limit(range_key)
            DebugLogger.info_if_enabled(f"[portfolio_service] 📊 Fetching last {num_trading_days} trading days for range: {range_key}", logger)
            
            # Step 1: Get all user transactions
            DebugLogger.info_if_enabled(f"[portfolio_service] 📊 Step 1: Fetching user transactions...", logger)
            
            transactions_response = client.table('transactions') \
                .select('symbol, quantity, price, date, transaction_type') \
                .eq('user_id', user_id) \
                .order('date', desc=False) \
                .execute()
            
            transactions = transactions_response.data
            logger.info(f"[portfolio_service] ✅ Found {len(transactions)} transactions")
            
            # === EDGE CASE HANDLING: NO TRANSACTIONS ===
            if not transactions:
                logger.info(f"[portfolio_service] ⚠️ No transactions found for user {user_id}")
                logger.info(f"[portfolio_service] 🎯 This is a valid edge case - user has no transactions yet")
                logger.info(f"[portfolio_service] 📊 Returning empty series with no_data flag")
                return [], {"no_data": True, "reason": "no_transactions", "user_guidance": "Add your first transaction to see portfolio performance"}
            
            # Step 2: Get all unique tickers from transactions
            tickers = list(set(t['symbol'] for t in transactions))
            logger.info(f"[portfolio_service] 📈 Found {len(tickers)} unique tickers")
            
            # Step 3: Get the last N trading days from the database
            # Use any ticker to get the trading days (they should all have the same dates)
            logger.info(f"[portfolio_service] 📅 Step 3: Fetching last {num_trading_days} trading days...")
            
            # Special handling for YTD
            if range_key == 'YTD':
                # For YTD, we need dates from Jan 1 of current year
                current_year = date.today().year
                ytd_start = date(current_year, 1, 1)
                
                dates_response = client.table('historical_prices') \
                    .select('date') \
                    .eq('symbol', tickers[0]) \
                    .gte('date', ytd_start.isoformat()) \
                    .order('date', desc=True) \
                    .execute()
            else:
                # For other ranges, get last N trading days
                dates_response = client.table('historical_prices') \
                    .select('date') \
                    .eq('symbol', tickers[0]) \
                    .order('date', desc=True) \
                    .limit(num_trading_days) \
                    .execute()
            
            # Extract and sort dates (oldest to newest)
            trading_dates = sorted([
                datetime.strptime(record['date'], '%Y-%m-%d').date() 
                for record in dates_response.data
            ])
            
            if not trading_dates:
                logger.warning(f"[portfolio_service] No trading dates found for ticker {tickers[0]}")
                return [], {"no_data": True, "reason": "no_trading_dates", "user_guidance": "Historical price data is not available"}
            
            logger.info(f"[portfolio_service] ✅ Found {len(trading_dates)} trading days from {trading_dates[0]} to {trading_dates[-1]}")
            
            # === EDGE CASE HANDLING: TRANSACTIONS TOO RECENT ===
            # Check if user has any transactions within the requested date range
            earliest_transaction_date = min(datetime.strptime(t['date'], '%Y-%m-%d').date() for t in transactions)
            latest_transaction_date = max(datetime.strptime(t['date'], '%Y-%m-%d').date() for t in transactions)
            
           # logger.info(f"[portfolio_service] 📅 User transaction date range: {earliest_transaction_date} to {latest_transaction_date}")
           # logger.info(f"[portfolio_service] 📅 Requested trading date range: {trading_dates[0]} to {trading_dates[-1]}")
            
            # Step 4: Fetch historical prices using CurrentPriceManager
            logger.info(f"[portfolio_service] 💰 Step 4: Fetching historical prices via CurrentPriceManager...")
            
            # Get the date range from our trading dates
            start_date = trading_dates[0]
            end_date = trading_dates[-1]
            
            # Use CurrentPriceManager to get portfolio prices (ensures data freshness)
            portfolio_prices_result = await current_price_manager.get_portfolio_prices(
                symbols=tickers,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            if not portfolio_prices_result.get("success"):
                logger.warning(f"[portfolio_service] ⚠️ CurrentPriceManager failed to get portfolio prices")
                return [], {
                    "no_data": True, 
                    "reason": "price_service_error", 
                    "user_guidance": "Data Not Available At This Time",
                    "missing_tickers": tickers
                }
            
            portfolio_prices = portfolio_prices_result["data"]["portfolio_prices"]
            failed_symbols = portfolio_prices_result["data"]["failed_symbols"]
            
            if failed_symbols:
                logger.warning(f"[portfolio_service] ⚠️ Failed to get prices for: {failed_symbols}")
            
            # === EDGE CASE HANDLING: MISSING PRICE DATA ===
            if not portfolio_prices:
                logger.warning(f"[portfolio_service] ⚠️ No historical price data available for any ticker")
                return [], {
                    "no_data": True, 
                    "reason": "no_price_data", 
                    "user_guidance": "Data Not Available At This Time",
                    "missing_tickers": tickers
                }
            
            # Step 5: Build price lookup dictionary from CurrentPriceManager data
            price_lookup = defaultdict(dict)  # {symbol: {date: price}}
            
            for symbol, price_data in portfolio_prices.items():
                for price_record in price_data:
                    try:
                        price_date = datetime.strptime(price_record['time'], '%Y-%m-%d').date()
                        close_price = Decimal(str(price_record['close']))
                        price_lookup[symbol][price_date] = close_price
                    except (ValueError, KeyError) as e:
                        logger.warning(f"[portfolio_service] Skipping invalid price record for {symbol}: {e}")
                        continue
            
            logger.info(f"[portfolio_service] 🗂️ Built price lookup for {len(price_lookup)} tickers via CurrentPriceManager")
            
            # Step 6: Calculate holdings evolution day by day
            #logger.info(f"[portfolio_service] 🧮 Step 6: Calculating daily portfolio values...")
            
            portfolio_series = []
            current_holdings = defaultdict(Decimal)  # {ticker: shares}
            
            # Index transactions by date
            transactions_by_date = defaultdict(list)
            for tx in transactions:
                tx_date = datetime.strptime(tx['date'], '%Y-%m-%d').date()
                transactions_by_date[tx_date].append(tx)
            
            # Seed holdings from transactions before our start date
            for tx in transactions:
                tx_date = datetime.strptime(tx['date'], '%Y-%m-%d').date()
                if tx_date < start_date:
                    symbol = tx['symbol']
                    shares = Decimal(str(tx['quantity']))
                    transaction_type = tx.get('transaction_type', 'Buy').upper()
                    
                    if transaction_type in ['BUY', 'Buy']:
                        shares_delta = abs(shares)
                    elif transaction_type in ['SELL', 'Sell']:
                        shares_delta = -abs(shares)
                    else:
                        shares_delta = abs(shares)
                    
                    current_holdings[symbol] += shares_delta
            
            # Log seeded holdings
            seeded_holdings_count = len([s for s, shares in current_holdings.items() if shares > 0])
            if seeded_holdings_count > 0:
                logger.info(f"[portfolio_service] 📊 Seeded {seeded_holdings_count} holdings from before {start_date}")
            else:
                logger.info(f"[portfolio_service] 📊 No holdings seeded from before {start_date}")
            
            # Process ONLY the trading dates we got from the database
            for current_date in trading_dates:
                # Apply any transactions on this date
                if current_date in transactions_by_date:
                    for tx in transactions_by_date[current_date]:
                        symbol = tx['symbol']
                        shares = Decimal(str(tx['quantity']))
                        transaction_type = tx.get('transaction_type', 'Buy').upper()
                        
                        if transaction_type in ['BUY', 'Buy']:
                            shares_delta = abs(shares)
                        elif transaction_type in ['SELL', 'Sell']:
                            shares_delta = -abs(shares)
                        else:
                            shares_delta = abs(shares)
                        
                        current_holdings[symbol] += shares_delta
                
                # Calculate portfolio value for this date
                daily_value = Decimal('0')
                holdings_count = 0
                
                for symbol, shares in current_holdings.items():
                    if shares > 0:
                        # Get price for this date
                        price = price_lookup[symbol].get(current_date)
                        
                        if price is None:
                            # Fallback to most recent price
                            price = PortfolioTimeSeriesService._get_price_for_date(
                                symbol, current_date, price_lookup[symbol]
                            )
                        
                        if price is not None:
                            holding_value = shares * price
                            daily_value += holding_value
                            holdings_count += 1
                
                portfolio_series.append((current_date, daily_value))
            
            
            # === EDGE CASE HANDLING: ALL ZERO VALUES ===
            if not portfolio_series:
                logger.warning("[portfolio_service] No valid portfolio values found - empty series")
                return [], {"no_data": True, "reason": "empty_series", "user_guidance": "Unable to calculate portfolio values for the selected timeframe"}
            
            # Check if all values are zero
            all_zero = all(value == Decimal('0') for _, value in portfolio_series)
            if all_zero:
                logger.warning("[portfolio_service] All portfolio values are zero")
                return portfolio_series, {"no_data": False, "all_zero": True, "reason": "all_zero_values", "user_guidance": "Your portfolio shows zero value. Check if you have any current holdings."}
            
            # Remove leading zero values (non-trading days at start)
            logger.info(f"[portfolio_service] 🧹 Checking for leading zero values...")
            original_length = len(portfolio_series)
            
            # Find first non-zero value
            first_non_zero_index = 0
            for i, (date_val, value) in enumerate(portfolio_series):
                if value > Decimal('0'):
                    first_non_zero_index = i
                    break
            
            if first_non_zero_index > 0:
                logger.info(f"[portfolio_service] 🧹 Removing {first_non_zero_index} leading zero-value days")
                logger.info(f"[portfolio_service] 🧹 First zero date: {portfolio_series[0][0]}")
                logger.info(f"[portfolio_service] 🧹 First non-zero date: {portfolio_series[first_non_zero_index][0]} (value: ${portfolio_series[first_non_zero_index][1]})")
                # Remove leading zeros
                portfolio_series = portfolio_series[first_non_zero_index:]
            else:
                logger.info(f"[portfolio_service] 🧹 No leading zeros to remove")
            
            # Final validation
            if not portfolio_series:
                logger.warning("[portfolio_service] No portfolio values remaining after removing leading zeros")
                return [], {"no_data": True, "reason": "no_data_after_cleanup", "user_guidance": "No portfolio data available for the selected timeframe"}
            
            
            return portfolio_series, {"no_data": False, "reason": "success"}
            
        except Exception as e:
            logger.error(f"[portfolio_service] ❌ Error in portfolio time series calculation: {e}")
            DebugLogger.log_error(
                file_name="portfolio_service.py",
                function_name="get_portfolio_series",
                error=e,
                user_id=user_id,
                range_key=range_key
            )
            raise
    
    @staticmethod
    def _get_price_for_date(symbol: str, target_date: date, symbol_prices: Dict[date, Decimal]) -> Optional[Decimal]:

        # Try exact date first
        if target_date in symbol_prices:
            return symbol_prices[target_date]
        
        # Fallback: find most recent price before target date
        available_dates = [d for d in symbol_prices.keys() if d <= target_date]
        if available_dates:
            most_recent_date = max(available_dates)
            return symbol_prices[most_recent_date]
        
        # No price available
        logger.warning(f"[portfolio_service] ⚠️ No price found for {symbol} on or before {target_date}")
        return None

    @staticmethod
    async def get_index_only_series(
        user_id: str,
        range_key: str,
        benchmark: str = 'SPY',
        user_token: Optional[str] = None
    ) -> Tuple[List[Tuple[date, Decimal]], dict]:

        if not user_token:
            logger.error(f"[portfolio_service] ❌ JWT token required for index-only series")
            raise ValueError("JWT token required for index-only series calculation")
        
        try:
            # Use authenticated client for RLS compliance
            client = create_authenticated_client(user_token)
            
            # Convert range key to number of trading days
            num_trading_days = PortfolioServiceUtils.get_trading_days_limit(range_key)
            logger.info(f"[portfolio_service] 📊 Fetching last {num_trading_days} trading days for {benchmark}")
            
            # Get trading dates for the benchmark
            if range_key == 'YTD':
                # For YTD, we need dates from Jan 1 of current year
                current_year = date.today().year
                ytd_start = date(current_year, 1, 1)
                
                dates_response = client.table('historical_prices') \
                    .select('date') \
                    .eq('symbol', benchmark) \
                    .gte('date', ytd_start.isoformat()) \
                    .order('date', desc=True) \
                    .execute()
            else:
                # For other ranges, get last N trading days
                dates_response = client.table('historical_prices') \
                    .select('date') \
                    .eq('symbol', benchmark) \
                    .order('date', desc=True) \
                    .limit(num_trading_days) \
                    .execute()
            
            # Extract and sort dates (oldest to newest)
            trading_dates = sorted([
                datetime.strptime(record['date'], '%Y-%m-%d').date() 
                for record in dates_response.data
            ])
            
            if not trading_dates:
                logger.warning(f"[portfolio_service] No trading dates found for benchmark {benchmark}")
                logger.info(f"[portfolio_service] 📊 Returning empty series - even index data unavailable")
                return [], {"no_data": True, "index_only": True, "reason": "no_benchmark_data", "user_guidance": f"Historical data for {benchmark} is not available"}
            
            logger.info(f"[portfolio_service] ✅ Found {len(trading_dates)} trading days from {trading_dates[0]} to {trading_dates[-1]}")
            
            # Get benchmark prices for these dates
            start_date = trading_dates[0]
            end_date = trading_dates[-1]
            
            prices_response = client.table('historical_prices') \
                .select('date, close') \
                .eq('symbol', benchmark) \
                .gte('date', start_date.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .order('date', desc=False) \
                .execute()
            
            price_data = prices_response.data
            logger.info(f"[portfolio_service] ✅ Found {len(price_data)} price records for {benchmark}")
            
            if not price_data:
                logger.warning(f"[portfolio_service] No price data found for benchmark {benchmark}")
                logger.info(f"[portfolio_service] 📊 Returning empty series - benchmark price data unavailable")
                return [], {"no_data": True, "index_only": True, "reason": "no_benchmark_prices", "user_guidance": f"Price data for {benchmark} is not available"}
            
            # Build index series
            index_series = []
            for price_record in price_data:
                price_date = datetime.strptime(price_record['date'], '%Y-%m-%d').date()
                close_price = Decimal(str(price_record['close']))
                index_series.append((price_date, close_price))
                logger.debug(f"[portfolio_service] 📈 {price_date}: {benchmark} = ${close_price}")
            
            # Sort by date
            index_series.sort(key=lambda x: x[0])
            
            if not index_series:
                logger.warning(f"[portfolio_service] No index series data generated for {benchmark}")
                logger.info(f"[portfolio_service] 📊 Returning empty series")
                return [], {"no_data": True, "index_only": True, "reason": "empty_index_series", "user_guidance": f"Unable to generate {benchmark} performance data"}
            
            return index_series, {
                "no_data": False,
                "index_only": True,
                "benchmark": benchmark,
                "reason": "index_only_mode",
                "user_guidance": f"Showing {benchmark} performance. Add transactions to see your portfolio comparison."
            }
            
        except Exception as e:
            logger.error(f"[portfolio_service] ❌ Error in index-only series calculation: {e}")
            DebugLogger.log_error(
                file_name="portfolio_service.py",
                function_name="get_index_only_series",
                error=e,
                user_id=user_id,
                range_key=range_key,
                benchmark=benchmark
            )
            raise

class PortfolioServiceUtils:
    """Utility functions for portfolio service operations"""
    
    @staticmethod
    def get_trading_days_limit(range_key: str) -> int:
 
        trading_days_map = {
            '7D': 7,       # Get 7 days (will only return actual trading days)
            '1M': 30,      # Get 30 days worth
            '3M': 90,      # Get 90 days worth
            '1Y': 365,     # Get 365 days worth
            'YTD': None,   # Special handling - from Jan 1 to today
            'MAX': 1825    # Get 5 years worth (365 * 5)
        }
        
        return trading_days_map.get(range_key, 365)
    
    @staticmethod
    def compute_date_range(range_key: str) -> Tuple[date, date]:

        logger.info(f"[portfolio_service] 📅 Computing date range for: {range_key}")
        
        end_date = date.today()
        
        if range_key == '7D':
            start_date = end_date - timedelta(days=7)
        elif range_key == '1M':
            start_date = end_date - timedelta(days=30)
        elif range_key == '3M':
            start_date = end_date - timedelta(days=90)
        elif range_key == '1Y':
            start_date = end_date - timedelta(days=365)
        elif range_key == 'YTD':
            start_date = date(end_date.year, 1, 1)
        elif range_key == 'MAX':
            # For MAX, we'll use a reasonable historical start (5 years back)
            start_date = end_date - timedelta(days=365 * 5)
        else:
            logger.warning(f"[portfolio_service] ⚠️ Unknown range key: {range_key}, defaulting to 1Y")
            start_date = end_date - timedelta(days=365)
        
        logger.info(f"[portfolio_service] ✅ Date range: {start_date} to {end_date}")
        return start_date, end_date
    
    @staticmethod
    def format_series_for_response(
        portfolio_series: List[Tuple[date, Decimal]], 
        index_series: List[Tuple[date, Decimal]]
    ) -> Dict[str, Any]:

        # Ensure both series have the same dates
        portfolio_dict = {d: v for d, v in portfolio_series}
        index_dict = {d: v for d, v in index_series}
        
        # Get all unique dates and sort them
        all_dates = sorted(set(list(portfolio_dict.keys()) + list(index_dict.keys())))
        
        formatted_data = {
            "dates": [d.isoformat() for d in all_dates],
            "portfolio": [float(portfolio_dict.get(d, 0)) for d in all_dates],
            "index": [float(index_dict.get(d, 0)) for d in all_dates],
            "metadata": {
                "start_date": all_dates[0].isoformat() if all_dates else None,
                "end_date": all_dates[-1].isoformat() if all_dates else None,
                "total_points": len(all_dates),
                "portfolio_final_value": float(portfolio_dict.get(all_dates[-1], 0)) if all_dates else 0,
                "index_final_value": float(index_dict.get(all_dates[-1], 0)) if all_dates else 0
            }
        }
        
        return formatted_data