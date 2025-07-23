# Portfolio Tracker Backend Guide

## Table of Contents
1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Data Structures](#data-structures)
4. [Type Safety Guidelines](#type-safety-guidelines)
5. [Service Architecture](#service-architecture)
6. [Common Patterns](#common-patterns)
7. [Error Prevention](#error-prevention)

## Overview

The Portfolio Tracker backend is built with FastAPI and uses Supabase as the database. It follows strict type safety rules and uses specific data structures throughout.

### Core Technologies
- **Framework**: FastAPI (Python 3.9+)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase JWT tokens
- **External APIs**: Alpha Vantage for market data
- **Type System**: Python type hints with Pydantic models

## API Endpoints

### Authentication Flow
All endpoints require JWT authentication via `Bearer` token in the Authorization header.

```python
# Authentication dependency used by all endpoints
from supa_api.supa_api_auth import require_authenticated_user

# Example usage in endpoint
@router.get("/api/portfolio")
async def get_portfolio(
    user_data: dict = Depends(require_authenticated_user)
):
    user_id, user_token = extract_user_credentials(user_data)
```

### Portfolio Endpoints

#### GET /api/portfolio
Returns user's current holdings with calculations.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "holdings": [
      {
        "symbol": "AAPL",
        "quantity": 100.0,
        "avg_cost": 150.0,
        "total_cost": 15000.0,
        "current_price": 180.0,
        "current_value": 18000.0,
        "gain_loss": 3000.0,
        "gain_loss_percent": 20.0,
        "dividends_received": 150.0,
        "price_date": "2024-01-15"
      }
    ],
    "total_value": 50000.0,
    "total_cost": 40000.0,
    "total_gain_loss": 10000.0,
    "total_gain_loss_percent": 25.0,
    "total_dividends": 500.0
  }
}
```

#### GET /api/allocation
Returns portfolio allocation data with percentages and colors for charts.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "symbol": "AAPL",
        "company_name": "Apple Inc.",
        "quantity": 100.0,
        "current_price": 180.0,
        "cost_basis": 15000.0,
        "current_value": 18000.0,
        "gain_loss": 3000.0,
        "gain_loss_percent": 20.0,
        "dividends_received": 150.0,
        "realized_pnl": 0.0,
        "allocation_percent": 36.0,
        "color": "#3B82F6",
        "daily_change": 200.0,
        "daily_change_percent": 1.12
      }
    ],
    "summary": {
      "total_value": 50000.0,
      "total_cost": 40000.0,
      "total_gain_loss": 10000.0,
      "total_gain_loss_percent": 25.0,
      "total_dividends": 500.0
    }
  }
}
```

#### GET /api/transactions
Returns user's transaction history.

**Query Parameters:**
- `limit`: Number of transactions (default: 100)
- `offset`: Pagination offset (default: 0)

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "symbol": "AAPL",
        "transaction_type": "BUY",
        "quantity": 10,
        "price": 150.0,
        "total_value": 1500.0,
        "date": "2024-01-15",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "total_count": 150,
    "limit": 100,
    "offset": 0
  }
}
```

#### POST /api/transactions
Create a new transaction.

**Request Body:**
```json
{
  "symbol": "AAPL",
  "transaction_type": "BUY",
  "quantity": 10,
  "price": 150.0,
  "date": "2024-01-15"
}
```

#### POST /api/cache/clear
Clear portfolio metrics cache for the user.

**Response:**
```json
{
  "success": true,
  "message": "Portfolio cache cleared successfully"
}
```

### Dashboard Endpoints

#### GET /api/dashboard
Returns comprehensive dashboard overview data.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "portfolio_value": 50000.0,
    "total_profit": 10000.0,
    "total_profit_percent": 25.0,
    "daily_change": 500.0,
    "daily_change_percent": 1.01,
    "top_holdings": [...],
    "portfolio_composition": [...],
    "performance_metrics": {...},
    "recent_transactions": [...],
    "time_series_data": [...]
  },
  "metadata": {
    "cache_status": "hit|miss|force_refresh",
    "computation_time_ms": 150,
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

#### GET /api/dashboard/performance
Returns portfolio performance data with time series.

**Query Parameters:**
- `period`: Time period (7D, 1M, 3M, 6M, 1Y, YTD, MAX)
- `benchmark`: Benchmark symbol (default: SPY)

### Analytics Endpoints

#### GET /api/analytics/summary
Returns portfolio analytics summary.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "portfolio_value": 50000.0,
    "total_profit": 10000.0,
    "total_profit_percent": 25.0,
    "irr_percent": 18.5,
    "passive_income_ytd": 1200.0,
    "cash_balance": 5000.0,
    "dividend_summary": {
      "total_received": 1500.0,
      "total_pending": 300.0,
      "ytd_received": 1200.0,
      "confirmed_count": 15,
      "pending_count": 3
    }
  }
}
```

#### GET /api/analytics/holdings
Returns detailed holdings with realized gains.

**Query Parameters:**
- `include_sold`: Include sold positions (default: false)

**Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "quantity": 100.0,
      "current_price": 180.0,
      "current_value": 18000.0,
      "cost_basis": 15000.0,
      "unrealized_gain": 3000.0,
      "unrealized_gain_percent": 20.0,
      "realized_pnl": 500.0,
      "dividends_received": 150.0,
      "total_profit": 3650.0,
      "total_profit_percent": 24.3,
      "daily_change": 200.0,
      "daily_change_percent": 1.12,
      "irr_percent": 18.5
    }
  ]
}
```

#### GET /api/analytics/dividends
Returns dividend history and projections.

**Query Parameters:**
- `confirmed_only`: Only show confirmed dividends (default: false)

**Response Structure:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "symbol": "AAPL",
      "ex_date": "2024-02-15",
      "pay_date": "2024-02-22",
      "amount": 0.24,
      "currency": "USD",
      "confirmed": true,
      "current_holdings": 100,
      "projected_amount": 24.0,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### POST /api/analytics/dividends/add
Manually add a dividend entry.

**Request Body:**
```json
{
  "symbol": "AAPL",
  "ex_date": "2024-02-15",
  "pay_date": "2024-02-22",
  "amount": 0.24,
  "confirmed": true
}
```

## Data Structures

### Transaction Dictionary
Used throughout the system for transaction processing:

```python
{
    'id': str,                    # UUID
    'user_id': str,              # UUID
    'symbol': str,               # Stock ticker
    'transaction_type': str,     # BUY, SELL, DIVIDEND
    'quantity': Decimal,         # Number of shares
    'price': Decimal,            # Price per share
    'total_value': Decimal,      # Total transaction value
    'date': str,                 # YYYY-MM-DD format
    'created_at': str,           # ISO timestamp
    'updated_at': str            # ISO timestamp
}
```

### Holdings Dictionary
Internal structure used by PortfolioCalculator:

```python
{
    'symbol': str,
    'quantity': Decimal,         # Current quantity owned
    'total_cost': Decimal,       # Total cost basis
    'dividends_received': Decimal,
    'realized_pnl': Decimal,     # Realized profit/loss
    'total_bought': Decimal,     # Total amount bought
    'total_sold': Decimal,       # Total amount sold
    'lots': List[Dict]           # FIFO tracking lots
}
```

### Price Data Dictionary
Structure returned by PriceManager:

```python
{
    'symbol': str,
    'price': float,
    'date': str,                 # YYYY-MM-DD
    'open': float,
    'high': float,
    'low': float,
    'close': float,
    'volume': int,
    'change': float,
    'change_percent': float
}
```

### API Response Structure
Standard response wrapper (used by most but not all endpoints):

```python
{
    'success': bool,
    'data': Any,                 # Endpoint-specific data
    'error': Optional[str],      # Error message if success=false
    'metadata': Optional[Dict]   # Additional metadata (only some endpoints)
}
```

**Note**: Response formats vary across endpoints:
- Portfolio/Dashboard endpoints typically use the standard wrapper
- Watchlist endpoints may return `item` instead of `data`
- Research endpoints may use `ok`/`results` format
- Not all endpoints include `metadata`

## Type Safety Guidelines

### 1. Always Use Type Hints
```python
# ❌ BAD
def calculate_return(cost, value):
    return (value - cost) / cost * 100

# ✅ GOOD
def calculate_return(cost: Decimal, value: Decimal) -> Decimal:
    if cost == 0:
        raise ValueError("Cost cannot be zero")
    return (value - cost) / cost * 100
```

### 2. Use Decimal for Financial Calculations
```python
# ❌ BAD
price = 150.25  # float
quantity = 10
total = price * quantity

# ✅ GOOD
from decimal import Decimal

price = Decimal('150.25')
quantity = Decimal('10')
total = price * quantity
```

### 3. Dictionary Access Patterns
```python
# ❌ BAD - Causes AttributeError
holdings_map = {'AAPL': {'quantity': 100, 'cost': 15000}}
for holding in holdings_map.values():
    print(holding.quantity)  # ERROR: dict has no attribute 'quantity'

# ✅ GOOD - Correct dictionary access
for holding in holdings_map.values():
    print(holding['quantity'])  # Correct dictionary key access
```

### 4. Validate User Credentials
```python
# ❌ BAD
user_id = user_data.get('user_id')  # Could be None
# ... use user_id without checking

# ✅ GOOD
from utils.auth_helpers import extract_user_credentials

user_id, user_token = extract_user_credentials(user_data)
# extract_user_credentials validates and raises HTTP 401 if invalid
```

### 5. Handle Optional Types Properly
```python
# ❌ BAD
def get_price(symbol: str, date: Optional[str]) -> float:
    # Assumes date is not None
    return fetch_price(symbol, date)

# ✅ GOOD
def get_price(symbol: str, date: Optional[str] = None) -> float:
    if date is None:
        date = datetime.now().strftime('%Y-%m-%d')
    return fetch_price(symbol, date)
```

## Service Architecture

### Layer Structure
1. **API Routes** (`backend_api_routes/`): Handle HTTP requests/responses
   - Note: Route files are in the `backend_api_routes/` subdirectory
2. **Services** (`services/`): Business logic and calculations
3. **Supabase API** (`supa_api/`): Database operations
4. **External APIs** (`vantage_api/`): Third-party integrations

### Key Services

#### PortfolioCalculator
- Central service for all portfolio calculations
- Uses FIFO method for realized gains
- Handles holdings, allocations, and time series

#### PortfolioMetricsManager
- Manages caching of expensive calculations
- Coordinates data fetching from multiple sources
- Handles cache invalidation

#### PriceManager
- Centralized price data management
- Handles caching and fallback strategies
- Integrates with Alpha Vantage

## Common Patterns

### 1. Authentication Pattern
```python
@router.get("/api/endpoint")
async def endpoint(
    user_data: dict = Depends(require_authenticated_user),
    force_refresh: bool = Query(False)
):
    user_id, user_token = extract_user_credentials(user_data)
    # ... rest of endpoint logic
```

### 2. Service Call Pattern
```python
async def get_portfolio_data(user_id: str, user_token: str):
    try:
        # Get data from service
        result = await PortfolioCalculator.calculate_holdings(
            user_id=user_id,
            user_token=user_token
        )
        
        # Return standardized response
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return {
            "success": False,
            "error": str(e)
        }
```

### 3. Caching Pattern
```python
# Check cache first
cached_data = await cache_manager.get(cache_key)
if cached_data and not force_refresh:
    return cached_data

# Calculate if not cached
data = await expensive_calculation()

# Store in cache
await cache_manager.set(cache_key, data, ttl=3600)
return data
```

## Error Prevention

### 1. Dictionary vs Object Access
**Problem**: Treating dictionaries as objects
```python
# This is the #1 cause of backend errors!
# Always check if you're working with a dict or object

# If it's a dict from database/API:
value = data['key']

# If it's a Pydantic model or class instance:
value = data.key
```

### 2. Type Validation
```python
# Always validate types at API boundaries
from pydantic import BaseModel, validator

class TransactionCreate(BaseModel):
    symbol: str
    transaction_type: str
    quantity: Decimal
    price: Decimal
    date: str
    
    @validator('transaction_type')
    def validate_type(cls, v):
        if v not in ['BUY', 'SELL', 'DIVIDEND']:
            raise ValueError('Invalid transaction type')
        return v
```

### 3. Null Safety
```python
# Always handle potential None values
price_data = prices.get(symbol)
if not price_data:
    logger.warning(f"No price for {symbol}")
    continue

# Use default values where appropriate
quantity = holding.get('quantity', Decimal('0'))
```

### 4. Decimal Precision
```python
# Always use string literals for Decimal
# ❌ BAD: Decimal(0.1)  # Can have precision issues
# ✅ GOOD: Decimal('0.1')

# Format for JSON serialization
float(decimal_value)  # When returning in API responses
```

### 5. Error Logging
```python
try:
    result = await risky_operation()
except Exception as e:
    # Log with context
    logger.error(
        f"[ServiceName] Operation failed for user {user_id}: {e}",
        exc_info=True  # Include stack trace
    )
    # Re-raise or handle appropriately
    raise HTTPException(status_code=500, detail="Internal error")
```

## Testing Checklist

Before deploying any backend changes:

1. ✅ Run type checker: `mypy backend_simplified/`
2. ✅ Check all dictionary access patterns
3. ✅ Verify Decimal usage for financial calculations
4. ✅ Test with empty/null data scenarios
5. ✅ Verify authentication flow
6. ✅ Check error handling and logging
7. ✅ Test cache invalidation scenarios
8. ✅ Verify API response structures match this guide

## Common Debugging Commands

```bash
# Check type errors
mypy backend_simplified/ --strict

# Run specific endpoint test
curl -X GET "http://localhost:8000/api/portfolio" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Watch backend logs
docker logs -f portfolio-tracker-backend-1 --tail 100

# Clear cache for testing
curl -X POST "http://localhost:8000/api/cache/clear" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Migration Safety

When modifying data structures:

1. **Never change dictionary access patterns without testing**
2. **Always maintain backward compatibility**
3. **Use feature flags for gradual rollout**
4. **Test with production-like data volumes**
5. **Have rollback plan ready**

Remember: The most common source of backend errors is incorrect dictionary access patterns. Always double-check whether you're working with a dictionary or an object!