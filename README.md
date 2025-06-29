# Portfolio Management Application

A comprehensive, enterprise-grade financial portfolio management platform built with modern web technologies. This application provides real-time portfolio tracking, advanced analytics, and professional-grade financial metrics for investment management.

## <× Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **Backend**: Django 4.2 + Django Ninja (Fast API-style framework)
- **Database**: PostgreSQL (Supabase cloud-managed)
- **Authentication**: Supabase Auth with JWT tokens
- **Caching**: Redis (production) + Multi-level application caching
- **Charts**: Plotly.js for interactive financial visualizations
- **External APIs**: Alpha Vantage, Finnhub for market data

### Project Structure
```
/backend/           Django REST API server
/frontend/          Next.js React application  
/e2e_test_suite/    Playwright end-to-end tests
/k8s/              Kubernetes deployment configurations
```

## =€ Features

### Core Portfolio Management
- **Real-time Portfolio Tracking** - Live portfolio values and performance metrics
- **Transaction Management** - Complete buy/sell/dividend transaction history
- **Multi-currency Support** - Holdings in different currencies with FX conversion
- **Advanced Analytics** - IRR, Sharpe ratio, beta, and risk assessment
- **Benchmark Comparison** - Performance vs S&P 500, Nasdaq, Dow Jones
- **Asset Allocation** - Sector and ticker-based portfolio breakdown

### Professional Financial Tools
- **Advanced Financial Metrics** - Professional-grade ratios and calculations
- **Portfolio Optimization** - Risk assessment and diversification analysis
- **Price Alerts** - Customizable price monitoring and notifications
- **Dividend Forecasting** - 12-month dividend projection
- **Balance Sheet Analysis** - Company fundamental analysis
- **Real-time Market Data** - Live quotes and historical price data

### User Experience
- **Professional Dashboard** - Comprehensive KPI overview with interactive charts
- **Stock Search** - Intelligent symbol search with autocomplete
- **Responsive Design** - Mobile-optimized interface
- **Dark Theme** - Professional financial UI design
- **Real-time Updates** - Live data synchronization across components

## =Ê Data Flow Architecture

### End-to-End Data Flow
```
User Action ’ Frontend (Next.js) ’ API Gateway ’ Django Backend ’ PostgreSQL
     “                                                              “
React Query Cache  JSON Response  API Response  Service Layer  Database
```

### Market Data Pipeline
```
Alpha Vantage API ’ Rate Limiting ’ Response Caching ’ Database Storage ’ Frontend
     “                    “               “                   “              “
60 req/min limit ’ 5-min TTL cache ’ CachedDailyPrice ’ React Query ’ Dashboard
```

### Transaction Processing Flow
1. **User Input**: Transaction created via React forms
2. **API Request**: POST to `/api/transactions/create`
3. **Authentication**: Supabase JWT verification
4. **Transaction Service**: Validation and processing
5. **Database Updates**: Transaction record + portfolio recalculation
6. **Price Fetching**: Historical price data from Alpha Vantage
7. **Cache Updates**: Price data cached for future use
8. **Real-time Updates**: Frontend automatically refreshes

## <ê Caching Strategy

### Multi-Level Caching Architecture
```
Level 1: External API Cache (5 minutes)
Level 2: Database Cache (24 hours)  
Level 3: Application Cache (30 minutes)
Level 4: Frontend Cache (React Query)
```

### Cache Types
- **API Response Cache**: Alpha Vantage responses cached to minimize API calls
- **Database Cache**: `CachedDailyPrice` and `CachedCompanyFundamentals` models
- **Application Cache**: TTL cache for dashboard data and FX rates
- **Frontend Cache**: React Query with background refetching

### Cache Invalidation
- **Manual**: Cache clearing on data mutations
- **Automatic**: TTL-based expiration
- **Background**: Scheduled jobs for cache refresh

## = API Architecture

### Backend API Endpoints

#### Portfolio Management (`/api/portfolios/`)
- `GET /portfolios/{user_id}` - Portfolio holdings and summary
- `GET /portfolios/{user_id}/performance` - Time-weighted returns with benchmarks
- `POST /portfolios/{user_id}/holdings` - Add new holdings
- `PUT /portfolios/{user_id}/holdings/{holding_id}` - Update holdings
- `DELETE /portfolios/{user_id}/holdings/{holding_id}` - Remove holdings

#### Transaction System (`/api/transactions/`)
- `POST /transactions/create` - Create transactions (BUY/SELL/DIVIDEND)
- `GET /transactions/user` - Transaction history with filtering
- `PUT /transactions/{txn_id}` - Update transactions
- `DELETE /transactions/{txn_id}` - Delete transactions
- `GET /transactions/summary` - Portfolio summary statistics

#### Market Data (`/api/stocks/`)
- `GET /stocks/{symbol}/quote` - Real-time stock quotes
- `GET /stocks/{symbol}/historical` - Historical price data
- `GET /stocks/{symbol}/financials/{type}` - Financial statements
- `GET /stocks/{symbol}/advanced_financials` - Advanced metrics

#### Dashboard (`/api/dashboard/`)
- `GET /dashboard/overview` - KPI overview with financial metrics
- `GET /dashboard/allocation` - Portfolio allocation breakdown
- `GET /dashboard/gainers` - Top portfolio gainers
- `GET /dashboard/losers` - Top portfolio losers
- `GET /dashboard/fx/latest` - Latest FX rates

### External API Integrations

#### Alpha Vantage (Primary Market Data)
- **Rate Limiting**: 60 requests/minute with exponential backoff
- **Caching**: 5-minute TTL for popular endpoints
- **Features**: Real-time quotes, historical data, fundamentals, news sentiment
- **Error Handling**: Comprehensive retry logic and fallback mechanisms

## =Ä Database Schema

### Core Models
- **`Transaction`** - Source of truth for all portfolio data
- **`Portfolio`** - User portfolio containers with cash tracking
- **`Holding`** - Individual stock positions (derived from transactions)
- **`StockSymbol`** - Comprehensive stock symbol database
- **`UserSettings`** - User preferences and configuration

### Market Data Cache
- **`CachedDailyPrice`** - OHLCV price data cache
- **`CachedCompanyFundamentals`** - Company fundamental data
- **`DailyPriceCache`** - Transaction system price cache
- **`ExchangeRate`** - Currency conversion rates

### User Management
- **`UserApiRateLimit`** - Per-user API quota management
- **`PriceAlert`** - User-defined price monitoring
- **`UserSettings`** - Personalization preferences

## = Authentication & Security

### Supabase Authentication
- **JWT Token Verification** - Secure API access
- **Session Management** - Automatic token refresh
- **Route Protection** - Authenticated routes only
- **User Context** - Available throughout application

### Security Features
- **SQL Injection Protection** - ORM and parameterized queries
- **User Data Isolation** - All queries filtered by user_id
- **TLS Encryption** - Secure external API communications
- **Input Validation** - Comprehensive data validation

## <¯ Performance Optimizations

### Database Optimizations
- **Strategic Indexing** - Optimized queries on user_id, ticker, dates
- **Connection Pooling** - Efficient database connection management
- **Bulk Operations** - Batch processing for large datasets
- **Query Optimization** - Selective field fetching and aggregations

### API Optimizations
- **Concurrent Processing** - Parallel API calls using async/await
- **Intelligent Caching** - User-specific cache isolation
- **Rate Limit Management** - Proactive throttling and retry logic
- **Response Compression** - Efficient data serialization

### Frontend Optimizations
- **Code Splitting** - Lazy loading of components
- **React Query** - Automatic caching and background updates
- **Optimistic Updates** - Immediate UI feedback
- **Skeleton Loading** - Professional loading states

## >ê Testing Strategy

### Test Coverage
- **Backend**: pytest-django with comprehensive unit and integration tests
- **Frontend**: Jest + React Testing Library for component testing
- **E2E**: Playwright for full user journey testing
- **Load Testing**: Realistic load testing with concurrent users

### Test Types
- **Unit Tests**: Individual function and component testing
- **Integration Tests**: API endpoint and service testing
- **E2E Tests**: Cross-browser user workflow testing
- **Performance Tests**: Load testing and benchmarking

## =€ Deployment & Scaling

### Development Setup
```bash
# Backend
cd backend && python manage.py runserver

# Frontend  
cd frontend && npm run dev

# Database
# Uses Supabase cloud PostgreSQL
```

### Production Architecture
- **Load Balancer**: Nginx with SSL termination
- **Backend**: 3 Gunicorn replicas with multiple workers
- **Caching**: Redis for sessions and API responses
- **Database**: PgBouncer connection pooling
- **Auto-scaling**: Kubernetes HPA (5-50 pods)

### Docker Deployment
```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up
```

### Kubernetes Deployment
- **Horizontal Pod Autoscaler** - CPU/Memory based scaling
- **Health Checks** - Liveness and readiness probes
- **Rolling Deployments** - Zero-downtime updates
- **Resource Management** - CPU/Memory limits and requests

## =' Configuration

### Environment Variables

#### Backend (`/backend/.env`)
```env
ALPHA_VANTAGE_API_KEY=your_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

#### Frontend (`/frontend/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## <ÃB Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL (or Supabase account)
- Alpha Vantage API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd portfolio-management-app
```

2. **Backend setup**
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

3. **Frontend setup**
```bash
cd frontend
npm install
npm run dev
```

4. **Load sample data**
```bash
cd backend
python manage.py load_symbols
python manage.py create_sample_data
```

### First-time Setup
1. Create Supabase account and project
2. Get Alpha Vantage API key (free tier available)
3. Configure environment variables
4. Run database migrations
5. Load stock symbols database
6. Create test user account

## =È Key Features in Detail

### Dashboard Analytics
- **Real-time KPIs**: Portfolio value, daily P&L, total return, Sharpe ratio
- **Interactive Charts**: Performance vs benchmarks with period selection
- **Asset Allocation**: Sector and individual stock breakdowns
- **Market Movers**: Top gainers and losers from your portfolio
- **FX Ticker**: Real-time currency exchange rates

### Transaction Management
- **Complete History**: All buy/sell/dividend transactions
- **Real-time Pricing**: Current market values for all positions
- **Cost Basis Tracking**: Average cost and total return calculations
- **Multi-currency**: Support for different currencies with FX conversion
- **Bulk Operations**: Efficient handling of large transaction datasets

### Advanced Analytics
- **Portfolio Optimization**: Risk-return analysis and suggestions
- **Diversification Metrics**: Sector and geographic diversification analysis
- **Risk Assessment**: Beta, volatility, and correlation analysis
- **Dividend Forecasting**: Projected dividend income over 12 months
- **Benchmark Comparison**: Performance against major indices

## > Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit pull request

### Code Standards
- **Python**: PEP 8 compliance with black formatting
- **TypeScript**: Strict type checking enabled
- **Testing**: Comprehensive test coverage required
- **Documentation**: Code comments and API documentation

## =Ý License

This project is licensed under the MIT License - see the LICENSE file for details.

## <˜ Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Review the troubleshooting guide
- Check the API documentation
- Review the test suites for usage examples

---

**Built with modern web technologies for professional portfolio management**