#!/usr/bin/env python3
"""Test script to verify import paths work correctly"""

import sys
print(f"Current working directory: {sys.path[0]}")
print(f"Python path: {sys.path}")

try:
    # Test imports as they would be in Docker where /app is the working directory
    print("\nTesting imports from app root...")
    
    # These should work when run from /app
    from models.response_models import APIResponse, ErrorResponse
    print("✓ Successfully imported from models.response_models")
    
    from utils.response_factory import ResponseFactory  
    print("✓ Successfully imported from utils.response_factory")
    
    from backend_api_routes.backend_api_research import research_router
    print("✓ Successfully imported backend_api_routes.backend_api_research")
    
    print("\n✅ All imports successful!")
    
except ImportError as e:
    print(f"\n❌ Import error: {e}")
    print("\nThis script should be run from the backend_simplified directory")
    print("or with PYTHONPATH set to the backend_simplified directory")