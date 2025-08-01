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
        """Convert Decimal to float, let parent handle other types."""
        if isinstance(obj, Decimal):
            # Log large precision loss if any
            float_val = float(obj)
            if abs(obj - Decimal(str(float_val))) > Decimal('0.01'):
                logger.warning(f"Precision loss in JSON serialization: {obj} -> {float_val}")
            return float_val
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