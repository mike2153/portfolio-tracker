#!/usr/bin/env python3
"""
Comprehensive import test script for backend_simplified project.
Tests all module imports and simulates Docker environment where working directory is /app/
"""

import sys
import os
from pathlib import Path
from typing import List, Tuple, Dict
import importlib.util

# Simulate Docker environment
# In Docker, the working directory is /app/ and backend_simplified is at /app/backend_simplified
original_cwd = os.getcwd()
backend_simplified_path = Path(__file__).parent.absolute()
project_root = backend_simplified_path.parent

# Add paths as they would be in Docker
sys.path.insert(0, str(project_root))  # /app equivalent
sys.path.insert(0, str(backend_simplified_path))  # /app/backend_simplified equivalent

print("=" * 80)
print("IMPORT TEST SCRIPT FOR BACKEND_SIMPLIFIED")
print("=" * 80)
print(f"Original CWD: {original_cwd}")
print(f"Backend Simplified Path: {backend_simplified_path}")
print(f"Project Root (simulated /app): {project_root}")
print(f"Python Path: {sys.path[:3]}")
print("=" * 80)
print()

# Define all modules to test
MODULES_TO_TEST = {
    "Main Module": [
        "backend_simplified.main",
        "main",
    ],
    
    "Config": [
        "backend_simplified.config",
        "config",
    ],
    
    "Debug Logger": [
        "backend_simplified.debug_logger",
        "debug_logger",
    ],
    
    "Backend API Routes": [
        "backend_simplified.backend_api_routes",
        "backend_simplified.backend_api_routes.backend_api_analytics",
        "backend_simplified.backend_api_routes.backend_api_auth",
        "backend_simplified.backend_api_routes.backend_api_dashboard",
        "backend_simplified.backend_api_routes.backend_api_forex",
        "backend_simplified.backend_api_routes.backend_api_portfolio",
        "backend_simplified.backend_api_routes.backend_api_research",
        "backend_simplified.backend_api_routes.backend_api_user_profile",
        "backend_simplified.backend_api_routes.backend_api_watchlist",
        "backend_api_routes",
        "backend_api_routes.backend_api_analytics",
        "backend_api_routes.backend_api_auth",
        "backend_api_routes.backend_api_dashboard",
        "backend_api_routes.backend_api_forex",
        "backend_api_routes.backend_api_portfolio",
        "backend_api_routes.backend_api_research",
        "backend_api_routes.backend_api_user_profile",
        "backend_api_routes.backend_api_watchlist",
    ],
    
    "Services": [
        "backend_simplified.services.dividend_service",
        "backend_simplified.services.financials_service",
        "backend_simplified.services.forex_manager",
        "backend_simplified.services.index_sim_service",
        "backend_simplified.services.portfolio_calculator",
        "backend_simplified.services.portfolio_metrics_manager",
        "backend_simplified.services.price_manager",
        "services.dividend_service",
        "services.financials_service",
        "services.forex_manager",
        "services.index_sim_service",
        "services.portfolio_calculator",
        "services.portfolio_metrics_manager",
        "services.price_manager",
    ],
    
    "Models": [
        "backend_simplified.models",
        "backend_simplified.models.response_models",
        "backend_simplified.models.validation_models",
        "models",
        "models.response_models",
        "models.validation_models",
    ],
    
    "Utils": [
        "backend_simplified.utils",
        "backend_simplified.utils.auth_helpers",
        "backend_simplified.utils.error_handlers",
        "backend_simplified.utils.exceptions",
        "backend_simplified.utils.response_factory",
        "utils",
        "utils.auth_helpers",
        "utils.error_handlers",
        "utils.exceptions",
        "utils.response_factory",
    ],
    
    "Middleware": [
        "backend_simplified.middleware",
        "backend_simplified.middleware.error_handler",
        "middleware",
        "middleware.error_handler",
    ],
    
    "Supabase API": [
        "backend_simplified.supa_api",
        "backend_simplified.supa_api.supa_api_auth",
        "backend_simplified.supa_api.supa_api_client",
        "backend_simplified.supa_api.supa_api_historical_prices",
        "backend_simplified.supa_api.supa_api_jwt_helpers",
        "backend_simplified.supa_api.supa_api_portfolio",
        "backend_simplified.supa_api.supa_api_read",
        "backend_simplified.supa_api.supa_api_transactions",
        "backend_simplified.supa_api.supa_api_user_profile",
        "backend_simplified.supa_api.supa_api_watchlist",
        "supa_api",
        "supa_api.supa_api_auth",
        "supa_api.supa_api_client",
        "supa_api.supa_api_historical_prices",
        "supa_api.supa_api_jwt_helpers",
        "supa_api.supa_api_portfolio",
        "supa_api.supa_api_read",
        "supa_api.supa_api_transactions",
        "supa_api.supa_api_user_profile",
        "supa_api.supa_api_watchlist",
    ],
    
    "Alpha Vantage API": [
        "backend_simplified.vantage_api",
        "backend_simplified.vantage_api.vantage_api_client",
        "backend_simplified.vantage_api.vantage_api_financials",
        "backend_simplified.vantage_api.vantage_api_news",
        "backend_simplified.vantage_api.vantage_api_quotes",
        "backend_simplified.vantage_api.vantage_api_search",
        "vantage_api",
        "vantage_api.vantage_api_client",
        "vantage_api.vantage_api_financials",
        "vantage_api.vantage_api_news",
        "vantage_api.vantage_api_quotes",
        "vantage_api.vantage_api_search",
    ],
    
    "Scripts": [
        "backend_simplified.scripts.load_market_holidays",
        "backend_simplified.scripts.seed_historical_data",
        "scripts.load_market_holidays",
        "scripts.seed_historical_data",
    ],
}

def test_import(module_name: str) -> Tuple[bool, str]:
    """Test importing a single module."""
    try:
        # Clear from sys.modules if already imported
        if module_name in sys.modules:
            del sys.modules[module_name]
        
        # Try to import
        __import__(module_name)
        return True, "SUCCESS"
    except ImportError as e:
        return False, f"ImportError: {str(e)}"
    except Exception as e:
        return False, f"{type(e).__name__}: {str(e)}"

def main():
    """Run all import tests."""
    results: Dict[str, List[Tuple[str, bool, str]]] = {}
    total_tests = 0
    total_success = 0
    
    # Test each category
    for category, modules in MODULES_TO_TEST.items():
        print(f"\n{'=' * 60}")
        print(f"Testing {category}")
        print('=' * 60)
        
        category_results = []
        
        for module in modules:
            success, error_msg = test_import(module)
            category_results.append((module, success, error_msg))
            total_tests += 1
            if success:
                total_success += 1
                print(f"[OK] {module}")
            else:
                print(f"[FAIL] {module}")
                print(f"  --> {error_msg}")
        
        results[category] = category_results
    
    # Summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print('=' * 80)
    print(f"Total modules tested: {total_tests}")
    print(f"Successful imports: {total_success}")
    print(f"Failed imports: {total_tests - total_success}")
    print(f"Success rate: {(total_success / total_tests * 100):.1f}%")
    
    # Detailed failure summary
    failures = []
    for category, category_results in results.items():
        for module, success, error_msg in category_results:
            if not success:
                failures.append((category, module, error_msg))
    
    if failures:
        print(f"\n{'=' * 80}")
        print("FAILED IMPORTS DETAIL")
        print('=' * 80)
        for category, module, error_msg in failures:
            print(f"\n[{category}] {module}")
            print(f"  Error: {error_msg}")
    
    # Test specific imports that main.py uses
    print(f"\n{'=' * 80}")
    print("TESTING MAIN.PY SPECIFIC IMPORTS")
    print('=' * 80)
    
    main_imports = [
        ("from fastapi import FastAPI", lambda: __import__('fastapi').FastAPI),
        ("from fastapi.middleware.cors import CORSMiddleware", 
         lambda: __import__('fastapi.middleware.cors', fromlist=['CORSMiddleware']).CORSMiddleware),
        ("from backend_simplified.config import settings", 
         lambda: __import__('backend_simplified.config', fromlist=['settings']).settings),
        ("from config import settings (relative)", 
         lambda: __import__('config', fromlist=['settings']).settings),
    ]
    
    for import_str, import_func in main_imports:
        try:
            import_func()
            print(f"[OK] {import_str}")
        except Exception as e:
            print(f"[FAIL] {import_str}")
            print(f"  --> {type(e).__name__}: {str(e)}")
    
    # Environment info
    print(f"\n{'=' * 80}")
    print("ENVIRONMENT INFO")
    print('=' * 80)
    print(f"Python executable: {sys.executable}")
    print(f"Python version: {sys.version}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"__file__ location: {__file__}")
    print(f"\nPYTHONPATH entries:")
    for i, path in enumerate(sys.path[:10]):  # Show first 10 entries
        print(f"  [{i}] {path}")
    
    return total_tests - total_success == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)