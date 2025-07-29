# Portfolio Tracker Database Schema Documentation

## Overview

The Portfolio Tracker uses Supabase (PostgreSQL) as its database with a permanent storage approach for all market data. This document provides comprehensive documentation of the current database schema, including tables, indexes, RLS policies, and data management strategies.

## Core Design Principles

1. **Permanent Storage**: All Alpha Vantage data is stored permanently in dedicated tables (no temporary caching)
2. **Row-Level Security (RLS)**: Enforced on all user-specific tables
3. **Performance Optimization**: Strategic indexing for common query patterns
4. **Data Integrity**: Foreign key constraints and check constraints ensure data validity
5. **Multi-Currency Support**: All financial data includes currency information

## Database Tables

### User Management

#### `users`
- **Purpose**: Basic user information (redundant with auth.users, kept for legacy)
- **Key Fields**:
  - `id` (uuid, PK): User identifier
  - `email` (text, UNIQUE): User email
  - `created_at`, `updated_at` (timestamptz): Timestamps

#### `user_profiles`
- **Purpose**: Extended user profile information
- **Key Fields**:
  - `id` (uuid, PK): Profile identifier
  - `user_id` (uuid, FK → auth.users, UNIQUE): User reference
  - `first_name`, `last_name` (varchar): User name
  - `country` (varchar): User's country
  - `base_currency` (varchar, DEFAULT 'USD'): Preferred currency
- **Indexes**:
  - `idx_user_profiles_user_id` (UNIQUE): Fast user lookup

### Portfolio Data

#### `portfolios`
- **Purpose**: User portfolio containers
- **Key Fields**:
  - `id` (uuid, PK): Portfolio identifier
  - `user_id` (uuid, FK → auth.users): Owner
  - `name` (text): Portfolio name
- **RLS**: Users can only access their own portfolios

#### `transactions`
- **Purpose**: All financial transactions (buy, sell, dividend, etc.)
- **Key Fields**:
  - `id` (uuid, PK): Transaction identifier
  - `user_id` (uuid, FK → auth.users): Owner
  - `transaction_type` (text, CHECK): BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND
  - `symbol` (text): Stock ticker
  - `quantity` (numeric, CHECK > 0): Number of shares
  - `price` (numeric, CHECK > 0): Price per share
  - `date` (date): Transaction date
  - `currency` (text, DEFAULT 'USD'): Transaction currency
  - `commission` (numeric, DEFAULT 0): Transaction fee
  - `exchange_rate` (numeric): For foreign currency transactions
- **Indexes**:
  - `idx_transactions_user_id_date`: User's transaction history
  - `idx_transactions_symbol_date`: Symbol transaction history
  - `idx_transactions_type_user_id`: Transaction type filtering
  - `idx_transactions_user_symbol_date`: User portfolio calculations
  - `idx_transactions_portfolio_calc`: Optimized for portfolio metrics
- **RLS**: Users can only access their own transactions

#### `holdings`
- **Purpose**: Current stock holdings per user
- **Key Fields**:
  - `id` (uuid, PK): Holding identifier
  - `user_id` (uuid, FK → auth.users): Owner
  - `symbol` (text): Stock ticker
  - `quantity` (numeric, DEFAULT 0): Current shares held
  - `average_price` (numeric): Average purchase price
- **Indexes**:
  - `idx_holdings_user_id_symbol`: User portfolio lookup
  - `idx_holdings_user_symbol_unique` (UNIQUE): Prevent duplicates
- **RLS**: Users can only access their own holdings

### Market Data (Permanent Storage)

#### `stocks`
- **Purpose**: Stock master data
- **Key Fields**:
  - `id` (uuid, PK): Stock identifier
  - `symbol` (varchar, UNIQUE): Stock ticker
  - `company_name` (varchar): Company name
  - `exchange` (varchar): Stock exchange
  - `currency` (varchar, DEFAULT 'USD'): Trading currency
- **Indexes**:
  - `idx_stocks_currency_symbol`: Currency-based lookups

#### `historical_prices`
- **Purpose**: Permanent storage of daily price data from Alpha Vantage
- **Key Fields**:
  - `id` (bigint, PK): Price record identifier
  - `symbol` (varchar): Stock ticker
  - `date` (date): Trading date
  - `open`, `high`, `low`, `close` (numeric): OHLC prices
  - `adjusted_close` (numeric): Split-adjusted close
  - `volume` (bigint): Trading volume
  - `dividend_amount` (numeric, DEFAULT 0): Dividend if any
  - `split_coefficient` (numeric, DEFAULT 1): Stock split ratio
- **Indexes**:
  - `idx_historical_prices_symbol_date`: Symbol price history
  - `idx_historical_prices_date`: Date-based queries
  - `idx_historical_prices_latest`: Latest price lookups
  - `idx_historical_prices_symbol_date_range`: Full OHLC data queries
- **Note**: This is permanent storage, not a cache

#### `company_financials`
- **Purpose**: Permanent storage of company financial statements
- **Key Fields**:
  - `id` (uuid, PK): Financial record identifier
  - `symbol` (varchar): Stock ticker
  - `data_type` (varchar): Type of financial data
  - `financial_data` (jsonb): Complete financial statement
  - `last_updated` (timestamp): Last update time
- **Indexes**:
  - `idx_company_financials_lookup`: Symbol and data type lookups

#### `forex_rates`
- **Purpose**: Foreign exchange rates
- **Key Fields**:
  - `id` (uuid, PK): Rate identifier
  - `from_currency`, `to_currency` (varchar): Currency pair
  - `date` (date): Exchange rate date
  - `rate` (numeric): Exchange rate
- **Indexes**:
  - `idx_forex_rates_currencies_date` (UNIQUE): Currency pair lookups

### User Features

#### `watchlist`
- **Purpose**: User stock watchlists
- **Key Fields**:
  - `id` (uuid, PK): Watchlist entry identifier
  - `user_id` (uuid, FK → auth.users): Owner
  - `symbol` (varchar): Stock ticker
  - `notes` (text): User notes
  - `target_price` (numeric): Price target
- **Indexes**:
  - `idx_watchlist_user_id_symbol`: User watchlist lookup
  - `idx_watchlist_user_symbol_unique` (UNIQUE): Prevent duplicates
  - `idx_watchlist_user_created`: Notes-based queries
- **RLS**: Users can only access their own watchlist

#### `user_dividends`
- **Purpose**: Track dividend payments
- **Key Fields**:
  - `id` (uuid, PK): Dividend record identifier
  - `user_id` (uuid, FK → auth.users): Recipient
  - `symbol` (varchar): Stock ticker
  - `ex_date` (date): Ex-dividend date
  - `amount` (numeric, CHECK > 0): Dividend per share
  - `currency` (varchar, DEFAULT 'USD'): Dividend currency
  - `shares_held_at_ex_date` (numeric): Shares owned on ex-date
  - `total_amount` (numeric): Total dividend payment
  - `status` (varchar): pending, confirmed, edited
  - `source` (varchar): alpha_vantage, manual, broker
- **Indexes**:
  - `idx_user_dividends_user_id_ex_date`: User dividend history
  - `idx_user_dividends_symbol_ex_date`: Symbol dividend history
  - `idx_user_dividends_user_symbol_ex_date`: Portfolio dividend calculations
- **RLS**: Users can only access their own dividends

#### `price_alerts`
- **Purpose**: Price alert notifications
- **Key Fields**:
  - `id` (uuid, PK): Alert identifier
  - `user_id` (uuid, FK → auth.users): Owner
  - `symbol` (text): Stock ticker
  - `target_price` (numeric): Trigger price
  - `condition` (text, CHECK): 'above' or 'below'
  - `is_active` (boolean, DEFAULT true): Alert status
  - `triggered_at` (timestamptz): When triggered
- **Indexes**:
  - `idx_price_alerts_active_user`: Active alerts lookup
- **RLS**: Users can only access their own alerts

### System Tables

#### `api_usage`
- **Purpose**: Track Alpha Vantage API usage
- **Key Fields**:
  - `id` (uuid, PK): Usage record identifier
  - `service` (varchar): API service name
  - `date` (date): Usage date
  - `call_count` (integer, DEFAULT 0): Number of API calls
- **Indexes**:
  - `idx_api_usage_date`: Date-based queries
  - `idx_api_usage_service_date` (UNIQUE): Service usage tracking

#### `market_holidays`
- **Purpose**: Stock market holiday calendar
- **Key Fields**:
  - `id` (uuid, PK): Holiday identifier
  - `exchange` (varchar): Exchange name
  - `holiday_date` (date): Holiday date
  - `holiday_name` (varchar): Holiday description
  - `market_status` (varchar, DEFAULT 'closed'): Market status
- **Indexes**:
  - `idx_market_holidays_exchange_date` (UNIQUE): Holiday lookups

#### `symbol_exchanges`
- **Purpose**: Map symbols to their exchanges and trading hours
- **Key Fields**:
  - `id` (uuid, PK): Mapping identifier
  - `symbol` (varchar, UNIQUE): Stock ticker
  - `exchange` (varchar): Exchange name
  - `exchange_timezone` (varchar): Exchange timezone
  - `market_open_time`, `market_close_time` (time): Trading hours
  - `has_pre_market`, `has_after_hours` (boolean): Extended hours
- **Indexes**:
  - `idx_symbol_exchanges_symbol` (UNIQUE): Symbol lookup

### Performance & Caching

#### `portfolio_metrics_cache`
- **Purpose**: Cache computed portfolio metrics
- **Key Fields**:
  - `user_id` (uuid, FK → auth.users): Owner
  - `cache_key` (varchar): Cache identifier
  - `metrics_json` (jsonb): Cached metrics
  - `expires_at` (timestamptz): Cache expiration
  - `hit_count` (integer): Cache hit counter
  - `computation_time_ms` (integer): Computation duration
- **Indexes**:
  - `idx_portfolio_metrics_expires_at`: Expiration management
  - `idx_cache_invalidation`: Active cache lookups
- **RLS**: Users can only access their own cache

#### `api_cache`
- **Purpose**: General API response caching
- **Key Fields**:
  - `cache_key` (text, PK): Cache identifier
  - `data` (jsonb): Cached data
  - `expires_at` (timestamptz): Cache expiration

### Audit & Monitoring

#### `audit_log`
- **Purpose**: Track user actions for security and debugging
- **Key Fields**:
  - `id` (uuid, PK): Log entry identifier
  - `user_id` (uuid): User performing action
  - `action` (varchar): Action type
  - `table_name` (varchar): Affected table
  - `old_data`, `new_data` (jsonb): Data changes
- **RLS**: Users can only see their own audit entries

#### `rate_limits`
- **Purpose**: Implement rate limiting for user actions
- **Key Fields**:
  - `user_id` (uuid): User identifier
  - `action` (varchar): Action being limited
  - `last_attempt` (timestamptz): Last attempt time
  - `attempt_count` (integer): Number of attempts

## Row-Level Security (RLS) Policies

RLS is enabled on the following tables to ensure users can only access their own data:

### User-Owned Tables
- `transactions`: `user_id = auth.uid()`
- `holdings`: `user_id = auth.uid()`
- `watchlist`: `user_id = auth.uid()`
- `user_dividends`: `user_id = auth.uid()`
- `price_alerts`: `user_id = auth.uid()`
- `portfolios`: `user_id = auth.uid()`
- `portfolio_caches`: `user_id = auth.uid()`
- `portfolio_metrics_cache`: `user_id = auth.uid()`
- `audit_log`: `user_id = auth.uid()`

### Public Tables (No RLS)
- `stocks`: Public market data
- `historical_prices`: Public price data
- `company_financials`: Public financial data
- `forex_rates`: Public exchange rates
- `market_holidays`: Public calendar
- `symbol_exchanges`: Public exchange info

## Index Strategy

The database uses a comprehensive indexing strategy optimized for:

1. **User Portfolio Queries**: Composite indexes on user_id + symbol + date
2. **Price Lookups**: Covering indexes including price data
3. **Latest Data**: Specialized indexes for "latest price" queries
4. **Cache Management**: Partial indexes for active cache entries
5. **Unique Constraints**: Prevent duplicate entries where appropriate

## Data Management

### Permanent Storage Approach
- All Alpha Vantage data is stored permanently
- No temporary tables or time-based deletion
- Historical data accumulates over time
- Provides complete historical context for analysis

### Currency Support
- All monetary values include currency information
- Support for multi-currency portfolios
- Exchange rate tracking for conversions
- Base currency preference per user

### Performance Optimization
- Strategic use of JSONB for flexible data structures
- Covering indexes to minimize table lookups
- Partial indexes for filtered queries
- Regular ANALYZE operations for query planning

## Migration History

1. **001_currency_support.sql**: Added multi-currency support
2. **002_fix_google_auth.sql**: Fixed authentication issues
3. **003_005_create_indexes_safe.sql**: Comprehensive index creation
4. **004_add_rls_policies**: Row-level security implementation
5. **005_add_composite_indexes**: Performance optimization indexes

## Best Practices

1. **Always use permanent storage** for market data
2. **Never bypass RLS** for user data access
3. **Include currency** in all financial calculations
4. **Use appropriate indexes** for new query patterns
5. **Validate data types** at the database level
6. **Maintain referential integrity** with foreign keys