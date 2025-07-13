"""
Debug script to diagnose dividend ID issue
Run this to check what data structure is being returned
"""
import asyncio
import logging
import json
from services.dividend_service import dividend_service

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_dividend_structure():
    """Debug function to check dividend data structure"""
    
    # Test user ID (you'll need to replace with a real user ID)
    test_user_id = "YOUR_USER_ID_HERE"
    test_user_token = "YOUR_TOKEN_HERE"
    
    try:
        # Get dividends using the service
        result = await dividend_service.get_user_dividends(
            user_id=test_user_id,
            user_token=test_user_token,
            confirmed_only=False
        )
        
        print("=== DIVIDEND SERVICE RESPONSE ===")
        print(f"Success: {result.get('success')}")
        print(f"Total Count: {result.get('total_count')}")
        print(f"Dividends Array Length: {len(result.get('dividends', []))}")
        
        dividends = result.get('dividends', [])
        if dividends:
            print("\n=== FIRST DIVIDEND STRUCTURE ===")
            first_dividend = dividends[0]
            print(f"Type: {type(first_dividend)}")
            print(f"Keys: {list(first_dividend.keys())}")
            print(f"Has 'id' field: {'id' in first_dividend}")
            if 'id' in first_dividend:
                print(f"ID value: {first_dividend['id']}")
                print(f"ID type: {type(first_dividend['id'])}")
            
            # Print full structure
            print("\n=== FULL DIVIDEND DATA ===")
            print(json.dumps(first_dividend, indent=2, default=str))
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(debug_dividend_structure())