# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a portfolio tracking application with a modern web architecture consisting of:
- **Frontend**: Next.js 13+ with App Router, React Query, and Supabase authentication
- **Backend**: FastAPI with Python, Supabase database integration, and Alpha Vantage API
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Testing**: E2E tests with Playwright using real APIs, Jest for frontend unit tests, pytest for backend

## Development Commands

### Frontend Development
```bash
# Frontend directory: /frontend/
cd frontend
npm run dev          # Start development server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
```

### Backend Development
```bash
# Backend directory: /backend_simplified/
cd backend_simplified
pip install -r requirements.txt
uvicorn main:app --reload --port 8000  # Start development server
python -m pytest    # Run backend tests
black .             # Format code
flake8 .            # Lint code
```

### Docker Development
```bash
# From project root
docker-compose up                    # Start full stack
docker-compose up --build           # Rebuild and start
docker-compose down                  # Stop services
docker-compose logs backend         # View backend logs
docker-compose logs frontend        # View frontend logs
```

### End-to-End Testing
```bash
# E2E test directory: /e2e_test_suite/
cd e2e_test_suite
npm run test:e2e                     # Run all E2E tests
npm run test:e2e:headed             # Run with browser UI
npm run test:e2e:debug              # Run in debug mode
npm run test:e2e:dashboard          # Run dashboard tests only
npm run test:e2e:real-api           # Run tests with real API calls
npm run report                      # View test report
```

## Architecture

### Backend Architecture (FastAPI)
- **Main App**: `main.py` - FastAPI app with CORS, logging, and router registration
- **API Routes**: `backend_api_routes/` - Modular route handlers
  - `backend_api_auth.py` - Authentication and token validation
  - `backend_api_portfolio.py` - Portfolio management and transactions
  - `backend_api_dashboard.py` - Dashboard data aggregation
  - `backend_api_research.py` - Stock research and market data
- **Database Layer**: `supa_api/` - Supabase integration with RLS
- **External APIs**: `vantage_api/` - Alpha Vantage integration with caching
- **Config**: `config.py` - Environment variables and settings

### Frontend Architecture (Next.js 13+)
- **App Router**: Modern Next.js routing in `app/` directory
- **Pages**: Route-based organization with feature-specific components
- **State Management**: React Query for server state, Context API for global state
- **Authentication**: Supabase Auth with custom AuthProvider
- **API Integration**: Centralized client in `lib/front_api_client.ts`
- **Components**: Shared UI components in `components/`, feature-specific in page directories

### Database Integration
- **Supabase**: Primary database with Row Level Security (RLS)
- **Authentication**: JWT tokens validated server-side
- **Security**: User-scoped data access enforced at database level
- **Caching**: Alpha Vantage API responses cached in Supabase tables

### Key Data Flow
1. Frontend → Supabase Auth → JWT Token
2. API Request → FastAPI → Token Validation → Supabase Client
3. Database Query → RLS Enforcement → Data Return
4. External API → Caching Layer → Response

## Testing Strategy

### E2E Tests (Playwright)
- **Real API Integration**: Uses actual Supabase, Alpha Vantage APIs
- **Test Environment**: Separate test database and API keys
- **Coverage**: Authentication, dashboard KPIs, transactions, research
- **Configuration**: `playwright.config.ts` with environment-specific settings

### Frontend Unit Tests (Jest)
- **Configuration**: `jest.config.js` with Next.js setup
- **Test Files**: `*.test.tsx` files co-located with components
- **Focus**: Component behavior, user interactions, form validation

### Backend Tests (pytest)
- **Location**: `tests/backend/`
- **Coverage**: API endpoints, database operations, external API integration
- **Test Data**: Real stock symbols with mocked API responses where appropriate

## Environment Configuration

### Required Environment Variables
```bash
# Supabase
SUPA_API_URL=your_supabase_url
SUPA_API_ANON_KEY=your_anon_key
SUPA_API_SERVICE_KEY=your_service_key

# Alpha Vantage
VANTAGE_API_KEY=your_api_key

# Next.js Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Environment Files
- `env.test` - Test environment variables
- `frontend/.env.local` - Frontend environment variables
- `e2e_test_suite/config/test.env` - E2E test configuration

## Development Workflow

### Making Changes
1. Start development servers: `docker-compose up` or individual services
2. Frontend changes: Auto-reload on save
3. Backend changes: Auto-reload with `--reload` flag
4. Database changes: Apply via Supabase dashboard or migrations
5. Run tests: `npm run test:e2e` for full validation

### Before Committing
1. Run frontend linting: `npm run lint` in frontend directory
2. Run backend linting: `flake8 .` in backend directory
3. Run backend tests: `python -m pytest` in backend directory
4. Run key E2E tests: `npm run test:e2e:dashboard` in e2e_test_suite directory

## Key Integration Points

### Authentication Flow
- Supabase Auth handles login/logout
- JWT tokens automatically attached to API requests
- Backend validates tokens and enforces RLS

### Financial Data Pipeline
- Alpha Vantage API provides real-time stock data
- Cached in Supabase for performance
- Dashboard calculations use cached data with fallback to API

### Real-time Updates
- React Query manages server state caching
- Supabase realtime subscriptions for database changes
- Automatic re-fetching on window focus

## Debugging

### Backend Issues
- Check logs: `docker-compose logs backend`
- Debug logger: Comprehensive logging in `debug_logger.py`
- API testing: Use FastAPI auto-generated docs at `http://localhost:8000/docs`

### Frontend Issues
- Browser dev tools: Network tab for API calls
- React Query DevTools: Available in development mode
- Component state: React Developer Tools

### E2E Test Issues
- Visual debugging: `npm run test:e2e:headed`
- Screenshots: Automatically captured on failure
- Test reports: HTML reports in `test-results/`

## Performance Considerations

### Backend
- Async/await patterns throughout
- Parallel API calls for dashboard data
- Intelligent caching with TTL
- Connection pooling for database

### Frontend
- React Query caching (5-minute stale time)
- Suspense boundaries for progressive loading
- Code splitting with dynamic imports
- Optimistic updates for better UX

### Database
- Row Level Security policies optimized
- Proper indexing on frequently queried columns
- Batch operations for bulk data updates

You are an expert Node.js developer tasked with writing production-quality code.

   - No mock data, no fake users, no stubs, no mocks of any kind are allowed anywhere.
   - Your tests must authenticate properly and hit the real endpoints exactly as production would.
3. All code you write, including tests, must include **extensive console logging** for debugging purposes.  
   - Log inputs, outputs, key decision points, and error details clearly.
4. You must write all explanations for the code and tests in **simple, beginner-friendly language** — as if teaching someone new to Node.js but who has experience with Qt and C++.
5. For every change or addition, provide a clear explanation of what was done, why it was done, and how it works.
6. When writing code, favor clarity and best practices suitable for a production environment.
7. If I ask for help debugging, always suggest reading console logs first, and explain how to interpret them.
8. Assume the user has basic programming knowledge but is new to Node.js and asynchronous JavaScript.
9. Help me learn by explaining asynchronous code patterns (Promises, async/await), callbacks, and typical Node.js idioms as they come up.

KEY POINTS:
You must return every question I have with three possible ways to acheieve the goal, the pros and cons of each and what you recommend.
You must aim to acheiev our call with as little code as possible
You must not add new files to the codebase unless it is extremeley nessicary, and not without asking me for approval first.
For any change you make, you must add a extensive amount of debugging comments to the console. I mean, for every time data is changed, variable stored etc you must 
return it to the console for debugging. This will allow to work through busg alot easier.

Your goal: produce fully tested, debug-friendly, real-authentication Node.js code with explanations tailored for a beginner in Node.js, but an experienced programmer overall.




---

Begin each interaction by confirming your understanding of these rules before coding or explaining.