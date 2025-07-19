
# User Login and Data Flow Analysis

## Overview
This document traces the complete data flow from user login through dashboard/analytics data loading, identifying all function calls, their purposes, and optimization opportunities.

## 1. User Login Flow

### Frontend: User Authentication
```typescript
// frontend/src/app/auth/page.tsx
supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password"
})
```
**Returns:**
```json
{
  "user": {
    "id": "28eff71a-87bd-433f-bd6c-8701801e2261",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "..."
  }
}
```

## 2. Dashboard Initial Load

### Frontend: Dashboard Page Mount
```typescript
// frontend/src/app/dashboard/page.tsx
// Multiple parallel data fetches triggered:
```

#### 2.1 Portfolio Allocation Data
```typescript
// frontend/src/hooks/usePortfolioAllocation.ts
usePortfolioAllocation() → GET /api/allocation
```

**Backend Flow:**

##### Step 1: API Endpoint
```python
# backend_api_routes/backend_api_portfolio.py
@portfolio_router.get("/allocation")
async def backend_api_get_allocation(user, force_refresh=False)
```

##### Step 2: Portfolio Metrics Manager
```python
# services/portfolio_metrics_manager.py
portfolio_metrics_manager.get_portfolio_metrics(
    user_id=user_id,
    user_token=user_token,
    metric_type="allocation",
    force_refresh=force_refresh
)
```

**Sub-calls:**
1. **Check Cache** (1 DB call)
   ```python
   _get_cached_metrics(user_id, cache_key)
   ```
   - Query: `SELECT * FROM portfolio_metrics_cache WHERE user_id = ? AND cache_key = ?`

2. **If Cache Miss - Calculate Metrics:**

   a. **Get Market Status** (2 DB calls)
   ```python
   _get_market_status()
   ```
   - Query 1: `SELECT * FROM symbol_market_info WHERE symbol = 'SPY'`
   - Query 2: `SELECT * FROM transactions WHERE symbol = 'SPY' AND market_region IS NOT NULL`

   b. **Get All Transactions** (1 DB call)
   ```python
   supa_api_get_user_transactions(user_id, user_token)
   ```
   - Query: `SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC`
   - **Returns:** List of all user transactions

   c. **Calculate Holdings** (via portfolio_calculator)
   ```python
   portfolio_calculator.calculate_holdings(user_id, user_token)
   ```
   
   **This triggers:**
   - **Get Transactions Again** (1 DB call - DUPLICATE!)
   - **Process Transactions** (in-memory calculation)
   - **Get Current Prices** (N DB calls where N = number of unique symbols)
     ```python
     price_manager.get_prices_for_symbols_from_db(symbols, user_token)
     ```
     - Query per symbol: `SELECT * FROM historical_prices WHERE symbol = ? AND date >= ? ORDER BY date DESC`

   d. **Get Dividend Summary** (1 DB call)
   ```python
   _get_dividend_summary(user_id, user_token)
   ```
   - Query: `SELECT * FROM user_dividends WHERE user_id = ? AND confirmed = true`

   e. **Get Time Series Data** (2N DB calls for N symbols)
   ```python
   _get_time_series_data(user_id, user_token, params)
   ```
   - Gets transactions again (DUPLICATE!)
   - Gets historical prices for 30-day range per symbol

3. **Cache Results** (1 DB call)
   ```python
   _cache_metrics(user_id, cache_key, metrics)
   ```
   - Query: `INSERT INTO portfolio_metrics_cache ...`

**Final Return Structure:**
```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "symbol": "AAPL",
        "company_name": "AAPL",
        "quantity": 12.0,
        "current_price": 209.11,
        "cost_basis": 2109.56,
        "current_value": 2509.32,
        "gain_loss": 399.76,
        "gain_loss_percent": 18.95,
        "dividends_received": 0,
        "allocation_percent": 30.8,
        "color": "emerald"
      }
    ],
    "summary": {
      "total_value": 8155.32,
      "total_cost": 7559.56,
      "total_gain_loss": 595.76,
      "total_gain_loss_percent": 7.88,
      "total_dividends": 54.0
    }
  }
}
```

## 3. Database Call Summary

### For Cache Miss (First Load):
1. Check cache: 1 call
2. Get market status: 2 calls
3. Get transactions: 3 calls (DUPLICATED 3x!)
4. Get current prices: 2 calls (for 2 symbols)
5. Get historical prices (time series): 2 calls
6. Get dividends: 1 call
7. Save to cache: 1 call

**Total: 12 database calls for 2 holdings**

### For Cache Hit (Subsequent Loads):
1. Check cache: 1 call
**Total: 1 database call**

## 4. Optimization Opportunities

### High Priority:
1. **Eliminate duplicate transaction fetches**
   - Pass transactions from portfolio_metrics_manager to portfolio_calculator
   - Save 2 DB calls per request

2. **Batch price queries**
   - Instead of N queries for N symbols, use: `WHERE symbol IN (?, ?, ?)`
   - Save N-1 DB calls

3. **Add in-memory price cache**
   - Cache prices for request lifecycle
   - Prevents duplicate price fetches within same request

### Medium Priority:
4. **Combine market status queries**
   - Single query instead of 2

5. **Pre-fetch common data**
   - Load user's symbols and latest prices in one query

### Optimized Flow Would Be:
1. Check cache: 1 call
2. If miss:
   - Get all data in single query with JOINs: 1 call
   - Or at most 3-4 targeted queries
3. Save to cache: 1 call

**Optimized Total: 3-5 calls instead of 12+**

## 5. Other API Endpoints Called on Dashboard

### Portfolio Performance
```
GET /api/portfolio → portfolio_metrics_manager.get_portfolio_metrics(metric_type="portfolio")
```

### Dashboard Metrics
```
GET /api/dashboard → portfolio_metrics_manager.get_portfolio_metrics(metric_type="dashboard")
```

### Recent Transactions
```
GET /api/transactions → supa_api_get_user_transactions()
```

Each follows similar patterns with potential for optimization.