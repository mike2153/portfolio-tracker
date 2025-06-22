#!/usr/bin/env python3
"""
Simple test script to verify individual stock quote functionality
This tests the Alpha Vantage integration for individual stock quotes
"""

import os
import sys
import django
import requests
import json
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.alpha_vantage_service import get_alpha_vantage_service

def test_alpha_vantage_individual_quotes():
    """Test individual stock quote fetching using Alpha Vantage service"""
    print("🧪 Testing Individual Stock Quote Functionality")
    print("=" * 50)
    
    # Check if API key is available
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key:
        print("❌ ALPHA_VANTAGE_API_KEY environment variable not set")
        print("Please set your Alpha Vantage API key to run this test")
        return False
    
    print(f"✅ Alpha Vantage API key configured")
    
    # Test symbols - using reliable large cap stocks
    test_symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
    
    try:
        service = get_alpha_vantage_service()
        print(f"✅ Alpha Vantage service initialized")
        
        print(f"\n📊 Testing individual quotes for {len(test_symbols)} stocks:")
        
        results = {}
        for symbol in test_symbols:
            print(f"\n🔍 Fetching quote for {symbol}...")
            
            try:
                quote = service.get_global_quote(symbol)
                
                if quote:
                    price = quote.get('price', 0)
                    change = quote.get('change', 0)
                    change_percent = quote.get('change_percent', 0)
                    volume = quote.get('volume', 0)
                    
                    results[symbol] = {
                        'success': True,
                        'price': price,
                        'change': change,
                        'change_percent': change_percent,
                        'volume': volume
                    }
                    
                    print(f"  ✅ {symbol}: ${price:.2f} ({change:+.2f}, {change_percent:+.2f}%)")
                    print(f"     Volume: {volume:,}")
                else:
                    results[symbol] = {'success': False, 'error': 'No quote data returned'}
                    print(f"  ❌ {symbol}: No quote data returned")
                    
            except Exception as e:
                results[symbol] = {'success': False, 'error': str(e)}
                print(f"  ❌ {symbol}: Error - {e}")
        
        # Summary
        print(f"\n📈 Summary:")
        successful = sum(1 for r in results.values() if r['success'])
        total = len(test_symbols)
        
        print(f"✅ Successful quotes: {successful}/{total}")
        print(f"❌ Failed quotes: {total - successful}/{total}")
        
        if successful > 0:
            print(f"\n💹 Price Summary:")
            for symbol, result in results.items():
                if result['success']:
                    print(f"  {symbol}: ${result['price']:.2f}")
        
        return successful == total
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def test_backend_api_endpoints():
    """Test the backend API endpoints for stock quotes"""
    print("\n🌐 Testing Backend API Endpoints")
    print("=" * 50)
    
    # Test the local Django server endpoints
    base_url = "http://localhost:8000"
    test_symbols = ['AAPL', 'MSFT']
    
    print(f"🔍 Testing endpoints at {base_url}")
    
    for symbol in test_symbols:
        print(f"\n📡 Testing /api/stocks/{symbol}/quote...")
        
        try:
            response = requests.get(f"{base_url}/api/stocks/{symbol}/quote", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('ok') and data.get('data', {}).get('data', {}).get('price'):
                    price = data['data']['data']['price']
                    print(f"  ✅ {symbol} quote endpoint: ${price:.2f}")
                else:
                    print(f"  ⚠️  {symbol} quote endpoint: Invalid response format")
                    print(f"      Response: {json.dumps(data, indent=2)}")
            else:
                print(f"  ❌ {symbol} quote endpoint: HTTP {response.status_code}")
                print(f"      Response: {response.text}")
                
        except requests.exceptions.ConnectionError:
            print(f"  ⚠️  Cannot connect to {base_url} - make sure Django server is running")
            break
        except Exception as e:
            print(f"  ❌ {symbol} quote endpoint error: {e}")

def main():
    """Run all tests"""
    print("🚀 Individual Stock Quote Testing Suite")
    print("=" * 60)
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test 1: Alpha Vantage Service
    service_test_passed = test_alpha_vantage_individual_quotes()
    
    # Test 2: Backend API Endpoints (optional - requires running server)
    test_backend_api_endpoints()
    
    print("\n" + "=" * 60)
    print("🏁 Test Suite Complete")
    
    if service_test_passed:
        print("✅ Alpha Vantage individual quote functionality is working correctly!")
        print("💡 The portfolio screen should now display live current prices for each stock")
    else:
        print("❌ Some tests failed - check the API key and network connection")
    
    print(f"📅 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main() 