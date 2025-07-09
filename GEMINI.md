# claude.md - Portfolio Tracker System and Development Protocol

## Claude System Agent Protocol

**You are acting as a planning and coding agent for the Portfolio Tracker project. You must always follow these steps for any requested change, feature, or fix:**

1. **PLAN**  
   - Break down the feature/fix into clear steps.
   - Describe the intended approach and why it’s optimal.
   - Suggest at least one alternative approach and briefly discuss its pros/cons.
   - Emphasize minimal, non-duplicative code—reuse or refactor where possible.

2. **CONSULT**  
   - Present the plan and reasoning to the user.
   - Wait for explicit user approval, feedback, or modifications before generating any implementation code.

3. **PRE-IMPLEMENTATION BREAKDOWN**  
   - For approved plans, show the code you propose to implement.
   - Explain what each part of the code does.
   - Describe how it maintains type safety and avoids duplication.

4. **USER REVIEW AND OPTIMISATION**  
   - After presenting the proposed code, ask for user feedback and suggestions for further optimization.
   - If suggestions are made, optimise the code and present the optimised version for final approval.

5. **IMPLEMENTATION**  
   - Only after user approval, apply the final code.
   - Confirm that type checking passes, tests (if available) pass, and the code is minimal, DRY, and clear.

**Remember:**
- All code must be type-checked (TypeScript for frontend, Pydantic/typed Python for backend).
- Avoid duplicate logic or overlapping modules.
- Agents can be deployed to plan or review—collaborate and show your reasoning.
- Never “just do it”—always show and explain before changing.
- After any change, summarise what was done and why.

---

## Portfolio Tracker System Overview

### Backend:  
- **Framework:** FastAPI (Python)  
- **DB:** Supabase/PostgreSQL  
- **Auth:** Supabase  
- **External:** Alpha Vantage  
- **Deploy:** Docker  

### Frontend:  
- **Framework:** Next.js 14 (React, TypeScript)  
- **State:** React Query  
- **UI:** Tailwind CSS, Plotly.js  
- **Auth:** Supabase  

---

### Development Best Practices (Reinforced)

- **Type Safety:** Use Python typing and Pydantic in backend, TypeScript in frontend.
- **Code Minimization:** Always refactor/reuse before adding new modules or components.
- **No Duplication:** If a utility or logic already exists, extend or improve it, don’t clone it.
- **Explain Choices:** Always compare your chosen approach to at least one alternative.
- **Multi-Agent Planning:** When a feature is complex, agents may collaborate to propose and review plans.
- **User is the Product Owner:** Always consult the user for input and approval between stages.
- **Show Reasoning:** All decisions and code breakdowns must be explicit and justified.
- **Stage-Gated:** Never implement until all prior steps are approved and reviewed.
- **Optimise Last:** Take user input for optimisations; do not "optimise" without consulting.

---

## Example Workflow

**User Request:** “Add a portfolio risk metrics module.”

- **Agent (Claude) Step 1: PLAN**
  - _Breaks down feature into steps, proposes plan, explains DRYness and type safety._
  - _Lists one alternate way (e.g., using an external analytics API vs in-house computation)._
  - _States why the chosen plan is preferred (e.g., “direct integration is faster and safer…”)._

- **Agent (Claude) Step 2: CONSULT**
  - _Presents plan to user for feedback/approval._

- **Agent (Claude) Step 3: PRE-IMPLEMENTATION BREAKDOWN**
  - _Shows code snippets for new components/services, with comments._
  - _Explains how code is DRY, type-checked, and what it does._

- **User Feedback/Optimisation**
  - _User requests refactor for even less code duplication._
  - _Agent presents optimised code and gets final approval._

- **Agent (Claude) Step 4: IMPLEMENTATION**
  - _Implements code as approved, confirming type and test checks._

---

## Documentation and Reference

- **Architecture, API, schema, data flows, error handling, optimisation, security, and troubleshooting**:  
  _(See the full technical reference below. All design and code decisions must be consistent with this architecture, or an explicit plan to refactor must be included and reviewed with the user first.)_

---

# Technical Reference (Current State)

## System Architecture

_Backend, frontend, authentication, and high-level component structure as described previously. [Include sections from your documentation as needed here—use concise headers, bullet points, code blocks, and diagrams where helpful.]_

# Portfolio Tracker - Comprehensive System Documentation

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Backend API Architecture](#backend-api-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Service Layer Documentation](#service-layer-documentation)
8. [Frontend Components](#frontend-components)
9. [Authentication & Security](#authentication--security)
10. [Error Handling](#error-handling)
11. [Performance Optimization](#performance-optimization)
12. [Deployment & Configuration](#deployment--configuration)

---
## Recent Updates *(8 July 2025)*

### 🚀 Complete ApexCharts Migration *(Major Feature)*
- **Unified Chart Library:** Migrated all charts from Plotly.js/LightweightCharts to ApexCharts
- **Research Page Overhaul:** Enhanced financial analysis with interactive metric selection
- **Enhanced Bar Charts:** Dual Y-axis support for values and growth percentages
- **5-Year Financial Analysis:** Extended data processing for comprehensive historical analysis
- **CAGR Calculations:** Compound Annual Growth Rate and period-over-period growth metrics
- **Interactive Metrics:** Checkbox-based metric selection with real-time chart updates
- **Consistent UI:** Unified chart styling and interactions across entire application

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

**`components/PortfolioChartApex.tsx`** - Main performance chart
- **Purpose:** Displays portfolio vs benchmark performance using ApexCharts
- **Features:**
  - Multiple time ranges (7D, 1M, 3M, 1Y, YTD, MAX)
  - Multiple benchmarks (SPY, QQQ, A200, etc.)
  - Value vs percentage return modes
  - Index-only fallback mode
  - Date range alignment
  - Interactive tooltips with custom styling
  - Responsive design with mobile optimization

**Enhanced ApexCharts Features:**
```typescript
// ApexChart integration with performance colors
const chartData = [{
  name: `${ticker} Portfolio`,
  data: portfolioData,
  color: performanceColor
}, {
  name: benchmarkName,
  data: benchmarkData,
  color: '#6b7280'
}];

// Dynamic chart configuration
const chartOptions = {
  chart: { type: 'area', toolbar: { show: true } },
  stroke: { width: 2, curve: 'smooth' },
  fill: { type: 'gradient', opacity: 0.6 },
  responsive: [{ breakpoint: 768, options: { legend: { position: 'bottom' } } }]
};
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

#### Research (`app/research/`)

**`page.tsx`** - Stock research interface
- **Features:**
  - Symbol search
  - Company overview
  - Enhanced financial analysis with ApexCharts
  - News feed
  - Interactive price charts

**`components/OverviewTab.tsx`** - Company overview with ApexCharts
- **Purpose:** Display company information and price charts
- **Features:**
  - Company details and metrics
  - **PriceChartApex** integration with multiple chart types
  - Mobile-responsive design

**`components/FinancialsTab.tsx`** - Enhanced financial analysis
- **Purpose:** Comprehensive financial data analysis with ApexCharts
- **Features:**
  - **FinancialBarChartApexEnhanced** with metric selection
  - **FinancialSpreadsheetApex** for 5-year historical data
  - **PriceEpsChartApex** for price vs earnings analysis
  - Interactive metric selection with growth rate calculations
  - CAGR (Compound Annual Growth Rate) analysis
  - Dual Y-axis charts for values and growth percentages

**Enhanced Financial Analysis Features:**
```typescript
// Interactive metric selection with growth calculations
const processedMetrics = metrics.map(metric => ({
  ...metric,
  currentValue: values[0] || 0,
  previousValue: values[1] || 0,
  growthRate: calculateGrowthRate(current, previous),
  cagr: calculateCAGR(values, periods),
  hasData: values.some(v => v !== 0)
}));

// Dual-axis chart configuration
const chartData = [
  ...valueSeries,    // Financial values on primary axis
  ...growthSeries    // Growth percentages on secondary axis
];
```

**`ResearchPageClient.tsx`** - Client-side research logic
- **Purpose:** Manage research data loading
- **Data Sources:**
  - Stock quotes
  - Company financials
  - News articles
  - Historical prices

### ApexCharts Component Architecture

#### Base Components

**`components/charts/ApexChart.tsx`** - Universal chart component
- **Purpose:** Centralized chart component for all ApexCharts implementations
- **Features:**
  - Dynamic chart types (line, area, bar, candlestick, mixed)
  - Responsive design with mobile optimization
  - Error handling and loading states
  - Custom formatting for currency, percentage, and dates
  - Dark mode support with consistent styling
  - Interactive tooltips and crosshairs

**`components/charts/ApexListView.tsx`** - Enhanced data list component
- **Purpose:** Unified list/table component with advanced features
- **Features:**
  - Search functionality across searchable columns
  - Sortable columns with visual indicators
  - Pagination with configurable page sizes
  - Category grouping with collapsible sections
  - Responsive design (table on desktop, cards on mobile)
  - Row-level actions with custom handlers
  - Loading skeletons and error states

#### Specialized Chart Components

**`components/charts/PriceChartApex.tsx`** - Stock price visualization
- **Features:**
  - Multiple chart types (line, candlestick, mountain)
  - Volume overlay charts
  - Time period selectors
  - Real-time price updates with color coding
  - Mobile-responsive controls

**`components/charts/FinancialBarChartApexEnhanced.tsx`** - Advanced financial analysis
- **Features:**
  - **Interactive Metric Selection:** Checkbox-based metric selection with real-time updates
  - **Dual Y-Axis Support:** Financial values (left) and growth percentages (right)
  - **Growth Rate Calculations:** Period-over-period and CAGR calculations
  - **5-Year Historical Analysis:** Support for both annual and quarterly data
  - **Category Organization:** Metrics grouped by Income, Balance Sheet, Cash Flow
  - **Professional Formatting:** Currency formatting and growth rate indicators

**`components/charts/FinancialSpreadsheetApex.tsx`** - Financial data tables
- **Features:**
  - 5-year historical financial data display
  - Statement type switching (Balance Sheet, Cash Flow)
  - Search and filtering capabilities
  - Category-based organization
  - Export functionality

**`components/charts/PriceEpsChartApex.tsx`** - Price vs EPS analysis
- **Features:**
  - Dual-axis charting for price and earnings
  - Historical EPS trend analysis
  - P/E ratio calculations and visualization

#### Enhanced Financial Analysis Features

**Metric Selection System:**
```typescript
interface FinancialMetric {
  key: string;
  label: string;
  category: string;
  isSelected: boolean;
  currentValue: number;
  growthRate: number;
  cagr: number;
  hasData: boolean;
}

// Real-time metric processing with growth calculations
const processedMetrics = useMemo(() => {
  return FINANCIAL_METRICS[statementType].map(metric => ({
    ...metric,
    isSelected: selectedMetrics.includes(metric.key),
    currentValue: getCurrentValue(data, metric.key),
    growthRate: calculateGrowthRate(current, previous),
    cagr: calculateCAGR(values, periods),
    hasData: hasValidData(data, metric.key)
  }));
}, [data, selectedMetrics, statementType]);
```

**CAGR and Growth Rate Calculations:**
```typescript
// Compound Annual Growth Rate calculation
const calculateCAGR = (values: number[], periods: number): number => {
  if (values.length < 2 || periods <= 0) return 0;
  const startValue = values[0];
  const endValue = values[values.length - 1];
  if (!startValue || startValue === 0) return 0;
  return (Math.pow(Math.abs(endValue / startValue), 1 / periods) - 1) * 100;
};

// Period-over-period growth rate
const calculateGrowthRate = (current: number, previous: number): number => {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};
```

### Custom Hooks

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
// Chart components lazy loaded with ApexCharts
const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false });

// Research page code splitting
const ResearchPage = lazy(() => import('./ResearchPageClient'));

// Enhanced components with lazy loading
const FinancialBarChartApexEnhanced = dynamic(() => 
  import('@/components/charts/FinancialBarChartApexEnhanced'), 
  { ssr: false }
);
```

**Memoization:**
```typescript
// Financial calculations memoized for performance
const processedMetrics = useMemo(() => {
  return metrics.map(metric => ({
    ...metric,
    growthRate: calculateGrowthRate(current, previous),
    cagr: calculateCAGR(values, periods)
  }));
}, [metrics, data]);

// Chart data transformation memoized
const chartData = useMemo(() => {
  return transformDataForApexCharts(rawData, selectedMetrics);
}, [rawData, selectedMetrics]);

// Event handlers memoized
const handleMetricToggle = useCallback((metric: string) => {
  setSelectedMetrics(prev => 
    prev.includes(metric) 
      ? prev.filter(m => m !== metric)
      : [...prev, metric]
  );
}, []);
```

#### Bundle Optimization

**Code Splitting:**
- Route-based splitting (automatic with Next.js)
- Component-based splitting for heavy chart components
- **Unified Chart Library:** Single ApexCharts bundle instead of multiple chart libraries
- **Base Component Pattern:** Shared ApexChart and ApexListView components

**Asset Optimization:**
- Image optimization with Next.js Image component
- CSS purging with Tailwind
- Tree shaking for unused code
- **Reduced Bundle Size:** ApexCharts replaces Plotly.js + LightweightCharts

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

## ApexCharts Migration Summary

### Migration Benefits

**✅ Consistency & Standardization**
- **Unified Chart Library:** Single ApexCharts implementation replaces multiple chart libraries
- **Consistent Styling:** Standardized colors, themes, and interactions across all charts
- **Responsive Design:** Mobile-optimized charts with adaptive layouts
- **Dark Mode Support:** Consistent dark theme implementation

**✅ Enhanced User Experience**
- **Interactive Financial Analysis:** Real-time metric selection with checkbox interface
- **Advanced Calculations:** CAGR and growth rate analysis built-in
- **Professional Formatting:** Currency, percentage, and date formatting
- **Improved Tooltips:** Rich, contextual information on hover

**✅ Performance Improvements**
- **Reduced Bundle Size:** Single chart library vs multiple dependencies
- **Better Rendering:** ApexCharts optimized for large datasets
- **Lazy Loading:** Components loaded on-demand for faster initial page loads
- **Memoized Calculations:** Efficient data processing and transformation

**✅ Developer Experience**
- **Type Safety:** Full TypeScript integration with proper interfaces
- **Base Components:** Reusable ApexChart and ApexListView components
- **Error Handling:** Comprehensive error boundaries and loading states
- **Debug Features:** Development-mode debugging and logging

**✅ Enhanced Financial Analysis**
- **5-Year Data Analysis:** Extended historical data processing
- **Dual-Axis Charts:** Values and growth percentages on same chart
- **Metric Categories:** Organized financial data by statement type
- **Growth Analytics:** Period-over-period and compound annual growth rates
- **Interactive Selection:** Multi-metric selection with real-time updates

### Component Migration Map

| **Legacy Component** | **ApexCharts Component** | **Enhancement** |
|---------------------|-------------------------|-----------------|
| `PriceChart.tsx` (LightweightCharts) | `PriceChartApex.tsx` | Multiple chart types, volume overlay |
| `FinancialBarChart.tsx` (Plotly) | `FinancialBarChartApexEnhanced.tsx` | Interactive metrics, dual-axis, growth rates |
| `FinancialSpreadsheet.tsx` (HTML) | `FinancialSpreadsheetApex.tsx` | Search, categories, 5-year data |
| `PriceEpsChart.tsx` (Plotly) | `PriceEpsChartApex.tsx` | Dual-axis price/earnings analysis |
| `DividendChart.tsx` (Plotly) | `DividendChartApex.tsx` | Consistent styling, better performance |
| `AllocationTable.tsx` (HTML) | `AllocationTableApex.tsx` | Interactive list with actions |

### Research Page Transformation

**Before Migration:**
- Mixed chart libraries (Plotly, LightweightCharts)
- Basic financial data display
- Limited interactivity
- Inconsistent styling

**After Migration:**
- **Unified ApexCharts** implementation
- **Enhanced Financial Analysis** with metric selection
- **5-Year Historical Data** with CAGR calculations
- **Interactive Charts** with real-time updates
- **Professional UI** with consistent design
- **Mobile-Responsive** layouts

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

---

*Last Updated: January 2024*
*Version: 1.0.0* 

---

# End of claude.md

