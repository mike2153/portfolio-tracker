import asyncio
import aiohttp
import json
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv('env.test')

async def test_stock_overview():
    """Test the stock overview API endpoint"""
    
    # Get auth token from environment
    email = os.getenv('TEST_USER_EMAIL', '3200163@proton.me')
    password = os.getenv('TEST_USER_PASSWORD', 'Phalanx@3200163')
    
    print(f"=== Testing Stock Overview API for AAPL ===")
    print(f"Using email: {email}")
    
    async with aiohttp.ClientSession() as session:
        # First, authenticate with Supabase
        auth_url = "https://ijsbgdlgpzruqppwkipt.supabase.co/auth/v1/token?grant_type=password"
        auth_data = {
            "email": email,
            "password": password
        }
        
        print("\n1. Authenticating with Supabase...")
        async with session.post(auth_url, json=auth_data) as resp:
            if resp.status != 200:
                print(f"Auth failed with status {resp.status}")
                text = await resp.text()
                print(f"Response: {text}")
                return
            
            auth_response = await resp.json()
            access_token = auth_response['access_token']
            print("✓ Authentication successful")
        
        # Now test the stock overview endpoint
        api_url = "http://localhost:8000/api/stock_overview?symbol=AAPL"
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        print("\n2. Calling stock overview API...")
        print(f"URL: {api_url}")
        
        async with session.get(api_url, headers=headers) as resp:
            print(f"Status: {resp.status}")
            
            response_text = await resp.text()
            print(f"\nRaw Response:\n{response_text}")
            
            if resp.status == 200:
                try:
                    data = json.loads(response_text)
                    print(f"\n3. Parsed Response Structure:")
                    print(json.dumps(data, indent=2))
                    
                    # Check what's in the response
                    print(f"\n4. Response Analysis:")
                    print(f"- Has 'symbol': {'symbol' in data}")
                    print(f"- Has 'price_data': {'price_data' in data}")
                    print(f"- Has 'fundamentals': {'fundamentals' in data}")
                    print(f"- Has 'success': {'success' in data}")
                    
                    if 'fundamentals' in data and data['fundamentals']:
                        print(f"\n5. Fundamentals Data Keys:")
                        for key in sorted(data['fundamentals'].keys()):
                            print(f"  - {key}: {data['fundamentals'][key]}")
                    
                    if 'price_data' in data and data['price_data']:
                        print(f"\n6. Price Data:")
                        print(json.dumps(data['price_data'], indent=2))
                        
                except json.JSONDecodeError as e:
                    print(f"\nFailed to parse JSON: {e}")
            else:
                print(f"\nAPI call failed with status {resp.status}")

if __name__ == "__main__":
    asyncio.run(test_stock_overview()) 