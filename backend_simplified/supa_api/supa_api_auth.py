"""
Supabase authentication helpers
Handles user validation and JWT token verification
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import logging

from .supa_api_client import supa_api_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

# Security scheme for JWT Bearer tokens
security = HTTPBearer(auto_error=False)

async def require_authenticated_user(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency to protect routes by requiring a valid Supabase JWT.
    Extracts user data from the token.
    """
    DebugLogger.log_api_call(
        api_name="AUTH_MIDDLEWARE",
        sender="CLIENT",
        receiver="BACKEND",
        operation="REQUIRE_AUTH"
    )
    
    # Log all incoming headers for debugging
    incoming_headers = dict(request.headers)
    logger.info(f"[supa_api_auth.py::require_authenticated_user] ========== HEADERS RECEIVED ==========")
    for key, value in incoming_headers.items():
        logger.info(f"[supa_api_auth.py::require_authenticated_user] Header: {key} = {value}")
    logger.info(f"[supa_api_auth.py::require_authenticated_user] =====================================")

    token = None
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            logger.warning("[supa_api_auth.py::require_authenticated_user] No Authorization header provided.")
            raise HTTPException(status_code=401, detail="No credentials provided")
        
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            logger.warning(f"[supa_api_auth.py::require_authenticated_user] Invalid Authorization header format: {auth_header}")
            raise HTTPException(status_code=401, detail="Invalid token format")
            
        token = parts[1]
        
        # Validate the token with Supabase
        logger.info(f"[supa_api_auth.py::require_authenticated_user] Validating token...")
        user_response = supa_api_client.client.auth.get_user(token)
        
        if user_response and user_response.user:
            user_data = user_response.user.dict()
            user_data["access_token"] = token
            logger.info(f"[supa_api_auth.py::require_authenticated_user] ✅ Token validated for user: {user_data.get('email')}")
            logger.info(f"[supa_api_auth.py::require_authenticated_user] 🔐 Access token included for RLS support")
            return user_data
        else:
            logger.warning("[supa_api_auth.py::require_authenticated_user] ❌ Token validation failed.")
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_auth.py",
            function_name="require_authenticated_user",
            error=e,
            token_present=bool(token)
        )
        raise HTTPException(status_code=401, detail=f"Authentication error: {e}")

# Helper functions for checking user permissions
def check_user_owns_resource(user_id: str, resource_user_id: str) -> bool:
    """Check if user owns a resource"""
    owns = user_id == resource_user_id
    logger.info(f"[supa_api_auth.py::check_user_owns_resource] User {user_id} owns resource: {owns}")
    return owns 