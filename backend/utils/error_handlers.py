"""
Centralized error handling utilities for the Portfolio Tracker backend.
Provides consistent error handling, logging, and HTTP responses.
"""

from typing import Optional, Dict, Any, Callable
from fastapi import HTTPException
from functools import wraps
import logging
from decimal import InvalidOperation
import asyncio

logger = logging.getLogger(__name__)


class ServiceUnavailableError(HTTPException):
    """External service temporarily unavailable."""
    def __init__(self, service: str, detail: Optional[str] = None):
        super().__init__(
            status_code=503,
            detail=detail or f"{service} is temporarily unavailable. Please try again later."
        )


class InvalidInputError(HTTPException):
    """Invalid user input."""
    def __init__(self, field: str, detail: str):
        super().__init__(
            status_code=400,
            detail=f"Invalid {field}: {detail}"
        )


class RateLimitError(HTTPException):
    """Rate limit exceeded."""
    def __init__(self, action: str, retry_after: Optional[int] = None):
        headers = {"Retry-After": str(retry_after)} if retry_after else None
        super().__init__(
            status_code=429,
            detail=f"Rate limit exceeded for {action}. Please try again later.",
            headers=headers
        )


class DataNotFoundError(HTTPException):
    """Requested data not found."""
    def __init__(self, resource: str, identifier: Optional[str] = None):
        detail = f"{resource} not found"
        if identifier:
            detail += f": {identifier}"
        super().__init__(status_code=404, detail=detail)


def log_error_with_context(
    error: Exception,
    context: Dict[str, Any],
    user_id: Optional[str] = None
) -> None:
    """Log error with full context for debugging."""
    error_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "user_id": user_id,
        **context
    }
    logger.exception("Error occurred", extra=error_data)


def handle_database_error(error: Exception, operation: str, user_id: Optional[str] = None) -> HTTPException:
    """Convert database errors to appropriate HTTP exceptions."""
    log_error_with_context(error, {"operation": operation}, user_id)
    
    error_str = str(error).lower()
    
    if "unique constraint" in error_str:
        return HTTPException(
            status_code=409,
            detail="This record already exists. Please update the existing record instead."
        )
    elif "foreign key" in error_str:
        return HTTPException(
            status_code=400,
            detail="Invalid reference. Please ensure all referenced data exists."
        )
    elif "not found" in error_str:
        return DataNotFoundError(operation)
    else:
        return HTTPException(
            status_code=503,
            detail="Database operation failed. Please try again later."
        )


def handle_external_api_error(
    error: Exception,
    service: str,
    operation: str,
    user_id: Optional[str] = None
) -> HTTPException:
    """Convert external API errors to appropriate HTTP exceptions."""
    log_error_with_context(
        error,
        {"service": service, "operation": operation},
        user_id
    )
    
    if hasattr(error, 'response') and hasattr(error.response, 'status_code'):
        if error.response.status_code == 429:
            return RateLimitError(f"{service} API calls")
        elif error.response.status_code >= 500:
            return ServiceUnavailableError(service)
    
    return ServiceUnavailableError(
        service,
        f"Unable to {operation}. The external service may be experiencing issues."
    )


def handle_calculation_error(
    error: Exception,
    calculation: str,
    user_id: Optional[str] = None
) -> HTTPException:
    """Convert calculation errors to appropriate HTTP exceptions."""
    log_error_with_context(
        error,
        {"calculation": calculation},
        user_id
    )
    
    if isinstance(error, (ValueError, InvalidOperation)):
        return InvalidInputError(
            "calculation input",
            "Please ensure all values are valid numbers."
        )
    elif isinstance(error, ZeroDivisionError):
        return HTTPException(
            status_code=400,
            detail=f"Cannot perform {calculation}: division by zero."
        )
    else:
        return HTTPException(
            status_code=500,
            detail=f"Failed to calculate {calculation}. Please verify your data and try again."
        )


def async_error_handler(operation: str) -> Callable:
    """Decorator for consistent async error handling."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                raise  # Re-raise HTTP exceptions as-is
            except asyncio.CancelledError:
                raise  # Don't catch cancellation
            except Exception as e:
                # Try to extract user_id from args/kwargs
                user_id = kwargs.get('user_id')
                if not user_id and args:
                    # Check if first arg has user_id attribute
                    if hasattr(args[0], 'user_id'):
                        user_id = args[0].user_id
                
                log_error_with_context(
                    e,
                    {"operation": operation, "function": func.__name__},
                    user_id
                )
                
                # Determine error type and convert to HTTP exception
                if "supabase" in str(e).lower() or "postgrest" in str(e).lower():
                    raise handle_database_error(e, operation, user_id)
                elif any(api in str(e).lower() for api in ["alpha vantage", "external api", "timeout"]):
                    raise handle_external_api_error(e, "market data provider", operation, user_id)
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"An unexpected error occurred during {operation}. Please try again."
                    )
        return wrapper
    return decorator


def sync_error_handler(operation: str) -> Callable:
    """Decorator for consistent sync error handling."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            try:
                return func(*args, **kwargs)
            except HTTPException:
                raise  # Re-raise HTTP exceptions as-is
            except Exception as e:
                # Try to extract user_id from args/kwargs
                user_id = kwargs.get('user_id')
                if not user_id and args:
                    # Check if first arg has user_id attribute
                    if hasattr(args[0], 'user_id'):
                        user_id = args[0].user_id
                
                log_error_with_context(
                    e,
                    {"operation": operation, "function": func.__name__},
                    user_id
                )
                
                # Determine error type and convert to HTTP exception
                if isinstance(e, (ValueError, InvalidOperation)):
                    raise InvalidInputError(operation, str(e))
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"An unexpected error occurred during {operation}. Please try again."
                    )
        return wrapper
    return decorator