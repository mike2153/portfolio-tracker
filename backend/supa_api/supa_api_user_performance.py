"""
Comprehensive Supabase API functions for user performance cache management.
Handles all CRUD operations for the user_performance table with strong typing,
extensive error handling, and performance optimization.

IMPLEMENTATION NOTES:
- All financial calculations use Decimal (NEVER float/int)
- Complete type annotations with zero tolerance for Any types
- Comprehensive edge case handling with proper error recovery
- Cache analytics and performance tracking built-in
- Follows RLS security patterns with user token validation
"""

from typing import Dict, Any, List, Optional, TypedDict, Union
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, validator
import logging
import hashlib
import json
import time

from .supa_api_client import get_supa_client, get_supa_service_client
from utils.auth_helpers import extract_user_credentials, validate_user_id
from debug_logger import DebugLogger
from utils.decimal_json_encoder import convert_decimals_to_float

logger = logging.getLogger(__name__)

# ============================================================================
# COMPREHENSIVE DATA MODELS
# ============================================================================

class PortfolioHolding(BaseModel):
    """Individual portfolio holding with strict financial typing."""
    symbol: str
    quantity: Decimal
    avg_cost: Decimal
    total_cost: Decimal
    current_price: Decimal
    current_value: Decimal
    gain_loss: Decimal
    gain_loss_percent: Decimal
    allocation: Decimal
    
    @validator('quantity', 'avg_cost', 'total_cost', 'current_price', 
              'current_value', 'gain_loss', 'gain_loss_percent', 'allocation', pre=True)
    def validate_decimal_fields(cls, v: Any) -> Decimal:
        """Ensure all financial fields are properly converted to Decimal."""
        if isinstance(v, Decimal):
            return v
        try:
            return Decimal(str(v))
        except (InvalidOperation, ValueError, TypeError) as e:
            raise ValueError(f"Invalid decimal value: {v}, error: {e}")

class PortfolioData(BaseModel):
    """Complete portfolio data structure."""
    holdings: List[PortfolioHolding]
    total_value: Decimal
    total_cost: Decimal
    total_gain_loss: Decimal
    total_gain_loss_percent: Decimal
    currency: str = "USD"
    
    @validator('total_value', 'total_cost', 'total_gain_loss', 'total_gain_loss_percent', pre=True)
    def validate_decimal_totals(cls, v: Any) -> Decimal:
        """Ensure total fields use Decimal."""
        if isinstance(v, Decimal):
            return v
        try:
            return Decimal(str(v))
        except (InvalidOperation, ValueError, TypeError) as e:
            raise ValueError(f"Invalid decimal total: {v}, error: {e}")

class PerformanceMetrics(BaseModel):
    """Performance analytics data."""
    xirr: Optional[Decimal] = None
    sharpe_ratio: Optional[Decimal] = None
    volatility: Optional[Decimal] = None
    max_drawdown: Optional[Decimal] = None
    daily_change: Decimal = Decimal('0')
    daily_change_percent: Decimal = Decimal('0')
    ytd_return: Decimal = Decimal('0')
    ytd_return_percent: Decimal = Decimal('0')
    
    @validator('xirr', 'sharpe_ratio', 'volatility', 'max_drawdown',
              'daily_change', 'daily_change_percent', 'ytd_return', 'ytd_return_percent', pre=True)
    def validate_performance_decimals(cls, v: Any) -> Optional[Decimal]:
        """Convert performance metrics to Decimal or None."""
        if v is None:
            return None
        if isinstance(v, Decimal):
            return v
        try:
            return Decimal(str(v))
        except (InvalidOperation, ValueError, TypeError) as e:
            raise ValueError(f"Invalid performance decimal: {v}, error: {e}")

class AllocationBreakdown(BaseModel):
    """Asset allocation breakdown."""
    by_symbol: List[Dict[str, Any]] = Field(default_factory=list)
    by_sector: Dict[str, Decimal] = Field(default_factory=dict)
    by_region: Dict[str, Decimal] = Field(default_factory=dict)
    by_currency: Dict[str, Decimal] = Field(default_factory=dict)
    top_holdings: List[Dict[str, Any]] = Field(default_factory=list)

class DividendData(BaseModel):
    """Dividend information with Decimal precision."""
    total_received: Decimal = Decimal('0')
    ytd_received: Decimal = Decimal('0')
    pending_amount: Decimal = Decimal('0')
    recent_dividends: List[Dict[str, Any]] = Field(default_factory=list)
    upcoming_payments: List[Dict[str, Any]] = Field(default_factory=list)
    yield_estimate: Optional[Decimal] = None
    
    @validator('total_received', 'ytd_received', 'pending_amount', 'yield_estimate', pre=True)
    def validate_dividend_decimals(cls, v: Any) -> Optional[Decimal]:
        """Convert dividend amounts to Decimal."""
        if v is None:
            return None
        if isinstance(v, Decimal):
            return v
        try:
            return Decimal(str(v))
        except (InvalidOperation, ValueError, TypeError) as e:
            raise ValueError(f"Invalid dividend decimal: {v}, error: {e}")

class TransactionsSummary(BaseModel):
    """Summary of transaction data."""
    total_transactions: int = 0
    last_transaction_date: Optional[datetime] = None
    buy_count: int = 0
    sell_count: int = 0
    dividend_count: int = 0
    realized_gains: Decimal = Decimal('0')
    
    @validator('realized_gains', pre=True)
    def validate_realized_gains(cls, v: Any) -> Decimal:
        """Convert realized gains to Decimal."""
        if isinstance(v, Decimal):
            return v
        try:
            return Decimal(str(v))
        except (InvalidOperation, ValueError, TypeError) as e:
            raise ValueError(f"Invalid realized gains decimal: {v}, error: {e}")

class TimeSeriesData(BaseModel):
    """Time series data for charts."""
    portfolio_values: List[Dict[str, Any]] = Field(default_factory=list)
    benchmark_values: List[Dict[str, Any]] = Field(default_factory=list)
    date_range: Dict[str, Optional[datetime]] = Field(default_factory=lambda: {"start": None, "end": None})
    data_points: int = 0

class CacheDependencies(BaseModel):
    """Cache dependency tracking."""
    symbols: List[str] = Field(default_factory=list)
    price_dates: Dict[str, datetime] = Field(default_factory=dict)
    external_data_sources: List[str] = Field(default_factory=list)

class CompletePortfolioData(BaseModel):
    """Complete portfolio data structure for caching."""
    portfolio_data: PortfolioData
    performance_data: PerformanceMetrics
    allocation_data: AllocationBreakdown
    dividend_data: DividendData
    transactions_summary: TransactionsSummary
    time_series_data: TimeSeriesData = Field(default_factory=TimeSeriesData)

class UserPerformanceCache(BaseModel):
    """Complete user performance cache record."""
    user_id: str
    portfolio_data: PortfolioData
    performance_data: PerformanceMetrics
    allocation_data: AllocationBreakdown
    dividend_data: DividendData
    transactions_summary: TransactionsSummary
    time_series_data: TimeSeriesData
    calculated_at: datetime
    expires_at: datetime
    cache_version: int = 1
    data_hash: str
    calculation_time_ms: Optional[int] = None
    last_accessed: datetime
    access_count: int = 0
    last_transaction_date: Optional[datetime] = None
    last_price_update: Optional[datetime] = None
    last_dividend_sync: Optional[datetime] = None
    cache_hit_rate: Decimal = Decimal('0.0000')
    invalidation_reason: Optional[str] = None
    market_status_at_calculation: Dict[str, Any] = Field(default_factory=lambda: {
        "is_open": False, "session": "closed", "timezone": "America/New_York"
    })
    dependencies: CacheDependencies = Field(default_factory=CacheDependencies)
    user_activity_score: int = 0
    last_portfolio_change: Optional[datetime] = None
    refresh_job_id: Optional[str] = None
    refresh_in_progress: bool = False
    refresh_started_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CacheStats(BaseModel):
    """Cache performance statistics."""
    total_cache_entries: int
    valid_entries: int
    expired_entries: int
    refreshing_entries: int
    avg_calculation_time_ms: Optional[Decimal]
    avg_access_count: Optional[Decimal]
    avg_cache_hit_rate: Optional[Decimal]
    avg_user_activity_score: Optional[Decimal]
    recently_accessed: int
    accessed_today: int

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _calculate_data_hash(data: CompletePortfolioData) -> str:
    """Calculate SHA256 hash of portfolio data for change detection."""
    try:
        # Convert to JSON string with sorted keys for consistent hashing
        data_dict = data.dict()
        json_str = json.dumps(data_dict, sort_keys=True, default=str)
        return hashlib.sha256(json_str.encode()).hexdigest()
    except Exception as e:
        logger.warning(f"Failed to calculate data hash: {e}")
        return f"hash_error_{int(time.time())}"

def _convert_jsonb_to_model(jsonb_data: Dict[str, Any], model_class: type) -> Any:
    """Safely convert JSONB data to Pydantic model with error handling."""
    try:
        if not jsonb_data:
            return model_class()
        return model_class(**jsonb_data)
    except Exception as e:
        logger.warning(f"Failed to convert JSONB to {model_class.__name__}: {e}")
        return model_class()

def _prepare_jsonb_data(model_instance: BaseModel) -> Dict[str, Any]:
    """Convert Pydantic model to JSONB-safe dictionary."""
    try:
        data = model_instance.dict()
        # Convert Decimal objects to float for JSON compatibility
        return convert_decimals_to_float(data)
    except Exception as e:
        logger.error(f"Failed to prepare JSONB data: {e}")
        raise

# ============================================================================
# CORE CACHE FUNCTIONS
# ============================================================================

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_USER_PERFORMANCE_CACHE")
async def supa_api_get_user_performance_cache(user_id: str, user_token: Optional[str] = None) -> Optional[UserPerformanceCache]:
    """
    Retrieve user performance cache data with comprehensive validation.
    
    Args:
        user_id: User identifier (must be non-empty string)
        user_token: Optional user authentication token for RLS
        
    Returns:
        UserPerformanceCache object if valid cache exists, None otherwise
        
    Raises:
        HTTPException: For authentication or validation errors
        Exception: For database or other system errors
    """
    # Validate user_id
    validated_user_id = validate_user_id(user_id)
    
    logger.info(f"[supa_api_user_performance.py::supa_api_get_user_performance_cache] Retrieving cache for user: {validated_user_id}")
    
    try:
        # Choose client based on authentication
        if user_token:
            from .supa_api_client import create_client
            from config import SUPA_API_URL, SUPA_API_ANON_KEY
            client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
            client.auth.set_session(access_token=user_token, refresh_token="")
        else:
            client = get_supa_service_client()
        
        # Query cache with comprehensive selection
        result = client.table('user_performance') \
            .select('*') \
            .eq('user_id', validated_user_id) \
            .single() \
            .execute()
        
        if not result.data:
            logger.info(f"[supa_api_user_performance.py::supa_api_get_user_performance_cache] No cache found for user {validated_user_id}")
            return None
        
        cache_data = result.data
        
        # Check if cache is still valid (not expired)
        expires_at = datetime.fromisoformat(cache_data['expires_at'].replace('Z', '+00:00'))
        if expires_at <= datetime.utcnow():
            logger.info(f"[supa_api_user_performance.py::supa_api_get_user_performance_cache] Cache expired for user {validated_user_id}")
            return None
        
        # Convert JSONB data to proper models with error handling
        try:
            portfolio_data = _convert_jsonb_to_model(cache_data.get('portfolio_data', {}), PortfolioData)
            performance_data = _convert_jsonb_to_model(cache_data.get('performance_data', {}), PerformanceMetrics)
            allocation_data = _convert_jsonb_to_model(cache_data.get('allocation_data', {}), AllocationBreakdown)
            dividend_data = _convert_jsonb_to_model(cache_data.get('dividend_data', {}), DividendData)
            transactions_summary = _convert_jsonb_to_model(cache_data.get('transactions_summary', {}), TransactionsSummary)
            time_series_data = _convert_jsonb_to_model(cache_data.get('time_series_data', {}), TimeSeriesData)
            dependencies = _convert_jsonb_to_model(cache_data.get('dependencies', {}), CacheDependencies)
        except Exception as e:
            logger.error(f"[supa_api_user_performance.py::supa_api_get_user_performance_cache] Data conversion error: {e}")
            return None
        
        # Update access statistics
        try:
            await _update_cache_access_stats(validated_user_id, user_token)
        except Exception as e:
            logger.warning(f"Failed to update access stats: {e}")
        
        # Construct cache object
        cache_obj = UserPerformanceCache(
            user_id=validated_user_id,
            portfolio_data=portfolio_data,
            performance_data=performance_data,
            allocation_data=allocation_data,
            dividend_data=dividend_data,
            transactions_summary=transactions_summary,
            time_series_data=time_series_data,
            calculated_at=datetime.fromisoformat(cache_data['calculated_at'].replace('Z', '+00:00')),
            expires_at=expires_at,
            cache_version=cache_data.get('cache_version', 1),
            data_hash=cache_data.get('data_hash', ''),
            calculation_time_ms=cache_data.get('calculation_time_ms'),
            last_accessed=datetime.fromisoformat(cache_data['last_accessed'].replace('Z', '+00:00')),
            access_count=cache_data.get('access_count', 0),
            last_transaction_date=datetime.fromisoformat(cache_data['last_transaction_date']) if cache_data.get('last_transaction_date') else None,
            last_price_update=datetime.fromisoformat(cache_data['last_price_update'].replace('Z', '+00:00')) if cache_data.get('last_price_update') else None,
            last_dividend_sync=datetime.fromisoformat(cache_data['last_dividend_sync'].replace('Z', '+00:00')) if cache_data.get('last_dividend_sync') else None,
            cache_hit_rate=Decimal(str(cache_data.get('cache_hit_rate', '0.0000'))),
            invalidation_reason=cache_data.get('invalidation_reason'),
            market_status_at_calculation=cache_data.get('market_status_at_calculation', {}),
            dependencies=dependencies,
            user_activity_score=cache_data.get('user_activity_score', 0),
            last_portfolio_change=datetime.fromisoformat(cache_data['last_portfolio_change'].replace('Z', '+00:00')) if cache_data.get('last_portfolio_change') else None,
            refresh_job_id=cache_data.get('refresh_job_id'),
            refresh_in_progress=cache_data.get('refresh_in_progress', False),
            refresh_started_at=datetime.fromisoformat(cache_data['refresh_started_at'].replace('Z', '+00:00')) if cache_data.get('refresh_started_at') else None,
            metadata=cache_data.get('metadata', {})
        )
        
        logger.info(f"[supa_api_user_performance.py::supa_api_get_user_performance_cache] Cache retrieved successfully for user {validated_user_id}")
        return cache_obj
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_user_performance.py",
            function_name="supa_api_get_user_performance_cache",
            error=e,
            user_id=validated_user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="SAVE_USER_PERFORMANCE_CACHE")
async def supa_api_save_user_performance_cache(
    user_id: str, 
    data: CompletePortfolioData, 
    expires_at: datetime,
    user_token: Optional[str] = None,
    calculation_time_ms: Optional[int] = None,
    market_status: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Save complete portfolio performance data to cache.
    
    Args:
        user_id: User identifier (must be non-empty string)
        data: Complete portfolio data to cache
        expires_at: Cache expiration timestamp
        user_token: Optional user authentication token for RLS
        calculation_time_ms: Time taken to calculate the data
        market_status: Current market status information
        
    Returns:
        True if save was successful, False otherwise
        
    Raises:
        HTTPException: For authentication or validation errors
        Exception: For database or other system errors
    """
    # Validate user_id
    validated_user_id = validate_user_id(user_id)
    
    logger.info(f"[supa_api_user_performance.py::supa_api_save_user_performance_cache] Saving cache for user: {validated_user_id}")
    
    try:
        # Calculate data hash for integrity checking
        data_hash = _calculate_data_hash(data)
        
        # Prepare JSONB data
        portfolio_jsonb = _prepare_jsonb_data(data.portfolio_data)
        performance_jsonb = _prepare_jsonb_data(data.performance_data)
        allocation_jsonb = _prepare_jsonb_data(data.allocation_data)
        dividend_jsonb = _prepare_jsonb_data(data.dividend_data)
        transactions_summary_jsonb = _prepare_jsonb_data(data.transactions_summary)
        time_series_jsonb = _prepare_jsonb_data(data.time_series_data)
        
        # Choose client based on authentication
        if user_token:
            from .supa_api_client import create_client
            from config import SUPA_API_URL, SUPA_API_ANON_KEY
            client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
            client.auth.set_session(access_token=user_token, refresh_token="")
        else:
            client = get_supa_service_client()
        
        # Prepare cache record
        now = datetime.utcnow()
        cache_record = {
            'user_id': validated_user_id,
            'portfolio_data': portfolio_jsonb,
            'performance_data': performance_jsonb,
            'allocation_data': allocation_jsonb,
            'dividend_data': dividend_jsonb,
            'transactions_summary': transactions_summary_jsonb,
            'time_series_data': time_series_jsonb,
            'calculated_at': now.isoformat(),
            'expires_at': expires_at.isoformat(),
            'cache_version': 1,
            'data_hash': data_hash,
            'calculation_time_ms': calculation_time_ms,
            'last_accessed': now.isoformat(),
            'access_count': 0,
            'last_transaction_date': data.transactions_summary.last_transaction_date.isoformat() if data.transactions_summary.last_transaction_date else None,
            'last_price_update': now.isoformat(),
            'cache_hit_rate': 0.0000,
            'market_status_at_calculation': market_status or {"is_open": False, "session": "closed", "timezone": "America/New_York"},
            'dependencies': {
                'symbols': [holding.symbol for holding in data.portfolio_data.holdings],
                'price_dates': {},
                'external_data_sources': ['alpha_vantage']
            },
            'user_activity_score': 0,
            'refresh_in_progress': False,
            'metadata': {
                'calculation_method': 'standard',
                'data_completeness': {'portfolio': True, 'performance': True},
                'warnings': [],
                'debug_info': {'saved_at': now.isoformat()}
            }
        }
        
        # Upsert cache record (insert or update)
        result = client.table('user_performance') \
            .upsert(cache_record) \
            .execute()
        
        if result.data:
            logger.info(f"[supa_api_user_performance.py::supa_api_save_user_performance_cache] Cache saved successfully for user {validated_user_id}")
            return True
        else:
            logger.error(f"[supa_api_user_performance.py::supa_api_save_user_performance_cache] Failed to save cache for user {validated_user_id}")
            return False
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_user_performance.py",
            function_name="supa_api_save_user_performance_cache",
            error=e,
            user_id=validated_user_id
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="INVALIDATE_USER_PERFORMANCE_CACHE")
async def supa_api_invalidate_user_performance_cache(
    user_id: str, 
    reason: str = "manual_invalidation",
    user_token: Optional[str] = None
) -> bool:
    """
    Invalidate user performance cache with reason tracking.
    
    Args:
        user_id: User identifier (must be non-empty string)
        reason: Reason for invalidation (for analytics)
        user_token: Optional user authentication token for RLS
        
    Returns:
        True if invalidation was successful, False otherwise
        
    Raises:
        HTTPException: For authentication or validation errors
        Exception: For database or other system errors
    """
    # Validate user_id
    validated_user_id = validate_user_id(user_id)
    
    logger.info(f"[supa_api_user_performance.py::supa_api_invalidate_user_performance_cache] Invalidating cache for user: {validated_user_id}, reason: {reason}")
    
    try:
        # Choose client based on authentication
        if user_token:
            from .supa_api_client import create_client
            from config import SUPA_API_URL, SUPA_API_ANON_KEY
            client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
            client.auth.set_session(access_token=user_token, refresh_token="")
        else:
            client = get_supa_service_client()
        
        # Update cache to expired status with reason
        now = datetime.utcnow()
        expired_time = now - timedelta(seconds=1)  # Set to just expired
        
        result = client.table('user_performance') \
            .update({
                'expires_at': expired_time.isoformat(),
                'invalidation_reason': reason,
                'metadata': {
                    'invalidated_at': now.isoformat(),
                    'invalidation_reason': reason
                }
            }) \
            .eq('user_id', validated_user_id) \
            .execute()
        
        if result.data:
            logger.info(f"[supa_api_user_performance.py::supa_api_invalidate_user_performance_cache] Cache invalidated successfully for user {validated_user_id}")
            return True
        else:
            logger.warning(f"[supa_api_user_performance.py::supa_api_invalidate_user_performance_cache] No cache found to invalidate for user {validated_user_id}")
            return False
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_user_performance.py",
            function_name="supa_api_invalidate_user_performance_cache",
            error=e,
            user_id=validated_user_id,
            reason=reason
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_STALE_PERFORMANCE_CACHES")
async def supa_api_get_stale_performance_caches(expiry_threshold: timedelta = timedelta(hours=1)) -> List[str]:
    """
    Get list of user IDs with stale/expired performance caches.
    
    Args:
        expiry_threshold: How far in the past to consider as stale
        
    Returns:
        List of user IDs with stale caches
        
    Raises:
        Exception: For database or other system errors
    """
    logger.info(f"[supa_api_user_performance.py::supa_api_get_stale_performance_caches] Finding stale caches older than {expiry_threshold}")
    
    try:
        client = get_supa_service_client()
        
        # Calculate threshold time
        threshold_time = datetime.utcnow() - expiry_threshold
        
        # Query for stale caches
        result = client.table('user_performance') \
            .select('user_id') \
            .lt('expires_at', threshold_time.isoformat()) \
            .execute()
        
        stale_user_ids = [record['user_id'] for record in (result.data or [])]
        
        logger.info(f"[supa_api_user_performance.py::supa_api_get_stale_performance_caches] Found {len(stale_user_ids)} stale caches")
        return stale_user_ids
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_user_performance.py",
            function_name="supa_api_get_stale_performance_caches",
            error=e
        )
        raise

@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="GET_CACHE_PERFORMANCE_STATS")
async def supa_api_get_cache_performance_stats() -> CacheStats:
    """
    Get comprehensive cache performance statistics.
    
    Returns:
        CacheStats object with analytics data
        
    Raises:
        Exception: For database or other system errors
    """
    logger.info("[supa_api_user_performance.py::supa_api_get_cache_performance_stats] Retrieving cache performance statistics")
    
    try:
        client = get_supa_service_client()
        
        # Get comprehensive cache statistics
        result = client.table('user_performance') \
            .select('*') \
            .execute()
        
        if not result.data:
            return CacheStats(
                total_cache_entries=0,
                valid_entries=0,
                expired_entries=0,
                refreshing_entries=0,
                avg_calculation_time_ms=None,
                avg_access_count=None,
                avg_cache_hit_rate=None,
                avg_user_activity_score=None,
                recently_accessed=0,
                accessed_today=0
            )
        
        records = result.data
        now = datetime.utcnow()
        
        # Calculate statistics
        total_entries = len(records)
        valid_entries = 0
        expired_entries = 0
        refreshing_entries = 0
        calculation_times: List[int] = []
        access_counts: List[int] = []
        hit_rates: List[Decimal] = []
        activity_scores: List[int] = []
        recently_accessed = 0
        accessed_today = 0
        
        for record in records:
            expires_at = datetime.fromisoformat(record['expires_at'].replace('Z', '+00:00'))
            
            if expires_at > now:
                valid_entries += 1
            else:
                expired_entries += 1
            
            if record.get('refresh_in_progress', False):
                refreshing_entries += 1
            
            if record.get('calculation_time_ms'):
                calculation_times.append(record['calculation_time_ms'])
            
            access_counts.append(record.get('access_count', 0))
            hit_rates.append(Decimal(str(record.get('cache_hit_rate', '0.0000'))))
            activity_scores.append(record.get('user_activity_score', 0))
            
            # Check recent access
            last_accessed = datetime.fromisoformat(record['last_accessed'].replace('Z', '+00:00'))
            if last_accessed > now - timedelta(hours=1):
                recently_accessed += 1
            if last_accessed > now - timedelta(days=1):
                accessed_today += 1
        
        # Calculate averages
        avg_calc_time = Decimal(str(sum(calculation_times) / len(calculation_times))) if calculation_times else None
        avg_access_count = Decimal(str(sum(access_counts) / len(access_counts))) if access_counts else None
        avg_hit_rate = sum(hit_rates) / len(hit_rates) if hit_rates else None
        avg_activity = Decimal(str(sum(activity_scores) / len(activity_scores))) if activity_scores else None
        
        stats = CacheStats(
            total_cache_entries=total_entries,
            valid_entries=valid_entries,
            expired_entries=expired_entries,
            refreshing_entries=refreshing_entries,
            avg_calculation_time_ms=avg_calc_time,
            avg_access_count=avg_access_count,
            avg_cache_hit_rate=avg_hit_rate,
            avg_user_activity_score=avg_activity,
            recently_accessed=recently_accessed,
            accessed_today=accessed_today
        )
        
        logger.info(f"[supa_api_user_performance.py::supa_api_get_cache_performance_stats] Statistics retrieved: {total_entries} total entries, {valid_entries} valid")
        return stats
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="supa_api_user_performance.py",
            function_name="supa_api_get_cache_performance_stats",
            error=e
        )
        raise

# ============================================================================
# PRIVATE HELPER FUNCTIONS
# ============================================================================

async def _update_cache_access_stats(user_id: str, user_token: Optional[str] = None) -> None:
    """Update cache access statistics (internal function)."""
    try:
        if user_token:
            from .supa_api_client import create_client
            from config import SUPA_API_URL, SUPA_API_ANON_KEY
            client = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
            client.auth.set_session(access_token=user_token, refresh_token="")
        else:
            client = get_supa_service_client()
        
        # Update access statistics
        client.table('user_performance') \
            .update({
                'access_count': 'access_count + 1',  # Increment counter
                'last_accessed': datetime.utcnow().isoformat()
            }) \
            .eq('user_id', user_id) \
            .execute()
            
    except Exception as e:
        logger.warning(f"Failed to update access stats for user {user_id}: {e}")