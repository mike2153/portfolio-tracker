#!/usr/bin/env python3
"""
Quick test script to check the /api/complete endpoint response structure
"""
import asyncio
import json
from backend.services.user_performance_manager import user_performance_manager

async def test_complete_data():
    """Test the complete data generation without HTTP"""
    try:
        # Test with a dummy user ID (this will fail auth but we can see the structure)
        print("Testing user_performance_manager.generate_complete_data()...")
        
        # This will fail due to auth, but we can see what errors occur
        complete_data = await user_performance_manager.generate_complete_data(
            user_id="test-user-id",
            user_token="test-token",
            force_refresh=True
        )
        
        print("SUCCESS: Complete data generated")
        print(f"Data structure keys: {list(complete_data.__dict__.keys())}")
        
        if hasattr(complete_data, 'portfolio_metrics'):
            print(f"Portfolio metrics type: {type(complete_data.portfolio_metrics)}")
            if complete_data.portfolio_metrics:
                print(f"Portfolio metrics keys: {list(complete_data.portfolio_metrics.__dict__.keys())}")
        
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}")
        print("This is expected since we're using dummy credentials")

if __name__ == "__main__":
    asyncio.run(test_complete_data())