from typing import Any, Dict
from django.http import JsonResponse
import logging
from django.db import connections

logger = logging.getLogger(__name__)

def success_response(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    """
    Create a standardized success response
    
    Args:
        data: The response data
        message: Success message
        
    Returns:
        Standardized success response dictionary
    """
    response = {
        "ok": True,
        "message": message
    }
    
    if data is not None:
        response["data"] = data
    
    return response

def error_response(
    error: str, 
    status_code: int = 400, 
    data: Any = None,
    log_error: bool = True
) -> JsonResponse:
    """
    Create a standardized error response
    
    Args:
        error: Error message
        status_code: HTTP status code
        data: Additional error data
        log_error: Whether to log the error
        
    Returns:
        JsonResponse with standardized error format
    """
    if log_error:
        logger.error(f"API Error ({status_code}): {error}")
    
    response_data = {
        "ok": False,
        "error": error
    }
    
    if data is not None:
        response_data["data"] = data
    
    return JsonResponse(response_data, status=status_code)

def validation_error_response(errors: Dict[str, Any]) -> JsonResponse:
    """
    Create a standardized validation error response
    
    Args:
        errors: Dictionary of field validation errors
        
    Returns:
        JsonResponse with validation error format
    """
    return error_response(
        error="Validation failed",
        status_code=422,
        data={"validation_errors": errors}
    )

def close_old_connections():
    """
    Explicitly close old database connections to prevent pool exhaustion.
    Call this in long-running processes or after batch operations.
    """
    try:
        for conn in connections.all():
            conn.close_if_unusable_or_obsolete()
        logger.info("Closed old database connections")
    except Exception as e:
        logger.error(f"Error closing database connections: {e}")

def ensure_connection_health():
    """
    Ensure database connections are healthy and close stale ones.
    """
    try:
        from django.db import connection
        connection.ensure_connection()
        if connection.is_usable():
            logger.debug("Database connection is healthy")
        else:
            connection.close()
            logger.warning("Closed unhealthy database connection")
    except Exception as e:
        logger.error(f"Database connection health check failed: {e}")
        try:
            connection.close()
        except:
            pass 