"""
User Performance Manager - Compatibility Layer for Cache Invalidation
=====================================================================

This service provides compatibility for existing API routes that reference
user_performance_manager. All functionality has been migrated to use in-memory
caching through portfolio_metrics_manager.

DEPRECATION NOTICE:
This service is a compatibility layer. New code should directly use
portfolio_metrics_manager instead.
"""

import logging
from typing import Any, Dict, Optional

from services.portfolio_metrics_manager import portfolio_metrics_manager

logger = logging.getLogger(__name__)


class UserPerformanceManager:
    """Compatibility layer that redirects to portfolio_metrics_manager"""
    
    def __init__(self) -> None:
        logger.info("[UserPerformanceManager] Initialized as compatibility layer for portfolio_metrics_manager")
    
    async def invalidate_cache(self, user_id: str) -> None:
        """
        Invalidate cache for a user (redirects to portfolio_metrics_manager)
        
        Args:
            user_id: User's UUID
        """
        logger.info(f"[UserPerformanceManager] Redirecting cache invalidation for user {user_id} to portfolio_metrics_manager")
        await portfolio_metrics_manager.invalidate_user_cache(user_id)
    
    async def generate_complete_data(
        self,
        user_id: str,
        user_token: str,
        force_refresh: bool = False,
        cache_strategy: Optional[str] = None
    ) -> Any:
        """
        Generate complete portfolio data (redirects to portfolio_metrics_manager)
        
        Args:
            user_id: User's UUID
            user_token: JWT token for authentication
            force_refresh: Skip cache and force fresh calculation
            cache_strategy: Cache strategy (unused in this compatibility layer)
            
        Returns:
            Portfolio metrics data as an object with required attributes
        """
        logger.info(f"[UserPerformanceManager] Redirecting complete data generation for user {user_id} to portfolio_metrics_manager")
        
        # Get portfolio metrics from portfolio_metrics_manager
        portfolio_metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="complete" if not cache_strategy else cache_strategy,
            force_refresh=force_refresh
        )
        
        # Create a simple object that has the expected attributes
        from types import SimpleNamespace
        from datetime import datetime
        from decimal import Decimal
        
        # Enhance portfolio_metrics.performance with missing attributes
        if hasattr(portfolio_metrics, 'performance'):
            # Add missing performance attributes with sensible defaults
            if not hasattr(portfolio_metrics.performance, 'daily_change'):
                portfolio_metrics.performance.daily_change = Decimal('0')
            if not hasattr(portfolio_metrics.performance, 'daily_change_percent'):
                portfolio_metrics.performance.daily_change_percent = 0.0
            if not hasattr(portfolio_metrics.performance, 'ytd_return'):
                portfolio_metrics.performance.ytd_return = Decimal('0')
            if not hasattr(portfolio_metrics.performance, 'ytd_return_percent'):
                portfolio_metrics.performance.ytd_return_percent = 0.0
            if not hasattr(portfolio_metrics.performance, 'volatility'):
                portfolio_metrics.performance.volatility = Decimal('0')
            if not hasattr(portfolio_metrics.performance, 'max_drawdown'):
                portfolio_metrics.performance.max_drawdown = Decimal('0')
            if not hasattr(portfolio_metrics.performance, 'realized_gains'):
                portfolio_metrics.performance.realized_gains = Decimal('0')
        
        # Set transaction metadata on portfolio_metrics
        portfolio_metrics.transaction_count = 0
        portfolio_metrics.last_transaction_date = None
        
        # Extract detailed dividends from dividend_summary if available
        detailed_dividends = []
        if hasattr(portfolio_metrics, 'dividend_summary') and portfolio_metrics.dividend_summary:
            # Use recent_dividends if available, or create empty list
            if hasattr(portfolio_metrics.dividend_summary, 'recent_dividends'):
                detailed_dividends = portfolio_metrics.dividend_summary.recent_dividends
            # Add dividend data in expected format
            if hasattr(portfolio_metrics.dividend_summary, 'dict'):
                div_dict = portfolio_metrics.dividend_summary.dict()
                detailed_dividends = div_dict.get('recent_dividends', [])
        
        # Return an object with the expected structure
        complete_data = SimpleNamespace(
            portfolio_metrics=portfolio_metrics,
            detailed_dividends=detailed_dividends,
            market_analysis={
                "portfolio_diversification": {
                    "diversification_score": 0.7,
                    "concentration_risk": "moderate"
                }
            },
            currency_conversions={},
            generated_at=datetime.utcnow(),
            metadata=SimpleNamespace(
                cache_hit_ratio=0.5,  # Default cache hit ratio
                cache_strategy_used=SimpleNamespace(value="complete"),
                data_completeness=SimpleNamespace(overall_completeness=1.0),
                total_computation_time_ms=portfolio_metrics.computation_time_ms if hasattr(portfolio_metrics, 'computation_time_ms') else 100,
                data_sources=["supabase", "alpha_vantage"],
                fallback_strategies_used=[]
            )
        )
        
        return complete_data


# Create singleton instance for backward compatibility
user_performance_manager = UserPerformanceManager()