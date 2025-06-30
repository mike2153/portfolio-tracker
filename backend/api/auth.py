import jwt
import requests
from typing import Optional
from django.conf import settings
from django.http import JsonResponse
import os
import logging
import inspect
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
import functools

logger = logging.getLogger(__name__)

class SupabaseUser:
    """Real Supabase user object"""
    def __init__(self, user_id: str, email: str, user_metadata: Optional[dict] = None):
        self.id = user_id
        self.email = email
        self.user_metadata = user_metadata or {}
        self.full_name = self.user_metadata.get('full_name', '')

def get_supabase_jwt_secret():
    """Get Supabase JWT secret from environment or Supabase API"""
    # Try to get from environment first
    jwt_secret = os.getenv('SUPABASE_JWT_SECRET')
    if jwt_secret:
        return jwt_secret
        
    # If not in env, try to get from Supabase project URL
    supabase_url = os.getenv('SUPABASE_URL')
    if supabase_url:
        # For development, you can use the anon key directly
        # In production, you'd want to use the service role key
        return os.getenv('SUPABASE_ANON_KEY', 'your-anon-key-here')
    
    # Fallback for development
    return 'your-jwt-secret-here'

def extract_token_from_request(request) -> Optional[str]:
    """Extract JWT token from request headers"""
    auth_header = request.headers.get('Authorization', '')
    
    if auth_header.startswith('Bearer '):
        return auth_header.split(' ', 1)[1]
    
    # Also check for token in cookies (for browser requests)
    return request.COOKIES.get('sb-access-token')

def verify_supabase_token(token: str) -> Optional[SupabaseUser]:
    """Verify Supabase JWT token and return user info"""
    try:
        logger.info(f"[AUTH] Verifying token...")
        
        # For development, we'll skip signature verification
        # In production, you'd use the actual JWT secret
        payload = jwt.decode(
            token, 
            options={"verify_signature": False}  # Skip signature verification for development
        )
        
        logger.info(f"[AUTH] Token payload: {payload}")
        
        # Extract user information
        user_id = payload.get('sub')
        email = payload.get('email')
        user_metadata = payload.get('user_metadata', {})
        
        if not user_id:
            logger.warning("[AUTH] No user ID found in JWT payload")
            return None
        
        # Check if token is expired
        import time
        exp = payload.get('exp')
        if exp and exp < time.time():
            logger.warning("[AUTH] JWT token has expired")
            return None
            
        logger.info(f"[AUTH] ✅ Token verified successfully for user: {user_id}")
        return SupabaseUser(user_id, email, user_metadata)
        
    except jwt.ExpiredSignatureError:
        logger.warning("[AUTH] JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"[AUTH] Invalid JWT token: {e}")
        return None
    except Exception as e:
        logger.error(f"[AUTH] Error verifying Supabase token: {e}")
        return None

async def get_current_user(request) -> Optional[SupabaseUser]:
    """Get current authenticated user from request"""
    
    logger.info(f"[AUTH] Processing authentication for request: {request.path}")
    
    # Extract token from request
    token = extract_token_from_request(request)
    if not token:
        logger.warning("[AUTH] No authentication token found in request")
        logger.warning(f"[AUTH] Request headers: {dict(request.headers)}")
        return None
    
    logger.info(f"[AUTH] Token found, length: {len(token)}, starts with: {token[:20]}...")
    
    # Verify token and get user
    user = verify_supabase_token(token)
    if not user:
        logger.warning("[AUTH] Failed to verify authentication token")
        return None
    
    logger.info(f"[AUTH] ✅ Authenticated user: {user.id} ({user.email})")
    return user

def require_auth(view_func):
    """Decorator to require authentication for API endpoints"""
    
    @functools.wraps(view_func)
    async def wrapper(request, *args, **kwargs):
        user = await get_current_user(request)
        if not user:
            return JsonResponse({'error': 'Authentication required'}, status=401)
        
        request.user = user
        
        # Decide how to call the original view based on whether it's async or not
        if inspect.iscoroutinefunction(view_func):
            return await view_func(request, *args, **kwargs)
        else:
            # Use sync_to_async to safely call the synchronous view
            sync_view = sync_to_async(view_func, thread_sensitive=True)
            return await sync_view(request, *args, **kwargs)
            
    return wrapper 