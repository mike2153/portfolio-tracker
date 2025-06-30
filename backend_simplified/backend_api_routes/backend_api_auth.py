"""
Backend API routes for authentication
Note: Login/signup is handled by Supabase on the frontend
These endpoints are for user info and token validation
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
import logging

from debug_logger import DebugLogger
from supa_api.supa_api_auth import require_authenticated_user, get_current_user

logger = logging.getLogger(__name__)

# Create router
auth_router = APIRouter()

@auth_router.get("/user")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_USER")
async def backend_api_get_current_user(
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """Get current authenticated user info"""
    logger.info(f"[backend_api_auth.py::backend_api_get_current_user] User info requested for: {user['email']}")
    
    return {
        "id": user["id"],
        "email": user["email"],
        "created_at": user.get("created_at", ""),
        "authenticated": True
    }

@auth_router.get("/validate")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="VALIDATE_TOKEN")
async def backend_api_validate_token(
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Validate if token is valid (doesn't require auth)"""
    if user:
        logger.info(f"[backend_api_auth.py::backend_api_validate_token] Valid token for: {user['email']}")
        return {
            "valid": True,
            "user_id": user["id"],
            "email": user["email"]
        }
    else:
        logger.info("[backend_api_auth.py::backend_api_validate_token] Invalid or missing token")
        return {
            "valid": False,
            "user_id": None,
            "email": None
        } 