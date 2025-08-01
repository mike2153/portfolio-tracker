"""
Company Financials Service with intelligent caching
Implements the required caching pattern: check DB first, fetch API if stale
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import json

from supabase.client import Client
from supabase.client import create_client
from debug_logger import DebugLogger
from vantage_api.vantage_api_quotes import vantage_api_get_overview
from vantage_api.vantage_api_financials import (
    vantage_api_get_income_statement,
    vantage_api_get_balance_sheet,
    vantage_api_get_cash_flow
)
from supa_api.supa_api_client import get_supa_client
from config import SUPA_API_URL, SUPA_API_ANON_KEY

logger = logging.getLogger(__name__)

class FinancialsService:
    """Service for managing company financials with caching"""
    
    @staticmethod
    async def get_company_financials(
        symbol: str, 
        user_token: str,
        data_type: str = 'overview',
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Get company financials with intelligent caching
        
        Args:
            symbol: Stock ticker symbol
            data_type: Type of financial data ('overview', 'income', 'balance', 'cashflow')
            force_refresh: Force API fetch even if cached data is fresh
            user_token: User JWT token for database access (REQUIRED)
            
        Returns:
            Financial data dictionary with metadata about cache status
        
        Raises:
            ValueError: If user_token is not provided
        """
        # Validate required parameters
        if not user_token:
            raise ValueError("user_token is required for accessing financial data")
            
        symbol = symbol.upper().strip()
        
        try:
            # Step 1: Check cache first (unless force refresh)
            if not force_refresh:
                cached_data = await FinancialsService._get_cached_financials(
                    symbol, data_type, user_token
                )
                if cached_data:
                    logger.info(f"[FinancialsService] Cache HIT for {symbol}:{data_type}")
                    return {
                        "success": True,
                        "data": cached_data,
                        "cache_status": "hit",
                        "symbol": symbol,
                        "data_type": data_type
                    }
            
            # Step 2: Cache miss or force refresh - fetch from API
            logger.info(f"[FinancialsService] Cache MISS for {symbol}:{data_type}, fetching from API")
            fresh_data = await FinancialsService._fetch_from_api(symbol, data_type)
            
            # Step 3: Store in cache for future requests
            await FinancialsService._store_cached_financials(
                symbol, data_type, fresh_data, user_token
            )
            
            return {
                "success": True,
                "data": fresh_data,
                "cache_status": "miss" if not force_refresh else "force_refresh",
                "symbol": symbol,
                "data_type": data_type
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="financials_service.py",
                function_name="get_company_financials",
                error=e,
                symbol=symbol,
                data_type=data_type
            )
            return {
                "success": False,
                "error": str(e),
                "cache_status": "error",
                "symbol": symbol,
                "data_type": data_type
            }
    
    @staticmethod
    async def _get_cached_financials(
        symbol: str, 
        data_type: str, 
        user_token: str,
        freshness_hours: int = 24
    ) -> Optional[Dict[str, Any]]:
        """Check database for fresh cached financials"""
        try:
            # Create authenticated client for RLS compliance
            supabase = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
            supabase.postgrest.auth(user_token)
            
            # Query company_financials table
            result = supabase.table('company_financials').select('*').eq(
                'symbol', symbol
            ).eq(
                'data_type', data_type
            ).gte(
                'last_updated', 
                (datetime.utcnow() - timedelta(hours=freshness_hours)).isoformat()
            ).execute()
            
            if result.data and len(result.data) > 0:
                cache_record = result.data[0]
                return cache_record['financial_data']
            
            return None
            
        except Exception as e:
            logger.error(f"[FinancialsService] Cache lookup error: {e}")
            return None
    
    @staticmethod
    async def _fetch_from_api(symbol: str, data_type: str) -> Dict[str, Any]:
        """Fetch financial data from external API"""
        if data_type == 'OVERVIEW':
            return await vantage_api_get_overview(symbol)
        elif data_type == 'INCOME_STATEMENT':
            return await vantage_api_get_income_statement(symbol)
        elif data_type == 'BALANCE_SHEET':
            return await vantage_api_get_balance_sheet(symbol)
        elif data_type == 'CASH_FLOW':
            return await vantage_api_get_cash_flow(symbol)
        else:
            raise ValueError(f"Unsupported data_type: {data_type}")
    
    @staticmethod
    async def _store_cached_financials(
        symbol: str, 
        data_type: str, 
        financial_data: Dict[str, Any], 
        user_token: str
    ) -> bool:
        """Store financial data in company_financials table"""
        try:
            # Create authenticated client for RLS compliance
            supabase = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
            supabase.postgrest.auth(user_token)
            
            # Upsert into company_financials table
            # Use upsert with on_conflict to handle duplicates
            result = supabase.table('company_financials').upsert({
                'symbol': symbol,
                'data_type': data_type,
                'financial_data': financial_data,
                'last_updated': datetime.utcnow().isoformat()
            }, on_conflict='symbol,data_type').execute()
            
            logger.info(f"[FinancialsService] Stored {symbol}:{data_type} in company_financials successfully")
            return True
            
        except Exception as e:
            logger.error(f"[FinancialsService] Storage error: {e}")
            return False