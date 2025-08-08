# Portfolio Tracker Database Master Documentation

## Table of Contents
1. [Database Architecture Overview](#database-architecture-overview)
2. [Current Schema (8 Tables)](#current-schema-8-tables)
3. [Table Relationships](#table-relationships)
4. [Migration History](#migration-history)
5. [Row Level Security (RLS)](#row-level-security-rls)
6. [Data Types and Constraints](#data-types-and-constraints)
7. [Removed Tables (Migration 012)](#removed-tables-migration-012)

---

## Database Architecture Overview

### PostgreSQL with Supabase
- **Database Engine**: PostgreSQL 15+ via Supabase
- **Connection**: Supabase client with connection pooling
- **Authentication**: Supabase Auth with JWT tokens
- **Schema**: 8 core tables (simplified from 20+ tables)
- **Last Verified**: 2025-08-08 (auto-analysis)

### Post-Simplification Architecture (Migration 012)
1. **No Cache Tables**: Direct database queries only
2. **EOD Price Focus**: End-of-day prices, no real-time tracking
3. **Decimal Precision**: All financial values use `numeric` type
4. **On-Demand Calculations**: Real-time computation via PortfolioCalculator
5. **In-Memory Caching Only**: Short-term caching in PortfolioMetricsManager

---

## Current Schema (8 Tables)

### Overview
**Total Tables**: 8 core tables + audit/system tables
- **User Data**: 4 tables (transactions, user_profiles, user_dividends, watchlist)
- **Market Data**: 4 tables (historical_prices, company_financials, forex_rates, market_holidays)
- **System Tables**: api_usage, audit_log (for tracking and compliance)

### 1. User Profiles Table
```sql
CREATE TABLE public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  country character varying NOT NULL,
  base_currency character varying NOT NULL DEFAULT 'USD'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```
**Purpose**: Store user preferences, base currency, and profile information
**RLS**: Yes - users can only access their own profile
**Known Issues**: None identified

### 2. Transactions Table
```sql
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_type text NOT NULL CHECK (upper(transaction_type) = ANY (ARRAY[
    'BUY'::text, 'SELL'::text, 'DEPOSIT'::text, 'WITHDRAWAL'::text, 'DIVIDEND'::text
  ])),
  symbol text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0::numeric),
  price numeric NOT NULL CHECK (price > 0::numeric),
  date date NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  commission numeric DEFAULT 0 CHECK (commission >= 0::numeric),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  amount_invested numeric,
  market_region character varying DEFAULT 'United States'::character varying,
  market_open time without time zone DEFAULT '09:30:00'::time without time zone,
  market_close time without time zone DEFAULT '16:00:00'::time without time zone,
  market_timezone character varying DEFAULT 'UTC-05'::character varying,
  market_currency character varying DEFAULT 'USD'::character varying,
  exchange_rate numeric,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```
**Purpose**: Core portfolio data - all buy/sell/dividend transactions
**RLS**: Yes - users can only see/modify their own transactions
**Key Fields**: 
- `transaction_type`: BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND
- `quantity`, `price`: Decimal precision for financial accuracy
- Market metadata embedded in each transaction
**Known Issues**: No unique constraint on (user_id, symbol, date) - allows duplicate transactions

### 3. User Dividends Table
```sql
CREATE TABLE public.user_dividends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol character varying NOT NULL,
  user_id uuid,
  ex_date date NOT NULL,
  pay_date date,
  declaration_date date,
  record_date date,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  currency character varying DEFAULT 'USD'::character varying CHECK (
    currency::text = ANY (ARRAY['USD', 'EUR', 'GBP', 'CAD', 'AUD']::text[])
  ),
  shares_held_at_ex_date numeric CHECK (
    shares_held_at_ex_date IS NULL OR shares_held_at_ex_date >= 0::numeric
  ),
  current_holdings numeric CHECK (
    current_holdings IS NULL OR current_holdings >= 0::numeric
  ),
  total_amount numeric CHECK (
    total_amount IS NULL OR total_amount >= 0::numeric
  ),
  confirmed boolean DEFAULT false,
  status character varying DEFAULT 'pending'::character varying CHECK (
    status::text = ANY (ARRAY['pending', 'confirmed', 'edited']::text[])
  ),
  dividend_type character varying DEFAULT 'cash'::character varying CHECK (
    dividend_type::text = ANY (ARRAY['cash', 'stock', 'drp']::text[])
  ),
  source character varying DEFAULT 'alpha_vantage'::character varying CHECK (
    source::text = ANY (ARRAY['alpha_vantage', 'manual', 'broker']::text[])
  ),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rejected boolean DEFAULT false,
  CONSTRAINT user_dividends_pkey PRIMARY KEY (id),
  CONSTRAINT user_dividends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```
**Purpose**: Track dividend assignments and confirmations
**RLS**: Yes - users only see their dividend assignments
**Workflow**: Pending → Confirmed (creates transaction) or Rejected

### 4. Watchlist Table
```sql
CREATE TABLE public.watchlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol character varying NOT NULL,
  notes text,
  target_price numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT watchlist_pkey PRIMARY KEY (id),
  CONSTRAINT watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```
**Purpose**: User's stock watchlist with optional target prices
**RLS**: Yes - users can only access their own watchlist

### 5. Historical Prices Table
```sql
CREATE TABLE public.historical_prices (
  id bigint NOT NULL DEFAULT nextval('historical_prices_id_seq'::regclass),
  symbol character varying NOT NULL,
  date date NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  adjusted_close numeric NOT NULL,
  volume bigint NOT NULL DEFAULT 0,
  dividend_amount numeric DEFAULT 0,
  split_coefficient numeric DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT historical_prices_pkey PRIMARY KEY (id)
);
```
**Purpose**: EOD price data from Alpha Vantage
**RLS**: No - public data shared across users
**Key**: Unique on (symbol, date) combination

### 6. Company Financials Table
```sql
CREATE TABLE public.company_financials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol character varying NOT NULL,
  data_type character varying NOT NULL,
  financial_data jsonb NOT NULL,
  last_updated timestamp without time zone DEFAULT now(),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT company_financials_pkey PRIMARY KEY (id)
);
```
**Purpose**: Company financial statements (24-hour cache)
**RLS**: No - public data shared across users
**Storage**: JSONB for flexible financial data structures
**Note**: Only remaining cached data in the system

### 7. Forex Rates Table
```sql
CREATE TABLE public.forex_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_currency character varying NOT NULL,
  to_currency character varying NOT NULL,
  date date NOT NULL,
  rate numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT forex_rates_pkey PRIMARY KEY (id)
);
```
**Purpose**: Currency exchange rates for multi-currency portfolios
**RLS**: No - public data shared across users

### 8. Market Holidays Table
```sql
CREATE TABLE public.market_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exchange character varying NOT NULL,
  holiday_date date NOT NULL,
  holiday_name character varying,
  market_status character varying DEFAULT 'closed'::character varying,
  early_close_time time without time zone,
  late_open_time time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT market_holidays_pkey PRIMARY KEY (id)
);
```
**Purpose**: Track market closures and special hours
**RLS**: No - public data shared across users

---

## Table Relationships

```
auth.users
    ↓ (user_id foreign key)
    ├── user_profiles (1:1)
    ├── transactions (1:many)
    ├── user_dividends (1:many)
    └── watchlist (1:many)

historical_prices ← Used by PriceManager for EOD prices
company_financials ← 24h cached financial data
forex_rates ← Currency conversion
market_holidays ← Trading calendar
```

---

## Migration History

### Migration 012: Simplify Price System ✅
**What Changed**:
- Removed 14 cache tables
- Eliminated broken `get_previous_day_prices()` function
- Simplified to EOD prices only
- Direct database queries replace caching layers

### Removed Migrations (007-010) ❌
These migrations were removed as part of the simplification:
- ~~Migration 007: Data Integrity Constraints~~
- ~~Migration 008: Complete RLS Implementation~~
- ~~Migration 009: Distributed Locking System~~
- ~~Migration 010: User Performance Cache System~~

---

## Row Level Security (RLS)

### User Data Tables (RLS Enabled)
- `user_profiles`: Users can only access their own profile
- `transactions`: Users can only see/modify their own transactions
- `user_dividends`: Users only see their dividend assignments
- `watchlist`: Users can only access their own watchlist

### Public Data Tables (No RLS)
- `historical_prices`: Shared EOD price data
- `company_financials`: Shared company data
- `forex_rates`: Shared exchange rates
- `market_holidays`: Shared market calendar

### RLS Pattern
```sql
-- Standard user isolation policy
CREATE POLICY "users_own_data" ON table_name
FOR ALL USING (auth.uid() = user_id);
```

---

## Data Types and Constraints

### Financial Precision
- **ALL monetary values**: `numeric` type (never float/int)
- **Decimal calculations**: Handled by backend PortfolioCalculator
- **Check constraints**: Amounts > 0, commission >= 0

### Common Constraints
```sql
-- Transaction types
CHECK (upper(transaction_type) = ANY (ARRAY['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND']))

-- Positive amounts
CHECK (quantity > 0::numeric)
CHECK (price > 0::numeric)
CHECK (commission >= 0::numeric)

-- Currency codes
CHECK (currency::text = ANY (ARRAY['USD', 'EUR', 'GBP', 'CAD', 'AUD']))
```

---

## Removed Tables (Migration 012)

### Cache Tables (14 removed)
**Portfolio Caching**:
- ❌ `user_performance` - Was complete portfolio cache
- ❌ `portfolio_caches` - Was general portfolio cache
- ❌ `portfolio_metrics_cache` - Was calculated metrics cache

**API/Price Caching**:
- ❌ `api_cache` - Was API response cache
- ❌ `market_info_cache` - Was market data cache
- ❌ `previous_day_price_cache` - Was price cache (had bugs)
- ❌ `price_request_cache` - Was price request tracking
- ❌ `user_currency_cache` - Was currency preference cache

**System Tables**:
- ❌ `cache_refresh_jobs` - Was background job tracking
- ❌ `price_update_log` - Was price update history
- ❌ `circuit_breaker_state` - Was service health tracking
- ❌ `distributed_locks` - Was distributed locking

**Metadata Tables**:
- ❌ `stocks` - Was stock metadata
- ❌ `symbol_market_info` - Was market info metadata

### Why Removed?
1. **Data Consistency**: Cache layers caused stale data issues
2. **Complexity**: Too many moving parts to maintain
3. **Performance**: Direct queries often faster than cache management
4. **Reliability**: Eliminated race conditions and sync issues

### Current Approach
- **In-memory caching only** via PortfolioMetricsManager
- **Direct database queries** for all data needs
- **On-demand calculations** via PortfolioCalculator
- **EOD prices only** - no real-time tracking

---

## Key Design Decisions

1. **Simplification First**: 8 tables instead of 20+
2. **No Database Caching**: All caching in application memory
3. **Decimal Precision**: `numeric` type for all financial values
4. **JSONB Flexibility**: Company financials use JSONB
5. **Embedded Metadata**: Market info stored in transactions
6. **Direct Queries**: No intermediate storage layers
7. **EOD Focus**: End-of-day prices only
8. **RLS Security**: User data isolation at database level

---

## Database Configuration

```python
# Backend Configuration (config.py)
SUPA_API_URL = os.getenv("SUPA_API_URL")
SUPA_API_ANON_KEY = os.getenv("SUPA_API_ANON_KEY")
SUPA_API_SERVICE_KEY = os.getenv("SUPA_API_SERVICE_KEY")

# Connection via Supabase client
from supabase import create_client
supabase = create_client(SUPA_API_URL, SUPA_API_ANON_KEY)
```

---

## Performance Considerations

### Current Performance Strategy
1. **Direct Queries**: No cache lookup overhead
2. **Indexed Access**: Primary keys and foreign keys indexed
3. **In-Memory Caching**: Short-term result caching only
4. **Batch Operations**: Multiple symbols processed together
5. **Connection Pooling**: Via Supabase infrastructure

### What We Don't Do Anymore
- ❌ Complex cache invalidation logic
- ❌ Background cache refresh jobs
- ❌ Distributed locking for cache updates
- ❌ Multiple cache layers to check
- ❌ Cache consistency management

This simplified schema provides better reliability, easier maintenance, and more predictable performance than the previous complex caching architecture.