# Portfolio Tracker API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Quick Reference](#quick-reference)
3. [Architecture](#architecture)
4. [Authentication](#authentication)
5. [Response Format](#response-format)
6. [Error Handling](#error-handling)
7. [Data Flow & Storage](#data-flow--storage)
8. [Complete Endpoint List](#complete-endpoint-list)
9. [Rate Limiting](#rate-limiting)
10. [OpenAPI Specification](#openapi-specification)

## Overview

The Portfolio Tracker API is a FastAPI-based backend service that provides comprehensive portfolio management capabilities with permanent data storage in Supabase.

**Base URL**: `http://localhost:8000` (development)  
**Protocol**: REST over HTTP/HTTPS  
**Default Response Format**: Standardized JSON with metadata

## Quick Reference

### Core Endpoints

#### 🔐 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/validate` | Validate JWT token |

#### 📊 Dashboard
| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/dashboard` | Get dashboard overview | `force_refresh` |
| GET | `/api/dashboard/performance` | Portfolio vs benchmark chart | `period`, `benchmark` |
| GET | `/api/dashboard/gainers` | Top gaining holdings | `force_refresh` |
| GET | `/api/dashboard/losers` | Top losing holdings | `force_refresh` |

#### 💼 Portfolio Management
| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/portfolio` | Get holdings | `page`, `page_size` |
| GET | `/api/transactions` | List transactions | `limit`, `offset` |
| POST | `/api/transactions` | Add transaction | - |
| PUT | `/api/transactions/{id}` | Update transaction | - |
| DELETE | `/api/transactions/{id}` | Delete transaction | - |
| GET | `/api/allocation` | Portfolio allocation | `force_refresh` |
| POST | `/api/cache/clear` | Clear portfolio cache | - |

#### 🔍 Research
| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/symbol_search` | Search stocks | `q`, `limit` |
| GET | `/api/stock_overview` | Stock details | `symbol` |
| GET | `/api/quote/{symbol}` | Current price | - |
| GET | `/api/stock_prices/{symbol}` | Historical prices | `days`, `years`, `ytd` |
| GET | `/api/financials/{symbol}` | Financial statements | `data_type`, `force_refresh` |
| GET | `/api/news/{symbol}` | News & sentiment | `limit` |

#### 📈 Analytics
| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/analytics/summary` | KPI summary | - |
| GET | `/api/analytics/holdings` | Detailed holdings | `include_sold` |
| GET | `/api/analytics/dividends` | Dividend list | `confirmed_only` |
| POST | `/api/analytics/dividends/confirm` | Confirm dividend | `dividend_id` |
| POST | `/api/analytics/dividends/sync` | Sync dividends | `symbol` |
| POST | `/api/analytics/dividends/sync-all` | Sync all dividends | - |
| POST | `/api/analytics/dividends/reject` | Reject dividend | `dividend_id` |
| POST | `/api/analytics/dividends/add-manual` | Add manual dividend | - |

#### 👁️ Watchlist
| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/watchlist` | Get watchlist | `include_quotes` |
| POST | `/api/watchlist/{symbol}` | Add to watchlist | - |
| PUT | `/api/watchlist/{symbol}` | Update watchlist item | - |
| DELETE | `/api/watchlist/{symbol}` | Remove from watchlist | - |
| GET | `/api/watchlist/{symbol}/status` | Check if in watchlist | - |

#### 👤 User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get profile |
| POST | `/api/profile` | Create profile |
| PATCH | `/api/profile` | Update profile |
| GET | `/api/profile/currency` | Get base currency |

#### 💱 Forex
| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/forex/rate` | Get exchange rate | `from_currency`, `to_currency`, `date` |
| GET | `/api/forex/latest` | Latest exchange rate | `from_currency`, `to_currency` |
| POST | `/api/forex/convert` | Convert amount | `amount`, `from_currency`, `to_currency`, `date` |

## Architecture

### Three-Tier Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  Supabase   │
│  (Next.js)  │     │  (FastAPI)  │     │(PostgreSQL) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │Alpha Vantage│
                    │  (Market    │
                    │   Data)     │
                    └─────────────┘
```

**Key Principles**:
- Frontend communicates ONLY with Backend API
- Backend orchestrates all database and external API calls
- All data is permanently stored in Supabase
- Alpha Vantage is called only when data is missing or stale
- Row Level Security (RLS) enforced via JWT token forwarding

## Type Safety and Data Precision

### Financial Data Handling
The API enforces strict type safety for all financial calculations:

1. **Backend Processing**:
   - All monetary values use Python's `Decimal` type internally
   - Prevents floating-point precision errors
   - Ensures accurate financial calculations

2. **API Responses**:
   - Decimal values are serialized as JSON numbers (floats)
   - Precision is maintained during serialization
   - Example: `150.00` instead of `150.0`

3. **Frontend Handling**:
   - Should parse monetary values carefully
   - Consider using appropriate number libraries for precision
   - Display values with consistent decimal places

### Example Response with Proper Types
```json
{
  "success": true,
  "data": {
    "portfolio_value": 50000.00,
    "total_cost": 40000.00,
    "gain_loss": 10000.00,
    "gain_loss_percent": 25.00
  }
}
```

## Authentication

### JWT Token Flow
1. User authenticates via Supabase Auth in frontend
2. Frontend receives JWT token
3. All API requests include token as Bearer authentication
4. Backend validates token and extracts user credentials
5. Backend forwards token to Supabase for RLS enforcement

### Required Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Response Format

### Standard Response Structure

All API responses follow this consistent structure:

#### Success Response
```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "error": null,
  "message": "Optional success message",
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "2.0",
    "request_id": "uuid",
    "cache_status": "hit|miss|fresh",
    "computation_time_ms": 123,
    "warnings": [],
    "data_source": "database|alpha_vantage|cache"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "data": null,
  "error": "ErrorCategory",
  "message": "Human-readable error message",
  "metadata": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "2.0",
    "request_id": "uuid",
    "details": [
      {
        "code": "VALIDATION_ERROR",
        "message": "Invalid value",
        "field": "symbol",
        "details": {"type": "string_too_long"}
      }
    ]
  }
}
```

## Error Handling

### HTTP Status Codes
- **200 OK**: Successful request
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate)
- **422 Unprocessable Entity**: Business logic violation
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error
- **503 Service Unavailable**: External service failure

### Error Categories
- `ValidationError`: Input validation failures
- `AuthenticationError`: Authentication issues
- `AuthorizationError`: Permission denied
- `NotFoundError`: Resource not found
- `ConflictError`: Resource conflicts
- `RateLimitError`: Rate limit exceeded
- `ServiceError`: External service failures
- `InternalError`: Unexpected errors

## Data Flow & Storage

### Permanent Storage Approach

The API implements a permanent storage strategy where all data is stored in Supabase and external APIs are only called when necessary.

#### Data Flow Pattern

1. **Frontend Request** → Backend API (with JWT authentication)
2. **Backend Check** → Supabase Database (with RLS enforcement)
3. **If Data Exists and Fresh** → Return from Database
4. **If Data Missing or Stale** → Fetch from Alpha Vantage
5. **Store in Database** → Return to Frontend

**Critical Type Safety Requirements**:
- All financial calculations MUST use `Decimal` type in Python
- All monetary values in responses are serialized as floats for JSON compatibility
- Frontend receives float values but should handle precision appropriately

```
Frontend Request
       │
       ▼
   Backend API
       │
       ├─── Check Supabase ──── Data Fresh? ──── Yes ──── Return Data
       │                              │
       │                              No
       │                              │
       │                              ▼
       │                        Alpha Vantage API
       │                              │
       │                              ▼
       └────────────────────── Store in Supabase
                                      │
                                      ▼
                                 Return Data
```

### Database Tables

#### Core Data Tables
- **transactions**: User portfolio transactions
- **watchlist**: User watchlist items
- **users**: User profiles and preferences
- **stocks**: Stock master data
- **dividends**: Global dividend records
- **user_dividends**: User-specific dividend assignments

#### Permanent Storage Tables
- **historical_prices**: Permanent price history (not a cache)
- **company_financials**: Financial statements storage
- **price_quote_cache**: Recent quote data (short-term cache)
- **portfolio_metrics_cache**: Computed metrics cache (for performance)
- **forex_rates**: Exchange rate history

### Data Freshness Rules

| Data Type | Freshness Period | Update Trigger |
|-----------|-----------------|----------------|
| Stock Quotes | 15 minutes (market hours) | On request if stale |
| Historical Prices | 1 day | Daily batch update |
| Financial Statements | 24 hours | On request if stale |
| Dividends | 7 days | Weekly sync |
| Exchange Rates | 1 hour | On request if stale |
| Portfolio Metrics | 5 minutes | Transaction changes |

## Complete Endpoint List

### Authentication
- `GET /api/auth/validate` - Validate JWT token

### Dashboard
- `GET /api/dashboard` - Get dashboard overview with portfolio snapshot
- `GET /api/dashboard/performance` - Get portfolio vs benchmark performance data
- `GET /api/dashboard/gainers` - Get top gaining holdings
- `GET /api/dashboard/losers` - Get top losing holdings

### Portfolio Management
- `GET /api/portfolio` - Get current portfolio holdings
- `GET /api/allocation` - Get portfolio allocation breakdown
- `GET /api/transactions` - List all transactions
- `POST /api/transactions` - Add new transaction
- `PUT /api/transactions/{transaction_id}` - Update existing transaction
- `DELETE /api/transactions/{transaction_id}` - Delete transaction
- `POST /api/cache/clear` - Clear portfolio metrics cache

### Market Research
- `GET /api/symbol_search` - Search for stock symbols
- `GET /api/stock_overview` - Get comprehensive stock data
- `GET /api/quote/{symbol}` - Get real-time quote
- `GET /api/stock_prices/{symbol}` - Get historical price data
- `GET /api/financials/{symbol}` - Get financial statements
- `POST /api/financials/force-refresh` - Force refresh financial data
- `GET /api/news/{symbol}` - Get news and sentiment data

### Analytics
- `GET /api/analytics/summary` - Get analytics KPI summary
- `GET /api/analytics/holdings` - Get detailed holdings analysis
- `GET /api/analytics/dividends` - Get dividend information
- `POST /api/analytics/dividends/confirm` - Confirm pending dividend
- `POST /api/analytics/dividends/reject` - Reject dividend
- `POST /api/analytics/dividends/sync` - Sync dividends for symbol
- `POST /api/analytics/dividends/sync-all` - Sync all dividends
- `GET /api/analytics/dividends/summary` - Get dividend summary
- `POST /api/analytics/dividends/edit` - Edit dividend entry
- `POST /api/analytics/dividends/add-manual` - Add manual dividend

### Watchlist
- `GET /api/watchlist` - Get watchlist with optional quotes
- `POST /api/watchlist/{symbol}` - Add symbol to watchlist
- `PUT /api/watchlist/{symbol}` - Update watchlist item
- `DELETE /api/watchlist/{symbol}` - Remove from watchlist
- `GET /api/watchlist/{symbol}/status` - Check watchlist status

### User Profile
- `GET /api/profile` - Get user profile
- `POST /api/profile` - Create user profile
- `PATCH /api/profile` - Update user profile
- `GET /api/profile/currency` - Get base currency preference

### Foreign Exchange
- `GET /api/forex/rate` - Get exchange rate
- `GET /api/forex/latest` - Get latest exchange rate
- `POST /api/forex/convert` - Convert currency amount

### System (Development Only)
- `POST /api/debug/toggle-info-logging` - Toggle info logging
- `GET /api/debug/logging-status` - Get logging status
- `POST /api/debug/reset-circuit-breaker` - Reset circuit breaker

## Rate Limiting

### Rate Limit Rules

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|---------|
| Authentication | 10 requests | 1 minute |
| Portfolio Operations | 100 requests | 1 minute |
| Market Data | 60 requests | 1 minute |
| Analytics | 30 requests | 1 minute |
| Batch Operations | 5 requests | 1 minute |

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704114000
```

### Rate Limit Response
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "success": false,
  "error": "RateLimitError",
  "message": "Rate limit exceeded. Please retry after 60 seconds.",
  "metadata": {
    "limit": 100,
    "window": "1 minute",
    "retry_after": 60
  }
}
```

### External API Rate Limits

**Alpha Vantage (Free Tier)**:
- 5 API requests per minute
- 500 requests per day
- Circuit breaker activates after 3 consecutive failures

## Common Query Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `force_refresh` | boolean | Skip cache and fetch fresh data | false |
| `page` | integer | Page number for pagination | 1 |
| `page_size` | integer | Items per page (max: 100) | 20 |
| `limit` | integer | Maximum items to return | 100 |
| `offset` | integer | Number of items to skip | 0 |

## Authentication Required

All endpoints except the root health check require JWT authentication:

```http
Authorization: Bearer <jwt_token>
```

## OpenAPI Specification

The complete OpenAPI 3.1.0 specification for this API is available in `API_Format.json`. This specification includes:

- **Detailed Schema Definitions**: All request/response models with validation rules
- **Parameter Specifications**: Query parameters, path parameters, and request bodies
- **Security Schemes**: JWT Bearer authentication requirements
- **Component Schemas**: Reusable model definitions for transactions, profiles, watchlist items, etc.

### Key Features in OpenAPI Spec:

1. **Type Safety**: All models include strict type definitions and validation rules
2. **Decimal Precision**: Financial values support both number and string types for decimal precision
3. **Currency Support**: Multi-currency transaction and forex endpoints
4. **Comprehensive Validation**: Field constraints, enum values, and format requirements

### Using the OpenAPI Spec:

```bash
# Generate client SDKs
openapi-generator generate -i API_Format.json -g typescript-axios -o ./sdk

# Validate API responses
openapi-validator validate API_Format.json

# Import into API testing tools (Postman, Insomnia, etc.)
# The spec can be directly imported for automated testing
```

### Model Examples from OpenAPI:

**TransactionCreate Model:**
- `symbol`: 1-8 character stock symbol
- `transaction_type`: "Buy" or "Sell" 
- `quantity`: Positive number (decimal/string)
- `price`: Non-negative number (decimal/string)
- `currency`: 3-letter currency code (default: USD)
- `exchange_rate`: Rate to base currency (default: 1.0)

**WatchlistUpdate Model:**
- `target_price`: Optional positive number
- `notes`: Optional string (max 500 chars)

For complete schema details and all available endpoints, refer to `API_Format.json`.