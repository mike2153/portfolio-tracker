"""
Utils package for the Portfolio Tracker backend.

This package contains utility modules for:
- response_factory: Factory for creating standardized API responses
- error_handlers: Custom exception classes
- exceptions: Additional exception types
"""

from .response_factory import ResponseFactory
from .error_handlers import (
    ServiceUnavailableError,
    InvalidInputError,
    RateLimitError,
    DataNotFoundError,
)

# Try to import from exceptions.py if it exists
try:
    from .exceptions import (
        APIException,
        ValidationException,
        AuthenticationException,
        AuthorizationException,
        ResourceNotFoundException,
        ConflictException,
        RateLimitException as RateLimitExceptionNew,  # Avoid name conflict
        ExternalServiceException,
        DataIntegrityException,
        BusinessLogicException,
    )
except ImportError:
    # If exceptions.py doesn't exist, these will be None
    APIException = None
    ValidationException = None
    AuthenticationException = None
    AuthorizationException = None
    ResourceNotFoundException = None
    ConflictException = None
    RateLimitExceptionNew = None
    ExternalServiceException = None
    DataIntegrityException = None
    BusinessLogicException = None

__all__ = [
    "ResponseFactory",
    "ServiceUnavailableError",
    "InvalidInputError", 
    "RateLimitError",
    "DataNotFoundError",
]

# Add exception classes to __all__ if they were imported
if APIException is not None:
    __all__.extend([
        "APIException",
        "ValidationException",
        "AuthenticationException",
        "AuthorizationException",
        "ResourceNotFoundException",
        "ConflictException",
        "ExternalServiceException",
        "DataIntegrityException",
        "BusinessLogicException",
    ])