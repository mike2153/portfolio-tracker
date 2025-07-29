"""
Centralized Pydantic validation models for all API endpoints.
Ensures type safety, input validation, and security across the application.
Compatible with Pydantic v2.
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Literal, Any
from decimal import Decimal
from datetime import date, datetime
import re


# Base configuration for all models
class StrictModel(BaseModel):
    """Base model with strict validation settings."""
    model_config = ConfigDict(
        extra="forbid",  # Prevent mass assignment
        validate_assignment=True,
        use_enum_values=True,
        json_encoders={
            Decimal: lambda v: float(v),  # Convert Decimal to float for JSON
            date: lambda v: v.isoformat(),
            datetime: lambda v: v.isoformat()
        }
    )


# ===== Transaction Models =====

class TransactionBase(StrictModel):
    """Base transaction validation."""
    symbol: str = Field(..., min_length=1, max_length=8)
    transaction_type: Literal["Buy", "Sell"]
    quantity: Decimal = Field(..., gt=0, description="Must be positive")
    price: Decimal = Field(..., ge=0, description="Must be non-negative")
    commission: Decimal = Field(default=Decimal("0"), ge=0, description="Must be non-negative")
    currency: str = Field(default="USD", min_length=3, max_length=3, description="Transaction currency")
    exchange_rate: Decimal = Field(default=Decimal("1.0"), gt=0, description="Exchange rate to base currency")
    date: date
    notes: Optional[str] = Field(default=None, max_length=500)
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        """Validate and normalize stock symbol."""
        v = v.strip().upper()
        if not re.match(r'^[A-Z0-9.-]{1,8}$', v):
            raise ValueError('Symbol must contain only letters, numbers, dots, and hyphens')
        return v
    
    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Validate and normalize currency code."""
        v = v.strip().upper()
        if not re.match(r'^[A-Z]{3}$', v):
            raise ValueError('Currency must be a 3-letter ISO code')
        return v
    
    @field_validator('date')
    @classmethod
    def validate_date(cls, v: date) -> date:
        """Ensure date is not in the future and not too old."""
        if v > date.today():
            raise ValueError('Transaction date cannot be in the future')
        if v < date(1970, 1, 1):
            raise ValueError('Transaction date is too old')
        return v
    
    @field_validator('notes')
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        """Remove potentially dangerous characters from notes."""
        if v:
            # Remove any HTML/script tags and dangerous characters
            v = re.sub(r'[<>\"\'&]', '', v)
            v = v.strip()
        return v if v else None


class TransactionCreate(TransactionBase):
    """Model for creating a new transaction."""
    pass


class TransactionUpdate(TransactionBase):
    """Model for updating an existing transaction."""
    pass


# ===== Watchlist Models =====

class WatchlistBase(StrictModel):
    """Base watchlist validation."""
    symbol: str = Field(..., min_length=1, max_length=8)
    target_price: Optional[Decimal] = Field(default=None, gt=0)
    notes: Optional[str] = Field(default=None, max_length=500)
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        """Validate and normalize stock symbol."""
        v = v.strip().upper()
        if not re.match(r'^[A-Z0-9.-]{1,8}$', v):
            raise ValueError('Symbol must contain only letters, numbers, dots, and hyphens')
        return v
    
    @field_validator('notes')
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        """Remove potentially dangerous characters from notes."""
        if v:
            v = re.sub(r'[<>\"\'&]', '', v)
            v = v.strip()
        return v if v else None


class WatchlistAdd(WatchlistBase):
    """Model for adding to watchlist."""
    pass


class WatchlistUpdate(StrictModel):
    """Model for updating watchlist item."""
    target_price: Optional[Decimal] = Field(default=None, gt=0)
    notes: Optional[str] = Field(default=None, max_length=500)
    
    @field_validator('notes')
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        """Remove potentially dangerous characters from notes."""
        if v:
            v = re.sub(r'[<>\"\'&]', '', v)
            v = v.strip()
        return v if v else None


# ===== User Profile Models =====

class UserProfileBase(StrictModel):
    """Base user profile validation."""
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    country: Optional[str] = Field(default=None, min_length=2, max_length=2)
    base_currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    
    @field_validator('first_name', 'last_name')
    @classmethod
    def sanitize_name(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize name to prevent XSS."""
        if v:
            # Allow only letters, spaces, hyphens, and apostrophes
            v = re.sub(r'[^a-zA-Z\s\-\']', '', v)
            v = ' '.join(v.split())  # Normalize whitespace
        return v if v else None
    
    @field_validator('country')
    @classmethod
    def validate_country(cls, v: Optional[str]) -> Optional[str]:
        """Validate country code."""
        if v:
            v = v.strip().upper()
            if not re.match(r'^[A-Z]{2}$', v):
                raise ValueError('Country must be a 2-letter ISO code')
        return v
    
    @field_validator('base_currency')
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        """Validate currency code."""
        if v:
            v = v.strip().upper()
            if not re.match(r'^[A-Z]{3}$', v):
                raise ValueError('Currency must be a 3-letter ISO code')
        return v


class UserProfileCreate(UserProfileBase):
    """Model for creating user profile."""
    pass


class UserProfileUpdate(UserProfileBase):
    """Model for updating user profile."""
    pass


# ===== Analytics/Performance Models =====

class PerformanceQuery(StrictModel):
    """Model for performance query parameters."""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    benchmark: str = Field(default="SPY", pattern=r"^[A-Z]{1,5}$")
    
    @field_validator('end_date')
    @classmethod
    def validate_date_range(cls, v: Optional[date], info: Any) -> Optional[date]:
        """Ensure end_date is after start_date."""
        if 'start_date' in info.data:
            start = info.data['start_date']
            if start and v and v < start:
                raise ValueError('End date must be after start date')
        if v and v > date.today():
            raise ValueError('End date cannot be in the future')
        return v


# ===== Dividend Models =====

class DividendEdit(StrictModel):
    """Model for editing dividend data."""
    symbol: str = Field(..., pattern=r"^[A-Z]{1,8}$")
    amount: Decimal = Field(..., gt=0)
    ex_date: date
    payment_date: Optional[date] = None
    
    @field_validator('symbol')
    @classmethod
    def uppercase_symbol(cls, v: str) -> str:
        """Ensure symbol is uppercase."""
        return v.strip().upper()
    
    @field_validator('payment_date')
    @classmethod
    def validate_payment_date(cls, v: Optional[date], info: Any) -> Optional[date]:
        """Ensure payment date is after ex-date."""
        if 'ex_date' in info.data:
            ex_date = info.data['ex_date']
            if ex_date and v and v < ex_date:
                raise ValueError('Payment date must be after ex-dividend date')
        return v


class DividendConfirm(StrictModel):
    """Model for confirming dividend."""
    dividend_id: str = Field(..., min_length=1)
    shares_on_ex_date: Decimal = Field(..., ge=0)
    amount_received: Decimal = Field(..., ge=0)


# ===== Currency/Forex Models =====

class CurrencyConvert(StrictModel):
    """Model for currency conversion."""
    from_currency: str = Field(..., pattern=r"^[A-Z]{3}$")
    to_currency: str = Field(..., pattern=r"^[A-Z]{3}$")
    amount: Decimal = Field(..., gt=0)
    
    @field_validator('from_currency', 'to_currency')
    @classmethod
    def uppercase_currency(cls, v: str) -> str:
        """Ensure currency codes are uppercase."""
        return v.strip().upper()


# ===== Search Models =====

class SymbolSearch(StrictModel):
    """Model for symbol search."""
    query: str = Field(..., min_length=1, max_length=50)
    
    @field_validator('query')
    @classmethod
    def sanitize_query(cls, v: str) -> str:
        """Sanitize search query."""
        # Remove any special characters that could be used for injection
        v = re.sub(r'[^\w\s.-]', '', v)
        return v.strip()


# ===== Price Alert Models =====

class PriceAlertCreate(StrictModel):
    """Model for creating price alert."""
    symbol: str = Field(..., pattern=r"^[A-Z]{1,8}$")
    target_price: Decimal = Field(..., gt=0)
    condition: Literal["above", "below"]
    
    @field_validator('symbol')
    @classmethod
    def uppercase_symbol(cls, v: str) -> str:
        """Ensure symbol is uppercase."""
        return v.strip().upper()


class PriceAlertUpdate(StrictModel):
    """Model for updating price alert."""
    target_price: Optional[Decimal] = Field(default=None, gt=0)
    condition: Optional[Literal["above", "below"]] = None
    is_active: Optional[bool] = None