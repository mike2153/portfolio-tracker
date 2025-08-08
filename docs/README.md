# Portfolio Tracker

A comprehensive investment portfolio management system with real-time market data, performance analytics, and multi-currency support.

## Architecture Overview

### Backend (FastAPI + Python)
- **Framework:** FastAPI with async/await support
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with JWT tokens
- **Market Data:** Alpha Vantage API integration
- **Type Safety:** Strict typing with mypy/pyright, Pydantic models
- **Financial Precision:** Decimal type for all monetary calculations

### Frontend (Next.js 14 + TypeScript)
- **Framework:** Next.js 14 with App Router
- **State Management:** React Query (TanStack Query)
- **UI Components:** Tailwind CSS, Custom components
- **Charts:** Plotly.js for interactive visualizations
- **Type Safety:** TypeScript with strict mode enabled

## Key Features

- **Portfolio Management:** Track stocks across multiple currencies
- **Transaction History:** Buy, sell, and dividend tracking
- **Real-time Quotes:** End-of-day and intraday price data
- **Performance Analytics:** Portfolio metrics, gains/losses, returns
- **Multi-currency Support:** Automatic forex conversion
- **Watchlist:** Monitor stocks without owning them
- **Research Tools:** Company fundamentals and news

## Data Flow Architecture

The system enforces a strict data flow pattern:
```
Frontend → Backend API → Supabase/Alpha Vantage
```

- Frontend NEVER directly queries Supabase (except auth)
- Backend validates all requests and handles business logic
- Supabase stores all persistent data
- Alpha Vantage provides market data (cached in Supabase)

## Development Guidelines

### 📚 Documentation
- **[CLAUDE.md](./CLAUDE.md)** - Main development protocol and AI agent guidelines
- **[Frontend Guidelines](./frontend/FRONTEND_GUIDELINES.md)** - Comprehensive frontend development standards
- **[Recent Fixes](./frontend/RECENT_FIXES.md)** - Documentation of recent code quality improvements

### Code Quality Standards

#### Python Backend
- **Type Safety:** All functions must have complete type annotations
- **Financial Types:** ALWAYS use Decimal, never float/int for money
- **Authentication:** Always validate user_id as non-empty string
- **Error Handling:** Comprehensive error handling with proper status codes

#### TypeScript Frontend
- **Strict Mode:** TypeScript strict mode is enabled
- **No Any Types:** All variables and functions must be properly typed
- **Component Structure:** Functional components with hooks
- **API Client:** Centralized API client with type-safe methods

### Validation Requirements

Before any code changes are considered complete, the following validation scripts MUST pass:

```bash
# Python validation
python scripts/validate_optional_user_id.py  # No Optional user_id allowed
python scripts/validate_float_conversions.py  # No float for financial data
python -m mypy backend --strict  # Type checking

# TypeScript validation
npm run lint  # ESLint must pass
npx tsc --noEmit  # TypeScript compilation check
```

## Project Structure

```
portfolio-tracker/
├── backend/
│   ├── backend_api_routes/  # API endpoints
│   ├── supa_api/            # Supabase interactions
│   ├── vantage_api/         # Alpha Vantage integration
│   ├── services/            # Business logic
│   ├── models/              # Pydantic models
│   ├── utils/               # Utilities (auth, financial math)
│   └── main.py              # FastAPI application
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js app routes
│   │   ├── components/     # Reusable components
│   │   ├── lib/           # API client, utilities
│   │   └── types/         # TypeScript type definitions
│   └── tsconfig.json       # TypeScript configuration
├── scripts/                # Validation and utility scripts
├── supabase/              # Database migrations
└── CLAUDE.md              # Development protocol

```

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 18+
- Supabase account
- Alpha Vantage API key

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure environment variables
python main.py
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local  # Configure environment variables
npm run dev
```

## Environment Variables

### Backend (.env)
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## Contributing

Please read CLAUDE.md for detailed development guidelines and protocols.

## License

Private project - All rights reserved