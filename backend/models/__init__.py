"""
Models package for the Portfolio Tracker backend.

This package contains:
- validation_models: Input validation models for API endpoints
- response_models: Standardized response models for API outputs
"""

from .validation_models import (
    # Transaction models
    TransactionBase,
    TransactionCreate,
    TransactionUpdate,
    # Watchlist models
    WatchlistBase,
    WatchlistAdd,
    WatchlistUpdate,
    # User profile models
    UserProfileBase,
    UserProfileCreate,
    UserProfileUpdate,
    # Analytics models
    PerformanceQuery,
    # Dividend models
    DividendEdit,
    DividendConfirm,
    # Currency models
    CurrencyConvert,
    # Search models
    SymbolSearch,
    # Price alert models
    PriceAlertCreate,
    PriceAlertUpdate,
)

from .response_models import (
    # Generic response models
    APIResponse,
    ErrorDetail,
    ErrorResponse,
    # Common response types
    SuccessResponse,
    ListResponse,
    EmptyResponse,
    # Pagination models
    PaginationMetadata,
    PaginatedResponse,
)

__all__ = [
    # Validation models
    "TransactionBase",
    "TransactionCreate",
    "TransactionUpdate",
    "WatchlistBase",
    "WatchlistAdd",
    "WatchlistUpdate",
    "UserProfileBase",
    "UserProfileCreate",
    "UserProfileUpdate",
    "PerformanceQuery",
    "DividendEdit",
    "DividendConfirm",
    "CurrencyConvert",
    "SymbolSearch",
    "PriceAlertCreate",
    "PriceAlertUpdate",
    # Response models
    "APIResponse",
    "ErrorDetail",
    "ErrorResponse",
    "SuccessResponse",
    "ListResponse",
    "EmptyResponse",
    "PaginationMetadata",
    "PaginatedResponse",
]