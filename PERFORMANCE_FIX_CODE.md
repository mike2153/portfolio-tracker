# Performance Optimization - Code Changes

## 1. Database Schema Fixes

### 1.1 Add Missing Function and Column
```sql
-- Add is_market_holiday function
CREATE OR REPLACE FUNCTION is_market_holiday(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
    -- Simple implementation - considers weekends as holidays
    -- Can be enhanced with actual holiday calendar
    RETURN EXTRACT(DOW FROM check_date) IN (0, 6);
END;
$$ LANGUAGE plpgsql;

-- Add market_data column to market_info_cache
ALTER TABLE market_info_cache 
ADD COLUMN IF NOT EXISTS market_data JSONB DEFAULT '{}';
```

## 2. Backend - Unified Dashboard Endpoint

### 2.1 New Dashboard Endpoint in backend_api_portfolio.py
```python
@portfolio_router.get("/dashboard")
@DebugLogger.log_api_call(api_name="BACKEND_API", sender="FRONTEND", receiver="BACKEND", operation="GET_DASHBOARD")
async def backend_api_get_dashboard(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False, description="Force refresh cache"),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, Any], APIResponse[Dict[str, Any]]]:
    """Get all dashboard data in a single optimized call"""
    logger.info(f"[backend_api_portfolio.py::backend_api_get_dashboard] === DASHBOARD REQUEST START ===")
    logger.info(f"[backend_api_portfolio.py::backend_api_get_dashboard] User: {user.get('email', 'unknown')}")
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Get portfolio metrics once and reuse
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="portfolio",
            force_refresh=force_refresh
        )
        
        # Convert holdings for both portfolio and allocation views
        holdings_list = []
        allocations = []
        colors = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime']
        
        for idx, holding in enumerate(metrics.holdings):
            # Portfolio format
            holdings_list.append({
                "symbol": holding.symbol,
                "quantity": float(holding.quantity),
                "avg_cost": float(holding.avg_cost),
                "total_cost": float(holding.total_cost),
                "current_price": float(holding.current_price),
                "current_value": float(holding.current_value),
                "gain_loss": float(holding.gain_loss),
                "gain_loss_percent": holding.gain_loss_percent,
                "dividends_received": float(holding.dividends_received) if hasattr(holding, 'dividends_received') else 0,
                "price_date": holding.price_date,
                "currency": holding.currency if hasattr(holding, 'currency') else "USD"
            })
            
            # Allocation format (only current holdings)
            if holding.quantity > 0:
                allocations.append({
                    'symbol': holding.symbol,
                    'quantity': float(holding.quantity),
                    'current_price': float(holding.current_price),
                    'cost_basis': float(holding.total_cost),
                    'current_value': float(holding.current_value),
                    'gain_loss': float(holding.gain_loss),
                    'gain_loss_percent': holding.gain_loss_percent,
                    'allocation_percent': holding.allocation_percent,
                    'color': colors[idx % len(colors)]
                })
        
        # Get recent transactions (limit to 10 for dashboard)
        recent_transactions = await supa_api_get_user_transactions(
            user_id=user_id,
            limit=10,
            offset=0,
            user_token=user_token
        )
        
        dashboard_data = {
            "portfolio": {
                "holdings": holdings_list,
                "total_value": float(metrics.performance.total_value),
                "total_cost": float(metrics.performance.total_cost),
                "total_gain_loss": float(metrics.performance.total_gain_loss),
                "total_gain_loss_percent": metrics.performance.total_gain_loss_percent
            },
            "allocation": {
                "allocations": allocations,
                "summary": {
                    "total_value": float(metrics.performance.total_value),
                    "total_cost": float(metrics.performance.total_cost),
                    "total_gain_loss": float(metrics.performance.total_gain_loss),
                    "total_gain_loss_percent": metrics.performance.total_gain_loss_percent,
                    "total_dividends": float(metrics.performance.dividends_total)
                }
            },
            "recent_transactions": recent_transactions,
            "cache_status": metrics.cache_status,
            "computation_time_ms": metrics.computation_time_ms
        }
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=dashboard_data,
                message="Dashboard data retrieved successfully",
                metadata={
                    "cache_status": metrics.cache_status,
                    "computation_time_ms": metrics.computation_time_ms
                }
            )
        else:
            return {
                "success": True,
                **dashboard_data
            }
    
    except Exception as e:
        logger.error(f"[backend_api_portfolio.py::backend_api_get_dashboard] ERROR: {str(e)}")
        raise ServiceUnavailableError("Dashboard Service", f"Failed to retrieve dashboard data: {str(e)}")
```

## 3. Frontend - Use Unified Dashboard API

### 3.1 New Dashboard Hook (hooks/api/useDashboardData.ts)
```typescript
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/utils/authFetch';

export interface DashboardData {
  portfolio: {
    holdings: any[];
    total_value: number;
    total_cost: number;
    total_gain_loss: number;
    total_gain_loss_percent: number;
  };
  allocation: {
    allocations: any[];
    summary: {
      total_value: number;
      total_cost: number;
      total_gain_loss: number;
      total_gain_loss_percent: number;
      total_dividends: number;
    };
  };
  recent_transactions: any[];
  cache_status: string;
  computation_time_ms: number;
}

export const useDashboardData = (forceRefresh = false) => {
  return useQuery({
    queryKey: ['dashboard', forceRefresh],
    queryFn: async () => {
      const response = await authFetch(
        `/api/dashboard?force_refresh=${forceRefresh}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch dashboard data');
      }
      
      return data as DashboardData;
    },
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

### 3.2 Update DashboardContext to use unified data
```typescript
// In DashboardContext.tsx
import { useDashboardData } from '@/hooks/api/useDashboardData';

// Add to context
const { data: dashboardData, isLoading: isDashboardLoading } = useDashboardData();

// Update context value to include dashboard data
const value: DashboardContextType = React.useMemo(() => ({
  // ... existing values
  dashboardData,
  isDashboardLoading,
}), [/* ... deps ... */, dashboardData, isDashboardLoading]);
```

### 3.3 Update AllocationTableApex to use context data
```typescript
// In AllocationTableApex.tsx
const { dashboardData, isDashboardLoading } = useDashboard();

// Replace usePortfolioAllocation with data from context
const allocationData = dashboardData?.allocation;
const isLoading = isDashboardLoading;
```

## 4. Fix Cache Write Failures

### 4.1 Update portfolio_metrics_manager.py
```python
async def _write_to_cache(self, cache_key: str, data: Dict[str, Any], user_token: str) -> None:
    """Write data to cache with proper error handling"""
    try:
        # Use UPSERT instead of INSERT to handle duplicates
        cache_data = {
            "cache_key": cache_key,
            "data": Json(data),
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(minutes=self.cache_ttl_minutes)).isoformat()
        }
        
        # Use upsert to avoid duplicate key errors
        response = await self.supabase_client.table("portfolio_cache").upsert(
            cache_data,
            on_conflict="cache_key"  # Handle conflicts on cache_key
        ).execute()
        
    except Exception as e:
        # Log but don't fail - cache is optional
        logger.warning(f"Cache write failed (non-critical): {str(e)}")
```

## 5. Fix prefetch_user_symbols

### 5.1 Update the call in portfolio_metrics_manager.py
```python
# In get_portfolio_metrics method, fix the prefetch call:
if symbols_to_fetch:
    await self.price_manager.prefetch_user_symbols(
        user_id=user_id,
        symbols=list(symbols_to_fetch),
        start_date=start_date,
        end_date=end_date,
        user_token=user_token
    )
```

## Expected Impact

After implementing these changes:
1. **API Calls**: Reduced from 6+ to 1 for dashboard load
2. **Load Time**: Should drop from 5-7 seconds to 1-2 seconds
3. **Database Queries**: Reduced by ~70% through consolidation
4. **Cache Efficiency**: Improved with proper upsert handling
5. **User Experience**: Faster, more responsive dashboard