"""
Portfolio Calculator - THE ONLY portfolio performance calculator
This service calculates all portfolio metrics including holdings, gains/losses, and allocations.
Uses PriceDataService for all price data - NO direct price fetching.
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import date, datetime
from decimal import Decimal
from collections import defaultdict

from services.price_data_service import price_data_service
from supa_api.supa_api_transactions import supa_api_get_user_transactions
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)


class PortfolioCalculator:
    """
    Service for calculating portfolio metrics and performance.
    This is the ONLY service that should be used for portfolio calculations.
    """
    
    @staticmethod
    async def calculate_holdings(user_id: str, user_token: str) -> Dict[str, Any]:
        """
        Calculate current holdings from user transactions.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            
        Returns:
            Dict with holdings and portfolio summary
        """
        try:
            # Get all user transactions
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
            
            # Process transactions to calculate holdings
            holdings_map = PortfolioCalculator._process_transactions(transactions)
            
            # Get current prices for all holdings
            symbols = [h['symbol'] for h in holdings_map.values() if h['quantity'] > 0]
            current_prices = await price_data_service.get_prices_for_symbols(symbols, user_token)
            
            # Calculate current values and gains
            holdings = []
            total_value = 0.0
            total_cost = 0.0
            total_dividends = 0.0
            
            for symbol, holding_data in holdings_map.items():
                if holding_data['quantity'] <= 0:
                    continue
                
                price_data = current_prices.get(symbol)
                if not price_data:
                    logger.warning(f"[PortfolioCalculator] No price found for {symbol}, skipping")
                    continue
                
                current_price = price_data['price']
                current_value = holding_data['quantity'] * current_price
                cost_basis = holding_data['total_cost']
                gain_loss = current_value - cost_basis
                gain_loss_percent = (gain_loss / cost_basis * 100) if cost_basis > 0 else 0
                
                holdings.append({
                    'symbol': symbol,
                    'quantity': holding_data['quantity'],
                    'avg_cost': cost_basis / holding_data['quantity'] if holding_data['quantity'] > 0 else 0,
                    'total_cost': cost_basis,
                    'current_price': current_price,
                    'current_value': current_value,
                    'gain_loss': gain_loss,
                    'gain_loss_percent': gain_loss_percent,
                    'dividends_received': holding_data['dividends_received'],
                    'price_date': price_data['date']
                })
                
                total_value += current_value
                total_cost += cost_basis
                total_dividends += holding_data['dividends_received']
            
            # Sort holdings by value (largest first)
            holdings.sort(key=lambda x: x['current_value'], reverse=True)
            
            # Calculate portfolio totals
            total_gain_loss = total_value - total_cost
            total_gain_loss_percent = (total_gain_loss / total_cost * 100) if total_cost > 0 else 0
            
            return {
                "holdings": holdings,
                "total_value": total_value,
                "total_cost": total_cost,
                "total_gain_loss": total_gain_loss,
                "total_gain_loss_percent": total_gain_loss_percent,
                "total_dividends": total_dividends
            }
            
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
            # Get holdings first
            portfolio_data = await PortfolioCalculator.calculate_holdings(user_id, user_token)
            
            if not portfolio_data['holdings']:
                return {
                    "allocations": [],
                    "summary": {
                        "total_value": 0.0,
                        "total_cost": 0.0,
                        "total_gain_loss": 0.0,
                        "total_gain_loss_percent": 0.0,
                        "total_dividends": 0.0
                    }
                }
            
            # Define colors for visualization
            colors = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime']
            
            # Calculate allocations
            allocations = []
            total_value = portfolio_data['total_value']
            
            for idx, holding in enumerate(portfolio_data['holdings']):
                allocation_percent = (holding['current_value'] / total_value * 100) if total_value > 0 else 0
                
                allocations.append({
                    'symbol': holding['symbol'],
                    'company_name': holding['symbol'],  # We don't store company names in price data
                    'quantity': holding['quantity'],
                    'current_price': holding['current_price'],
                    'cost_basis': holding['total_cost'],
                    'current_value': holding['current_value'],
                    'gain_loss': holding['gain_loss'],
                    'gain_loss_percent': holding['gain_loss_percent'],
                    'dividends_received': holding['dividends_received'],
                    'allocation_percent': allocation_percent,
                    'color': colors[idx % len(colors)]
                })
            
            return {
                "allocations": allocations,
                "summary": {
                    "total_value": portfolio_data['total_value'],
                    "total_cost": portfolio_data['total_cost'],
                    "total_gain_loss": portfolio_data['total_gain_loss'],
                    "total_gain_loss_percent": portfolio_data['total_gain_loss_percent'],
                    "total_dividends": portfolio_data['total_dividends']
                }
            }
            
        except Exception as e:
            logger.error(f"[PortfolioCalculator] Error calculating allocations: {e}")
            raise
    
    @staticmethod
    async def calculate_detailed_holdings(user_id: str, user_token: str) -> List[Dict[str, Any]]:
        """
        Calculate detailed holdings with realized gains for analytics.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for database access
            
        Returns:
            List of detailed holding records
        """
        try:
            # Get all transactions
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
            current_prices = await price_data_service.get_prices_for_symbols(symbols, user_token)
            
            # Build detailed holdings list
            detailed_holdings = []
            
            for symbol, holding_data in holdings_map.items():
                if holding_data['quantity'] <= 0:
                    continue
                
                price_data = current_prices.get(symbol)
                if not price_data:
                    continue
                
                current_price = price_data['price']
                current_value = holding_data['quantity'] * current_price
                cost_basis = holding_data['total_cost']
                unrealized_gain = current_value - cost_basis
                unrealized_gain_percent = (unrealized_gain / cost_basis * 100) if cost_basis > 0 else 0
                
                total_profit = unrealized_gain + holding_data['realized_pnl'] + holding_data['dividends_received']
                total_profit_percent = (total_profit / holding_data['total_bought'] * 100) if holding_data['total_bought'] > 0 else 0
                
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
        Process transactions to calculate current holdings.
        
        Args:
            transactions: List of transaction records
            
        Returns:
            Dict mapping symbol to holding data
        """
        holdings = defaultdict(lambda: {
            'symbol': '',
            'quantity': 0.0,
            'total_cost': 0.0,
            'dividends_received': 0.0
        })
        
        for txn in transactions:
            symbol = txn['symbol']
            holdings[symbol]['symbol'] = symbol
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                holdings[symbol]['quantity'] += txn['quantity']
                holdings[symbol]['total_cost'] += txn['quantity'] * txn['price']
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                # Adjust quantity
                holdings[symbol]['quantity'] -= txn['quantity']
                # Adjust cost basis proportionally
                if holdings[symbol]['quantity'] > 0 and holdings[symbol]['total_cost'] > 0:
                    cost_per_share = holdings[symbol]['total_cost'] / (holdings[symbol]['quantity'] + txn['quantity'])
                    holdings[symbol]['total_cost'] -= cost_per_share * txn['quantity']
                else:
                    holdings[symbol]['total_cost'] = 0.0
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                holdings[symbol]['dividends_received'] += txn.get('total_value', txn['price'] * txn['quantity'])
        
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
        holdings = defaultdict(lambda: {
            'symbol': '',
            'quantity': 0.0,
            'total_cost': 0.0,
            'dividends_received': 0.0,
            'realized_pnl': 0.0,
            'total_bought': 0.0,
            'total_sold': 0.0,
            'lots': []  # FIFO tracking
        })
        
        # Sort transactions by date for FIFO
        sorted_txns = sorted(transactions, key=lambda x: x['date'])
        
        for txn in sorted_txns:
            symbol = txn['symbol']
            holdings[symbol]['symbol'] = symbol
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                holdings[symbol]['quantity'] += txn['quantity']
                holdings[symbol]['total_cost'] += txn['quantity'] * txn['price']
                holdings[symbol]['total_bought'] += txn['quantity'] * txn['price']
                # Add lot for FIFO tracking
                holdings[symbol]['lots'].append({
                    'quantity': txn['quantity'],
                    'price': txn['price'],
                    'date': txn['date']
                })
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                holdings[symbol]['quantity'] -= txn['quantity']
                holdings[symbol]['total_sold'] += txn['quantity'] * txn['price']
                
                # Calculate realized P&L using FIFO
                remaining_to_sell = txn['quantity']
                sell_price = txn['price']
                
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
                        remaining_to_sell = 0
                
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                holdings[symbol]['dividends_received'] += txn.get('total_value', txn['price'] * txn['quantity'])
        
        return dict(holdings)


# Create singleton instance
portfolio_calculator = PortfolioCalculator()