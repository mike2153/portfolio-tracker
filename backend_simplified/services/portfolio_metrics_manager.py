"""
Portfolio Metrics Manager - Orchestration and Caching Layer
==========================================================

This manager serves as the single entry point for all portfolio metrics,
orchestrating calculations and managing a persistent cache of computed results.
"""

import asyncio
import logging
import hashlib
import json
from datetime import datetime, timedelta, timezone, date
from typing import Dict, Any, List, Optional, Tuple, Set
from decimal import Decimal
from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel, Field, validator
from fastapi import HTTPException

from services.portfolio_calculator import portfolio_calculator
from services.price_manager import price_manager
from services.dividend_service import DividendService
from supa_api.supa_api_client import get_supa_service_client
from supa_api.supa_api_jwt_helpers import create_authenticated_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)


# ============================================================================
# Data Models
# ============================================================================

class MetricsCacheStatus(str, Enum):
    """Cache status for metrics"""
    HIT = "hit"
    MISS = "miss"
    PARTIAL = "partial"
    ERROR = "error"
    STALE = "stale"


class PortfolioHolding(BaseModel):
    """Individual holding within a portfolio"""
    symbol: str
    quantity: Decimal = Field(ge=0)
    avg_cost: Decimal = Field(ge=0)
    total_cost: Decimal = Field(ge=0)
    current_price: Decimal = Field(ge=0)
    current_value: Decimal = Field(ge=0)
    gain_loss: Decimal
    gain_loss_percent: float
    dividends_received: Decimal = Field(default=Decimal("0"))
    price_date: Optional[datetime] = None
    allocation_percent: float = Field(ge=0, le=100)
    
    class Config:
        json_encoders = {
            Decimal: lambda v: float(v),
            datetime: lambda v: v.isoformat() if v else None
        }


class PortfolioPerformance(BaseModel):
    """Portfolio performance metrics"""
    total_value: Decimal = Field(ge=0)
    total_cost: Decimal = Field(ge=0)
    total_gain_loss: Decimal
    total_gain_loss_percent: float
    realized_gains: Decimal = Field(default=Decimal("0"))
    unrealized_gains: Decimal
    dividends_total: Decimal = Field(default=Decimal("0"))
    dividends_ytd: Decimal = Field(default=Decimal("0"))
    xirr: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    
    class Config:
        json_encoders = {
            Decimal: lambda v: float(v)
        }


class TimeSeriesDataPoint(BaseModel):
    """Time series data point for charts"""
    date: date
    value: Decimal
    cost_basis: Decimal = Field(default=Decimal("0"))
    gain_loss: Decimal = Field(default=Decimal("0"))
    gain_loss_percent: float = Field(default=0.0)
    
    class Config:
        json_encoders = {
            Decimal: lambda v: float(v),
            date: lambda v: v.isoformat()
        }


class MarketStatus(BaseModel):
    """Market status information"""
    is_open: bool
    session: str = "closed"  # "pre", "regular", "after", "closed"
    next_open: Optional[datetime] = None
    next_close: Optional[datetime] = None
    timezone: str = "America/New_York"
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class DividendSummary(BaseModel):
    """Dividend metrics - will be expanded in Step 5"""
    total_received: Decimal = Field(default=Decimal("0"))
    total_pending: Decimal = Field(default=Decimal("0"))
    ytd_received: Decimal = Field(default=Decimal("0"))
    count_received: int = Field(default=0)
    count_pending: int = Field(default=0)
    recent_dividends: List[Dict[str, Any]] = Field(default_factory=list)
    
    class Config:
        json_encoders = {
            Decimal: lambda v: float(v)
        }


class PortfolioMetrics(BaseModel):
    """Complete portfolio metrics response"""
    # Meta information
    user_id: str
    calculated_at: datetime
    cache_status: MetricsCacheStatus
    
    # Portfolio data
    holdings: List[PortfolioHolding]
    performance: PortfolioPerformance
    time_series: List[TimeSeriesDataPoint] = Field(default_factory=list)
    
    # Market information
    market_status: MarketStatus
    
    # Dividend information
    dividend_summary: DividendSummary
    
    # Additional metrics
    sector_allocation: Dict[str, float] = Field(default_factory=dict)
    top_performers: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Metadata
    computation_time_ms: Optional[int] = None
    data_completeness: Dict[str, bool] = Field(default_factory=dict)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# ============================================================================
# Cache Configuration
# ============================================================================

@dataclass
class CacheConfig:
    """Cache configuration settings"""
    ttl_market_open: timedelta = timedelta(minutes=15)
    ttl_market_closed: timedelta = timedelta(hours=1)
    ttl_weekend: timedelta = timedelta(hours=24)
    max_stale_age: timedelta = timedelta(days=7)
    
    def get_ttl(self, market_status: MarketStatus) -> Tuple[timedelta, datetime]:
        """Get TTL based on market status"""
        now = datetime.now(timezone.utc)
        
        # Weekend check
        if now.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return self.ttl_weekend, now + self.ttl_weekend
        
        # Market hours check
        if market_status.is_open:
            return self.ttl_market_open, now + self.ttl_market_open
        else:
            return self.ttl_market_closed, now + self.ttl_market_closed


# ============================================================================
# Main Manager Class
# ============================================================================

class PortfolioMetricsManager:
    """
    Orchestrates portfolio metric calculations and manages persistent caching.
    
    This manager:
    1. Provides a single entry point for all portfolio metrics
    2. Manages a SQL-based cache for calculated metrics
    3. Orchestrates parallel data fetching from multiple services
    4. Handles partial failures gracefully
    """
    
    def __init__(self):
        self.dividend_service = DividendService()
        self.cache_config = CacheConfig()
        
        # Circuit breaker configuration
        self._service_failures: Dict[str, int] = {}
        self._max_failures = 3
        self._failure_reset_time: Dict[str, datetime] = {}
        
        logger.info("[PortfolioMetricsManager] Initialized")
    
    # ========================================================================
    # Primary Public Method
    # ========================================================================
    
    @DebugLogger.log_api_call(
        api_name="PORTFOLIO_METRICS",
        sender="BACKEND",
        receiver="SERVICES",
        operation="GET_METRICS"
    )
    async def get_portfolio_metrics(
        self, 
        user_id: str, 
        user_token: str,
        metric_type: str = "dashboard",
        params: Optional[Dict[str, Any]] = None,
        force_refresh: bool = False
    ) -> PortfolioMetrics:
        """
        Get comprehensive portfolio metrics with intelligent caching.
        
        Args:
            user_id: User's UUID
            user_token: JWT token for authentication
            metric_type: Type of metrics requested (dashboard, analytics, etc.)
            params: Additional parameters for the request
            force_refresh: Bypass cache and force recalculation
            
        Returns:
            PortfolioMetrics: Complete portfolio data
            
        Raises:
            HTTPException: On critical failures
        """
        start_time = datetime.now()
        params = params or {}
        
        try:
            # Generate cache key
            cache_key = self._generate_cache_key(user_id, metric_type, params)
            
            # Step 1: Check cache unless force refresh
            if not force_refresh:
                cached_metrics = await self._get_cached_metrics(user_id, cache_key)
                if cached_metrics:
                    logger.info(f"[PortfolioMetricsManager] Cache hit for user {user_id}")
                    cached_metrics.cache_status = MetricsCacheStatus.HIT
                    return cached_metrics
            
            # Step 2: Calculate fresh metrics
            logger.info(f"[PortfolioMetricsManager] Cache miss, calculating for user {user_id}")
            metrics = await self._calculate_metrics(user_id, user_token, metric_type, params)
            
            # Add computation time
            computation_time = datetime.now() - start_time
            metrics.computation_time_ms = int(computation_time.total_seconds() * 1000)
            
            # Step 3: Cache the results
            await self._cache_metrics(user_id, cache_key, metrics)
            
            return metrics
            
        except Exception as e:
            logger.error(f"[PortfolioMetricsManager] Error getting metrics: {str(e)}")
            # Try to return partial cached data on error
            if not force_refresh:
                stale_metrics = await self._get_cached_metrics(user_id, cache_key, allow_stale=True)
                if stale_metrics:
                    stale_metrics.cache_status = MetricsCacheStatus.STALE
                    return stale_metrics
            raise HTTPException(status_code=500, detail=f"Failed to get portfolio metrics: {str(e)}")
    
    # ========================================================================
    # Core Calculation Logic
    # ========================================================================
    
    async def _calculate_metrics(
        self, 
        user_id: str, 
        user_token: str,
        metric_type: str,
        params: Dict[str, Any]
    ) -> PortfolioMetrics:
        """
        Calculate all portfolio metrics by orchestrating multiple services.
        Uses asyncio.gather for parallel execution where possible.
        """
        # Track data completeness
        data_completeness = {
            "holdings": False,
            "dividends": False,
            "time_series": False,
            "market_status": False
        }
        
        # Stage 1: Get market status first (affects caching)
        market_status = await self._get_market_status()
        data_completeness["market_status"] = True
        
        # Fetch transactions once for reuse
        transactions = await self._get_all_transactions(user_id, user_token)
        
        # Stage 2: Parallel fetch of independent data
        results = await asyncio.gather(
            self._get_holdings_data(user_id, user_token, transactions),
            self._get_dividend_summary(user_id, user_token, transactions),
            self._get_time_series_data(user_id, user_token, params),
            return_exceptions=True  # Don't fail everything if one service fails
        )
        
        holdings_result, dividend_result, time_series_result = results
        
        # Handle partial failures
        holdings = []
        if not isinstance(holdings_result, Exception):
            holdings = holdings_result
            data_completeness["holdings"] = True
        else:
            logger.error(f"[PortfolioMetricsManager] Holdings fetch failed: {holdings_result}")
        
        dividend_summary = DividendSummary()
        if not isinstance(dividend_result, Exception):
            dividend_summary = dividend_result
            data_completeness["dividends"] = True
        else:
            logger.warning(f"[PortfolioMetricsManager] Dividend fetch failed: {dividend_result}")
        
        time_series = []
        if not isinstance(time_series_result, Exception):
            time_series = time_series_result
            data_completeness["time_series"] = True
        else:
            logger.warning(f"[PortfolioMetricsManager] Time series fetch failed: {time_series_result}")
        
        # Stage 3: Calculate derived metrics
        performance = self._calculate_performance(holdings, dividend_summary)
        sector_allocation = self._calculate_sector_allocation(holdings)
        top_performers = self._get_top_performers(holdings)
        
        # Determine cache status
        cache_status = MetricsCacheStatus.MISS
        if any(isinstance(r, Exception) for r in results):
            cache_status = MetricsCacheStatus.PARTIAL
        
        return PortfolioMetrics(
            user_id=user_id,
            calculated_at=datetime.now(timezone.utc),
            cache_status=cache_status,
            holdings=holdings,
            performance=performance,
            time_series=time_series,
            market_status=market_status,
            dividend_summary=dividend_summary,
            sector_allocation=sector_allocation,
            top_performers=top_performers,
            data_completeness=data_completeness
        )
    
    # ========================================================================
    # Service Integration Methods
    # ========================================================================
    
    async def _get_holdings_data(self, user_id: str, user_token: str, transactions: Optional[List[Dict[str, Any]]] = None) -> List[PortfolioHolding]:
        """Fetch and transform holdings data from PortfolioCalculator"""
        if not self._is_service_available("holdings"):
            raise Exception("Holdings service is circuit broken")
        
        try:
            holdings_data = await portfolio_calculator.calculate_holdings(user_id, user_token)
            holdings = holdings_data.get("holdings", [])
            total_value = holdings_data.get("total_value", 0)
            
            # Transform to our model and add allocation percentages
            result = []
            for h in holdings:
                holding = PortfolioHolding(
                    symbol=h["symbol"],
                    quantity=Decimal(str(h["quantity"])),
                    avg_cost=Decimal(str(h["avg_cost"])),
                    total_cost=Decimal(str(h["total_cost"])),
                    current_price=Decimal(str(h["current_price"])),
                    current_value=Decimal(str(h["current_value"])),
                    gain_loss=Decimal(str(h["gain_loss"])),
                    gain_loss_percent=h["gain_loss_percent"],
                    dividends_received=Decimal(str(h.get("dividends_received", 0))),
                    price_date=datetime.fromisoformat(h["price_date"]) if h.get("price_date") else None,
                    allocation_percent=(h["current_value"] / total_value * 100) if total_value > 0 else 0
                )
                result.append(holding)
            
            self._reset_service_failures("holdings")
            return result
        except Exception as e:
            self._record_service_failure("holdings")
            raise e
    
    async def _get_dividend_summary(self, user_id: str, user_token: str, transactions: Optional[List[Dict[str, Any]]] = None) -> DividendSummary:
        """Fetch dividend summary from DividendService"""
        if not self._is_service_available("dividends"):
            logger.warning("[PortfolioMetricsManager] Dividend service is circuit broken, returning empty summary")
            return DividendSummary()
        
        try:
            # Import refactored service
            from services.dividend_service_refactored import DividendServiceRefactored
            refactored_dividend_service = DividendServiceRefactored()
            
            # Get user dividends from database
            from supa_api.supa_api_client import get_supa_service_client
            supa_client = get_supa_service_client()
            
            response = supa_client.table('user_dividends') \
                .select('*') \
                .eq('user_id', user_id) \
                .eq('confirmed', True) \
                .execute()
            
            user_dividends = response.data if response else []
            
            # Use refactored service to calculate summary
            summary_data = refactored_dividend_service.calculate_dividend_summary(user_dividends)
            
            # If transactions were provided, we can enrich the data
            if transactions:
                # Get portfolio symbols from transactions
                symbols = refactored_dividend_service.get_portfolio_symbols(transactions)
            
            # Transform to our model
            self._reset_service_failures("dividends")
            return DividendSummary(
                total_received=Decimal(str(summary_data['total_dividends'])),
                ytd_received=Decimal(str(summary_data['total_dividends_ytd'])),
                total_pending=Decimal("0"),  # Would need pending dividends query
                count_received=summary_data['confirmed_count'],
                count_pending=summary_data['pending_count'],
                next_payment_date=None,  # Would need additional query
                next_payment_amount=Decimal("0")
            )
        except Exception as e:
            self._record_service_failure("dividends")
            logger.warning(f"[PortfolioMetricsManager] Dividend service error: {e}, returning empty summary")
            return DividendSummary()
    
    async def _get_time_series_data(
        self, 
        user_id: str, 
        user_token: str,
        params: Dict[str, Any]
    ) -> List[TimeSeriesDataPoint]:
        """Get portfolio time series data"""
        if not self._is_service_available("time_series"):
            return []
        
        try:
            # Get time range from params
            range_key = params.get('range', '1M')
            
            # Get time series from portfolio calculator
            time_series, metadata = await portfolio_calculator.calculate_portfolio_time_series(
                user_id=user_id,
                user_token=user_token,
                range_key=range_key
            )
            
            # Convert to TimeSeriesDataPoint objects
            result = []
            for date_val, value in time_series:
                result.append(TimeSeriesDataPoint(
                    date=date_val,
                    value=value,
                    cost_basis=Decimal('0'),  # TODO: Track cost basis over time
                    gain_loss=Decimal('0'),
                    gain_loss_percent=0.0
                ))
            
            self._reset_service_failures("time_series")
            return result
        except Exception as e:
            self._record_service_failure("time_series")
            logger.warning(f"[PortfolioMetricsManager] Time series error: {e}")
            return []
    
    async def _get_all_transactions(self, user_id: str, user_token: str) -> List[Dict[str, Any]]:
        """Fetch all user transactions once for reuse"""
        if not self._is_service_available("transactions"):
            raise Exception("Transaction service is circuit broken")
        
        try:
            from supa_api.supa_api_transactions import supa_api_get_user_transactions
            transactions = await supa_api_get_user_transactions(
                user_id=user_id,
                limit=10000,
                user_token=user_token
            )
            self._reset_service_failures("transactions")
            return transactions or []
        except Exception as e:
            self._record_service_failure("transactions")
            logger.error(f"[PortfolioMetricsManager] Transaction fetch failed: {e}")
            raise e
    
    async def _get_market_status(self) -> MarketStatus:
        """Get current market status from PriceManager"""
        try:
            status = await price_manager.get_market_status()
            return MarketStatus(
                is_open=status.get("is_open", False),
                session=status.get("session", "closed"),
                next_open=datetime.fromisoformat(status["next_open"]) if status.get("next_open") else None,
                next_close=datetime.fromisoformat(status["next_close"]) if status.get("next_close") else None,
                timezone=status.get("timezone", "America/New_York")
            )
        except Exception as e:
            logger.warning(f"[PortfolioMetricsManager] Market status error: {e}")
            # Return default closed status on error
            return MarketStatus(is_open=False, session="closed")
    
    # ========================================================================
    # Calculation Helper Methods
    # ========================================================================
    
    def _calculate_performance(
        self, 
        holdings: List[PortfolioHolding], 
        dividend_summary: DividendSummary
    ) -> PortfolioPerformance:
        """Calculate aggregate performance metrics"""
        total_value = sum(h.current_value for h in holdings)
        total_cost = sum(h.total_cost for h in holdings)
        total_gain_loss = total_value - total_cost
        total_gain_loss_percent = (total_gain_loss / total_cost * 100) if total_cost > 0 else 0
        
        return PortfolioPerformance(
            total_value=total_value,
            total_cost=total_cost,
            total_gain_loss=total_gain_loss,
            total_gain_loss_percent=float(total_gain_loss_percent),
            realized_gains=Decimal("0"),  # TODO: Get from calculator in Step 3
            unrealized_gains=total_gain_loss,
            dividends_total=dividend_summary.total_received,
            dividends_ytd=dividend_summary.ytd_received,
            xirr=None,  # TODO: Calculate XIRR in Step 3
            sharpe_ratio=None  # TODO: Calculate Sharpe in future
        )
    
    def _calculate_sector_allocation(self, holdings: List[PortfolioHolding]) -> Dict[str, float]:
        """Calculate sector allocation percentages"""
        # TODO: This would need sector data from a company info service
        # For now, return placeholder that matches existing API
        if not holdings:
            return {}
        
        # Placeholder logic - in reality would lookup sector data
        return {
            "Technology": 40.0,
            "Finance": 25.0,
            "Healthcare": 20.0,
            "Consumer": 10.0,
            "Other": 5.0
        }
    
    def _get_top_performers(self, holdings: List[PortfolioHolding], limit: int = 5) -> List[Dict[str, Any]]:
        """Get top performing holdings"""
        if not holdings:
            return []
        
        sorted_holdings = sorted(holdings, key=lambda h: h.gain_loss_percent, reverse=True)
        
        return [
            {
                "symbol": h.symbol,
                "gain_loss_percent": h.gain_loss_percent,
                "gain_loss": float(h.gain_loss),
                "current_value": float(h.current_value)
            }
            for h in sorted_holdings[:limit]
        ]
    
    # ========================================================================
    # Cache Management
    # ========================================================================
    
    def _generate_cache_key(self, user_id: str, metric_type: str, params: Dict[str, Any]) -> str:
        """Generate deterministic cache key"""
        # Sort params for consistency
        sorted_params = sorted(params.items())
        param_str = ":".join([f"{k}={v}" for k, v in sorted_params])
        
        # Build key
        key_parts = ["portfolio", "v1", metric_type]
        if param_str:
            key_parts.append(param_str)
        
        full_key = ":".join(key_parts)
        
        # Hash if too long
        if len(full_key) > 200:
            param_hash = hashlib.sha256(param_str.encode()).hexdigest()[:16]
            return f"portfolio:v1:{metric_type}:h={param_hash}"
        
        return full_key
    
    async def _get_cached_metrics(
        self, 
        user_id: str,
        cache_key: str,
        allow_stale: bool = False
    ) -> Optional[PortfolioMetrics]:
        """Retrieve metrics from cache"""
        try:
            client = get_supa_service_client()
            
            # Query the cache table
            result = client.table("portfolio_metrics_cache").select("*").eq(
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
                return None
            
            # Deserialize metrics
            metrics_data = json.loads(cache_data["metrics_json"])
            metrics = PortfolioMetrics(**metrics_data)
            
            # Update hit count
            client.table("portfolio_metrics_cache").update({
                "hit_count": cache_data["hit_count"] + 1,
                "last_accessed": datetime.now(timezone.utc).isoformat()
            }).eq("user_id", user_id).eq("cache_key", cache_key).execute()
            
            return metrics
            
        except Exception as e:
            logger.error(f"[PortfolioMetricsManager] Cache read error: {str(e)}")
            return None
    
    async def _cache_metrics(self, user_id: str, cache_key: str, metrics: PortfolioMetrics) -> None:
        """Store metrics in cache"""
        try:
            client = get_supa_service_client()
            
            # Get TTL based on market status
            _, expires_at = self.cache_config.get_ttl(metrics.market_status)
            
            # Serialize metrics
            metrics_json = metrics.json()
            
            # Extract dependencies for cache invalidation
            dependencies = self._extract_dependencies(metrics)
            
            # Upsert to cache
            client.table("portfolio_metrics_cache").upsert({
                "user_id": user_id,
                "cache_key": cache_key,
                "metrics_json": metrics_json,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": expires_at.isoformat(),
                "last_accessed": datetime.now(timezone.utc).isoformat(),
                "hit_count": 0,
                "cache_version": 1,
                "dependencies": json.dumps(dependencies),
                "computation_time_ms": metrics.computation_time_ms
            }).execute()
            
        except Exception as e:
            logger.error(f"[PortfolioMetricsManager] Cache write error: {str(e)}")
            # Don't fail the request if cache write fails
    
    def _extract_dependencies(self, metrics: PortfolioMetrics) -> List[Dict[str, Any]]:
        """Extract cache dependencies for invalidation tracking"""
        dependencies = []
        
        # Transaction dependencies
        dependencies.append({
            "type": "transactions",
            "user_id": metrics.user_id
        })
        
        # Price dependencies for each holding
        symbols = [h.symbol for h in metrics.holdings]
        for symbol in symbols:
            dependencies.append({
                "type": "prices",
                "symbol": symbol
            })
        
        # Dividend dependencies
        dependencies.append({
            "type": "dividends",
            "user_id": metrics.user_id
        })
        
        return dependencies
    
    # ========================================================================
    # Circuit Breaker
    # ========================================================================
    
    def _record_service_failure(self, service_name: str) -> None:
        """Record a service failure for circuit breaker"""
        self._service_failures[service_name] = self._service_failures.get(service_name, 0) + 1
        self._failure_reset_time[service_name] = datetime.now() + timedelta(minutes=5)
        
        if self._service_failures[service_name] >= self._max_failures:
            logger.error(f"[PortfolioMetricsManager] Service {service_name} has failed {self._max_failures} times")
    
    def _is_service_available(self, service_name: str) -> bool:
        """Check if service is available (not circuit broken)"""
        # Check if we should reset the circuit
        if service_name in self._failure_reset_time:
            if datetime.now() > self._failure_reset_time[service_name]:
                self._reset_service_failures(service_name)
        
        return self._service_failures.get(service_name, 0) < self._max_failures
    
    def _reset_service_failures(self, service_name: str) -> None:
        """Reset failure count for a service"""
        if service_name in self._service_failures:
            del self._service_failures[service_name]
        if service_name in self._failure_reset_time:
            del self._failure_reset_time[service_name]
    
    async def reset_all_circuit_breakers(self) -> None:
        """Reset all circuit breakers (e.g., on a schedule)"""
        self._service_failures.clear()
        self._failure_reset_time.clear()
        logger.info("[PortfolioMetricsManager] All circuit breakers reset")


# ============================================================================
# Module-level instance
# ============================================================================

portfolio_metrics_manager = PortfolioMetricsManager()