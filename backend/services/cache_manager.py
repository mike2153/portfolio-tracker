"""
Thread-safe cache manager for portfolio metrics without Redis dependency.
Handles concurrent access, TTL management, and proper cleanup.
"""
import asyncio
import threading
from typing import Any, Dict, Optional, Set, List
from datetime import datetime, timedelta
import logging
import weakref
import gc
from collections import defaultdict

logger = logging.getLogger(__name__)


class ThreadSafeCacheManager:
    """
    Thread-safe in-memory cache manager with TTL support.
    
    Features:
    - Thread-safe operations using asyncio locks
    - TTL (Time To Live) support for automatic expiration
    - Memory management and cleanup
    - Pattern-based invalidation
    - User-specific cache isolation
    - Metrics and monitoring
    """
    
    def __init__(self, default_ttl_seconds: int = 300, cleanup_interval_seconds: int = 60):
        """
        Initialize the cache manager.
        
        Args:
            default_ttl_seconds: Default TTL for cache entries (5 minutes)
            cleanup_interval_seconds: How often to run cleanup (1 minute)
        """
        self._cache: Dict[str, Any] = {}
        self._expiry_times: Dict[str, datetime] = {}
        self._access_times: Dict[str, datetime] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._lock_creation_lock = threading.Lock()
        self._cleanup_task: Optional[asyncio.Task[None]] = None
        self._default_ttl = default_ttl_seconds
        self._cleanup_interval = cleanup_interval_seconds
        self._running = False
        
        # Metrics
        self._metrics = {
            "cache_hits": 0,
            "cache_misses": 0,
            "cache_sets": 0,
            "cache_invalidations": 0,
            "cleanup_runs": 0,
            "entries_cleaned": 0
        }
        
        logger.info(f"ThreadSafeCacheManager initialized with TTL={default_ttl_seconds}s, cleanup={cleanup_interval_seconds}s")
    
    def _get_lock(self, key: str) -> asyncio.Lock:
        """Get or create a lock for a specific cache key."""
        with self._lock_creation_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]
    
    async def start(self) -> None:
        """Start the cache manager and background cleanup task."""
        if self._running:
            logger.warning("Cache manager already running")
            return
        
        self._running = True
        self._cleanup_task = asyncio.create_task(self._background_cleanup())
        logger.info("Cache manager started with background cleanup")
    
    async def stop(self) -> None:
        """Stop the cache manager and cleanup task."""
        self._running = False
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        await self.clear_all()
        logger.info("Cache manager stopped and cleared")
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Thread-safe cache get with expiry check.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        lock = self._get_lock(key)
        async with lock:
            current_time = datetime.utcnow()
            
            # Check if key exists
            if key not in self._cache:
                self._metrics["cache_misses"] += 1
                return None
            
            # Check if expired
            if key in self._expiry_times and current_time >= self._expiry_times[key]:
                await self._remove_key_unsafe(key)
                self._metrics["cache_misses"] += 1
                logger.debug(f"Cache key '{key}' expired and removed")
                return None
            
            # Update access time
            self._access_times[key] = current_time
            self._metrics["cache_hits"] += 1
            
            value = self._cache[key]
            logger.debug(f"Cache hit for key '{key}'")
            return value
    
    async def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """
        Thread-safe cache set with TTL.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl_seconds: TTL in seconds (uses default if None)
        """
        lock = self._get_lock(key)
        async with lock:
            current_time = datetime.utcnow()
            ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
            
            self._cache[key] = value
            self._expiry_times[key] = current_time + timedelta(seconds=ttl)
            self._access_times[key] = current_time
            self._metrics["cache_sets"] += 1
            
            logger.debug(f"Cache set for key '{key}' with TTL={ttl}s")
    
    async def invalidate(self, pattern: Optional[str] = None, user_id: Optional[str] = None) -> int:
        """
        Thread-safe cache invalidation with pattern matching.
        
        Args:
            pattern: Pattern to match in key names
            user_id: User ID to match in key names
            
        Returns:
            Number of keys invalidated
        """
        keys_to_remove = []
        
        # Collect keys to remove (don't modify dict while iterating)
        for key in list(self._cache.keys()):
            should_remove = False
            
            if pattern and pattern in key:
                should_remove = True
            elif user_id and f"user_{user_id}" in key:
                should_remove = True
            elif pattern is None and user_id is None:
                should_remove = True
                
            if should_remove:
                keys_to_remove.append(key)
        
        # Remove keys with proper locking
        removed_count = 0
        for key in keys_to_remove:
            lock = self._get_lock(key)
            async with lock:
                if key in self._cache:  # Double-check in case it was removed by another task
                    await self._remove_key_unsafe(key)
                    removed_count += 1
        
        self._metrics["cache_invalidations"] += removed_count
        logger.info(f"Cache invalidation removed {removed_count} keys (pattern='{pattern}', user_id='{user_id}')")
        return removed_count
    
    async def clear_all(self) -> int:
        """Clear all cache entries."""
        return await self.invalidate()
    
    async def _remove_key_unsafe(self, key: str) -> None:
        """Remove key from all data structures (assumes lock is held)."""
        self._cache.pop(key, None)
        self._expiry_times.pop(key, None)
        self._access_times.pop(key, None)
        # Note: Don't remove locks as they might be in use
    
    async def _background_cleanup(self) -> None:
        """Background task to clean up expired entries."""
        logger.info("Background cache cleanup task started")
        
        while self._running:
            try:
                await asyncio.sleep(self._cleanup_interval)
                
                if not self._running:
                    break
                
                cleaned_count = await self._cleanup_expired_entries()
                self._metrics["cleanup_runs"] += 1
                self._metrics["entries_cleaned"] += cleaned_count
                
                if cleaned_count > 0:
                    logger.info(f"Cleaned up {cleaned_count} expired cache entries")
                
                # Force garbage collection if we have many locks
                if len(self._locks) > 1000:
                    await self._cleanup_unused_locks()
                
            except asyncio.CancelledError:
                logger.info("Cache cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in cache cleanup: {e}")
                # Continue running even if cleanup fails
    
    async def _cleanup_expired_entries(self) -> int:
        """Clean up expired cache entries."""
        current_time = datetime.utcnow()
        expired_keys = []
        
        # Find expired keys
        for key, expiry_time in self._expiry_times.items():
            if current_time >= expiry_time:
                expired_keys.append(key)
        
        # Remove expired keys
        removed_count = 0
        for key in expired_keys:
            lock = self._get_lock(key)
            async with lock:
                if key in self._cache:  # Double-check in case it was removed
                    await self._remove_key_unsafe(key)
                    removed_count += 1
        
        return removed_count
    
    async def _cleanup_unused_locks(self) -> None:
        """Clean up locks for keys that no longer exist."""
        with self._lock_creation_lock:
            # Find locks for non-existent keys
            unused_lock_keys = [key for key in self._locks.keys() if key not in self._cache]
            
            # Remove unused locks
            for key in unused_lock_keys:
                self._locks.pop(key, None)
            
            if unused_lock_keys:
                logger.debug(f"Cleaned up {len(unused_lock_keys)} unused locks")
            
            # Force garbage collection
            gc.collect()
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get cache metrics."""
        total_requests = self._metrics["cache_hits"] + self._metrics["cache_misses"]
        hit_rate = (self._metrics["cache_hits"] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self._metrics,
            "total_entries": len(self._cache),
            "total_locks": len(self._locks),
            "hit_rate_percent": round(hit_rate, 2),
            "running": self._running
        }
    
    def get_cache_info(self) -> Dict[str, Any]:
        """Get detailed cache information for debugging."""
        current_time = datetime.utcnow()
        
        # Analyze TTL distribution
        ttl_info = []
        for key, expiry_time in self._expiry_times.items():
            ttl_remaining = (expiry_time - current_time).total_seconds()
            ttl_info.append({
                "key": key,
                "ttl_remaining_seconds": max(0, ttl_remaining),
                "expired": ttl_remaining <= 0
            })
        
        return {
            "total_entries": len(self._cache),
            "total_locks": len(self._locks),
            "entries_with_ttl": len(self._expiry_times),
            "metrics": self.get_metrics(),
            "ttl_info": ttl_info[:10]  # Only show first 10 for debugging
        }


class UserCacheManager:
    """
    User-specific cache manager that provides isolation between users.
    """
    
    def __init__(self, global_cache: ThreadSafeCacheManager):
        self.global_cache = global_cache
    
    def _user_key(self, user_id: str, key: str) -> str:
        """Generate user-specific cache key."""
        return f"user_{user_id}:{key}"
    
    async def get_user_cache(self, user_id: str, key: str) -> Optional[Any]:
        """Get value from user-specific cache."""
        user_key = self._user_key(user_id, key)
        return await self.global_cache.get(user_key)
    
    async def set_user_cache(self, user_id: str, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Set value in user-specific cache."""
        user_key = self._user_key(user_id, key)
        await self.global_cache.set(user_key, value, ttl_seconds)
    
    async def invalidate_user_cache(self, user_id: str, key_pattern: Optional[str] = None) -> int:
        """Invalidate user-specific cache entries."""
        if key_pattern:
            pattern = f"user_{user_id}:{key_pattern}"
        else:
            pattern = None
        
        return await self.global_cache.invalidate(pattern=pattern, user_id=user_id)


# Global cache instance
_global_cache: Optional[ThreadSafeCacheManager] = None
_user_cache: Optional[UserCacheManager] = None


async def get_cache_manager() -> ThreadSafeCacheManager:
    """Get or create the global cache manager instance."""
    global _global_cache
    
    if _global_cache is None:
        _global_cache = ThreadSafeCacheManager()
        await _global_cache.start()
    
    return _global_cache


async def get_user_cache_manager() -> UserCacheManager:
    """Get or create the user cache manager instance."""
    global _user_cache, _global_cache
    
    if _user_cache is None:
        global_cache = await get_cache_manager()
        _user_cache = UserCacheManager(global_cache)
    
    return _user_cache


async def shutdown_cache() -> None:
    """Shutdown all cache managers."""
    global _global_cache, _user_cache
    
    if _global_cache:
        await _global_cache.stop()
        _global_cache = None
    
    _user_cache = None
    logger.info("All cache managers shut down")