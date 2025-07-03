"""
JWT Token Injection Helpers for Supabase Operations
Provides utilities to ensure JWT tokens are consistently forwarded for RLS compliance
"""
from typing import Dict, Any, Optional, Callable
from functools import wraps
import logging
from supabase.client import create_client, Client
from config import SUPA_API_URL, SUPA_API_ANON_KEY

logger = logging.getLogger(__name__)

def create_authenticated_client(user_token: str) -> Client:
    """
    Create a Supabase client authenticated with a user's JWT token
    This ensures all operations execute with proper RLS context
    """
    logger.info(f"[supa_api_jwt_helpers] 🔐 Creating authenticated client")
    logger.info(f"[supa_api_jwt_helpers] Token preview: {user_token[:20] + '...' if user_token else 'None'}")
    
    if not user_token:
        raise ValueError("JWT token is required for authenticated operations")
    
    try:
        client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
        client.postgrest.auth(user_token)
        logger.info(f"[supa_api_jwt_helpers] ✅ Authenticated client created successfully")
        return client
    except Exception as e:
        logger.error(f"[supa_api_jwt_helpers] ❌ Failed to create authenticated client: {e}")
        raise

def require_jwt_token(func: Callable) -> Callable:
    """
    Decorator to ensure function receives a valid JWT token
    Use this on functions that require user authentication for RLS
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        user_token = kwargs.get('user_token')
        
        if not user_token:
            function_name = func.__name__
            logger.error(f"[supa_api_jwt_helpers] ❌ JWT token required for {function_name}")
            raise ValueError(f"JWT token is required for {function_name} - RLS enforcement requires authenticated context")
        
        logger.info(f"[supa_api_jwt_helpers] ✅ JWT token validated for {func.__name__}")
        return await func(*args, **kwargs)
    
    return wrapper

def extract_user_token(user: Dict[str, Any]) -> Optional[str]:
    """
    Extract JWT token from authenticated user object
    Standardizes token extraction across all API routes
    """
    user_token = user.get("access_token")
    user_email = user.get("email", "unknown")
    
    logger.info(f"[supa_api_jwt_helpers] Extracting token for user: {user_email}")
    logger.info(f"[supa_api_jwt_helpers] Token present: {bool(user_token)}")
    
    if user_token:
        logger.info(f"[supa_api_jwt_helpers] Token preview: {user_token[:20] + '...'}")
    else:
        logger.warning(f"[supa_api_jwt_helpers] ⚠️ No access token found in user object")
        logger.warning(f"[supa_api_jwt_helpers] Available user keys: {list(user.keys())}")
    
    return user_token

# Future enhancement: Decorator for automatic JWT injection
def auto_inject_jwt(func: Callable) -> Callable:
    """
    Future decorator that could automatically inject JWT tokens
    Currently just a placeholder for potential future enhancement
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # This could be enhanced to automatically extract JWT from request context
        # For now, it just passes through to the original function
        logger.info(f"[supa_api_jwt_helpers] 🔮 Auto-injection wrapper for {func.__name__} (placeholder)")
        return await func(*args, **kwargs)
    
    return wrapper

# Utility function for consistent logging
def log_jwt_operation(operation: str, user_id: str, has_token: bool):
    """Log JWT-related operations for debugging and security auditing"""
    logger.info(f"[supa_api_jwt_helpers] === JWT OPERATION LOG ===")
    logger.info(f"[supa_api_jwt_helpers] Operation: {operation}")
    logger.info(f"[supa_api_jwt_helpers] User ID: {user_id}")
    logger.info(f"[supa_api_jwt_helpers] JWT Token Present: {has_token}")
    logger.info(f"[supa_api_jwt_helpers] Timestamp: {logger.name}")
    if not has_token:
        logger.warning(f"[supa_api_jwt_helpers] ⚠️ Operation {operation} proceeding without JWT - RLS may block")
    logger.info(f"[supa_api_jwt_helpers] === END JWT OPERATION LOG ===")