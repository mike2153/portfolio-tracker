# Portfolio Tracker - Simplified Architecture

## Overview
This is a complete rebuild of the portfolio tracker with a simplified, production-ready architecture designed for 100 users as a SaaS application.

## Key Principles
- **snake_case** naming convention everywhere
- **Extensive debugging** with file, function, API, and data flow logging
- **Real authentication** using Supabase (email/password + Google/Apple OAuth)
- **Real API calls** - no mocks, no stubs, no fake data
- **Simplified architecture** - fewer layers, clearer data flow
- **API-specific naming** - `supa_api_*`, `vantage_api_*`, `front_api_*`, `backend_api_*`

## Architecture

```
Frontend (Next.js) → FrontApi → Backend (FastAPI) → VantageApi (Alpha Vantage)
                                                  → SupaApi (Supabase)
```

## Project Structure

```
portfolio-tracker/
├── frontend/                           # Next.js frontend
│   ├── app/                           # App router pages
│   │   ├── auth/                      # Login/signup
│   │   ├── dashboard/                 # Main dashboard
│   │   ├── research/                  # Stock research
│   │   ├── portfolio/                 # Portfolio view
│   │   └── transactions/              # Transaction management
│   ├── components/                    # Reusable UI components
│   └── lib/                          # API clients and utilities
│       ├── front_api_client.ts       # Frontend→Backend API
│       ├── front_api_auth.ts         # Auth-specific calls
│       └── debug_logger.ts           # Frontend debugging
│
├── backend/                          # FastAPI backend
│   ├── main.py                      # FastAPI app entry
│   ├── config.py                    # All configuration
│   ├── backend_api_routes/          # API endpoints
│   │   ├── backend_api_auth.py     # Auth endpoints
│   │   ├── backend_api_dashboard.py # Dashboard data
│   │   ├── backend_api_portfolio.py # Portfolio calculations
│   │   └── backend_api_research.py  # Stock research
│   ├── vantage_api/                 # Alpha Vantage integration
│   │   ├── vantage_api_client.py   # AV client
│   │   ├── vantage_api_quotes.py   # Quote functions
│   │   └── vantage_api_search.py   # Symbol search
│   ├── supa_api/                    # Supabase integration
│   │   ├── supa_api_client.py      # Supabase setup
│   │   ├── supa_api_auth.py        # Auth helpers
│   │   ├── supa_api_transactions.py # Transaction queries
│   │   └── supa_api_portfolio.py   # Portfolio queries
│   └── debug_logger.py              # Backend debugging
│
├── supabase/                        # Database schema
│   ├── migrations/                  # Version-controlled migrations
│   │   └── 001_initial_schema.sql  # Complete schema
│   └── seed.sql                    # Optional test data
│
├── tests/                          # All tests (real auth, real APIs)
│   ├── backend/
│   │   ├── test_vantage_api_real.py
│   │   ├── test_supa_api_real.py
│   │   └── test_backend_api_real.py
│   └── e2e/
│       ├── test_auth_flow.spec.ts
│       ├── test_research_flow.spec.ts
│       └── test_transaction_flow.spec.ts
│
├── docker-compose.yml              # Single Docker config
├── .env.example                    # Environment template
├── .env.test                       # Test credentials
├── requirements.txt                # Python dependencies
├── package.json                    # Node dependencies
└── README.md                       # Setup instructions
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/signup` - Create account
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Get current user

### Research
- `GET /api/symbol_search?q=AAPL` - Search stocks with scoring
- `GET /api/stock_overview?symbol=AAPL` - Get all stock data

### Portfolio
- `GET /api/portfolio` - Get user's portfolio
- `GET /api/portfolio/value` - Calculate total value

### Transactions
- `GET /api/transactions` - List user's transactions
- `POST /api/transactions` - Add transaction
- `PUT /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Delete transaction

### Dashboard
- `GET /api/dashboard` - Get all dashboard data in one call

## Database Schema

### Tables
1. **profiles** - Extended user data
2. **transactions** - All buy/sell transactions
3. **stock_symbols** - Cached symbol data for autocomplete
4. **api_cache** - Alpha Vantage response cache

### Views
1. **portfolio** - Calculated holdings from transactions
2. **portfolio_performance** - Performance metrics

## Authentication Flow
1. User signs up/logs in via Supabase Auth
2. Supabase returns JWT token
3. Frontend includes token in all API calls
4. Backend validates token with Supabase
5. Row-level security ensures data isolation

## Data Flow Example: Stock Research
1. User types "AAPL" in search box
2. `front_api_search_symbols()` debounces and calls backend
3. `backend_api_symbol_search_handler()` receives request
4. Checks `supa_api_get_cached_symbols()` first
5. If not cached, calls `vantage_api_symbol_search()`
6. Applies scoring algorithm (exact match > prefix > substring)
7. Caches results via `supa_api_cache_symbols()`
8. Returns scored results to frontend
9. Frontend displays with keyboard navigation

## Debugging Output Example
```
[front_api_client.ts::front_api_search_symbols] Starting API call
FILE: front_api_client.ts
FUNCTION: front_api_search_symbols
API: SYMBOL_SEARCH
SENDER: FRONTEND
RECEIVER: BACKEND
DATA: {query: "AAPL"}

[backend_api_research.py::backend_api_symbol_search_handler] Received request
FILE: backend_api_research.py
FUNCTION: backend_api_symbol_search_handler
API: INTERNAL
QUERY: AAPL

[supa_api_cache.py::supa_api_get_cached_symbols] Checking cache
FILE: supa_api_cache.py
FUNCTION: supa_api_get_cached_symbols
API: SUPABASE
CACHE_HIT: false

[vantage_api_search.py::vantage_api_symbol_search] Calling Alpha Vantage
FILE: vantage_api_search.py
FUNCTION: vantage_api_symbol_search
API: ALPHA_VANTAGE
URL: https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=AAPL
```

## Testing Strategy
- All tests use real authentication
- Test credentials in `.env.test`
- No mocks or stubs
- Real API calls to Alpha Vantage
- Real database operations
- Automated user login flow
- Full E2E testing with Playwright

## Deployment
1. **Frontend**: Vercel (automatic from GitHub)
2. **Backend**: Docker on Fly.io/Render
3. **Database**: Supabase (managed)
4. **Monitoring**: Built-in debug logs

## Environment Variables
```bash
# Supabase
SUPA_API_URL=https://xxx.supabase.co
SUPA_API_ANON_KEY=xxx
SUPA_API_SERVICE_KEY=xxx

# Alpha Vantage
VANTAGE_API_KEY=xxx
VANTAGE_API_BASE_URL=https://www.alphavantage.co/query

# Backend
BACKEND_API_PORT=8000
BACKEND_API_HOST=0.0.0.0

# Frontend
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
```

## Files Deleted from Original Structure
- All Django files (models.py, views.py, admin.py, etc.)
- Django migrations folder
- Django management commands
- Next.js API routes (moved to FastAPI)
- Complex service layers
- Redundant test files
- Multiple Docker configs

## Performance Optimizations
1. Single API call per page load
2. Supabase caching for Alpha Vantage data (1 hour TTL)
3. Portfolio calculated via SQL view (no application logic)
4. Debounced search (300ms)
5. Connection pooling for database

## Security
1. Supabase Row Level Security (RLS)
2. JWT token validation
3. API rate limiting
4. Input validation with Pydantic
5. CORS configuration
6. Environment variable management

## Next Steps
1. Run `docker-compose up` to start development
2. Apply Supabase migrations
3. Create test user account
4. Run test suite
5. Deploy to production 