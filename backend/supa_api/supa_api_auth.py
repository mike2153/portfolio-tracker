"""
Supabase authentication helpers
Handles user validation and JWT token verification
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import logging

from .supa_api_client import supa_api_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

# Security scheme for JWT Bearer tokens
security = HTTPBearer(auto_error=False)

async def require_authenticated_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
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
    
    if not credentials:
        logger.warning("[supa_api_auth.py::require_authenticated_user] No Authorization credentials provided.")
        logger.info(f"[supa_api_auth.py::require_authenticated_user] === AUTHENTICATION CHECK END (NO CREDENTIALS) ===")
        raise HTTPException(status_code=401, detail="No credentials provided")
    
    token = credentials.credentials
  
    # Debug: Check token structure
    token_parts = token.split('.')
  
    if len(token_parts) != 3:
        logger.error(f"[supa_api_auth.py::require_authenticated_user] Invalid JWT structure - expected 3 parts, got {len(token_parts)}")
        logger.error(f"[supa_api_auth.py::require_authenticated_user] Token preview: {token[:100]}...")
        # Check if it might be a different format
        if token.startswith('sbp_'):
            logger.error("[supa_api_auth.py::require_authenticated_user] This looks like a Supabase service key, not a JWT!")
        raise HTTPException(
            status_code=401, 
            detail=f"Invalid JWT format - expected 3 parts (header.payload.signature), got {len(token_parts)}"
        )
    
    try:
        
        # Validate the token with Supabase
    
        user_response = supa_api_client.client.auth.get_user(token)
        
        if user_response and user_response.user:
            user_data = user_response.user.dict()
            user_data["access_token"] = token
            return user_data
        else:
            logger.warning("[supa_api_auth.py::require_authenticated_user] ❌ Token validation failed.")
            logger.info(f"[supa_api_auth.py::require_authenticated_user] === AUTHENTICATION CHECK END (INVALID TOKEN) ===")
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    except Exception as e:
        logger.error(f"[supa_api_auth.py::require_authenticated_user] Auth error: {type(e).__name__}: {str(e)}")
        logger.info(f"[supa_api_auth.py::require_authenticated_user] === AUTHENTICATION CHECK END (ERROR) ===")
        DebugLogger.log_error(
            file_name="supa_api_auth.py",
            function_name="require_authenticated_user",
            error=e,
            token_present=bool(token)
        )
        raise HTTPException(status_code=401, detail=f"Authentication error: {e}")

# Helper functions for checking user permissions
# UNUSED FUNCTION - TO BE DELETED
# def check_user_owns_resource(user_id: str, resource_user_id: str) -> bool:
#     """Check if user owns a resource"""
#     owns = user_id == resource_user_id
#     logger.info(f"[supa_api_auth.py::check_user_owns_resource] User {user_id} owns resource: {owns}")
#     return owns 