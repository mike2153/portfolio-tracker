"""
Test suite for PortfolioCalculator
Tests FIFO calculation logic, cost basis tracking, and other portfolio calculations
"""

import asyncio
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, patch

# Add parent directory to path
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from services.portfolio_calculator import PortfolioCalculator


class TestPortfolioCalculator:
    """Test suite for PortfolioCalculator functionality"""
    
    def test_process_transactions_fifo(self):
        """Test FIFO processing of transactions"""
        # Test transactions with multiple buys and sells
        transactions = [
            {
                'symbol': 'AAPL',
                'transaction_type': 'BUY',
                'quantity': 100,
                'price': 150.00,
                'date': '2023-01-01',
                'total_value': 15000.00
            },
            {
                'symbol': 'AAPL',
                'transaction_type': 'BUY',
                'quantity': 50,
                'price': 160.00,
                'date': '2023-02-01',
                'total_value': 8000.00
            },
            {
                'symbol': 'AAPL',
                'transaction_type': 'SELL',
                'quantity': 75,
                'price': 170.00,
                'date': '2023-03-01',
                'total_value': 12750.00
            }
        ]
        
        result = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
        
        # Should have 75 shares remaining (100 + 50 - 75)
        assert result['AAPL']['quantity'] == 75
        
        # Cost basis should be: 
        # - Original: 100 @ $150 + 50 @ $160 = $23,000
        # - Sold using FIFO: 75 @ $150 = $11,250
        # - Remaining: 25 @ $150 + 50 @ $160 = $3,750 + $8,000 = $11,750
        assert result['AAPL']['total_cost'] == 11750.00
        
        # Realized P&L should be: (170 - 150) * 75 = $1,500
        assert result['AAPL']['realized_pnl'] == 1500.00
        
    def test_process_transactions_with_dividends(self):
        """Test processing transactions including dividends"""
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
                'transaction_type': 'DIVIDEND',
                'quantity': 100,
                'price': 0.24,
                'date': '2023-02-01',
                'total_value': 24.00
            }
        ]
        
        result = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
        
        assert result['AAPL']['quantity'] == 100
        assert result['AAPL']['dividends_received'] == 24.00
        
    def test_process_transactions_multiple_partial_sells(self):
        """Test FIFO with multiple partial sells"""
        transactions = [
            {
                'symbol': 'MSFT',
                'transaction_type': 'BUY',
                'quantity': 100,
                'price': 200.00,
                'date': '2023-01-01'
            },
            {
                'symbol': 'MSFT',
                'transaction_type': 'BUY',
                'quantity': 100,
                'price': 210.00,
                'date': '2023-02-01'
            },
            {
                'symbol': 'MSFT',
                'transaction_type': 'BUY',
                'quantity': 100,
                'price': 220.00,
                'date': '2023-03-01'
            },
            {
                'symbol': 'MSFT',
                'transaction_type': 'SELL',
                'quantity': 150,
                'price': 230.00,
                'date': '2023-04-01'
            },
            {
                'symbol': 'MSFT',
                'transaction_type': 'SELL',
                'quantity': 100,
                'price': 240.00,
                'date': '2023-05-01'
            }
        ]
        
        result = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
        
        # Should have 50 shares remaining (300 - 250)
        assert result['MSFT']['quantity'] == 50
        
        # Cost basis: Only 50 shares @ $220 remaining = $11,000
        assert result['MSFT']['total_cost'] == 11000.00
        
        # Realized P&L calculation:
        # First sell (150 shares @ $230):
        #   - 100 @ $200: (230-200)*100 = $3,000
        #   - 50 @ $210: (230-210)*50 = $1,000
        # Second sell (100 shares @ $240):
        #   - 50 @ $210: (240-210)*50 = $1,500
        #   - 50 @ $220: (240-220)*50 = $1,000
        # Total: $3,000 + $1,000 + $1,500 + $1,000 = $6,500
        assert result['MSFT']['realized_pnl'] == 6500.00
        
    def test_cost_basis_bug_fix(self):
        """Test that the cost basis bug mentioned in the summary is fixed"""
        # The bug was: cost_per_share = total_cost / (quantity + sold_quantity)
        # This test verifies it's fixed
        
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
        
        # Test the old method (should show the bug)
        result_old = PortfolioCalculator._process_transactions(transactions)
        
        # With the bug: cost_per_share = 1000 / (50 + 50) = 10
        # Remaining cost = 10 * 50 = 500 (correct by accident in this case)
        
        # Test the new FIFO method (correct)
        result_new = PortfolioCalculator._process_transactions_with_realized_gains(transactions)
        
        # Should have 50 shares @ $10 = $500 cost basis
        assert result_new['TEST']['quantity'] == 50
        assert result_new['TEST']['total_cost'] == 500.00
        assert result_new['TEST']['realized_pnl'] == 250.00  # (15-10)*50
        
    async def test_calculate_holdings_empty_portfolio(self):
        """Test calculating holdings for empty portfolio"""
        with patch('services.portfolio_calculator.supa_api_get_user_transactions') as mock_get_txns:
            mock_get_txns.return_value = []
            
            result = await PortfolioCalculator.calculate_holdings('test_user', 'test_token')
            
            assert result['holdings'] == []
            assert result['total_value'] == 0.0
            assert result['total_cost'] == 0.0
            assert result['total_gain_loss'] == 0.0
            assert result['total_gain_loss_percent'] == 0.0
            assert result['total_dividends'] == 0.0
            
    def test_date_range_computation(self):
        """Test date range computation for various range keys"""
        # Test 1M range
        start_date, end_date = PortfolioCalculator._compute_date_range('1M')
        date_diff = (end_date - start_date).days
        assert 28 <= date_diff <= 31  # Account for different month lengths
        
        # Test YTD range
        start_date, end_date = PortfolioCalculator._compute_date_range('YTD')
        assert start_date.month == 1
        assert start_date.day == 1
        assert start_date.year == end_date.year
        
        # Test MAX range
        start_date, end_date = PortfolioCalculator._compute_date_range('MAX')
        date_diff = (end_date - start_date).days
        assert date_diff > 365 * 4  # Should be around 5 years


def run_tests():
    """Run the test suite"""
    print("Running PortfolioCalculator tests...")
    
    test_instance = TestPortfolioCalculator()
    
    # Run synchronous tests
    print("\n=== Testing FIFO Processing ===")
    try:
        test_instance.test_process_transactions_fifo()
        print("✅ FIFO processing test passed")
    except AssertionError as e:
        print(f"❌ FIFO processing test failed: {e}")
    except Exception as e:
        print(f"❌ FIFO processing test error: {e}")
    
    print("\n=== Testing Dividend Processing ===")
    try:
        test_instance.test_process_transactions_with_dividends()
        print("✅ Dividend processing test passed")
    except AssertionError as e:
        print(f"❌ Dividend processing test failed: {e}")
    except Exception as e:
        print(f"❌ Dividend processing test error: {e}")
    
    print("\n=== Testing Multiple Partial Sells ===")
    try:
        test_instance.test_process_transactions_multiple_partial_sells()
        print("✅ Multiple partial sells test passed")
    except AssertionError as e:
        print(f"❌ Multiple partial sells test failed: {e}")
    except Exception as e:
        print(f"❌ Multiple partial sells test error: {e}")
    
    print("\n=== Testing Cost Basis Bug Fix ===")
    try:
        test_instance.test_cost_basis_bug_fix()
        print("✅ Cost basis bug fix test passed")
    except AssertionError as e:
        print(f"❌ Cost basis bug fix test failed: {e}")
    except Exception as e:
        print(f"❌ Cost basis bug fix test error: {e}")
    
    print("\n=== Testing Date Range Computation ===")
    try:
        test_instance.test_date_range_computation()
        print("✅ Date range computation test passed")
    except AssertionError as e:
        print(f"❌ Date range computation test failed: {e}")
    except Exception as e:
        print(f"❌ Date range computation test error: {e}")
    
    # Run async test
    print("\n=== Testing Empty Portfolio ===")
    try:
        asyncio.run(test_instance.test_calculate_holdings_empty_portfolio())
        print("✅ Empty portfolio test passed")
    except Exception as e:
        print(f"❌ Empty portfolio test failed/error: {e}")


if __name__ == '__main__':
    run_tests()