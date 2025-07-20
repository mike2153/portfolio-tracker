"""
Alpha Vantage API client with caching and extensive debugging
Handles all stock market data requests
"""
import aiohttp
import asyncio
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime, timedelta
import json

from config import VANTAGE_API_KEY, VANTAGE_API_BASE_URL, CACHE_TTL_SECONDS
from debug_logger import DebugLogger
from supa_api.supa_api_client import get_supa_service_client

logger = logging.getLogger(__name__)

class VantageApiClient:
    """Alpha Vantage API client with automatic caching"""
    
    def __init__(self):
        self.api_key = VANTAGE_API_KEY
        self.base_url = VANTAGE_API_BASE_URL
        self.session: Optional[aiohttp.ClientSession] = None
        self.supa_client = get_supa_service_client()
        
        logger.info(f"""
========== VANTAGE API CLIENT INIT ==========
FILE: vantage_api_client.py
FUNCTION: __init__
API: ALPHA_VANTAGE
BASE_URL: {self.base_url}
=============================================""")
    
    async def _ensure_session(self):
        """Ensure aiohttp session is created"""
        if not self.session or self.session.closed:
            self.session = aiohttp.ClientSession()
            logger.info("[vantage_api_client.py::_ensure_session] Created new aiohttp session")
    
    async def _make_request(self, params: Dict[str, str]) -> Dict[str, Any]:
        """Make HTTP request to Alpha Vantage with debugging"""
        await self._ensure_session()
        assert self.session is not None
        
        # Add API key to params
        params['apikey'] = self.api_key
        
        url = self.base_url
        
        # logger.info(f"""
# ========== VANTAGE API REQUEST ==========
# FILE: vantage_api_client.py
# FUNCTION: _make_request
# API: ALPHA_VANTAGE
# URL: {url}
# PARAMS: {json.dumps({k: v for k, v in params.items() if k != 'apikey'}, indent=2)}
# =========================================""")
        
        try:
            async with self.session.get(url, params=params) as response:
                response_text = await response.text()
                
                if response.status != 200:
                    raise Exception(f"API returned status {response.status}: {response_text}")
                
                data = json.loads(response_text)
                
                # Check for API errors
                if "Error Message" in data:
                    raise Exception(f"Alpha Vantage error: {data['Error Message']}")
                
                if "Note" in data:
                    logger.warning(f"[vantage_api_client.py::_make_request] API Note: {data['Note']}")
                
                # logger.info(f"""
# ========== VANTAGE API RESPONSE ==========
# FILE: vantage_api_client.py
# FUNCTION: _make_request
# API: ALPHA_VANTAGE
# STATUS: {response.status}
# DATA_KEYS: {list(data.keys())}
# ==========================================""")
                
                return data
                
        except Exception as e:
            DebugLogger.log_error(
                file_name="vantage_api_client.py",
                function_name="_make_request",
                error=e,
                url=url,
                params=params
            )
            raise
    
    async def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get data from Supabase cache"""
        # logger.info(f"""
# ========== CACHE LOOKUP ==========
# FILE: vantage_api_client.py
# FUNCTION: _get_from_cache
# API: SUPABASE
# CACHE_KEY: {cache_key}
# ==================================""")
        
        try:
            # Query cache table
            result = self.supa_client.table('api_cache') \
                .select('data, created_at, expires_at') \
                .eq('cache_key', cache_key) \
                .single() \
                .execute()
            
            if result.data:
                # Check expires_at if available, otherwise fall back to created_at check
                if 'expires_at' in result.data and result.data['expires_at']:
                    expires_at = datetime.fromisoformat(result.data['expires_at'].replace('Z', '+00:00'))
                    if datetime.now(expires_at.tzinfo) < expires_at:
                        logger.info(f"[vantage_api_client.py::_get_from_cache] Cache hit! Valid until: {expires_at}")
                        return result.data['data']
                    else:
                        logger.info(f"[vantage_api_client.py::_get_from_cache] Cache expired at: {expires_at}")
                else:
                    # Fallback for old cache entries without expires_at
                    created_at = datetime.fromisoformat(result.data['created_at'].replace('Z', '+00:00'))
                    age_seconds = (datetime.now(created_at.tzinfo) - created_at).total_seconds()
                    
                    if age_seconds < CACHE_TTL_SECONDS:
                        logger.info(f"[vantage_api_client.py::_get_from_cache] Cache hit! Age: {age_seconds:.0f}s")
                        return result.data['data']
                    else:
                        logger.info(f"[vantage_api_client.py::_get_from_cache] Cache expired. Age: {age_seconds:.0f}s")
            else:
                logger.info("[vantage_api_client.py::_get_from_cache] Cache miss")
            
            return None
            
        except Exception as e:
            logger.warning(f"[vantage_api_client.py::_get_from_cache] Cache lookup failed: {e}")
            return None
    
    async def _save_to_cache(self, cache_key: str, data: Dict[str, Any]):
        """Save data to Supabase cache"""
        # logger.info(f"""
# ========== CACHE SAVE ==========
# FILE: vantage_api_client.py
# FUNCTION: _save_to_cache
# API: SUPABASE
# CACHE_KEY: {cache_key}
# =================================""")
        
        try:
            expires_at = datetime.now() + timedelta(seconds=CACHE_TTL_SECONDS)
            
            # Upsert to cache
            self.supa_client.table('api_cache').upsert({
                'cache_key': cache_key,
                'data': data,
                'expires_at': expires_at.isoformat()
            }).execute()
            
            # logger.info("[vantage_api_client.py::_save_to_cache] Data cached successfully")
            
        except Exception as e:
            logger.warning(f"[vantage_api_client.py::_save_to_cache] Cache save failed: {e}")
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("[vantage_api_client.py::close] Closed aiohttp session")

# Create singleton instance
vantage_api_client = VantageApiClient()

# Export convenience function
def get_vantage_client() -> VantageApiClient:
    """Get the Alpha Vantage client instance"""
    return vantage_api_client 