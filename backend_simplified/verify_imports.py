#!/usr/bin/env python3
"""
Quick script to verify all imports are working correctly.
This simulates the Docker environment where PYTHONPATH=/app
"""

import sys
import os

# Simulate Docker environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Testing imports as they would work in Docker (PYTHONPATH=/app)...")
print("=" * 60)

errors = []

# Test main imports
try:
    from config import BACKEND_API_PORT
    print("✓ config import successful")
except Exception as e:
    errors.append(f"✗ config import failed: {e}")

try:
    from services.dividend_service import dividend_service
    print("✓ services.dividend_service import successful")
except Exception as e:
    errors.append(f"✗ services.dividend_service import failed: {e}")

try:
    from middleware.error_handler import register_exception_handlers
    print("✓ middleware.error_handler import successful")
except Exception as e:
    errors.append(f"✗ middleware.error_handler import failed: {e}")

try:
    from backend_api_routes.backend_api_auth import auth_router
    print("✓ backend_api_routes.backend_api_auth import successful")
except Exception as e:
    errors.append(f"✗ backend_api_routes.backend_api_auth import failed: {e}")

try:
    from models.response_models import APIResponse
    print("✓ models.response_models import successful")
except Exception as e:
    errors.append(f"✗ models.response_models import failed: {e}")

try:
    from utils.response_factory import ResponseFactory
    print("✓ utils.response_factory import successful")
except Exception as e:
    errors.append(f"✗ utils.response_factory import failed: {e}")

print("=" * 60)
if errors:
    print(f"\n{len(errors)} import errors found:")
    for error in errors:
        print(error)
else:
    print("\n✅ All imports successful! The app should work in Docker.")