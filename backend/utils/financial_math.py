"""
Safe financial mathematics utilities to prevent division by zero and precision errors.
All functions maintain Decimal precision for financial calculations.
"""
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Union, Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Type alias for numeric types that can be converted to Decimal
NumericType = Union[Decimal, float, int, str]


def safe_decimal(value: Optional[NumericType], field_name: str = "value") -> Decimal:
    """
    Safely convert any numeric type to Decimal with validation.
    
    Args:
        value: The value to convert
        field_name: Name of the field for error reporting
        
    Returns:
        Decimal representation of the value
        
    Raises:
        ValueError: If the value cannot be converted to Decimal
    """
    if value is None:
        return Decimal("0")
    
    try:
        if isinstance(value, Decimal):
            return value
        
        # Convert to string first to avoid float precision issues
        decimal_value = Decimal(str(value))
        
        # Check for reasonable financial bounds (1 trillion limit)
        if abs(decimal_value) > Decimal("1e12"):
            logger.warning(f"{field_name} value {decimal_value} exceeds reasonable bounds")
        
        return decimal_value
        
    except (InvalidOperation, ValueError, TypeError) as e:
        logger.error(f"Cannot convert {field_name} '{value}' to Decimal: {e}")
        return Decimal("0")


def safe_divide(
    numerator: NumericType, 
    denominator: NumericType, 
    default: NumericType = Decimal("0"),
    field_name: str = "division"
) -> Decimal:
    """
    Safely divide two numbers, returning default if denominator is zero.
    Always returns Decimal for financial precision.
    
    Args:
        numerator: The dividend
        denominator: The divisor
        default: Value to return if division by zero
        field_name: Name of the operation for logging
        
    Returns:
        Result of division or default value
    """
    try:
        num = safe_decimal(numerator, f"{field_name}_numerator")
        denom = safe_decimal(denominator, f"{field_name}_denominator")
        default_decimal = safe_decimal(default, f"{field_name}_default")
        
        if denom == Decimal("0"):
            logger.debug(f"Division by zero in {field_name}, returning default: {default_decimal}")
            return default_decimal
        
        result = num / denom
        return result.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)  # 6 decimal places
        
    except Exception as e:
        logger.error(f"Error in safe_divide for {field_name}: {e}")
        return safe_decimal(default, f"{field_name}_fallback")


def safe_percentage(
    value: NumericType,
    total: NumericType,
    default: NumericType = Decimal("0"),
    field_name: str = "percentage"
) -> Decimal:
    """
    Safely calculate percentage, handling zero total.
    
    Args:
        value: The value to calculate percentage for
        total: The total value
        default: Default percentage if total is zero
        field_name: Name of the operation for logging
        
    Returns:
        Percentage as Decimal (e.g., 25.50 for 25.5%)
    """
    return safe_divide(value, total, default, field_name) * Decimal("100")


def safe_gain_loss_percent(
    gain_loss: NumericType,
    cost_basis: NumericType,
    field_name: str = "gain_loss_percent"
) -> Decimal:
    """
    Calculate gain/loss percentage with proper zero handling.
    
    Special cases:
    - If both gain_loss and cost_basis are zero: return 0%
    - If cost_basis is zero but gain_loss is positive: return +100%
    - If cost_basis is zero but gain_loss is negative: return -100%
    
    Args:
        gain_loss: The gain or loss amount
        cost_basis: The original cost basis
        field_name: Name of the operation for logging
        
    Returns:
        Gain/loss percentage as Decimal
    """
    try:
        gain_decimal = safe_decimal(gain_loss, f"{field_name}_gain_loss")
        cost_decimal = safe_decimal(cost_basis, f"{field_name}_cost_basis")
        
        # Handle special cases
        if cost_decimal == Decimal("0"):
            if gain_decimal == Decimal("0"):
                return Decimal("0")  # No position, no gain/loss
            elif gain_decimal > Decimal("0"):
                logger.debug(f"Infinite gain for {field_name}: gain={gain_decimal}, cost=0")
                return Decimal("100")  # 100% gain (infinite gain capped)
            else:
                logger.debug(f"Infinite loss for {field_name}: loss={gain_decimal}, cost=0")
                return Decimal("-100")  # 100% loss (infinite loss capped)
        
        return safe_percentage(gain_decimal, cost_decimal, Decimal("0"), field_name)
        
    except Exception as e:
        logger.error(f"Error calculating gain/loss percentage for {field_name}: {e}")
        return Decimal("0")


def safe_multiply(
    a: NumericType,
    b: NumericType,
    field_name: str = "multiplication"
) -> Decimal:
    """
    Safely multiply two values with Decimal precision.
    
    Args:
        a: First value
        b: Second value
        field_name: Name of the operation for logging
        
    Returns:
        Product as Decimal
    """
    try:
        a_decimal = safe_decimal(a, f"{field_name}_a")
        b_decimal = safe_decimal(b, f"{field_name}_b")
        
        result = a_decimal * b_decimal
        return result.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        
    except Exception as e:
        logger.error(f"Error in safe_multiply for {field_name}: {e}")
        return Decimal("0")


def safe_add(
    a: NumericType,
    b: NumericType,
    field_name: str = "addition"
) -> Decimal:
    """
    Safely add two values with Decimal precision.
    
    Args:
        a: First value
        b: Second value
        field_name: Name of the operation for logging
        
    Returns:
        Sum as Decimal
    """
    try:
        a_decimal = safe_decimal(a, f"{field_name}_a")
        b_decimal = safe_decimal(b, f"{field_name}_b")
        
        return a_decimal + b_decimal
        
    except Exception as e:
        logger.error(f"Error in safe_add for {field_name}: {e}")
        return Decimal("0")


def safe_subtract(
    a: NumericType,
    b: NumericType,
    field_name: str = "subtraction"
) -> Decimal:
    """
    Safely subtract two values with Decimal precision.
    
    Args:
        a: First value (minuend)
        b: Second value (subtrahend)
        field_name: Name of the operation for logging
        
    Returns:
        Difference as Decimal
    """
    try:
        a_decimal = safe_decimal(a, f"{field_name}_a")
        b_decimal = safe_decimal(b, f"{field_name}_b")
        
        return a_decimal - b_decimal
        
    except Exception as e:
        logger.error(f"Error in safe_subtract for {field_name}: {e}")
        return Decimal("0")


def validate_financial_bounds(
    value: Decimal, 
    min_value: Optional[Decimal] = None,
    max_value: Optional[Decimal] = None,
    field_name: str = "value"
) -> Decimal:
    """
    Validate that a financial value is within reasonable bounds.
    
    Args:
        value: The value to validate
        min_value: Minimum allowed value (optional)
        max_value: Maximum allowed value (optional)
        field_name: Name of the field for logging
        
    Returns:
        The validated value
        
    Raises:
        ValueError: If value is outside bounds
    """
    if min_value is not None and value < min_value:
        raise ValueError(f"{field_name} {value} is below minimum {min_value}")
    
    if max_value is not None and value > max_value:
        raise ValueError(f"{field_name} {value} is above maximum {max_value}")
    
    return value


def calculate_portfolio_metrics(
    holdings: List[Dict[str, Any]],
    total_cost: NumericType,
    total_value: NumericType
) -> Dict[str, Union[Decimal, int]]:
    """
    Calculate comprehensive portfolio metrics with safe math.
    
    Args:
        holdings: List of holding dictionaries
        total_cost: Total cost basis
        total_value: Current total value
        
    Returns:
        Dictionary with calculated metrics
    """
    try:
        cost_decimal = safe_decimal(total_cost, "portfolio_total_cost")
        value_decimal = safe_decimal(total_value, "portfolio_total_value")
        
        gain_loss = safe_subtract(value_decimal, cost_decimal, "portfolio_gain_loss")
        gain_loss_percent = safe_gain_loss_percent(gain_loss, cost_decimal, "portfolio_gain_loss_percent")
        
        return {
            "total_cost": cost_decimal,
            "total_value": value_decimal,
            "total_gain_loss": gain_loss,
            "total_gain_loss_percent": gain_loss_percent,
            "number_of_holdings": len(holdings)
        }
        
    except Exception as e:
        logger.error(f"Error calculating portfolio metrics: {e}")
        return {
            "total_cost": Decimal("0"),
            "total_value": Decimal("0"),
            "total_gain_loss": Decimal("0"),
            "total_gain_loss_percent": Decimal("0"),
            "number_of_holdings": 0
        }