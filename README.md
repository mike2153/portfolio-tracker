# Portfolio Tracker - Comprehensive Investment Management System

A professional-grade portfolio tracking application with real-time performance analysis, comprehensive research tools, and intelligent data management.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd portfolio-tracker

# Start the complete development environment
docker-compose up --build

# Or on Windows
./docker-dev.bat
```

**Access URLs:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📋 Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Performance Optimizations](#performance-optimizations-2025)
3. [Backend API Architecture](#backend-api-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Authentication & Security](#authentication--security)
9. [Deployment & Configuration](#deployment--configuration)
10. [Troubleshooting](#troubleshooting-guide)

---

## Recent Updates *(10 July 2025)*

### 🔧 **Critical Performance & Bug Fixes** *(Today's Updates)*

#### **Performance Optimization**
- **Fixed "Failed to fetch" errors** - Optimized CurrentPriceManager to prevent blocking operations
- **Added Fast Quote System** - 5-minute caching for dashboard and research quick quotes
- **Removed Unnecessary API Calls** - Eliminated redundant SPY quote from dashboard endpoint
- **Background Data Processing** - Data filling now happens asynchronously without blocking user experience

#### **Dynamic Benchmark Selection**
- **Fixed Hardcoded SPY Issue** - Portfolio chart now respects user's selected benchmark (SPY, QQQ, A200, etc.)
- **Proper API Integration** - `usePerformance` hook now correctly passes benchmark parameter to backend
- **Full Benchmark Support** - All supported benchmarks work dynamically in dashboard

#### **Authentication & API Fixes**
- **Fixed Research API Error** - Resolved `'Depends' object has no attribute 'credentials'` error
- **Stock Overview Data** - Company fundamentals (EPS, PE ratio, market cap) now load correctly
- **Improved Error Handling** - Better debugging and graceful error recovery

#### **Chart Library Migration**
- **Complete ApexCharts Migration** - Unified all charts from Plotly.js/LightweightCharts to ApexCharts
- **Fixed Runtime Errors** - Resolved undefined data errors in chart components
- **Enhanced Financial Analysis** - Interactive metric selection with real-time chart updates
- **Consistent Styling** - Unified dark theme and responsive design across all charts

#### **Codebase Cleanup**
- **Removed Obsolete Files** - Cleaned up unused Plotly.js components and dependencies
- **Fixed Tailwind CSS Issues** - Resolved PostCSS plugin errors by correcting version conflicts
- **Removed Unused Imports** - Comprehensive cleanup of backend and frontend imports
- **Created Missing Components** - Added missing `FinancialsChart.tsx` component

### 🎨 **ApexCharts Integration** *(Major UI Overhaul)*

#### **New Chart Components**
- **`ApexChart.tsx`** - Universal chart component with dynamic colors and responsive design
- **`ApexListView.tsx`** - Enhanced data list component with search, sort, and pagination
- **`FinancialBarChartApexEnhanced.tsx`** - Interactive financial analysis with metric selection
- **`FinancialSpreadsheetApex.tsx`** - 5-year historical financial data tables
- **`PriceChartApex.tsx`** - Professional stock price visualization
- **`PortfolioChartApex.tsx`** - Portfolio vs benchmark performance charts

#### **Enhanced Financial Analysis**
- **Interactive Metric Selection** - Checkbox-based selection with real-time updates
- **Dual Y-Axis Charts** - Values and growth percentages on same chart
- **CAGR Calculations** - Compound Annual Growth Rate analysis
- **5-Year Historical Data** - Extended data processing and analysis
- **Category Organization** - Metrics grouped by Income, Balance Sheet, Cash Flow

### 🏗️ **Current Price Management System** *(New Service)*

#### **CurrentPriceManager Features**
- **Unified Price Data** - Single service for all price-related operations
- **Smart Data Filling** - Automatic gap detection and Alpha Vantage integration
- **Fast Quote Method** - Immediate quotes with caching for dashboard/research
- **Background Processing** - Non-blocking data updates
- **Graceful Fallbacks** - Multiple data sources with intelligent fallback

#### **Service Integration**
- **Portfolio Service** - Integrated with CurrentPriceManager for fresh data
- **Dashboard API** - Fast quotes without blocking operations
- **Research API** - Real-time quotes and company fundamentals
- **Authentication Flow** - Proper JWT token handling across all services

---

## Previous Updates *(6-8 July 2025)*

### 📈 **Complete Historical Price Data System** *(New Major Feature)*
- **End-to-End Price Data Flow:** Frontend → Backend → Database → Alpha Vantage (if needed) → Database → Chart
- **Intelligent Caching:** Database-first approach with API fallback for missing/stale data
- **Flexible Time Periods:** Support for days, weeks, months, years, and YTD periods
- **Real-time Integration:** Connected to PriceChartApex component in research overview page
- **Permanent Price Database:** Builds lifetime database as requested, with gap detection and filling

### 🎨 **ResearchEd-Style Research Page Redesign** *(New UI/UX Feature)*
- **Complete UI Overhaul:** Redesigned research page to match modern financial platforms like ResearchEd
- **Clean Header Layout:** Company name, ticker, current price with inline key metrics (no cards)
- **Grouped Metrics Sidebar:** Organized metrics into logical categories (Estimate, Growth, Forecast, Dividends, Trading)
- **Minimal Design:** Removed all cards, shadows, and borders for clean, scannable interface
- **Responsive Layout:** Sidebar stacks below chart on mobile, maintains usability across devices

#### New Backend Components:
- **`GET /api/research/stock_prices/{symbol}`** - Flexible price data endpoint with `?days=7`, `?years=3`, `?ytd=true` support
- **`PriceDataService`** - Complete service with intelligent caching, gap detection, and Alpha Vantage integration  
- **Enhanced `supa_api_historical_prices.py`** - New batch storage and range-based retrieval functions
- **Updated `vantage_api_quotes.py`** - Added `vantage_api_get_daily_adjusted()` for comprehensive historical data

#### New Frontend Components:
- **`usePriceData()` Hook** - Reactive price data fetching with loading states and error handling
- **`StockHeader`** - ResearchEd-style header with inline metrics (no cards, clean layout)
- **`MetricsSidebar`** - Grouped metrics panel with categories (Estimate, Growth, Forecast, Dividends, Trading)
- **`OverviewTabNew`** - Complete redesign with modern layout and responsive sidebar
- **Enhanced StockOverview Interface** - Added comprehensive metric properties for full data display
- **Updated `front_api_get_stock_prices()`** - Handles flexible period parameters

#### Key Features:
✅ **Database-First Caching** - Checks database before API calls  
✅ **Gap Detection** - Identifies missing/stale data automatically  
✅ **Fallback Strategy** - Gets maximum available data if requested period not available  
✅ **Permanent Storage** - Builds lifetime database for instant future responses  
✅ **Flexible Periods** - Supports days (7d), months (1m, 3m, 6m), years (1y, 3y, 5y), YTD, and MAX  
✅ **Real-time UI** - Loading states, error handling, cache status indicators  
✅ **Performance Optimized** - Efficient queries, upsert logic, and intelligent caching  
✅ **ResearchEd-Style Design** - Clean, minimal interface without cards or heavy shadows  
✅ **Grouped Metrics** - Logical organization of financial data for easy scanning  
✅ **Mobile Responsive** - Sidebar adapts to mobile with stacked layout  
✅ **Comprehensive Data** - Full range of financial metrics and ratios displayed  

---
## Previous Updates *(6 July 2025)*

### 🔄 Hybrid Index Simulation *(Major Feature)*
- **Updated `get_index_sim_series()`** with new hybrid approach
- **Fair Baseline:** Index and portfolio now start at same value for selected time period
- **Real Cash Flows:** Still reflects user's actual investment timing after start date
- **Perfect Alignment:** Eliminates baseline misalignment issues in charts
- **Best of Both Worlds:** Combines fairness of rebalanced simulation with realism of cash flow timing

### 🎛️ Production-Ready Logging Control *(New Feature)*
- **`LoggingConfig`** class for runtime logging control
- **Environment Variable:** `DEBUG_INFO_LOGGING=true/false`
- **API Endpoints:** Toggle logging on/off via authenticated REST calls
- **Conditional Logging:** `DebugLogger.info_if_enabled()` for zero-overhead disabled logging
- **Production Ready:** Clean logs with only errors/warnings when disabled

### 🛠️ Enhanced Error Handling
- **Graceful Validation:** Symbol validation errors return user-friendly messages instead of exceptions
- **Special Characters:** Support for complex stock symbols like `BRK.A`, `BRK.B`
- **Regex Validation:** Updated to `^[A-Z0-9.-]{1,8}$` for broader symbol support

### 📊 Performance Improvements
- **Supabase Query Optimization:** Individual ticker queries to avoid 1000-row limit
- **Smart Date Ranges:** Fetch data per stock from its first transaction date
- **Efficient Price Lookup:** Optimized price data retrieval and caching

---

## System Architecture Overview

### Technology Stack

**Backend:**
- **Framework:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **External APIs:** Alpha Vantage (stock data)
- **Deployment:** Docker containers

**Frontend:**
- **Framework:** Next.js 14 (React)
- **Styling:** Tailwind CSS
- **State Management:** React Query (TanStack Query)
- **Charts:** ApexCharts (unified chart library)
- **Authentication:** Supabase Auth client

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (Supabase)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ User Interface  │    │ Business Logic  │    │ Data Storage    │
│ - Dashboard     │    │ - Portfolio Calc│    │ - Transactions  │
│ - Transactions  │    │ - Index Sim     │    │ - Prices        │
│ - Research      │    │ - Performance   │    │ - User Data     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Backend API Architecture

### Main Entry Points

#### 1. `main.py` - FastAPI Application
```python
app = FastAPI(title="Portfolio Tracker API")
```

**Key Features:**
- CORS middleware for frontend communication
- Health check endpoint (`/health`)
- API route mounting
- Logging configuration

#### 2. API Route Structure

```
/api/
├── auth/           # Authentication endpoints
├── dashboard/      # Dashboard data endpoints  
├── portfolio/      # Portfolio management
├── research/       # Stock research endpoints
└── transactions/   # Transaction CRUD operations
```

### Core API Modules

#### `backend_api_routes/backend_api_dashboard.py`

**Primary Functions:**

1. **`backend_api_get_dashboard(user_id, user_token)`**
   - **Purpose:** Get complete dashboard overview data
   - **Returns:** Portfolio summary, current holdings, total value
   - **Dependencies:** Supabase portfolio queries
   - **Authentication:** JWT required

2. **`backend_api_get_performance(user_id, range_key, benchmark, user_token)`**
   - **Purpose:** Get portfolio vs benchmark performance data
   - **Parameters:**
     - `range_key`: '7D', '1M', '3M', '1Y', 'YTD', 'MAX'
     - `benchmark`: 'SPY', 'QQQ', 'A200', etc.
   - **Returns:** Time series data for charts
   - **Edge Cases:** Handles no-data scenarios with index-only fallback
   - **Dependencies:** `portfolio_service.py`, `index_sim_service.py`

#### `backend_api_routes/backend_api_portfolio.py`

**Primary Functions:**

1. **`backend_api_get_portfolio_holdings(user_id, user_token)`**
   - **Purpose:** Get current portfolio holdings with live prices
   - **Returns:** List of holdings with current value, cost basis, P&L
   - **Dependencies:** Vantage API for live quotes

#### `backend_api_routes/backend_api_transactions.py`

**Primary Functions:**

1. **`backend_api_get_transactions(user_id, user_token)`**
   - **Purpose:** Get all user transactions
   - **Returns:** Paginated transaction list
   - **Authentication:** RLS enforced

2. **`backend_api_add_transaction(transaction_data, user_token)`**
   - **Purpose:** Add new transaction
   - **Validation:** Symbol validation, required fields
   - **Side Effects:** Updates portfolio calculations

#### `backend_api_routes/backend_api_research.py`

**Primary Functions:**

1. **`backend_api_search_symbols(query, user_token)`**
   - **Purpose:** Search for stock symbols
   - **Returns:** Ranked search results
   - **Dependencies:** `vantage_api_search.py`

2. **`backend_api_get_stock_research(ticker, user_token)`**
   - **Purpose:** Get comprehensive stock research data
   - **Returns:** Price data, financials, news, company info

---

## Service Layer Documentation

### Portfolio Service (`services/portfolio_service.py`)

#### Core Classes

**`PortfolioTimeSeriesService`**

1. **`get_portfolio_series(user_id, range_key, user_token)`**
   - **Purpose:** Calculate portfolio value over time
   - **Algorithm:**
     ```python
     # 1. Get user transactions in date range
     # 2. Get historical prices for all symbols
     # 3. Build trading date sequence
     # 4. Calculate daily portfolio values
     # 5. Handle edge cases (no data, all zeros)
     ```
   - **Edge Cases:**
     - No transactions: Returns index-only mode
     - All zero values: Valid state (user sold everything)
     - Missing price data: Uses price forward-filling
   - **Returns:** `(portfolio_series, metadata)`

2. **`get_index_only_series(user_id, range_key, benchmark, user_token)`**
   - **Purpose:** Fallback when no portfolio data available
   - **Use Cases:**
     - New users with no transactions
     - Users with transactions outside selected timeframe
     - Missing historical price data
   - **Returns:** Benchmark performance data with `index_only=True` metadata

**`PortfolioServiceUtils`**

1. **`get_trading_days_limit(range_key)`**
   - Maps range keys to trading day counts
   - Used for database query optimization

2. **`compute_date_range(range_key)`**
   - Converts range keys to actual date ranges
   - Handles YTD (year-to-date) special case

### Index Simulation Service (`services/index_sim_service.py`)

#### Core Classes

**`IndexSimulationService`**

1. **`get_index_sim_series(user_id, benchmark, start_date, end_date, user_token)`** *(UPDATED - Hybrid Simulation)*
   - **Purpose:** Hybrid index simulation combining fair baseline with real cash flows
   - **New Algorithm (v2.0):**
     ```python
     # STEP 1: Seed index with portfolio value at chart start date
     start_value = get_portfolio_value_at(start_date)
     cash_flows = [(start_date, start_value)]
     
     # STEP 2: Add real cash flows after start date
     for transaction in transactions_after_start_date:
         cash_delta = calculate_cash_flow(transaction)
         cash_flows.append((transaction.date, cash_delta))
     
     # STEP 3: Simulate index purchases with combined cash flows
     # STEP 4: Calculate daily index portfolio values
     ```
   - **Key Improvements:**
     - **Fair Baseline:** Index and portfolio start at same value for selected time period
     - **Real Cash Flows:** Still reflects user's actual investment timing after start date
     - **Perfect Alignment:** Eliminates baseline misalignment issues
     - **Best of Both Worlds:** Combines fairness of rebalanced with realism of cash flow simulation
   - **Use Cases:**
     - Primary comparison tool for portfolio vs benchmark performance
     - Answers: "What if I invested in the index with the same timeline and amounts?"

2. **`get_rebalanced_index_series(user_id, benchmark, start_date, end_date, user_token)`**
   - **Purpose:** Pure rebalanced index comparison (single lump sum investment)
   - **Algorithm:**
     ```python
     # 1. Get user's portfolio value at start_date
     # 2. Buy equivalent dollar amount of index on start_date
     # 3. Track performance from that baseline (no additional cash flows)
     ```
   - **Use Case:** Simple "what if I invested everything in the index at once" comparison
   - **Note:** Now serves as alternative to hybrid simulation for pure rebalancing scenarios

**Key Internal Methods:**

1. **`_calculate_cash_flows(transactions, benchmark_prices)`** *(Legacy method - still used by rebalanced)*
   - Converts user transactions to cash flows
   - Uses benchmark closing prices for consistency
   - **Note:** Hybrid simulation builds cash flows inline for better control

2. **`_simulate_index_transactions(cash_flows, benchmark, benchmark_prices)`**
   - Calculates fractional index shares purchased
   - Maintains running position
   - **Enhanced:** Now handles both seed investments and incremental cash flows

3. **`_calculate_daily_values(start_date, end_date, share_positions, benchmark_prices)`**
   - Computes daily portfolio values
   - Forward-fills missing price data
   - **Improved:** Better handling of date alignment and missing data

4. **`_get_price_for_transaction_date(transaction_date, prices)`**
   - Finds appropriate price for transaction simulation
   - Handles weekends and holidays with forward/backward lookup

5. **`_get_price_for_valuation_date(valuation_date, prices)`**
   - Finds appropriate price for portfolio valuation
   - Optimized for daily value calculations

6. **`_generate_zero_series(start_date, end_date)`**
   - Generates zero-value series for edge cases
   - Used when no portfolio data available

**`IndexSimulationUtils`**

1. **`validate_benchmark(benchmark)`**
   - Validates supported benchmark tickers
   - **Supported:** SPY, QQQ, A200, URTH, VTI, VXUS

2. **`calculate_performance_metrics(portfolio_series, index_series)`**
   - Calculates comparative performance metrics
   - **Returns:** Returns, outperformance, absolute differences
   - **Fixed:** Corrected double percentage calculation bug

#### Integration Points

- **Portfolio Service:** Fetches user's portfolio value for baseline seeding
- **Dashboard API:** Primary consumer of index simulation data
- **Vantage API:** Fallback for missing benchmark price data
- **Authentication:** Full RLS compliance with JWT tokens

---

## Logging and Debugging System

### Enhanced Debug Logger (`debug_logger.py`)

#### New Features - Conditional Logging System

**`LoggingConfig`** *(NEW)*
- **Purpose:** Runtime control of logging levels
- **Key Methods:**
  ```python
  LoggingConfig.enable_info_logging()    # Enable info logs
  LoggingConfig.disable_info_logging()   # Disable info logs  
  LoggingConfig.toggle_info_logging()    # Toggle on/off
  LoggingConfig.is_info_enabled()        # Check current state
  ```
- **Environment Variable:** `DEBUG_INFO_LOGGING=true/false`
- **Use Case:** Production-ready logging control without code changes

**`DebugLogger.info_if_enabled(message, logger_instance)`** *(NEW)*
- **Purpose:** Conditional info logging
- **Behavior:** Only logs if `LoggingConfig.is_info_enabled()` returns True
- **Performance:** Zero overhead when disabled
- **Usage:**
  ```python
  # Instead of:
  logger.info("Processing data...")
  
  # Use:
  DebugLogger.info_if_enabled("Processing data...", logger)
  ```

#### API Endpoints for Logging Control *(NEW)*

**`POST /api/dashboard/debug/toggle-info-logging`**
- **Purpose:** Toggle info logging on/off at runtime
- **Authentication:** Requires valid JWT token
- **Returns:** Current logging state

**`GET /api/dashboard/debug/logging-status`**
- **Purpose:** Get current logging configuration
- **Returns:** `{"info_logging_enabled": boolean}`

#### Existing Debug Features

**`DebugLogger.log_api_call()`** - Decorator for comprehensive API logging
**`DebugLogger.log_database_query()`** - Database operation logging  
**`DebugLogger.log_cache_operation()`** - Cache operation logging
**`DebugLogger.log_error()`** - Structured error logging with context

### External API Services

#### Vantage API (`vantage_api/`)

**`vantage_api_search.py`**

1. **`vantage_api_symbol_search(query)`**
   - **Purpose:** Search Alpha Vantage for stock symbols
   - **Features:**
     - Fuzzy matching algorithm
     - Scoring system for relevance
     - Caches results to reduce API calls

2. **`supa_api_search_cached_symbols(query)`**
   - **Purpose:** Search cached symbols in database
   - **Performance:** Much faster than API calls
   - **Fallback:** Used when Vantage API rate limited

**`vantage_api_quotes.py`**

1. **`vantage_api_get_quote(symbol)`**
   - **Purpose:** Get real-time stock quote
   - **Returns:** Current price, change, volume
   - **Rate Limiting:** Respects API limits

#### Supabase API (`supa_api/`)

**`supa_api_client.py`**
- **Purpose:** Centralized Supabase client management
- **Features:** Connection pooling, error handling

**`supa_api_auth.py`**
- **Purpose:** Authentication helpers
- **Functions:** JWT validation, user session management

**`supa_api_transactions.py`**
- **Purpose:** Transaction CRUD operations
- **Security:** Row Level Security (RLS) enforced

**`supa_api_portfolio.py`**
- **Purpose:** Portfolio data queries
- **Optimization:** Efficient date range queries

---

## Frontend Architecture

### Application Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard
│   ├── portfolio/         # Portfolio management
│   ├── research/          # Stock research
│   ├── transactions/      # Transaction management
│   └── layout.tsx         # Root layout
├── components/            # Reusable components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
└── types/                 # TypeScript definitions
```

### Key Frontend Components

#### Dashboard (`app/dashboard/`)

**`page.tsx`** - Main dashboard page
- **Purpose:** Orchestrates dashboard layout
- **Components:** KPIGrid, PortfolioChart, GainLossCard, AllocationTable

**`contexts/DashboardContext.tsx`** - Dashboard state management
- **Purpose:** Centralized dashboard state
- **State:**
  ```typescript
  interface DashboardContextType {
    selectedPeriod: string;
    selectedBenchmark: string;
    performanceData: PerformanceData | null;
    portfolioDollarGain: number;
    portfolioPercentGain: number;
    benchmarkDollarGain: number;
    benchmarkPercentGain: number;
    isLoadingPerformance: boolean;
    userId: string | null;
  }
  ```

**`components/PortfolioChart.tsx`** - Main performance chart
- **Purpose:** Displays portfolio vs benchmark performance
- **Features:**
  - Multiple time ranges (7D, 1M, 3M, 1Y, YTD, MAX)
  - Multiple benchmarks (SPY, QQQ, A200, etc.)
  - Value vs percentage return modes
  - Index-only fallback mode
  - Date range alignment
  - Interactive tooltips with custom styling

**Key Functions:**
```typescript
// Date range alignment to ensure both series have same dates
const alignDataRanges = (portfolioData, benchmarkData) => {
  // Find overlapping date range
  // Filter both arrays to aligned dates
  // Return aligned data
}

// Calculate percentage returns from initial values
const calculatePercentageReturns = (data) => {
  // Get initial value
  // Calculate percentage change for each point
  // Return percentage array
}
```

**`components/KPIGrid.tsx`** - Key performance indicators
- **Purpose:** Display portfolio metrics
- **Metrics:**
  - Portfolio Value (current market value)
  - Capital Gains (dollar and percentage)
  - Dividend Yield (placeholder)
  - Total Return (capital gains + dividends)

**`components/GainLossCard.tsx`** - Top gainers/losers
- **Purpose:** Show best/worst performing holdings
- **Status:** API not yet implemented (shows empty state)

#### Transactions (`app/transactions/`)

**`page.tsx`** - Transaction management
- **Features:**
  - Add new transactions
  - View transaction history
  - Edit/delete transactions
  - Symbol search integration
  - Form validation

**Key Functions:**
```typescript
// Add new transaction
const handleSubmit = async (formData) => {
  // Validate required fields
  // Call backend API
  // Refresh transaction list
  // Show success/error message
}

// Symbol search with debouncing
const handleSymbolSearch = useCallback(
  debounce(async (query) => {
    // Call search API
    // Update suggestions
  }, 300),
  []
);
```

#### Research (`app/research/`) *(COMPLETELY REDESIGNED)*

## 🎨 Required Imports for Research Page Components

### Core Dependencies
```typescript
// React & Next.js
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';

// Icons & UI
import { CheckIcon, InformationCircleIcon, ChevronDown, RefreshCw } from '@heroicons/react/24/outline';
import { DollarSign, TrendingUp, BarChart3, Search } from 'lucide-react';

// Charts (ApexCharts - dynamically imported)
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// API & Types
import { front_api_client } from '@/lib/front_api_client';
import type { 
  TabContentProps,
  StockResearchTab, 
  StockResearchData,
  FinancialStatementType, 
  FinancialPeriodType 
} from '@/types/stock-research';

// Components
import { StockSearchInput } from '@/components/StockSearchInput';
```

### Package Dependencies (package.json)
```json
{
  "dependencies": {
    "react-apexcharts": "^1.4.1",
    "apexcharts": "^3.45.0",
    "@heroicons/react": "^2.0.18",
    "lucide-react": "^0.294.0"
  }
}
```

---

**`page.tsx`** - Main stock research interface *(REDESIGNED)*
- **Purpose:** Orchestrates entire research experience with ResearchEd-style design
- **Key Features:**
  - URL-based state management (`?ticker=AAPL&tab=financials`)
  - Tab navigation with icons and badges
  - Stock search with auto-complete
  - Watchlist integration (placeholder for future API)
  - Error handling and loading states
  - Responsive design

**Core State Management:**
```typescript
const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<StockResearchTab>('overview');
const [stockData, setStockData] = useState<Record<string, StockResearchData>>({});
const [watchlist, setWatchlist] = useState<string[]>([]);
const [comparisonStocks, setComparisonStocks] = useState<string[]>([]);
```

**Key Functions:**
```typescript
// Handle stock selection with URL updates
const handleStockSelect = useCallback(async (ticker: string) => {
  const upperTicker = ticker.toUpperCase();
  setSelectedTicker(upperTicker);
  
  // Update URL params
  const newParams = new URLSearchParams(searchParams);
  newParams.set('ticker', upperTicker);
  router.push(`/research?${newParams.toString()}`, { scroll: false });
  
  // Load data if not cached
  if (!stockData[upperTicker]) {
    await loadStockData(upperTicker);
  }
}, [searchParams, router, stockData]);

// Load comprehensive stock data
const loadStockData = async (ticker: string) => {
  const data = await front_api_client.front_api_get_stock_research_data(ticker);
  setStockData(prev => ({
    ...prev,
    [ticker]: {
      overview: data.fundamentals || {},
      quote: data.price_data || {},
      priceData: data.priceData || [],
      financials: data.financials || {},
      // ... other data types
    }
  }));
};
```

---

## 📊 ResearchEd-Style Components

### **`StockHeader.tsx`** *(NEW - ResearchEd Design)*
- **Purpose:** Clean header with inline key metrics (no cards)
- **Design:** Company name, ticker, price with horizontal metrics layout
- **Features:**
  - Real-time price updates with change indicators
  - Exchange and sector information
  - Color-coded price changes (green/red)
  - Mobile-responsive stacking

**Key Metrics Display:**
```typescript
interface StockHeaderProps {
  ticker: string;
  data: {
    overview?: StockOverview;
    quote?: StockQuote;
  };
  isLoading: boolean;
}

// Clean horizontal layout without cards
<div className="bg-gray-800 rounded-xl p-6 mb-6 flex flex-col md:flex-row md:items-end md:justify-between">
  <div className="mb-4 md:mb-0">
    <h1 className="text-2xl font-bold text-white">{data.overview?.name}</h1>
    <div className="flex items-center gap-3 text-gray-400 text-sm mt-1">
      <span className="font-medium">{ticker}</span>
      <span>•</span>
      <span>{data.overview?.exchange}</span>
      <span>•</span>
      <span>{data.overview?.sector}</span>
    </div>
  </div>
  
  {/* Inline Key Metrics */}
  <div className="flex flex-wrap gap-6 text-sm">
    <div className="text-center">
      <div className="text-gray-400">Market Cap</div>
      <div className="text-white font-semibold">{formatMarketCap(data.overview?.market_cap)}</div>
    </div>
    {/* ... more metrics */}
  </div>
</div>
```

### **`MetricsSidebar.tsx`** *(NEW - Grouped Metrics)*
- **Purpose:** Grouped financial metrics in clean sidebar layout
- **Design:** Organized into logical categories (Estimate, Growth, Forecast, Dividends, Trading)
- **Features:**
  - Label-value pairs with consistent spacing
  - Responsive: stacks below chart on mobile
  - Clean typography without borders or shadows

**Metric Categories:**
```typescript
interface MetricsGroup {
  title: string;
  metrics: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
}

const metricGroups: MetricsGroup[] = [
  {
    title: 'Estimate',
    metrics: [
      { label: 'P/E', value: overview.pe_ratio || 'N/A' },
      { label: 'EPS', value: overview.eps ? `$${overview.eps}` : 'N/A' },
      { label: 'Beta', value: overview.beta || 'N/A' }
    ]
  },
  {
    title: 'Growth',
    metrics: [
      { label: 'Revenue YoY', value: growth.revenue || 'N/A' },
      { label: 'Earnings YoY', value: growth.earnings || 'N/A' }
    ]
  }
  // ... more groups
];
```

### **`OverviewTabNew.tsx`** *(NEW - Complete Redesign)*
- **Purpose:** Main overview page with ResearchEd layout
- **Layout:** Chart area + grouped metrics sidebar
- **Features:**
  - Uses new StockHeader and MetricsSidebar components
  - Integrated price chart with flexible periods
  - Mobile responsive (sidebar stacks below chart)
  - Clean, minimal design without cards

**Layout Structure:**
```typescript
<div className="space-y-6">
  {/* ResearchEd-style header */}
  <StockHeader ticker={ticker} data={data} isLoading={isLoading} />
  
  {/* Main content area */}
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
    {/* Chart area (3/4 width on desktop) */}
    <div className="lg:col-span-3">
      <PriceChartApex ticker={ticker} />
    </div>
    
    {/* Metrics sidebar (1/4 width on desktop, full width on mobile) */}
    <div className="lg:col-span-1">
      <MetricsSidebar overview={data.overview} isLoading={isLoading} />
    </div>
  </div>
</div>
```

---

## 💹 Interactive Financials Page *(NEW MAJOR FEATURE)*

### **`FinancialsTabNew.tsx`** *(COMPLETE REDESIGN)*
- **Purpose:** Comprehensive financials page with interactive chart and table
- **Features:**
  - Statement tabs (Income, Balance Sheet, Cash Flow)
  - Period/Currency dropdowns (Annual/Quarterly, USD/EUR/GBP)
  - Interactive ApexCharts bar chart
  - Multi-select financial table with grouped sections
  - Chart-table synchronization (click rows to add/remove from chart)

**Core State & Controls:**
```typescript
const [activeStatement, setActiveStatement] = useState<FinancialStatementType>('income');
const [activePeriod, setActivePeriod] = useState<FinancialPeriodType>('annual');
const [activeCurrency, setActiveCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

// Auto-select first 3 metrics for better UX
useEffect(() => {
  const currentData = financialsData?.[activeStatement]?.[activePeriod];
  if (currentData && currentData.length > 0) {
    const firstThreeMetrics = currentData.slice(0, 3).map(metric => metric.key);
    setSelectedMetrics(firstThreeMetrics);
  }
}, [financialsData, activeStatement, activePeriod]);
```

### **`FinancialsChart.tsx`** *(NEW - ApexCharts Integration)*
- **Purpose:** Interactive bar chart for financial metrics visualization
- **Features:**
  - Dynamic series based on selected table rows
  - Professional dark theme with proper formatting
  - Large number formatting ($50.2B, $1.3M, etc.)
  - Downloadable chart with toolbar
  - Auto-scaling and responsive design

**Chart Configuration:**
```typescript
const chartOptions = {
  chart: {
    type: 'bar',
    background: 'transparent',
    toolbar: { show: true, tools: { download: true } },
    fontFamily: 'inherit'
  },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: '70%',
      dataLabels: { position: 'top' }
    }
  },
  yaxis: {
    labels: {
      formatter: (value: number) => formatValue(value) // $50.2B format
    }
  },
  theme: { mode: 'dark' }
};

// Generate dynamic series from selected metrics
const chartSeries = selectedMetrics.map((metricKey, index) => ({
  name: metricLabels[metricKey] || metricKey,
  data: years.map(year => financialData[metricKey]?.[year] || 0),
  color: getMetricColor(index)
}));
```

### **`FinancialsTable.tsx`** *(NEW - Interactive Multi-Select)*
- **Purpose:** Grouped financial table with click-to-chart functionality
- **Features:**
  - Grouped sections (Revenue, Operating, Assets, Liabilities, etc.)
  - Multi-select rows with checkmark indicators
  - Hover effects and selection highlighting
  - Metric descriptions with tooltips
  - Large number formatting consistent with chart

**Interactive Row Selection:**
```typescript
interface FinancialMetric {
  key: string;
  label: string;
  description: string;
  values: Record<string, number>; // year -> value mapping
  section: string;
}

// Handle row toggle for chart integration
const handleRowClick = (metricKey: string) => {
  setSelectedMetrics(prev => 
    prev.includes(metricKey) 
      ? prev.filter(key => key !== metricKey)  // Remove from chart
      : [...prev, metricKey]                   // Add to chart
  );
};

// Grouped table structure
{Object.entries(groupedData).map(([sectionName, metrics]) => (
  <React.Fragment key={sectionName}>
    {/* Section Header */}
    <tr className="bg-gray-700">
      <td colSpan={years.length + 1} className="py-3 px-4 font-bold text-gray-300">
        {sectionName}
      </td>
    </tr>
    
    {/* Interactive Metric Rows */}
    {metrics.map((metric) => (
      <tr
        key={metric.key}
        className={`cursor-pointer transition-colors ${
          selectedRows.includes(metric.key) 
            ? 'bg-blue-900/40 hover:bg-blue-900/50' 
            : 'hover:bg-gray-700/50'
        }`}
        onClick={() => onRowToggle(metric.key)}
      >
        {/* Selection indicator + metric label + tooltip */}
        {/* Financial values for each year */}
      </tr>
    ))}
  </React.Fragment>
))}
```

**Financial Data Structure:**
```typescript
// Sample data structure for Income Statement
const incomeMetrics: FinancialMetric[] = [
  {
    key: 'total_revenue',
    label: 'Total Revenue',
    description: 'Total revenue from all business operations',
    section: 'Revenue',
    values: {
      '2024': 50000000000,
      '2023': 45000000000,
      '2022': 40000000000,
      // ... more years
    }
  },
  // ... more metrics organized by section
];
```

---

## 🔄 Data Flow Integration

### **Research Page → Backend API Flow**
```
1. User searches for stock → StockSearchInput
2. Symbol selected → handleStockSelect()
3. URL updated → /research?ticker=AAPL&tab=overview
4. Data loading → front_api_client.front_api_get_stock_research_data()
5. State updated → setStockData()
6. Components re-render → StockHeader, OverviewTab, etc.
```

### **Financials Page → Chart Interaction Flow**
```
1. User clicks financial table row → handleMetricToggle()
2. selectedMetrics state updated → setSelectedMetrics()
3. Chart data recalculated → chartSeries array
4. ApexCharts re-renders → new bars added/removed
5. Selection indicator updated → checkmarks in table
```

### **Mobile Responsive Behavior**
```
Desktop (lg+): Chart (3/4) + Sidebar (1/4) side-by-side
Tablet (md):   Chart full width, Sidebar below
Mobile (sm):   All components stack vertically
```

### Custom Hooks

#### `hooks/usePriceData.ts` *(NEW)*

**Purpose:** Fetch and manage historical stock price data with intelligent caching

```typescript
interface UsePriceDataResult {
  priceData: PriceDataPoint[];
  isLoading: boolean;
  error: string | null;
  yearsAvailable: number;
  dataPoints: number;
  cacheStatus: string;
  dataSources: string[];
  refetch: () => void;
}

function usePriceData(ticker: string | null, period: string = '?years=5'): UsePriceDataResult
```

**Key Features:**
- **Flexible Periods:** Accepts query string format (`?days=7`, `?years=3`, `?ytd=true`)
- **Real-time States:** Loading, error, and success states
- **Cache Awareness:** Shows whether data came from cache or fresh API call
- **Auto-refetch:** Automatically refetches when ticker or period changes
- **Error Handling:** Graceful error recovery with user-friendly messages

**Usage Example:**
```typescript
const { priceData, isLoading, error, dataPoints, cacheStatus } = usePriceData('AAPL', '?days=30');

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;

return <PriceChart data={priceData} />;
```

#### `hooks/usePerformance.ts`

**Purpose:** Fetch and manage portfolio performance data

```typescript
interface UsePerformanceReturn {
  data: PerformanceData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  portfolioData: Array<{date: string, value: number}>;
  benchmarkData: Array<{date: string, value: number}>;
  metrics: PerformanceMetrics | null;
  isIndexOnly: boolean;
  userGuidance: string;
  refetch: () => void;
}
```

**Key Features:**
- **Data Validation:** Sanitizes API responses to prevent NaN errors
- **Edge Case Handling:** Detects index-only mode from metadata
- **Error Recovery:** Provides fallback values for missing data
- **Caching:** Uses React Query for intelligent caching

**Data Sanitization:**
```typescript
const sanitizeDataPoint = (point: any) => {
  const value = point.value ?? point.total_value ?? 0;
  return {
    date: point.date,
    value: typeof value === 'number' && !isNaN(value) ? value : 0
  };
};
```

### Authentication System

#### `components/AuthProvider.tsx`

**Purpose:** Manage user authentication state

```typescript
interface AuthContextValue {
  user: User | null;
}
```

**Features:**
- **Session Management:** Maintains Supabase auth session
- **Route Protection:** Redirects unauthenticated users
- **Auto-refresh:** Handles token refresh automatically

#### Authentication Flow

1. **Login:** User enters credentials on `/auth` page
2. **Session Creation:** Supabase creates authenticated session
3. **Token Storage:** JWT token stored in browser
4. **Route Access:** Protected routes check for valid session
5. **API Calls:** JWT token included in all API requests
6. **RLS Enforcement:** Database enforces row-level security

---

## Data Flow Diagrams

### Portfolio Performance Data Flow

```
User Request (Dashboard)
    ↓
DashboardContext
    ↓
usePerformance Hook
    ↓
React Query
    ↓
Frontend API Client
    ↓
Backend API (/api/dashboard/performance)
    ↓
Portfolio Service
    ├── Get User Transactions
    ├── Get Historical Prices  
    ├── Calculate Portfolio Values
    └── Handle Edge Cases
    ↓
Index Simulation Service
    ├── Calculate Benchmark Performance
    ├── Apply Rebalancing Logic
    └── Generate Comparison Metrics
    ↓
Format Response
    ↓
Frontend Receives Data
    ├── Data Validation & Sanitization
    ├── Date Range Alignment
    └── Chart Rendering
```

### Transaction Addition Flow

```
User Fills Form (Transactions Page)
    ↓
Form Validation
    ↓
Symbol Search (if needed)
    ↓
Submit Transaction
    ↓
Backend API (/api/transactions/add)
    ↓
Transaction Service
    ├── Validate Required Fields
    ├── Check Symbol Exists
    ├── Enforce RLS Security
    └── Insert to Database
    ↓
Portfolio Cache Invalidation
    ↓
Success Response
    ↓
Frontend Updates
    ├── Refresh Transaction List
    ├── Show Success Message
    └── Clear Form
```

### Stock Search Flow

```
User Types Symbol (Research/Transactions)
    ↓
Debounced Input Handler
    ↓
Frontend API Call
    ↓
Backend API (/api/research/search)
    ↓
Search Service
    ├── Check Cached Symbols (Fast)
    ├── Alpha Vantage API (Slower)
    └── Merge & Rank Results
    ↓
Scoring Algorithm
    ├── Exact Match: +100 points
    ├── Prefix Match: +75 points
    ├── Substring Match: +50 points
    ├── Fuzzy Match: Variable points
    └── Company Name Match: +40-60 points
    ↓
Return Top Results
    ↓
Frontend Displays Suggestions
```

---

## API Reference

### Authentication

All API endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### Dashboard Endpoints

#### GET `/api/dashboard/overview`

**Purpose:** Get portfolio overview data

**Parameters:**
- `user_id` (string): User UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolio": {
      "total_value": 125000.50,
      "total_cost": 100000.00,
      "total_gain_loss": 25000.50,
      "total_gain_loss_percent": 25.0,
      "holdings_count": 15
    }
  }
}
```

#### GET `/api/dashboard/performance`

**Purpose:** Get portfolio vs benchmark performance

**Parameters:**
- `user_id` (string): User UUID
- `range_key` (string): '7D', '1M', '3M', '1Y', 'YTD', 'MAX'
- `benchmark` (string): 'SPY', 'QQQ', 'A200', etc.

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolio_series": [
      {"date": "2023-01-01", "value": 100000.00},
      {"date": "2023-01-02", "value": 101000.00}
    ],
    "index_series": [
      {"date": "2023-01-01", "value": 100000.00},
      {"date": "2023-01-02", "value": 100500.00}
    ],
    "metrics": {
      "portfolio_return_pct": 25.0,
      "index_return_pct": 15.0,
      "outperformance_pct": 10.0
    },
    "metadata": {
      "no_data": false,
      "index_only": false,
      "reason": "success"
    }
  }
}
```

**Edge Case Response (Index-Only Mode):**
```json
{
  "success": true,
  "data": {
    "portfolio_series": [],
    "index_series": [
      {"date": "2023-01-01", "value": 100.00},
      {"date": "2023-01-02", "value": 101.50}
    ],
    "metadata": {
      "no_data": true,
      "index_only": true,
      "reason": "no_transactions",
      "user_guidance": "Add transactions to see your portfolio performance compared to the benchmark."
    }
  }
}
```

### Transaction Endpoints

#### GET `/api/transactions`

**Purpose:** Get user transactions

**Parameters:**
- `user_id` (string): User UUID
- `limit` (int, optional): Max results (default: 100)
- `offset` (int, optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "user_id": "uuid", 
        "symbol": "AAPL",
        "transaction_type": "BUY",
        "quantity": 10,
        "price": 150.00,
        "date": "2023-01-01",
        "created_at": "2023-01-01T10:00:00Z"
      }
    ],
    "total_count": 1
  }
}
```

#### POST `/api/transactions`

**Purpose:** Add new transaction

**Request Body:**
```json
{
  "user_id": "uuid",
  "symbol": "AAPL",
  "transaction_type": "BUY",
  "quantity": 10,
  "price": 150.00,
  "date": "2023-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "uuid",
    "message": "Transaction added successfully"
  }
}
```

### Research Endpoints

#### GET `/api/research/stock_prices/{symbol}` *(NEW)*

**Purpose:** Get historical price data with flexible time periods

**Parameters:**
- `symbol` (string): Stock ticker symbol
- `days` (int, optional): Number of days of historical data (e.g., `?days=7`)
- `years` (int, optional): Number of years of historical data (e.g., `?years=3`) 
- `ytd` (bool, optional): Year-to-date data (e.g., `?ytd=true`)

**Examples:**
- `/api/research/stock_prices/AAPL?days=7` - Last 7 days
- `/api/research/stock_prices/AAPL?years=3` - Last 3 years
- `/api/research/stock_prices/AAPL?ytd=true` - Year to date

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "price_data": [
      {
        "time": "2023-01-01",
        "open": 150.00,
        "high": 155.00,
        "low": 149.00,
        "close": 154.00,
        "volume": 50000000
      }
    ],
    "years_available": 3.2,
    "start_date": "2021-01-01",
    "end_date": "2024-01-01", 
    "data_points": 782
  },
  "metadata": {
    "cache_status": "hit",
    "data_sources": ["database"],
    "last_updated": "2024-01-01T10:00:00Z",
    "gaps_filled": 0,
    "timestamp": "2024-01-01T10:00:00Z"
  }
}
```

#### GET `/api/research/search`

**Purpose:** Search for stock symbols

**Parameters:**
- `query` (string): Search term
- `limit` (int, optional): Max results (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "type": "Equity",
        "region": "United States",
        "score": 100
      }
    ]
  }
}
```

#### GET `/api/research/stock/{ticker}`

**Purpose:** Get comprehensive stock data

**Parameters:**
- `ticker` (string): Stock symbol

**Response:**
```json
{
  "success": true,
  "data": {
    "quote": {
      "symbol": "AAPL",
      "price": 150.00,
      "change": 2.50,
      "change_percent": 1.69
    },
    "company": {
      "name": "Apple Inc.",
      "description": "Technology company...",
      "sector": "Technology"
    },
    "financials": {
      "market_cap": 2500000000000,
      "pe_ratio": 25.5,
      "eps": 5.89
    }
  }
}
```

---

## Database Schema

### Core Tables

#### `users` (Supabase Auth)
- `id` (UUID, PK): User identifier
- `email` (string): User email
- `created_at` (timestamp): Account creation
- `last_sign_in_at` (timestamp): Last login

#### `transactions`
```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  symbol VARCHAR(10) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL, -- 'BUY', 'SELL'
  quantity DECIMAL(15,6) NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**RLS Policy:**
```sql
CREATE POLICY "Users can only access their own transactions"
ON transactions FOR ALL
USING (auth.uid() = user_id);
```

#### `historical_prices`
```sql
CREATE TABLE historical_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  open DECIMAL(15,2),
  high DECIMAL(15,2),
  low DECIMAL(15,2),
  close DECIMAL(15,2) NOT NULL,
  volume BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, date)
);
```

**Indexes:**
```sql
CREATE INDEX idx_historical_prices_symbol_date 
ON historical_prices(symbol, date DESC);

CREATE INDEX idx_historical_prices_date 
ON historical_prices(date DESC);
```

#### `symbol_cache`
```sql
CREATE TABLE symbol_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  region VARCHAR(100),
  currency VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Data Relationships

```
users (1) ──────── (many) transactions
                      │
                      │ (symbol)
                      │
                      ▼
              historical_prices (many)
                      │
                      │ (symbol)  
                      │
                      ▼
               symbol_cache (1)
```

---

## Error Handling

### Backend Error Handling

#### Standard Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "error_code": "SPECIFIC_ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

#### Common Error Codes

- `AUTHENTICATION_REQUIRED`: Missing or invalid JWT
- `INSUFFICIENT_PERMISSIONS`: RLS policy violation
- `VALIDATION_ERROR`: Invalid input data
- `SYMBOL_NOT_FOUND`: Stock symbol doesn't exist
- `RATE_LIMIT_EXCEEDED`: API rate limit hit
- `DATABASE_ERROR`: Database operation failed
- `EXTERNAL_API_ERROR`: Third-party API failure

#### Error Handling Patterns

**Service Layer:**
```python
try:
    result = await some_operation()
    return result
except ValidationError as e:
    logger.error(f"Validation error: {e}")
    raise HTTPException(
        status_code=400,
        detail={
            "error": "Invalid input data",
            "error_code": "VALIDATION_ERROR",
            "details": str(e)
        }
    )
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(
        status_code=500,
        detail={
            "error": "Internal server error",
            "error_code": "INTERNAL_ERROR"
        }
    )
```

### Frontend Error Handling

#### React Query Error Handling
```typescript
const { data, error, isError } = useQuery({
  queryKey: ['portfolio'],
  queryFn: fetchPortfolio,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  onError: (error) => {
    console.error('Portfolio fetch failed:', error);
    // Show user-friendly error message
  }
});
```

#### Component Error Boundaries
```typescript
if (isError) {
  return (
    <div className="error-state">
      <h3>Error Loading Data</h3>
      <p>{error?.message || 'Something went wrong'}</p>
      <button onClick={() => refetch()}>Retry</button>
    </div>
  );
}
```

#### Error State Management

**Portfolio Chart Error Handling:**
- **No Data:** Shows index-only mode with user guidance
- **API Error:** Shows retry button with error message
- **Invalid Data:** Sanitizes data and shows warning
- **Network Error:** Shows offline indicator

**Transaction Form Error Handling:**
- **Validation Errors:** Inline field validation
- **Symbol Errors:** "Symbol not found" with search suggestions
- **Submission Errors:** Form-level error message with retry option

---

## Performance Optimization

### Backend Optimization

#### Database Query Optimization

**Efficient Date Range Queries:**
```python
# Good: Uses index on (symbol, date)
query = supabase.table('historical_prices') \
    .select('date, close') \
    .eq('symbol', symbol) \
    .gte('date', start_date) \
    .lte('date', end_date) \
    .order('date')

# Bad: No index utilization
query = supabase.table('historical_prices') \
    .select('*') \
    .filter('symbol', 'eq', symbol)
```

**Connection Pooling:**
```python
# Reuse Supabase client instances
client = get_cached_supabase_client(user_token)
```

#### Caching Strategies

**Symbol Search Caching:**
- Cache frequently searched symbols in database
- Reduce Alpha Vantage API calls
- 24-hour cache expiration

**Price Data Caching:**
- Historical prices cached permanently
- Live quotes cached for 1 minute
- Background refresh jobs

#### API Rate Limiting

**Alpha Vantage Management:**
- 5 calls per minute limit
- Request queuing system
- Fallback to cached data
- Exponential backoff on failures

### Frontend Optimization

#### React Query Caching

**Intelligent Cache Configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 3
    }
  }
});
```

**Cache Keys Strategy:**
```typescript
// Hierarchical cache keys for efficient invalidation
['dashboard', userId] // Dashboard overview
['portfolio', userId, range] // Portfolio performance
['transactions', userId] // Transaction list
['search', query] // Symbol search results
```

#### Component Optimization

**Lazy Loading:**
```typescript
// Chart component lazy loaded
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// Research page code splitting
const ResearchPage = lazy(() => import('./ResearchPageClient'));
```

**Memoization:**
```typescript
// Expensive calculations memoized
const portfolioMetrics = useMemo(() => {
  return calculateMetrics(portfolioData, benchmarkData);
}, [portfolioData, benchmarkData]);

// Event handlers memoized
const handleSymbolSearch = useCallback(
  debounce(async (query) => {
    await searchSymbols(query);
  }, 300),
  []
);
```

#### Bundle Optimization

**Code Splitting:**
- Route-based splitting (automatic with Next.js)
- Component-based splitting for heavy components
- Library splitting (Plotly.js loaded separately)

**Asset Optimization:**
- Image optimization with Next.js Image component
- CSS purging with Tailwind
- Tree shaking for unused code

---

## Deployment & Configuration

### Environment Configuration

#### Backend Environment Variables
```bash
# Database
SUPA_API_URL=https://xxx.supabase.co
SUPA_API_KEY=xxx
SUPA_SERVICE_ROLE_KEY=xxx

# External APIs  
ALPHA_VANTAGE_API_KEY=xxx

# Application
BACKEND_API_PORT=8000
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Security
JWT_SECRET=xxx
```

#### Frontend Environment Variables
```bash
# API Endpoints
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### Docker Configuration

#### Backend Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Frontend Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: ./backend_simplified
    ports:
      - "8000:8000"
    environment:
      - SUPA_API_URL=${SUPA_API_URL}
      - SUPA_API_KEY=${SUPA_API_KEY}
    
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_URL=http://backend:8000
    depends_on:
      - backend
```

### Production Deployment

#### Recommended Architecture
```
Internet
    ↓
Load Balancer (nginx/CloudFlare)
    ↓
┌─────────────────┬─────────────────┐
│   Frontend      │   Backend       │
│   (Next.js)     │   (FastAPI)     │
│   Port 3000     │   Port 8000     │
└─────────────────┴─────────────────┘
    ↓                       ↓
CDN (Static Assets)    Database (Supabase)
```

#### Health Checks
```python
# Backend health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }
```

#### Monitoring & Logging

**Structured Logging:**
```python
import structlog

logger = structlog.get_logger()
logger.info("Portfolio calculated", 
           user_id=user_id, 
           portfolio_value=total_value,
           calculation_time_ms=elapsed_ms)
```

**Metrics Collection:**
- Response time monitoring
- Error rate tracking
- Database query performance
- API rate limit monitoring

---

## Security Considerations

### Authentication & Authorization

#### JWT Token Management
- **Expiration:** 1 hour access tokens, 7-day refresh tokens
- **Rotation:** Automatic token refresh before expiration
- **Revocation:** Immediate logout on security events

#### Row Level Security (RLS)
```sql
-- Transactions table policy
CREATE POLICY "Users can only access their own transactions"
ON transactions FOR ALL
USING (auth.uid() = user_id);

-- Automatic user_id injection
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Data Protection

#### Input Validation
```python
from pydantic import BaseModel, validator

class TransactionCreate(BaseModel):
    symbol: str
    transaction_type: str
    quantity: Decimal
    price: Decimal
    date: date
    
    @validator('symbol')
    def validate_symbol(cls, v):
        if not v or len(v) > 10:
            raise ValueError('Invalid symbol')
        return v.upper()
    
    @validator('transaction_type')
    def validate_type(cls, v):
        if v not in ['BUY', 'SELL']:
            raise ValueError('Invalid transaction type')
        return v
```

#### SQL Injection Prevention
- **Parameterized Queries:** All database queries use parameters
- **ORM Usage:** Supabase client handles query escaping
- **Input Sanitization:** All user inputs validated and sanitized

#### XSS Prevention
- **Content Security Policy:** Strict CSP headers
- **Input Encoding:** All user content HTML-encoded
- **Safe Rendering:** React's built-in XSS protection

### API Security

#### Rate Limiting
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/transactions")
@limiter.limit("10/minute")
async def add_transaction(request: Request, ...):
    # Transaction logic
```

#### CORS Configuration
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

---

## Testing Strategy

### Backend Testing

#### Unit Tests
```python
import pytest
from services.portfolio_service import PortfolioTimeSeriesService

@pytest.mark.asyncio
async def test_portfolio_calculation():
    # Mock user transactions
    transactions = [
        {"symbol": "AAPL", "quantity": 10, "price": 100, "date": "2023-01-01"}
    ]
    
    # Mock price data
    prices = {"AAPL": {"2023-01-01": 100, "2023-01-02": 105}}
    
    # Test portfolio calculation
    result = await PortfolioTimeSeriesService.calculate_portfolio_values(
        transactions, prices, start_date, end_date
    )
    
    assert len(result) == 2
    assert result[0][1] == Decimal('1000')  # 10 shares * $100
    assert result[1][1] == Decimal('1050')  # 10 shares * $105
```

#### Integration Tests
```python
@pytest.mark.asyncio
async def test_dashboard_api_integration():
    # Test full API flow
    response = await client.get(
        "/api/dashboard/performance",
        headers={"Authorization": f"Bearer {test_token}"},
        params={"range_key": "1M", "benchmark": "SPY"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "portfolio_series" in data["data"]
    assert "index_series" in data["data"]
```

### Frontend Testing

#### Component Tests
```typescript
import { render, screen } from '@testing-library/react';
import PortfolioChart from './PortfolioChart';

test('renders portfolio chart with data', () => {
  const mockData = {
    portfolioData: [
      { date: '2023-01-01', value: 1000 },
      { date: '2023-01-02', value: 1050 }
    ],
    benchmarkData: [
      { date: '2023-01-01', value: 1000 },
      { date: '2023-01-02', value: 1025 }
    ]
  };
  
  render(<PortfolioChart {...mockData} />);
  
  expect(screen.getByText('Portfolio vs Benchmark')).toBeInTheDocument();
});
```

#### E2E Tests (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test('complete portfolio workflow', async ({ page }) => {
  // Login
  await page.goto('/auth');
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'password');
  await page.click('[data-testid=login-button]');
  
  // Navigate to transactions
  await page.click('[data-testid=nav-transactions]');
  
  // Add transaction
  await page.click('[data-testid=add-transaction]');
  await page.fill('[data-testid=symbol]', 'AAPL');
  await page.fill('[data-testid=quantity]', '10');
  await page.fill('[data-testid=price]', '150');
  await page.click('[data-testid=submit-transaction]');
  
  // Verify transaction appears
  await expect(page.locator('[data-testid=transaction-row]')).toContainText('AAPL');
  
  // Check dashboard updates
  await page.click('[data-testid=nav-dashboard]');
  await expect(page.locator('[data-testid=portfolio-value]')).toContainText('$1,500');
});
```

---

## Future Enhancements

### Planned Features

#### Advanced Analytics
- **Risk Metrics:** Sharpe ratio, beta, volatility
- **Sector Analysis:** Portfolio allocation by sector
- **Correlation Analysis:** Holdings correlation matrix
- **Monte Carlo Simulation:** Future performance projections

#### Enhanced Research
- **Technical Indicators:** RSI, MACD, moving averages
- **Analyst Ratings:** Buy/sell/hold recommendations
- **Earnings Calendar:** Upcoming earnings dates
- **Options Data:** Options chain and Greeks

#### Portfolio Management
- **Rebalancing Suggestions:** Automated rebalancing alerts
- **Tax Loss Harvesting:** Tax optimization suggestions
- **Dividend Tracking:** Dividend calendar and yield analysis
- **Goal Setting:** Investment goal tracking

#### Mobile Application
- **React Native App:** iOS and Android support
- **Offline Capability:** Cached data for offline viewing
- **Push Notifications:** Price alerts and news
- **Biometric Authentication:** Fingerprint/face ID

### Technical Improvements

#### Performance Enhancements
- **Database Optimization:** Materialized views for complex queries
- **Caching Layer:** Redis for frequently accessed data
- **CDN Integration:** Global content delivery
- **Background Jobs:** Async processing for heavy calculations

#### Scalability Improvements
- **Microservices Architecture:** Service decomposition
- **Load Balancing:** Horizontal scaling capability
- **Database Sharding:** Data partitioning strategies
- **Message Queues:** Async communication between services

#### DevOps Enhancements
- **CI/CD Pipeline:** Automated testing and deployment
- **Infrastructure as Code:** Terraform/CloudFormation
- **Monitoring Stack:** Prometheus + Grafana
- **Log Aggregation:** ELK stack or similar

---

## Troubleshooting Guide

### Common Issues

#### "No portfolio data available"
**Symptoms:** Chart shows empty state or index-only mode
**Causes:**
1. User has no transactions
2. Transactions are outside selected date range
3. Missing historical price data
4. All portfolio values are zero

**Solutions:**
1. Add transactions through transactions page
2. Select "MAX" time range to see all data
3. Check if symbols have historical data
4. Verify transaction dates are correct

#### "Symbol not found" errors
**Symptoms:** Search returns no results or invalid symbol errors
**Causes:**
1. Symbol doesn't exist in Alpha Vantage
2. API rate limit exceeded
3. Network connectivity issues
4. Symbol cache outdated

**Solutions:**
1. Verify symbol spelling and format
2. Wait for rate limit reset (1 minute)
3. Check internet connection
4. Try alternative symbol format (e.g., add exchange suffix)

#### Authentication failures
**Symptoms:** 401 errors, redirect to login page
**Causes:**
1. JWT token expired
2. Invalid credentials
3. Session corrupted
4. RLS policy violations

**Solutions:**
1. Refresh page to trigger token refresh
2. Clear browser cache and re-login
3. Check Supabase auth configuration
4. Verify RLS policies are correct

#### Performance issues
**Symptoms:** Slow page loads, chart rendering delays
**Causes:**
1. Large date ranges with many data points
2. Network latency
3. Database query performance
4. Frontend rendering bottlenecks

**Solutions:**
1. Use shorter date ranges for testing
2. Check network connection speed
3. Optimize database queries with indexes
4. Enable React dev tools profiler

### Debug Information

#### Frontend Debug Mode
```typescript
// Enable in development
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', {
    portfolioData: portfolioData?.length,
    benchmarkData: benchmarkData?.length,
    isLoading,
    error: error?.message
  });
}
```

#### Backend Debug Logging
```python
# Set LOG_LEVEL=DEBUG in environment
import logging
logging.basicConfig(level=logging.DEBUG)

# Add debug statements
logger.debug(f"Processing {len(transactions)} transactions for user {user_id}")
```

#### Database Query Analysis
```sql
-- Check query performance
EXPLAIN ANALYZE 
SELECT date, close 
FROM historical_prices 
WHERE symbol = 'AAPL' 
AND date >= '2023-01-01' 
ORDER BY date;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes 
WHERE tablename = 'historical_prices';
```

---

## Conclusion

This documentation provides a comprehensive overview of the Portfolio Tracker system architecture, implementation details, and operational procedures. The system is designed with scalability, security, and user experience as primary considerations.

### Key Strengths
- **Robust Error Handling:** Graceful degradation and user-friendly error messages
- **Performance Optimized:** Efficient queries, caching, and lazy loading
- **Security First:** RLS enforcement, input validation, and secure authentication
- **Scalable Architecture:** Modular design supporting future enhancements
- **Comprehensive Testing:** Unit, integration, and E2E test coverage

### Maintenance Recommendations
1. **Regular Security Updates:** Keep dependencies updated
2. **Performance Monitoring:** Track key metrics and optimize bottlenecks
3. **User Feedback Integration:** Continuously improve based on user needs
4. **Documentation Updates:** Keep documentation in sync with code changes
5. **Backup Procedures:** Regular database backups and disaster recovery testing

For additional support or clarification on any aspect of the system, refer to the inline code documentation or contact the development team.

------------

UPDATED CHARTING AND LIST VIEW - APEX CHARTS
Use Documentation in apex_charts.md for coding examples of line chart and list view to be used in this project.

## Dividend Sync Workflow

### Scheduled Background Sync

```mermaid
graph TD
    A[Scheduler Trigger (24h/Startup)] --> B[Fetch Unique Symbols from Transactions]
    B --> C[For Each Symbol: Fetch DIVIDENDS from AV (Cached)]
    C --> D[For Each User Holding Symbol: Compute Ownership Windows & Shares at Ex-Date]
    D --> E[Filter Eligible Dividends & Calc Total Amount]
    E --> F[Upsert to user_dividends (Only Unconfirmed; Idempotent via Unique Key)]
    F --> G[Frontend: Query DB for Pending Dividends on Tab Load]
    G --> H[User Confirms (Optional Edit) --> Set Confirmed=True & Create Transaction]
```

Explanation: The system uses a scheduled task to proactively fetch and assign dividends from Alpha Vantage, ensuring data is always up-to-date. Frontend loads directly from DB for performance.



*Last Updated: January 2024*
*Version: 1.0.0* 