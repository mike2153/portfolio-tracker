# Portfolio Tracker API Master Documentation

📋 **CURRENT STATE**: This documentation reflects the actual implementation as of January 2025. Post-simplification architecture with consolidated endpoints, removed caching layers, and streamlined price system.

## 📋 Documentation Status

**Implementation Status**: Fully operational backend with comprehensive API endpoints

### Current Implementation

- **Backend**: FastAPI (Python) with simplified architecture
- **Database**: Supabase with Row Level Security (RLS) - 14 cache tables removed
- **External APIs**: Alpha Vantage for EOD prices and market data
- **Authentication**: Supabase Auth with JWT tokens, strict user_id validation
- **Frontend**: React Native (Expo) with glass morphism UI
- **Type Safety**: Zero tolerance for type errors, Decimal for all financial data
- **Architecture**: Direct queries instead of cache layers, on-demand calculations

---

## Table of Contents
1. [Documentation Automation](#-documentation-automation) 🤖
2. [Architecture & Design Principles](#architecture--design-principles)
3. [Complete Endpoint Reference](#complete-endpoint-reference)
4. [Request/Response Formats](#requestresponse-formats)
5. [Authentication & Authorization](#authentication--authorization)
6. [Error Handling & Status Codes](#error-handling--status-codes)
7. [Rate Limiting & Security](#rate-limiting--security)
8. [External API Integrations](#external-api-integrations)
9. [Data Validation & Input Sanitization](#data-validation--input-sanitization)
10. [API Versioning & Compatibility](#api-versioning--compatibility)
11. [Performance & Caching](#performance--caching)
12. [Code Examples](#code-examples)

---

## Architecture & Design Principles

### Core Architecture
- **Framework**: FastAPI (Python) with async/await support
- **Database**: Supabase/PostgreSQL with Row Level Security (RLS)
- **External APIs**: Alpha Vantage for market data
- **Authentication**: Supabase Auth with JWT tokens
- **Deployment**: Docker containerized

### Data Flow Architecture
```
Frontend (Next.js) → Backend API (FastAPI) → Supabase Database
                                          ↓
                                    Alpha Vantage API (when data missing)
                                          ↓
                                    Update Supabase → Return to Frontend
```

**Key Principles**:
- All frontend requests go through the backend API
- Backend queries Supabase first, then Alpha Vantage if data is missing
- All external API data is cached in Supabase
- Strong type safety with Pydantic models and Decimal financial calculations

### Design Principles
1. **Type Safety First**: Zero tolerance for type errors, complete Pydantic validation
2. **Dual Response Format**: Legacy v1 and standardized v2 API formats
3. **Simplified Architecture**: Direct database queries, no complex caching layers
4. **Security by Default**: RLS, strict authentication with extract_user_credentials()
5. **Error Standardization**: Consistent error responses across all endpoints
6. **Performance**: Consolidated endpoints (e.g., /api/complete replaces 19 endpoints)
7. **Reliability**: On-demand calculations for data accuracy over cached values

---

## Complete Endpoint Reference

**Total Endpoints**: 47 endpoints across 9 routers
- **Authentication**: 1 endpoint
- **Research**: 8 endpoints  
- **Portfolio**: 10 endpoints
- **Dashboard**: 3 endpoints
- **Analytics**: 14 endpoints
- **Watchlist**: 5 endpoints
- **User Profile**: 4 endpoints
- **Forex**: 3 endpoints

### 🏠 Root Endpoints

#### Health Check
```http
GET /
```
**Description**: API health check
**Auth**: None required
**Response**: 
```json
{
  "status": "healthy",
  "service": "portfolio-tracker-backend",
  "version": "2.0.0"
}
```

---

### 🔐 Authentication (`/api/auth`)

#### Validate Token
```http
GET /api/auth/validate
```
**Description**: Validate JWT token and get user info
**Auth**: Required (JWT in Authorization header)
**Response**: 
```json
{
  "valid": true,
  "user_id": "uuid",
  "email": "user@example.com"
}
```

---

### 🏆 Complete Portfolio Data (`/api`) - **CROWN JEWEL ENDPOINT**

#### Get Complete Portfolio Data
```http
GET /api/portfolio/complete
```
**Description**: **Crown Jewel Endpoint** - Comprehensive portfolio data in a single response, replacing 19+ individual API calls. Uses UserPerformanceManager for complete data aggregation
**WARNING**: Frontend currently calls `/api/complete` but must use `/api/portfolio/complete`
**Auth**: Required (JWT Bearer token)
**Headers**:
- `Authorization: Bearer <jwt_token>`
- `X-API-Version: v1|v2` (optional, defaults to v1)

**Query Parameters**:
- `force_refresh` (boolean): Force cache refresh (default: false)
- `benchmark` (string): Benchmark symbol for performance comparison (default: "SPY")

**Response v1 (Comprehensive)**:
```json
{
  "success": true,
  "portfolio_data": {
    "total_value": 150000.00,
    "total_cost": 120000.00,
    "total_gain_loss": 30000.00,
    "total_gain_loss_percent": 25.0,
    "daily_change": 1500.00,
    "daily_change_percent": 1.0,
    "holdings_count": 12,
    "holdings": [
      {
        "symbol": "AAPL",
        "quantity": 100.0,
        "avg_cost": 150.00,
        "current_price": 175.00,
        "current_value": 17500.00,
        "allocation": 11.67,
        "total_gain_loss": 2500.00,
        "total_gain_loss_percent": 16.67,
        "sector": "Technology",
        "region": "US"
      }
    ]
  },
  "performance_data": {
    "portfolio_performance": [
      {"date": "2024-01-01", "value": 100000.00},
      {"date": "2024-01-02", "value": 101500.00}
    ],
    "benchmark_performance": [
      {"date": "2024-01-01", "value": 100000.00},
      {"date": "2024-01-02", "value": 100750.00}
    ],
    "metrics": {
      "portfolio_return_pct": 15.5,
      "index_return_pct": 12.3,
      "outperformance_pct": 3.2,
      "sharpe_ratio": 1.2,
      "volatility": 18.5,
      "max_drawdown": -12.3
    }
  },
  "allocation_data": {
    "by_sector": [
      {"sector": "Technology", "value": 75000.00, "percentage": 50.0},
      {"sector": "Healthcare", "value": 30000.00, "percentage": 20.0}
    ],
    "by_region": [
      {"region": "US", "value": 120000.00, "percentage": 80.0},
      {"region": "Europe", "value": 30000.00, "percentage": 20.0}
    ]
  },
  "dividend_data": {
    "ytd_received": 1200.00,
    "total_received": 2400.00,
    "total_pending": 350.00,
    "confirmed_count": 8,
    "pending_count": 3,
    "recent_dividends": [
      {
        "symbol": "AAPL",
        "amount": 24.00,
        "ex_date": "2024-02-09",
        "pay_date": "2024-02-15",
        "confirmed": true
      }
    ]
  },
  "transactions_summary": {
    "total_invested": 120000.00,
    "total_sold": 5000.00,
    "net_invested": 115000.00,
    "total_transactions": 48,
    "recent_transactions": [
      {
        "symbol": "AAPL",
        "type": "BUY",
        "quantity": 10,
        "price": 175.00,
        "date": "2024-01-15"
      }
    ]
  },
  "time_series_data": {
    "chart_data": {
      "portfolio_values": [
        {"date": "2024-01-01", "value": 100000.00},
        {"date": "2024-01-02", "value": 101500.00}
      ],
      "benchmark_values": [
        {"date": "2024-01-01", "value": 100000.00},
        {"date": "2024-01-02", "value": 100750.00}
      ]
    }
  },
  "metadata": {
    "cache_status": "hit",
    "computation_time_ms": 145,
    "data_freshness": "2024-01-15T10:30:00Z",
    "replaced_endpoints": 19,
    "performance_improvement": "87.5% fewer API calls"
  }
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "portfolio_data": { /* same portfolio structure */ },
    "performance_data": { /* same performance structure */ },
    "allocation_data": { /* same allocation structure */ },
    "dividend_data": { /* same dividend structure */ },
    "transactions_summary": { /* same transactions structure */ },
    "time_series_data": { /* same time series structure */ }
  },
  "message": "Complete portfolio data retrieved successfully",
  "metadata": {
    "cache_status": "hit",
    "computation_time_ms": 145,
    "data_freshness": "2024-01-15T10:30:00Z",
    "replaced_endpoints": 19,
    "performance_improvement": "87.5% fewer API calls",
    "benchmark": "SPY",
    "force_refresh": false
  }
}
```

**Performance Benefits**:
- **87.5% reduction** in API calls (19 calls → 1 call)
- **80% faster** dashboard load times (3-5s → 0.5-1s)
- **Instant page navigation** after initial load
- **30-minute intelligent caching** with cross-page persistence

**Migration Notes**:
⚠️ **DEPRECATED ENDPOINTS**: The following dashboard endpoints have been consolidated into `/api/complete`:
- ❌ `GET /api/dashboard` (removed)
- ❌ `GET /api/dashboard/performance` (removed)
- ❌ `GET /api/dashboard/gainers` (removed)
- ❌ `GET /api/dashboard/losers` (removed)

**Frontend Integration**:
```typescript
// New pattern - single call loads everything
const { data } = useQuery({
  queryKey: ['complete-portfolio'],
  queryFn: () => apiClient.get('/api/portfolio/complete'), // FIXED: was /api/complete
  staleTime: 30 * 60 * 1000, // 30 minutes
});

// Extract specific data sections
const portfolioSummary = data?.portfolio_data;
const performanceChart = data?.time_series_data?.chart_data;
const dividendSummary = data?.dividend_data;
```

#### Get Historical Portfolio Performance
```http
GET /api/portfolio/performance/historical
```
**Description**: Historical portfolio performance vs benchmark
**Auth**: Required
**Query Parameters**:
- `period` (string): Time period ("1Y", "3M", "6M", "YTD", default: "1Y")
- `benchmark` (string): Benchmark symbol (default: "SPY")

**Response**:
```json
{
  "success": true,
  "data": {
    "portfolio_performance": [
      {"date": "2024-01-01", "value": 100000.00},
      {"date": "2024-01-02", "value": 101500.00}
    ],
    "benchmark_performance": [
      {"date": "2024-01-01", "value": 100000.00},
      {"date": "2024-01-02", "value": 100750.00}
    ],
    "metrics": {
      "portfolio_return": 15.5,
      "benchmark_return": 12.3,
      "alpha": 3.2
    }
  }
}
```

---

### 💼 Portfolio Management (`/api`)

#### Get Portfolio Holdings
```http
GET /api/portfolio
```
**Description**: Current portfolio holdings calculated from transactions using PortfolioCalculator (the authoritative calculation engine) via PortfolioMetricsManager orchestration
**Auth**: Required (JWT Bearer token)
**Query Parameters**:
- `force_refresh` (boolean): Force cache refresh (default: false)

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "holdings": [
    {
      "symbol": "AAPL",
      "quantity": 100.0,
      "avg_cost": 150.00,
      "total_cost": 15000.00,
      "current_price": 175.00,
      "current_value": 17500.00,
      "gain_loss": 2500.00,
      "gain_loss_percent": 16.67,
      "dividends_received": 200.00,
      "price_date": "2024-01-15",
      "currency": "USD",
      "base_currency_value": 17500.00
    }
  ],
  "total_value": 150000.00,
  "total_cost": 120000.00,
  "total_gain_loss": 30000.00,
  "total_gain_loss_percent": 25.0,
  "base_currency": "USD",
  "cache_status": "hit",
  "computation_time_ms": 32
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "holdings": [ /* same holdings structure */ ],
    "total_value": 150000.00,
    "total_cost": 120000.00,
    "total_gain_loss": 30000.00,
    "total_gain_loss_percent": 25.0,
    "base_currency": "USD"
  },
  "message": "Portfolio data retrieved successfully",
  "metadata": {
    "cache_status": "hit",
    "computation_time_ms": 32
  }
}
```

#### Get Transactions
```http
GET /api/transactions
```
**Description**: User's transaction history with RLS enforcement
**Auth**: Required (JWT Bearer token)
**Query Parameters**:
- `limit` (int): Max transactions (default: 100)
- `offset` (int): Pagination offset (default: 0)

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "symbol": "AAPL",
      "transaction_type": "Buy",
      "quantity": 50.0,
      "price": 150.00,
      "commission": 1.99,
      "currency": "USD",
      "exchange_rate": 1.0,
      "date": "2024-01-15",
      "notes": "Initial purchase",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 25
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "transactions": [ /* same transaction structure */ ],
    "count": 25
  },
  "message": "Transactions retrieved successfully"
}
```

#### Add Transaction
```http
POST /api/transactions
```
**Description**: Add new buy/sell transaction with automatic dividend sync and market info lookup
**Auth**: Required (JWT Bearer token)
**Content-Type**: `application/json`

**Request Body (Pydantic model: TransactionCreate)**:
```json
{
  "symbol": "AAPL",
  "transaction_type": "Buy",
  "quantity": "50.0",
  "price": "150.00",
  "commission": "1.99",
  "currency": "USD",
  "exchange_rate": "1.0",
  "date": "2024-01-15",
  "notes": "Optional notes"
}
```

**Validation Rules (Pydantic with Field validators)**:
- `symbol`: 1-8 characters, regex `^[A-Z0-9.-]{1,8}$`, auto-uppercased
- `transaction_type`: Literal["Buy", "Sell"]
- `quantity`: Decimal > 0
- `price`: Decimal >= 0
- `commission`: Decimal >= 0 (default: 0)
- `currency`: 3-letter ISO pattern `^[A-Z]{3}$` (default: "USD")
- `exchange_rate`: Decimal > 0 (default: 1.0)
- `date`: Cannot be future date, not before 1970-01-01
- `notes`: Max 500 characters, HTML sanitized

**Auto-Processing**:
- Market info lookup via Alpha Vantage symbol search
- Automatic dividend sync for Buy transactions from transaction date onward
- Portfolio cache invalidation
- user_id forced from JWT token (security)

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "transaction": { /* created transaction object */ },
  "message": "Buy transaction added successfully"
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "transaction": { /* created transaction object */ }
  },
  "message": "Buy transaction added successfully"
}
```

#### Update Transaction
```http
PUT /api/transactions/{transaction_id}
```
**Description**: Update existing transaction with RLS enforcement
**Auth**: Required (JWT Bearer token)
**Path Parameters**:
- `transaction_id` (string): UUID of transaction to update
**Request Body**: TransactionUpdate model (same structure as TransactionCreate)

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "transaction": { /* updated transaction object */ },
  "message": "Transaction updated successfully"
}
```

#### Delete Transaction
```http
DELETE /api/transactions/{transaction_id}
```
**Description**: Delete transaction with RLS enforcement and cache invalidation
**Auth**: Required (JWT Bearer token)
**Path Parameters**:
- `transaction_id` (string): UUID of transaction to delete

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "deleted": true
  },
  "message": "Transaction deleted successfully"
}
```

#### Get Portfolio Allocation
```http
GET /api/allocation
```
**Description**: Comprehensive portfolio allocation with sector/region breakdown using built-in mappings
**Auth**: Required (JWT Bearer token)
**Query Parameters**:
- `force_refresh` (boolean): Force cache refresh (default: false)

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "symbol": "AAPL",
        "company_name": "AAPL",
        "quantity": 100.0,
        "current_price": 175.00,
        "cost_basis": 15000.00,
        "current_value": 17500.00,
        "gain_loss": 2500.00,
        "gain_loss_percent": 16.67,
        "dividends_received": 200.00,
        "realized_pnl": 0.00,
        "allocation_percent": 11.67,
        "color": "emerald",
        "sector": "Technology",
        "region": "US"
      }
    ],
    "summary": {
      "total_value": 150000.00,
      "total_cost": 120000.00,
      "total_gain_loss": 30000.00,
      "total_gain_loss_percent": 25.0,
      "total_dividends": 1200.00,
      "cache_status": "hit",
      "computation_time_ms": 28
    }
  }
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "allocations": [ /* same allocation structure */ ],
    "summary": { /* same summary structure */ }
  },
  "message": "Portfolio allocation data retrieved successfully",
  "metadata": {
    "cache_status": "hit",
    "computation_time_ms": 28
  }
}
```

**Built-in Sector Mappings**: Technology, Finance, Healthcare, Consumer, Energy, ETF, Industrial, Real Estate, Other
**Built-in Region Mappings**: US, Europe, Asia, Canada, International, Emerging Markets

#### Clear Portfolio Cache
```http
POST /api/cache/clear
```
**Description**: Invalidate all portfolio metrics cache entries for the current user
**Auth**: Required (JWT Bearer token)

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "message": "Portfolio cache cleared successfully"
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "cleared": true
  },
  "message": "Portfolio cache cleared successfully"
}
```

---

### 🔍 Market Research (`/api`)

#### Symbol Search
```http
GET /api/symbol_search
```
**Description**: Combined search for stock symbols with intelligent scoring (cache + Alpha Vantage)
**Auth**: Required (JWT Bearer token)
**Query Parameters**:
- `q` (string): Search query (required, min 1 character)
- `limit` (int): Max results (default: 50)

**Response v1 (Legacy)**:
```json
{
  "ok": true,
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "type": "Equity",
      "region": "United States",
      "marketOpen": "09:30",
      "marketClose": "16:00",
      "timezone": "UTC-05",
      "currency": "USD",
      "matchScore": 1.0
    }
  ],
  "total": 15,
  "query": "apple",
  "limit": 50
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "results": [ /* same results structure */ ],
    "total": 15,
    "query": "apple",
    "limit": 50
  },
  "message": "Found 15 results for 'apple'"
}
```

#### Stock Overview
```http
GET /api/stock_overview
```
**Description**: Comprehensive stock data combining real-time quote and company fundamentals
**Auth**: Required (JWT Bearer token)
**Query Parameters**:
- `symbol` (string): Stock symbol (required)

**Response v1 (Legacy)**:
```json
{
  "success": true,
  "symbol": "AAPL",
  "price_data": {
    "price": 175.00,
    "change": 2.50,
    "change_percent": 1.45,
    "volume": 45000000,
    "high": 176.00,
    "low": 172.50,
    "open": 173.00,
    "previous_close": 172.50
  },
  "fundamentals": {
    "MarketCapitalization": "2750000000000",
    "PERatio": "28.5",
    "PEGRatio": "1.2",
    "BookValue": "4.85",
    "DividendPerShare": "0.24",
    "EPS": "6.15"
  },
  "price_metadata": {
    "source": "alpha_vantage",
    "timestamp": "2024-01-15T16:00:00Z"
  }
}
```

**Response v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "price_data": { /* same price data structure */ },
    "fundamentals": { /* same fundamentals structure */ },
    "price_metadata": { /* same metadata structure */ }
  },
  "message": "Stock overview data retrieved successfully"
}
```

#### Get Quote
```http
GET /api/quote/{symbol}
```
**Description**: Real-time stock quote with price manager integration
**Auth**: Required (JWT Bearer token)
**Path Parameters**:
- `symbol` (string): Stock symbol (required)

**Response**:
```json
{
  "success": true,
  "data": {
    "price": 175.00,
    "change": 2.50,
    "change_percent": 1.45,
    "volume": 45000000,
    "high": 176.00,
    "low": 172.50,
    "open": 173.00,
    "previous_close": 172.50
  },
  "metadata": {
    "source": "alpha_vantage",
    "timestamp": "2024-01-15T16:00:00Z",
    "cache_status": "miss"
  }
}
```

#### Get Historical Prices
```http
GET /api/stock_prices/{symbol}
```
**Description**: Historical price data with flexible periods using vantage_api_get_historical_price
**Auth**: Required (JWT Bearer token)
**Path Parameters**:
- `symbol` (string): Stock symbol (required)
**Query Parameters**:
- `days` (int): Number of days back (optional)
- `years` (int): Number of years back (optional)
- `ytd` (boolean): Year-to-date data (optional)

**Response**:
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "price_data": [
      {
        "date": "2024-01-15",
        "open": 173.00,
        "high": 176.00,
        "low": 172.50,
        "close": 175.00,
        "adjusted_close": 175.00,
        "volume": 45000000
      }
    ],
    "start_date": "2023-01-15",
    "end_date": "2024-01-15",
    "data_points": 252
  },
  "metadata": {
    "source": "alpha_vantage",
    "cache_status": "hit"
  }
}
```

#### Get Company Financials
```http
GET /api/financials/{symbol}
```
**Description**: Company financial data with intelligent caching via FinancialsService
**Auth**: Required (JWT Bearer token)
**Path Parameters**:
- `symbol` (string): Stock symbol (required)
**Query Parameters**:
- `data_type` (string): "OVERVIEW", "INCOME_STATEMENT", "BALANCE_SHEET", "CASH_FLOW" (optional, defaults to "OVERVIEW")
- `force_refresh` (boolean): Force API refresh (optional, default: false)

**Response**:
```json
{
  "success": true,
  "data": {
    "Symbol": "AAPL",
    "AssetType": "Common Stock",
    "Name": "Apple Inc",
    "Description": "Apple Inc. designs, manufactures...",
    "CIK": "320193",
    "Exchange": "NASDAQ",
    "Currency": "USD",
    "Country": "USA",
    "Sector": "TECHNOLOGY",
    "Industry": "Electronic Equipment",
    "MarketCapitalization": "2750000000000",
    "EBITDA": "125000000000",
    "PERatio": "28.5",
    "PEGRatio": "1.2",
    "BookValue": "4.85",
    "DividendPerShare": "0.24",
    "DividendYield": "0.0014",
    "EPS": "6.15",
    "52WeekHigh": "198.23",
    "52WeekLow": "150.12",
    "50DayMovingAverage": "172.45",
    "200DayMovingAverage": "168.32",
    "SharesOutstanding": "15700000000",
    "DividendDate": "2024-02-15",
    "ExDividendDate": "2024-02-09"
  },
  "metadata": {
    "symbol": "AAPL",
    "data_type": "OVERVIEW",
    "cache_status": "hit",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Get News
```http
GET /api/news/{symbol}
```
**Description**: News and sentiment data for symbol via vantage_api_get_news_sentiment
**Auth**: Required (JWT Bearer token)
**Path Parameters**:
- `symbol` (string): Stock symbol (required)
**Query Parameters**:
- `limit` (int): Max articles (optional, default: 50)

**Response**:
```json
{
  "success": true,
  "data": {
    "items": "50",
    "sentiment_score_definition": "x <= -0.35: Bearish; -0.35 < x <= -0.15: Somewhat-Bearish; -0.15 < x < 0.15: Neutral; 0.15 <= x < 0.35: Somewhat_Bullish; x >= 0.35: Bullish",
    "relevance_score_definition": "0 < x <= 1, with a higher score indicating higher relevance.",
    "feed": [
      {
        "title": "Apple Reports Strong Q4 Results",
        "url": "https://example.com/news/1",
        "time_published": "20240115T160000",
        "authors": ["John Doe"],
        "summary": "Apple reported better than expected quarterly results...",
        "banner_image": "https://example.com/image.jpg",
        "source": "Reuters",
        "category_within_source": "Technology",
        "source_domain": "reuters.com",
        "topics": [
          {
            "topic": "Technology",
            "relevance_score": "0.5"
          }
        ],
        "overall_sentiment_score": 0.25,
        "overall_sentiment_label": "Somewhat-Bullish",
        "ticker_sentiment": [
          {
            "ticker": "AAPL",
            "relevance_score": "0.8",
            "ticker_sentiment_score": "0.3",
            "ticker_sentiment_label": "Somewhat-Bullish"
          }
        ]
      }
    ]
  }
}
```

#### Get Company Financials
```http
GET /api/financials/{symbol}
```
**Description**: Get company financial statements with intelligent caching
**Auth**: Required (JWT Bearer token)
**Path Parameters**:
- `symbol` (string): Stock symbol (required)
**Query Parameters**:
- `data_type` (string): OVERVIEW, INCOME_STATEMENT, BALANCE_SHEET, CASH_FLOW (default: OVERVIEW)
- `force_refresh` (boolean): Force API refresh (default: false)

**Response**:
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "data_type": "OVERVIEW",
    "financial_data": {
      "Symbol": "AAPL",
      "AssetType": "Common Stock",
      "Name": "Apple Inc",
      "Exchange": "NASDAQ",
      "Currency": "USD",
      "Country": "USA",
      "Sector": "TECHNOLOGY",
      "Industry": "Electronic Equipment",
      "MarketCapitalization": "3000000000000",
      "BookValue": "4.84",
      "DividendPerShare": "0.96"
    }
  },
  "metadata": {
    "cache_hit": true,
    "cached_at": "2024-01-15T10:30:00Z",
    "expires_at": "2024-01-16T10:30:00Z"
  }
}
```

#### Force Refresh Financials  
```http
POST /api/financials/force-refresh
```
**Description**: Force refresh financial data (admin/dev endpoint)
**Auth**: Required (JWT Bearer token)
**Query Parameters**:
- `symbol` (string): Stock symbol (required)
- `data_type` (string): Financial data type (default: OVERVIEW)

**Response**: Same as GET /api/financials/{symbol} with fresh data

---

### 📈 Analytics (`/api/analytics`)

#### Get Analytics Summary
```http
GET /api/analytics/summary
```
**Description**: KPI cards data for analytics dashboard
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "data": {
    "portfolio_value": 150000.00,
    "total_profit": 31200.00,
    "total_profit_percent": 25.0,
    "irr_percent": 18.5,
    "passive_income_ytd": 1200.00,
    "cash_balance": 0.00,
    "dividend_summary": {
      "ytd_received": 1200.00,
      "total_received": 2400.00,
      "total_pending": 350.00,
      "confirmed_count": 8,
      "pending_count": 3
    }
  },
  "metadata": {
    "user_id": "uuid",
    "optimized": true,
    "cache_status": "hit",
    "computation_time_ms": 45
  }
}
```

#### Get Detailed Holdings
```http
GET /api/analytics/holdings
```
**Description**: Comprehensive holdings data for analytics table
**Auth**: Required
**Query Parameters**:
- `include_sold` (boolean): Include sold positions

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "quantity": 100.0,
      "avg_cost": 150.00,
      "current_price": 175.00,
      "cost_basis": 15000.00,
      "current_value": 17500.00,
      "unrealized_gain": 2500.00,
      "unrealized_gain_percent": 16.67,
      "realized_pnl": 0.00,
      "dividends_received": 200.00,
      "total_profit": 2700.00,
      "total_profit_percent": 18.0,
      "total_bought": 15000.00,
      "total_sold": 0.00,
      "daily_change": 87.50,
      "daily_change_percent": 0.5,
      "irr_percent": 0.0
    }
  ],
  "metadata": {
    "total_holdings": 12,
    "include_sold": false,
    "computation_time_ms": 65
  }
}
```

#### Get Dividends
```http
GET /api/analytics/dividends
```
**Description**: User's dividend data with transaction-based confirmation
**Auth**: Required
**Query Parameters**:
- `confirmed_only` (boolean): Return only confirmed dividends

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "symbol": "AAPL",
      "amount": 0.24,
      "ex_date": "2024-02-09",
      "pay_date": "2024-02-15",
      "confirmed": true,
      "shares_held_at_ex_date": 100,
      "total_amount": 24.00,
      "created_at": "2024-01-15T10:30:00Z",
      "confirmed_at": "2024-02-15T10:30:00Z",
      "transaction_id": "uuid"
    }
  ],
  "metadata": {
    "total_dividends": 8,
    "confirmed_only": false,
    "owned_symbols": ["AAPL", "MSFT", "GOOGL"]
  }
}
```

#### Confirm Dividend
```http
POST /api/analytics/dividends/confirm
```
**Description**: Confirm dividend and create transaction
**Auth**: Required
**Query Parameters**:
- `dividend_id` (string): Dividend ID to confirm (required)
**Request Body**:
```json
{
  "edited_amount": 24.50
}
```

**Response**:
```json
{
  "success": true,
  "dividend_id": "uuid",
  "total_amount": 24.50,
  "transaction_id": "uuid",
  "message": "Dividend confirmed successfully",
  "performance_optimized": true
}
```

#### Sync Dividends
```http
POST /api/analytics/dividends/sync
```
**Description**: Manually sync dividends for a symbol
**Auth**: Required
**Query Parameters**:
- `symbol` (string): Symbol to sync (required)

**Response**:
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "dividends_synced": 2,
    "dividends_assigned": 1,
    "from_cache": false
  },
  "message": "Dividend sync completed for AAPL"
}
```

#### Sync All Dividends
```http
POST /api/analytics/dividends/sync-all
```
**Description**: Sync dividends for all user holdings (rate limited)
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "data": {
    "total_symbols": 12,
    "dividends_synced": 15,
    "dividends_assigned": 8
  },
  "message": "Synced 15 global dividends and assigned 8 to user",
  "rate_limited": false
}
```

#### Get Dividend Summary
```http
GET /api/analytics/dividends/summary
```
**Description**: Lightweight dividend summary for dividend page
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "data": {
    "ytd_received": 1200.00,
    "total_received": 2400.00,
    "total_pending": 350.00,
    "confirmed_count": 8,
    "pending_count": 3
  }
}
```

#### Reject Dividend
```http
POST /api/analytics/dividends/reject
```
**Description**: Reject a dividend (hides permanently)
**Auth**: Required
**Query Parameters**:
- `dividend_id` (string): Dividend ID to reject

#### Edit Dividend
```http
POST /api/analytics/dividends/edit
```
**Description**: Edit dividend by creating new and rejecting original
**Auth**: Required
**Query Parameters**:
- `original_dividend_id` (string): Original dividend ID
**Request Body**:
```json
{
  "ex_date": "2024-02-09",
  "pay_date": "2024-02-15",
  "amount_per_share": 0.25,
  "total_amount": 25.00
}
```

#### Add Manual Dividend
```http
POST /api/analytics/dividends/add-manual
```
**Description**: Manually add dividend entry
**Auth**: Required
**Request Body**:
```json
{
  "ticker": "AAPL",
  "company_name": "Apple Inc.",
  "payment_date": "2024-02-15",
  "total_received": 24.00,
  "amount_per_share": 0.24,
  "fee": 0.00,
  "tax": 2.40,
  "note": "Q1 2024 dividend",
  "update_cash_balance": true
}
```

#### Assign Simple Dividends
```http
POST /api/analytics/dividends/assign-simple
```
**Description**: Simple dividend assignment to users (admin/system function)
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "data": {
    "assignments_created": 5,
    "users_affected": 3
  },
  "message": "Dividend assignments completed successfully"
}
```

---

### 📋 Watchlist (`/api/watchlist`)

#### Get Watchlist
```http
GET /api/watchlist
```
**Description**: User's watchlist with optional quotes
**Auth**: Required
**Query Parameters**:
- `include_quotes` (boolean): Include current price data (default: true)

**Response**:
```json
{
  "success": true,
  "watchlist": [
    {
      "id": "uuid",
      "symbol": "TSLA",
      "target_price": 200.00,
      "notes": "Waiting for dip",
      "current_price": 185.50,
      "change": -2.50,
      "change_percent": -1.33,
      "volume": 28000000,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 5
}
```

#### Add to Watchlist
```http
POST /api/watchlist/{symbol}
```
**Description**: Add stock to watchlist
**Auth**: Required
**Request Body** (optional):
```json
{
  "target_price": 200.00,
  "notes": "Waiting for earnings"
}
```

**Response**:
```json
{
  "success": true,
  "item": { /* watchlist item */ },
  "message": "TSLA added to watchlist"
}
```

#### Update Watchlist Item
```http
PUT /api/watchlist/{symbol}
```
**Description**: Update watchlist notes/target price
**Auth**: Required
**Request Body**:
```json
{
  "target_price": 180.00,
  "notes": "Updated target after earnings"
}
```

#### Remove from Watchlist
```http
DELETE /api/watchlist/{symbol}
```
**Description**: Remove stock from watchlist
**Auth**: Required

#### Check Watchlist Status
```http
GET /api/watchlist/{symbol}/status
```
**Description**: Check if stock is in watchlist
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "is_in_watchlist": true
}
```

---

### 👤 User Profile (`/api`)

#### Get Profile
```http
GET /api/profile
```
**Description**: Get user profile including currency preference
**Auth**: Required
**Response**:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "country": "US",
  "base_currency": "USD",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

#### Create Profile
```http
POST /api/profile
```
**Description**: Create user profile
**Auth**: Required
**Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "country": "US",
  "base_currency": "USD"
}
```

#### Update Profile
```http
PATCH /api/profile
```
**Description**: Update user profile fields
**Auth**: Required
**Request Body**:
```json
{
  "first_name": "Jane",
  "base_currency": "EUR"
}
```

#### Get Base Currency
```http
GET /api/profile/currency
```
**Description**: Get user's base currency preference
**Auth**: Required
**Response**:
```json
{
  "base_currency": "USD"
}
```

---

### 💱 Forex (`/api`)

#### Get Exchange Rate
```http
GET /api/forex/rate
```
**Description**: Get exchange rate between currencies
**Auth**: Required
**Query Parameters**:
- `from_currency` (string): Source currency (required)
- `to_currency` (string): Target currency (required)
- `date` (string): Date for historical rate (YYYY-MM-DD, optional)

**Response**:
```json
{
  "success": true,
  "from_currency": "USD",
  "to_currency": "EUR",
  "date": "2024-01-15", 
  "rate": 0.8542,
  "inverse_rate": 1.1707
}
```

#### Get Latest Exchange Rate
```http
GET /api/forex/latest
```
**Description**: Get latest available exchange rate
**Auth**: Required
**Query Parameters**:
- `from_currency` (string): Source currency (required)
- `to_currency` (string): Target currency (required)

**Response**:
```json
{
  "success": true,
  "from_currency": "USD",
  "to_currency": "EUR",
  "rate": 0.8542,
  "inverse_rate": 1.1707,
  "is_fallback": false
}
```

#### Convert Currency
```http
POST /api/forex/convert
```
**Description**: Convert amount between currencies
**Auth**: Required
**Query Parameters**:
- `amount` (float): Amount to convert (required)
- `from_currency` (string): Source currency (required)
- `to_currency` (string): Target currency (required)
- `date` (string): Date for historical rate (optional)

**Response**:
```json
{
  "success": true,
  "original_amount": 1000.00,
  "converted_amount": 854.20,
  "from_currency": "USD",
  "to_currency": "EUR",
  "exchange_rate": 0.8542,
  "date": "2024-01-15"
}
```

---

### 🛠️ Debug Endpoints (`/api/debug`)

#### Toggle Info Logging
```http
POST /api/debug/toggle-info-logging
```
**Description**: Toggle info logging on/off at runtime
**Auth**: Required
**Response**:
```json
{
  "success": true,
  "info_logging_enabled": true,
  "message": "Info logging enabled"
}
```

#### Get Logging Status
```http
GET /api/debug/logging-status
```
**Description**: Get current logging configuration
**Auth**: Required
**Response**:
```json
{
  "info_logging_enabled": true
}
```

#### Debug: Toggle Info Logging
```http
POST /api/debug/toggle-info-logging
```
**Description**: Toggle info logging on/off at runtime
**Auth**: Required (JWT Bearer token)
**Response**:
```json
{
  "success": true,
  "info_logging_enabled": true,
  "message": "Info logging enabled"
}
```

#### Debug: Get Logging Status
```http
GET /api/debug/logging-status
```
**Description**: Get current logging configuration
**Auth**: Required (JWT Bearer token)
**Response**:
```json
{
  "info_logging_enabled": true
}
```

#### Debug: Reset Circuit Breaker
```http
POST /api/debug/reset-circuit-breaker
```
**Description**: Reset circuit breaker for price services
**Auth**: Required (JWT Bearer token)
**Query Parameters**:
- `service` (string): Service name ("alpha_vantage", "dividend_api") or None for all (optional)
**Response**:
```json
{
  "success": true,
  "message": "Circuit breaker reset for all services"
}
```

---

## Request/Response Formats

### API Versioning
The API supports two response formats via the `X-API-Version` header:

**v1 (Legacy Format)**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Optional message",
  "cache_status": "hit"
}
```

**v2 (Standardized Format)**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0",
    "cache_status": "hit",
    "computation_time_ms": 45
  }
}
```

### Content Types
- **Request**: `application/json`
- **Response**: `application/json`
- **Character Encoding**: UTF-8

### Date Formats
- **Dates**: ISO 8601 format (`YYYY-MM-DD`)
- **Timestamps**: ISO 8601 format with timezone (`2024-01-15T10:30:00Z`)

---

## Authentication & Authorization

### Authentication Method
- **Type**: JWT Bearer Token from Supabase Auth
- **Header**: `Authorization: Bearer <jwt_token>`
- **Provider**: Supabase Auth with session management
- **Frontend Integration**: Automatic token refresh via `authFetch` wrapper

### Token Requirements
- All endpoints (except `/` health check) require authentication
- JWT tokens contain user ID, email, and access permissions
- Tokens validated using `require_authenticated_user` dependency
- Session refresh handled automatically by frontend API client

### Helper Functions
- **`require_authenticated_user`**: FastAPI dependency for auth validation
- **`extract_user_credentials`**: Extracts user_id and token from auth data
- **Validation**: user_id is NEVER Optional - always validated as non-empty string

### Row Level Security (RLS)
- **Database-level security**: Enforced on ALL user data tables
- **Automatic filtering**: Users can only access their own data
- **JWT-based policies**: RLS policies automatically filter based on JWT claims
- **Security guarantee**: No data leakage between users possible
- **Validation tools**: `scripts/validate_rls_policies.py` for testing

### API Version Headers
- **`X-API-Version: v1|v2`**: Controls response format
- **Default**: v1 (legacy) for backward compatibility
- **v2**: Standardized format with metadata

### Example Authentication Headers
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-API-Version: v2
Content-Type: application/json
```

### Authentication Errors
```json
{
  "success": false,
  "error": "AuthenticationError",
  "message": "Invalid or expired token",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Frontend Integration
- **Automatic token handling**: `authFetch` wrapper manages tokens
- **Session refresh**: Automatic refresh on token expiry
- **Fallback behavior**: Graceful handling of authentication failures
- **Multi-platform support**: Works with Next.js and React Native

---

## Error Handling & Status Codes

### Standard Error Response
```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Request validation failed",
  "details": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Symbol must be 1-8 characters",
      "field": "symbol"
    }
  ],
  "request_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | External service unavailable |

### Error Categories

#### Validation Errors (400)
- Invalid input data
- Missing required fields
- Format validation failures

#### Authentication Errors (401)
- Missing JWT token
- Invalid or expired token
- Token signature verification failed

#### Authorization Errors (403)
- Insufficient permissions
- RLS policy violations

#### Not Found Errors (404)
- Resource doesn't exist
- Invalid endpoint

#### Rate Limiting Errors (429)
- API rate limit exceeded
- Per-user rate limit exceeded

#### External Service Errors (503)
- Alpha Vantage API unavailable
- Supabase database unavailable
- Network connectivity issues

---

## Rate Limiting & Security

### Rate Limiting
- **General API**: 60 requests per minute per user
- **Symbol Search**: No additional limits
- **Dividend Sync All**: 1 request per 5 minutes per user
- **Headers**: Rate limit status included in response headers

### Security Measures

#### Input Validation
- All inputs validated with Pydantic models
- SQL injection prevention via parameterized queries
- XSS prevention through input sanitization

#### Authentication Security
- JWT token validation on every request
- Row Level Security (RLS) at database level
- Secure token storage and transmission

#### Data Sanitization
- HTML tag removal from user inputs
- Special character filtering in notes/comments
- Currency code format validation

#### CORS Configuration
```python
ALLOWED_ORIGINS = [
    "http://localhost:3000",    # Development frontend
    "https://yourapp.com",      # Production frontend
    # Mobile app origins for development
]
```

#### Environment Variables
All sensitive configuration stored in environment variables:
- `SUPA_API_URL`
- `SUPA_API_ANON_KEY`
- `SUPA_API_SERVICE_KEY`
- `VANTAGE_API_KEY`

---

## External API Integrations

### Alpha Vantage Integration

#### Current Implementation
- **Module Structure**: Organized in `vantage_api/` directory
- **Main Modules**: 
  - `vantage_api_client.py` - Base HTTP client with error handling
  - `vantage_api_quotes.py` - EOD quotes and historical data
  - `vantage_api_search.py` - Symbol search functionality
  - `vantage_api_news.py` - News and sentiment data
- **Price Management**: SimplifiedPriceManager handles all price operations
- **No Direct Price Fetching**: PortfolioCalculator uses PriceManager exclusively

#### Endpoints Used
- **Symbol Search**: `SYMBOL_SEARCH` function with intelligent scoring
- **Real-time Quotes**: `GLOBAL_QUOTE` function via price_manager
- **Historical Data**: `TIME_SERIES_DAILY_ADJUSTED` function
- **Company Overview**: `OVERVIEW` function with intelligent caching
- **Financial Statements**: `INCOME_STATEMENT`, `BALANCE_SHEET`, `CASH_FLOW`
- **Dividend Data**: `DIVIDENDS` function for dividend_service
- **News & Sentiment**: `NEWS_SENTIMENT` function
- **Forex Data**: `FX_DAILY`, `CURRENCY_EXCHANGE_RATE` via forex_manager

#### Rate Limiting & Circuit Breaker
- **Free Tier**: 25 requests per day (strict enforcement)
- **Premium**: 75+ requests per minute
- **Circuit Breaker**: Built into `vantage_api_client.py`
  - Automatic failure detection
  - Exponential backoff on failures
  - Manual reset via `/api/debug/reset-circuit-breaker`
- **Request Queuing**: Intelligent request spacing

#### Caching Strategy (Post-Simplification)
- **In-Memory Only**: PortfolioMetricsManager handles short-term caching
- **No Database Caching**: 14 cache tables removed in migration 012
- **Direct Queries**: Always fetch fresh data from source tables
- **Company Financials**: Still cached in company_financials table (24h)
- **Historical Prices**: Stored in historical_prices table
- **Dividend Data**: Managed by DividendService with distributed locking

#### Error Handling
```json
{
  "success": false,
  "error": "ExternalServiceError",
  "message": "Alpha Vantage API temporarily unavailable",
  "details": [
    {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "API rate limit exceeded. Please try again later."
    }
  ]
}
```

#### Integration Patterns
- **Cache-First**: Always check Supabase before Alpha Vantage
- **Background Updates**: Async price updates don't block responses
- **Graceful Degradation**: System works with stale data during API outages
- **Market Info Enrichment**: Transaction creation triggers symbol lookup

### Supabase Integration

#### Database Tables (Post-Simplification Schema)
**Core Tables (16 total)**:
- `transactions` - User buy/sell transactions with RLS
- `user_dividends` - Dividend tracking and confirmation system
- `watchlist` - User watchlists with target prices
- `user_profiles` - User preferences and base currency
- `historical_prices` - EOD price data (OHLCV + dividends)
- `company_financials` - Company financial statement data
- `forex_rates` - Currency exchange rates
- `market_holidays` - Market closure dates
- `api_usage` - API call tracking
- `audit_log` - System audit trail

**Removed Tables (Migration 012)**:
- ❌ `user_performance`, `portfolio_caches`, `portfolio_metrics_cache`
- ❌ `api_cache`, `market_info_cache`, `previous_day_price_cache`
- ❌ `price_request_cache`, `user_currency_cache`
- ❌ `cache_refresh_jobs`, `price_update_log`
- ❌ `circuit_breaker_state`, `distributed_locks`
- ❌ `stocks`, `symbol_market_info`

#### Row Level Security (RLS)
- **Comprehensive Policies**: All tables have user-specific RLS
- **JWT-Based Filtering**: Automatic data isolation by user_id
- **Policy Validation**: Scripts available in `scripts/validate_rls_policies.py`
- **Security Enforcement**: No data leakage between users

#### Real-time Features
- **Row Level Security**: Automatic data filtering per user
- **Triggers**: Automatic timestamp updates on data changes
- **Functions**: Server-side business logic and constraints
- **Migrations**: Versioned schema changes with rollback support

#### Authentication Flow
1. Frontend authenticates with Supabase Auth (email/password or OAuth)
2. JWT token stored in browser and passed to backend API
3. Backend validates token with Supabase using `require_authenticated_user`
4. RLS policies automatically enforce data access based on JWT claims
5. All API routes use `extract_user_credentials` helper for consistent auth

---

## Data Validation & Input Sanitization

### Pydantic Model Validation

#### Transaction Models (models/validation_models.py)
```python
class TransactionCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=8)
    transaction_type: Literal["Buy", "Sell"]
    quantity: Decimal = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    commission: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    exchange_rate: Decimal = Field(default=Decimal("1.0"), gt=0)
    date: date
    notes: Optional[str] = Field(default=None, max_length=500)
    
    @field_validator('date')
    @classmethod
    def validate_date(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Transaction date cannot be in the future')
        if v < date(1970, 1, 1):
            raise ValueError('Transaction date cannot be before 1970-01-01')
        return v

class TransactionUpdate(TransactionCreate):
    """Same validation as create for updates"""
    pass
```

#### Symbol Validation
```python
@field_validator('symbol')
@classmethod
def validate_symbol(cls, v: str) -> str:
    v = v.strip().upper()
    if not re.match(r'^[A-Z0-9.-]{1,8}$', v):
        raise ValueError('Symbol must contain only letters, numbers, dots, and hyphens')
    return v
```

#### Input Sanitization
```python
@field_validator('notes')
@classmethod
def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
    if v:
        # Remove HTML/script tags and dangerous characters
        v = re.sub(r'[<>\"\'&]', '', v)
        v = v.strip()
    return v if v else None
```

### Financial Data Type Safety
- **Decimal Precision**: All monetary values use `Decimal` type (never float/int)
- **Type Conversion**: Pydantic models automatically convert string inputs to Decimal
- **Precision Guarantee**: No floating-point precision errors in financial calculations
- **Serialization**: Models convert Decimal to float for JSON responses

### Validation Enforcement
- **API Layer**: All endpoints use Pydantic models for request validation
- **Database Layer**: Additional constraints at database level
- **Client-side**: Frontend performs basic validation before API calls
- **Error Responses**: Structured validation errors with field-specific messages

### Date & Time Validation
- **Future Date Prevention**: Transaction dates cannot be in the future
- **Historical Range**: Dates must be after 1970-01-01
- **ISO Format**: All dates in YYYY-MM-DD format
- **Timezone Handling**: UTC timestamps with proper timezone conversion

### Currency & Exchange Rate Validation
- **ISO Currency Codes**: 3-letter format validation (USD, EUR, etc.)
- **Exchange Rate Range**: Must be positive (> 0)
- **Default Values**: USD currency and 1.0 exchange rate defaults

---

## API Versioning & Compatibility

### Version Strategy
- **Header-based versioning**: `X-API-Version: v2`
- **Backward compatibility**: v1 responses still supported
- **Default behavior**: v1 format when header not specified

### Version Differences

#### Response Structure
**v1 (Legacy)**:
```json
{
  "success": true,
  "transactions": [...],
  "count": 25,
  "cache_status": "hit"
}
```

**v2 (Standardized)**:
```json
{
  "success": true,
  "data": {
    "transactions": [...],
    "count": 25
  },
  "message": "Transactions retrieved successfully",
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0",
    "cache_status": "hit",
    "computation_time_ms": 45
  }
}
```

#### Error Responses
**v1**: Simple error messages
**v2**: Structured error responses with details

### Migration Path
1. Frontend adds `X-API-Version: v2` header
2. Update response parsing to use `data` field
3. Use structured error handling
4. v1 support will be deprecated in future versions

---

## Performance & Caching

### Caching Strategy (Simplified Architecture)

#### Current Approach
1. **In-Memory Only**: PortfolioMetricsManager provides short-term caching
2. **No Database Caching**: All cache tables removed for data consistency
3. **On-Demand Calculations**: Real-time computation preferred over stale cache
4. **Direct Queries**: Fetch data directly from source tables

#### Data Freshness Strategy
- **Portfolio Metrics**: Calculated on-demand via PortfolioCalculator
- **EOD Prices**: Fetched from historical_prices table or Alpha Vantage
- **Company Financials**: 24 hours (only remaining cached data)
- **Historical Data**: Stored permanently in historical_prices
- **Dividend Data**: Synced via DividendService with distributed locking
- **In-Memory Cache**: Short-term caching in PortfolioMetricsManager

#### Cache Headers
```http
Cache-Status: hit | miss | stale
Computation-Time-Ms: 45
```

### Performance Optimizations

#### Background Price Updates
- Asynchronous price updates triggered by dashboard/portfolio requests
- Non-blocking updates don't delay API responses
- Circuit breaker prevents cascade failures

#### Database Optimizations
- Indexed queries on frequently accessed fields
- Composite indexes for complex queries
- Row Level Security optimized for performance

#### Pagination
- Cursor-based pagination for large datasets
- Configurable page sizes
- Efficient count queries

### Circuit Breaker
```python
# Reset circuit breaker
POST /api/debug/reset-circuit-breaker?service=alpha_vantage
```

---

## Code Examples

### JavaScript/TypeScript Frontend

#### Authentication Setup
```typescript
// Set up API client with authentication
const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Version': 'v2'
  }
});

// Add JWT token interceptor  
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('supabase_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Get Dashboard Data
```typescript
interface DashboardResponse {
  success: boolean;
  data: {
    portfolio: {
      total_value: number;
      total_cost: number;
      total_gain_loss: number;
      total_gain_loss_percent: number;
      daily_change: number;
      daily_change_percent: number;
      holdings_count: number;
    };
    top_holdings: Array<{
      symbol: string;
      quantity: number;
      current_value: number;
      allocation: number;
      gain_loss_percent: number;
    }>;
    transaction_summary: {
      total_invested: number;
      net_invested: number;
      total_transactions: number;
    };
  };
  metadata: {
    cache_status: string;
    computation_time_ms: number;
  };
}

const getDashboard = async (forceRefresh = false): Promise<DashboardResponse> => {
  const response = await apiClient.get('/api/dashboard', {
    params: { force_refresh: forceRefresh }
  });
  return response.data;
};
```

#### Add Transaction
```typescript
interface TransactionData {
  symbol: string;
  transaction_type: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  commission?: number;
  currency?: string;
  exchange_rate?: number;
  date: string; // YYYY-MM-DD format
  notes?: string;
}

const addTransaction = async (transaction: TransactionData) => {
  try {
    const response = await apiClient.post('/api/transactions', transaction);
    return response.data;
  } catch (error) {
    if (error.response?.status === 422) {
      // Handle validation errors
      const validationErrors = error.response.data.details;
      console.error('Validation errors:', validationErrors);
    }
    throw error;
  }
};
```

#### Search Symbols
```typescript
const searchSymbols = async (query: string, limit = 20) => {
  const response = await apiClient.get('/api/symbol_search', {
    params: { q: query, limit }
  });
  
  return response.data.results.map(result => ({
    symbol: result.symbol,
    name: result.name,
    type: result.type,
    region: result.region,
    currency: result.currency
  }));
};
```

#### Get Performance Chart Data
```typescript
const getPerformanceData = async (period = '3M', benchmark = 'SPY') => {
  const response = await apiClient.get('/api/dashboard/performance', {
    params: { period, benchmark }
  });
  
  return {
    portfolioData: response.data.portfolio_performance,
    benchmarkData: response.data.benchmark_performance,
    metrics: response.data.performance_metrics
  };
};
```

#### Error Handling
```typescript
const handleApiError = (error: any) => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        // Redirect to login
        window.location.href = '/login';
        break;
        
      case 422:
        // Validation errors
        if (data.details) {
          data.details.forEach(detail => {
            console.error(`${detail.field}: ${detail.message}`);
          });
        }
        break;
        
      case 429:
        // Rate limit exceeded
        console.warn('Rate limit exceeded. Please try again later.');
        break;
        
      case 503:
        // Service unavailable
        console.error('Service temporarily unavailable');
        break;
        
      default:
        console.error('API Error:', data.message || 'Unknown error');
    }
  } else {
    console.error('Network Error:', error.message);
  }
};
```

### Python Backend Examples

#### Custom Validation Model
```python
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from datetime import date
from typing import Optional, Literal
import re

class TransactionCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=8)
    transaction_type: Literal["Buy", "Sell"]
    quantity: Decimal = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    commission: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    exchange_rate: Decimal = Field(default=Decimal("1.0"), gt=0)
    date: date
    notes: Optional[str] = Field(default=None, max_length=500)
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r'^[A-Z0-9.-]{1,8}$', v):
            raise ValueError('Symbol must contain only letters, numbers, dots, and hyphens')
        return v
    
    @field_validator('date')
    @classmethod
    def validate_date(cls, v: date) -> date:
        if v > date.today():
            raise ValueError('Transaction date cannot be in the future')
        return v
```

#### Response Factory Usage
```python
from utils.response_factory import ResponseFactory

# Success response
return ResponseFactory.success(
    data={"transaction": transaction_data},
    message="Transaction added successfully",
    metadata={"cache_invalidated": True}
)

# Error response
return ResponseFactory.validation_error(
    field_errors={
        "symbol": "Symbol must be 1-8 characters",
        "quantity": "Quantity must be positive"
    },
    message="Transaction validation failed"
)

# Not found response
return ResponseFactory.not_found("Transaction", transaction_id)
```

#### Database Query with RLS
```python
from supa_api.supa_api_client import get_supa_service_client

async def get_user_transactions(user_id: str, user_token: str, limit: int = 100):
    supabase = get_supa_service_client()
    
    # Set RLS context with user's JWT
    supabase.postgrest.auth(user_token)
    
    # Query will automatically filter by user_id due to RLS
    result = supabase.table('transactions') \
        .select('*') \
        .order('date', desc=True) \
        .limit(limit) \
        .execute()
    
    return result.data
```

#### Cache Implementation
```python
from functools import wraps
import asyncio
from typing import Dict, Any

class CacheManager:
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._ttl: Dict[str, float] = {}
    
    def get(self, key: str) -> Any:
        import time
        if key in self._cache:
            if time.time() < self._ttl.get(key, 0):
                return self._cache[key]
            else:
                # Expired
                del self._cache[key]
                if key in self._ttl:
                    del self._ttl[key]
        return None
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        import time
        self._cache[key] = value
        self._ttl[key] = time.time() + ttl_seconds

cache = CacheManager()

def cached(ttl_seconds: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key from function name and args
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Check cache
            cached_result = cache.get(cache_key)
            if cached_result:
                return cached_result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            cache.set(cache_key, result, ttl_seconds)
            
            return result
        return wrapper
    return decorator

# Usage
@cached(ttl_seconds=300)
async def get_portfolio_metrics(user_id: str, user_token: str):
    # Expensive calculation here
    pass
```

This comprehensive API documentation covers all aspects of the Portfolio Tracker backend API, providing developers with everything needed to integrate with and maintain the system. The documentation is structured to be both a reference guide and implementation manual, with practical examples and best practices throughout.