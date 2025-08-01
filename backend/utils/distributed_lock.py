"""
Distributed locking utilities for portfolio tracker services
Provides database-based locking to prevent race conditions across multiple server instances
"""

import time
import asyncio
import logging
from typing import Optional, Dict, Any, AsyncGenerator
from contextlib import asynccontextmanager
from supa_api.supa_api_client import get_supa_service_client

logger = logging.getLogger(__name__)


class DistributedLockError(Exception):
    """Exception raised when distributed lock operations fail"""
    pass


class DistributedLock:
    """
    Database-based distributed lock implementation using PostgreSQL advisory locks
    
    This replaces in-memory threading locks with database-based locks that work
    across multiple server processes and instances.
    """
    
    def __init__(self, lock_name: str, timeout_seconds: int = 300):
        """
        Initialize distributed lock
        
        Args:
            lock_name: Unique name for the lock
            timeout_seconds: Lock timeout in seconds (default: 5 minutes)
        """
        self.lock_name = lock_name
        self.timeout_seconds = timeout_seconds
        self.supa_client = get_supa_service_client()
        
    async def acquire(self, max_wait_seconds: int = 30) -> bool:
        """
        Attempt to acquire the distributed lock
        
        Args:
            max_wait_seconds: Maximum time to wait for lock acquisition
            
        Returns:
            bool: True if lock was acquired, False otherwise
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            try:
                # Use PostgreSQL advisory locks for distributed locking
                result = self.supa_client.rpc(
                    'acquire_distributed_lock',
                    {
                        'p_lock_name': self.lock_name,
                        'p_timeout_seconds': self.timeout_seconds
                    }
                ).execute()
                
                if result.data and len(result.data) > 0:
                    acquired = result.data[0] if isinstance(result.data, list) else result.data
                    if acquired:
                        logger.info(f"[DistributedLock] Acquired lock: {self.lock_name}")
                        return True
                
                # Wait a bit before retrying
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"[DistributedLock] Error acquiring lock {self.lock_name}: {e}")
                return False
        
        logger.warning(f"[DistributedLock] Failed to acquire lock {self.lock_name} after {max_wait_seconds}s")
        return False
    
    async def release(self) -> bool:
        """
        Release the distributed lock
        
        Returns:
            bool: True if lock was released successfully, False otherwise
        """
        try:
            result = self.supa_client.rpc(
                'release_distributed_lock',
                {
                    'p_lock_name': self.lock_name
                }
            ).execute()
            
            if result.data and len(result.data) > 0:
                released = result.data[0] if isinstance(result.data, list) else result.data
                if released:
                    logger.info(f"[DistributedLock] Released lock: {self.lock_name}")
                    return True
            
            logger.warning(f"[DistributedLock] Failed to release lock: {self.lock_name}")
            return False
            
        except Exception as e:
            logger.error(f"[DistributedLock] Error releasing lock {self.lock_name}: {e}")
            return False
    
    async def is_locked(self) -> bool:
        """
        Check if the lock is currently held
        
        Returns:
            bool: True if lock is held, False otherwise
        """
        try:
            result = self.supa_client.rpc(
                'check_distributed_lock',
                {
                    'p_lock_name': self.lock_name
                }
            ).execute()
            
            if result.data and len(result.data) > 0:
                return bool(result.data[0] if isinstance(result.data, list) else result.data)
            
            return False
            
        except Exception as e:
            logger.error(f"[DistributedLock] Error checking lock {self.lock_name}: {e}")
            return False


@asynccontextmanager
async def distributed_lock(lock_name: str, timeout_seconds: int = 300, max_wait_seconds: int = 30) -> AsyncGenerator[bool, None]:
    """
    Context manager for distributed locking
    
    Usage:
        async with distributed_lock("dividend_sync_global"):
            # Critical section code here
            pass
    
    Args:
        lock_name: Unique name for the lock
        timeout_seconds: Lock timeout in seconds
        max_wait_seconds: Maximum time to wait for lock acquisition
        
    Raises:
        DistributedLockError: If lock cannot be acquired
    """
    lock = DistributedLock(lock_name, timeout_seconds)
    
    acquired = await lock.acquire(max_wait_seconds)
    if not acquired:
        raise DistributedLockError(f"Could not acquire distributed lock: {lock_name}")
    
    try:
        yield lock
    finally:
        await lock.release()


class DividendSyncLocks:
    """
    Specific distributed locks for dividend synchronization operations
    Replaces the in-memory threading locks with database-based distributed locks
    """
    
    GLOBAL_SYNC_LOCK = "dividend_sync_global"
    USER_SYNC_LOCK_PREFIX = "dividend_sync_user_"
    
    @classmethod
    def get_user_lock_name(cls, user_id: str) -> str:
        """Get the lock name for a specific user's dividend sync"""
        return f"{cls.USER_SYNC_LOCK_PREFIX}{user_id}"
    
    @classmethod
    async def can_start_global_sync(cls) -> bool:
        """
        Check if global dividend sync can start
        Returns True if no global or user syncs are in progress
        """
        try:
            # Check if global sync is already running
            global_lock = DistributedLock(cls.GLOBAL_SYNC_LOCK)
            if await global_lock.is_locked():
                logger.info("[DividendSyncLocks] Global sync already in progress")
                return False
            
            # Check if any user syncs are running
            # This would require a more sophisticated check, but for now we'll
            # rely on the global lock as the primary protection
            return True
            
        except Exception as e:
            logger.error(f"[DividendSyncLocks] Error checking sync status: {e}")
            return False
    
    @classmethod
    async def acquire_global_sync_lock(cls, max_wait_seconds: int = 5) -> Optional[DistributedLock]:
        """
        Acquire the global dividend sync lock
        
        Returns:
            DistributedLock if acquired, None if failed
        """
        lock = DistributedLock(cls.GLOBAL_SYNC_LOCK, timeout_seconds=600)  # 10 minute timeout
        
        if await lock.acquire(max_wait_seconds):
            return lock
        
        return None
    
    @classmethod
    async def acquire_user_sync_lock(cls, user_id: str, max_wait_seconds: int = 5) -> Optional[DistributedLock]:
        """
        Acquire a user-specific dividend sync lock
        
        Returns:
            DistributedLock if acquired, None if failed
        """
        lock_name = cls.get_user_lock_name(user_id)
        lock = DistributedLock(lock_name, timeout_seconds=300)  # 5 minute timeout
        
        if await lock.acquire(max_wait_seconds):
            return lock
        
        return None