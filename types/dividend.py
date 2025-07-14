# Unified Dividend Data Model
# This file defines the canonical dividend data structure used across the entire application

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import date, datetime
from decimal import Decimal
from enum import Enum


class DividendType(str, Enum):
    """Types of dividends"""
    CASH = "cash"
    STOCK = "stock"
    DRP = "drp"  # Dividend Reinvestment Plan


class DividendSource(str, Enum):
    """Sources of dividend data"""
    ALPHA_VANTAGE = "alpha_vantage"
    MANUAL = "manual"
    BROKER = "broker"


class DividendStatus(str, Enum):
    """Dividend confirmation status"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    EDITED = "edited"


class BaseDividendData(BaseModel):
    """
    Base dividend data model - used for global dividend reference table
    This represents the raw dividend data from external APIs
    """
    symbol: str = Field(..., description="Stock ticker symbol")
    ex_date: date = Field(..., description="Ex-dividend date")
    pay_date: date = Field(..., description="Payment date")
    amount_per_share: Decimal = Field(..., description="Dividend amount per share", ge=0)
    currency: str = Field(default="USD", description="Currency code")
    dividend_type: DividendType = Field(default=DividendType.CASH)
    source: DividendSource = Field(default=DividendSource.ALPHA_VANTAGE)
    
    # Optional dates
    declaration_date: Optional[date] = Field(None, description="Declaration date")
    record_date: Optional[date] = Field(None, description="Record date")
    
    @validator('symbol')
    def validate_symbol(cls, v):
        if not v or len(v) > 10:
            raise ValueError('Symbol must be 1-10 characters')
        return v.upper()
    
    @validator('currency')
    def validate_currency(cls, v):
        if len(v) != 3:
            raise ValueError('Currency must be 3-character code')
        return v.upper()


class UserDividendData(BaseDividendData):
    """
    User-specific dividend data model - extends base with user ownership information
    This is what gets returned to the frontend and represents the complete dividend record
    """
    id: str = Field(..., description="Unique dividend record ID")
    user_id: Optional[str] = Field(None, description="User ID (null for global dividends)")
    
    # User-specific ownership information
    shares_held_at_ex_date: Decimal = Field(..., description="Shares held at ex-dividend date", ge=0)
    current_holdings: Decimal = Field(..., description="Current shares held", ge=0)
    total_amount: Decimal = Field(..., description="Total dividend amount (per_share * shares_held)", ge=0)
    
    # Confirmation status based on transaction existence
    confirmed: bool = Field(..., description="True if user has confirmed/received dividend")
    status: DividendStatus = Field(default=DividendStatus.PENDING)
    
    # Additional user fields
    company: str = Field(..., description="Human-readable company name")
    notes: Optional[str] = Field(None, description="User notes")
    
    # Computed fields for frontend convenience
    is_future: bool = Field(default=False, description="True if pay_date is in the future")
    is_recent: bool = Field(default=False, description="True if dividend was added recently")
    
    # Metadata
    created_at: datetime = Field(..., description="Record creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    
    @validator('total_amount', always=True)
    def calculate_total_amount(cls, v, values):
        """Ensure total_amount = amount_per_share * shares_held_at_ex_date"""
        if 'amount_per_share' in values and 'shares_held_at_ex_date' in values:
            calculated = values['amount_per_share'] * values['shares_held_at_ex_date']
            return calculated
        return v


class DividendSummary(BaseModel):
    """Dividend summary statistics for analytics"""
    total_received: Decimal = Field(default=0, description="Total dividends received (confirmed)")
    total_pending: Decimal = Field(default=0, description="Total pending dividends")
    ytd_received: Decimal = Field(default=0, description="Year-to-date received")
    confirmed_count: int = Field(default=0, description="Number of confirmed dividends")
    pending_count: int = Field(default=0, description="Number of pending dividends")


class DividendCreateRequest(BaseModel):
    """Request model for creating/updating dividend records"""
    user_id: str
    symbol: str
    ex_date: date
    pay_date: date
    amount_per_share: Decimal
    shares_held_at_ex_date: Decimal
    currency: str = "USD"
    dividend_type: DividendType = DividendType.CASH
    source: DividendSource = DividendSource.ALPHA_VANTAGE


class DividendConfirmRequest(BaseModel):
    """Request model for confirming dividend receipt"""
    dividend_id: str
    edited_amount: Optional[Decimal] = Field(None, description="Override total amount if edited")


class DividendResponse(BaseModel):
    """Standard API response wrapper for dividend operations"""
    success: bool
    data: Optional[UserDividendData] = None
    error: Optional[str] = None
    message: Optional[str] = None


class DividendListResponse(BaseModel):
    """Standard API response for dividend lists"""
    success: bool
    data: list[UserDividendData] = []
    metadata: Dict[str, Any] = {}
    total_count: int = 0
    error: Optional[str] = None


# Utility functions for data transformation

def global_dividend_to_user_dividend(
    global_dividend: BaseDividendData,
    user_id: str,
    shares_held: Decimal,
    current_holdings: Decimal,
    confirmed: bool,
    company_name: str,
    dividend_id: str,
    created_at: datetime,
    updated_at: Optional[datetime] = None
) -> UserDividendData:
    """Convert global dividend data to user-specific dividend data"""
    return UserDividendData(
        id=dividend_id,
        user_id=user_id,
        symbol=global_dividend.symbol,
        ex_date=global_dividend.ex_date,
        pay_date=global_dividend.pay_date,
        amount_per_share=global_dividend.amount_per_share,
        currency=global_dividend.currency,
        dividend_type=global_dividend.dividend_type,
        source=global_dividend.source,
        declaration_date=global_dividend.declaration_date,
        record_date=global_dividend.record_date,
        shares_held_at_ex_date=shares_held,
        current_holdings=current_holdings,
        total_amount=global_dividend.amount_per_share * shares_held,
        confirmed=confirmed,
        status=DividendStatus.CONFIRMED if confirmed else DividendStatus.PENDING,
        company=company_name,
        is_future=global_dividend.pay_date > date.today(),
        is_recent=(datetime.now() - created_at).days < 7,
        created_at=created_at,
        updated_at=updated_at
    )


def calculate_dividend_summary(dividends: list[UserDividendData]) -> DividendSummary:
    """Calculate summary statistics from dividend list"""
    current_year = datetime.now().year
    
    confirmed_dividends = [d for d in dividends if d.confirmed]
    pending_dividends = [d for d in dividends if not d.confirmed and d.shares_held_at_ex_date > 0]
    
    total_received = sum(d.total_amount for d in confirmed_dividends)
    total_pending = sum(d.total_amount for d in pending_dividends)
    ytd_received = sum(
        d.total_amount for d in confirmed_dividends 
        if d.pay_date.year == current_year
    )
    
    return DividendSummary(
        total_received=total_received,
        total_pending=total_pending,
        ytd_received=ytd_received,
        confirmed_count=len(confirmed_dividends),
        pending_count=len(pending_dividends)
    )