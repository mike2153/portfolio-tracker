#!/usr/bin/env python3
"""
Debug script to check why portfolio service returns no data.
Run this to verify if user has transactions and historical price data.
"""
import asyncio
import os
import sys
from datetime import datetime, date
from supabase import create_client, Client

# Add backend to path
sys.path.append('backend_simplified')

from config import SUPA_API_URL, SUPA_API_ANON_KEY, SUPA_API_SERVICE_KEY

async def debug_portfolio_data():
    """Debug portfolio data availability"""
    print("🔍 === PORTFOLIO DATA DEBUG ===")
    print(f"⏰ Timestamp: {datetime.now().isoformat()}")
    
    # Create admin client with service key for debugging
    client: Client = create_client(SUPA_API_URL, SUPA_API_SERVICE_KEY)
    
    try:
        # 1. Check if we have any users
        print("\n📊 Step 1: Checking users...")
        users_response = client.table('auth.users').select('id, email, created_at').limit(5).execute()
        print(f"✅ Found {len(users_response.data)} users")
        
        if not users_response.data:
            print("❌ No users found in database!")
            return
        
        # Use first user for testing
        test_user_id = users_response.data[0]['id']
        test_user_email = users_response.data[0]['email']
        print(f"🧪 Using test user: {test_user_email} ({test_user_id})")
        
        # 2. Check transactions for this user
        print(f"\n📊 Step 2: Checking transactions for user {test_user_id}...")
        transactions_response = client.table('transactions') \
            .select('id, symbol, quantity, price, date, transaction_type') \
            .eq('user_id', test_user_id) \
            .order('date', desc=False) \
            .execute()
        
        transactions = transactions_response.data
        print(f"✅ Found {len(transactions)} transactions")
        
        if transactions:
            print("📝 Transaction sample:")
            for i, tx in enumerate(transactions[:3]):
                print(f"   {i+1}. {tx['date']}: {tx['transaction_type']} {tx['quantity']} {tx['symbol']} @ ${tx['price']}")
            
            # Get unique symbols
            symbols = list(set(tx['symbol'] for tx in transactions))
            print(f"📈 Unique symbols: {symbols}")
            
            # Get date range
            dates = [tx['date'] for tx in transactions]
            print(f"📅 Transaction date range: {min(dates)} to {max(dates)}")
        else:
            print("❌ No transactions found for this user!")
            return
        
        # 3. Check historical prices
        print(f"\n📊 Step 3: Checking historical prices...")
        
        # Check if we have any historical prices at all
        prices_count_response = client.table('historical_prices') \
            .select('symbol', count='exact') \
            .execute()
        
        print(f"✅ Historical prices table has {prices_count_response.count} total records")
        
        # Check prices for user's symbols
        for symbol in symbols[:3]:  # Check first 3 symbols
            symbol_prices_response = client.table('historical_prices') \
                .select('date, close') \
                .eq('symbol', symbol) \
                .order('date', desc=True) \
                .limit(5) \
                .execute()
            
            symbol_prices = symbol_prices_response.data
            print(f"📈 {symbol}: {len(symbol_prices)} price records")
            
            if symbol_prices:
                latest_price = symbol_prices[0]
                print(f"   Latest: {latest_price['date']} = ${latest_price['close']}")
            else:
                print(f"   ❌ No price data for {symbol}")
        
        # 4. Check recent trading days
        print(f"\n📊 Step 4: Checking recent trading days...")
        
        if symbols:
            recent_dates_response = client.table('historical_prices') \
                .select('date') \
                .eq('symbol', symbols[0]) \
                .order('date', desc=True) \
                .limit(10) \
                .execute()
            
            recent_dates = [record['date'] for record in recent_dates_response.data]
            print(f"📅 Last 10 trading days for {symbols[0]}:")
            for i, date_str in enumerate(recent_dates):
                print(f"   {i+1}. {date_str}")
        
        # 5. Test portfolio calculation manually
        print(f"\n📊 Step 5: Testing portfolio calculation...")
        
        # Import portfolio service
        from services.portfolio_service import PortfolioTimeSeriesService
        
        # Create a simple JWT token (for testing purposes)
        # In real usage, this would come from the authenticated user
        test_jwt = "test_token"  # This will likely fail, but let's see the error
        
        try:
            # Try to get portfolio series
            portfolio_series, metadata = await PortfolioTimeSeriesService.get_portfolio_series(
                user_id=test_user_id,
                range_key="1M",
                user_token=test_jwt
            )
            
            print(f"✅ Portfolio calculation successful!")
            print(f"📊 Portfolio series: {len(portfolio_series)} data points")
            print(f"📊 Metadata: {metadata}")
            
            if portfolio_series:
                print(f"💰 First value: {portfolio_series[0]}")
                print(f"💰 Last value: {portfolio_series[-1]}")
        
        except Exception as e:
            print(f"❌ Portfolio calculation failed: {e}")
            print(f"   This is expected if JWT validation is required")
        
        print(f"\n✅ Debug analysis complete!")
        print(f"\n📋 Summary:")
        print(f"   - Users: {len(users_response.data)}")
        print(f"   - Transactions: {len(transactions)}")
        print(f"   - Symbols: {len(symbols) if transactions else 0}")
        print(f"   - Historical prices: {prices_count_response.count}")
        
        if not transactions:
            print(f"\n💡 Recommendation: Add some transactions for user {test_user_email}")
        elif prices_count_response.count == 0:
            print(f"\n💡 Recommendation: Populate historical_prices table")
        else:
            print(f"\n💡 Issue is likely in portfolio calculation or JWT authentication")
            
    except Exception as e:
        print(f"❌ Debug script failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_portfolio_data()) 