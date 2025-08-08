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
    
    async def _ensure_session(self) -> None:
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
        """Get data from in-memory cache"""
        try:
            # Get cache manager
            from services.cache_manager import get_cache_manager
            cache_manager = await get_cache_manager()
            
            # Check cache
            cached_data = await cache_manager.get(cache_key)
            if cached_data:
                logger.info(f"[vantage_api_client.py::_get_from_cache] Cache hit for key: {cache_key}")
                return cached_data
            else:
                logger.info(f"[vantage_api_client.py::_get_from_cache] Cache miss for key: {cache_key}")
                return None
            
        except Exception as e:
            logger.warning(f"[vantage_api_client.py::_get_from_cache] Cache lookup failed: {e}")
            return None
    
    async def _save_to_cache(self, cache_key: str, data: Dict[str, Any]) -> None:
        """Save data to in-memory cache"""
        try:
            # Get cache manager
            from services.cache_manager import get_cache_manager
            cache_manager = await get_cache_manager()
            
            # Save to cache with TTL
            await cache_manager.set(cache_key, data, CACHE_TTL_SECONDS)
            logger.info(f"[vantage_api_client.py::_save_to_cache] Data cached successfully for key: {cache_key}")
            
        except Exception as e:
            logger.warning(f"[vantage_api_client.py::_save_to_cache] Cache save failed: {e}")
    
    async def close(self) -> None:
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