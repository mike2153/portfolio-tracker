# Portfolio Tracker - Simplified Version

A streamlined portfolio tracking application with real-time stock data, built for production use as a SaaS platform.

## ✨ Key Features
- **Real-time stock data** from Alpha Vantage
- **Secure authentication** with Supabase (email/password + OAuth)
- **Transaction management** with buy/sell tracking
- **Portfolio calculations** with gain/loss analysis
- **Dashboard overview** with all data in one call
- **Extensive debugging** throughout the entire application
- **Real API testing** - no mocks or stubs

## 🏗️ Architecture
```
Frontend (Next.js) → Backend (FastAPI) → Alpha Vantage (Stock Data)
                                      → Supabase (Database + Auth)
```

## 📋 Prerequisites
- Node.js 18+
- Python 3.11+
- Docker (optional)
- Supabase account
- Alpha Vantage API key

## 🚀 Quick Start

### 1. Clone and Setup Environment
```bash
# Clone the repository
git clone <your-repo-url>
cd portfolio-tracker

# Copy environment template
cp env.example .env

# Edit .env with your credentials
# - Add Supabase URL and keys
# - Add Alpha Vantage API key
```

### 2. Setup Supabase
1. Create a new Supabase project
2. Go to SQL Editor and run:
   ```sql
   -- Copy contents of supabase/migrations/001_initial_schema.sql
   ```
3. Enable Email/Password authentication
4. (Optional) Enable Google/Apple OAuth

### 3. Run with Docker
```bash
docker-compose -f docker-compose-simplified.yml up
```

### 4. Run without Docker

#### Backend:
```bash
cd backend_simplified
pip install -r requirements.txt
python main.py
```

#### Frontend:
```bash
cd frontend_simplified
npm install
npm run dev
```

## 🧪 Testing with Real Authentication

### Setup Test Environment
```bash
# Copy test environment template
cp env.test.example .env.test

# Edit .env.test with:
# - Real test user credentials
# - Same API keys as production
```

### Run Tests
```bash
# Backend tests with real auth
cd tests/backend
pytest test_real_auth_api.py -v

# Frontend E2E tests
cd tests/e2e
npm test
```

## 📁 Project Structure
```
portfolio-tracker/
├── backend_simplified/         # FastAPI backend
│   ├── backend_api_routes/    # API endpoints
│   ├── supa_api/             # Supabase integration
│   ├── vantage_api/          # Alpha Vantage integration
│   └── main.py               # Application entry
├── frontend_simplified/       # Next.js frontend
│   ├── app/                  # Pages
│   ├── components/           # UI components
│   └── lib/                  # API clients
├── supabase/                 # Database schema
├── tests/                    # Real API tests
└── docker-compose-simplified.yml
```

## 🔑 API Naming Convention
- `supa_api_*` - Supabase database operations
- `vantage_api_*` - Alpha Vantage stock data
- `front_api_*` - Frontend to backend calls
- `backend_api_*` - Backend route handlers

## 📊 API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user
- `GET /api/auth/validate` - Validate token

### Research
- `GET /api/symbol_search?q=AAPL` - Search stocks
- `GET /api/stock_overview?symbol=AAPL` - Get stock data

### Portfolio
- `GET /api/portfolio` - Get holdings
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Add transaction
- `PUT /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Delete transaction

### Dashboard
- `GET /api/dashboard` - Get all dashboard data

## 🔍 Debugging

All API calls are extensively logged with:
- File name and function
- API being called
- Sender and receiver
- Request/response data
- Execution time

Example output:
```
========== API CALL START ==========
FILE: backend_api_research.py
FUNCTION: backend_api_symbol_search_handler
API: BACKEND_API
SENDER: FRONTEND
RECEIVER: BACKEND
QUERY: AAPL
====================================
```

## 🚢 Deployment

### Backend (FastAPI)
1. Build Docker image
2. Deploy to Fly.io/Render/Railway
3. Set environment variables

### Frontend (Next.js)
1. Deploy to Vercel
2. Set environment variables
3. Update `NEXT_PUBLIC_BACKEND_API_URL`

### Database
- Supabase is managed - no deployment needed

## 🔒 Security
- Row Level Security (RLS) on all tables
- JWT token validation
- User data isolation
- API rate limiting
- Input validation

## 📈 Performance
- Single API call per page
- Caching for Alpha Vantage data (1 hour)
- Portfolio calculated via SQL view
- Parallel data fetching
- Connection pooling

## 🛠️ Maintenance

### Clear API Cache
```sql
SELECT public.clean_expired_cache();
```

### Update Stock Symbols
```python
# Run in backend
python -c "from supa_api import update_stock_symbols; update_stock_symbols()"
```

## 📝 License
[Your License]

## 🤝 Contributing
[Your Contributing Guidelines] 