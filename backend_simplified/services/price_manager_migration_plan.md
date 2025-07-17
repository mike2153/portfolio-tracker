# PriceManager Migration Plan

## 1. New PriceManager Interface Design

```python
class PriceManager:
    """
    Unified price management service combining:
    - CurrentPriceManager functionality
    - PriceDataService functionality  
    - MarketStatusService functionality
    """
    
    # === Real-time Price Methods (from CurrentPriceManager) ===
    async def get_current_price(self, symbol: str, user_token: str) -> Dict[str, Any]:
        """Get current price with full metadata"""
        
    async def get_current_price_fast(self, symbol: str) -> Dict[str, Any]:
        """Get current price without user context (for overview)"""
        
    async def get_current_prices_batch(self, symbols: List[str], user_token: str) -> Dict[str, Dict[str, Any]]:
        """Get current prices for multiple symbols"""
    
    # === Historical Price Methods (from CurrentPriceManager) ===
    async def get_historical_prices(self, symbol: str, start_date: date, end_date: date, user_token: str) -> Dict[str, Any]:
        """Get historical price data for a date range"""
        
    async def get_portfolio_prices_for_charts(self, symbols: List[str], start_date: date, end_date: date, user_token: str) -> Dict[str, Any]:
        """Optimized method for portfolio charts (DB only)"""
    
    # === Portfolio Price Methods (from PriceDataService) ===
    async def get_prices_for_symbols(self, symbols: List[str], user_token: str) -> Dict[str, Dict[str, Any]]:
        """Get latest prices for portfolio calculations"""
        
    async def get_latest_price(self, symbol: str, user_token: str) -> Optional[Dict[str, Any]]:
        """Get single symbol latest price (DB only)"""
    
    # === Background Update Methods (from CurrentPriceManager) ===
    async def update_user_portfolio_prices(self, user_id: str, user_token: str) -> Dict[str, Any]:
        """Background update of user's portfolio prices"""
        
    async def update_prices_with_session_check(self, symbols: List[str], user_token: str, include_indexes: bool = True) -> Dict[str, Any]:
        """Update prices with session awareness"""
    
    # === Market Status Methods (from MarketStatusService) ===
    def is_market_open(self, exchange: str = "NYSE") -> bool:
        """Check if market is currently open"""
        
    def get_market_hours(self, exchange: str = "NYSE") -> Dict[str, Any]:
        """Get market hours for today"""
        
    def is_trading_day(self, check_date: date, exchange: str = "NYSE") -> bool:
        """Check if given date is a trading day"""
        
    def get_next_trading_day(self, from_date: date, exchange: str = "NYSE") -> date:
        """Get next trading day from given date"""
```

## 2. Migration Code Examples

### Example 1: Migrating portfolio_calculator.py

**Before:**
```python
from services.price_data_service import price_data_service

# In calculate_holdings method:
current_prices = await price_data_service.get_prices_for_symbols(symbols, user_token)
price_data = current_prices.get(symbol)
```

**After:**
```python
from services.price_manager import price_manager

# In calculate_holdings method:
current_prices = await price_manager.get_prices_for_symbols(symbols, user_token)
price_data = current_prices.get(symbol)
```

### Example 2: Migrating backend_api_dashboard.py

**Before:**
```python
from services.current_price_manager import current_price_manager

# Background update
asyncio.create_task(
    current_price_manager.update_user_portfolio_prices(uid, jwt)
)

# Get quote
quote_result = await current_price_manager.get_current_price_fast(symbol)
```

**After:**
```python
from services.price_manager import price_manager

# Background update - same method name
asyncio.create_task(
    price_manager.update_user_portfolio_prices(uid, jwt)
)

# Get quote - same method name
quote_result = await price_manager.get_current_price_fast(symbol)
```

### Example 3: Migrating portfolio_service.py

**Before:**
```python
from services.current_price_manager import current_price_manager

portfolio_prices_result = await current_price_manager.get_portfolio_prices_for_charts(
    symbols=tickers,
    start_date=start_date,
    end_date=end_date,
    user_token=user_token
)
```

**After:**
```python
from services.price_manager import price_manager

portfolio_prices_result = await price_manager.get_portfolio_prices_for_charts(
    symbols=tickers,
    start_date=start_date,
    end_date=end_date,
    user_token=user_token
)
```

## 3. Backward Compatibility Strategy

Create temporary wrapper classes during migration:

```python
# In current_price_manager.py during migration
from services.price_manager import price_manager

class CurrentPriceManager:
    """Backward compatibility wrapper - DEPRECATED"""
    
    def __getattr__(self, name):
        # Forward all calls to price_manager
        import warnings
        warnings.warn(
            f"CurrentPriceManager is deprecated. Use price_manager.{name}",
            DeprecationWarning,
            stacklevel=2
        )
        return getattr(price_manager, name)

# Maintain singleton
current_price_manager = CurrentPriceManager()
```

## 4. Testing Strategy

### Unit Tests Required:
1. All PriceDataService methods with existing test cases
2. All CurrentPriceManager methods with existing test cases  
3. Market status calculations
4. Session-aware price updates
5. Batch operations performance

### Integration Tests Required:
1. Portfolio calculation flow
2. Dashboard performance data flow
3. Research page quote flow
4. Background price update flow

### Performance Tests:
1. Batch price fetching (should be same or better)
2. Chart data generation
3. Background update timing

## 5. Rollout Plan

### Stage 1: Shadow Mode (Week 1)
- Deploy new PriceManager alongside existing services
- Use feature flag to test with select users
- Monitor performance and accuracy

### Stage 2: Gradual Migration (Week 2-3)
- Day 1-2: Migrate portfolio_calculator.py
- Day 3-4: Migrate API routes (lowest risk first)
- Day 5-7: Migrate portfolio_service.py
- Day 8-10: Migrate remaining services

### Stage 3: Cleanup (Week 4)
- Remove backward compatibility wrappers
- Delete old service files
- Update all documentation

## 6. Rollback Plan

If issues arise:
1. Backward compatibility wrappers allow instant rollback
2. Feature flags can disable new code paths
3. Old service files remain until full validation

## 7. Success Metrics

- No increase in API response times
- No errors in portfolio calculations
- Reduced code complexity (LOC reduction ~30%)
- Improved test coverage
- Simplified debugging (single service)

## 8. Risk Mitigation

### Critical Paths to Test Extensively:
1. Portfolio value calculations (affects user money)
2. Real-time quote accuracy (affects trading decisions)
3. Historical price data (affects charts and analysis)

### Monitoring Required:
1. API response times for all price endpoints
2. Background job completion rates
3. Database query performance
4. Alpha Vantage API usage

## Next Steps

1. Review and approve this plan
2. Create new price_manager.py with all methods
3. Write comprehensive tests
4. Begin phased migration
5. Monitor and adjust as needed