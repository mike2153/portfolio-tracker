# Portfolio Tracker

A comprehensive financial portfolio management platform built with Next.js, FastAPI, and Supabase. Track investments, analyze performance, and manage your financial portfolio with advanced analytics and real-time market data.

[![Technology Stack](https://img.shields.io/badge/Next.js-15.3.5-000000?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat&logo=python&logoColor=white)](https://python.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.10.0-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org/)

## ✨ Features

### 📊 Portfolio Management
- **Real-time Holdings Tracking** - Monitor your investments with live market data
- **Transaction Management** - Buy/sell tracking with cost basis calculations
- **Performance Analytics** - Portfolio vs benchmark comparisons with multiple timeframes
- **Allocation Analysis** - Sector and geographic diversification insights

### 📈 Advanced Analytics
- **IRR Calculations** - Internal Rate of Return tracking
- **Dividend Management** - Automatic dividend detection and confirmation
- **Gain/Loss Analysis** - Realized and unrealized gains with tax implications
- **Historical Performance** - Multi-period performance analysis

### 🔍 Market Research
- **Stock Search** - Comprehensive symbol search with relevance scoring
- **Company Fundamentals** - Financial statements and key metrics
- **Real-time Quotes** - Live market data integration
- **News & Sentiment** - Stock-specific news with sentiment analysis

### 📱 Cross-Platform Support
- **Web Application** - Full-featured Next.js web interface
- **Mobile App** - React Native/Expo mobile application
- **Shared Components** - Unified codebase with cross-platform components

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **Python** 3.11+
- **Docker & Docker Compose**
- **Supabase Account** (free tier available)
- **Alpha Vantage API Key** (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd portfolio-tracker
   ```

2. **Set up environment variables**
   ```bash
   # Backend
   cp backend_simplified/.env.example backend_simplified/.env
   
   # Frontend  
   cp frontend/.env.example frontend/.env.local
   
   # Configure your API keys and database URLs
   ```

3. **Start with Docker (Recommended)**
   ```bash
   docker-compose up --build -d
   ```

4. **Or run manually**
   ```bash
   # Backend
   cd backend_simplified
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   
   # Frontend (new terminal)
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **API Documentation**: http://localhost:8000/docs

## 🏗️ Architecture

### Technology Stack

**Backend:**
- **FastAPI** 0.104.1 - Modern async Python web framework
- **Python** 3.11 - With complete type annotations
- **Supabase** 2.10.0 - PostgreSQL database with real-time features
- **Alpha Vantage** - Market data API integration
- **Pydantic** 2.5.0 - Data validation and serialization

**Frontend:**
- **Next.js** 15.3.5 - React framework with App Router
- **React** 19.1.0 - Latest React with concurrent features
- **TypeScript** 5.8.3 - Strict type checking enabled
- **Tailwind CSS** 3.4.1 - Utility-first CSS framework
- **ApexCharts** 4.7.0 - Interactive charts and visualizations
- **React Query** 5.81.5 - Server state management

**Mobile:**
- **Expo** ~53.0.20 - React Native development platform
- **React Native** 0.79.5 - Cross-platform mobile framework
- **Victory Native** 36.6.11 - Data visualization for mobile
- **NativeWind** 4.1.23 - Tailwind CSS for React Native

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Portfolio Tracker                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)    →    Backend (FastAPI)    →    DB   │
│  Port: 3000                 Port: 8000             Supabase │
│                                                             │
│  Mobile App (Expo)     →    Shared Module                  │
│  React Native               API Client & Types              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Frontend → Backend API → Database (Supabase)
                      ↓
                Alpha Vantage API (when data missing)
                      ↓
                Update Database → Return to Frontend
```

## 📁 Project Structure

```
portfolio-tracker/
├── frontend/                    # Next.js web application
│   ├── src/app/                # App Router pages
│   ├── src/components/         # Reusable React components  
│   ├── src/hooks/              # Custom React hooks
│   └── src/types/              # TypeScript type definitions
├── backend_simplified/          # FastAPI backend
│   ├── backend_api_routes/     # API endpoint definitions
│   ├── services/               # Business logic layer
│   ├── supa_api/              # Database integration
│   ├── vantage_api/           # External API integration
│   └── models/                # Data models and validation
├── portfolio-universal/         # React Native mobile app
│   ├── src/components/        # Mobile components
│   ├── src/screens/           # Mobile screens
│   └── src/navigation/        # Navigation configuration
├── shared/                     # Cross-platform shared code
│   ├── api/                   # API client
│   ├── types/                 # Shared type definitions
│   └── utils/                 # Utility functions
├── docs/                       # Comprehensive documentation
│   ├── api_master.md          # API documentation
│   ├── backend_master.md      # Backend architecture
│   ├── frontend_master.md     # Frontend architecture
│   ├── deployment-operations.md # Deployment guide
│   └── database_master.md     # Database schema
└── scripts/                    # Quality assurance scripts
    ├── quality_monitor.py     # Automated quality monitoring
    └── validate_*.py          # Code validation scripts
```

## 🔧 Configuration

### Environment Variables

**Backend (`.env`)**
```env
# Database
SUPA_API_URL=https://your-project.supabase.co
SUPA_API_ANON_KEY=your-anon-key
SUPA_API_SERVICE_KEY=your-service-key

# External APIs
VANTAGE_API_KEY=your-alpha-vantage-key

# Server Configuration
BACKEND_API_PORT=8000
BACKEND_API_DEBUG=false
```

**Frontend (`.env.local`)**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ENVIRONMENT=development
```

**Mobile (`.env`)**
```env
# Supabase (Expo format)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co  
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
```

## 🧪 Quality Assurance

The Portfolio Tracker includes a comprehensive quality monitoring system:

### Automated Quality Checks
- **Type Safety**: 98% TypeScript coverage, zero Python type errors
- **Security**: Zero tolerance for SQL injection, raw SQL detection
- **Code Quality**: <3% duplication, comprehensive linting
- **Performance**: Bundle size limits, load time monitoring
- **Financial Precision**: DECIMAL type enforcement for all monetary calculations

### Running Quality Checks
```bash
# Single quality check
python scripts/quality_monitor_safe.py

# Continuous monitoring
python scripts/quality_monitor_safe.py --daemon --interval 5

# Generate quality dashboard
python scripts/quality_monitor_safe.py --dashboard
```

### Quality Dashboard
View real-time quality metrics at: `quality_dashboard.html`

## 🚀 Deployment

### Development
```bash
# Start development environment
docker-compose up --build -d

# View logs
docker-compose logs -f
```

### Production  
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Health checks
curl http://localhost:8000/health
curl http://localhost:3000/api/health
```

### Mobile Development
```bash
cd portfolio-universal
npx expo start

# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android
```

## 📊 Performance

### Current Performance Metrics
- **Dashboard Load Time**: 3-5 seconds (8 API calls)
- **Bundle Size**: <362KB per chunk
- **Database Queries**: Optimized with intelligent caching
- **API Response Time**: <200ms typical

### Planned Optimizations (Load Everything Once Architecture)
- **87.5% reduction** in API calls (8 calls → 1 call)
- **80% faster** dashboard loads (3-5s → 0.5-1s)
- **Instant page navigation** after initial load
- **4,100+ lines of code eliminated**

## 🔒 Security

### Security Features
- **100% Row Level Security (RLS)** - 55 database policies
- **JWT Authentication** - Supabase Auth integration  
- **Input Validation** - Comprehensive Pydantic models
- **SQL Injection Prevention** - Parameterized queries only
- **Financial Data Integrity** - DECIMAL precision throughout
- **Comprehensive Audit Logging** - Complete audit trail

### Security Monitoring
```bash
# Security validation
python scripts/validate_rls_policies.py
python scripts/detect_raw_sql.py  
python scripts/validate_decimal_usage.py
```

## 📚 Documentation

- **[API Documentation](docs/api_master.md)** - Complete API reference (70+ endpoints)
- **[Backend Architecture](docs/backend_master.md)** - Backend design and patterns
- **[Frontend Architecture](docs/frontend_master.md)** - Frontend structure and components
- **[Deployment Guide](docs/deployment-operations.md)** - Production deployment procedures
- **[Database Schema](docs/database_master.md)** - Complete database documentation
- **[Quality Assurance](docs/quality-assurance.md)** - Quality standards and monitoring

## 🤝 Contributing

### Development Workflow

1. **Follow CLAUDE.md Protocol**
   - Plan → Consult → Pre-Implementation → Review → Implementation
   - Zero tolerance for type errors
   - Strong typing mandatory (Python & TypeScript)

2. **Code Standards**
   - 100% type annotation coverage
   - DECIMAL precision for financial calculations
   - Comprehensive error handling
   - No code duplication

3. **Quality Gates**
   - All quality checks must pass
   - Zero linter errors allowed
   - Security validation required
   - Performance benchmarks maintained

### Development Commands
```bash
# Quality checks
python scripts/quality_monitor_safe.py

# Type validation  
npm run type-check                    # Frontend
python -m mypy backend_simplified/    # Backend

# Testing
npm test                              # Frontend tests
pytest backend_simplified/tests/     # Backend tests
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Supabase** - Backend-as-a-Service platform
- **Alpha Vantage** - Financial market data API
- **Vercel** - Frontend deployment and hosting
- **Docker** - Containerization platform

---

**Portfolio Tracker** - Built with ❤️ for modern portfolio management

For detailed setup instructions, API documentation, and architecture details, see the [docs/](docs/) directory.

**Status**: Production Ready | **Version**: 2.1 | **Last Updated**: August 2025