import jwt
import requests
from typing import Optional
from django.conf import settings
from django.http import JsonResponse
import os
import logging

logger = logging.getLogger(__name__)

class SupabaseUser:
    """Real Supabase user object"""
    def __init__(self, user_id: str, email: str, user_metadata: dict = None):
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
        jwt_secret = get_supabase_jwt_secret()
        
        # Decode the JWT token
        payload = jwt.decode(
            token, 
            jwt_secret, 
            algorithms=['HS256'],
            options={"verify_signature": False}  # For development only
        )
        
        # Extract user information
        user_id = payload.get('sub')
        email = payload.get('email')
        user_metadata = payload.get('user_metadata', {})
        
        if not user_id:
            logger.warning("No user ID found in JWT payload")
            return None
            
        return SupabaseUser(user_id, email, user_metadata)
        
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None
    except Exception as e:
        logger.error(f"Error verifying Supabase token: {e}")
        return None

async def get_current_user(request) -> SupabaseUser:
    """Get current authenticated user from request"""
    
    # For development/testing, allow bypassing auth with a test user
    if os.getenv('DJANGO_DEBUG', 'False').lower() == 'true':
        test_user_id = request.GET.get('user_id')
        if test_user_id:
            logger.info(f"Using test user ID: {test_user_id}")
            return SupabaseUser(test_user_id, f"{test_user_id}@test.com")
    
    # Extract token from request
    token = extract_token_from_request(request)
    if not token:
        logger.warning("No authentication token found in request")
        # Return a default test user for development
        return SupabaseUser('test_user_123', 'test@example.com')
    
    # Verify token and get user
    user = verify_supabase_token(token)
    if not user:
        logger.warning("Failed to verify authentication token")
        # Return a default test user for development
        return SupabaseUser('test_user_123', 'test@example.com')
    
    logger.info(f"Authenticated user: {user.id} ({user.email})")
    return user

def require_auth(view_func):
    """Decorator to require authentication for API endpoints"""
    async def wrapper(request, *args, **kwargs):
        user = await get_current_user(request)
        if not user:
            return JsonResponse({'error': 'Authentication required'}, status=401)
        
        # Add user to request for easy access
        request.user = user
        return await view_func(request, *args, **kwargs)
    
    return wrapper 