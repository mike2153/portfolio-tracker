"""
Supabase portfolio calculations
Calculates holdings and performance from transactions
"""
from typing import Dict, Any, List, Optional, TypedDict
import logging
from collections import defaultdict

from .supa_api_client import get_supa_client
from .supa_api_transactions import supa_api_get_user_transactions
from vantage_api.vantage_api_quotes import vantage_api_get_quote
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

class Holding(TypedDict):
    quantity: float
    total_cost: float
    transactions: List[dict]

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="CALCULATE_PORTFOLIO")
async def supa_api_calculate_portfolio(user_id: str, user_token: Optional[str] = None) -> Dict[str, Any]:
    """Calculate portfolio holdings from transactions"""
    logger.info(f"[supa_api_portfolio.py::supa_api_calculate_portfolio] Calculating portfolio for user: {user_id}")
    
    try:
        # Get all transactions
        transactions = await supa_api_get_user_transactions(user_id, limit=1000, user_token=user_token)
        
        # Calculate holdings by symbol
        holdings_map: Dict[str, Holding] = defaultdict(  # type: ignore[arg-type]
            lambda: Holding(quantity=0.0, total_cost=0.0, transactions=[])
        )
        
        for transaction in transactions:
            symbol = transaction['symbol']
            quantity = float(transaction['quantity'])
            price = float(transaction['price'])
            commission = float(transaction.get('commission', 0))
            
            if transaction['transaction_type'] == 'Buy':
                holdings_map[symbol]['quantity'] += quantity
                holdings_map[symbol]['total_cost'] += (quantity * price) + commission
            else:  # Sell
                holdings_map[symbol]['quantity'] -= quantity
                holdings_map[symbol]['total_cost'] -= (quantity * price) - commission
            
            holdings_map[symbol]['transactions'].append(transaction)
        
        # Filter out positions with zero quantity
        active_holdings = {
            symbol: data 
            for symbol, data in holdings_map.items() 
            if data['quantity'] > 0.001  # Small threshold to handle floating point
        }
        
        # Get current prices and calculate values
        holdings_list = []
        total_value = 0.0
        total_cost = 0.0
        
        for symbol, data in active_holdings.items():
            quantity = data['quantity']
            cost = data['total_cost']
            avg_cost = cost / quantity if quantity > 0 else 0
            
            # Get current price
            try:
                quote = await vantage_api_get_quote(symbol)
                current_price = quote['price']
            except:
                logger.warning(f"[supa_api_portfolio.py::supa_api_calculate_portfolio] Failed to get quote for {symbol}, using avg cost")
                current_price = avg_cost
            
            current_value = quantity * current_price
            gain_loss = current_value - cost
            gain_loss_percent = (gain_loss / cost * 100) if cost > 0 else 0
            
            holdings_list.append({
                'symbol': symbol,
                'quantity': quantity,
                'avg_cost': avg_cost,
                'total_cost': cost,
                'current_price': current_price,
                'current_value': current_value,
                'gain_loss': gain_loss,
                'gain_loss_percent': gain_loss_percent,
                'allocation': 0  # Will calculate after we have total
            })
            
            total_value += current_value
            total_cost += cost
        
        # Calculate allocations
        for holding in holdings_list:
            holding['allocation'] = (holding['current_value'] / total_value * 100) if total_value > 0 else 0
        
        # Sort by value descending
        holdings_list.sort(key=lambda x: x['current_value'], reverse=True)
        
        # Calculate total gain/loss
        total_gain_loss = total_value - total_cost
        total_gain_loss_percent = (total_gain_loss / total_cost * 100) if total_cost > 0 else 0
        
        portfolio_data = {
            'holdings': holdings_list,
            'total_value': total_value,
            'total_cost': total_cost,
            'total_gain_loss': total_gain_loss,
            'total_gain_loss_percent': total_gain_loss_percent,
            'holdings_count': len(holdings_list)
        }
        
        logger.info(f"[supa_api_portfolio.py::supa_api_calculate_portfolio] Portfolio calculated: {len(holdings_list)} holdings, value: ${total_value:.2f}")
        
        return portfolio_data
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_portfolio.py",
            function_name="supa_api_calculate_portfolio",
            error=e,
            user_id=user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_PORTFOLIO_HISTORY")
async def supa_api_get_portfolio_history(user_id: str, days: int = 30, user_token: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get portfolio value history for charting"""
    logger.info(f"[supa_api_portfolio.py::supa_api_get_portfolio_history] Getting {days}-day history for user: {user_id}")
    
    try:
        # This is a simplified version - in production you'd want to:
        # 1. Store daily snapshots of portfolio values
        # 2. Use historical price data
        # For now, we'll return current value as a single point
        
        current_portfolio = await supa_api_calculate_portfolio(user_id, user_token=user_token)
        
        history = [{
            'date': 'today',
            'total_value': current_portfolio['total_value'],
            'total_cost': current_portfolio['total_cost'],
            'gain_loss': current_portfolio['total_gain_loss']
        }]
        
        logger.info(f"[supa_api_portfolio.py::supa_api_get_portfolio_history] Returning simplified history")
        
        return history
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_portfolio.py",
            function_name="supa_api_get_portfolio_history",
            error=e,
            user_id=user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_HOLDINGS_BY_SYMBOL")
async def supa_api_get_holdings_by_symbol(user_id: str, symbol: str, user_token: Optional[str] = None) -> Dict[str, Any]:
    """Get detailed holdings for a specific symbol"""
    logger.info(f"[supa_api_portfolio.py::supa_api_get_holdings_by_symbol] Getting holdings for {symbol}")
    
    try:
        # Get transactions for this symbol
        transactions = await supa_api_get_user_transactions(
            user_id=user_id,
            symbol=symbol,
            limit=1000,
            user_token=user_token
        )
        
        # Calculate position
        quantity = 0.0
        total_cost = 0.0
        buy_transactions = []
        sell_transactions = []
        
        for transaction in transactions:
            qty = float(transaction['quantity'])
            price = float(transaction['price'])
            commission = float(transaction.get('commission', 0))
            
            if transaction['transaction_type'] == 'Buy':
                quantity += qty
                total_cost += (qty * price) + commission
                buy_transactions.append(transaction)
            else:  # Sell
                quantity -= qty
                total_cost -= (qty * price) - commission
                sell_transactions.append(transaction)
        
        if quantity <= 0:
            return {
                'symbol': symbol,
                'quantity': 0,
                'position_closed': True,
                'transactions': transactions
            }
        
        # Get current price
        try:
            quote = await vantage_api_get_quote(symbol)
            current_price = quote['price']
        except:
            current_price = total_cost / quantity if quantity > 0 else 0
        
        avg_cost = total_cost / quantity if quantity > 0 else 0
        current_value = quantity * current_price
        gain_loss = current_value - total_cost
        gain_loss_percent = (gain_loss / total_cost * 100) if total_cost > 0 else 0
        
        return {
            'symbol': symbol,
            'quantity': quantity,
            'avg_cost': avg_cost,
            'total_cost': total_cost,
            'current_price': current_price,
            'current_value': current_value,
            'gain_loss': gain_loss,
            'gain_loss_percent': gain_loss_percent,
            'buy_transactions': buy_transactions,
            'sell_transactions': sell_transactions,
            'all_transactions': transactions
        }
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_portfolio.py",
            function_name="supa_api_get_holdings_by_symbol",
            error=e,
            user_id=user_id,
            symbol=symbol
        )
        raise 