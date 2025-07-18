#!/usr/bin/env python3
"""
Test script to check PortfolioMetricsManager functionality
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

def test_import():
    """Test that PortfolioMetricsManager can be imported"""
    print("=== Testing PortfolioMetricsManager Import ===")
    try:
        from services.portfolio_metrics_manager import portfolio_metrics_manager
        print("✅ Successfully imported portfolio_metrics_manager singleton")
        
        # Check class import
        from services.portfolio_metrics_manager import PortfolioMetricsManager
        print("✅ Successfully imported PortfolioMetricsManager class")
        
        # Check data models
        from services.portfolio_metrics_manager import (
            MetricsCacheStatus,
            PortfolioHolding,
            PortfolioMetrics,
            PortfolioSnapshot
        )
        print("✅ Successfully imported data models")
        
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_initialization():
    """Test that the singleton is properly initialized"""
    print("\n=== Testing PortfolioMetricsManager Initialization ===")
    try:
        from services.portfolio_metrics_manager import portfolio_metrics_manager
        
        # Check if it's an instance
        print(f"Type: {type(portfolio_metrics_manager)}")
        print(f"Module: {portfolio_metrics_manager.__class__.__module__}")
        print(f"Class: {portfolio_metrics_manager.__class__.__name__}")
        
        # Check available methods
        methods = [m for m in dir(portfolio_metrics_manager) if not m.startswith('_') and callable(getattr(portfolio_metrics_manager, m))]
        print(f"\nAvailable methods: {', '.join(methods[:5])}...")
        
        print("✅ Singleton is properly initialized")
        return True
    except Exception as e:
        print(f"❌ Initialization check failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_basic_functionality():
    """Test basic functionality without database"""
    print("\n=== Testing Basic Functionality ===")
    try:
        from services.portfolio_metrics_manager import portfolio_metrics_manager
        
        # Test cache key generation
        test_user_id = "test-user-123"
        test_date = "2024-01-01"
        
        # This should work without database
        cache_key = portfolio_metrics_manager._generate_cache_key(
            user_id=test_user_id,
            date=test_date,
            metrics_type="all"
        )
        print(f"✅ Generated cache key: {cache_key[:32]}...")
        
        # Test date validation
        from datetime import datetime, date
        validated_date = portfolio_metrics_manager._validate_date(date.today())
        print(f"✅ Date validation works: {validated_date}")
        
        return True
    except Exception as e:
        print(f"❌ Basic functionality test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_data_models():
    """Test data model validation"""
    print("\n=== Testing Data Models ===")
    try:
        from services.portfolio_metrics_manager import (
            PortfolioHolding,
            PortfolioMetrics,
            MetricsCacheStatus
        )
        from decimal import Decimal
        
        # Test PortfolioHolding
        holding = PortfolioHolding(
            symbol="AAPL",
            quantity=Decimal("100"),
            avg_cost=Decimal("150.50"),
            total_cost=Decimal("15050.00"),
            current_price=Decimal("175.00"),
            current_value=Decimal("17500.00"),
            unrealized_pnl=Decimal("2450.00"),
            unrealized_pnl_percent=Decimal("16.28")
        )
        print(f"✅ Created PortfolioHolding: {holding.symbol} - {holding.quantity} shares")
        
        # Test MetricsCacheStatus enum
        statuses = list(MetricsCacheStatus)
        print(f"✅ Cache statuses available: {', '.join(statuses)}")
        
        return True
    except Exception as e:
        print(f"❌ Data model test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("Starting PortfolioMetricsManager Tests")
    print("=" * 50)
    
    # Run synchronous tests
    import_success = test_import()
    if not import_success:
        print("\n⚠️  Import failed - cannot continue with other tests")
        return
        
    init_success = test_initialization()
    
    # Run async tests
    basic_success = await test_basic_functionality()
    model_success = await test_data_models()
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Summary:")
    print(f"  Import Test: {'✅ PASSED' if import_success else '❌ FAILED'}")
    print(f"  Initialization Test: {'✅ PASSED' if init_success else '❌ FAILED'}")
    print(f"  Basic Functionality: {'✅ PASSED' if basic_success else '❌ FAILED'}")
    print(f"  Data Models: {'✅ PASSED' if model_success else '❌ FAILED'}")
    
    all_passed = all([import_success, init_success, basic_success, model_success])
    print(f"\nOverall: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    
    if all_passed:
        print("\n📝 Note: These are basic import and initialization tests.")
        print("   Full integration tests would require database access and authentication.")


if __name__ == "__main__":
    asyncio.run(main())