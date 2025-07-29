"""
Standard API response models for the Portfolio Tracker backend.
Provides consistent response structure across all endpoints.
"""

from typing import TypeVar, Generic, Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime

T = TypeVar('T')


class APIResponse(BaseModel, Generic[T]):
    """
    Standard API response wrapper for successful responses.
    
    Attributes:
        success: Always True for successful responses
        data: The actual response payload of type T
        error: Always None for successful responses
        message: Optional success message
        metadata: Additional metadata (timestamp, version, etc.)
    """
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None
    message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        """Configure JSON encoding for special types."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ErrorDetail(BaseModel):
    """
    Detailed error information for specific field or validation errors.
    
    Attributes:
        code: Error code for programmatic handling
        message: Human-readable error message
        field: Optional field name for validation errors
        details: Optional additional error context
    """
    code: str
    message: str
    field: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """
    Standard error response structure.
    
    Attributes:
        success: Always False for error responses
        error: Error type/category
        message: Human-readable error description
        details: Optional list of detailed error information
        request_id: Optional request identifier for debugging
        timestamp: Error occurrence timestamp
    """
    success: bool = False
    error: str
    message: str
    details: Optional[List[ErrorDetail]] = None
    request_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        """Configure JSON encoding for special types."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Common response type aliases for convenience
SuccessResponse = APIResponse[Dict[str, Any]]
ListResponse = APIResponse[List[Dict[str, Any]]]
EmptyResponse = APIResponse[None]


class PaginationMetadata(BaseModel):
    """
    Metadata for paginated responses.
    
    Attributes:
        total: Total number of items
        page: Current page number
        per_page: Items per page
        total_pages: Total number of pages
    """
    total: int
    page: int
    per_page: int
    total_pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standard paginated response structure.
    
    Attributes:
        success: Response status
        data: List of items for current page
        pagination: Pagination metadata
        metadata: Additional response metadata
    """
    success: bool
    data: List[T]
    pagination: PaginationMetadata
    metadata: Dict[str, Any] = Field(default_factory=dict)