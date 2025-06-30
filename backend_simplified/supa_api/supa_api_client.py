"""
Supabase client configuration and setup
Handles all Supabase connections with extensive debugging
"""
from supabase import create_client, Client
from typing import Optional, Dict, Any
import logging

from config import SUPA_API_URL, SUPA_API_ANON_KEY, SUPA_API_SERVICE_KEY
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

class SupaApiClient:
    """Singleton Supabase client with connection management"""
    
    _instance: Optional['SupaApiClient'] = None
    _client: Optional[Client] = None
    _service_client: Optional[Client] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_clients()
        return cls._instance
    
    def _initialize_clients(self):
        """Initialize both anon and service clients"""
        logger.info(f"""
========== SUPABASE CLIENT INIT ==========
FILE: supa_api_client.py
FUNCTION: _initialize_clients
API: SUPABASE
URL: {SUPA_API_URL}
==========================================""")
        
        try:
            # Create anonymous client (for public operations)
            self._client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
            logger.info("[supa_api_client.py::_initialize_clients] Anonymous client created successfully")
            
            # Create service client (for admin operations)
            if SUPA_API_SERVICE_KEY:
                self._service_client = create_client(SUPA_API_URL, SUPA_API_SERVICE_KEY)
                logger.info("[supa_api_client.py::_initialize_clients] Service client created successfully")
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="supa_api_client.py",
                function_name="_initialize_clients",
                error=e
            )
            raise
    
    @property
    def client(self) -> Client:
        """Get the anonymous Supabase client"""
        if not self._client:
            raise RuntimeError("Supabase client not initialized")
        return self._client
    
    @property
    def service_client(self) -> Client:
        """Get the service Supabase client"""
        if not self._service_client:
            raise RuntimeError("Supabase service client not initialized")
        return self._service_client
    
    def get_user_from_token(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Validate token and get user info"""
        logger.info(f"""
========== SUPABASE AUTH CHECK ==========
FILE: supa_api_client.py
FUNCTION: get_user_from_token
API: SUPABASE
OPERATION: Token validation
==========================================""")
        
        try:
            # Set the auth header
            self.client.auth.set_session(access_token)
            
            # Get the user
            user_response = self.client.auth.get_user(access_token)
            
            if user_response and user_response.user:
                user_data = {
                    "id": user_response.user.id,
                    "email": user_response.user.email,
                    "created_at": str(user_response.user.created_at)
                }
                logger.info(f"[supa_api_client.py::get_user_from_token] User validated: {user_data['email']}")
                return user_data
            
            logger.warning("[supa_api_client.py::get_user_from_token] Invalid token - no user found")
            return None
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="supa_api_client.py",
                function_name="get_user_from_token",
                error=e,
                token_preview=access_token[:20] + "..."
            )
            return None
    
    async def execute_query(self, query: str, params: Dict[str, Any] = None) -> Any:
        """Execute a raw SQL query with parameters"""
        logger.info(f"""
========== SUPABASE RAW QUERY ==========
FILE: supa_api_client.py
FUNCTION: execute_query
API: SUPABASE
QUERY: {query[:100]}...
PARAMS: {params}
=========================================""")
        
        try:
            result = self.client.rpc(query, params or {}).execute()
            logger.info(f"[supa_api_client.py::execute_query] Query executed successfully, rows: {len(result.data) if result.data else 0}")
            return result.data
        except Exception as e:
            DebugLogger.log_error(
                file_name="supa_api_client.py",
                function_name="execute_query",
                error=e,
                query=query
            )
            raise

# Create singleton instance
supa_api_client = SupaApiClient()

# Export convenience functions
def get_supa_client() -> Client:
    """Get the Supabase client instance"""
    return supa_api_client.client

def get_supa_service_client() -> Client:
    """Get the Supabase service client instance"""
    return supa_api_client.service_client

def validate_user_token(access_token: str) -> Optional[Dict[str, Any]]:
    """Validate user token and return user info"""
    return supa_api_client.get_user_from_token(access_token) 