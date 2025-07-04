"""
Background Worker for Index Cache Rebuilding
Implements distributed locking and bulk cache reconstruction.

This worker:
- Uses Redis distributed locks to prevent race conditions
- Rebuilds complete index series from first transaction to today
- Handles errors gracefully with Prometheus metrics
- Processes rebuild requests asynchronously
"""

import asyncio
import redis
import time
from typing import Optional, List, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal
import logging
import os
import traceback

from debug_logger import DebugLogger
from services.index_cache_service import index_cache_service, cache_rebuild_seconds, cache_rebuild_failed_total
from services.index_sim_service import IndexSimulationService
from supa_api.supa_api_jwt_helpers import create_service_client

logger = logging.getLogger(__name__)

class DistributedLock:
    """Redis-based distributed lock to prevent concurrent cache rebuilds"""
    
    def __init__(self, redis_client: redis.Redis, key: str, timeout: int = 300):
        self.redis_client = redis_client
        self.key = f"lock:{key}"
        self.timeout = timeout
        self.acquired = False
        print(f"🔒 [DistributedLock] Lock created for key: {self.key}")
    
    async def __aenter__(self):
        """Acquire lock asynchronously"""
        print(f"🔒 [DistributedLock] Attempting to acquire lock: {self.key}")
        
        # Try to acquire lock with expiration
        self.acquired = self.redis_client.set(
            self.key, 
            "locked", 
            nx=True,  # Only set if not exists
            ex=self.timeout  # Expire after timeout seconds
        )
        
        if self.acquired:
            print(f"✅ [DistributedLock] Lock acquired: {self.key}")
        else:
            print(f"❌ [DistributedLock] Lock already held: {self.key}")
            raise RuntimeError(f"Could not acquire lock: {self.key}")
        
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Release lock"""
        if self.acquired:
            self.redis_client.delete(self.key)
            print(f"🔓 [DistributedLock] Lock released: {self.key}")
        
        if exc_type:
            print(f"❌ [DistributedLock] Lock released due to exception: {exc_type.__name__}: {exc_val}")

class IndexCacheRebuilder:
    """Service for rebuilding index cache with distributed locking"""
    
    def __init__(self):
        # Initialize Redis connection for distributed locking
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.service_client = None
        print(f"🔧 [IndexCacheRebuilder] Initialized with Redis: {redis_url}")
    
    async def _get_service_client(self):
        """Get or create service client"""
        if self.service_client is None:
            self.service_client = create_service_client()
            print(f"🔧 [IndexCacheRebuilder] Service client created")
        return self.service_client
    
    async def rebuild_user_benchmark(
        self, 
        user_id: str, 
        benchmark: str,
        force: bool = False
    ) -> bool:
        """
        Rebuild cache for a specific user and benchmark.
        
        Uses distributed locking to prevent concurrent rebuilds.
        Rebuilds from first transaction date minus buffer to today.
        
        Args:
            user_id: User UUID
            benchmark: Index ticker (SPY, QQQ, etc.)
            force: If True, rebuild even if cache exists
            
        Returns:
            True if rebuild succeeded, False otherwise
        """
        lock_key = f"rebuild_cache:{user_id}:{benchmark}"
        
        print(f"🔄 [IndexCacheRebuilder] === CACHE REBUILD START ===")
        print(f"🔄 [IndexCacheRebuilder] User: {user_id}")
        print(f"🔄 [IndexCacheRebuilder] Benchmark: {benchmark}")
        print(f"🔄 [IndexCacheRebuilder] Force rebuild: {force}")
        print(f"🔄 [IndexCacheRebuilder] Lock key: {lock_key}")
        print(f"🔄 [IndexCacheRebuilder] Timestamp: {datetime.now().isoformat()}")
        
        start_time = time.time()
        
        try:
            # Step 1: Acquire distributed lock
            async with DistributedLock(self.redis_client, lock_key, timeout=300):
                print(f"🔄 [IndexCacheRebuilder] Step 1: Distributed lock acquired")
                
                # Step 2: Check if rebuild is needed (unless forced)
                if not force:
                    needs_rebuild = await self._check_rebuild_needed(user_id, benchmark)
                    if not needs_rebuild:
                        print(f"⏭️ [IndexCacheRebuilder] Cache is up-to-date, skipping rebuild")
                        return True
                
                # Step 3: Get user's transaction date range
                print(f"🔄 [IndexCacheRebuilder] Step 2: Determining rebuild date range...")
                
                start_date, end_date = await self._get_rebuild_date_range(user_id)
                if start_date is None:
                    print(f"⚠️ [IndexCacheRebuilder] No transactions found for user, skipping rebuild")
                    return True
                
                print(f"📅 [IndexCacheRebuilder] Rebuild range: {start_date} to {end_date}")
                
                # Step 4: Generate fresh index simulation
                print(f"🔄 [IndexCacheRebuilder] Step 3: Generating fresh index simulation...")
                
                # Create a service token for the simulation
                # This is a placeholder - in production you'd use a service account token
                service_token = os.getenv('SUPA_API_SERVICE_KEY')
                
                index_series = await IndexSimulationService.get_index_sim_series(
                    user_id=user_id,
                    benchmark=benchmark,
                    start_date=start_date,
                    end_date=end_date,
                    user_token=service_token  # Use service token for background operations
                )
                
                print(f"✅ [IndexCacheRebuilder] Generated {len(index_series)} index data points")
                
                if not index_series:
                    print(f"⚠️ [IndexCacheRebuilder] No index data generated, skipping cache write")
                    return True
                
                # Step 5: Write to cache in bulk
                print(f"🔄 [IndexCacheRebuilder] Step 4: Writing bulk data to cache...")
                
                write_success = await index_cache_service.write_bulk(
                    user_id=user_id,
                    benchmark=benchmark,
                    data_points=index_series
                )
                
                if not write_success:
                    print(f"❌ [IndexCacheRebuilder] Cache write failed")
                    cache_rebuild_failed_total.inc()
                    return False
                
                # Step 6: Record successful rebuild
                rebuild_time = time.time() - start_time
                cache_rebuild_seconds.observe(rebuild_time)
                
                print(f"✅ [IndexCacheRebuilder] Cache rebuild completed successfully")
                print(f"✅ [IndexCacheRebuilder] Rebuild time: {rebuild_time:.2f} seconds")
                print(f"✅ [IndexCacheRebuilder] Data points written: {len(index_series)}")
                print(f"🔄 [IndexCacheRebuilder] === CACHE REBUILD COMPLETE ===")
                
                return True
                
        except Exception as e:
            rebuild_time = time.time() - start_time
            cache_rebuild_failed_total.inc()
            
            logger.error(f"[IndexCacheRebuilder] Cache rebuild failed: {e}")
            print(f"❌ [IndexCacheRebuilder] Cache rebuild failed after {rebuild_time:.2f}s: {e}")
            print(f"❌ [IndexCacheRebuilder] Error type: {type(e).__name__}")
            print(f"❌ [IndexCacheRebuilder] Traceback: {traceback.format_exc()}")
            
            DebugLogger.log_error(
                file_name="rebuild_index_cache.py",
                function_name="rebuild_user_benchmark",
                error=e,
                user_id=user_id,
                benchmark=benchmark,
                rebuild_time=rebuild_time
            )
            
            return False
    
    async def _check_rebuild_needed(self, user_id: str, benchmark: str) -> bool:
        """
        Check if cache rebuild is needed by comparing transaction timestamps
        with cache timestamps.
        
        Args:
            user_id: User UUID
            benchmark: Index ticker
            
        Returns:
            True if rebuild is needed, False if cache is current
        """
        try:
            client = await self._get_service_client()
            
            # Get latest transaction timestamp
            tx_response = client.table('transactions') \
                .select('created_at') \
                .eq('user_id', user_id) \
                .order('created_at', desc=True) \
                .limit(1) \
                .execute()
            
            if not tx_response.data:
                print(f"📊 [IndexCacheRebuilder] No transactions found, no rebuild needed")
                return False
            
            latest_tx_time = datetime.fromisoformat(tx_response.data[0]['created_at'].replace('Z', '+00:00'))
            
            # Get latest cache timestamp
            cache_response = client.table('index_series_cache') \
                .select('created_at') \
                .eq('user_id', user_id) \
                .eq('benchmark', benchmark) \
                .order('created_at', desc=True) \
                .limit(1) \
                .execute()
            
            if not cache_response.data:
                print(f"📊 [IndexCacheRebuilder] No cache found, rebuild needed")
                return True
            
            latest_cache_time = datetime.fromisoformat(cache_response.data[0]['created_at'].replace('Z', '+00:00'))
            
            needs_rebuild = latest_tx_time > latest_cache_time
            print(f"📊 [IndexCacheRebuilder] Latest transaction: {latest_tx_time}")
            print(f"📊 [IndexCacheRebuilder] Latest cache: {latest_cache_time}")
            print(f"📊 [IndexCacheRebuilder] Rebuild needed: {needs_rebuild}")
            
            return needs_rebuild
            
        except Exception as e:
            logger.error(f"[IndexCacheRebuilder] Error checking rebuild need: {e}")
            print(f"❌ [IndexCacheRebuilder] Error checking rebuild need, assuming rebuild needed: {e}")
            return True
    
    async def _get_rebuild_date_range(self, user_id: str) -> Tuple[Optional[date], date]:
        """
        Get the date range for cache rebuilding.
        
        Starts from first transaction date minus 5-day buffer,
        ends at today plus 1-day buffer.
        
        Args:
            user_id: User UUID
            
        Returns:
            (start_date, end_date) or (None, today) if no transactions
        """
        try:
            client = await self._get_service_client()
            
            # Get first and last transaction dates
            tx_response = client.table('transactions') \
                .select('date') \
                .eq('user_id', user_id) \
                .order('date') \
                .execute()
            
            if not tx_response.data:
                return None, date.today()
            
            first_tx_date = datetime.strptime(tx_response.data[0]['date'], '%Y-%m-%d').date()
            last_tx_date = datetime.strptime(tx_response.data[-1]['date'], '%Y-%m-%d').date()
            
            # Add buffers: 5 days before first transaction, 1 day after today
            start_date = first_tx_date - timedelta(days=5)
            end_date = max(last_tx_date, date.today()) + timedelta(days=1)
            
            print(f"📅 [IndexCacheRebuilder] First transaction: {first_tx_date}")
            print(f"📅 [IndexCacheRebuilder] Last transaction: {last_tx_date}")
            print(f"📅 [IndexCacheRebuilder] Rebuild start (with buffer): {start_date}")
            print(f"📅 [IndexCacheRebuilder] Rebuild end (with buffer): {end_date}")
            
            return start_date, end_date
            
        except Exception as e:
            logger.error(f"[IndexCacheRebuilder] Error getting rebuild date range: {e}")
            print(f"❌ [IndexCacheRebuilder] Error getting date range: {e}")
            return None, date.today()
    
    async def rebuild_all_benchmarks(self, user_id: str, force: bool = False) -> Dict[str, bool]:
        """
        Rebuild cache for all supported benchmarks for a user.
        
        Args:
            user_id: User UUID
            force: If True, rebuild even if cache exists
            
        Returns:
            Dictionary mapping benchmark to success status
        """
        benchmarks = ['SPY', 'QQQ', 'A200', 'URTH', 'VTI', 'VXUS']
        results = {}
        
        print(f"🔄 [IndexCacheRebuilder] === REBUILDING ALL BENCHMARKS ===")
        print(f"🔄 [IndexCacheRebuilder] User: {user_id}")
        print(f"🔄 [IndexCacheRebuilder] Benchmarks: {benchmarks}")
        
        for benchmark in benchmarks:
            print(f"🔄 [IndexCacheRebuilder] Rebuilding {benchmark}...")
            
            try:
                success = await self.rebuild_user_benchmark(user_id, benchmark, force)
                results[benchmark] = success
                
                if success:
                    print(f"✅ [IndexCacheRebuilder] {benchmark} rebuild successful")
                else:
                    print(f"❌ [IndexCacheRebuilder] {benchmark} rebuild failed")
                
                # Small delay between benchmarks to avoid overwhelming the system
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"[IndexCacheRebuilder] Error rebuilding {benchmark}: {e}")
                results[benchmark] = False
                print(f"❌ [IndexCacheRebuilder] {benchmark} rebuild error: {e}")
        
        success_count = sum(1 for success in results.values() if success)
        print(f"🔄 [IndexCacheRebuilder] === ALL BENCHMARKS COMPLETE ===")
        print(f"🔄 [IndexCacheRebuilder] Successful: {success_count}/{len(benchmarks)}")
        print(f"🔄 [IndexCacheRebuilder] Results: {results}")
        
        return results

# Global rebuilder instance
index_cache_rebuilder = IndexCacheRebuilder()

# Main async function for running as standalone script
async def main():
    """Main function for running rebuilder as standalone script"""
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python rebuild_index_cache.py <user_id> <benchmark> [force]")
        print("       python rebuild_index_cache.py <user_id> all [force]")
        sys.exit(1)
    
    user_id = sys.argv[1]
    benchmark = sys.argv[2]
    force = len(sys.argv) > 3 and sys.argv[3].lower() == 'force'
    
    print(f"🚀 [rebuild_index_cache] Starting cache rebuild")
    print(f"🚀 [rebuild_index_cache] User: {user_id}")
    print(f"🚀 [rebuild_index_cache] Benchmark: {benchmark}")
    print(f"🚀 [rebuild_index_cache] Force: {force}")
    
    if benchmark.lower() == 'all':
        results = await index_cache_rebuilder.rebuild_all_benchmarks(user_id, force)
        print(f"🚀 [rebuild_index_cache] All benchmarks result: {results}")
    else:
        success = await index_cache_rebuilder.rebuild_user_benchmark(user_id, benchmark, force)
        print(f"🚀 [rebuild_index_cache] Single benchmark result: {success}")

if __name__ == "__main__":
    asyncio.run(main())