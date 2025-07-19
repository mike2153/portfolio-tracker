# Unused API Endpoints Report

## Summary
This report analyzes all API endpoints defined in the backend and identifies which ones are not being called from the frontend.

## Backend API Endpoints

### 1. Root Endpoint
- **GET /** - Health check endpoint ✅ USED (in front_api_health_check)

### 2. Authentication Routes (prefix: /api/auth)
- **GET /api/auth/validate** ✅ USED (in front_api_validate_auth_token)

### 3. Research Routes (prefix: /api)
- **GET /api/symbol_search** ✅ USED (in front_api_search_symbols)
- **GET /api/stock_overview** ✅ USED (in front_api_get_stock_overview)
- **GET /api/quote/{symbol}** ✅ USED (in front_api_get_quote)
- **GET /api/historical_price/{symbol}** ✅ USED (in front_api_get_historical_price)
- **GET /api/financials/{symbol}** ✅ USED (in front_api_get_company_financials)
- **POST /api/financials/force-refresh** ✅ USED (in front_api_force_refresh_financials)
- **GET /api/stock_prices/{symbol}** ✅ USED (in front_api_get_stock_prices)

### 4. Portfolio Routes (prefix: /api)
- **GET /api/portfolio** ✅ USED (in front_api_get_portfolio)
- **GET /api/transactions** ✅ USED (in front_api_get_transactions)
- **POST /api/cache/clear** ❌ NOT USED
- **POST /api/transactions** ✅ USED (in front_api_add_transaction)
- **PUT /api/transactions/{transaction_id}** ✅ USED (in front_api_update_transaction)
- **DELETE /api/transactions/{transaction_id}** ✅ USED (in front_api_delete_transaction)
- **GET /api/allocation** ✅ USED (in usePortfolioAllocation hook)

### 5. Dashboard Routes (prefix already includes /api)
- **GET /api/dashboard** ✅ USED (in front_api_get_dashboard)
- **GET /api/dashboard/performance** ✅ USED (in front_api_get_performance)
- **POST /api/debug/toggle-info-logging** ❌ NOT USED
- **GET /api/debug/logging-status** ❌ NOT USED
- **GET /api/dashboard/gainers** ✅ USED (in GainLossCard component)
- **GET /api/dashboard/losers** ✅ USED (in GainLossCard component)

### 6. Analytics Routes (prefix: /api/analytics)
- **GET /api/analytics/summary** ✅ USED (in front_api_get_analytics_summary and AnalyticsDividendsTab)
- **GET /api/analytics/holdings** ✅ USED (in front_api_get_analytics_holdings)
- **GET /api/analytics/dividends** ✅ USED (in front_api_get_analytics_dividends and AnalyticsDividendsTab components)
- **POST /api/analytics/dividends/confirm** ✅ USED (in front_api_confirm_dividend and AnalyticsDividendsTab components)
- **POST /api/analytics/dividends/sync** ✅ USED (in front_api_sync_dividends)
- **POST /api/analytics/dividends/sync-all** ✅ USED (in AnalyticsDividendsTab components)
- **GET /api/analytics/dividends/summary** ❌ NOT USED
- **POST /api/analytics/dividends/assign-simple** ❌ NOT USED
- **POST /api/analytics/dividends/reject** ✅ USED (in AnalyticsDividendsTabRefactored)
- **POST /api/analytics/dividends/edit** ✅ USED (in AnalyticsDividendsTabRefactored)

## Frontend-Only API Calls (Not in Backend)
These endpoints are called from the frontend but don't exist in the current backend:
- **GET /api/portfolios/{userId}/optimization** ❌ NOT FOUND (in PortfolioOptimization component)
- **GET /api/price-alerts/{userId}** ❌ NOT FOUND (in PriceAlerts component)
- **GET /api/price-alerts/{userId}/statistics** ❌ NOT FOUND (in PriceAlerts component)
- **POST /api/price-alerts/{userId}** ❌ NOT FOUND (in PriceAlerts component)
- **DELETE /api/price-alerts/{userId}/{alertId}** ❌ NOT FOUND (in PriceAlerts component)
- **POST /api/price-alerts/{userId}/check** ❌ NOT FOUND (in PriceAlerts component)
- **GET /api/stocks/{symbol}/advanced_financials** ❌ NOT FOUND (in AdvancedFinancials component)
- **GET /api/stocks/{ticker}/overview** ❌ NOT FOUND (in stock/[ticker]/page.tsx)
- **GET /api/stocks/{ticker}/historical** ❌ NOT FOUND (in stock/[ticker]/page.tsx)
- **GET /api/stocks/{ticker}/financials/{selectedStatement}** ❌ NOT FOUND (in stock/[ticker]/page.tsx)
- **GET /api/stocks/{ticker}/news** ❌ NOT FOUND (in stock/[ticker]/page.tsx)

## Summary of Unused Backend Endpoints

### Completely Unused:
1. **POST /api/cache/clear** - Portfolio cache clearing endpoint
2. **POST /api/debug/toggle-info-logging** - Debug logging toggle
3. **GET /api/debug/logging-status** - Debug logging status check
4. **GET /api/analytics/dividends/summary** - Dividend summary endpoint
5. **POST /api/analytics/dividends/assign-simple** - Simple dividend assignment

### Recommendations:
1. **Remove unused debug endpoints** if they're not needed for production
2. **Consider removing or documenting** the cache/clear endpoint
3. **Investigate** why the dividend summary and assign-simple endpoints aren't used
4. **Fix or remove** the frontend components calling non-existent endpoints
5. **Note:** There appears to be duplicate dividend routes in both `backend_api_analytics.py` and `backend_api_analytics_dividend_refactored.py` - consider consolidating

## Duplicate Routes
The analytics module has duplicate dividend endpoints in two files:
- `backend_api_analytics.py` 
- `backend_api_analytics_dividend_refactored.py`

Both files define similar routes like `/api/analytics/dividends`, `/api/analytics/dividends/confirm`, etc. This could lead to conflicts or confusion.