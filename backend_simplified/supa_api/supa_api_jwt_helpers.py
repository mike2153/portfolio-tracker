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
   # logger.info(f"[supa_api_jwt_helpers] 🔐 Creating authenticated client")
   # logger.info(f"[supa_api_jwt_helpers] Token preview: {user_token[:20] + '...' if user_token else 'None'}")
    
    if not user_token:
        raise ValueError("JWT token is required for authenticated operations")
    
    try:
        client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
        client.postgrest.auth(user_token)
        #logger.info(f"[supa_api_jwt_helpers] ✅ Authenticated client created successfully")
        return client
    except Exception as e:
        #logger.error(f"[supa_api_jwt_helpers] ❌ Failed to create authenticated client: {e}")
        raise

# All unused JWT helper functions have been removed:
# - require_jwt_token: Never used in codebase
# - extract_user_token: Never used in codebase  
# - auto_inject_jwt: Placeholder that was never implemented

# Utility function for consistent logging
def log_jwt_operation(operation: str, user_id: str, has_token: bool) -> None:
    """Log JWT-related operations for debugging and security auditing"""
    #logger.info(f"[supa_api_jwt_helpers] === JWT OPERATION LOG ===")
    #logger.info(f"[supa_api_jwt_helpers] Operation: {operation}")
    #logger.info(f"[supa_api_jwt_helpers] User ID: {user_id}")
    #logger.info(f"[supa_api_jwt_helpers] JWT Token Present: {has_token}")
    #logger.info(f"[supa_api_jwt_helpers] Timestamp: {logger.name}")
    if not has_token:
        logger.warning(f"[supa_api_jwt_helpers] ⚠️ Operation {operation} proceeding without JWT - RLS may block")
        logger.info(f"[supa_api_jwt_helpers] === END JWT OPERATION LOG ===")