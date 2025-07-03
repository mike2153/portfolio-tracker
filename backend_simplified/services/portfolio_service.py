"""
Portfolio Service - Time Series Portfolio Valuation
Extends existing portfolio calculations to provide daily portfolio values over time ranges.
Leverages existing supa_api infrastructure with extensive debugging.
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

logger = logging.getLogger(__name__)

class PortfolioTimeSeriesService:
    """Service for calculating portfolio values over time"""
    
    @staticmethod
    @DebugLogger.log_api_call(api_name="PORTFOLIO_SERVICE", sender="BACKEND", receiver="DATABASE", operation="GET_PORTFOLIO_SERIES")
    async def get_portfolio_series(
        user_id: str, 
        start_date: date, 
        end_date: date,
        user_token: Optional[str] = None
    ) -> List[Tuple[date, Decimal]]:
        """
        Calculate portfolio value for each trading day in the specified range.
        
        Args:
            user_id: User's UUID
            start_date: Start date (inclusive)
            end_date: End date (inclusive) 
            user_token: JWT token for RLS compliance
            
        Returns:
            List of (date, portfolio_value_usd) tuples, sorted by date
        """
        logger.info(f"[portfolio_service] === PORTFOLIO TIME SERIES CALCULATION START ===")
        logger.info(f"[portfolio_service] User ID: {user_id}")
        logger.info(f"[portfolio_service] Date range: {start_date} to {end_date}")
        logger.info(f"[portfolio_service] JWT token present: {bool(user_token)}")
        logger.info(f"[portfolio_service] Timestamp: {datetime.now().isoformat()}")
        
        if not user_token:
            logger.error(f"[portfolio_service] ❌ JWT token required for RLS compliance")
            raise ValueError("JWT token required for portfolio time series calculation")
        
        log_jwt_operation("PORTFOLIO_TIME_SERIES", user_id, bool(user_token))
        
        try:
            # Use authenticated client for RLS compliance
            client = create_authenticated_client(user_token)
            
            # Step 1: Get all user transactions up to end_date
            logger.info(f"[portfolio_service] 📊 Step 1: Fetching user transactions...")
            
            transactions_response = client.table('transactions') \
                .select('symbol, quantity, price, date, transaction_type') \
                .eq('user_id', user_id) \
                .lte('date', end_date.isoformat()) \
                .order('date', desc=False) \
                .execute()
            
            transactions = transactions_response.data
            logger.info(f"[portfolio_service] ✅ Found {len(transactions)} transactions")
            
            if not transactions:
                logger.info(f"[portfolio_service] ⚠️ No transactions found, returning zero values")
                return await PortfolioTimeSeriesService._generate_zero_series(start_date, end_date)
            
            # Step 2: Get all unique tickers from transactions
            tickers = list(set(t['symbol'] for t in transactions))
            logger.info(f"[portfolio_service] 📈 Step 2: Found {len(tickers)} unique tickers: {tickers}")
            
            # Step 3: Fetch historical prices for all tickers and date range
            logger.info(f"[portfolio_service] 💰 Step 3: Fetching historical prices...")
            
            prices_response = client.table('historical_prices') \
                .select('symbol, date, close') \
                .in_('symbol', tickers) \
                .gte('date', start_date.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .execute()
            
            historical_prices = prices_response.data
            logger.info(f"[portfolio_service] ✅ Found {len(historical_prices)} price records")
            
            # Step 4: Build price lookup dictionary
            price_lookup = defaultdict(dict)  # {symbol: {date: price}}
            for price_record in historical_prices:
                symbol = price_record['symbol']
                price_date = datetime.strptime(price_record['date'], '%Y-%m-%d').date()
                close_price = Decimal(str(price_record['close']))
                price_lookup[symbol][price_date] = close_price
            
            logger.info(f"[portfolio_service] 🗂️ Step 4: Built price lookup for {len(price_lookup)} tickers")
            
            # Step 5: Calculate holdings evolution day by day
            logger.info(f"[portfolio_service] 🧮 Step 5: Calculating daily portfolio values...")
            
            portfolio_series = []
            current_holdings = defaultdict(Decimal)  # {ticker: shares}
            
            # Generate all dates in range
            current_date = start_date
            dates_in_range = []
            while current_date <= end_date:
                dates_in_range.append(current_date)
                current_date += timedelta(days=1)
            
            logger.info(f"[portfolio_service] 📅 Processing {len(dates_in_range)} dates from {start_date} to {end_date}")
            
            # Index transactions by date for efficient lookup
            transactions_by_date = defaultdict(list)
            for tx in transactions:
                tx_date = datetime.strptime(tx['date'], '%Y-%m-%d').date()
                if tx_date <= end_date:  # Only include transactions up to end_date
                    transactions_by_date[tx_date].append(tx)
            
            logger.info(f"[portfolio_service] 🗓️ Indexed transactions across {len(transactions_by_date)} dates")
            
            # Process each date
            for current_date in dates_in_range:
                # Apply any transactions on this date
                if current_date in transactions_by_date:
                    for tx in transactions_by_date[current_date]:
                        symbol = tx['symbol']
                        shares = Decimal(str(tx['quantity']))
                        transaction_type = tx.get('transaction_type', 'Buy').upper()
                        
                        # Handle transaction types properly
                        if transaction_type in ['BUY', 'Buy']:
                            shares_delta = abs(shares)  # Buy = add positive shares
                        elif transaction_type in ['SELL', 'Sell']:
                            shares_delta = -abs(shares)  # Sell = subtract shares
                        else:
                            # For dividends or other types, assume reinvestment (add shares)
                            shares_delta = abs(shares)
                            logger.debug(f"[portfolio_service] ℹ️ Unknown transaction type '{transaction_type}', treating as buy")
                        
                        current_holdings[symbol] += shares_delta
                        
                        logger.debug(f"[portfolio_service] 📝 {current_date}: {transaction_type} {shares_delta} shares of {symbol}, new total: {current_holdings[symbol]}")
                
                # Calculate portfolio value for this date
                daily_value = Decimal('0')
                holdings_count = 0
                
                for symbol, shares in current_holdings.items():
                    if shares > 0:  # Only count positive holdings
                        # Get price for this date (or most recent available)
                        price = PortfolioTimeSeriesService._get_price_for_date(
                            symbol, current_date, price_lookup[symbol]
                        )
                        
                        if price is not None:
                            holding_value = shares * price
                            daily_value += holding_value
                            holdings_count += 1
                            
                            logger.debug(f"[portfolio_service] 💵 {current_date}: {symbol} = {shares} × ${price} = ${holding_value}")
                
                portfolio_series.append((current_date, daily_value))
                
                if len(portfolio_series) % 30 == 0:  # Log progress every 30 days
                    logger.info(f"[portfolio_service] 📊 Processed {len(portfolio_series)} days, current value: ${daily_value}")
            
            logger.info(f"[portfolio_service] ✅ Portfolio time series calculation complete")
            logger.info(f"[portfolio_service] 📈 Generated {len(portfolio_series)} data points")
            logger.info(f"[portfolio_service] 💰 Final portfolio value: ${portfolio_series[-1][1] if portfolio_series else 0}")
            logger.info(f"[portfolio_service] === PORTFOLIO TIME SERIES CALCULATION END ===")
            
            return portfolio_series
            
        except Exception as e:
            logger.error(f"[portfolio_service] ❌ Error in portfolio time series calculation: {e}")
            DebugLogger.log_error(
                file_name="portfolio_service.py",
                function_name="get_portfolio_series",
                error=e,
                user_id=user_id,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat()
            )
            raise
    
    @staticmethod
    def _get_price_for_date(symbol: str, target_date: date, symbol_prices: Dict[date, Decimal]) -> Optional[Decimal]:
        """
        Get the price for a symbol on a specific date, with fallback to most recent price.
        
        Args:
            symbol: Stock symbol
            target_date: Date to get price for
            symbol_prices: Dictionary of {date: price} for this symbol
            
        Returns:
            Price as Decimal, or None if no price found
        """
        # Try exact date first
        if target_date in symbol_prices:
            return symbol_prices[target_date]
        
        # Fallback: find most recent price before target date
        available_dates = [d for d in symbol_prices.keys() if d <= target_date]
        if available_dates:
            most_recent_date = max(available_dates)
            logger.debug(f"[portfolio_service] 📅 Using price from {most_recent_date} for {symbol} on {target_date}")
            return symbol_prices[most_recent_date]
        
        # No price available
        logger.warning(f"[portfolio_service] ⚠️ No price found for {symbol} on or before {target_date}")
        return None
    
    @staticmethod
    async def _generate_zero_series(start_date: date, end_date: date) -> List[Tuple[date, Decimal]]:
        """Generate a time series of zero values for the given date range"""
        logger.info(f"[portfolio_service] 🔢 Generating zero value series from {start_date} to {end_date}")
        
        series = []
        current_date = start_date
        while current_date <= end_date:
            series.append((current_date, Decimal('0')))
            current_date += timedelta(days=1)
        
        logger.info(f"[portfolio_service] ✅ Generated {len(series)} zero value data points")
        return series

class PortfolioServiceUtils:
    """Utility functions for portfolio service operations"""
    
    @staticmethod
    def compute_date_range(range_key: str) -> Tuple[date, date]:
        """
        Compute start and end dates for a given range key.
        
        Args:
            range_key: One of '7D', '1M', '3M', '1Y', 'YTD', 'MAX'
            
        Returns:
            (start_date, end_date) tuple
        """
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
        """
        Format time series data for JSON response.
        
        Args:
            portfolio_series: List of (date, value) tuples for portfolio
            index_series: List of (date, value) tuples for index
            
        Returns:
            Dictionary with formatted data for frontend consumption
        """
        logger.info(f"[portfolio_service] 📊 Formatting series data for response")
        logger.info(f"[portfolio_service] Portfolio points: {len(portfolio_series)}")
        logger.info(f"[portfolio_service] Index points: {len(index_series)}")
        
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
        
        logger.info(f"[portfolio_service] ✅ Formatted response with {len(all_dates)} data points")
        logger.info(f"[portfolio_service] Final portfolio value: ${formatted_data['metadata']['portfolio_final_value']}")
        logger.info(f"[portfolio_service] Final index value: ${formatted_data['metadata']['index_final_value']}")
        
        return formatted_data