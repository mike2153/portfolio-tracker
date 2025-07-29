"""
Response factory for creating standardized API responses.
Provides consistent response structure and automatic metadata injection.
"""

from typing import Any, Optional, Dict, List
from datetime import datetime
from models.response_models import APIResponse, ErrorResponse, ErrorDetail


class ResponseFactory:
    """
    Factory class for creating standardized API responses.
    
    Provides static methods to create consistent success and error responses
    with automatic metadata injection (timestamp, version).
    """
    
    # API version - update when making breaking changes
    API_VERSION: str = "1.0"
    
    @staticmethod
    def success(
        data: Any,
        message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> APIResponse[Any]:
        """
        Create a standardized success response.
        
        Args:
            data: The response payload (can be any type)
            message: Optional success message for the user
            metadata: Optional additional metadata to include
            
        Returns:
            APIResponse: Standardized success response with injected metadata
            
        Example:
            >>> user_data = {"id": "123", "name": "John"}
            >>> response = ResponseFactory.success(
            ...     data=user_data,
            ...     message="User profile retrieved successfully",
            ...     metadata={"cache_hit": True}
            ... )
        """
        # Create base metadata with timestamp and version
        base_metadata: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "version": ResponseFactory.API_VERSION
        }
        
        # Merge with any provided metadata
        if metadata:
            base_metadata.update(metadata)
        
        return APIResponse(
            success=True,
            data=data,
            error=None,  # Explicitly set to None for success responses
            message=message,
            metadata=base_metadata
        )
    
    @staticmethod
    def error(
        error: str,
        message: str,
        status_code: int = 400,
        details: Optional[List[ErrorDetail]] = None,
        request_id: Optional[str] = None
    ) -> ErrorResponse:
        """
        Create a standardized error response.
        
        Args:
            error: Error type/category (e.g., "ValidationError", "AuthenticationError")
            message: Human-readable error description
            status_code: HTTP status code (for logging/tracking, not returned in response)
            details: Optional list of detailed error information
            request_id: Optional request identifier for debugging
            
        Returns:
            ErrorResponse: Standardized error response
            
        Example:
            >>> response = ResponseFactory.error(
            ...     error="ValidationError",
            ...     message="Invalid input data",
            ...     status_code=400,
            ...     details=[
            ...         ErrorDetail(
            ...             code="INVALID_FORMAT",
            ...             message="Symbol must be uppercase",
            ...             field="symbol"
            ...         )
            ...     ]
            ... )
        """
        # Note: status_code is included for potential future use (e.g., logging)
        # but is not included in the response body itself
        
        return ErrorResponse(
            success=False,
            error=error,
            message=message,
            details=details,
            request_id=request_id,
            timestamp=datetime.utcnow()
        )
    
    @staticmethod
    def validation_error(
        field_errors: Dict[str, str],
        message: str = "Validation failed"
    ) -> ErrorResponse:
        """
        Create a validation error response from field errors.
        
        Args:
            field_errors: Dictionary mapping field names to error messages
            message: Overall error message
            
        Returns:
            ErrorResponse: Standardized validation error response
            
        Example:
            >>> response = ResponseFactory.validation_error(
            ...     field_errors={
            ...         "symbol": "Symbol must be 1-8 characters",
            ...         "price": "Price must be positive"
            ...     }
            ... )
        """
        details: List[ErrorDetail] = [
            ErrorDetail(
                code="VALIDATION_ERROR",
                message=error_msg,
                field=field_name
            )
            for field_name, error_msg in field_errors.items()
        ]
        
        return ResponseFactory.error(
            error="ValidationError",
            message=message,
            status_code=400,
            details=details
        )
    
    @staticmethod
    def not_found(
        resource: str,
        identifier: Optional[str] = None
    ) -> ErrorResponse:
        """
        Create a not found error response.
        
        Args:
            resource: The type of resource that was not found
            identifier: Optional identifier of the missing resource
            
        Returns:
            ErrorResponse: Standardized not found error response
            
        Example:
            >>> response = ResponseFactory.not_found("User", "123")
        """
        message: str = f"{resource} not found"
        if identifier:
            message += f": {identifier}"
        
        return ResponseFactory.error(
            error="NotFoundError",
            message=message,
            status_code=404
        )
    
    @staticmethod
    def unauthorized(
        message: str = "Authentication required"
    ) -> ErrorResponse:
        """
        Create an unauthorized error response.
        
        Args:
            message: Error message
            
        Returns:
            ErrorResponse: Standardized unauthorized error response
        """
        return ResponseFactory.error(
            error="AuthenticationError",
            message=message,
            status_code=401
        )
    
    @staticmethod
    def forbidden(
        message: str = "Access denied"
    ) -> ErrorResponse:
        """
        Create a forbidden error response.
        
        Args:
            message: Error message
            
        Returns:
            ErrorResponse: Standardized forbidden error response
        """
        return ResponseFactory.error(
            error="AuthorizationError",
            message=message,
            status_code=403
        )
    
    @staticmethod
    def service_unavailable(
        service: str,
        message: Optional[str] = None
    ) -> ErrorResponse:
        """
        Create a service unavailable error response.
        
        Args:
            service: Name of the unavailable service
            message: Optional custom error message
            
        Returns:
            ErrorResponse: Standardized service unavailable error response
        """
        default_message: str = f"{service} is temporarily unavailable. Please try again later."
        return ResponseFactory.error(
            error="ServiceUnavailableError",
            message=message or default_message,
            status_code=503
        )