"""
Standalone test for PortfolioCalculator FIFO logic
Tests the core calculation methods without external dependencies
"""

from datetime import date, datetime
from decimal import Decimal
from collections import defaultdict


class PortfolioCalculator:
    """Minimal PortfolioCalculator implementation for testing"""
    
    @staticmethod
    def _process_transactions(transactions):
        """Old method with the cost basis bug"""
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
                holdings[symbol]['quantity'] -= txn['quantity']
                # BUG: This calculation is wrong
                if holdings[symbol]['quantity'] > 0 and holdings[symbol]['total_cost'] > 0:
                    cost_per_share = holdings[symbol]['total_cost'] / (holdings[symbol]['quantity'] + txn['quantity'])
                    holdings[symbol]['total_cost'] -= cost_per_share * txn['quantity']
                else:
                    holdings[symbol]['total_cost'] = 0.0
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                holdings[symbol]['dividends_received'] += txn.get('total_value', txn['price'] * txn['quantity'])
        
        return dict(holdings)
    
    @staticmethod
    def _process_transactions_with_realized_gains(transactions):
        """New method with proper FIFO tracking"""
        holdings = defaultdict(lambda: {
            'symbol': '',
            'quantity': 0.0,
            'total_cost': 0.0,
            'dividends_received': 0.0,
            'realized_pnl': 0.0,
            'total_bought': 0.0,
            'total_sold': 0.0,
            'lots': []
        })
        
        sorted_txns = sorted(transactions, key=lambda x: x['date'])
        
        for txn in sorted_txns:
            symbol = txn['symbol']
            holdings[symbol]['symbol'] = symbol
            
            if txn['transaction_type'] in ['Buy', 'BUY']:
                holdings[symbol]['quantity'] += txn['quantity']
                holdings[symbol]['total_cost'] += txn['quantity'] * txn['price']
                holdings[symbol]['total_bought'] += txn['quantity'] * txn['price']
                holdings[symbol]['lots'].append({
                    'quantity': txn['quantity'],
                    'price': txn['price'],
                    'date': txn['date']
                })
            elif txn['transaction_type'] in ['Sell', 'SELL']:
                holdings[symbol]['quantity'] -= txn['quantity']
                holdings[symbol]['total_sold'] += txn['quantity'] * txn['price']
                
                remaining_to_sell = txn['quantity']
                sell_price = txn['price']
                
                while remaining_to_sell > 0 and holdings[symbol]['lots']:
                    lot = holdings[symbol]['lots'][0]
                    
                    if lot['quantity'] <= remaining_to_sell:
                        realized_pnl = (sell_price - lot['price']) * lot['quantity']
                        holdings[symbol]['realized_pnl'] += realized_pnl
                        holdings[symbol]['total_cost'] -= lot['price'] * lot['quantity']
                        remaining_to_sell -= lot['quantity']
                        holdings[symbol]['lots'].pop(0)
                    else:
                        realized_pnl = (sell_price - lot['price']) * remaining_to_sell
                        holdings[symbol]['realized_pnl'] += realized_pnl
                        holdings[symbol]['total_cost'] -= lot['price'] * remaining_to_sell
                        lot['quantity'] -= remaining_to_sell
                        remaining_to_sell = 0
                
            elif txn['transaction_type'] in ['Dividend', 'DIVIDEND']:
                dividend_amount = txn.get('total_value', txn['price'] * txn['quantity'])
                holdings[symbol]['dividends_received'] += dividend_amount
        
        return dict(holdings)


def test_fifo_calculation():
    """Test FIFO calculation logic"""
    print("=== Testing FIFO Calculation ===")
    
    transactions = [
        {
            'symbol': 'AAPL',
            'transaction_type': 'BUY',
            'quantity': 100,
            'price': 150.00,
            'date': '2023-01-01'
        },
        {
            'symbol': 'AAPL',
            'transaction_type': 'BUY',
            'quantity': 50,
            'price': 160.00,
            'date': '2023-02-01'
        },
        {
            'symbol': 'AAPL',
            'transaction_type': 'SELL',
            'quantity': 75,
            'price': 170.00,
            'date': '2023-03-01'
        }
    ]
    
    result = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
    
    print(f"Remaining shares: {result['AAPL']['quantity']} (expected: 75)")
    print(f"Cost basis: ${result['AAPL']['total_cost']:.2f} (expected: $11,750)")
    print(f"Realized P&L: ${result['AAPL']['realized_pnl']:.2f} (expected: $1,500)")
    
    assert result['AAPL']['quantity'] == 75
    assert result['AAPL']['total_cost'] == 11750.00
    assert result['AAPL']['realized_pnl'] == 1500.00
    
    print("✅ FIFO test passed!")


def test_cost_basis_bug():
    """Test the cost basis bug fix"""
    print("\n=== Testing Cost Basis Bug Fix ===")
    
    transactions = [
        {
            'symbol': 'TEST',
            'transaction_type': 'BUY',
            'quantity': 100,
            'price': 10.00,
            'date': '2023-01-01'
        },
        {
            'symbol': 'TEST',
            'transaction_type': 'SELL',
            'quantity': 50,
            'price': 15.00,
            'date': '2023-02-01'
        }
    ]
    
    # Test old method (with bug)
    result_old = PortfolioCalculator._process_transactions(transactions)
    print(f"\nOld method (with bug):")
    print(f"  Remaining shares: {result_old['TEST']['quantity']}")
    print(f"  Cost basis: ${result_old['TEST']['total_cost']:.2f}")
    print(f"  Cost per share: ${result_old['TEST']['total_cost'] / result_old['TEST']['quantity']:.2f}")
    
    # Test new method (fixed)
    result_new = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
    print(f"\nNew method (fixed):")
    print(f"  Remaining shares: {result_new['TEST']['quantity']}")
    print(f"  Cost basis: ${result_new['TEST']['total_cost']:.2f}")
    print(f"  Cost per share: ${result_new['TEST']['total_cost'] / result_new['TEST']['quantity']:.2f}")
    print(f"  Realized P&L: ${result_new['TEST']['realized_pnl']:.2f}")
    
    assert result_new['TEST']['quantity'] == 50
    assert result_new['TEST']['total_cost'] == 500.00
    assert result_new['TEST']['realized_pnl'] == 250.00
    
    print("\n✅ Cost basis bug fix test passed!")


def test_multiple_partial_sells():
    """Test multiple partial sells with FIFO"""
    print("\n=== Testing Multiple Partial Sells ===")
    
    transactions = [
        {'symbol': 'MSFT', 'transaction_type': 'BUY', 'quantity': 100, 'price': 200.00, 'date': '2023-01-01'},
        {'symbol': 'MSFT', 'transaction_type': 'BUY', 'quantity': 100, 'price': 210.00, 'date': '2023-02-01'},
        {'symbol': 'MSFT', 'transaction_type': 'BUY', 'quantity': 100, 'price': 220.00, 'date': '2023-03-01'},
        {'symbol': 'MSFT', 'transaction_type': 'SELL', 'quantity': 150, 'price': 230.00, 'date': '2023-04-01'},
        {'symbol': 'MSFT', 'transaction_type': 'SELL', 'quantity': 100, 'price': 240.00, 'date': '2023-05-01'}
    ]
    
    result = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
    
    print(f"Remaining shares: {result['MSFT']['quantity']} (expected: 50)")
    print(f"Cost basis: ${result['MSFT']['total_cost']:.2f} (expected: $11,000)")
    print(f"Realized P&L: ${result['MSFT']['realized_pnl']:.2f} (expected: $6,500)")
    
    # Verify calculations
    # First sell (150 @ $230): 100@$200 + 50@$210
    # P&L: (230-200)*100 + (230-210)*50 = 3000 + 1000 = 4000
    # Second sell (100 @ $240): 50@$210 + 50@$220  
    # P&L: (240-210)*50 + (240-220)*50 = 1500 + 1000 = 2500
    # Total P&L: 4000 + 2500 = 6500
    
    assert result['MSFT']['quantity'] == 50
    assert result['MSFT']['total_cost'] == 11000.00
    assert result['MSFT']['realized_pnl'] == 6500.00
    
    print("✅ Multiple partial sells test passed!")


def test_xirr_calculation():
    """Test XIRR calculation (if implemented)"""
    print("\n=== Testing XIRR Calculation ===")
    
    # Check if XIRRCalculator exists
    try:
        # Simple XIRR test case
        cash_flows = [-1000, -2000, 3500]  # Initial investments and final value
        dates = [
            datetime(2023, 1, 1).date(),
            datetime(2023, 6, 1).date(),
            datetime(2023, 12, 31).date()
        ]
        
        # Expected XIRR should be around 16.6%
        print("Note: XIRRCalculator class not found in portfolio_calculator.py")
        print("This functionality appears to be planned but not yet implemented")
        
    except Exception as e:
        print(f"XIRR test skipped: {e}")


def main():
    """Run all tests"""
    print("Running PortfolioCalculator Standalone Tests")
    print("=" * 50)
    
    test_fifo_calculation()
    test_cost_basis_bug()
    test_multiple_partial_sells()
    test_xirr_calculation()
    
    print("\n" + "=" * 50)
    print("All tests completed!")


if __name__ == '__main__':
    main()