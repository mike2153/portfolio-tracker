# Database Bug Analysis - Portfolio Tracker

## Overview
This document provides detailed analysis of database bugs identified in the Portfolio Tracker PostgreSQL/Supabase database. These bugs were originally identified but the file was deleted. This reconstruction is based on schema analysis and common database issues.

## Critical Issues

### 21. Missing Foreign Key Constraints
**Severity**: 🔴 CRITICAL  
**Status**: ❌ OPEN  
**Tables Affected**:
- `holdings` -> `portfolios`
- `transactions` -> `users`
- `watchlist_items` -> `users`

**Details**:
- Referential integrity not enforced
- Orphaned records can exist
- Data consistency not guaranteed

**Example**:
```sql
-- BAD - No FK constraint
CREATE TABLE holdings (
    portfolio_id UUID,
    ...
);

-- GOOD - With FK constraint
CREATE TABLE holdings (
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    ...
);
```

**Impact**: Data integrity issues, orphaned records

**Fix**: Add foreign key constraints to all relationships

### 22. No Cascade Delete Rules
**Severity**: 🟡 HIGH  
**Status**: ❌ OPEN  
**Tables Affected**:
- User-related tables
- Portfolio-related tables

**Details**:
- Deleting a user leaves orphaned data
- Manual cleanup required
- Inconsistent delete behavior

**Impact**: Data cleanup issues, storage waste

**Fix**: Implement proper cascade rules

### 23. Missing Indexes
**Severity**: 🟡 HIGH  
**Status**: ❌ OPEN  
**Tables Affected**:
- `transactions` (symbol, date)
- `holdings` (portfolio_id, symbol)
- `historical_prices` (symbol, date)

**Details**:
- Frequently queried columns not indexed
- Slow query performance
- Full table scans common

**Example**:
```sql
-- Add composite indexes
CREATE INDEX idx_transactions_symbol_date ON transactions(symbol, date);
CREATE INDEX idx_holdings_portfolio_symbol ON holdings(portfolio_id, symbol);
```

**Impact**: Poor query performance

**Fix**: Add indexes based on query patterns

### 24. Currency Handling Issues
**Severity**: 🔴 CRITICAL  
**Status**: ❌ OPEN  
**Tables Affected**:
- `portfolios`
- `transactions`
- `holdings`

**Details**:
- Currency stored as VARCHAR without constraints
- No standardization (USD, usd, $)
- No validation on currency codes

**Impact**: Currency calculation errors

**Fix**: Use currency enum or CHECK constraint

### 25. Timestamp Timezone Issues
**Severity**: 🟢 MEDIUM  
**Status**: ❌ OPEN  
**Tables Affected**:
- All tables with timestamps

**Details**:
- Using TIMESTAMP instead of TIMESTAMPTZ
- Timezone conversions not handled
- Inconsistent time storage

**Example**:
```sql
-- BAD
created_at TIMESTAMP DEFAULT NOW()

-- GOOD
created_at TIMESTAMPTZ DEFAULT NOW()
```

**Impact**: Time calculation errors across timezones

**Fix**: Use TIMESTAMPTZ for all timestamps

### 26. No Audit Trail
**Severity**: 🟡 HIGH  
**Status**: ❌ OPEN  
**Tables Affected**:
- `portfolios`
- `transactions`
- `holdings`

**Details**:
- No history of changes
- Cannot track modifications
- No record of who changed what

**Impact**: Cannot audit changes, compliance issues

**Fix**: Implement audit tables or triggers

### 27. Inconsistent Naming
**Severity**: 🟢 MEDIUM  
**Status**: ❌ OPEN  
**Tables Affected**:
- All tables

**Details**:
- Mixed naming conventions (camelCase vs snake_case)
- Inconsistent pluralization
- Abbreviations used inconsistently

**Examples**:
- `created_at` vs `createdAt`
- `user` vs `users`
- `tx` vs `transaction`

**Impact**: Developer confusion, maintenance issues

**Fix**: Standardize on snake_case naming

### 28. Missing Data Validation
**Severity**: 🔴 CRITICAL  
**Status**: ❌ OPEN  
**Tables Affected**:
- Financial data tables

**Details**:
- No CHECK constraints on numeric values
- Negative quantities allowed
- Price can be zero or negative

**Example**:
```sql
-- Add validation
ALTER TABLE holdings ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);
ALTER TABLE transactions ADD CONSTRAINT chk_price_positive CHECK (price > 0);
```

**Impact**: Invalid financial data

**Fix**: Add CHECK constraints

### 29. Backup Strategy Missing
**Severity**: 🟡 HIGH  
**Status**: ❌ OPEN  
**Details**:
- No automated backup configuration
- No point-in-time recovery setup
- No backup testing procedure

**Impact**: Risk of data loss

**Fix**: Implement automated backup strategy

### 30. Migration Rollback Issues
**Severity**: 🟢 MEDIUM  
**Status**: ❌ OPEN  
**Migration Files**:
- Most migrations lack DOWN migrations
- Cannot rollback changes
- Schema changes are permanent

**Impact**: Cannot revert problematic migrations

**Fix**: Add rollback migrations

## Schema Design Issues

### Normalization Problems
1. **Denormalized Data**: Some calculated fields stored instead of computed
2. **Redundant Data**: Currency stored in multiple places
3. **Missing Junction Tables**: Many-to-many relationships not properly modeled

### Performance Issues
1. **Large Tables**: No partitioning strategy
2. **No Archival**: Old data not archived
3. **Missing Materialized Views**: Complex calculations repeated

### Data Type Issues
```sql
-- Current Issues
price NUMERIC(10,2)  -- Too restrictive for some assets
quantity INTEGER     -- Doesn't support fractional shares
currency VARCHAR(3)  -- No validation

-- Recommended
price NUMERIC(20,8)  -- More precision
quantity NUMERIC(20,8) -- Fractional shares
currency CHAR(3) CHECK (currency ~ '^[A-Z]{3}$')
```

## Recommendations

### Immediate Actions
1. Add foreign key constraints
2. Fix currency handling
3. Add data validation constraints
4. Add missing indexes

### Short-term Improvements
1. Implement cascade delete rules
2. Fix timestamp timezone issues
3. Standardize naming conventions
4. Add audit trail

### Long-term Enhancements
1. Implement backup strategy
2. Add migration rollbacks
3. Optimize schema design
4. Add partitioning for large tables

## Database Health Checks

### Query Performance
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
AND correlation < 0.1;
```

### Data Integrity
```sql
-- Check for orphaned records
SELECT h.* FROM holdings h
LEFT JOIN portfolios p ON h.portfolio_id = p.id
WHERE p.id IS NULL;

-- Check for invalid currency codes
SELECT DISTINCT currency FROM transactions
WHERE currency NOT IN ('USD', 'EUR', 'GBP', ...);
```

## Metrics to Track
- Query performance: All queries < 100ms
- Index usage: > 90% index scans
- Data integrity: 0 orphaned records
- Backup success rate: 100%