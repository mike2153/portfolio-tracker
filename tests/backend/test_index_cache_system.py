"""
Test suite for Index Cache System
Tests cache behavior, stale flag functionality, and transaction invalidation.

This test suite validates:
- Cache hit/miss behavior
- Stale data fallback with JSON flag  
- Route-level cache invalidation
- Background rebuild functionality
- Performance improvements (≤20ms p95 latency)
"""

import pytest
import asyncio
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List
import logging
import tempfile
import os

# Test utilities and fixtures
from test_real_auth_api import get_authenticated_client, create_test_user, cleanup_test_user

# Import the services and cache system we're testing
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend_simplified'))

from services.index_cache_service import index_cache_service, IndexCacheService
from workers.rebuild_index_cache import index_cache_rebuilder
from services.portfolio_service import PortfolioServiceUtils

logger = logging.getLogger(__name__)

class TestIndexCacheSystem:
    """Test class for the index caching system functionality"""
    
    @pytest.mark.asyncio
    async def test_cache_stale_flag_on_missing_data(self):
        """
        Test that stale flag appears when cache is missing.
        
        This validates requirement: "assert the stale flag appears when you purposely drop the cache"
        """
        print("\n🔥 [test_index_cache] === STALE FLAG TEST START ===")
        print(f"🔥 [test_index_cache] Testing stale flag when cache is missing")
        
        # Step 1: Create test user
        test_user_data = await create_test_user("cache_stale_test@test.com", "TestPass123!")
        client = await get_authenticated_client(test_user_data)
        user_id = test_user_data['user']['id']
        
        try:
            # Step 2: Ensure no cache exists for this user
            print(f"🗑️ [test_index_cache] Step 1: Ensuring clean cache state...")
            
            await index_cache_service.invalidate_async(user_id, benchmarks=['SPY'])
            print(f"✅ [test_index_cache] Cache cleared for user")
            
            # Step 3: Call performance endpoint - should return stale flag
            print(f"📡 [test_index_cache] Step 2: Calling performance endpoint...")
            
            response = client.get("/api/dashboard/performance?period=1M&benchmark=SPY")
            print(f"📡 [test_index_cache] Response status: {response.status_code}")
            
            assert response.status_code == 200, f"Performance endpoint failed: {response.text}"
            
            response_data = response.json()
            print(f"📊 [test_index_cache] Response data keys: {list(response_data.keys())}")
            print(f"📊 [test_index_cache] Stale flag: {response_data.get('stale', 'MISSING')}")
            print(f"📊 [test_index_cache] Cache hit: {response_data.get('metadata', {}).get('cache_hit', 'MISSING')}")
            
            # Step 4: Validate stale flag is present and True
            assert "stale" in response_data, "Response should include 'stale' field"
            assert response_data["stale"] == True, f"Stale flag should be True when cache is missing, got: {response_data['stale']}"
            
            # Step 5: Validate cache_hit metadata is False
            assert "metadata" in response_data, "Response should include metadata"
            assert response_data["metadata"].get("cache_hit") == False, "Cache hit should be False when cache is missing"
            
            print(f"✅ [test_index_cache] PASS: Stale flag correctly set to True when cache is missing")
            print(f"🔥 [test_index_cache] === STALE FLAG TEST COMPLETE ===")
            
        finally:
            await cleanup_test_user(test_user_data)
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_on_transaction_add(self):
        """
        Test that adding a transaction invalidates cache and triggers rebuild.
        
        This validates: "Editing a transaction updates the cache and the API slice within 10 s"
        """
        print("\n🔥 [test_index_cache] === TRANSACTION INVALIDATION TEST START ===")
        
        # Step 1: Create test user and initial SPY transaction
        test_user_data = await create_test_user("cache_invalidation_test@test.com", "TestPass123!")
        client = await get_authenticated_client(test_user_data)
        user_id = test_user_data['user']['id']
        
        try:
            # Step 2: Add initial transaction to create cache
            print(f"📝 [test_index_cache] Step 1: Adding initial transaction...")
            
            initial_transaction = {
                "symbol": "SPY",
                "quantity": 10,
                "price": 400.00,
                "date": (date.today() - timedelta(days=30)).isoformat(),
                "transaction_type": "BUY"
            }
            
            response = client.post("/api/transactions", json=initial_transaction)
            assert response.status_code == 200, f"Initial transaction failed: {response.text}"
            print(f"✅ [test_index_cache] Initial transaction added")
            
            # Step 3: Force cache rebuild to establish baseline
            print(f"🔄 [test_index_cache] Step 2: Building initial cache...")
            
            rebuild_success = await index_cache_rebuilder.rebuild_user_benchmark(
                user_id=user_id,
                benchmark="SPY",
                force=True
            )
            assert rebuild_success, "Initial cache rebuild should succeed"
            print(f"✅ [test_index_cache] Initial cache built")
            
            # Step 4: Call endpoint to verify cache hit
            print(f"📡 [test_index_cache] Step 3: Verifying cache hit...")
            
            response = client.get("/api/dashboard/performance?period=1M&benchmark=SPY")
            assert response.status_code == 200
            
            initial_data = response.json()
            print(f"📊 [test_index_cache] Initial stale flag: {initial_data.get('stale')}")
            print(f"📊 [test_index_cache] Initial cache hit: {initial_data.get('metadata', {}).get('cache_hit')}")
            
            # Should have cache hit (not stale)
            assert initial_data.get('stale') == False, "Initial call should have cache hit"
            
            # Step 5: Add new transaction (this should invalidate cache)
            print(f"📝 [test_index_cache] Step 4: Adding new transaction to trigger invalidation...")
            
            new_transaction = {
                "symbol": "SPY", 
                "quantity": 5,
                "price": 410.00,
                "date": (date.today() - timedelta(days=1)).isoformat(),
                "transaction_type": "BUY"
            }
            
            start_time = time.time()
            response = client.post("/api/transactions", json=new_transaction)
            assert response.status_code == 200, f"New transaction failed: {response.text}"
            print(f"✅ [test_index_cache] New transaction added, cache should be invalidated")
            
            # Step 6: Immediate call should return stale data
            print(f"📡 [test_index_cache] Step 5: Verifying immediate cache miss (stale data)...")
            
            response = client.get("/api/dashboard/performance?period=1M&benchmark=SPY")
            assert response.status_code == 200
            
            immediate_data = response.json()
            print(f"📊 [test_index_cache] Immediate stale flag: {immediate_data.get('stale')}")
            print(f"📊 [test_index_cache] Immediate cache hit: {immediate_data.get('metadata', {}).get('cache_hit')}")
            
            # Should be stale immediately after transaction
            assert immediate_data.get('stale') == True, "Should return stale data immediately after transaction"
            
            # Step 7: Wait for background rebuild and verify cache refresh
            print(f"🔄 [test_index_cache] Step 6: Waiting for background rebuild...")
            
            # Give background worker time to rebuild (or force rebuild for test)
            rebuild_success = await index_cache_rebuilder.rebuild_user_benchmark(
                user_id=user_id,
                benchmark="SPY",
                force=True
            )
            assert rebuild_success, "Background rebuild should succeed"
            
            elapsed_time = time.time() - start_time
            print(f"⏱️ [test_index_cache] Total time for invalidation + rebuild: {elapsed_time:.2f}s")
            
            # Step 8: Verify cache hit after rebuild
            print(f"📡 [test_index_cache] Step 7: Verifying cache hit after rebuild...")
            
            response = client.get("/api/dashboard/performance?period=1M&benchmark=SPY")
            assert response.status_code == 200
            
            final_data = response.json()
            print(f"📊 [test_index_cache] Final stale flag: {final_data.get('stale')}")
            print(f"📊 [test_index_cache] Final cache hit: {final_data.get('metadata', {}).get('cache_hit')}")
            
            # Should have cache hit after rebuild
            assert final_data.get('stale') == False, "Should have cache hit after rebuild"
            
            # Step 9: Validate performance requirement (≤10s for rebuild)
            assert elapsed_time <= 10, f"Cache rebuild took {elapsed_time:.2f}s, should be ≤10s"
            
            print(f"✅ [test_index_cache] PASS: Transaction invalidation and rebuild within {elapsed_time:.2f}s")
            print(f"🔥 [test_index_cache] === TRANSACTION INVALIDATION TEST COMPLETE ===")
            
        finally:
            await cleanup_test_user(test_user_data)
    
    @pytest.mark.asyncio 
    async def test_performance_endpoint_latency(self):
        """
        Test that performance endpoint meets latency requirements (≤20ms p95).
        
        This validates: "p95 of /performance ≤ 20 ms after warm cache"
        """
        print("\n🔥 [test_index_cache] === PERFORMANCE LATENCY TEST START ===")
        
        # Step 1: Create test user with pre-built cache
        test_user_data = await create_test_user("cache_perf_test@test.com", "TestPass123!")
        client = await get_authenticated_client(test_user_data)
        user_id = test_user_data['user']['id']
        
        try:
            # Step 2: Pre-populate cache with data
            print(f"🔄 [test_index_cache] Step 1: Pre-building cache for performance test...")
            
            # Add some transactions
            transaction = {
                "symbol": "SPY",
                "quantity": 100,
                "price": 400.00,
                "date": (date.today() - timedelta(days=90)).isoformat(),
                "transaction_type": "BUY"
            }
            
            response = client.post("/api/transactions", json=transaction)
            assert response.status_code == 200
            
            # Build cache
            rebuild_success = await index_cache_rebuilder.rebuild_user_benchmark(
                user_id=user_id,
                benchmark="SPY",
                force=True
            )
            assert rebuild_success, "Cache build should succeed"
            print(f"✅ [test_index_cache] Cache pre-built")
            
            # Step 3: Warm up the endpoint (first call)
            print(f"🔥 [test_index_cache] Step 2: Warming up endpoint...")
            
            response = client.get("/api/dashboard/performance?period=1M&benchmark=SPY")
            assert response.status_code == 200
            
            warm_data = response.json()
            assert warm_data.get('stale') == False, "Warm-up call should hit cache"
            print(f"✅ [test_index_cache] Endpoint warmed up")
            
            # Step 4: Measure latency over multiple calls
            print(f"⏱️ [test_index_cache] Step 3: Measuring latency over 20 calls...")
            
            latencies = []
            num_calls = 20
            
            for i in range(num_calls):
                start_time = time.time()
                
                response = client.get("/api/dashboard/performance?period=1M&benchmark=SPY")
                
                end_time = time.time()
                latency_ms = (end_time - start_time) * 1000
                latencies.append(latency_ms)
                
                assert response.status_code == 200, f"Call {i+1} failed"
                
                call_data = response.json()
                assert call_data.get('stale') == False, f"Call {i+1} should hit cache"
                
                if i % 5 == 0:
                    print(f"⏱️ [test_index_cache] Call {i+1}: {latency_ms:.2f}ms")
            
            # Step 5: Calculate statistics
            latencies.sort()
            p50 = latencies[len(latencies) // 2]
            p95 = latencies[int(len(latencies) * 0.95)]
            avg = sum(latencies) / len(latencies)
            
            print(f"📊 [test_index_cache] Latency statistics over {num_calls} calls:")
            print(f"📊 [test_index_cache] - Average: {avg:.2f}ms")
            print(f"📊 [test_index_cache] - P50 (median): {p50:.2f}ms")
            print(f"📊 [test_index_cache] - P95: {p95:.2f}ms")
            print(f"📊 [test_index_cache] - Min: {min(latencies):.2f}ms")
            print(f"📊 [test_index_cache] - Max: {max(latencies):.2f}ms")
            
            # Step 6: Validate performance requirement
            assert p95 <= 20, f"P95 latency {p95:.2f}ms exceeds 20ms requirement"
            
            print(f"✅ [test_index_cache] PASS: P95 latency {p95:.2f}ms ≤ 20ms")
            print(f"🔥 [test_index_cache] === PERFORMANCE LATENCY TEST COMPLETE ===")
            
        finally:
            await cleanup_test_user(test_user_data)
    
    @pytest.mark.asyncio
    async def test_cache_correctness_large_range(self):
        """
        Test that cache returns ≥252 points for 1Y range with old transactions.
        
        This validates: "/performance?range=1Y returns ⩾ 252 points & non-zero values 
        for a user whose first trade was > 1 Y ago"
        """
        print("\n🔥 [test_index_cache] === CACHE CORRECTNESS TEST START ===")
        
        # Step 1: Create test user
        test_user_data = await create_test_user("cache_correctness_test@test.com", "TestPass123!")
        client = await get_authenticated_client(test_user_data)
        user_id = test_user_data['user']['id']
        
        try:
            # Step 2: Add transaction more than 1 year ago
            print(f"📝 [test_index_cache] Step 1: Adding transaction > 1 year ago...")
            
            old_transaction = {
                "symbol": "SPY",
                "quantity": 50,
                "price": 350.00,
                "date": (date.today() - timedelta(days=500)).isoformat(),  # > 1 year ago
                "transaction_type": "BUY"
            }
            
            response = client.post("/api/transactions", json=old_transaction)
            assert response.status_code == 200, f"Old transaction failed: {response.text}"
            print(f"✅ [test_index_cache] Old transaction added: {old_transaction['date']}")
            
            # Step 3: Build cache covering the full range
            print(f"🔄 [test_index_cache] Step 2: Building cache for full range...")
            
            rebuild_success = await index_cache_rebuilder.rebuild_user_benchmark(
                user_id=user_id,
                benchmark="SPY",
                force=True
            )
            assert rebuild_success, "Cache rebuild should succeed"
            print(f"✅ [test_index_cache] Cache built")
            
            # Step 4: Call 1Y performance endpoint
            print(f"📡 [test_index_cache] Step 3: Calling 1Y performance endpoint...")
            
            response = client.get("/api/dashboard/performance?period=1Y&benchmark=SPY")
            assert response.status_code == 200, f"1Y performance call failed: {response.text}"
            
            response_data = response.json()
            print(f"📊 [test_index_cache] Response stale flag: {response_data.get('stale')}")
            print(f"📊 [test_index_cache] Response success: {response_data.get('success')}")
            
            # Step 5: Validate data points
            portfolio_performance = response_data.get('portfolio_performance', [])
            benchmark_performance = response_data.get('benchmark_performance', [])
            
            print(f"📊 [test_index_cache] Portfolio data points: {len(portfolio_performance)}")
            print(f"📊 [test_index_cache] Benchmark data points: {len(benchmark_performance)}")
            
            # Should have ≥252 trading days in 1 year
            assert len(portfolio_performance) >= 252, f"Portfolio should have ≥252 points, got {len(portfolio_performance)}"
            assert len(benchmark_performance) >= 252, f"Benchmark should have ≥252 points, got {len(benchmark_performance)}"
            
            # Step 6: Validate non-zero values
            portfolio_values = [point['total_value'] for point in portfolio_performance]
            benchmark_values = [point['total_value'] for point in benchmark_performance]
            
            non_zero_portfolio = [v for v in portfolio_values if v > 0]
            non_zero_benchmark = [v for v in benchmark_values if v > 0]
            
            print(f"📊 [test_index_cache] Non-zero portfolio values: {len(non_zero_portfolio)}/{len(portfolio_values)}")
            print(f"📊 [test_index_cache] Non-zero benchmark values: {len(non_zero_benchmark)}/{len(benchmark_values)}")
            
            # Should have non-zero values (at least some)
            assert len(non_zero_portfolio) > 0, "Portfolio should have non-zero values"
            assert len(non_zero_benchmark) > 0, "Benchmark should have non-zero values"
            
            # Most recent values should be non-zero (portfolio should have value after transaction)
            assert portfolio_values[-1] > 0, f"Final portfolio value should be > 0, got {portfolio_values[-1]}"
            assert benchmark_values[-1] > 0, f"Final benchmark value should be > 0, got {benchmark_values[-1]}"
            
            print(f"✅ [test_index_cache] PASS: 1Y range returned {len(portfolio_performance)} points with non-zero values")
            print(f"✅ [test_index_cache] Final portfolio value: ${portfolio_values[-1]}")
            print(f"✅ [test_index_cache] Final benchmark value: ${benchmark_values[-1]}")
            print(f"🔥 [test_index_cache] === CACHE CORRECTNESS TEST COMPLETE ===")
            
        finally:
            await cleanup_test_user(test_user_data)
    
    @pytest.mark.asyncio
    async def test_cache_service_bulk_operations(self):
        """
        Test the cache service bulk operations work correctly.
        
        This validates the core cache service functionality.
        """
        print("\n🔥 [test_index_cache] === CACHE SERVICE TEST START ===")
        
        # Test user setup
        test_user_data = await create_test_user("cache_service_test@test.com", "TestPass123!")
        user_id = test_user_data['user']['id']
        
        try:
            # Step 1: Test bulk write
            print(f"💾 [test_index_cache] Step 1: Testing bulk write...")
            
            test_data = [
                (date.today() - timedelta(days=5), Decimal('1000.50')),
                (date.today() - timedelta(days=4), Decimal('1010.75')),
                (date.today() - timedelta(days=3), Decimal('1020.25')),
                (date.today() - timedelta(days=2), Decimal('1015.80')),
                (date.today() - timedelta(days=1), Decimal('1025.90'))
            ]
            
            write_success = await index_cache_service.write_bulk(
                user_id=user_id,
                benchmark="SPY",
                data_points=test_data
            )
            
            assert write_success, "Bulk write should succeed"
            print(f"✅ [test_index_cache] Bulk write successful")
            
            # Step 2: Test cache read (hit)
            print(f"🔍 [test_index_cache] Step 2: Testing cache read (hit)...")
            
            cache_slice = await index_cache_service.read_slice(
                user_id=user_id,
                benchmark="SPY",
                start_date=date.today() - timedelta(days=5),
                end_date=date.today() - timedelta(days=1)
            )
            
            print(f"📊 [test_index_cache] Cache slice points: {cache_slice.total_points}")
            print(f"📊 [test_index_cache] Cache slice stale: {cache_slice.is_stale}")
            
            assert cache_slice.total_points == 5, f"Should have 5 points, got {cache_slice.total_points}"
            assert cache_slice.is_stale == False, "Should not be stale with fresh data"
            assert len(cache_slice.data) == 5, "Should return 5 data points"
            
            # Validate actual values
            for i, (returned_date, returned_value) in enumerate(cache_slice.data):
                expected_date, expected_value = test_data[i]
                assert returned_date == expected_date, f"Date mismatch at index {i}"
                assert returned_value == expected_value, f"Value mismatch at index {i}"
            
            print(f"✅ [test_index_cache] Cache read successful with correct data")
            
            # Step 3: Test cache read (miss/stale)
            print(f"🔍 [test_index_cache] Step 3: Testing cache read (miss)...")
            
            future_slice = await index_cache_service.read_slice(
                user_id=user_id,
                benchmark="SPY",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=5)  # Future dates not in cache
            )
            
            print(f"📊 [test_index_cache] Future slice stale: {future_slice.is_stale}")
            print(f"📊 [test_index_cache] Future slice points: {future_slice.total_points}")
            
            assert future_slice.is_stale == True, "Future dates should be stale"
            
            print(f"✅ [test_index_cache] Cache miss correctly identified as stale")
            
            # Step 4: Test cache invalidation
            print(f"🗑️ [test_index_cache] Step 4: Testing cache invalidation...")
            
            invalidation_success = await index_cache_service.invalidate_async(
                user_id=user_id,
                benchmarks=["SPY"]
            )
            
            assert invalidation_success, "Cache invalidation should succeed"
            print(f"✅ [test_index_cache] Cache invalidation successful")
            
            # Step 5: Verify cache is invalidated
            print(f"🔍 [test_index_cache] Step 5: Verifying cache invalidation...")
            
            post_invalidation_slice = await index_cache_service.read_slice(
                user_id=user_id,
                benchmark="SPY", 
                start_date=date.today() - timedelta(days=5),
                end_date=date.today() - timedelta(days=1)
            )
            
            print(f"📊 [test_index_cache] Post-invalidation stale: {post_invalidation_slice.is_stale}")
            print(f"📊 [test_index_cache] Post-invalidation points: {post_invalidation_slice.total_points}")
            
            # Should now be stale since cache was invalidated
            assert post_invalidation_slice.is_stale == True, "Should be stale after invalidation"
            assert post_invalidation_slice.total_points == 0, "Should have no points after invalidation"
            
            print(f"✅ [test_index_cache] Cache invalidation verified")
            print(f"🔥 [test_index_cache] === CACHE SERVICE TEST COMPLETE ===")
            
        finally:
            await cleanup_test_user(test_user_data)

if __name__ == "__main__":
    # Allow running this test file directly
    asyncio.run(pytest.main([__file__, "-v", "-s"]))