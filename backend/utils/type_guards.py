"""
Type guard functions for runtime type safety validation.
Implements strict type checking as required by CLAUDE.md.
"""
from typing import Any, TypeGuard, Union, Dict, List, Optional
from decimal import Decimal, InvalidOperation
from datetime import date, datetime
import re
import logging

logger = logging.getLogger(__name__)

# UUID pattern for Supabase user IDs
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

def is_valid_user_id(value: Any) -> TypeGuard[str]:
    """
    Type guard to ensure value is a valid user ID.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a valid UUID string
    """
    return (
        isinstance(value, str) 
        and len(value.strip()) > 0 
        and UUID_PATTERN.match(value.strip()) is not None
    )

def is_valid_decimal(value: Any) -> TypeGuard[Decimal]:
    """
    Type guard to ensure value is a valid Decimal.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a Decimal or can be converted to one
    """
    if isinstance(value, Decimal):
        return True
    
    try:
        Decimal(str(value))
        return True
    except (ValueError, TypeError, InvalidOperation):
        return False

def is_valid_symbol(value: Any) -> TypeGuard[str]:
    """
    Type guard to ensure value is a valid stock symbol.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a valid stock symbol format
    """
    return (
        isinstance(value, str) 
        and len(value.strip()) > 0 
        and value.strip().isalpha() 
        and len(value.strip()) <= 10
        and value.strip().isupper()
    )

def is_valid_transaction_type(value: Any) -> TypeGuard[str]:
    """
    Type guard for transaction types.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a valid transaction type
    """
    valid_types = {"buy", "sell", "dividend", "split", "merger"}
    return isinstance(value, str) and value.lower() in valid_types

def is_valid_currency_code(value: Any) -> TypeGuard[str]:
    """
    Type guard for currency codes.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a valid 3-letter currency code
    """
    return (
        isinstance(value, str)
        and len(value) == 3
        and value.isalpha()
        and value.isupper()
    )

def is_non_empty_string(value: Any) -> TypeGuard[str]:
    """
    Type guard for non-empty strings.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a non-empty string
    """
    return isinstance(value, str) and len(value.strip()) > 0

def is_positive_decimal(value: Any) -> TypeGuard[Decimal]:
    """
    Type guard for positive Decimal values.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a positive Decimal
    """
    if not is_valid_decimal(value):
        return False
    
    decimal_value = Decimal(str(value)) if not isinstance(value, Decimal) else value
    return decimal_value > Decimal("0")

def is_non_negative_decimal(value: Any) -> TypeGuard[Decimal]:
    """
    Type guard for non-negative Decimal values.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a non-negative Decimal
    """
    if not is_valid_decimal(value):
        return False
    
    decimal_value = Decimal(str(value)) if not isinstance(value, Decimal) else value
    return decimal_value >= Decimal("0")

def is_valid_date(value: Any) -> TypeGuard[date]:
    """
    Type guard for date objects.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a valid date
    """
    return isinstance(value, date)

def is_valid_datetime(value: Any) -> TypeGuard[datetime]:
    """
    Type guard for datetime objects.
    
    Args:
        value: Value to check
        
    Returns:
        True if value is a valid datetime
    """
    return isinstance(value, datetime)

def is_valid_portfolio_data(value: Any) -> TypeGuard[Dict[str, Any]]:
    """
    Type guard for portfolio data structure.
    
    Args:
        value: Value to check
        
    Returns:
        True if value has required portfolio data fields
    """
    if not isinstance(value, dict):
        return False
    
    required_fields = {"holdings", "total_value", "total_cost", "total_gain_loss"}
    return all(field in value for field in required_fields)

def is_valid_holding_data(value: Any) -> TypeGuard[Dict[str, Any]]:
    """
    Type guard for individual holding data.
    
    Args:
        value: Value to check
        
    Returns:
        True if value has required holding fields
    """
    if not isinstance(value, dict):
        return False
    
    required_fields = {"symbol", "quantity", "avg_cost", "current_price", "current_value"}
    return all(field in value for field in required_fields)

def ensure_user_id(value: Any, field_name: str = "user_id") -> str:
    """
    Ensure value is a valid user ID, raise TypeError if not.
    
    Args:
        value: Value to validate
        field_name: Name of the field for error reporting
        
    Returns:
        Valid user ID string
        
    Raises:
        TypeError: If value is not a valid user ID
    """
    if not is_valid_user_id(value):
        raise TypeError(
            f"{field_name} must be a valid UUID string, got {type(value).__name__}: {value}"
        )
    return value.strip()

def ensure_decimal(value: Any, field_name: str = "value") -> Decimal:
    """
    Ensure value can be converted to Decimal, raise TypeError if not.
    
    Args:
        value: Value to convert
        field_name: Name of the field for error reporting
        
    Returns:
        Decimal representation of the value
        
    Raises:
        TypeError: If value cannot be converted to Decimal
    """
    if not is_valid_decimal(value):
        raise TypeError(
            f"{field_name} must be convertible to Decimal, got {type(value).__name__}: {value}"
        )
    
    if isinstance(value, Decimal):
        return value
    
    try:
        return Decimal(str(value))
    except (ValueError, InvalidOperation) as e:
        raise TypeError(f"{field_name} conversion to Decimal failed: {e}")

def ensure_positive_decimal(value: Any, field_name: str = "value") -> Decimal:
    """
    Ensure value is a positive Decimal, raise ValueError if not.
    
    Args:
        value: Value to validate
        field_name: Name of the field for error reporting
        
    Returns:
        Positive Decimal value
        
    Raises:
        TypeError: If value cannot be converted to Decimal
        ValueError: If value is not positive
    """
    decimal_value = ensure_decimal(value, field_name)
    
    if decimal_value <= Decimal("0"):
        raise ValueError(f"{field_name} must be positive, got {decimal_value}")
    
    return decimal_value

def ensure_non_negative_decimal(value: Any, field_name: str = "value") -> Decimal:
    """
    Ensure value is a non-negative Decimal, raise ValueError if not.
    
    Args:
        value: Value to validate
        field_name: Name of the field for error reporting
        
    Returns:
        Non-negative Decimal value
        
    Raises:
        TypeError: If value cannot be converted to Decimal
        ValueError: If value is negative
    """
    decimal_value = ensure_decimal(value, field_name)
    
    if decimal_value < Decimal("0"):
        raise ValueError(f"{field_name} must be non-negative, got {decimal_value}")
    
    return decimal_value

def ensure_symbol(value: Any, field_name: str = "symbol") -> str:
    """
    Ensure value is a valid stock symbol, raise TypeError if not.
    
    Args:
        value: Value to validate
        field_name: Name of the field for error reporting
        
    Returns:
        Valid symbol string
        
    Raises:
        TypeError: If value is not a valid symbol
    """
    if not is_valid_symbol(value):
        raise TypeError(
            f"{field_name} must be a valid stock symbol (1-10 uppercase letters), got {type(value).__name__}: {value}"
        )
    
    return value.strip().upper()

def ensure_transaction_type(value: Any, field_name: str = "transaction_type") -> str:
    """
    Ensure value is a valid transaction type, raise TypeError if not.
    
    Args:
        value: Value to validate
        field_name: Name of the field for error reporting
        
    Returns:
        Valid transaction type string
        
    Raises:
        TypeError: If value is not a valid transaction type
    """
    if not is_valid_transaction_type(value):
        raise TypeError(
            f"{field_name} must be a valid transaction type (buy, sell, dividend, split, merger), got {type(value).__name__}: {value}"
        )
    
    return value.lower()

def validate_financial_calculation_inputs(
    *args: Any,
    field_names: Optional[List[str]] = None
) -> List[Decimal]:
    """
    Validate multiple inputs for financial calculations.
    
    Args:
        *args: Values to validate
        field_names: Optional field names for error reporting
        
    Returns:
        List of validated Decimal values
        
    Raises:
        TypeError: If any value cannot be converted to Decimal
    """
    if field_names is None:
        field_names = [f"arg_{i}" for i in range(len(args))]
    
    if len(field_names) != len(args):
        raise ValueError("Number of field names must match number of arguments")
    
    validated_values = []
    for value, field_name in zip(args, field_names):
        validated_values.append(ensure_decimal(value, field_name))
    
    return validated_values

def log_type_validation_error(error: Exception, context: str) -> None:
    """
    Log type validation errors with context.
    
    Args:
        error: The validation error
        context: Context where the error occurred
    """
    logger.error(f"Type validation error in {context}: {type(error).__name__}: {error}")