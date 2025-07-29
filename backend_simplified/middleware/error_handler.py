"""
Global exception handler middleware for Portfolio Tracker API.
Provides standardized error responses following the JSON_STANDARDIZATION_PLAN.
"""

from typing import Dict, Any, Optional, List
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from datetime import datetime
import logging
import traceback
import uuid

# Import the existing custom exceptions from utils
from utils.error_handlers import (
    ServiceUnavailableError,
    InvalidInputError,
    RateLimitError,
    DataNotFoundError
)
# Note: APIException is defined in this file, not imported

logger = logging.getLogger(__name__)


class APIException(HTTPException):
    """
    Custom API exception that includes structured error details.
    Extends FastAPI's HTTPException for compatibility.
    """
    def __init__(
        self,
        status_code: int,
        error: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None
    ):
        self.error = error
        self.message = message
        self.details = details or {}
        self.request_id = request_id or str(uuid.uuid4())
        super().__init__(status_code=status_code, detail=message)


class ErrorDetail:
    """Structured error detail information."""
    def __init__(
        self,
        code: str,
        message: str,
        field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.code = code
        self.message = message
        self.field = field
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result: Dict[str, Any] = {
            "code": self.code,
            "message": self.message
        }
        if self.field:
            result["field"] = self.field
        if self.details:
            result["details"] = self.details
        return result


class ResponseFactory:
    """Factory for creating standardized API responses."""
    
    @staticmethod
    def error(
        error: str,
        message: str,
        status_code: int = 400,
        details: Optional[List[ErrorDetail]] = None,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create standardized error response following JSON_STANDARDIZATION_PLAN.
        
        Args:
            error: Error type/category (e.g., "Validation Error", "Authentication Error")
            message: Human-readable error message
            status_code: HTTP status code
            details: List of detailed error information
            request_id: Unique request identifier for tracking
            
        Returns:
            Dictionary with standardized error response structure
        """
        return {
            "success": False,
            "error": error,
            "message": message,
            "details": [detail.to_dict() for detail in details] if details else None,
            "request_id": request_id or str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat()
        }


async def api_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global exception handler for all API exceptions.
    Converts various exception types to standardized JSON responses.
    
    Args:
        request: FastAPI request object
        exc: The exception that was raised
        
    Returns:
        JSONResponse with standardized error format
    """
    request_id = str(uuid.uuid4())
    
    # Log the exception with context
    logger.error(
        f"API Exception: {type(exc).__name__}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc()
        }
    )
    
    # Handle our custom APIException
    if isinstance(exc, APIException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ResponseFactory.error(
                error=exc.error,
                message=exc.message,
                status_code=exc.status_code,
                details=[ErrorDetail(
                    code=exc.error.replace(" ", "_").upper(),
                    message=exc.message,
                    details=exc.details
                )] if exc.details else None,
                request_id=exc.request_id or request_id
            )
        )
    
    # Handle existing custom exceptions from utils
    elif isinstance(exc, ServiceUnavailableError):
        return JSONResponse(
            status_code=503,
            content=ResponseFactory.error(
                error="Service Unavailable",
                message=str(exc.detail),
                status_code=503,
                request_id=request_id
            )
        )
    
    elif isinstance(exc, InvalidInputError):
        return JSONResponse(
            status_code=400,
            content=ResponseFactory.error(
                error="Invalid Input",
                message=str(exc.detail),
                status_code=400,
                request_id=request_id
            )
        )
    
    elif isinstance(exc, RateLimitError):
        return JSONResponse(
            status_code=429,
            content=ResponseFactory.error(
                error="Rate Limit Exceeded",
                message=str(exc.detail),
                status_code=429,
                request_id=request_id
            ),
            headers=exc.headers if hasattr(exc, 'headers') else None
        )
    
    elif isinstance(exc, DataNotFoundError):
        return JSONResponse(
            status_code=404,
            content=ResponseFactory.error(
                error="Not Found",
                message=str(exc.detail),
                status_code=404,
                request_id=request_id
            )
        )
    
    # Handle standard HTTPException
    elif isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ResponseFactory.error(
                error=HTTPException.__name__,
                message=exc.detail or "An error occurred",
                status_code=exc.status_code,
                request_id=request_id
            )
        )
    
    # Handle Pydantic validation errors
    elif isinstance(exc, (ValidationError, RequestValidationError)):
        errors = []
        if isinstance(exc, RequestValidationError):
            for error in exc.errors():
                field_path = ".".join(str(loc) for loc in error.get("loc", []))
                errors.append(ErrorDetail(
                    code="VALIDATION_ERROR",
                    message=error.get("msg", "Invalid value"),
                    field=field_path,
                    details={"type": error.get("type", "unknown")}
                ))
        else:
            # Handle Pydantic ValidationError
            for error in exc.errors():
                field_path = ".".join(str(loc) for loc in error.get("loc", []))
                errors.append(ErrorDetail(
                    code="VALIDATION_ERROR",
                    message=error.get("msg", "Invalid value"),
                    field=field_path,
                    details={"type": error.get("type", "unknown")}
                ))
        
        return JSONResponse(
            status_code=422,
            content=ResponseFactory.error(
                error="Validation Error",
                message="Request validation failed",
                status_code=422,
                details=errors,
                request_id=request_id
            )
        )
    
    # Handle any other unexpected exceptions
    else:
        # In production, don't expose internal error details
        return JSONResponse(
            status_code=500,
            content=ResponseFactory.error(
                error="Internal Server Error",
                message="An unexpected error occurred. Please try again later.",
                status_code=500,
                request_id=request_id
            )
        )


def register_exception_handlers(app) -> None:
    """
    Register all exception handlers with the FastAPI app.
    
    Args:
        app: FastAPI application instance
    """
    # Register handler for all exceptions
    app.add_exception_handler(Exception, api_exception_handler)
    
    # Register specific handlers for better error messages
    app.add_exception_handler(ValidationError, api_exception_handler)
    app.add_exception_handler(RequestValidationError, api_exception_handler)
    app.add_exception_handler(HTTPException, api_exception_handler)
    app.add_exception_handler(APIException, api_exception_handler)
    
    # Register handlers for custom exceptions from utils
    app.add_exception_handler(ServiceUnavailableError, api_exception_handler)
    app.add_exception_handler(InvalidInputError, api_exception_handler)
    app.add_exception_handler(RateLimitError, api_exception_handler)
    app.add_exception_handler(DataNotFoundError, api_exception_handler)