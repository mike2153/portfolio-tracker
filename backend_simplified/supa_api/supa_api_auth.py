"""
Supabase authentication helpers
Handles user validation and JWT token verification
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import logging

from .supa_api_client import validate_user_token
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

# Security scheme for JWT Bearer tokens
security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    """
    Get current user from JWT token
    Returns None if no valid token (allows anonymous access)
    """
    if not credentials:
        logger.info("[supa_api_auth.py::get_current_user] No authentication credentials provided")
        return None
    
    logger.info(f"""
========== AUTH CHECK ==========
FILE: supa_api_auth.py
FUNCTION: get_current_user
API: SUPABASE
TOKEN_PREFIX: {credentials.credentials[:20]}...
================================""")
    
    try:
        # Validate token with Supabase
        user = validate_user_token(credentials.credentials)
        
        if user:
            logger.info(f"[supa_api_auth.py::get_current_user] Authenticated user: {user['email']}")
            return user
        else:
            logger.warning("[supa_api_auth.py::get_current_user] Invalid token provided")
            return None
            
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_auth.py",
            function_name="get_current_user",
            error=e
        )
        return None

async def require_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Require authenticated user (raises 401 if not authenticated)
    Use this for protected endpoints
    """
    if not credentials:
        logger.warning("[supa_api_auth.py::require_authenticated_user] No credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user = validate_user_token(credentials.credentials)
    
    if not user:
        logger.warning("[supa_api_auth.py::require_authenticated_user] Invalid token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    logger.info(f"[supa_api_auth.py::require_authenticated_user] Authenticated user: {user['email']}")
    return user

# Helper functions for checking user permissions
def check_user_owns_resource(user_id: str, resource_user_id: str) -> bool:
    """Check if user owns a resource"""
    owns = user_id == resource_user_id
    logger.info(f"[supa_api_auth.py::check_user_owns_resource] User {user_id} owns resource: {owns}")
    return owns 