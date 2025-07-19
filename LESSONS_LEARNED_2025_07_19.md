# Lessons Learned - Portfolio Tracker Debugging Session
**Date: 2025-07-19**

## 1. ApexListView Component Data Flow

### The Issue
The analytics page was showing 0.00 for all stock metrics despite the backend returning correct data.

### Root Cause
The column render functions in `AnalyticsHoldingsTable` were using incorrect function signatures.

### Key Learning: ApexListView Render Function Signature
```typescript
// ❌ WRONG - What we had
render: (item: any) => (
  <div>{formatCurrency(item.cost_basis)}</div>
)

// ✅ CORRECT - What ApexListView expects
render: (value: any, item: any) => (
  <div>{formatCurrency(value)}</div>
)
```

**ApexListView calls render with two parameters:**
- `value`: The specific field value based on the column's `key`
- `item`: The full row object containing all fields

### Data Flow Pattern
1. **Backend** → Returns data with all fields populated
2. **usePortfolioAllocation Hook** → Fetches and caches the data
3. **Analytics Page** → Transforms allocation data to holdings format
4. **AnalyticsHoldingsTable** → Transforms holdings to listData format
5. **ApexListView** → Renders using column definitions

### Debugging Approach
1. Added console logs at each transformation step
2. Traced data from API response through to render
3. Identified parameter mismatch in render functions

## 2. Price Update System Architecture

### The Issue
Price updates were failing with multiple errors:
1. Alpha Vantage data format mismatch
2. Circuit breaker blocking updates
3. Portfolio stocks not updating (only index updating)

### Key Learnings

#### A. Alpha Vantage Data Format
Alpha Vantage returns data with specific key formats:
```javascript
// ❌ WRONG - What we expected
{
  "close": 150.00,
  "adjusted_close": 150.00,
  "volume": 1000000
}

// ✅ CORRECT - What Alpha Vantage actually returns
{
  "4. close": 150.00,
  "5. adjusted close": 150.00,
  "6. volume": 1000000
}
```

#### B. Price Update Flow
1. **Dashboard/Performance Load** → Triggers background price update
2. **PriceManager.update_user_portfolio_prices()** → Gets user's symbols
3. **PriceManager.update_prices_with_session_check()** → Checks for missing sessions
4. **PriceManager._fill_price_gaps()** → Fetches from Alpha Vantage
5. **supa_api_store_historical_prices_batch()** → Stores in database

#### C. Circuit Breaker Pattern
- Prevents excessive API calls after failures
- Automatically recovers after 60 seconds
- Can be manually reset via `/api/debug/reset-circuit-breaker`

#### D. Session-Aware Updates
The system only fetches missing market sessions, not all historical data:
```python
# Instead of fetching 6000+ days
outputsize='compact'  # Only last 100 days

# Only fetch gaps in data
missed_sessions = self._get_missed_sessions(symbol, last_update)
```

### Fixes Applied
1. **Data Format**: Updated field mappings to match Alpha Vantage format
2. **Function Arguments**: Fixed `supa_api_store_historical_prices_batch` call
3. **Update Triggers**: Removed cache condition to ensure updates always run
4. **Database Schema**: Fixed portfolio_caches table constraints

## 3. React Query Caching Considerations

### Issue
Stale data was being served from React Query cache.

### Solution
```typescript
// Force fresh data on analytics page
staleTime: 0,  // Always consider data stale
refetchOnMount: 'always',  // Always refetch on mount
refetchOnWindowFocus: true  // Refetch when tab gains focus
```

## 4. TypeScript Type Safety

### Learning
Always ensure TypeScript interfaces match the actual data structure:
```typescript
// Added missing field to interface
export interface AllocationItem {
  // ... other fields
  realized_pnl: number;  // This was missing
}
```

## 5. Database Migration Best Practices

### Issue
Portfolio caches table had conflicting constraints.

### Solution
Created safe migration that:
1. Checks for existing constraints before dropping
2. Uses conditional logic to handle partial migrations
3. Provides feedback with RAISE NOTICE statements

```sql
-- Safe approach
DO $$
BEGIN
    IF EXISTS (condition) THEN
        -- Make change
        RAISE NOTICE 'Change applied';
    END IF;
END $$;
```

## Key Takeaways

1. **Always verify function signatures** when using third-party components
2. **Log at transformation boundaries** to trace data flow
3. **Check actual API responses** not just documentation
4. **Use safe migrations** that handle existing state
5. **Consider cache implications** when debugging data issues
6. **Background tasks need explicit triggers** - don't rely on cache misses

## Debugging Methodology

1. **Start with logging** - Add console.log at each data transformation
2. **Check the actual data** - Don't assume, verify what's really there
3. **Trace the full flow** - From API to render
4. **Fix root causes** - Not symptoms (e.g., fix data format, not suppress errors)
5. **Test incrementally** - Verify each fix before moving on