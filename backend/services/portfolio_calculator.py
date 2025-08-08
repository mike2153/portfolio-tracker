"""
Portfolio Calculator - THE ONLY portfolio performance calculator
This service calculates all portfolio metrics including holdings, gains/losses, and allocations.
Uses PriceDataService for all price data - NO direct price fetching.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple, DefaultDict
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from collections import defaultdict

from services.price_manager import price_manager
from supa_api.supa_api_historical_prices import (
    supa_api_store_historical_prices_batch,
)
from vantage_api.vantage_api_quotes import vantage_api_get_daily_adjusted
from services.feature_flag_service import is_feature_enabled
from supa_api.supa_api_transactions import supa_api_get_user_transactions
from supa_api.supa_api_jwt_helpers import create_authenticated_client
from utils.auth_helpers import validate_user_id

logger = logging.getLogger(__name__)


class PortfolioSummary:
    """Data class for portfolio summary metrics."""
    def __init__(self) -> None:
        self.total_value: Decimal = Decimal('0')
        self.total_cost: Decimal = Decimal('0')
        self.total_gain_loss: Decimal = Decimal('0')
        self.total_gain_loss_percent: Decimal = Decimal('0')
        self.total_dividends: Decimal = Decimal('0')
        self.daily_change: Decimal = Decimal('0')
        self.daily_change_percent: Decimal = Decimal('0')


class XIRRCalculator:
    """
    Calculator for Extended Internal Rate of Return (XIRR).
    Uses Newton-Raphson method to find the rate that makes NPV = 0.
    """
    
    @staticmethod
    def calculate_xirr(cash_flows: List[Decimal], dates: List[date], guess: float = 0.1) -> Optional[float]:
        """
        Calculate XIRR for a series of cash flows.
        
        Args:
            cash_flows: List of cash flows as Decimal (negative for investments, positive for returns)
            dates: List of dates corresponding to cash flows
            guess: Initial guess for the rate (default 0.1 = 10%)
            
        Returns:
            XIRR as a decimal (e.g., 0.15 for 15%) or None if calculation fails
        """
        # Convert Decimal cash flows to float for mathematical operations
        cash_flows_float = []
        for cf in cash_flows:
            try:
                if isinstance(cf, Decimal):
                    cash_flows_float.append(float(cf))
                else:
                    cash_flows_float.append(float(Decimal(str(cf))))
            except (ValueError, InvalidOperation) as e:
                logger.error(f"Invalid cash flow conversion: {cf}, error: {e}")
                return None
        if len(cash_flows) != len(dates):
            logger.error("Cash flows and dates must have the same length")
            return None
            
        if len(cash_flows) < 2:
            logger.error("Need at least 2 cash flows to calculate XIRR")
            return None
            
        # Check for valid cash flows (need both positive and negative)
        has_positive = any(cf > 0 for cf in cash_flows_float)
        has_negative = any(cf < 0 for cf in cash_flows_float)
        
        if not (has_positive and has_negative):
            logger.error("Cash flows must have both positive and negative values")
            return None
            
        # Convert dates to days from first date
        first_date = min(dates)
        days_from_start = [(d - first_date).days for d in dates]
        
        # Newton-Raphson method
        rate = guess
        max_iterations = 100
        tolerance = 1e-6
        
        for iteration in range(max_iterations):
            # Calculate NPV and its derivative
            npv = 0.0
            dnpv = 0.0
            
            for i, (cf, days) in enumerate(zip(cash_flows_float, days_from_start)):
                if days == 0:
                    # First cash flow
                    npv += cf
                    dnpv += 0
                else:
                    # Subsequent cash flows
                    years = days / 365.0
                    if rate == -1:
                        continue  # Skip this iteration if rate would cause division by zero
                    pv_factor = (1 + rate) ** (-years)
                    npv += cf * pv_factor
                    dnpv += -cf * years * pv_factor / (1 + rate)
            
            # Check convergence
            if abs(npv) < tolerance:
                return rate
                
            # Avoid division by zero
            if abs(dnpv) < tolerance:
                logger.warning("Derivative too small, trying different guess")
                # Try with a different initial guess
                if guess != 0.0:
                    # Pass original Decimal values
                    return XIRRCalculator.calculate_xirr(cash_flows, dates, guess=0.0)
                else:
                    return None
                    
            # Newton-Raphson update
            rate_new = rate - npv / dnpv
            
            # Bound the rate to reasonable values (-0.99 to 10)
            rate_new = max(-0.99, min(rate_new, 10.0))
            
            # Check for convergence
            if abs(rate_new - rate) < tolerance:
                return rate_new
                
            rate = rate_new
            
        logger.warning(f"XIRR calculation did not converge after {max_iterations} iterations")
        # Try with different initial guess
        if guess != 0.0:
            # Pass original Decimal values
            return XIRRCalculator.calculate_xirr(cash_flows, dates, guess=0.0)
        
        return None
    
    @staticmethod
    def calculate(cash_flows: List[Dict[str, Any]]) -> Optional[float]:
        """
        Calculate XIRR from a list of cash flow dictionaries.
        This is a convenience method matching the test interface.
        
        Args:
            cash_flows: List of dicts with 'date' and 'amount' keys
            
        Returns:
            XIRR as a decimal or None if calculation fails
        """
        if not cash_flows:
            return None
            
        amounts = []
        dates_list = []
        
        for cf in cash_flows:
            # Ensure amounts are Decimal
            amount = cf['amount']
            if not isinstance(amount, Decimal):
                amount = Decimal(str(amount))
            amounts.append(amount)
            dates_list.append(cf['date'])
            
        return XIRRCalculator.calculate_xirr(amounts, dates_list)


class PortfolioCalculator:
    """
    Service for calculating portfolio metrics and performance.
    This is the ONLY service that should be used for portfolio calculations.
    """
    
    @staticmethod
    def _safe_decimal_conversion(value: Any, user_id: Optional[str] = None) -> Decimal:
        """
        Safely convert values to Decimal with feature flag support.
        
        Args:
            value: Value to convert to Decimal
            user_id: Optional user ID for feature flag evaluation
            
        Returns:
            Decimal representation of the value
        """
        try:
            # Validate user_id if provided
            if user_id:
                user_id = validate_user_id(user_id)
            
            if is_feature_enabled("decimal_migration", user_id):
                # Precise conversion - maintain original precision
                if isinstance(value, Decimal):
                    return value
                elif isinstance(value, str):
                    return Decimal(value) if value else Decimal('0')
                elif isinstance(value, (int, float)):
                    return Decimal(str(value))
                else:
                    return Decimal(str(value))
            else:
                # Legacy fallback - preserve precision without float conversion
                if isinstance(value, Decimal):
                    return value
                elif isinstance(value, str):
                    return Decimal(value) if value else Decimal('0')
                elif isinstance(value, (int, float)):
                    return Decimal(str(value))
                else:
                    return Decimal(str(value))
                    
        except (ValueError, TypeError, InvalidOperation) as e:
            logger.error(f"Failed to convert {value} to Decimal: {e}")
            return Decimal('0')
    
    @staticmethod
    async def calculate_holdings(user_id: str, user_token: str, transactions: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Calculate current holdings from user transactions.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            transactions: Optional pre-fetched transactions to avoid duplicate DB calls
            
        Returns:
            Dict with holdings and portfolio summary
            
        Raises:
            TypeError: If inputs have invalid types
            ValueError: If inputs have invalid values
        """
        from utils.type_guards import ensure_user_id, log_type_validation_error
        
        try:
            # Validate input types
            user_id = ensure_user_id(user_id, "user_id")
            
            if not isinstance(user_token, str) or not user_token.strip():
                raise TypeError("user_token must be a non-empty string")
            
            if transactions is not None and not isinstance(transactions, list):
                raise TypeError("transactions must be a list or None")
            # Use provided transactions or fetch them
            if transactions is None:
                transactions = await supa_api_get_user_transactions(
                    user_id=user_id,
                    limit=10000,  # Get all transactions
                    user_token=user_token
                )
            
            if not transactions:
                logger.info(f"[PortfolioCalculator] No transactions found for user {user_id}")
                return {
                    "holdings": [],
                    "total_value": 0.0,
                    "total_cost": 0.0,
                    "total_gain_loss": 0.0,
                    "total_gain_loss_percent": 0.0,
                    "total_dividends": 0.0
                }
            
            # Process transactions to calculate holdings using FIFO method
            holdings_map = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
            
            # Get current prices for all holdings
            symbols = [h['symbol'] for h in holdings_map.values() if h['quantity'] > 0]
            current_prices = await price_manager.get_prices_for_symbols_from_db(symbols, user_token)
            
            # Calculate current values and gains
            holdings = []
            total_value = Decimal('0')
            total_cost = Decimal('0')
            total_dividends = Decimal('0')
            
            for symbol, holding_data in holdings_map.items():
                if holding_data['quantity'] <= 0:
                    continue
                
                price_data = current_prices.get(symbol)
                if not price_data:
                    logger.warning(f"[PortfolioCalculator] No price found for {symbol}, skipping")
                    continue
                
                from utils.financial_math import safe_decimal, safe_multiply, safe_subtract, safe_gain_loss_percent
                
                current_price = safe_decimal(price_data['price'], f"current_price_{symbol}")
                current_value = safe_multiply(holding_data['quantity'], current_price, f"current_value_{symbol}")
                cost_basis = safe_decimal(holding_data['total_cost'], f"cost_basis_{symbol}")
                gain_loss = safe_subtract(current_value, cost_basis, f"gain_loss_{symbol}")
                gain_loss_percent = safe_gain_loss_percent(gain_loss, cost_basis, f"gain_loss_percent_{symbol}")
                
                holdings.append({
                    'symbol': symbol,
                    'quantity': PortfolioCalculator._safe_decimal_conversion(holding_data['quantity'], user_id),
                    'avg_cost': PortfolioCalculator._safe_decimal_conversion(cost_basis / holding_data['quantity'], user_id) if holding_data['quantity'] > 0 else Decimal('0'),
                    'total_cost': PortfolioCalculator._safe_decimal_conversion(cost_basis, user_id),
                    'current_price': PortfolioCalculator._safe_decimal_conversion(current_price, user_id),
                    'current_value': PortfolioCalculator._safe_decimal_conversion(current_value, user_id),
                    'gain_loss': PortfolioCalculator._safe_decimal_conversion(gain_loss, user_id),
                    'gain_loss_percent': PortfolioCalculator._safe_decimal_conversion(gain_loss_percent, user_id),
                    'dividends_received': PortfolioCalculator._safe_decimal_conversion(holding_data['dividends_received'], user_id),
                    'price_date': price_data['date']
                })
                
                total_value += current_value
                total_cost += cost_basis
                total_dividends += holding_data['dividends_received']
            
            # Sort holdings by value (largest first)
            holdings.sort(key=lambda x: x['current_value'], reverse=True)
            
            # Calculate portfolio totals
            total_gain_loss = total_value - total_cost
            from utils.financial_math import safe_percentage
            total_gain_loss_percent = safe_percentage(total_gain_loss, total_cost, 0, "portfolio_total_gain_loss_percent")
            
            return {
                "holdings": holdings,
                "total_value": PortfolioCalculator._safe_decimal_conversion(total_value, user_id),
                "total_cost": PortfolioCalculator._safe_decimal_conversion(total_cost, user_id),
                "total_gain_loss": PortfolioCalculator._safe_decimal_conversion(total_gain_loss, user_id),
                "total_gain_loss_percent": PortfolioCalculator._safe_decimal_conversion(total_gain_loss_percent, user_id),
                "total_dividends": PortfolioCalculator._safe_decimal_conversion(total_dividends, user_id)
            }
            
        except (TypeError, ValueError) as e:
            log_type_validation_error(e, "calculate_holdings")
            raise
        except Exception as e:
            logger.error(f"[PortfolioCalculator] Error calculating holdings: {e}")
            raise
    
    @staticmethod
    async def calculate_allocations(user_id: str, user_token: str) -> Dict[str, Any]:
        """
        Calculate portfolio allocations with percentages and colors.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            
        Returns:
            Dict with allocations and summary
        """
        try:
            holdings_result = await PortfolioCalculator.calculate_holdings(user_id, user_token)
            holdings = holdings_result.get("holdings", [])
            total_value = holdings_result.get("total_value", 0)

            if not holdings:
                return {
                    "allocations": [],
                    "summary": {
                        "total_value": 0,
                        "total_cost": 0,
                        "total_gain_loss": 0,
                        "total_gain_loss_percent": 0,
                        "total_dividends": 0
                    }
                }
            
            # Get current prices with previous_close data for daily change calculations
            symbols = [h['symbol'] for h in holdings]
            current_prices = await price_manager.get_latest_prices(symbols, user_token)
            
            allocations = []
            colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6366F1", "#D946EF", "#F472B6"]
            
            for i, holding in enumerate(holdings):
                symbol = holding['symbol']
                quantity = Decimal(str(holding['quantity']))
                current_price = Decimal(str(holding.get('current_price', 0)))
                
                daily_change = Decimal('0')
                # Use previous_close from current price data if available
                price_data = current_prices.get(symbol)
                if price_data and price_data.get('previous_close') is not None:
                    previous_close = Decimal(str(price_data['previous_close']))
                    if previous_close > 0:
                        daily_change = (current_price - previous_close) * quantity

                allocations.append({
                    "symbol": holding['symbol'],
                    "company_name": holding.get('company_name', holding['symbol']),
                    "quantity": holding['quantity'],
                    "current_price": holding['current_price'],
                    "cost_basis": holding['total_cost'],
                    "current_value": holding['current_value'],
                    "gain_loss": holding['gain_loss'],
                    "gain_loss_percent": holding['gain_loss_percent'],
                    "dividends_received": holding.get("dividends_received", 0),
                    "realized_pnl": holding.get("realized_pnl", 0),
                    "allocation_percent": safe_percentage(holding['current_value'], total_value, 0, f"allocation_percent_{holding['symbol']}"),
                    "color": colors[i % len(colors)],
                    "daily_change": PortfolioCalculator._safe_decimal_conversion(daily_change, user_id),
                    "daily_change_percent": PortfolioCalculator._safe_decimal_conversion(
                        safe_percentage(daily_change, safe_subtract(Decimal(str(holding['current_value'])), daily_change, f"daily_base_value_{holding['symbol']}"), 0, f"daily_change_percent_{holding['symbol']}"), 
                        user_id
                    ),
                })
            
            summary = {
                "total_value": holdings_result.get("total_value", 0),
                    "total_cost": holdings_result.get("total_cost", 0),
                    "total_gain_loss": holdings_result.get("total_gain_loss", 0),
                    "total_gain_loss_percent": holdings_result.get("total_gain_loss_percent", 0),
                    "total_dividends": holdings_result.get("total_dividends", 0)
                }
            
            return {
                "allocations": allocations,
                "summary": summary
            }
            
        except Exception as e:
            logger.error(f"[PortfolioCalculator] Error calculating allocations: {e}")
            raise
    
    @staticmethod
    async def calculate_detailed_holdings(user_id: str, user_token: str, transactions: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        """
        Calculate detailed holdings with realized gains for analytics.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            transactions: Optional pre-fetched transactions to avoid duplicate DB calls
            
        Returns:
            List of detailed holding records
        """
        try:
            # Use provided transactions or fetch them
            if transactions is None:
                transactions = await supa_api_get_user_transactions(
                    user_id=user_id,
                    limit=10000,
                    user_token=user_token
                )
            
            if not transactions:
                return []
            
            # Process transactions with realized gain tracking
            holdings_map = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
            
            # Get current prices
            symbols = [h['symbol'] for h in holdings_map.values() if h['quantity'] > 0]
            current_prices = await price_manager.get_prices_for_symbols_from_db(symbols, user_token)
            
            # Build detailed holdings list
            detailed_holdings = []
            
            for symbol, holding_data in holdings_map.items():
                if holding_data['quantity'] <= 0:
                    continue
                
                price_data = current_prices.get(symbol)
                if not price_data:
                    continue
                
                current_price = Decimal(str(price_data['price']))
                current_value = holding_data['quantity'] * current_price
                cost_basis = holding_data['total_cost']
                unrealized_gain = current_value - cost_basis
                unrealized_gain_percent = safe_gain_loss_percent(unrealized_gain, cost_basis, f"unrealized_gain_percent_{symbol}")
                
                total_profit = unrealized_gain + holding_data['realized_pnl'] + holding_data['dividends_received']
                total_profit_percent = safe_percentage(total_profit, holding_data['total_bought'], 0, f"total_profit_percent_{symbol}")
                
                detailed_holdings.append({
                    'symbol': symbol,
                    'quantity': holding_data['quantity'],
                    'avg_cost': cost_basis / holding_data['quantity'] if holding_data['quantity'] > 0 else 0,
                    'current_price': current_price,
                    'cost_basis': cost_basis,
                    'current_value': current_value,
                    'unrealized_gain': unrealized_gain,
                    'unrealized_gain_percent': unrealized_gain_percent,
                    'realized_pnl': holding_data['realized_pnl'],
                    'dividends_received': holding_data['dividends_received'],
                    'total_profit': total_profit,
                    'total_profit_percent': total_profit_percent,
                    'total_bought': holding_data['total_bought'],
                    'total_sold': holding_data['total_sold']
                })
            
            # Sort by current value
            detailed_holdings.sort(key=lambda x: x['current_value'], reverse=True)
            
            return detailed_holdings
            
        except Exception as e:
            logger.error(f"[PortfolioCalculator] Error calculating detailed holdings: {e}")
            raise
    
    @staticmethod
    def _process_transactions(transactions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        DEPRECATED: This method is inaccurate and should not be used.
        Use _process_transactions_with_realized_gains instead.
        
        Process transactions to calculate current holdings.
        
        Args:
            transactions: List of transaction records
            
        Returns:
            Dict mapping symbol to holding data
        """
        def create_holding() -> Dict[str, Any]:
            return {
                'symbol': '',
                'quantity': Decimal('0'),
                'total_cost': Decimal('0'),
                'dividends_received': Decimal('0')
            }
        
        holdings: DefaultDict[str, Dict[str, Any]] = defaultdict(create_holding)
        
        for txn in transactions:
            symbol = txn['symbol']
            holdings[symbol]['symbol'] = symbol
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                quantity = Decimal(str(txn['quantity']))
                price = Decimal(str(txn['price']))
                holdings[symbol]['quantity'] += quantity
                holdings[symbol]['total_cost'] += quantity * price
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                # Adjust quantity
                quantity = Decimal(str(txn['quantity']))
                holdings[symbol]['quantity'] -= quantity
                # Adjust cost basis proportionally
                if holdings[symbol]['quantity'] > 0 and holdings[symbol]['total_cost'] > 0:
                    denominator = holdings[symbol]['quantity'] + quantity
                    if denominator > 0:
                        cost_per_share = holdings[symbol]['total_cost'] / denominator
                    else:
                        cost_per_share = Decimal('0')
                    holdings[symbol]['total_cost'] -= cost_per_share * quantity
                else:
                    holdings[symbol]['total_cost'] = Decimal('0')
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                dividend_amount = Decimal(str(txn.get('total_value', txn['price'] * txn['quantity'])))
                holdings[symbol]['dividends_received'] += dividend_amount
        
        return dict(holdings)
    
    @staticmethod
    def _process_transactions_with_realized_gains(transactions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """
        Process transactions with FIFO realized gain tracking.
        
        Args:
            transactions: List of transaction records
            
        Returns:
            Dict mapping symbol to detailed holding data
        """
        def create_detailed_holding() -> Dict[str, Any]:
            return {
                'symbol': '',
                'quantity': Decimal('0'),
                'total_cost': Decimal('0'),
                'dividends_received': Decimal('0'),
                'realized_pnl': Decimal('0'),
                'total_bought': Decimal('0'),
                'total_sold': Decimal('0'),
                'lots': []  # FIFO tracking
            }
        
        holdings: DefaultDict[str, Dict[str, Any]] = defaultdict(create_detailed_holding)
        
        # Sort transactions by date for FIFO
        sorted_txns = sorted(transactions, key=lambda x: x['date'])
        
        for txn in sorted_txns:
            symbol = txn['symbol']
            holdings[symbol]['symbol'] = symbol
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                quantity = Decimal(str(txn['quantity']))
                price = Decimal(str(txn['price']))
                holdings[symbol]['quantity'] += quantity
                holdings[symbol]['total_cost'] += quantity * price
                holdings[symbol]['total_bought'] += quantity * price
                # Add lot for FIFO tracking
                if not isinstance(holdings[symbol]['lots'], list):
                    holdings[symbol]['lots'] = []
                holdings[symbol]['lots'].append({
                    'quantity': quantity,
                    'price': price,
                    'date': txn['date']
                })
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                quantity = Decimal(str(txn['quantity']))
                price = Decimal(str(txn['price']))
                holdings[symbol]['quantity'] -= quantity
                holdings[symbol]['total_sold'] += quantity * price
                
                # Calculate realized P&L using FIFO
                remaining_to_sell = quantity
                sell_price = price
                
                if not isinstance(holdings[symbol]['lots'], list):
                    holdings[symbol]['lots'] = []
                
                while remaining_to_sell > 0 and holdings[symbol]['lots']:
                    lot = holdings[symbol]['lots'][0]
                    
                    if lot['quantity'] <= remaining_to_sell:
                        # Sell entire lot
                        realized_pnl = (sell_price - lot['price']) * lot['quantity']
                        holdings[symbol]['realized_pnl'] += realized_pnl
                        holdings[symbol]['total_cost'] -= lot['price'] * lot['quantity']
                        remaining_to_sell -= lot['quantity']
                        holdings[symbol]['lots'].pop(0)
                    else:
                        # Sell partial lot
                        realized_pnl = (sell_price - lot['price']) * remaining_to_sell
                        holdings[symbol]['realized_pnl'] += realized_pnl
                        holdings[symbol]['total_cost'] -= lot['price'] * remaining_to_sell
                        lot['quantity'] -= remaining_to_sell
                        remaining_to_sell = Decimal('0')
                
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                dividend_amount = Decimal(str(txn.get('total_value', txn['price'] * txn['quantity'])))
                holdings[symbol]['dividends_received'] += dividend_amount
        
        return dict(holdings)
    
    @staticmethod
    async def calculate_daily_change(
        holdings: List[Dict[str, Any]],
        user_token: str,
        user_id: Optional[str] = None
    ) -> Tuple[Decimal, Decimal]:
        """
        Calculate portfolio's daily change based on previous day's closing prices.

        Args:
            holdings: List of current portfolio holdings.
            user_token: JWT token for database access.

        Returns:
            Tuple containing daily change in value and percentage.
        """
        if not holdings:
            return 0.0, 0.0

        symbols = [h['symbol'] for h in holdings]
        # Get current prices which include previous_close field
        current_prices = await price_manager.get_latest_prices(symbols, user_token)

        total_previous_value = Decimal('0')
        total_current_value = Decimal('0')

        for holding in holdings:
            symbol = holding['symbol']
            quantity = Decimal(str(holding['quantity']))
            current_value = Decimal(str(holding['current_value']))
            
            total_current_value += current_value

            price_data = current_prices.get(symbol)
            if price_data and price_data.get('previous_close') is not None:
                previous_close = Decimal(str(price_data['previous_close']))
                if previous_close > 0:
                    total_previous_value += quantity * previous_close
                else:
                    # Fallback: if no valid previous price, use current value
                    total_previous_value += current_value
            else:
                # Fallback: if no previous price, use current value for previous value
                # to avoid skewing the daily change calculation.
                total_previous_value += current_value

        if total_previous_value == 0:
            return 0.0, 0.0

        daily_change_value = total_current_value - total_previous_value
        daily_change_percent = (daily_change_value / total_previous_value) * 100

        return PortfolioCalculator._safe_decimal_conversion(daily_change_value, user_id), PortfolioCalculator._safe_decimal_conversion(daily_change_percent, user_id)

    # ========================================================================
    # Time Series Calculations (Migrated from portfolio_service.py)
    # ========================================================================
    
    @staticmethod
    async def calculate_portfolio_time_series(
        user_id: str,
        user_token: str,
        range_key: str = "1M",
        benchmark: Optional[str] = None,
        transactions: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[List[Tuple[date, Decimal]], Dict[str, Any]]:
        """
        Calculate portfolio value time series for the specified period.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            range_key: Time range (7D, 1M, 3M, 6M, 1Y, YTD, MAX)
            benchmark: Optional benchmark symbol for comparison
            transactions: Optional pre-fetched transactions to avoid duplicate DB calls
            
        Returns:
            Tuple of (time_series_data, metadata)
        """
        try:
            # Use provided transactions or fetch them
            if transactions is None:
                transactions = await supa_api_get_user_transactions(
                    user_id=user_id,
                    limit=10000,
                    user_token=user_token
                )
            
            if not transactions:
                logger.info(f"[PortfolioCalculator] No transactions found for time series")
                return [], {"no_data": True, "reason": "no_transactions"}
            
            # Determine date range - pass transactions for MAX period calculation
            start_date, end_date = PortfolioCalculator._compute_date_range(range_key, transactions)
            
            # Filter transactions by date
            relevant_txns = [t for t in transactions if datetime.strptime(t['date'], '%Y-%m-%d').date() <= end_date]
            
            if not relevant_txns:
                return [], {"no_data": True, "reason": "no_transactions_in_range"}
            
            # Get unique symbols from transactions
            symbols = list(set(t['symbol'] for t in relevant_txns))
            
            # Get historical prices for the period
            price_response = await price_manager.get_portfolio_prices_for_charts(
                symbols=symbols,
                start_date=start_date,
                end_date=end_date,
                user_token=user_token
            )
            
            if not price_response.get('success') or not price_response.get('data'):
                logger.warning(f"[PortfolioCalculator] Failed to get price data: {price_response.get('error')}")
                return [], {"no_data": True, "reason": "price_data_unavailable"}
            
            # Build price lookup: {symbol: {date: price}}
            price_lookup = defaultdict(dict)
            price_data = price_response['data']
            
            # price_data is a dict of {symbol: [price_records]}
            for symbol, price_records in price_data.items():
                for price_record in price_records:
                    price_date = datetime.strptime(price_record['date'], '%Y-%m-%d').date()
                    price_lookup[symbol][price_date] = Decimal(str(price_record['close']))
            
            # Calculate portfolio value for each day
            time_series = []
            trading_days = PortfolioCalculator._get_trading_days(start_date, end_date, range_key)
            
            for current_date in trading_days:
                holdings = PortfolioCalculator._calculate_holdings_for_date(
                    transactions=relevant_txns,
                    target_date=current_date
                )
                
                # Calculate portfolio value for this date
                portfolio_value = Decimal('0')
                
                for symbol, quantity in holdings.items():
                    if quantity > 0:
                        # Get price for this date (with fallback)
                        price = PortfolioCalculator._get_price_for_date(
                            symbol, current_date, price_lookup[symbol]
                        )
                        if price:
                            portfolio_value += quantity * price
                
                if portfolio_value > 0:
                    time_series.append((current_date, portfolio_value))
            
            # Remove leading zeros
            while time_series and time_series[0][1] == 0:
                time_series.pop(0)
            
            metadata = {
                "no_data": len(time_series) == 0,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "data_points": len(time_series)
            }
            
            return time_series, metadata
            
        except Exception as e:
            logger.error(f"[PortfolioCalculator] Error calculating time series: {e}")
            raise
    
    @staticmethod
    def _calculate_holdings_for_date(
        transactions: List[Dict[str, Any]],
        target_date: date
    ) -> Dict[str, Decimal]:
        """
        Calculate holdings as of a specific date.
        
        Args:
            transactions: List of all transactions
            target_date: Date to calculate holdings for
            
        Returns:
            Dict mapping symbol to quantity held
        """
        holdings: DefaultDict[str, Decimal] = defaultdict(lambda: Decimal('0'))
        
        for txn in transactions:
            txn_date = datetime.strptime(txn['date'], '%Y-%m-%d').date()
            if txn_date > target_date:
                continue
            
            symbol = txn['symbol']
            quantity = Decimal(str(txn['quantity']))
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                holdings[symbol] += quantity
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                holdings[symbol] -= quantity
        
        # Remove symbols with zero or negative holdings
        return {s: q for s, q in holdings.items() if q > 0}
    
    @staticmethod
    def _get_price_for_date(
        symbol: str,
        target_date: date,
        price_history: Dict[date, Decimal]
    ) -> Optional[Decimal]:
        """
        Get price for a specific date with fallback to most recent available.
        
        Args:
            symbol: Stock symbol
            target_date: Date to get price for
            price_history: Dict of date to price
            
        Returns:
            Price or None if not found
        """
        # Direct lookup
        if target_date in price_history:
            return price_history[target_date]
        
        # Fallback to most recent price before target date
        sorted_dates = sorted([d for d in price_history.keys() if d <= target_date], reverse=True)
        
        if sorted_dates:
            return price_history[sorted_dates[0]]
        
        return None
    
    @staticmethod
    def _compute_date_range(range_key: str, transactions: Optional[List[Dict[str, Any]]] = None) -> Tuple[date, date]:
        """
        Compute start and end dates based on range key.
        
        Args:
            range_key: Time range identifier (7D, 1M, etc.)
            transactions: Optional list of transactions (needed for MAX range)
            
        Returns:
            Tuple of (start_date, end_date)
        """
        today = date.today()
        
        if range_key == "7D":
            start_date = today - timedelta(days=7)
        elif range_key == "1M":
            start_date = today - timedelta(days=30)
        elif range_key == "3M":
            start_date = today - timedelta(days=90)
        elif range_key == "6M":
            start_date = today - timedelta(days=180)
        elif range_key == "1Y":
            start_date = today - timedelta(days=365)
        elif range_key == "YTD":
            start_date = date(today.year, 1, 1)
        elif range_key == "MAX":
            # For MAX range, use the earliest transaction date
            if transactions:
                # Find the earliest transaction date
                earliest_date = min(
                    datetime.strptime(t['date'], '%Y-%m-%d').date() 
                    for t in transactions
                )
                # Add a small buffer to ensure we capture the first transaction
                start_date = earliest_date - timedelta(days=1)
                logger.info(f"[PortfolioCalculator] MAX range using first transaction date: {earliest_date}")
            else:
                # Fallback to a reasonable default if no transactions
                start_date = date(2020, 1, 1)
                logger.info(f"[PortfolioCalculator] MAX range using default date (no transactions): {start_date}")
        else:
            # Default to 1 month
            start_date = today - timedelta(days=30)
        
        return start_date, today
    
    @staticmethod
    def _get_trading_days(
        start_date: date,
        end_date: date,
        range_key: str
    ) -> List[date]:
        """
        Get list of trading days for the period.
        
        Args:
            start_date: Start of period
            end_date: End of period
            range_key: Time range for determining granularity
            
        Returns:
            List of dates to calculate values for
        """
        # For now, return all days (could filter for weekdays/market days later)
        days = []
        current = start_date
        
        while current <= end_date:
            # Skip weekends for better performance
            if current.weekday() < 5:  # Monday = 0, Friday = 4
                days.append(current)
            current += timedelta(days=1)
        
        return days
    
    # ========================================================================
    # Performance Metrics
    # ========================================================================
    
    @staticmethod
    async def calculate_performance_metrics(
        user_id: str,
        user_token: str,
        transactions: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive performance metrics including XIRR.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            transactions: Optional pre-fetched transactions to avoid duplicate DB calls
            
        Returns:
            Dict with performance metrics including XIRR
        """
        try:
            # Use provided transactions or fetch them
            if transactions is None:
                transactions = await supa_api_get_user_transactions(
                    user_id=user_id,
                    limit=10000,
                    user_token=user_token
                )
            
            if not transactions:
                return {
                    "portfolio_xirr": None,
                    "portfolio_xirr_percent": None,
                    "symbol_xirrs": {},
                    "total_value": 0.0,
                    "total_invested": 0.0,
                    "total_gain_loss": 0.0,
                    "total_gain_loss_percent": 0.0
                }
            
            # Get current holdings
            holdings_data = await PortfolioCalculator.calculate_holdings(user_id, user_token)
            
            # Prepare cash flows for portfolio XIRR
            cash_flows = []
            dates = []
            
            # Process historical transactions
            for txn in transactions:
                txn_date = datetime.strptime(txn['date'], '%Y-%m-%d').date()
                
                if txn['transaction_type'] in ['Buy', 'BUY']:
                    # Money out (negative)
                    cash_flow = -(Decimal(str(txn['quantity'])) * Decimal(str(txn['price'])) + Decimal(str(txn.get('commission', 0))))
                elif txn['transaction_type'] in ['Sell', 'SELL']:
                    # Money in (positive)
                    cash_flow = Decimal(str(txn['quantity'])) * Decimal(str(txn['price'])) - Decimal(str(txn.get('commission', 0)))
                elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                    # Money in (positive)
                    cash_flow = Decimal(str(txn.get('total_value', Decimal(str(txn['price'])) * Decimal(str(txn['quantity'])))))
                else:
                    continue
                
                try:
                    cash_flows.append(float(cash_flow))
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid cash flow conversion: {cash_flow}, error: {e}")
                    continue
                dates.append(txn_date)
            
            # Add current portfolio value as final cash flow
            if holdings_data['total_value'] > 0:
                try:
                    # Convert to Decimal first for precision, then to float for XIRR calculation
                    total_value_decimal = Decimal(str(holdings_data['total_value']))
                    cash_flows.append(float(total_value_decimal))
                except (ValueError, TypeError, InvalidOperation) as e:
                    logger.warning(f"Invalid total_value conversion: {holdings_data['total_value']}, error: {e}")
                dates.append(date.today())
            
            # Calculate portfolio XIRR
            portfolio_xirr = None
            if cash_flows and len(cash_flows) > 1:
                portfolio_xirr = XIRRCalculator.calculate_xirr(cash_flows, dates)
            
            # Calculate XIRR for each symbol
            symbol_xirrs = {}
            for holding in holdings_data['holdings']:
                symbol = holding['symbol']
                if holding['quantity'] > 0:
                    symbol_xirr = await PortfolioCalculator._calculate_symbol_xirr(
                        transactions, symbol, holding['current_price'], holding['quantity']
                    )
                    if symbol_xirr is not None:
                        symbol_xirrs[symbol] = {
                            "xirr": symbol_xirr,
                            "xirr_percent": symbol_xirr * 100,
                            "current_value": holding['current_value'],
                            "total_invested": holding['total_cost']
                        }
            
            # Calculate total invested
            total_invested = sum(
                Decimal(str(txn['quantity'])) * Decimal(str(txn['price'])) + Decimal(str(txn.get('commission', 0)))
                for txn in transactions
                if txn['transaction_type'] in ['Buy', 'BUY']
            )
            
            return {
                "portfolio_xirr": portfolio_xirr,
                "portfolio_xirr_percent": portfolio_xirr * 100 if portfolio_xirr else None,
                "symbol_xirrs": symbol_xirrs,
                "total_value": holdings_data['total_value'],
                "total_invested": total_invested,
                "total_gain_loss": holdings_data['total_gain_loss'],
                "total_gain_loss_percent": holdings_data['total_gain_loss_percent'],
                "total_dividends": holdings_data['total_dividends']
            }
            
        except Exception as e:
            logger.error(f"[PortfolioCalculator] Error calculating performance metrics: {e}")
            raise
    
    @staticmethod
    async def _calculate_symbol_xirr(
        transactions: List[Dict[str, Any]],
        symbol: str,
        current_price: float,
        current_quantity: float
    ) -> Optional[float]:
        """
        Calculate XIRR for a single symbol.
        
        Args:
            transactions: All transactions
            symbol: Stock symbol
            current_price: Current market price
            current_quantity: Current quantity held
            
        Returns:
            XIRR or None if calculation fails
        """
        # Filter transactions for this symbol
        symbol_txns = [t for t in transactions if t['symbol'] == symbol]
        
        if not symbol_txns:
            return None
        
        cash_flows = []
        dates = []
        
        for txn in symbol_txns:
            txn_date = datetime.strptime(txn['date'], '%Y-%m-%d').date()
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                cash_flow = -(Decimal(str(txn['quantity'])) * Decimal(str(txn['price'])) + Decimal(str(txn.get('commission', 0))))
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                cash_flow = Decimal(str(txn['quantity'])) * Decimal(str(txn['price'])) - Decimal(str(txn.get('commission', 0)))
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                cash_flow = Decimal(str(txn.get('total_value', Decimal(str(txn['price'])) * Decimal(str(txn['quantity'])))))
            else:
                continue
            
            try:
                cash_flows.append(float(cash_flow))
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid cash flow conversion: {cash_flow}, error: {e}")
                continue
            dates.append(txn_date)
        
        # Add current value if still holding
        if current_quantity > 0:
            try:
                # Convert to Decimal first for precision, then to float for XIRR calculation
                current_value_decimal = Decimal(str(current_price)) * Decimal(str(current_quantity))
                cash_flows.append(float(current_value_decimal))
            except (ValueError, TypeError, InvalidOperation) as e:
                logger.warning(f"Invalid current value conversion: {current_price * current_quantity}, error: {e}")
            dates.append(date.today())
        
        if len(cash_flows) > 1:
            return XIRRCalculator.calculate_xirr(cash_flows, dates)
        
        return None
    
    @staticmethod
    async def calculate_index_time_series(
        user_id: str,
        user_token: str,
        range_key: str = "1M",
        benchmark: str = "SPY"
    ) -> Tuple[List[Tuple[date, Decimal]], Dict[str, Any]]:
        """
        Calculate index-only time series for benchmark comparison.
        Used as fallback when no portfolio data exists.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            range_key: Time range (7D, 1M, 3M, 6M, 1Y, YTD, MAX)
            benchmark: Benchmark symbol (default: SPY)
            
        Returns:
            Tuple of (time_series_data, metadata)
        """
        try:
            # Use authenticated client for RLS compliance
            client = create_authenticated_client(user_token)
            
            # Convert range key to number of trading days
            num_trading_days = PortfolioCalculator._get_trading_days_limit(range_key)
            
            # Get trading dates for the benchmark (DB-first)
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
            
            # If DB has no data, fetch from Alpha Vantage, upsert, and retry
            if not trading_dates:
                try:
                    av_resp = await vantage_api_get_daily_adjusted(benchmark)
                    if av_resp and av_resp.get('status') == 'success':
                        ts = av_resp.get('data', {})
                        records: List[Dict[str, Any]] = []
                        for d_str, vals in ts.items():
                            records.append({
                                'symbol': benchmark,
                                'date': d_str,
                                # Use close price (not adjusted) per product decision
                                'open': str(vals.get('1. open', '0')),
                                'high': str(vals.get('2. high', '0')),
                                'low': str(vals.get('3. low', '0')),
                                'close': str(vals.get('4. close', '0')),
                                'adjusted_close': str(vals.get('5. adjusted close', vals.get('4. close', '0'))),
                                'volume': int(vals.get('6. volume', 0)),
                                'dividend_amount': str(vals.get('7. dividend amount', '0')),
                                'split_coefficient': str(vals.get('8. split coefficient', '1')),
                            })
                        if records:
                            await supa_api_store_historical_prices_batch(records)
                            # Retry fetching dates after upsert
                            if range_key == 'YTD':
                                dates_response = client.table('historical_prices') \
                                    .select('date') \
                                    .eq('symbol', benchmark) \
                                    .gte('date', ytd_start.isoformat()) \
                                    .order('date', desc=True) \
                                    .execute()
                            else:
                                dates_response = client.table('historical_prices') \
                                    .select('date') \
                                    .eq('symbol', benchmark) \
                                    .order('date', desc=True) \
                                    .limit(num_trading_days) \
                                    .execute()
                            trading_dates = sorted([
                                datetime.strptime(record['date'], '%Y-%m-%d').date() 
                                for record in dates_response.data
                            ])
                except Exception:
                    logger.exception("[PortfolioCalculator] Failed to fetch/upsert benchmark history from Alpha Vantage")
            
            if not trading_dates:
                return [], {
                    "no_data": True,
                    "index_only": True,
                    "reason": "no_benchmark_data",
                    "user_guidance": f"Historical data for {benchmark} is not available"
                }
            
            # Calculate date range
            start_date = trading_dates[0]
            end_date = trading_dates[-1]
            
            # Get prices for the date range (use close price)
            prices_response = client.table('historical_prices') \
                .select('date, close') \
                .eq('symbol', benchmark) \
                .gte('date', start_date.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .order('date') \
                .execute()
            
            # Build index series
            index_series = []
            for record in prices_response.data:
                price_date = datetime.strptime(record['date'], '%Y-%m-%d').date()
                price_value = Decimal(str(record['close']))
                index_series.append((price_date, price_value))
            
            metadata = {
                "no_data": len(index_series) == 0,
                "index_only": True,
                "start_date": start_date.isoformat() if index_series else None,
                "end_date": end_date.isoformat() if index_series else None,
                "data_points": len(index_series),
                "benchmark": benchmark
            }
            
            return index_series, metadata
            
        except Exception as e:
            logger.error(f"[PortfolioCalculator] Error calculating index series: {e}")
            raise
    
    @staticmethod
    def _get_trading_days_limit(range_key: str) -> int:
        """
        Get number of trading days for a range key.
        
        Args:
            range_key: Time range identifier
            
        Returns:
            Number of trading days to fetch
        """
        trading_days_map = {
            '7D': 7,
            '1M': 30,
            '3M': 90,
            '6M': 180,
            '1Y': 365,
            'YTD': 365,  # Will be handled specially
            'MAX': 1825  # 5 years
        }
        
        return trading_days_map.get(range_key, 30)
    
    @staticmethod
    def format_series_for_response(
        portfolio_series: List[Tuple[date, Decimal]], 
        index_series: List[Tuple[date, Decimal]],
        user_id: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Format time series data for API response.
        
        Args:
            portfolio_series: Portfolio value time series
            index_series: Index value time series
            
        Returns:
            Tuple of (formatted_portfolio, formatted_index)
        """
        # Format portfolio series
        formatted_portfolio = [
            {"date": d.isoformat(), "value": PortfolioCalculator._safe_decimal_conversion(v, user_id)}
            for d, v in portfolio_series
        ]
        
        # Format index series
        formatted_index = [
            {"date": d.isoformat(), "value": PortfolioCalculator._safe_decimal_conversion(v, user_id)}
            for d, v in index_series
        ]
        
        return formatted_portfolio, formatted_index


# Create singleton instance
portfolio_calculator = PortfolioCalculator()