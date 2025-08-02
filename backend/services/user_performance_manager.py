"""
User Performance Manager - Complete Portfolio Data Aggregation Service
====================================================================

This service orchestrates all portfolio data aggregation and caching for the
/api/portfolio/complete endpoint. It aggregates data from existing services:
- PortfolioMetricsManager (portfolio calculations)
- DividendService (dividend data)
- PriceManager (price data)
- ForexManager (currency conversion)

CRITICAL REQUIREMENTS:
1. REUSE existing services - do NOT duplicate logic
2. Use Decimal for ALL financial calculations
3. Strong typing - complete annotations, no Any
4. Handle ALL edge cases with proper fallbacks
5. Implement intelligent cache TTL based on market status/user activity
6. Add comprehensive error handling and recovery
7. Follow existing service patterns in the codebase

This service is the SINGLE SOURCE OF TRUTH for complete portfolio data.
"""

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone, date
from typing import Dict, Any, List, Optional, Tuple, Set, Union
from decimal import Decimal, InvalidOperation
from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel, Field, validator
from fastapi import HTTPException

# Service imports - REUSE existing services
from services.portfolio_metrics_manager import portfolio_metrics_manager, PortfolioMetrics, MetricsCacheStatus
from services.dividend_service import DividendService
from services.price_manager import price_manager
from services.forex_manager import ForexManager
from supa_api.supa_api_client import get_supa_service_client
from supa_api.supa_api_jwt_helpers import create_authenticated_client
from supa_api.supa_api_user_profile import get_user_base_currency
from utils.auth_helpers import extract_user_credentials, validate_user_id
from debug_logger import DebugLogger
import os

logger = logging.getLogger(__name__)


# ============================================================================
# Data Models for Complete Portfolio Data
# ============================================================================

class CacheStrategy(str, Enum):
    """Cache strategy for data aggregation"""
    AGGRESSIVE = "aggressive"  # Cache for longer periods
    CONSERVATIVE = "conservative"  # Shorter cache periods
    MARKET_AWARE = "market_aware"  # Cache based on market status
    USER_ACTIVITY = "user_activity"  # Cache based on user activity


class DataCompleteness(BaseModel):
    """Tracks data completeness across all services"""
    portfolio_metrics: bool = False
    dividend_data: bool = False
    price_data: bool = False
    forex_data: bool = False
    market_status: bool = False
    
    @property
    def overall_completeness(self) -> float:
        """Calculate overall data completeness percentage"""
        total_fields = 5
        complete_fields = sum([
            self.portfolio_metrics,
            self.dividend_data,
            self.price_data,
            self.forex_data,
            self.market_status
        ])
        return (complete_fields / total_fields) * 100.0


class PerformanceMetadata(BaseModel):
    """Performance and timing metadata"""
    total_computation_time_ms: int
    cache_strategy_used: CacheStrategy
    data_sources: List[str]
    fallback_strategies_used: List[str] = Field(default_factory=list)
    cache_hit_ratio: float = 0.0
    data_completeness: DataCompleteness


class CompletePortfolioData(BaseModel):
    """Complete portfolio data combining all services"""
    # Core portfolio data (from PortfolioMetricsManager)
    portfolio_metrics: PortfolioMetrics
    
    # Enhanced data from other services
    detailed_dividends: List[Dict[str, Any]] = Field(default_factory=list)
    currency_conversions: Dict[str, Decimal] = Field(default_factory=dict)
    market_analysis: Dict[str, Any] = Field(default_factory=dict)
    
    # Metadata
    generated_at: datetime
    user_id: str
    cache_key: str
    metadata: PerformanceMetadata
    
    class Config:
        json_encoders = {
            Decimal: lambda v: float(v),
            datetime: lambda v: v.isoformat()
        }


# ============================================================================
# Cache Configuration
# ============================================================================

@dataclass
class CacheTTLConfig:
    """Cache TTL configuration based on various factors"""
    # Market-based TTL
    market_open_minutes: int = 15  # 15 minutes during market hours
    market_closed_hours: int = 2   # 2 hours when market closed
    weekend_hours: int = 24        # 24 hours on weekends
    
    # User activity-based TTL
    high_activity_minutes: int = 10  # Very active users
    low_activity_hours: int = 6      # Infrequent users
    
    # Data completeness-based TTL
    complete_data_multiplier: float = 1.5  # Cache longer if data is complete
    partial_data_multiplier: float = 0.5   # Cache shorter if data is partial
    
    # Maximum cache age
    max_cache_age_hours: int = 48
    
    def calculate_ttl(
        self,
        market_open: bool,
        user_activity_level: str,
        data_completeness: float,
        is_weekend: bool
    ) -> Tuple[timedelta, CacheStrategy]:
        """Calculate TTL and strategy based on multiple factors"""
        now = datetime.now(timezone.utc)
        
        # Base TTL calculation
        if is_weekend:
            base_ttl = timedelta(hours=self.weekend_hours)
            strategy = CacheStrategy.CONSERVATIVE
        elif market_open:
            base_ttl = timedelta(minutes=self.market_open_minutes)
            strategy = CacheStrategy.MARKET_AWARE
        else:
            base_ttl = timedelta(hours=self.market_closed_hours)
            strategy = CacheStrategy.MARKET_AWARE
        
        # Adjust for user activity
        if user_activity_level == "high":
            base_ttl = timedelta(minutes=self.high_activity_minutes)
            strategy = CacheStrategy.AGGRESSIVE
        elif user_activity_level == "low":
            base_ttl = timedelta(hours=self.low_activity_hours)
            strategy = CacheStrategy.CONSERVATIVE
        
        # Adjust for data completeness
        if data_completeness >= 90.0:
            base_ttl = timedelta(seconds=int(base_ttl.total_seconds() * self.complete_data_multiplier))
        elif data_completeness < 50.0:
            base_ttl = timedelta(seconds=int(base_ttl.total_seconds() * self.partial_data_multiplier))
        
        # Ensure within bounds
        max_ttl = timedelta(hours=self.max_cache_age_hours)
        final_ttl = min(base_ttl, max_ttl)
        
        return final_ttl, strategy


# ============================================================================
# Main Service Class
# ============================================================================

class UserPerformanceManager:
    """
    Orchestrates complete portfolio data aggregation and caching.
    
    This service:
    1. Aggregates data from PortfolioMetricsManager, DividendService, PriceManager, ForexManager
    2. Implements intelligent caching with market-aware TTL
    3. Provides comprehensive error handling and fallback strategies
    4. Ensures data consistency and integrity
    5. Tracks performance metrics and data completeness
    """
    
    def __init__(self) -> None:
        """Initialize the UserPerformanceManager with all required services"""
        # Initialize services - REUSE existing instances
        self.dividend_service = DividendService()
        self.cache_config = CacheTTLConfig()
        
        # Initialize ForexManager with Alpha Vantage key
        alpha_vantage_key = os.getenv("ALPHA_VANTAGE_API_KEY", "")
        supabase_client = get_supa_service_client()
        self.forex_manager = ForexManager(supabase_client, alpha_vantage_key)
        
        # Cache management
        self._cache_stats = {
            "hits": 0,
            "misses": 0,
            "invalidations": 0,
            "errors": 0
        }
        
        logger.info("[UserPerformanceManager] Initialized with all required services")
    
    # ========================================================================
    # Primary Public Methods
    # ========================================================================
    
    @DebugLogger.log_api_call(
        api_name="USER_PERFORMANCE",
        sender="API",
        receiver="SERVICES",
        operation="GENERATE_COMPLETE_DATA"
    )
    async def generate_complete_data(
        self,
        user_id: str,
        user_token: str,
        force_refresh: bool = False,
        cache_strategy: Optional[CacheStrategy] = None
    ) -> CompletePortfolioData:
        """
        Generate complete portfolio data by orchestrating all services.
        
        Args:
            user_id: User's UUID (validated as non-empty string)
            user_token: JWT token for authentication
            force_refresh: Skip cache and force fresh calculation
            cache_strategy: Override default cache strategy
            
        Returns:
            CompletePortfolioData: Aggregated data from all services
            
        Raises:
            HTTPException: On critical failures
            ValueError: On invalid input parameters
        """
        # Type and input validation
        user_id = validate_user_id(user_id)
        if not user_token or not isinstance(user_token, str):
            raise ValueError("user_token must be a non-empty string")
        
        start_time = datetime.now(timezone.utc)
        
        try:
            # Generate cache key
            cache_key = self._generate_cache_key(user_id, cache_strategy)
            
            # Step 1: Check cache unless force refresh
            if not force_refresh:
                cached_data = await self.get_cached_data(user_id, cache_key)
                if cached_data:
                    self._cache_stats["hits"] += 1
                    logger.info(f"[UserPerformanceManager] Cache HIT for user {user_id}")
                    return cached_data
            
            self._cache_stats["misses"] += 1
            logger.info(f"[UserPerformanceManager] Cache MISS for user {user_id} - generating fresh data")
            
            # Step 2: Aggregate data from all services
            aggregated_data = await self._aggregate_portfolio_data(user_id, user_token)
            
            # Step 3: Validate data integrity
            validation_result = await self._validate_data_integrity(aggregated_data)
            if not validation_result.get("valid", True):
                logger.warning(f"[UserPerformanceManager] Data validation issues: {validation_result.get('issues')}")
            
            # Step 4: Calculate performance metadata
            computation_time = datetime.now(timezone.utc) - start_time
            metadata = PerformanceMetadata(
                total_computation_time_ms=int(computation_time.total_seconds() * 1000),
                cache_strategy_used=cache_strategy or CacheStrategy.MARKET_AWARE,
                data_sources=["portfolio_metrics", "dividend_service", "price_manager", "forex_manager"],
                fallback_strategies_used=validation_result.get("fallbacks_used", []),
                cache_hit_ratio=self._calculate_cache_hit_ratio(),
                data_completeness=validation_result.get("completeness", DataCompleteness())
            )
            
            # Step 5: Create complete data structure
            complete_data = CompletePortfolioData(
                portfolio_metrics=aggregated_data["portfolio_metrics"],
                detailed_dividends=aggregated_data["detailed_dividends"],
                currency_conversions=aggregated_data["currency_conversions"],
                market_analysis=aggregated_data["market_analysis"],
                generated_at=start_time,
                user_id=user_id,
                cache_key=cache_key,
                metadata=metadata
            )
            
            # Step 6: Cache the results
            await self.cache_data(user_id, cache_key, complete_data, cache_strategy)
            
            logger.info(f"[UserPerformanceManager] Generated complete data for user {user_id} in {metadata.total_computation_time_ms}ms")
            return complete_data
            
        except Exception as e:
            self._cache_stats["errors"] += 1
            logger.error(f"[UserPerformanceManager] Error generating complete data for user {user_id}: {e}")
            
            # Try to return stale cache data as fallback
            if not force_refresh:
                cache_key = self._generate_cache_key(user_id, cache_strategy)
                stale_data = await self.get_cached_data(user_id, cache_key, allow_stale=True)
                if stale_data:
                    logger.info(f"[UserPerformanceManager] Returning stale cache data as fallback")
                    return stale_data
            
            # No fallback available
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate complete portfolio data: {str(e)}"
            )
    
    async def get_cached_data(
        self,
        user_id: str,
        cache_key: str,
        allow_stale: bool = False
    ) -> Optional[CompletePortfolioData]:
        """
        Retrieve cached complete portfolio data with validation.
        
        Args:
            user_id: User's UUID
            cache_key: Cache key for the data
            allow_stale: Whether to return stale data
            
        Returns:
            CompletePortfolioData if found and valid, None otherwise
        """
        try:
            client = get_supa_service_client()
            
            # Query the complete portfolio cache table
            result = client.table("user_performance_cache").select("*").eq(
                "user_id", user_id
            ).eq(
                "cache_key", cache_key
            ).single().execute()
            
            if not result.data:
                return None
            
            cache_data = result.data
            expires_at = datetime.fromisoformat(cache_data["expires_at"]).replace(tzinfo=timezone.utc)
            
            # Check expiration
            if not allow_stale and datetime.now(timezone.utc) > expires_at:
                logger.debug(f"[UserPerformanceManager] Cached data expired for user {user_id}")
                return None
            
            # Deserialize and validate data
            complete_data_json = json.loads(cache_data["data_json"])
            complete_data = CompletePortfolioData(**complete_data_json)
            
            # Update access statistics
            client.table("user_performance_cache").update({
                "access_count": cache_data["access_count"] + 1,
                "last_accessed": datetime.now(timezone.utc).isoformat()
            }).eq("user_id", user_id).eq("cache_key", cache_key).execute()
            
            return complete_data
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error retrieving cached data: {e}")
            return None
    
    async def cache_data(
        self,
        user_id: str,
        cache_key: str,
        complete_data: CompletePortfolioData,
        cache_strategy: Optional[CacheStrategy] = None
    ) -> None:
        """
        Store complete portfolio data in cache with intelligent TTL.
        
        Args:
            user_id: User's UUID
            cache_key: Cache key for the data
            complete_data: Complete portfolio data to cache
            cache_strategy: Cache strategy to use
        """
        try:
            client = get_supa_service_client()
            
            # Calculate TTL based on multiple factors
            ttl, actual_strategy = await self._calculate_cache_ttl(
                user_id, 
                complete_data, 
                cache_strategy
            )
            expires_at = datetime.now(timezone.utc) + ttl
            
            # Serialize data
            data_json = complete_data.json()
            
            # Store in cache
            cache_record = {
                "user_id": user_id,
                "cache_key": cache_key,
                "data_json": data_json,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": expires_at.isoformat(),
                "last_accessed": datetime.now(timezone.utc).isoformat(),
                "access_count": 0,
                "cache_strategy": actual_strategy.value,
                "data_completeness": complete_data.metadata.data_completeness.overall_completeness,
                "computation_time_ms": complete_data.metadata.total_computation_time_ms
            }
            
            # Upsert to handle concurrent operations
            client.table("user_performance_cache").upsert(cache_record).execute()
            
            logger.info(f"[UserPerformanceManager] Cached data for user {user_id} with TTL {ttl}")
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error caching data: {e}")
            # Don't fail the request if caching fails
    
    async def invalidate_cache(
        self,
        user_id: str,
        cache_pattern: Optional[str] = None
    ) -> int:
        """
        Invalidate cached data for a user.
        
        Args:
            user_id: User's UUID
            cache_pattern: Optional pattern to match specific cache keys
            
        Returns:
            Number of cache entries invalidated
        """
        try:
            client = get_supa_service_client()
            
            query = client.table("user_performance_cache").delete().eq("user_id", user_id)
            
            if cache_pattern:
                query = query.like("cache_key", f"%{cache_pattern}%")
            
            result = query.execute()
            
            invalidated_count = len(result.data) if result.data else 0
            self._cache_stats["invalidations"] += invalidated_count
            
            logger.info(f"[UserPerformanceManager] Invalidated {invalidated_count} cache entries for user {user_id}")
            return invalidated_count
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error invalidating cache: {e}")
            return 0
    
    # ========================================================================
    # Private Helper Methods
    # ========================================================================
    
    def _generate_cache_key(
        self,
        user_id: str,
        cache_strategy: Optional[CacheStrategy] = None
    ) -> str:
        """Generate deterministic cache key for complete portfolio data"""
        # Include key factors that affect data
        key_components = [
            "complete_portfolio",
            "v1",  # Version
            user_id,
            cache_strategy.value if cache_strategy else "default",
            datetime.now(timezone.utc).strftime("%Y-%m-%d")  # Date for daily cache buckets
        ]
        
        key_string = ":".join(key_components)
        
        # Hash if too long
        if len(key_string) > 200:
            return f"complete_portfolio:v1:{hashlib.sha256(key_string.encode()).hexdigest()[:16]}"
        
        return key_string
    
    async def _calculate_cache_ttl(
        self,
        user_id: str,
        complete_data: CompletePortfolioData,
        cache_strategy: Optional[CacheStrategy] = None
    ) -> Tuple[timedelta, CacheStrategy]:
        """Calculate intelligent cache TTL based on multiple factors"""
        try:
            # Determine market status
            market_status = complete_data.portfolio_metrics.market_status
            is_market_open = market_status.is_open
            is_weekend = datetime.now(timezone.utc).weekday() >= 5
            
            # Estimate user activity level (simplified)
            user_activity = await self._estimate_user_activity(user_id)
            
            # Get data completeness
            data_completeness = complete_data.metadata.data_completeness.overall_completeness
            
            # Calculate TTL using configuration
            ttl, strategy = self.cache_config.calculate_ttl(
                market_open=is_market_open,
                user_activity_level=user_activity,
                data_completeness=data_completeness,
                is_weekend=is_weekend
            )
            
            # Override with provided strategy if specified
            final_strategy = cache_strategy or strategy
            
            return ttl, final_strategy
            
        except Exception as e:
            logger.warning(f"[UserPerformanceManager] Error calculating cache TTL: {e}")
            # Fallback to conservative strategy
            return timedelta(hours=1), CacheStrategy.CONSERVATIVE
    
    async def _aggregate_portfolio_data(
        self,
        user_id: str,
        user_token: str
    ) -> Dict[str, Any]:
        """Aggregate data from all services in parallel where possible"""
        aggregated_data = {
            "portfolio_metrics": None,
            "detailed_dividends": [],
            "currency_conversions": {},
            "market_analysis": {}
        }
        
        try:
            # Step 1: Get core portfolio metrics (this orchestrates most other services)
            portfolio_metrics = await portfolio_metrics_manager.get_portfolio_metrics(
                user_id=user_id,
                user_token=user_token,
                metric_type="dashboard",
                force_refresh=False
            )
            aggregated_data["portfolio_metrics"] = portfolio_metrics
            
            # Validate that core metrics were obtained successfully
            if not portfolio_metrics:
                raise ValueError("Failed to obtain core portfolio metrics")
            
            # Step 2: Get detailed dividend data in parallel with other operations
            tasks = [
                self._get_detailed_dividend_data(user_id, user_token),
                self._get_currency_conversion_data(user_id, portfolio_metrics),
                self._get_market_analysis_data(portfolio_metrics)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results with error handling
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"[UserPerformanceManager] Task {i} failed: {result}")
                    continue
                
                if i == 0:  # Dividend data
                    aggregated_data["detailed_dividends"] = result
                elif i == 1:  # Currency conversions
                    aggregated_data["currency_conversions"] = result
                elif i == 2:  # Market analysis
                    aggregated_data["market_analysis"] = result
            
            return aggregated_data
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error aggregating portfolio data: {e}")
            # Return partial data with error info
            aggregated_data["error"] = str(e)
            return aggregated_data
    
    async def _get_detailed_dividend_data(
        self,
        user_id: str,
        user_token: str
    ) -> List[Dict[str, Any]]:
        """Get detailed dividend data with enhanced information"""
        try:
            # Get dividends from service
            dividend_result = await self.dividend_service.get_user_dividends(
                user_id, user_token, confirmed_only=False
            )
            
            if dividend_result.get("success"):
                return dividend_result.get("dividends", [])
            else:
                logger.warning(f"[UserPerformanceManager] Dividend service failed: {dividend_result.get('error')}")
                return []
                
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error getting dividend data: {e}")
            return []
    
    async def _get_currency_conversion_data(
        self,
        user_id: str,
        portfolio_metrics: PortfolioMetrics
    ) -> Dict[str, Decimal]:
        """Get currency conversion rates for multi-currency portfolios"""
        conversions = {}
        
        try:
            # Get user's base currency
            base_currency = await portfolio_metrics_manager.get_user_base_currency(user_id)
            
            # Get unique currencies from holdings
            currencies = set()
            for holding in portfolio_metrics.holdings:
                if hasattr(holding, 'currency') and holding.currency:
                    currencies.add(holding.currency)
            
            # Get conversion rates
            today = date.today()
            for currency in currencies:
                if currency != base_currency:
                    try:
                        rate = await self.forex_manager.get_exchange_rate(
                            currency, base_currency, today
                        )
                        conversions[f"{currency}/{base_currency}"] = rate
                    except Exception as e:
                        logger.warning(f"[UserPerformanceManager] Failed to get {currency}/{base_currency} rate: {e}")
                        conversions[f"{currency}/{base_currency}"] = Decimal('1.0')  # Fallback
            
            return conversions
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error getting currency conversions: {e}")
            return {}
    
    async def _get_market_analysis_data(
        self,
        portfolio_metrics: PortfolioMetrics
    ) -> Dict[str, Any]:
        """Get additional market analysis data"""
        try:
            analysis = {
                "market_status": {
                    "is_open": portfolio_metrics.market_status.is_open,
                    "session": portfolio_metrics.market_status.session,
                    "timezone": portfolio_metrics.market_status.timezone
                },
                "portfolio_diversification": self._calculate_diversification_metrics(portfolio_metrics),
                "risk_metrics": self._calculate_risk_metrics(portfolio_metrics)
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error getting market analysis: {e}")
            return {}
    
    def _calculate_diversification_metrics(
        self,
        portfolio_metrics: PortfolioMetrics
    ) -> Dict[str, Any]:
        """Calculate portfolio diversification metrics"""
        try:
            holdings = portfolio_metrics.holdings
            if not holdings:
                return {"diversification_score": 0.0, "concentration_risk": "high"}
            
            # Calculate concentration
            total_value = sum(h.current_value for h in holdings)
            if total_value <= 0:
                return {"diversification_score": 0.0, "concentration_risk": "high"}
            
            # Calculate weights and concentration
            weights = [h.current_value / total_value for h in holdings]
            max_weight = max(weights) if weights else 0
            
            # Simple diversification score (inverted concentration)
            diversification_score = 1.0 - max_weight
            
            # Concentration risk assessment
            if max_weight > 0.5:
                concentration_risk = "high"
            elif max_weight > 0.3:
                concentration_risk = "medium"
            else:
                concentration_risk = "low"
            
            return {
                "diversification_score": float(diversification_score),
                "concentration_risk": concentration_risk,
                "largest_position_weight": float(max_weight),
                "number_of_positions": len(holdings)
            }
            
        except Exception as e:
            logger.warning(f"[UserPerformanceManager] Error calculating diversification: {e}")
            return {"diversification_score": 0.0, "concentration_risk": "unknown"}
    
    def _calculate_risk_metrics(
        self,
        portfolio_metrics: PortfolioMetrics
    ) -> Dict[str, Any]:
        """Calculate basic risk metrics"""
        try:
            # Basic risk assessment based on volatility of holdings
            risk_score = 0.0
            volatile_holdings = 0
            
            for holding in portfolio_metrics.holdings:
                # Simple volatility proxy using gain/loss percentage
                if abs(holding.gain_loss_percent) > 20:  # More than 20% gain/loss
                    volatile_holdings += 1
            
            if portfolio_metrics.holdings:
                risk_score = volatile_holdings / len(portfolio_metrics.holdings)
            
            return {
                "portfolio_risk_score": float(risk_score),
                "volatile_holdings_count": volatile_holdings,
                "risk_level": "high" if risk_score > 0.5 else "medium" if risk_score > 0.2 else "low"
            }
            
        except Exception as e:
            logger.warning(f"[UserPerformanceManager] Error calculating risk metrics: {e}")
            return {"portfolio_risk_score": 0.0, "risk_level": "unknown"}
    
    async def _validate_data_integrity(
        self,
        aggregated_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate data integrity and consistency across services"""
        validation_result = {
            "valid": True,
            "issues": [],
            "fallbacks_used": [],
            "completeness": DataCompleteness()
        }
        
        try:
            # Check portfolio metrics completeness
            portfolio_metrics = aggregated_data.get("portfolio_metrics")
            if portfolio_metrics and isinstance(portfolio_metrics, PortfolioMetrics):
                validation_result["completeness"].portfolio_metrics = True
                
                # Validate financial data consistency
                total_value_check = sum(h.current_value for h in portfolio_metrics.holdings)
                if abs(total_value_check - portfolio_metrics.performance.total_value) > Decimal('0.01'):
                    validation_result["issues"].append("Portfolio value mismatch between holdings and performance")
                    validation_result["valid"] = False
            else:
                validation_result["issues"].append("Missing or invalid portfolio metrics")
                validation_result["valid"] = False
            
            # Check dividend data completeness
            dividends = aggregated_data.get("detailed_dividends", [])
            if dividends:
                validation_result["completeness"].dividend_data = True
            
            # Check currency conversion data
            conversions = aggregated_data.get("currency_conversions", {})
            if conversions:
                validation_result["completeness"].forex_data = True
            
            # Check market analysis
            market_analysis = aggregated_data.get("market_analysis", {})
            if market_analysis:
                validation_result["completeness"].market_status = True
            
            # Always mark price data as complete if we have portfolio metrics
            if validation_result["completeness"].portfolio_metrics:
                validation_result["completeness"].price_data = True
            
            return validation_result
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error validating data integrity: {e}")
            validation_result["valid"] = False
            validation_result["issues"].append(f"Validation error: {str(e)}")
            return validation_result
    
    async def _estimate_user_activity(self, user_id: str) -> str:
        """Estimate user activity level for cache TTL calculation"""
        try:
            client = get_supa_service_client()
            
            # Check recent cache access patterns
            week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            
            result = client.table("user_performance_cache").select("access_count").eq(
                "user_id", user_id
            ).gte("last_accessed", week_ago).execute()
            
            if result.data:
                total_accesses = sum(row["access_count"] for row in result.data)
                if total_accesses > 50:  # More than 50 accesses per week
                    return "high"
                elif total_accesses > 10:  # 10-50 accesses per week
                    return "medium"
            
            return "low"
            
        except Exception as e:
            logger.warning(f"[UserPerformanceManager] Error estimating user activity: {e}")
            return "medium"  # Default to medium activity
    
    def _calculate_cache_hit_ratio(self) -> float:
        """Calculate current cache hit ratio"""
        total_requests = self._cache_stats["hits"] + self._cache_stats["misses"]
        if total_requests == 0:
            return 0.0
        return self._cache_stats["hits"] / total_requests
    
    # ========================================================================
    # Cache Management Methods
    # ========================================================================
    
    async def cleanup_expired_cache(self) -> int:
        """Clean up expired cache entries"""
        try:
            client = get_supa_service_client()
            
            # Delete entries where expires_at < now
            result = client.table("user_performance_cache").delete().lt(
                "expires_at", datetime.now(timezone.utc).isoformat()
            ).execute()
            
            cleaned_count = len(result.data) if result.data else 0
            logger.info(f"[UserPerformanceManager] Cleaned up {cleaned_count} expired cache entries")
            return cleaned_count
            
        except Exception as e:
            logger.error(f"[UserPerformanceManager] Error cleaning up cache: {e}")
            return 0
    
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        return {
            "cache_stats": self._cache_stats.copy(),
            "cache_hit_ratio": self._calculate_cache_hit_ratio(),
            "service_status": "active"
        }


# ============================================================================
# Module-level instance
# ============================================================================

user_performance_manager = UserPerformanceManager()