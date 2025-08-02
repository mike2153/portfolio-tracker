"""
Backend‑API routes for dashboard & performance endpoints.
A rewired, cache‑aware, RLS‑compatible implementation.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, date
from typing import Any, Dict, List, Tuple, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Header

from debug_logger import DebugLogger, LoggingConfig
from supa_api.supa_api_auth import require_authenticated_user
from supa_api.supa_api_transactions import supa_api_get_transaction_summary
from services.price_manager import price_manager
from services.portfolio_calculator import portfolio_calculator
from services.portfolio_metrics_manager import portfolio_metrics_manager
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from utils.response_factory import ResponseFactory
from models.response_models import APIResponse
from utils.task_utils import create_safe_background_task 

logger = logging.getLogger(__name__)

dashboard_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

class _AuthContext(Tuple[str, str]):
    """Tiny helper for (user_id, jwt)."""

    @property
    def user_id(self) -> str:  # noqa: D401 – property, not function.
        return self[0]

    @property
    def jwt(self) -> str:
        return self[1]


def _assert_jwt(user: Dict[str, Any]) -> _AuthContext:  # pragma: no cover
    """Extract and validate the caller's JWT for Supabase RLS access."""
    token: Optional[str] = user.get("access_token")
    uid: str = user["id"]

    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")

    return _AuthContext((uid, token))


# ---------------------------------------------------------------------------
# /dashboard  –  consolidated snapshot
# ---------------------------------------------------------------------------

# REMOVED: /api/dashboard endpoint - replaced by /api/portfolio/complete

# ---------------------------------------------------------------------------
# /dashboard/performance – time-series comparison
# ---------------------------------------------------------------------------

# REMOVED: /api/dashboard/performance endpoint - replaced by consolidated endpoint performance data

@dashboard_router.post("/debug/toggle-info-logging")
async def toggle_info_logging(current_user: dict = Depends(require_authenticated_user)) -> Dict[str, Any]:
    """
    Toggle info logging on/off at runtime
    Requires authentication for security
    """
    try:
        new_state = LoggingConfig.toggle_info_logging()
        return {
            "success": True,
            "info_logging_enabled": new_state,
            "message": f"Info logging {'enabled' if new_state else 'disabled'}"
        }
    except Exception as e:
        logger.error(f"❌ Error toggling info logging: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@dashboard_router.get("/debug/logging-status")
async def get_logging_status(current_user: dict = Depends(require_authenticated_user)) -> Dict[str, Any]:
    """
    Get current logging configuration status
    """
    return {
        "info_logging_enabled": LoggingConfig.is_info_enabled()
    }

@dashboard_router.post("/debug/reset-circuit-breaker")
async def reset_circuit_breaker(
    service: Optional[str] = Query(None, description="Service name (alpha_vantage, dividend_api) or None for all"),
    current_user: dict = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Reset circuit breaker for price services
    Useful when the circuit breaker is blocking API calls after failures
    """
    try:
        from services.price_manager import price_manager
        price_manager.reset_circuit_breaker(service)
        
        return {
            "success": True,
            "message": f"Circuit breaker reset for {service if service else 'all services'}"
        }
    except Exception as e:
        logger.error(f"Error resetting circuit breaker: {e}")
        return {
            "success": False,
            "error": str(e)
        }

