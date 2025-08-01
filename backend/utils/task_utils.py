"""
Task utilities for safe background task execution
Provides wrappers to ensure background tasks don't fail silently
"""

import asyncio
import logging
from typing import Callable, Any, Awaitable
from functools import wraps

logger = logging.getLogger(__name__)


async def safe_background_task(
    task_func: Callable[..., Awaitable[Any]], 
    *args, 
    task_name: str = "background_task",
    user_id: str = None,
    **kwargs
) -> Any:
    """
    Execute a background task with proper exception handling and logging.
    
    Args:
        task_func: The async function to execute
        *args: Positional arguments for the task function
        task_name: Name of the task for logging purposes
        user_id: User ID for logging context
        **kwargs: Keyword arguments for the task function
    """
    try:
        logger.info(f"[TaskUtils] Starting background task: {task_name}" + 
                   (f" for user {user_id}" if user_id else ""))
        
        result = await task_func(*args, **kwargs)
        
        logger.info(f"[TaskUtils] Background task completed successfully: {task_name}" + 
                   (f" for user {user_id}" if user_id else ""))
        
        return result
        
    except Exception as e:
        logger.error(f"[TaskUtils] Background task failed: {task_name}" + 
                    (f" for user {user_id}" if user_id else "") + 
                    f" - Error: {type(e).__name__}: {str(e)}")
        logger.error(f"[TaskUtils] Full stack trace for {task_name}:", exc_info=True)
        
        # Import debug logger here to avoid circular imports
        try:
            from debug_logger import DebugLogger
            DebugLogger.log_error(
                file_name="task_utils.py",
                function_name="safe_background_task",
                error=e,
                user_id=user_id,
                task_name=task_name
            )
        except ImportError:
            logger.warning("[TaskUtils] Could not import DebugLogger for enhanced error logging")


def create_safe_background_task(
    task_func: Callable[..., Awaitable[Any]], 
    *args, 
    task_name: str = "background_task",
    user_id: str = None,
    **kwargs
) -> asyncio.Task[Any]:
    """
    Create a background task with safe exception handling.
    
    Args:
        task_func: The async function to execute
        *args: Positional arguments for the task function
        task_name: Name of the task for logging purposes
        user_id: User ID for logging context
        **kwargs: Keyword arguments for the task function
        
    Returns:
        asyncio.Task: The created background task
    """
    return asyncio.create_task(
        safe_background_task(task_func, *args, task_name=task_name, user_id=user_id, **kwargs),
        name=task_name
    )


def background_task_wrapper(task_name: str = None, include_user_id: bool = True) -> Callable[..., Callable[..., Awaitable[Any]]]:
    """
    Decorator to automatically wrap async functions with safe background task execution.
    
    Args:
        task_name: Name of the task for logging (defaults to function name)
        include_user_id: Whether to try to extract user_id from first argument
        
    Usage:
        @background_task_wrapper("price_update")
        async def update_prices(user_id: str, jwt: str):
            # Your async function here
            pass
    """
    def decorator(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            actual_task_name = task_name or func.__name__
            user_id = None
            
            if include_user_id and args:
                # Try to extract user_id from first argument
                if isinstance(args[0], str):
                    user_id = args[0]
                elif hasattr(args[0], 'get'):
                    user_id = args[0].get('id') or args[0].get('user_id')
            
            return await safe_background_task(
                func, *args, task_name=actual_task_name, user_id=user_id, **kwargs
            )
        return wrapper
    return decorator