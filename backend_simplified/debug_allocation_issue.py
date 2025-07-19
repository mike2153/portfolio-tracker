"""
Debug script to test allocation data flow and identify where data is lost
"""
import asyncio
import os
import sys
from datetime import datetime
import json
from decimal import Decimal

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supa_api.supa_api_jwt_helpers import create_authenticated_client
from supa_api.supa_api_transactions import supa_api_get_user_transactions
from services.portfolio_calculator import PortfolioCalculator
from services.portfolio_metrics_manager import portfolio_metrics_manager
from services.price_manager import price_manager
from config import SUPA_API_URL, SUPA_API_ANON_KEY

# Test user credentials
TEST_USER_EMAIL = "3200163@proton.me"  # Replace with actual test user
TEST_USER_PASSWORD = "12345678"  # Replace with actual password


async def debug_allocation_flow():
    """Step by step debug of allocation data flow"""
    print("=== ALLOCATION DEBUG SCRIPT ===\n")
    
    try:
        # Step 1: Authenticate
        print("Step 1: Authenticating user...")
        from supabase.client import create_client
        client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
        
        # Sign in the test user
        auth_response = client.auth.sign_in_with_password({
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if not auth_response or not auth_response.session or not auth_response.user:
            print("❌ Authentication failed!")
            return
            
        user_id = auth_response.user.id
        user_token = auth_response.session.access_token
        print(f"✅ Authenticated as user: {user_id}")
        print(f"   Email: {TEST_USER_EMAIL}")
        
        # Step 2: Get raw transactions
        print("\nStep 2: Fetching user transactions...")
        transactions = await supa_api_get_user_transactions(
            user_id=user_id,
            limit=1000,
            user_token=user_token
        )
        print(f"✅ Found {len(transactions)} transactions")
        
        if transactions:
            # Show sample transaction
            print("\nSample transaction:")
            sample = transactions[0]
            print(f"  Symbol: {sample.get('symbol')}")
            print(f"  Type: {sample.get('transaction_type')}")
            print(f"  Quantity: {sample.get('quantity')}")
            print(f"  Price: {sample.get('price')}")
            print(f"  Date: {sample.get('date')}")
            
            # Group by symbol
            symbols = set(t['symbol'] for t in transactions)
            print(f"\nUnique symbols: {', '.join(sorted(symbols))}")
            
            for symbol in sorted(symbols):
                symbol_txns = [t for t in transactions if t['symbol'] == symbol]
                buy_qty = sum(float(t['quantity']) for t in symbol_txns if t['transaction_type'] in ['Buy', 'BUY'])
                sell_qty = sum(float(t['quantity']) for t in symbol_txns if t['transaction_type'] in ['Sell', 'SELL'])
                net_qty = buy_qty - sell_qty
                print(f"  {symbol}: Buy={buy_qty}, Sell={sell_qty}, Net={net_qty}")
        
        # Step 3: Test portfolio calculator
        print("\nStep 3: Testing portfolio calculator...")
        calculator = PortfolioCalculator()
        holdings_data = await calculator.calculate_holdings(user_id, user_token)
        
        print(f"✅ Portfolio calculator returned:")
        print(f"   Holdings count: {len(holdings_data.get('holdings', []))}")
        print(f"   Total value: ${holdings_data.get('total_value', 0):,.2f}")
        print(f"   Total cost: ${holdings_data.get('total_cost', 0):,.2f}")
        
        if holdings_data.get('holdings'):
            print("\nHoldings details:")
            for h in holdings_data['holdings']:
                print(f"  {h['symbol']}: {h['quantity']} shares @ ${h['current_price']:.2f} = ${h['current_value']:,.2f}")
        
        # Step 4: Test price manager
        print("\nStep 4: Testing price manager...")
        if holdings_data.get('holdings'):
            symbols = [h['symbol'] for h in holdings_data['holdings']]
            prices = await price_manager.get_prices_for_symbols_from_db(symbols, user_token)
            print(f"✅ Got prices for {len(prices)} symbols")
            for symbol, price_data in prices.items():
                print(f"  {symbol}: ${price_data.get('price', 0):.2f}")
        
        # Step 5: Test portfolio metrics manager
        print("\nStep 5: Testing portfolio metrics manager...")
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="allocation",
            force_refresh=True
        )
        
        print(f"✅ Portfolio metrics returned:")
        print(f"   Holdings count: {len(metrics.holdings)}")
        print(f"   Total value: ${float(metrics.performance.total_value):,.2f}")
        print(f"   Cache status: {metrics.cache_status}")
        
        if metrics.holdings:
            print("\nMetrics holdings:")
            for h in metrics.holdings:
                print(f"  {h.symbol}: {float(h.quantity)} shares, ${float(h.current_value):,.2f} ({h.allocation_percent:.1f}%)")
        
        # Step 6: Test the actual API endpoint format
        print("\nStep 6: Testing API endpoint response format...")
        allocations = []
        colors = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime']
        
        for idx, holding in enumerate(metrics.holdings):
            if holding.quantity > 0:
                allocations.append({
                    'symbol': holding.symbol,
                    'company_name': holding.symbol,
                    'quantity': float(holding.quantity),
                    'current_price': float(holding.current_price),
                    'cost_basis': float(holding.total_cost),
                    'current_value': float(holding.current_value),
                    'gain_loss': float(holding.gain_loss),
                    'gain_loss_percent': holding.gain_loss_percent,
                    'dividends_received': float(holding.dividends_received) if hasattr(holding, 'dividends_received') else 0,
                    'allocation_percent': holding.allocation_percent,
                    'color': colors[idx % len(colors)]
                })
        
        allocation_data = {
            "allocations": allocations,
            "summary": {
                "total_value": float(metrics.performance.total_value),
                "total_cost": float(metrics.performance.total_cost),
                "total_gain_loss": float(metrics.performance.total_gain_loss),
                "total_gain_loss_percent": metrics.performance.total_gain_loss_percent,
                "total_dividends": float(metrics.performance.dividends_total)
            }
        }
        
        print(f"\n✅ Final API response would have:")
        print(f"   Allocations: {len(allocation_data['allocations'])} items")
        print(f"   Total value: ${allocation_data['summary']['total_value']:,.2f}")
        
        # Step 7: Check cache
        print("\nStep 7: Checking database cache...")
        cache_query = client.table('portfolio_metrics_cache') \
            .select('*') \
            .eq('user_id', user_id) \
            .order('created_at', desc=True) \
            .limit(5)
        
        cache_result = cache_query.execute()
        if cache_result.data:
            print(f"✅ Found {len(cache_result.data)} cache entries")
            latest = cache_result.data[0]
            print(f"   Latest cache key: {latest.get('cache_key')}")
            print(f"   Created: {latest.get('created_at')}")
            if latest.get('metrics'):
                cached_holdings = latest['metrics'].get('holdings', [])
                print(f"   Cached holdings count: {len(cached_holdings)}")
        else:
            print("❌ No cache entries found")
        
        print("\n=== DEBUG COMPLETE ===")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(debug_allocation_flow())