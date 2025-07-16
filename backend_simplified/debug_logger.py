"""
Extensive debug logging system for the backend
Logs file, function, API, sender/receiver, and data
"""
import logging
import json
import traceback
from functools import wraps
from typing import Any, Dict, Optional
import time
from datetime import datetime
from config import DEBUG_INFO_LOGGING

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s::%(funcName)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

class LoggingConfig:
    """Runtime configuration for logging levels"""
    _info_logging_enabled = DEBUG_INFO_LOGGING  # Start with env var setting
    
    @classmethod
    def enable_info_logging(cls):
        """Enable info logging at runtime"""
        cls._info_logging_enabled = True
        logging.info("🔧 Info logging ENABLED")
    
    @classmethod
    def disable_info_logging(cls):
        """Disable info logging at runtime"""
        logging.info("🔧 Info logging DISABLED")
        cls._info_logging_enabled = False
    
    @classmethod
    def is_info_enabled(cls) -> bool:
        """Check if info logging is enabled"""
        return cls._info_logging_enabled
    
    @classmethod
    def toggle_info_logging(cls) -> bool:
        """Toggle info logging on/off and return new state"""
        if cls._info_logging_enabled:
            cls.disable_info_logging()
        else:
            cls.enable_info_logging()
        return cls._info_logging_enabled

    @classmethod
    def set_log_level_info(cls):
        """Set logging level to INFO (shows info, warning, error)"""
        logging.getLogger().setLevel(logging.INFO)
        logging.info("🔧 Logging level set to INFO")
    
    @classmethod
    def set_log_level_warning(cls):
        """Set logging level to WARNING (shows only warning, error)"""
        logging.info("🔧 Logging level set to WARNING")
        logging.getLogger().setLevel(logging.WARNING)
    
    @classmethod
    def toggle_log_level(cls) -> str:
        """Toggle between INFO and WARNING levels"""
        current_level = logging.getLogger().getEffectiveLevel()
        if current_level <= logging.INFO:
            cls.set_log_level_warning()
            return "WARNING"
        else:
            cls.set_log_level_info()
            return "INFO"

class DebugLogger:
    """Comprehensive debug logging for all API operations"""
    
    @staticmethod
    def log_api_call(api_name: str, sender: str, receiver: str, operation: str = ""):
        """Decorator for logging API calls with extensive details"""
        def decorator(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                start_time = time.time()
                file_name = func.__module__
                function_name = func.__name__
                
                # Log the start of the API call
                logger.info(f"""
========== API CALL START ==========
FILE: {file_name}
FUNCTION: {function_name}
API: {api_name}
OPERATION: {operation}
SENDER: {sender}
RECEIVER: {receiver}
ARGS: {DebugLogger._safe_serialize(args)}

====================================""")

#KWARGS: {DebugLogger._safe_serialize(kwargs)}
                
                try:
                    # Execute the function
                    result = await func(*args, **kwargs)
                    
                    # Calculate execution time
                    execution_time = time.time() - start_time
                    
                    # Log successful completion
                    # logger.info(f"""
# ========== API CALL SUCCESS ==========
# FILE: {file_name}
# FUNCTION: {function_name}
# API: {api_name}
# EXECUTION_TIME: {execution_time:.3f}s
# RESULT_TYPE: {type(result).__name__}
# RESULT_PREVIEW: {DebugLogger._safe_serialize(result)[:500]}...
# ======================================""")
                    
                    return result
                    
                except Exception as e:
                    # Calculate execution time
                    execution_time = time.time() - start_time
                    
                    # Log the error with full traceback
                    logger.error(f"""
========== API CALL ERROR ==========
FILE: {file_name}
FUNCTION: {function_name}
API: {api_name}
EXECUTION_TIME: {execution_time:.3f}s
ERROR_TYPE: {type(e).__name__}
ERROR_MESSAGE: {str(e)}
TRACEBACK:
{traceback.format_exc()}
====================================""")
                    raise
                    
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                start_time = time.time()
                file_name = func.__module__
                function_name = func.__name__
                
                # Log the start of the API call
                logger.info(f"""
========== API CALL START ==========
FILE: {file_name}
FUNCTION: {function_name}
API: {api_name}
OPERATION: {operation}
SENDER: {sender}
RECEIVER: {receiver}
ARGS: {DebugLogger._safe_serialize(args)}
KWARGS: {DebugLogger._safe_serialize(kwargs)}
====================================""")
                
                try:
                    # Execute the function
                    result = func(*args, **kwargs)
                    
                    # Calculate execution time
                    execution_time = time.time() - start_time
                    
                    # Log successful completion
                    # logger.info(f"""
# ========== API CALL SUCCESS ==========
# FILE: {file_name}
# FUNCTION: {function_name}
# API: {api_name}
# EXECUTION_TIME: {execution_time:.3f}s
# RESULT_TYPE: {type(result).__name__}
# RESULT_PREVIEW: {DebugLogger._safe_serialize(result)[:500]}...
# ======================================""")
                    
                    return result
                    
                except Exception as e:
                    # Calculate execution time
                    execution_time = time.time() - start_time
                    
                    # Log the error with full traceback
                    logger.error(f"""
========== API CALL ERROR ==========
FILE: {file_name}
FUNCTION: {function_name}
API: {api_name}
EXECUTION_TIME: {execution_time:.3f}s
ERROR_TYPE: {type(e).__name__}
ERROR_MESSAGE: {str(e)}
TRACEBACK:
{traceback.format_exc()}
====================================""")
                    raise
            
            # Return appropriate wrapper based on function type
            if asyncio is not None and asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
                
        return decorator
    
    @staticmethod
    def log_database_query(query_type: str, table: str):
        """Log database operations"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                file_name = func.__module__
                function_name = func.__name__
                
                logger.info(f"""
========== DATABASE QUERY ==========
FILE: {file_name}
FUNCTION: {function_name}
QUERY_TYPE: {query_type}
TABLE: {table}
ARGS: {DebugLogger._safe_serialize(args)}
====================================""")
                
                result = await func(*args, **kwargs)
                
                logger.info(f"""
========== DATABASE RESULT ==========
FILE: {file_name}
FUNCTION: {function_name}
ROWS_AFFECTED: {len(result) if isinstance(result, list) else 1}
=====================================""")
                
                return result
            return wrapper
        return decorator
    
    @staticmethod
    def log_cache_operation(operation: str):
        """Log cache operations"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                file_name = func.__module__
                function_name = func.__name__
                
                logger.info(f"""
========== CACHE OPERATION ==========
FILE: {file_name}
FUNCTION: {function_name}
OPERATION: {operation}
KEY: {args[0] if args else 'N/A'}
=====================================""")
                
                result = await func(*args, **kwargs)
                cache_hit = result is not None if operation == "GET" else None
                
                logger.info(f"""
========== CACHE RESULT ==========
FILE: {file_name}
FUNCTION: {function_name}
CACHE_HIT: {cache_hit}
==================================""")
                
                return result
            return wrapper
        return decorator
    
    @staticmethod
    def _safe_serialize(obj: Any) -> str:
        """Safely serialize objects for logging"""
        try:
            if isinstance(obj, (str, int, float, bool, type(None))):
                return str(obj)
            elif hasattr(obj, '__dict__'):
                # Handle custom objects
                return json.dumps(obj.__dict__, default=str)
            else:
                return json.dumps(obj, default=str)
        except:
            return str(obj)
    
    @staticmethod
    def log_info(file_name: str, function_name: str, message: str, **kwargs):
        """Log general info messages with context"""
        extra_info = " ".join([f"{k}={v}" for k, v in kwargs.items()])
        logger.info(f"[{file_name}::{function_name}] {message} {extra_info}")
    
    @staticmethod
    def log_error(file_name: str, function_name: str, error: Exception, **kwargs):
        """Log errors with full context"""
        extra_info = " ".join([f"{k}={v}" for k, v in kwargs.items()])
        logger.error(f"""
========== ERROR ==========
FILE: {file_name}
FUNCTION: {function_name}
ERROR_TYPE: {type(error).__name__}
ERROR_MESSAGE: {str(error)}
EXTRA_INFO: {extra_info}
TRACEBACK:
{traceback.format_exc()}
===========================""")

    @staticmethod
    def info_if_enabled(message: str, logger_instance: Optional[logging.Logger] = None):
        """
        Log info message only if info logging is enabled
        
        Args:
            message: The message to log
            logger_instance: Optional specific logger to use, defaults to root logger
        """
        if LoggingConfig.is_info_enabled():
            if logger_instance:
                logger_instance.info(message)
            else:
                logging.info(message)

# Import asyncio only if needed
try:
    import asyncio
except ImportError:
    asyncio = None 