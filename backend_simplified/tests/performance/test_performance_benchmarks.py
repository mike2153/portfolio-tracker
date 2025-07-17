"""
Performance tests for PriceManager
Tests response times, throughput, and resource usage
"""
import pytest
import asyncio
import time
import psutil
import os
from datetime import datetime, timedelta, date
from unittest.mock import patch, AsyncMock, Mock
from typing import List, Dict, Any

from services.current_price_manager import CurrentPriceManager
from conftest import generate_mock_symbols, generate_mock_price_history


class TestPerformanceBenchmarks:
    """Performance benchmark tests for PriceManager"""
    
    @pytest.mark.asyncio
    async def test_single_quote_response_time(self, price_manager, mock_alpha_vantage_quote, performance_timer):
        """Test response time for single quote request"""
        # Warm up cache
        with patch.object(price_manager, '_get_current_price_data',
                          new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_alpha_vantage_quote
            
            with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                       new_callable=AsyncMock) as mock_market:
                mock_market.return_value = (True, {})
                
                # Measure cold start
                performance_timer.start()
                result = await price_manager.get_current_price_fast('AAPL')
                cold_time = performance_timer.stop()
                
                assert result['success'] is True
                
                # Measure cache hit
                performance_timer.start()
                result = await price_manager.get_current_price_fast('AAPL')
                cache_time = performance_timer.stop()
                
                assert result['success'] is True
                
                # Performance assertions
                assert cold_time < 0.5  # Cold start should be under 500ms
                assert cache_time < 0.01  # Cache hit should be under 10ms
                assert cache_time < cold_time * 0.1  # Cache should be at least 10x faster
                
                print(f"\nSingle Quote Performance:")
                print(f"  Cold start: {cold_time*1000:.2f}ms")
                print(f"  Cache hit: {cache_time*1000:.2f}ms")
                print(f"  Speed improvement: {cold_time/cache_time:.1f}x")
    
    @pytest.mark.asyncio
    async def test_portfolio_batch_response_time(self, price_manager, performance_timer):
        """Test response time for portfolio batch requests"""
        symbol_counts = [10, 50, 100, 200]
        results = []
        
        for count in symbol_counts:
            symbols = generate_mock_symbols(count)
            
            with patch.object(price_manager, '_get_db_historical_data',
                              new_callable=AsyncMock) as mock_db:
                # Mock database responses
                for symbol in symbols:
                    mock_db.return_value = generate_mock_price_history(symbol, 30)
                
                with patch('services.market_status_service.market_status_service.group_symbols_by_market',
                           new_callable=AsyncMock) as mock_group:
                    mock_group.return_value = {'United States': symbols}
                    
                    with patch('services.market_status_service.market_status_service.check_markets_status',
                               new_callable=AsyncMock) as mock_status:
                        mock_status.return_value = {'United States': True}
                        
                        performance_timer.start()
                        result = await price_manager.get_portfolio_prices_for_charts(
                            symbols, user_token='test_token'
                        )
                        elapsed = performance_timer.stop()
                        
                        assert result['success'] is True
                        results.append((count, elapsed))
        
        print("\nPortfolio Batch Performance:")
        for count, elapsed in results:
            print(f"  {count} symbols: {elapsed*1000:.2f}ms ({elapsed/count*1000:.2f}ms per symbol)")
        
        # Performance assertions
        for count, elapsed in results:
            assert elapsed < count * 0.01  # Should process each symbol in under 10ms
    
    @pytest.mark.asyncio
    async def test_cache_lookup_performance(self, price_manager, performance_timer):
        """Test cache lookup performance with varying cache sizes"""
        # Pre-populate cache with different sizes
        cache_sizes = [100, 1000, 5000, 10000]
        lookup_times = []
        
        for size in cache_sizes:
            # Clear cache
            price_manager._quote_cache.clear()
            
            # Populate cache
            for i in range(size):
                symbol = f"TEST{i:04d}"
                cache_data = {
                    "success": True,
                    "data": {"symbol": symbol, "price": 100.0 + i}
                }
                price_manager._quote_cache[f"quote_{symbol}"] = (
                    cache_data,
                    datetime.now(),
                    100.0 + i
                )
            
            # Measure lookup time
            test_symbol = f"TEST{size//2:04d}"  # Middle of cache
            
            performance_timer.start()
            for _ in range(1000):  # 1000 lookups
                key = f"quote_{test_symbol}"
                _ = price_manager._quote_cache.get(key)
            elapsed = performance_timer.stop()
            
            avg_lookup = elapsed / 1000
            lookup_times.append((size, avg_lookup))
        
        print("\nCache Lookup Performance:")
        for size, avg_time in lookup_times:
            print(f"  Cache size {size}: {avg_time*1000000:.2f}ns per lookup")
        
        # Cache lookup should be O(1)
        # Verify lookup time doesn't increase significantly with cache size
        first_time = lookup_times[0][1]
        last_time = lookup_times[-1][1]
        assert last_time < first_time * 2  # Should not double even with 100x more entries
    
    @pytest.mark.asyncio
    async def test_database_query_performance(self, mock_supa_client, performance_timer):
        """Test database query performance"""
        from supa_api.supa_api_historical_prices import supa_api_get_historical_prices
        
        # Mock different response sizes
        response_sizes = [10, 100, 500, 1000]
        query_times = []
        
        with patch('supa_api.supa_api_client.get_supa_service_client') as mock_get_client:
            mock_get_client.return_value = mock_supa_client
            
            for size in response_sizes:
                # Generate mock data
                mock_data = []
                for i in range(size):
                    mock_data.append({
                        'date': (date.today() - timedelta(days=i)).isoformat(),
                        'close': 100.0 + i,
                        'volume': 1000000
                    })
                
                mock_supa_client.table().select().eq().eq().order().execute.return_value = Mock(data=mock_data)
                
                performance_timer.start()
                result = await supa_api_get_historical_prices(
                    'AAPL',
                    (date.today() - timedelta(days=size)).isoformat(),
                    date.today().isoformat(),
                    'test_token'
                )
                elapsed = performance_timer.stop()
                
                query_times.append((size, elapsed))
                assert len(result) == size
        
        print("\nDatabase Query Performance:")
        for size, elapsed in query_times:
            print(f"  {size} records: {elapsed*1000:.2f}ms ({elapsed/size*1000:.2f}ms per record)")
        
        # Performance assertions
        for size, elapsed in query_times:
            assert elapsed < 1.0  # All queries should complete in under 1 second
    
    @pytest.mark.asyncio
    async def test_memory_usage_under_load(self, price_manager):
        """Test memory usage with large numbers of cached symbols"""
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Populate cache with many symbols
        num_symbols = 5000
        for i in range(num_symbols):
            symbol = f"TEST{i:04d}"
            cache_data = {
                "success": True,
                "data": {
                    "symbol": symbol,
                    "price": 100.0 + i,
                    "volume": 1000000,
                    "change": 1.0,
                    "change_percent": "1.0",
                    "high": 101.0,
                    "low": 99.0,
                    "open": 100.0
                },
                "metadata": {
                    "timestamp": datetime.now().isoformat(),
                    "source": "test"
                }
            }
            price_manager._quote_cache[f"quote_{symbol}"] = (
                cache_data,
                datetime.now(),
                100.0 + i
            )
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        memory_per_symbol = memory_increase / num_symbols * 1000  # KB per symbol
        
        print(f"\nMemory Usage:")
        print(f"  Initial memory: {initial_memory:.1f} MB")
        print(f"  Final memory: {final_memory:.1f} MB")
        print(f"  Memory increase: {memory_increase:.1f} MB")
        print(f"  Memory per symbol: {memory_per_symbol:.2f} KB")
        
        # Memory assertions
        assert memory_per_symbol < 10  # Should use less than 10KB per symbol
        assert memory_increase < 100  # Total increase should be under 100MB
    
    @pytest.mark.asyncio
    async def test_api_call_count_optimization(self, price_manager):
        """Test API call optimization for batch requests"""
        symbols = generate_mock_symbols(20)
        api_call_count = 0
        
        def count_api_calls(*args, **kwargs):
            nonlocal api_call_count
            api_call_count += 1
            return generate_mock_price_history(args[0] if args else 'AAPL', 30)
        
        with patch.object(price_manager, '_get_db_historical_data',
                          new_callable=AsyncMock) as mock_db:
            # Half symbols have data, half don't
            async def mock_db_call(symbol, *args, **kwargs):
                if symbols.index(symbol) < 10:
                    return generate_mock_price_history(symbol, 30)
                return []
            
            mock_db.side_effect = mock_db_call
            
            with patch('vantage_api.vantage_api_quotes.vantage_api_get_daily_adjusted',
                       new_callable=AsyncMock) as mock_api:
                mock_api.side_effect = count_api_calls
                
                with patch('services.market_status_service.market_status_service.group_symbols_by_market',
                           new_callable=AsyncMock) as mock_group:
                    mock_group.return_value = {'United States': symbols}
                    
                    with patch('services.market_status_service.market_status_service.check_markets_status',
                               new_callable=AsyncMock) as mock_status:
                        mock_status.return_value = {'United States': True}
                        
                        with patch('supa_api.supa_api_historical_prices.supa_api_store_historical_prices_batch',
                                   new_callable=AsyncMock) as mock_store:
                            mock_store.return_value = True
                            
                            result = await price_manager.get_portfolio_prices(
                                symbols, user_token='test_token'
                            )
        
        print(f"\nAPI Call Optimization:")
        print(f"  Total symbols: {len(symbols)}")
        print(f"  Symbols with cache: 10")
        print(f"  API calls made: {api_call_count}")
        print(f"  Optimization rate: {(1 - api_call_count/len(symbols))*100:.1f}%")
        
        # Should only make API calls for symbols without data
        assert api_call_count <= 10
    
    @pytest.mark.asyncio
    async def test_concurrent_request_performance(self, price_manager, performance_timer):
        """Test performance under concurrent load"""
        num_concurrent = 50
        symbols = generate_mock_symbols(num_concurrent)
        
        async def get_price(symbol):
            with patch.object(price_manager, '_get_current_price_data',
                              new_callable=AsyncMock) as mock_get:
                mock_get.return_value = {'symbol': symbol, 'price': 150.00}
                
                with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                           new_callable=AsyncMock) as mock_market:
                    mock_market.return_value = (True, {})
                    
                    return await price_manager.get_current_price_fast(symbol)
        
        # Sequential execution
        performance_timer.start()
        for symbol in symbols:
            await get_price(symbol)
        sequential_time = performance_timer.stop()
        
        # Clear cache
        price_manager._quote_cache.clear()
        
        # Concurrent execution
        performance_timer.start()
        await asyncio.gather(*[get_price(symbol) for symbol in symbols])
        concurrent_time = performance_timer.stop()
        
        speedup = sequential_time / concurrent_time
        
        print(f"\nConcurrent Request Performance:")
        print(f"  Sequential time: {sequential_time*1000:.2f}ms")
        print(f"  Concurrent time: {concurrent_time*1000:.2f}ms")
        print(f"  Speedup: {speedup:.1f}x")
        print(f"  Per request (concurrent): {concurrent_time/num_concurrent*1000:.2f}ms")
        
        # Concurrent should be significantly faster
        assert speedup > 5  # At least 5x speedup
        assert concurrent_time < sequential_time * 0.5  # Less than half the time
    
    @pytest.mark.asyncio
    async def test_market_status_check_overhead(self, price_manager, performance_timer):
        """Test overhead of market status checks"""
        symbols = generate_mock_symbols(100)
        
        # Test without market checks (simulated)
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market:
            mock_market.return_value = (True, {})
            
            with patch('services.market_status_service.market_status_service.group_symbols_by_market',
                       new_callable=AsyncMock) as mock_group:
                # Instant response
                mock_group.return_value = {'US': symbols}
                
                with patch('services.market_status_service.market_status_service.check_markets_status',
                           new_callable=AsyncMock) as mock_status:
                    mock_status.return_value = {'US': True}
                    
                    performance_timer.start()
                    # Simulate processing without actual market checks
                    for _ in range(100):
                        await mock_market('AAPL')
                    no_check_time = performance_timer.stop()
        
        # Test with realistic market check delays
        with patch('services.market_status_service.market_status_service.is_market_open_for_symbol',
                   new_callable=AsyncMock) as mock_market:
            async def delayed_market_check(*args):
                await asyncio.sleep(0.001)  # 1ms delay
                return (True, {})
            
            mock_market.side_effect = delayed_market_check
            
            performance_timer.start()
            for _ in range(100):
                await mock_market('AAPL')
            with_check_time = performance_timer.stop()
        
        overhead = with_check_time - no_check_time
        overhead_percent = (overhead / with_check_time) * 100
        
        print(f"\nMarket Status Check Overhead:")
        print(f"  Without checks: {no_check_time*1000:.2f}ms")
        print(f"  With checks: {with_check_time*1000:.2f}ms")
        print(f"  Overhead: {overhead*1000:.2f}ms ({overhead_percent:.1f}%)")
        
        # Overhead should be reasonable
        assert overhead_percent < 50  # Less than 50% overhead