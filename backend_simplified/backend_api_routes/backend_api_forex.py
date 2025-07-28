"""
Backend API routes for forex/currency exchange
Handles exchange rate fetching and currency conversions
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, Optional
from datetime import date, datetime
import logging
from decimal import Decimal

from backend_api_routes.backend_api_auth import get_current_user
from utils.auth_helpers import extract_user_credentials
from services.forex_manager import ForexManager
from supa_api.supa_api_client import get_supa_service_client
import os

logger = logging.getLogger(__name__)

# Create router
forex_router = APIRouter()

# Initialize ForexManager
_forex_manager: Optional[ForexManager] = None

def get_forex_manager() -> ForexManager:
    """Get or create ForexManager instance"""
    global _forex_manager
    if _forex_manager is None:
        alpha_vantage_key = os.getenv("ALPHA_VANTAGE_API_KEY", "")
        supabase_client = get_supa_service_client()
        _forex_manager = ForexManager(supabase_client, alpha_vantage_key)
    return _forex_manager


@forex_router.get("/forex/rate")
async def get_exchange_rate(
    from_currency: str = Query(..., description="Source currency code (e.g., USD)"),
    to_currency: str = Query(..., description="Target currency code (e.g., EUR)"),
    date: Optional[str] = Query(None, description="Date for historical rate (YYYY-MM-DD)"),
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get exchange rate between two currencies
    
    Args:
        from_currency: Source currency code
        to_currency: Target currency code  
        date: Optional date for historical rate
        
    Returns:
        Exchange rate information
    """
    try:
        # Validate currency codes
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()
        
        if len(from_currency) != 3 or len(to_currency) != 3:
            raise HTTPException(status_code=400, detail="Currency codes must be 3 letters")
        
        # Parse date or use today
        if date:
            try:
                rate_date = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            rate_date = datetime.now().date()
            
        # Get forex manager
        forex_manager = get_forex_manager()
        
        # Get exchange rate
        rate = await forex_manager.get_exchange_rate(
            from_currency=from_currency,
            to_currency=to_currency,
            target_date=rate_date
        )
        
        return {
            "success": True,
            "from_currency": from_currency,
            "to_currency": to_currency,
            "date": rate_date.isoformat(),
            "rate": float(rate),
            "inverse_rate": float(Decimal("1") / rate) if rate > 0 else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching exchange rate: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch exchange rate: {str(e)}")


@forex_router.get("/forex/latest")
async def get_latest_exchange_rate(
    from_currency: str = Query(..., description="Source currency code"),
    to_currency: str = Query(..., description="Target currency code"),
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get latest available exchange rate between two currencies
    
    Args:
        from_currency: Source currency code
        to_currency: Target currency code
        
    Returns:
        Latest exchange rate information
    """
    try:
        # Validate currency codes
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()
        
        if len(from_currency) != 3 or len(to_currency) != 3:
            raise HTTPException(status_code=400, detail="Currency codes must be 3 letters")
            
        # Get forex manager
        forex_manager = get_forex_manager()
        
        # Get latest rate
        rate = await forex_manager.get_latest_rate(
            from_currency=from_currency,
            to_currency=to_currency
        )
        
        return {
            "success": True,
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": float(rate),
            "inverse_rate": float(Decimal("1") / rate) if rate > 0 else 0,
            "is_fallback": rate == forex_manager._get_fallback_rate(from_currency, to_currency)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching latest exchange rate: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch latest exchange rate: {str(e)}")


@forex_router.post("/forex/convert")
async def convert_currency(
    amount: float = Query(..., description="Amount to convert"),
    from_currency: str = Query(..., description="Source currency code"),
    to_currency: str = Query(..., description="Target currency code"),
    date: Optional[str] = Query(None, description="Date for historical rate (YYYY-MM-DD)"),
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Convert an amount from one currency to another
    
    Args:
        amount: Amount to convert
        from_currency: Source currency code
        to_currency: Target currency code
        date: Optional date for historical rate
        
    Returns:
        Conversion result
    """
    try:
        # Validate inputs
        if amount < 0:
            raise HTTPException(status_code=400, detail="Amount must be positive")
            
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()
        
        if len(from_currency) != 3 or len(to_currency) != 3:
            raise HTTPException(status_code=400, detail="Currency codes must be 3 letters")
        
        # Parse date or use today
        if date:
            try:
                rate_date = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            rate_date = datetime.now().date()
            
        # Get forex manager
        forex_manager = get_forex_manager()
        
        # Get exchange rate
        rate = await forex_manager.get_exchange_rate(
            from_currency=from_currency,
            to_currency=to_currency,
            target_date=rate_date
        )
        
        # Convert amount
        amount_decimal = Decimal(str(amount))
        converted_amount = amount_decimal * rate
        
        return {
            "success": True,
            "original_amount": amount,
            "converted_amount": float(converted_amount),
            "from_currency": from_currency,
            "to_currency": to_currency,
            "exchange_rate": float(rate),
            "date": rate_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting currency: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert currency: {str(e)}")