# Portfolio Tracker API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [API Versioning](#api-versioning)
5. [Rate Limiting](#rate-limiting)
6. [Error Handling](#error-handling)
7. [Frontend to Backend API Endpoints](#frontend-to-backend-api-endpoints)
8. [Backend to Supabase Operations](#backend-to-supabase-operations)
9. [Backend to Alpha Vantage Integrations](#backend-to-alpha-vantage-integrations)
10. [WebSocket Connections](#websocket-connections)
11. [Integration Patterns](#integration-patterns)
12. [Identified API Bugs](#identified-api-bugs)

## Overview

The Portfolio Tracker API is a FastAPI-based backend service that provides comprehensive portfolio management capabilities. It follows a three-tier architecture where the frontend communicates exclusively with the backend, which then orchestrates calls to Supabase (database) and Alpha Vantage (market data).

**Base URL**: `http://localhost:8000` (development)  
**API Version**: 2.0.0  
**Protocol**: REST over HTTP/HTTPS

## Architecture

### Data Flow Pattern
```
Frontend → Backend API → Supabase Database
                     ↘
                      Alpha Vantage API (when market data needed)
```

**Key Principles**:
- Frontend never directly accesses Supabase or Alpha Vantage
- All authentication is handled via Supabase JWT tokens
- Backend validates and forwards user tokens for RLS (Row Level Security)
- Caching layer implemented at backend level

## Authentication

### Authentication Flow
1. User logs in via frontend using Supabase Auth
2. Frontend receives JWT token from Supabase
3. Frontend includes token in all API requests as Bearer token
4. Backend validates token and extracts user information
5. Backend forwards token to Supabase for RLS enforcement

### Required Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-API-Version: v1 or v2 (optional, defaults to v1)
```

### Token Validation Endpoint
```http
GET /api/auth/validate
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "valid": true,
  "user_id": "uuid",
  "email": "user@example.com"
}
```

## API Versioning

The API supports versioning through the `X-API-Version` header:

- **v1** (default): Legacy format for backward compatibility
- **v2**: Standardized response format with enhanced metadata

### Version Differences

**v1 Response Format**:
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful"
}
```

**v2 Response Format**:
```json
{
  "success": true,
  "data": {...},
  "error": null,
  "message": "Operation successful",
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "uuid",
    "cache_status": "hit|miss|fresh",
    "computation_time_ms": 123
  }
}
```

## Rate Limiting

### Current Implementation
- Circuit breaker pattern for external API calls
- Per-service rate limiting:
  - Alpha Vantage: 5 calls/minute, 500 calls/day (free tier)
  - Dividend API: Circuit breaker activates after 3 consecutive failures
  
### Rate Limit Headers
When rate limited, responses include:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

### Circuit Breaker Reset
```http
POST /api/debug/reset-circuit-breaker?service=alpha_vantage
Authorization: Bearer <jwt_token>
```

## Error Handling

### Standardized Error Response
```json
{
  "success": false,
  "error": "Error Category",
  "message": "Human-readable error message",
  "details": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid value",
      "field": "symbol",
      "details": {"type": "string_too_long"}
    }
  ],
  "request_id": "uuid",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Error Categories
- **400 Bad Request**: Validation errors, invalid input
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate)
- **422 Unprocessable Entity**: Business logic violation
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: External service failure

## Frontend to Backend API Endpoints

### Authentication
#### Validate Token
```http
GET /api/auth/validate
Authorization: Bearer <jwt_token>
```
Validates the user's JWT token and returns user information.

### Dashboard
#### Get Dashboard Data
```http
GET /api/dashboard?force_refresh=false
Authorization: Bearer <jwt_token>
X-API-Version: v1|v2
```
Returns portfolio snapshot including holdings, performance metrics, and transaction summary.

**Response**:
```json
{
  "success": true,
  "portfolio": {
    "total_value": 100000.00,
    "total_cost": 90000.00,
    "total_gain_loss": 10000.00,
    "total_gain_loss_percent": 11.11,
    "daily_change": 500.00,
    "daily_change_percent": 0.5,
    "holdings_count": 10
  },
  "top_holdings": [...],
  "transaction_summary": {...}
}
```

#### Get Performance Chart
```http
GET /api/dashboard/performance?period=1M&benchmark=SPY
Authorization: Bearer <jwt_token>
```
Returns time-series data for portfolio vs benchmark performance.

**Parameters**:
- `period`: 1D, 1W, 1M, 3M, 6M, 1Y, ALL
- `benchmark`: Stock symbol (default: SPY)

#### Get Top Gainers
```http
GET /api/dashboard/gainers?force_refresh=false
Authorization: Bearer <jwt_token>
```

#### Get Top Losers
```http
GET /api/dashboard/losers?force_refresh=false
Authorization: Bearer <jwt_token>
```

### Portfolio Management
#### Get Portfolio Holdings
```http
GET /api/portfolio?force_refresh=false
Authorization: Bearer <jwt_token>
```
Returns detailed portfolio holdings with current values and performance.

#### Get Transactions
```http
GET /api/transactions?limit=100&offset=0
Authorization: Bearer <jwt_token>
```

#### Add Transaction
```http
POST /api/transactions
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "symbol": "AAPL",
  "transaction_type": "Buy",
  "quantity": "10",
  "price": "150.00",
  "commission": "0",
  "currency": "USD",
  "exchange_rate": "1.0",
  "date": "2024-01-01",
  "notes": "Initial purchase"
}
```

#### Update Transaction
```http
PUT /api/transactions/{transaction_id}
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Delete Transaction
```http
DELETE /api/transactions/{transaction_id}
Authorization: Bearer <jwt_token>
```

#### Get Portfolio Allocation
```http
GET /api/allocation?force_refresh=false
Authorization: Bearer <jwt_token>
```

### Research
#### Symbol Search
```http
GET /api/symbol_search?q=AAPL&limit=50
Authorization: Bearer <jwt_token>
```
Searches for stock symbols with intelligent relevance scoring.

#### Stock Overview
```http
GET /api/stock_overview?symbol=AAPL
Authorization: Bearer <jwt_token>
```
Returns comprehensive stock data including price and fundamentals.

#### Get Quote
```http
GET /api/quote/{symbol}
Authorization: Bearer <jwt_token>
```

#### Historical Prices
```http
GET /api/historical_price/{symbol}?range=1Y
Authorization: Bearer <jwt_token>
```

#### Financial Statements
```http
GET /api/financials/{symbol}
Authorization: Bearer <jwt_token>
```

### Analytics
#### Analytics Summary
```http
GET /api/analytics/summary
Authorization: Bearer <jwt_token>
```

#### Holdings Analysis
```http
GET /api/analytics/holdings
Authorization: Bearer <jwt_token>
```

#### Dividends
```http
GET /api/analytics/dividends
Authorization: Bearer <jwt_token>
```

#### Sync Dividends
```http
POST /api/analytics/dividends/sync
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "symbol": "AAPL"
}
```

### Watchlist
#### Get Watchlist
```http
GET /api/watchlist
Authorization: Bearer <jwt_token>
```

#### Add to Watchlist
```http
POST /api/watchlist
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "symbol": "AAPL",
  "target_price": "200.00",
  "notes": "Watch for breakout"
}
```

#### Remove from Watchlist
```http
DELETE /api/watchlist/{symbol}
Authorization: Bearer <jwt_token>
```

### User Profile
#### Get Profile
```http
GET /api/profile
Authorization: Bearer <jwt_token>
```

#### Update Profile
```http
PUT /api/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "country": "US",
  "base_currency": "USD"
}
```

### Forex
#### Get Exchange Rates
```http
GET /api/forex/rates?from=USD&to=EUR,GBP,JPY
Authorization: Bearer <jwt_token>
```

#### Convert Currency
```http
POST /api/forex/convert
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "from_currency": "USD",
  "to_currency": "EUR",
  "amount": "1000.00"
}
```

### Cache Management
#### Clear Portfolio Cache
```http
POST /api/cache/clear
Authorization: Bearer <jwt_token>
```

### Debug Endpoints
#### Toggle Info Logging
```http
POST /api/debug/toggle-info-logging
Authorization: Bearer <jwt_token>
```

#### Get Logging Status
```http
GET /api/debug/logging-status
Authorization: Bearer <jwt_token>
```

## Backend to Supabase Operations

### Database Tables Accessed
1. **users** - User profiles and settings
2. **transactions** - Buy/sell transaction records
3. **watchlist** - User watchlist items
4. **historical_prices** - Cached historical price data
5. **api_cache** - General API response cache
6. **dividends** - Global dividend records
7. **user_dividends** - User-specific dividend assignments
8. **market_holidays** - Trading calendar data

### Key Supabase Operations

#### Transaction Management
```python
# Get user transactions
supabase.table('transactions').select('*').eq('user_id', user_id).execute()

# Add transaction (with RLS)
supabase.table('transactions').insert(transaction_data).execute()

# Update transaction
supabase.table('transactions').update(data).eq('id', transaction_id).execute()

# Delete transaction
supabase.table('transactions').delete().eq('id', transaction_id).execute()
```

#### Price Data Caching
```python
# Store historical prices
supabase.table('historical_prices').upsert({
    'symbol': symbol,
    'date': date,
    'open': open_price,
    'high': high_price,
    'low': low_price,
    'close': close_price,
    'volume': volume
}).execute()
```

#### API Cache Management
```python
# Cache API responses
supabase.table('api_cache').upsert({
    'cache_key': key,
    'data': response_data,
    'expires_at': expiry_time
}).execute()
```

### Row Level Security (RLS)
All user-specific tables enforce RLS policies:
- Users can only access their own data
- Backend must forward user's JWT token for RLS validation
- Service key used only for admin operations (dividend sync)

## Backend to Alpha Vantage Integrations

### Endpoints Used
1. **SYMBOL_SEARCH** - Find stocks by name/symbol
2. **GLOBAL_QUOTE** - Real-time price quotes
3. **TIME_SERIES_DAILY** - Historical daily prices
4. **OVERVIEW** - Company fundamentals
5. **INCOME_STATEMENT** - Financial statements
6. **BALANCE_SHEET** - Balance sheet data
7. **CASH_FLOW** - Cash flow statements
8. **NEWS_SENTIMENT** - News and sentiment data

### Integration Pattern
```python
# With caching
async def get_stock_data(symbol: str):
    # Check cache first
    cached = await get_from_cache(f"quote_{symbol}")
    if cached:
        return cached
    
    # Fetch from Alpha Vantage
    params = {
        'function': 'GLOBAL_QUOTE',
        'symbol': symbol,
        'apikey': ALPHA_VANTAGE_KEY
    }
    response = await make_request(params)
    
    # Cache response
    await save_to_cache(f"quote_{symbol}", response, ttl=300)
    return response
```

### Rate Limit Handling
- Free tier: 5 API requests per minute, 500 per day
- Premium tier: 60 requests per minute
- Circuit breaker activates after consecutive failures
- Automatic retry with exponential backoff

## WebSocket Connections

**Current Status**: No WebSocket connections implemented

**Potential Future Use Cases**:
- Real-time price updates
- Live portfolio value changes
- Instant notification of price alerts
- Multi-user portfolio collaboration

## Integration Patterns

### 1. Cached Data Pattern
```
Request → Check Cache → Return if Hit
                    ↓ (Cache Miss)
              Fetch from Source → Update Cache → Return
```

### 2. Fallback Pattern
```
Try Alpha Vantage → Success → Return
                ↓ (Failure)
          Try Cached Data → Return Stale Data with Warning
```

### 3. Background Update Pattern
```
Return Cached Data → Trigger Background Update → Update Cache Asynchronously
```

### 4. Circuit Breaker Pattern
```
API Call → Check Circuit State → Open: Return Error
                             ↓ Closed
                        Make Request → Success: Reset Failure Count
                                   ↓ Failure
                             Increment Failure Count → Open Circuit if Threshold
```

## Identified API Bugs

### 1. **Duplicate Dividend Routes**
- **Location**: `/api/analytics/dividends` endpoints
- **Issue**: Routes defined in both main analytics router and refactored module
- **Impact**: Potential routing conflicts and unpredictable behavior

### 2. **Missing Type Validation in User Profile**
- **Location**: User profile update endpoint
- **Issue**: `Optional[str]` allows None values for required fields
- **Impact**: Can create incomplete user profiles

### 3. **Inconsistent Error Response Formats**
- **Location**: Throughout API
- **Issue**: Some endpoints return v1 format errors even with v2 header
- **Impact**: Frontend must handle multiple error formats

### 4. **Race Condition in Price Updates**
- **Location**: Dashboard endpoint background price update
- **Issue**: Background task triggered without await, can cause data inconsistency
- **Impact**: Dashboard may show stale prices immediately after update

### 5. **JWT Token Forwarding Inconsistency**
- **Location**: Some Supabase operations
- **Issue**: Not all operations properly forward user token for RLS
- **Impact**: Potential security bypass or operation failures

### 6. **Cache Invalidation Gap**
- **Location**: Transaction CRUD operations
- **Issue**: Cache invalidated only for user, not for related data (e.g., dividends)
- **Impact**: Stale data in related endpoints after modifications

### 7. **Decimal/Float Mixing**
- **Location**: Financial calculations
- **Issue**: Some operations convert Decimal to float prematurely
- **Impact**: Potential precision loss in financial calculations

### 8. **Missing Pagination in Holdings**
- **Location**: Portfolio and analytics endpoints
- **Issue**: No pagination for large portfolios
- **Impact**: Performance degradation with many holdings

### 9. **Incomplete Market Info Handling**
- **Location**: Transaction creation
- **Issue**: Market info fetch can fail silently
- **Impact**: Missing timezone/market data for international stocks

### 10. **Debug Endpoints in Production**
- **Location**: `/api/debug/*` endpoints
- **Issue**: Debug endpoints accessible with just authentication
- **Impact**: Potential security risk if deployed to production

## Recommendations

1. **Implement WebSocket support** for real-time updates
2. **Add request rate limiting** per user, not just per service
3. **Standardize all error responses** to v2 format
4. **Add OpenAPI schema validation** for all endpoints
5. **Implement request/response logging** middleware
6. **Add API key authentication** as alternative to JWT
7. **Create batch operations** for bulk updates
8. **Add GraphQL endpoint** for flexible data queries
9. **Implement data export endpoints** (CSV, PDF)
10. **Add webhook support** for external integrations