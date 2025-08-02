"""
Custom exception classes for Portfolio Tracker API.
Provides standardized error handling with strong typing.
Following JSON_STANDARDIZATION_PLAN.md specifications.
"""

from fastapi import HTTPException
from typing import Dict, List, Any
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Detailed error information for field-specific errors."""
    code: str
    message: str
    field: str  # Required field, no Optional
    details: Dict[str, Any] = {}  # Default empty dict instead of Optional


class APIException(HTTPException):
    """
    Base exception class for all API exceptions.
    Provides standardized error structure.
    """
    
    def __init__(
        self,
        status_code: int,
        error: str,
        message: str,
        details: Dict[str, Any] = None
    ):
        """
        Initialize API exception.
        
        Args:
            status_code: HTTP status code
            error: Error type/category (e.g., "Validation Error")
            message: Human-readable error message
            details: Additional error details (optional)
        """
        self.error = error
        self.message = message
        self.details = details or {}
        super().__init__(status_code=status_code, detail=message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        return {
            "success": False,
            "error": self.error,
            "message": self.message,
            "details": self.details,
            "status_code": self.status_code
        }


class ValidationException(APIException):
    """
    Exception for field validation errors.
    Used when request data fails validation.
    """
    
    def __init__(self, message: str, field_errors: Dict[str, str]):
        """
        Initialize validation exception.
        
        Args:
            message: Overall validation error message
            field_errors: Dictionary mapping field names to error messages
        """
        # Convert field_errors to list of ErrorDetail objects
        error_details = [
            ErrorDetail(
                code="validation_error",
                message=error_msg,
                field=field_name,
                details={"value": "invalid"}
            ).dict()
            for field_name, error_msg in field_errors.items()
        ]
        
        super().__init__(
            status_code=400,
            error="Validation Error",
            message=message,
            details={"field_errors": error_details}
        )


class AuthenticationException(APIException):
    """
    Exception for authentication errors.
    Used when user authentication fails or is missing.
    """
    
    def __init__(self, message: str = "Authentication required"):
        """
        Initialize authentication exception.
        
        Args:
            message: Authentication error message
        """
        super().__init__(
            status_code=401,
            error="Authentication Error",
            message=message,
            details={"auth_required": True}
        )


class AuthorizationException(APIException):
    """
    Exception for authorization errors.
    Used when authenticated user lacks required permissions.
    """
    
    def __init__(self, message: str = "Insufficient permissions", resource: str = ""):
        """
        Initialize authorization exception.
        
        Args:
            message: Authorization error message
            resource: Resource user tried to access
        """
        details = {"permissions_required": True}
        if resource:
            details["resource"] = resource
            
        super().__init__(
            status_code=403,
            error="Authorization Error",
            message=message,
            details=details
        )


class ResourceNotFoundException(APIException):
    """
    Exception for resource not found errors.
    Used when requested resource doesn't exist.
    """
    
    def __init__(self, resource_type: str, identifier: str):
        """
        Initialize resource not found exception.
        
        Args:
            resource_type: Type of resource (e.g., "Portfolio", "Transaction")
            identifier: Resource identifier that wasn't found
        """
        super().__init__(
            status_code=404,
            error="Resource Not Found",
            message=f"{resource_type} with identifier '{identifier}' not found",
            details={
                "resource_type": resource_type,
                "identifier": identifier
            }
        )


class ConflictException(APIException):
    """
    Exception for resource conflict errors.
    Used when operation would create duplicate or conflicting data.
    """
    
    def __init__(self, message: str, conflicting_field: str, existing_value: str):
        """
        Initialize conflict exception.
        
        Args:
            message: Conflict error message
            conflicting_field: Field causing the conflict
            existing_value: Existing value that conflicts
        """
        super().__init__(
            status_code=409,
            error="Resource Conflict",
            message=message,
            details={
                "conflicting_field": conflicting_field,
                "existing_value": existing_value
            }
        )


class RateLimitException(APIException):
    """
    Exception for rate limit errors.
    Used when user exceeds API rate limits.
    """
    
    def __init__(self, message: str, retry_after_seconds: int):
        """
        Initialize rate limit exception.
        
        Args:
            message: Rate limit error message
            retry_after_seconds: Seconds until user can retry
        """
        super().__init__(
            status_code=429,
            error="Rate Limit Exceeded",
            message=message,
            details={
                "retry_after_seconds": retry_after_seconds,
                "retry_after": f"{retry_after_seconds}s"
            }
        )
        # Set Retry-After header
        self.headers = {"Retry-After": str(retry_after_seconds)}


class ExternalServiceException(APIException):
    """
    Exception for external service errors.
    Used when external APIs or services fail.
    """
    
    def __init__(self, service_name: str, message: str, original_error: str = ""):
        """
        Initialize external service exception.
        
        Args:
            service_name: Name of the failing service
            message: Error message
            original_error: Original error from the service (optional)
        """
        details = {"service": service_name}
        if original_error:
            details["original_error"] = original_error
            
        super().__init__(
            status_code=503,
            error="External Service Error",
            message=message,
            details=details
        )


class DataIntegrityException(APIException):
    """
    Exception for data integrity errors.
    Used when data consistency checks fail.
    """
    
    def __init__(self, message: str, entity_type: str, entity_id: str):
        """
        Initialize data integrity exception.
        
        Args:
            message: Data integrity error message
            entity_type: Type of entity with integrity issue
            entity_id: ID of entity with integrity issue
        """
        super().__init__(
            status_code=500,
            error="Data Integrity Error",
            message=message,
            details={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "integrity_check_failed": True
            }
        )


class BusinessLogicException(APIException):
    """
    Exception for business logic violations.
    Used when operations violate business rules.
    """
    
    def __init__(self, message: str, rule_violated: str, context: Dict[str, Any] = None):
        """
        Initialize business logic exception.
        
        Args:
            message: Business logic error message
            rule_violated: Description of violated business rule
            context: Additional context about the violation (optional)
        """
        details = {"rule_violated": rule_violated}
        if context:
            details["context"] = context
            
        super().__init__(
            status_code=422,
            error="Business Logic Error",
            message=message,
            details=details
        )