# Backend Master Documentation - Portfolio Tracker

## Executive Summary

This document provides comprehensive documentation of the Portfolio Tracker's simplified backend architecture. The system is built using FastAPI with Python 3.11, integrating Supabase for database operations and Alpha Vantage for market data. The architecture emphasizes strong typing, standardized error handling, and modular design with extensive debugging capabilities.

---

## 1. Architecture Overview and Design Patterns

### Core Architecture

The backend follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Application                     │
├─────────────────────────────────────────────────────────────┤
│          API Routes Layer (backend_api_routes/)            │
├─────────────────────────────────────────────────────────────┤
│             Business Logic Layer (services/)               │
├─────────────────────────────────────────────────────────────┤
│          Database Integration (supa_api/)                  │
│         External APIs (vantage_api/)                       │
├─────────────────────────────────────────────────────────────┤
│      Infrastructure (config, middleware, utils/)          │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns Implemented

1. **Singleton Pattern**: Used in `SupaApiClient` for database connections
2. **Factory Pattern**: `ResponseFactory` for standardized API responses
3. **Decorator Pattern**: Extensive use of decorators for logging, error handling
4. **Repository Pattern**: Database operations abstracted through `supa_api` modules
5. **Circuit Breaker Pattern**: In `price_manager.py` for external service resilience
6. **Dependency Injection**: FastAPI's built-in DI for authentication and services

### Key Architectural Principles

- **Strong Type Safety**: Mandatory type hints using Pydantic models
- **Standardized Error Handling**: Consistent error response structure
- **Extensive Logging**: Debug-first approach with configurable logging
- **Modular Design**: Clear module boundaries and responsibilities
- **External Service Abstraction**: Unified interfaces for database and API operations

---

## 2. File Structure and Organization

### Root Directory Structure

```
backend_simplified/
├── main.py                     # FastAPI application entry point
├── config.py                   # Environment configuration
├── debug_logger.py            # Logging utilities
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Container configuration
├── backend.log               # Application log file
├── backend_api_routes/       # API endpoint definitions
├── services/                 # Business logic layer
├── supa_api/                # Database integration layer
├── vantage_api/             # External API integration
├── models/                  # Data models and validation
├── middleware/              # FastAPI middleware
├── utils/                   # Utility functions
├── tests/                   # Unit tests
└── scripts/                 # Utility scripts
```

### Module Organization by Layer

**API Layer (`backend_api_routes/`)**:
- `backend_api_auth.py` - Authentication endpoints
- `backend_api_portfolio.py` - Portfolio and transaction management
- `backend_api_dashboard.py` - Dashboard and performance metrics
- `backend_api_research.py` - Stock research and market data
- `backend_api_analytics.py` - Advanced analytics and reporting
- `backend_api_watchlist.py` - Watchlist management
- `backend_api_user_profile.py` - User profile operations
- `backend_api_forex.py` - Currency exchange operations

**Business Logic (`services/`)**:
- `portfolio_calculator.py` - Portfolio calculations and metrics
- `portfolio_metrics_manager.py` - Cached portfolio analytics
- `price_manager.py` - Unified price data management
- `dividend_service.py` - Dividend processing and assignment
- `financials_service.py` - Financial data processing
- `forex_manager.py` - Currency conversion operations
- `index_sim_service.py` - Index simulation and benchmarking

**Data Access (`supa_api/`)**:
- `supa_api_client.py` - Supabase client configuration
- `supa_api_auth.py` - Authentication middleware
- `supa_api_transactions.py` - Transaction database operations
- `supa_api_portfolio.py` - Portfolio data access
- `supa_api_historical_prices.py` - Price data storage/retrieval
- `supa_api_watchlist.py` - Watchlist database operations
- `supa_api_user_profile.py` - User profile data access

---

## 3. API Routes and Endpoints Structure

### Route Registration Pattern

Routes are registered in `main.py` using FastAPI's `APIRouter` system:

```python
# Routes with prefixes for organization
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(research_router, prefix="/api", tags=["Research"])
app.include_router(portfolio_router, prefix="/api", tags=["Portfolio"])
app.include_router(dashboard_router, tags=["Dashboard"])  # Has built-in /api prefix
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
```

### Endpoint Structure by Domain

**Authentication (`/api/auth`)**:
- `POST /register` - User registration
- `POST /login` - User authentication
- `POST /logout` - Session termination
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile

**Portfolio Management (`/api`)**:
- `GET /portfolio` - Get current portfolio holdings
- `GET /transactions` - List user transactions
- `POST /transactions` - Add new transaction
- `PUT /transactions/{id}` - Update transaction
- `DELETE /transactions/{id}` - Delete transaction

**Dashboard (`/api`)**:
- `GET /dashboard` - Complete dashboard data
- `GET /performance` - Portfolio performance metrics
- `GET /allocation` - Asset allocation breakdown

**Research (`/api`)**:
- `GET /search` - Symbol search
- `GET /quote/{symbol}` - Real-time quote
- `GET /historical/{symbol}` - Historical price data
- `GET /financials/{symbol}` - Company financials
- `GET /news/{symbol}` - Stock news

### Request/Response Patterns

All endpoints follow standardized patterns:

```python
# Success Response
{
    "success": true,
    "data": {...},
    "message": "Optional success message",
    "metadata": {
        "timestamp": "2024-01-15T10:30:00Z",
        "version": "1.0"
    }
}

# Error Response
{
    "success": false,
    "error": "ValidationError",
    "message": "Request validation failed",
    "details": [
        {
            "code": "VALIDATION_ERROR",
            "message": "Symbol must be uppercase",
            "field": "symbol"
        }
    ],
    "request_id": "uuid-string",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 4. Services and Their Responsibilities

### Portfolio Calculator (`portfolio_calculator.py`)

**Primary Responsibility**: Core portfolio calculations and metrics computation.

**Key Functions**:
- Holdings calculation from transactions
- Profit/loss calculations with FIFO/LIFO methods
- Portfolio performance metrics (returns, volatility)
- Asset allocation analysis
- XIRR (Extended Internal Rate of Return) calculations

**Dependencies**: Price Manager, Transaction data access

### Price Manager (`price_manager.py`)

**Primary Responsibility**: Unified price data management with caching and circuit breaker patterns.

**Key Functions**:
- Real-time quote retrieval with 15-minute cache during market hours
- Historical price data management
- Market status tracking (open/closed, holidays)
- Circuit breaker for external API resilience
- Batch price operations for portfolio updates

**Cache Strategy**:
- Market hours: 15-minute cache
- After hours: 1-hour cache
- Weekends: 24-hour cache

### Portfolio Metrics Manager (`portfolio_metrics_manager.py`)

**Primary Responsibility**: High-performance cached portfolio analytics.

**Key Functions**:
- Cached portfolio summary calculations
- Performance metrics with configurable refresh
- Allocation analysis
- Multi-metric batch processing
- Cache invalidation strategies

### Dividend Service (`dividend_service.py`)

**Primary Responsibility**: Automated dividend processing and user assignment.

**Key Functions**:
- Scheduled dividend data sync from Alpha Vantage
- Automatic dividend assignment to users based on holdings
- Ex-dividend date tracking
- Dividend income calculations

**Scheduling**: Daily at 2 AM UTC via APScheduler

### Forex Manager (`forex_manager.py`)

**Primary Responsibility**: Multi-currency support and exchange rate management.

**Key Functions**:
- Real-time exchange rate retrieval
- Currency conversion for international stocks
- Multi-currency portfolio valuation
- Exchange rate caching and fallback mechanisms

---

## 5. Database Integration Patterns

### Supabase Integration Architecture

The system uses Supabase as the primary database with PostgreSQL backend. Integration follows a consistent pattern:

```python
# Client Pattern
@dataclass
class SupaApiClient:
    _client: Client = None  # Anonymous client
    _service_client: Client = None  # Admin operations client
    
    def get_user_from_token(self, token: str) -> Optional[Dict[str, Any]]
    async def execute_query(self, query: str, params: Dict) -> Any
```

### Data Access Patterns

**1. Authenticated User Operations**:
```python
# Pattern used across all user-specific operations
async def get_user_data(user_id: str, user_token: str):
    client = create_authenticated_client(user_token)
    response = client.table('table_name').select('*').eq('user_id', user_id).execute()
    return response.data
```

**2. Service-Level Operations**:
```python
# For operations requiring elevated privileges
def admin_operation():
    client = get_supa_service_client()
    response = client.table('table_name').insert(data).execute()
```

### Row Level Security (RLS)

All user data tables implement RLS policies:
- Users can only access their own data
- Service role can access all data for system operations
- Authentication required for all operations

### Database Modules

**Transaction Management** (`supa_api_transactions.py`):
- CRUD operations for user transactions
- Batch transaction processing
- Transaction validation and constraints

**Portfolio Data** (`supa_api_portfolio.py`):
- Portfolio holdings aggregation
- Performance calculation storage
- Cache management for computed metrics

**Historical Prices** (`supa_api_historical_prices.py`):
- Price data storage and retrieval
- Batch price operations
- Data deduplication and integrity checks

---

## 6. Authentication and Security Implementation

### JWT-Based Authentication

The system uses Supabase JWT tokens for authentication:

```python
# Authentication middleware
async def require_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    token = credentials.credentials
    user_response = supa_api_client.client.auth.get_user(token)
    if user_response and user_response.user:
        user_data = user_response.user.dict()
        user_data["access_token"] = token
        return user_data
    raise HTTPException(status_code=401, detail="Invalid token")
```

### Security Helper Functions

**Credential Extraction** (`auth_helpers.py`):
```python
def extract_user_credentials(user_data: Dict[str, Any]) -> Tuple[str, str]:
    """Extract and validate user_id and user_token with type safety"""
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid user ID")
    if not user_token or not isinstance(user_token, str):
        raise HTTPException(status_code=401, detail="Invalid access token")
    
    return user_id, user_token
```

### Input Validation and Sanitization

All inputs are validated using Pydantic models with strict validation:

```python
class TransactionCreate(StrictModel):
    symbol: str = Field(..., min_length=1, max_length=8)
    quantity: Decimal = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.match(r'^[A-Z0-9.-]{1,8}$', v):
            raise ValueError('Invalid symbol format')
        return v
```

### Security Features

1. **XSS Prevention**: Input sanitization for all text fields
2. **SQL Injection Prevention**: Parameterized queries through Supabase client
3. **CORS Configuration**: Restricted to specific origins
4. **Rate Limiting**: Configurable per-endpoint limits
5. **JWT Validation**: Token structure and signature verification

---

## 7. Configuration Management

### Environment Configuration (`config.py`)

Configuration follows a centralized approach with environment variable loading:

```python
# API Keys and URLs
SUPA_API_URL = os.getenv("SUPA_API_URL", "")
SUPA_API_ANON_KEY = os.getenv("SUPA_API_ANON_KEY", "")
VANTAGE_API_KEY = os.getenv("VANTAGE_API_KEY", "")

# Backend Settings
BACKEND_API_PORT = int(os.getenv("BACKEND_API_PORT", "8000"))
BACKEND_API_DEBUG = os.getenv("BACKEND_API_DEBUG", "True").lower() == "true"

# CORS Origins
ALLOWED_ORIGINS = [
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:19006",  # Expo web
]

# Required Variable Validation
required_vars = ["SUPA_API_URL", "SUPA_API_ANON_KEY", "VANTAGE_API_KEY"]
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
```

### Configuration Categories

1. **Database Configuration**: Supabase URLs and keys
2. **External API Configuration**: Alpha Vantage settings
3. **Application Configuration**: Port, host, debug settings
4. **Security Configuration**: CORS origins, rate limits
5. **Caching Configuration**: TTL settings for different data types
6. **Logging Configuration**: Log levels and formats

---

## 8. Error Handling and Logging

### Standardized Error Handling

The system implements comprehensive error handling through multiple layers:

**1. Global Exception Handler** (`error_handler.py`):
```python
async def api_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = str(uuid.uuid4())
    
    # Handle different exception types
    if isinstance(exc, APIException):
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())
    elif isinstance(exc, ValidationError):
        return JSONResponse(status_code=422, content=validation_error_response)
    
    # Log with context
    logger.error(f"API Exception: {type(exc).__name__}", extra={
        "request_id": request_id,
        "path": request.url.path,
        "method": request.method
    })
```

**2. Custom Exception Hierarchy**:
```python
class APIException(HTTPException):
    def __init__(self, status_code: int, error: str, message: str, details: Dict = None):
        self.error = error
        self.message = message
        self.details = details or {}

class ValidationException(APIException): pass
class AuthenticationException(APIException): pass
class ResourceNotFoundException(APIException): pass
class ExternalServiceException(APIException): pass
```

### Debug Logging System

**Comprehensive Logging** (`debug_logger.py`):
```python
class DebugLogger:
    @staticmethod
    def log_api_call(api_name: str, sender: str, receiver: str, operation: str = ""):
        """Decorator for comprehensive API call logging"""
        
    @staticmethod
    def log_error(file_name: str, function_name: str, error: Exception, **context):
        """Structured error logging with context"""
        
    @staticmethod
    def info_if_enabled(message: str, logger: logging.Logger):
        """Conditional info logging based on DEBUG_INFO_LOGGING setting"""
```

**Logging Configuration Features**:
- Runtime log level adjustment
- Structured logging with context
- Request/response tracing
- Performance monitoring
- External service call tracking

### Error Response Standardization

All errors follow a consistent structure:
```python
{
    "success": false,
    "error": "ValidationError",
    "message": "Human-readable error description",
    "details": [
        {
            "code": "VALIDATION_ERROR",
            "message": "Specific field error",
            "field": "field_name",
            "details": {"additional": "context"}
        }
    ],
    "request_id": "unique-uuid",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 9. Dependencies and External Integrations

### Core Dependencies (`requirements.txt`)

**Web Framework**:
- `fastapi==0.104.1` - Modern web framework
- `uvicorn[standard]==0.24.0` - ASGI server
- `python-multipart==0.0.6` - Form data handling

**Database Integration**:
- `supabase==2.10.0` - Supabase client
- `asyncpg==0.29.0` - PostgreSQL async driver

**External APIs**:
- `alpha-vantage==2.3.1` - Alpha Vantage client
- `aiohttp==3.9.1` - Async HTTP client
- `httpx==0.27.2` - Modern HTTP client

**Data Validation**:
- `pydantic==2.5.0` - Data validation and serialization

**Authentication**:
- `PyJWT==2.8.0` - JWT token handling

**Background Tasks**:
- `apscheduler==3.10.4` - Scheduled task execution

**Market Data**:
- `pandas_market_calendars==4.3.2` - Market calendar data
- `pandas==2.1.4` - Data manipulation

### External Service Integrations

**Alpha Vantage API**:
- Real-time stock quotes
- Historical price data
- Company financials
- Dividend information
- News and sentiment data

**Supabase Services**:
- PostgreSQL database with RLS
- JWT authentication
- Real-time subscriptions
- File storage (if needed)

### Integration Patterns

**Circuit Breaker Pattern** for external services:
```python
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
    
    def is_open(self, service: str) -> bool:
        # Check if circuit is open (blocking calls)
    
    def record_success(self, service: str):
        # Record successful call
    
    def record_failure(self, service: str):
        # Record failed call, potentially opening circuit
```

---

## 10. Data Flow Patterns

### Request Processing Flow

```
1. Client Request → FastAPI Application
2. CORS Middleware → Request Validation
3. Authentication Middleware → JWT Validation
4. Route Handler → Input Validation (Pydantic)
5. Business Logic Service → Data Processing
6. Database/External API → Data Retrieval/Storage
7. Response Factory → Standardized Response
8. Client Response ← JSON Response
```

### Data Processing Patterns

**1. Portfolio Calculation Flow**:
```
User Request → Authentication → Transaction Retrieval → Price Data Fetch → 
Portfolio Calculation → Cache Update → Standardized Response
```

**2. Price Data Flow**:
```
Price Request → Cache Check → [Cache Hit: Return] OR [Cache Miss: External API → 
Database Storage → Cache Update → Return]
```

**3. Background Task Flow**:
```
Scheduler Trigger → Dividend Service → Alpha Vantage API → 
Global Dividend Storage → User Assignment → Notification (if applicable)
```

### Caching Strategies

**Multi-Level Caching**:
1. **Application Memory Cache**: Short-term data (quotes, market status)
2. **Database Cache Tables**: Medium-term computed data (portfolio metrics)
3. **External API Rate Limiting**: Request throttling and deduplication

**Cache Invalidation**:
- Time-based expiration (TTL)
- Event-based invalidation (transaction updates)
- Manual cache refresh endpoints

---

## 11. Code Examples of Key Implementations

### Authentication Dependency

```python
# File: supa_api/supa_api_auth.py
async def require_authenticated_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict[str, Any]:
    """FastAPI dependency for JWT authentication"""
    if not credentials:
        raise HTTPException(status_code=401, detail="No credentials provided")
    
    token = credentials.credentials
    user_response = supa_api_client.client.auth.get_user(token)
    
    if user_response and user_response.user:
        user_data = user_response.user.dict()
        user_data["access_token"] = token
        return user_data
    
    raise HTTPException(status_code=401, detail="Invalid or expired token")
```

### Portfolio Calculation Service

```python
# File: services/portfolio_calculator.py
class PortfolioCalculator:
    async def calculate_portfolio_summary(
        self, 
        user_id: str, 
        user_token: str
    ) -> PortfolioSummary:
        """Calculate complete portfolio summary with holdings and performance"""
        
        # Get user transactions
        transactions = await supa_api_get_user_transactions(user_id, user_token)
        
        # Calculate current holdings using FIFO method
        holdings = self._calculate_holdings_fifo(transactions)
        
        # Get current prices for all symbols
        symbols = [holding.symbol for holding in holdings]
        current_prices = await price_manager.get_current_prices_batch(symbols)
        
        # Calculate portfolio metrics
        summary = PortfolioSummary()
        for holding in holdings:
            current_price = current_prices.get(holding.symbol, 0)
            market_value = holding.quantity * current_price
            cost_basis = holding.quantity * holding.avg_cost
            
            summary.total_value += market_value
            summary.total_cost += cost_basis
            summary.total_gain_loss += (market_value - cost_basis)
        
        if summary.total_cost > 0:
            summary.total_gain_loss_percent = (
                summary.total_gain_loss / summary.total_cost * 100
            )
        
        return summary
```

### Standardized API Endpoint

```python
# File: backend_api_routes/backend_api_portfolio.py
@portfolio_router.get("/portfolio")
async def backend_api_get_portfolio(
    user: Dict[str, Any] = Depends(require_authenticated_user),
    force_refresh: bool = Query(False, description="Force refresh cache")
) -> APIResponse[Dict[str, Any]]:
    """Get user's current portfolio holdings"""
    
    try:
        user_id, user_token = extract_user_credentials(user)
        
        # Use cached metrics manager for optimized performance
        metrics = await portfolio_metrics_manager.get_portfolio_metrics(
            user_id=user_id,
            user_token=user_token,
            metric_type="portfolio",
            force_refresh=force_refresh
        )
        
        # Convert to API response format
        portfolio_data = {
            "holdings": [holding.to_dict() for holding in metrics.holdings],
            "summary": metrics.summary.to_dict(),
            "performance": metrics.performance.to_dict(),
            "cache_status": metrics.cache_status,
            "last_updated": metrics.last_updated.isoformat()
        }
        
        return ResponseFactory.success(
            data=portfolio_data,
            message="Portfolio retrieved successfully",
            metadata={
                "computation_time_ms": metrics.computation_time_ms,
                "cache_hit": metrics.cache_status == "hit"
            }
        )
        
    except Exception as e:
        logger.error(f"Portfolio calculation error: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to calculate portfolio"
        )
```

### Price Data Management

```python
# File: services/price_manager.py
class PriceManager:
    async def get_current_price(self, symbol: str) -> Optional[Decimal]:
        """Get current price with intelligent caching"""
        
        # Check cache first
        cached_price = await self._get_cached_price(symbol)
        if cached_price and not self._is_cache_expired(cached_price):
            return cached_price.price
        
        # Check circuit breaker
        if self.circuit_breaker.is_open('alpha_vantage'):
            logger.warning(f"Circuit breaker open for Alpha Vantage, using stale data")
            return cached_price.price if cached_price else None
        
        # Fetch from external API
        try:
            quote_data = await vantage_api_get_quote(symbol)
            if quote_data and 'price' in quote_data:
                price = Decimal(str(quote_data['price']))
                
                # Cache the result
                await self._cache_price(symbol, price)
                self.circuit_breaker.record_success('alpha_vantage')
                
                return price
                
        except Exception as e:
            self.circuit_breaker.record_failure('alpha_vantage')
            logger.error(f"Failed to fetch price for {symbol}: {str(e)}")
            
            # Return stale cache data if available
            return cached_price.price if cached_price else None
        
        return None
```

### Error Handling Implementation

```python
# File: middleware/error_handler.py
async def api_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler with structured error responses"""
    
    request_id = str(uuid.uuid4())
    
    # Log with full context
    logger.error(
        f"API Exception: {type(exc).__name__}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "exception_message": str(exc),
            "traceback": traceback.format_exc()
        }
    )
    
    # Handle validation errors
    if isinstance(exc, RequestValidationError):
        errors = []
        for error in exc.errors():
            field_path = ".".join(str(loc) for loc in error.get("loc", []))
            errors.append(ErrorDetail(
                code="VALIDATION_ERROR",
                message=error.get("msg", "Invalid value"),
                field=field_path,
                details={"type": error.get("type", "unknown")}
            ))
        
        return JSONResponse(
            status_code=422,
            content=ResponseFactory.error(
                error="Validation Error",
                message="Request validation failed",
                status_code=422,
                details=errors,
                request_id=request_id
            ).dict()
        )
    
    # Handle authentication errors
    elif isinstance(exc, HTTPException) and exc.status_code == 401:
        return JSONResponse(
            status_code=401,
            content=ResponseFactory.unauthorized(
                message=exc.detail or "Authentication required"
            ).dict()
        )
    
    # Handle unexpected errors
    else:
        return JSONResponse(
            status_code=500,
            content=ResponseFactory.error(
                error="Internal Server Error",
                message="An unexpected error occurred. Please try again later.",
                status_code=500,
                request_id=request_id
            ).dict()
        )
```

---

## Key Implementation Highlights

### Type Safety Enforcement

The backend enforces strict type safety throughout:
- All function parameters and return types are explicitly typed
- Pydantic models with strict validation for all data structures
- Financial calculations use `Decimal` type exclusively (never float/int for money)
- Runtime type validation for external inputs

### Performance Optimizations

- **Multi-level caching**: Memory, database, and intelligent TTL strategies
- **Batch operations**: Portfolio calculations process multiple symbols efficiently
- **Circuit breaker pattern**: Prevents cascade failures from external services
- **Connection pooling**: Persistent database connections via Supabase client

### Security Implementation

- **Input sanitization**: All text inputs are sanitized to prevent XSS
- **Parameterized queries**: SQL injection prevention through Supabase client
- **JWT validation**: Comprehensive token validation with proper error handling
- **Row Level Security**: Database-level access control for user data

### Operational Excellence

- **Structured logging**: Comprehensive logging with request tracing
- **Health monitoring**: Circuit breakers and service status tracking
- **Graceful degradation**: Fallback mechanisms for external service failures
- **Docker containerization**: Production-ready deployment configuration

This backend architecture provides a robust, scalable, and maintainable foundation for the Portfolio Tracker application, with emphasis on reliability, security, and developer experience.