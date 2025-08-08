# This file has been removed as the user_performance table has been deleted.
# All functionality has been moved to portfolio_metrics_manager with in-memory caching.
# 
# Original functionality now available through:
# - services/portfolio_metrics_manager.py - Portfolio metrics calculation and caching
# - services/cache_manager.py - In-memory cache management
#
# API endpoints should use portfolio_metrics_manager.get_portfolio_metrics() instead.