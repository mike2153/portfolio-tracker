# Supabase Database Schema Analysis

## Executive Summary

This document provides a comprehensive analysis of the Portfolio Tracker database schema, including table structures, relationships, security policies, performance considerations, and identified issues requiring attention.

## 1. Complete Table Structure

### Core Tables

#### 1.1 `transactions`
Primary table for tracking all portfolio transactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique transaction identifier |
| user_id | uuid | NOT NULL, FK → auth.users(id) | User reference |
| transaction_type | text | NOT NULL, CHECK (BUY/SELL/DEPOSIT/WITHDRAWAL/DIVIDEND) | Transaction category |
| symbol | text | NOT NULL | Stock ticker symbol |
| quantity | numeric | NOT NULL, CHECK (> 0) | Number of shares |
| price | numeric | NOT NULL, CHECK (> 0) | Price per share |
| date | date | NOT NULL | Transaction date |
| currency | text | NOT NULL, DEFAULT 'USD' | Transaction currency |
| commission | numeric | DEFAULT 0, CHECK (>= 0) | Transaction fees |
| notes | text | NULL | User notes |
| created_at | timestamptz | DEFAULT now() | Record creation time |
| updated_at | timestamptz | DEFAULT now() | Last update time |
| amount_invested | numeric | NULL | Total investment amount |
| market_region | varchar | DEFAULT 'United States' | Market region |
| market_open | time | DEFAULT '09:30:00' | Market open time |
| market_close | time | DEFAULT '16:00:00' | Market close time |
| market_timezone | varchar | DEFAULT 'UTC-05' | Market timezone |
| market_currency | varchar | DEFAULT 'USD' | Market currency |
| exchange_rate | decimal(20,10) | NULL | Currency exchange rate |

#### 1.2 `user_profiles`
User profile and preference storage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Profile identifier |
| user_id | uuid | UNIQUE, FK → auth.users(id) ON DELETE CASCADE | User reference |
| first_name | varchar(100) | NOT NULL | User's first name |
| last_name | varchar(100) | NOT NULL | User's last name |
| country | varchar(2) | NOT NULL | Country code |
| base_currency | varchar(3) | NOT NULL, DEFAULT 'USD' | Preferred currency |
| created_at | timestamptz | DEFAULT now() | Profile creation time |
| updated_at | timestamptz | DEFAULT now() | Last update time |

#### 1.3 `watchlist`
User watchlist for monitoring stocks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Watchlist entry ID |
| user_id | uuid | NOT NULL, FK → auth.users(id) | User reference |
| symbol | varchar | NOT NULL | Stock ticker |
| notes | text | NULL | User notes |
| target_price | numeric | NULL | Target price alert |
| created_at | timestamptz | DEFAULT now() | Entry creation time |
| updated_at | timestamptz | DEFAULT now() | Last update time |

#### 1.4 `user_dividends`
Dividend tracking and management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Dividend record ID |
| symbol | varchar | NOT NULL | Stock ticker |
| user_id | uuid | NULL, FK → auth.users(id) | User reference |
| ex_date | date | NOT NULL | Ex-dividend date |
| pay_date | date | NULL | Payment date |
| declaration_date | date | NULL | Declaration date |
| record_date | date | NULL | Record date |
| amount | numeric | NOT NULL, CHECK (> 0) | Dividend amount per share |
| currency | varchar | DEFAULT 'USD', CHECK (USD/EUR/GBP/CAD/AUD) | Dividend currency |
| shares_held_at_ex_date | numeric | NULL, CHECK (>= 0) | Shares on ex-date |
| current_holdings | numeric | NULL, CHECK (>= 0) | Current share count |
| total_amount | numeric | NULL, CHECK (>= 0) | Total dividend received |
| confirmed | boolean | DEFAULT false | Confirmation status |
| status | varchar | DEFAULT 'pending', CHECK (pending/confirmed/edited) | Dividend status |
| dividend_type | varchar | DEFAULT 'cash', CHECK (cash/stock/drp) | Dividend type |
| source | varchar | DEFAULT 'alpha_vantage', CHECK (alpha_vantage/manual/broker) | Data source |
| notes | text | NULL | User notes |
| created_at | timestamptz | DEFAULT now() | Record creation time |
| updated_at | timestamptz | DEFAULT now() | Last update time |
| rejected | boolean | DEFAULT false | Rejection flag |

### Market Data Tables

#### 1.5 `historical_prices`
Historical stock price data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | bigint | PRIMARY KEY, DEFAULT nextval() | Record ID |
| symbol | varchar | NOT NULL | Stock ticker |
| date | date | NOT NULL | Price date |
| open | numeric | NOT NULL | Opening price |
| high | numeric | NOT NULL | Daily high |
| low | numeric | NOT NULL | Daily low |
| close | numeric | NOT NULL | Closing price |
| adjusted_close | numeric | NOT NULL | Adjusted closing price |
| volume | bigint | NOT NULL, DEFAULT 0 | Trading volume |
| dividend_amount | numeric | DEFAULT 0 | Dividend amount |
| split_coefficient | numeric | DEFAULT 1 | Stock split ratio |
| created_at | timestamptz | NOT NULL, DEFAULT timezone('utc', now()) | Record creation |
| updated_at | timestamptz | NOT NULL, DEFAULT timezone('utc', now()) | Last update |

#### 1.6 `company_financials`
Company financial statements storage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Record ID |
| symbol | varchar | NOT NULL | Stock ticker |
| data_type | varchar | NOT NULL | Financial data type |
| financial_data | jsonb | NOT NULL | Financial data JSON |
| last_updated | timestamp | DEFAULT now() | Data update time |
| created_at | timestamp | DEFAULT now() | Record creation time |

#### 1.7 `stocks`
Stock metadata and information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Stock ID |
| symbol | varchar(20) | NOT NULL, UNIQUE | Stock ticker |
| company_name | varchar(255) | NULL | Company name |
| exchange | varchar(50) | NULL | Stock exchange |
| currency | varchar(3) | NOT NULL, DEFAULT 'USD' | Trading currency |
| created_at | timestamptz | DEFAULT now() | Record creation |
| updated_at | timestamptz | DEFAULT now() | Last update |

### Exchange and Market Tables

#### 1.8 `symbol_exchanges`
Exchange information for symbols.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Record ID |
| symbol | varchar | NOT NULL, UNIQUE | Stock ticker |
| exchange | varchar | NOT NULL | Exchange name |
| exchange_timezone | varchar | NULL | Exchange timezone |
| market_open_time | time | DEFAULT '09:30:00' | Market open |
| market_close_time | time | DEFAULT '16:00:00' | Market close |
| has_pre_market | boolean | DEFAULT true | Pre-market trading |
| has_after_hours | boolean | DEFAULT true | After-hours trading |
| created_at | timestamptz | DEFAULT now() | Record creation |
| updated_at | timestamptz | DEFAULT now() | Last update |

#### 1.9 `market_holidays`
Market holiday calendar.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Holiday ID |
| exchange | varchar | NOT NULL | Exchange name |
| holiday_date | date | NOT NULL | Holiday date |
| holiday_name | varchar | NULL | Holiday name |
| market_status | varchar | DEFAULT 'closed' | Market status |
| early_close_time | time | NULL | Early close time |
| late_open_time | time | NULL | Late open time |
| created_at | timestamptz | DEFAULT now() | Record creation |

#### 1.10 `forex_rates`
Foreign exchange rates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Rate ID |
| from_currency | varchar(3) | NOT NULL | Source currency |
| to_currency | varchar(3) | NOT NULL | Target currency |
| date | date | NOT NULL | Rate date |
| rate | decimal(20,10) | NOT NULL | Exchange rate |
| created_at | timestamptz | DEFAULT now() | Record creation |

### Cache and Performance Tables

#### 1.11 `api_cache`
General API response cache.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| cache_key | text | PRIMARY KEY | Cache identifier |
| data | jsonb | NOT NULL | Cached data |
| created_at | timestamptz | DEFAULT now() | Cache creation |
| expires_at | timestamptz | NOT NULL | Expiration time |

#### 1.12 `portfolio_caches`
Portfolio calculation cache.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Cache ID |
| user_id | uuid | NOT NULL, FK → auth.users(id) | User reference |
| benchmark | text | NOT NULL, DEFAULT 'SPY' | Benchmark symbol |
| range | text | DEFAULT 'N/A' | Date range |
| as_of_date | date | DEFAULT CURRENT_DATE | Calculation date |
| portfolio_values | jsonb | DEFAULT '[]' | Portfolio values |
| index_values | jsonb | DEFAULT '[]' | Index values |
| metadata | jsonb | DEFAULT '{}' | Cache metadata |
| created_at | timestamptz | DEFAULT now() | Cache creation |
| updated_at | timestamptz | DEFAULT now() | Last update |
| cache_key | varchar | NULL | Cache key |
| metrics_json | jsonb | NULL | Metrics data |
| expires_at | timestamptz | NULL | Expiration time |
| hit_count | integer | DEFAULT 0 | Cache hits |
| computation_time_ms | integer | NULL | Computation time |
| last_accessed | timestamptz | NULL | Last access time |
| dependencies | jsonb | NULL | Cache dependencies |
| cache_version | integer | DEFAULT 1 | Cache version |

#### 1.13 `portfolio_metrics_cache`
Portfolio metrics cache.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | uuid | NOT NULL, FK → auth.users(id) | User reference |
| cache_key | varchar | NOT NULL | Cache identifier |
| cache_version | integer | DEFAULT 1 | Cache version |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation time |
| expires_at | timestamptz | NOT NULL | Expiration time |
| last_accessed | timestamptz | DEFAULT now() | Last access |
| hit_count | integer | DEFAULT 0, CHECK (>= 0) | Access count |
| metrics_json | jsonb | NOT NULL | Metrics data |
| computation_metadata | jsonb | DEFAULT '{}' | Computation metadata |
| dependencies | jsonb | DEFAULT '[]' | Dependencies |
| invalidated_at | timestamptz | NULL | Invalidation time |
| invalidation_reason | text | NULL | Invalidation reason |
| computation_time_ms | integer | CHECK (>= 0) | Computation time |
| cache_size_bytes | integer | NULL | Cache size |

### Operational Tables

#### 1.14 `price_update_log`
Price update tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Log ID |
| symbol | varchar | NOT NULL, UNIQUE | Stock ticker |
| exchange | varchar | NULL | Exchange name |
| last_update_time | timestamptz | NOT NULL | Last update |
| last_session_date | date | NULL | Last session |
| update_trigger | varchar | NULL | Update trigger |
| sessions_updated | integer | DEFAULT 0 | Sessions updated |
| api_calls_made | integer | DEFAULT 0 | API calls count |
| created_at | timestamptz | DEFAULT now() | Log creation |
| updated_at | timestamptz | DEFAULT now() | Last update |

#### 1.15 `price_update_sessions`
Detailed price update sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Session ID |
| symbol | varchar | NOT NULL | Stock ticker |
| session_date | date | NOT NULL | Session date |
| session_type | varchar | NOT NULL, CHECK (regular/pre_market/after_hours/closing) | Session type |
| session_start | timestamptz | NOT NULL | Session start |
| session_end | timestamptz | NOT NULL | Session end |
| open_price | numeric | NULL | Opening price |
| high_price | numeric | NULL | High price |
| low_price | numeric | NULL | Low price |
| close_price | numeric | NULL | Closing price |
| volume | bigint | NULL | Trading volume |
| data_source | varchar | NULL | Data source |
| updated_at | timestamptz | DEFAULT now() | Last update |
| update_count | integer | DEFAULT 1 | Update count |
| is_complete | boolean | DEFAULT false | Completion flag |
| has_gaps | boolean | DEFAULT false | Data gap flag |
| gap_details | jsonb | NULL | Gap details |

#### 1.16 `api_usage`
API usage tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Usage ID |
| service | varchar(50) | NOT NULL | Service name |
| date | date | NOT NULL | Usage date |
| call_count | integer | DEFAULT 0 | API calls |

## 2. Foreign Key Relationships

### Primary Relationships
1. **transactions.user_id** → auth.users(id)
2. **user_profiles.user_id** → auth.users(id) ON DELETE CASCADE
3. **watchlist.user_id** → auth.users(id)
4. **user_dividends.user_id** → auth.users(id)
5. **portfolio_caches.user_id** → auth.users(id)
6. **portfolio_metrics_cache.user_id** → auth.users(id)

### Composite Keys
1. **portfolio_metrics_cache**: PRIMARY KEY (user_id, cache_key)
2. **forex_rates**: UNIQUE (from_currency, to_currency, date)
3. **api_usage**: UNIQUE (service, date)

## 3. Row Level Security (RLS) Analysis

### Tables with RLS Enabled
Only **user_profiles** table has RLS enabled with the following policies:
- **SELECT**: Users can view their own profile
- **UPDATE**: Users can update their own profile
- **INSERT**: Users can insert their own profile

### Security Gaps - Tables Missing RLS
The following tables contain user data but lack RLS policies:
1. **transactions** - Critical financial data without access control
2. **watchlist** - User-specific data exposed
3. **user_dividends** - Financial data without protection
4. **portfolio_caches** - User portfolio data unprotected
5. **portfolio_metrics_cache** - User metrics exposed

## 4. Index Coverage Analysis

### Existing Indexes
1. **forex_rates**: idx_forex_lookup(from_currency, to_currency, date)
2. **api_usage**: idx_api_usage_lookup(service, date)

### Missing Critical Indexes
1. **transactions**: No index on (user_id, date) for portfolio queries
2. **historical_prices**: No index on (symbol, date) for price lookups
3. **user_dividends**: No index on (user_id, ex_date) for dividend queries
4. **watchlist**: No index on (user_id) for user watchlist queries
5. **company_financials**: No index on (symbol, data_type) for financial lookups

## 5. Data Type Analysis

### Financial Data Type Issues
1. **Mixed numeric types**: Some tables use `numeric` (good) while others use `decimal(20,10)` (forex_rates)
2. **Inconsistent timestamp usage**: Mix of `timestamp` and `timestamptz`
3. **Price precision**: No consistent decimal precision for financial amounts
4. **Volume as bigint**: Good choice for large volume numbers

### Recommendations
- Standardize on `numeric(19,4)` for all monetary values
- Always use `timestamptz` for timestamps
- Consider using `money` type for currency-aware calculations

## 6. Normalization Assessment

### Denormalization Issues
1. **Market data duplicated** in transactions table (market_region, market_open, market_close, market_timezone, market_currency)
2. **Exchange info scattered** between symbol_exchanges and stocks tables
3. **Currency information** redundantly stored in multiple places

### Over-normalization
1. **Separate cache tables** could be consolidated into a single polymorphic cache

## 7. Audit Trail Analysis

### Missing Audit Features
1. **No audit log table** for tracking changes
2. **No soft delete** implementation (no deleted_at columns)
3. **Limited tracking**: Only created_at/updated_at timestamps
4. **No user tracking**: Who made changes is not recorded
5. **No change history**: Previous values not preserved

## 8. Soft Delete Pattern Analysis

**Current Status**: No soft delete implementation
- All tables use hard deletes
- No deleted_at columns
- No archive tables
- CASCADE deletes could cause data loss

## 9. Timestamp Handling

### Issues
1. **Inconsistent timezone handling**: Mix of `timezone('utc', now())` and plain `now()`
2. **Inconsistent types**: Some tables use `timestamp` without timezone
3. **Missing timestamps**: Some tables lack updated_at columns

## 10. Migration History

### Completed Migrations
1. **001_currency_support.sql**: Added multi-currency support, user profiles, forex rates
2. **002_fix_google_auth.sql**: Fixed Google Auth integration with automatic profile creation

### Migration Issues
1. **Duplicate table creation**: user_profiles created in both migrations
2. **No rollback scripts**: Migrations lack DOWN/rollback functionality
3. **No version tracking**: No migration version table

## Critical Issues Summary (10 Issues)

1. **Security Vulnerability**: Critical user data tables (transactions, watchlist, dividends) lack RLS policies, exposing all user data

2. **Performance Bottleneck**: Missing indexes on frequently queried columns (user_id + date combinations) will cause full table scans

3. **Data Integrity Risk**: user_dividends.user_id is nullable, allowing orphaned dividend records

4. **Type Safety Issues**: Inconsistent use of timestamp vs timestamptz could cause timezone-related bugs

5. **Audit Trail Gap**: No audit logging means compliance issues and inability to track changes or recover from errors

6. **Hard Delete Risk**: CASCADE deletes without soft delete pattern could cause irreversible data loss

7. **Cache Invalidation**: No clear cache invalidation strategy or triggers when underlying data changes

8. **Financial Precision**: Mixed numeric types and no standardized precision for monetary calculations

9. **Constraint Gaps**: No unique constraint on (user_id, symbol) in watchlist allows duplicate entries

10. **Migration Debt**: Duplicate user_profiles table creation and lack of migration versioning could cause deployment failures

## Recommendations

### Immediate Actions
1. Implement RLS on all user data tables
2. Add missing indexes for performance
3. Standardize timestamp columns to timestamptz
4. Add NOT NULL constraint to user_dividends.user_id
5. Create audit log table and triggers

### Medium-term Improvements
1. Implement soft delete pattern
2. Consolidate cache tables
3. Normalize market data into reference tables
4. Add migration version tracking
5. Standardize financial data types

### Long-term Enhancements
1. Implement event sourcing for financial transactions
2. Add partitioning for historical_prices table
3. Create materialized views for complex calculations
4. Implement row-level audit triggers
5. Add data archival strategy