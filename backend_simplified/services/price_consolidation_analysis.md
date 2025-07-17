# Price Service Consolidation Analysis

## Overview
This document analyzes the impact of consolidating `current_price_manager.py`, `price_data_service.py`, and `market_status_service.py` into a single `PriceManager` service.

## Current Service Dependencies

### 1. CurrentPriceManager
**Used by:**
- `backend_api_dashboard.py`:
  - `update_user_portfolio_prices()` - Background price updates for portfolios
  - Direct price fetching via `get_current_price_fast()` and `get_current_price()`
  - Historical prices via `get_historical_prices()`
  - Portfolio prices for charts via `get_portfolio_prices_for_charts()`
  
- `backend_api_research.py`:
  - Real-time quotes via `get_current_price()` and `get_current_price_fast()`
  - Historical prices for stock charts
  
- `backend_api_portfolio.py`:
  - No direct usage (only imports, likely unused)
  
- `portfolio_service.py`:
  - `get_portfolio_prices_for_charts()` for time series calculations
  
- `index_sim_service.py`:
  - `update_prices_with_session_check()` for ensuring index prices are current

**Key Features:**
- Session-aware price tracking
- Alpha Vantage integration
- Background price updates
- Price caching in Supabase

### 2. PriceDataService  
**Used by:**
- `portfolio_calculator.py`:
  - `get_prices_for_symbols()` - Batch price fetching for portfolio calculations
  - `get_latest_price()` - Single symbol price lookup
  
- `supa_api_portfolio.py`:
  - `get_latest_price()` - For portfolio value calculations

**Key Features:**
- Database-only price lookups (no external API calls)
- Batch price fetching
- Simple interface for portfolio calculations

### 3. MarketStatusService
**Used by:**
- `current_price_manager.py`:
  - Imported but usage pattern needs verification
  
**Key Features:**
- Market hours tracking
- Trading session management
- Holiday calendar

## API Routes Impact

### Dashboard Routes (`backend_api_dashboard.py`)
- **High Impact**: Core dependency on CurrentPriceManager
- Uses: Background updates, real-time quotes, historical data, portfolio charts
- Migration: Will need to update all method calls to new PriceManager

### Research Routes (`backend_api_research.py`)
- **High Impact**: Heavy usage for stock data
- Uses: Real-time quotes, historical prices
- Migration: Straightforward method name changes

### Portfolio Routes (`backend_api_portfolio.py`)  
- **Low Impact**: Imports but doesn't use CurrentPriceManager
- Migration: Remove unused import

### Analytics Routes (`backend_api_analytics.py`)
- **No Impact**: Uses portfolio_service, not direct price services
- Migration: None needed

## Service-to-Service Dependencies

### Portfolio Service (`portfolio_service.py`)
- **Medium Impact**: Uses CurrentPriceManager for chart data
- Migration: Update to use new PriceManager methods

### Index Simulation Service (`index_sim_service.py`)
- **Medium Impact**: Uses CurrentPriceManager for price updates
- Migration: Update session check calls

### Portfolio Calculator (`portfolio_calculator.py`)
- **High Impact**: Core dependency on PriceDataService
- Migration: Update all price fetching calls

### Dividend Service (`dividend_service.py`)
- **No Impact**: No direct price service usage
- Migration: None needed

## Migration Strategy

### Phase 1: Create Unified PriceManager
1. Combine all three services into a single `price_manager.py`
2. Maintain backward compatibility with wrapper methods
3. Consolidate duplicate logic (e.g., database queries, caching)
4. Unify session management and market status checks

### Phase 2: Update High-Impact Components
1. **portfolio_calculator.py**: Switch from PriceDataService to PriceManager
2. **backend_api_dashboard.py**: Update all CurrentPriceManager calls
3. **backend_api_research.py**: Update quote and historical price calls

### Phase 3: Update Medium-Impact Components  
1. **portfolio_service.py**: Update chart data fetching
2. **index_sim_service.py**: Update session check methods
3. **supa_api_portfolio.py**: Update price lookups

### Phase 4: Cleanup
1. Remove unused imports from all files
2. Delete old service files
3. Update tests and documentation

## Breaking Changes and Compatibility

### Potential Breaking Changes:
1. Method signatures might change (especially for batch operations)
2. Return value formats could be unified
3. Error handling might be standardized

### Compatibility Measures:
1. Create wrapper methods matching old signatures
2. Deprecate old methods with warnings
3. Provide migration guide for each component

## Benefits of Consolidation

1. **Reduced Complexity**: Single source of truth for all price operations
2. **Better Performance**: Unified caching, fewer database connections
3. **Consistent API**: Standardized methods and return values
4. **Easier Maintenance**: One service to update instead of three
5. **Better Error Handling**: Centralized error management
6. **Unified Session Management**: Consistent market hours and holiday handling

## Risk Assessment

### High Risks:
- Portfolio calculations are critical - any bugs affect user portfolios
- Real-time price updates must remain responsive
- Background price sync must continue working

### Mitigation:
- Extensive testing of portfolio calculations
- Performance benchmarking before/after
- Gradual rollout with feature flags
- Keep old services available during transition

## Recommended Implementation Order

1. **Week 1**: Design and implement PriceManager with full backward compatibility
2. **Week 2**: Update portfolio_calculator.py and test thoroughly
3. **Week 3**: Update API routes (dashboard, research)
4. **Week 4**: Update remaining services and cleanup

## Conclusion

The consolidation will significantly simplify the codebase but requires careful migration due to the critical nature of price data. The highest risk is in portfolio calculations, which must be thoroughly tested. A phased approach with backward compatibility will minimize disruption.