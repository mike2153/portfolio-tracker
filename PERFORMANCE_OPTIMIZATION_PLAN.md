# Portfolio Tracker Performance Optimization Plan

## Current Performance Issues (5-7 seconds load time with 2 stocks)

### 1. Duplicate API Calls Identified
From the logs, I can see multiple duplicate calls happening:

#### Transaction Calls (3x duplicate)
- `get_user_transactions` is called 3 times in parallel:
  - Called by portfolio metrics manager for metrics calculation
  - Called by portfolio calculator during portfolio calculation
  - Called directly by the frontend transaction API endpoint
  
#### Portfolio Calculations (2x duplicate)
- Portfolio is calculated twice:
  - Once for the portfolio endpoint
  - Once for the allocation endpoint

#### Price Fetching Issues
- `get_portfolio_prices` is called multiple times with overlapping symbols
- Cache write failures due to duplicate key constraints
- `prefetch_user_symbols` failing due to missing parameters

### 2. Database Issues
- Missing function: `is_market_holiday`
- Missing column: `market_data` in `market_info_cache` table
- Duplicate key constraint violations when writing to cache

### 3. Inefficient Frontend Data Fetching Pattern
The dashboard makes multiple separate API calls:
- `/api/portfolio` - for holdings
- `/api/allocation` - for allocation data (which recalculates portfolio)
- `/api/transactions` - for transaction list
- `/api/watchlist` - for watchlist with quotes
- Multiple calls for forex rates

## Optimization Strategy

### Phase 1: Backend Consolidation (Immediate Impact)

#### 1.1 Create Unified Dashboard Endpoint
```python
@portfolio_router.get("/dashboard")
async def backend_api_get_dashboard(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False)
) -> Dict[str, Any]:
    """
    Single endpoint that returns all dashboard data in one call:
    - Portfolio holdings
    - Allocation data
    - Recent transactions
    - Performance metrics
    - Watchlist with quotes
    """
```

#### 1.2 Fix Cache Implementation
- Fix the duplicate key constraint issue in cache writes
- Add proper error handling for cache failures
- Implement cache warming for frequently accessed data

#### 1.3 Fix Database Schema
- Add missing `is_market_holiday` function
- Add missing `market_data` column to `market_info_cache`
- Create proper indexes for performance

### Phase 2: Optimize Service Layer

#### 2.1 Portfolio Metrics Manager Enhancement
- Cache the entire portfolio calculation result
- Avoid recalculating when serving different views (portfolio vs allocation)
- Share calculated data between endpoints

#### 2.2 Transaction Service Optimization
- Cache transaction list per user
- Only invalidate cache on transaction add/update/delete
- Implement pagination properly

#### 2.3 Price Manager Optimization
- Fix `prefetch_user_symbols` parameter issue
- Batch price requests more efficiently
- Implement better price caching strategy

### Phase 3: Frontend Optimization

#### 3.1 Use Single Dashboard API Call
- Replace multiple API calls with single `/api/dashboard` call
- Update components to use shared data from context

#### 3.2 Implement Proper Loading States
- Show skeleton loaders while data loads
- Load critical data first, non-critical data async

#### 3.3 Add Client-Side Caching
- Cache dashboard data in memory
- Only refresh on user action or after timeout

## Implementation Priority

1. **Fix Database Issues** (30 min)
   - Add missing function and column
   - Fix cache write failures

2. **Create Dashboard Endpoint** (1 hour)
   - Consolidate all dashboard data
   - Reuse existing calculations

3. **Fix Duplicate Calculations** (1 hour)
   - Share portfolio calculations between endpoints
   - Fix transaction loading duplicates

4. **Update Frontend** (1 hour)
   - Use new dashboard endpoint
   - Remove duplicate API calls

## Expected Results
- Reduce API calls from 6+ to 1-2
- Reduce load time from 5-7 seconds to 1-2 seconds
- Eliminate duplicate calculations and database queries
- Improve cache hit rate from ~30% to ~80%

## Metrics to Track
- Total dashboard load time
- Number of API calls per dashboard load
- Cache hit rate
- Database query count
- Computation time for portfolio calculations