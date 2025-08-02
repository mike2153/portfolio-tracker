"""
Decimal-safe JSON encoder for financial data.
Automatically converts Decimal to float during JSON serialization.
"""
import json
from decimal import Decimal
from typing import Any
import logging

logger = logging.getLogger(__name__)


class DecimalSafeJSONEncoder(json.JSONEncoder):
    """JSON encoder that safely handles Decimal types for financial data."""
    
    def default(self, obj: Any) -> Any:
        """Convert Decimal to string to preserve precision."""
        if isinstance(obj, Decimal):
            # Convert to string to preserve full precision
            return str(obj)
        return super().default(obj)


def decimal_safe_dumps(obj: Any, **kwargs) -> str:
    """
    Serialize obj to JSON string, handling Decimal types.
    
    Usage:
        data = {"price": Decimal("123.45"), "quantity": Decimal("10")}
        json_str = decimal_safe_dumps(data)
    """
    kwargs['cls'] = DecimalSafeJSONEncoder
    return json.dumps(obj, **kwargs)


def convert_decimals_to_string(obj: Any) -> Any:
    """
    Recursively convert Decimal objects to string to preserve precision.
    
    This is the new preferred method for API responses to maintain financial precision.
    
    Args:
        obj: Any object that may contain Decimal values
        
    Returns:
        Object with all Decimal values converted to string
        
    Usage:
        data = {"price": Decimal("123.456789"), "quantity": Decimal("10")}
        clean_data = convert_decimals_to_string(data)
        # Result: {"price": "123.456789", "quantity": "10"}
    """
    if isinstance(obj, Decimal):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_decimals_to_string(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals_to_string(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_decimals_to_string(item) for item in obj)
    else:
        return obj


def convert_decimals_to_float(obj: Any) -> Any:
    """
    DEPRECATED: Use convert_decimals_to_string() instead to preserve precision.
    
    Recursively convert Decimal objects to float for external API compatibility.
    WARNING: This function causes precision loss and should only be used for 
    external APIs that require numeric types (like Supabase inserts).
    
    Args:
        obj: Any object that may contain Decimal values
        
    Returns:
        Object with all Decimal values converted to float
        
    Usage:
        data = {"price": Decimal("123.45"), "quantity": Decimal("10")}
        clean_data = convert_decimals_to_float(data)
        # Result: {"price": 123.45, "quantity": 10.0}
    """
    logger.warning("convert_decimals_to_float() used - consider convert_decimals_to_string() for precision")
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {key: convert_decimals_to_float(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals_to_float(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_decimals_to_float(item) for item in obj)
    else:
        return obj


# Usage note for FastAPI:
# In your FastAPI app, you can set this as the default JSON encoder:
#
# from fastapi.responses import JSONResponse
# 
# class DecimalSafeJSONResponse(JSONResponse):
#     def render(self, content: Any) -> bytes:
#         return decimal_safe_dumps(content).encode('utf-8')
#
# Then use it in your routes:
# @router.get("/", response_class=DecimalSafeJSONResponse)