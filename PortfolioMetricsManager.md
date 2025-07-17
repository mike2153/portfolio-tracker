# 📊 Portfolio Metrics Manager - Architecture Design Document

## 📋 Executive Summary

This document outlines the design and implementation strategy for a centralized Portfolio Metrics Manager that will serve as the single source of truth for all portfolio performance calculations across the Portfolio Tracker application. The goal is to eliminate redundancy, ensure consistency, and provide a clean, efficient API for all portfolio metrics needs.

## 🎯 Objectives

1. **Centralization**: Create one authoritative service for all portfolio calculations
2. **Consistency**: Ensure uniform field naming and calculation methods across the application
3. **Performance**: Implement intelligent caching to reduce computational overhead
4. **Maintainability**: Clear separation of concerns with well-defined interfaces
5. **Extensibility**: Easy to add new metrics without affecting existing code

## 🏗️ Current Architecture Analysis

### Existing Components

```
backend_simplified/
├── services/
│   ├── portfolio_calculator.py      # Core calculation logic
│   ├── portfolio_service.py         # Time-series calculations
│   ├── price_data_service.py        # Price data access
│   └── current_price_manager.py     # Real-time price fetching
├── backend_api_routes/
│   ├── backend_api_dashboard.py     # Dashboard endpoints
│   └── backend_api_analytics.py     # Analytics endpoints
```

### Current Data Flow

```
Frontend Request
    ↓
API Route (dashboard/analytics)
    ↓
Portfolio Calculator / Portfolio Service
    ↓
Price Data Service / Current Price Manager
    ↓
Database (Supabase)
```

### Identified Issues

1. **Duplicate Calculations**: Allocation percentages calculated in multiple places
2. **Inconsistent Field Names**: Different names for same data across endpoints
3. **Missing Calculations**: IRR is placeholder, daily changes not implemented
4. **No Caching Layer**: Recalculating same metrics repeatedly

## 🚀 Proposed Architecture

### New Component Structure

```
backend_simplified/
├── services/
│   ├── portfolio_metrics_manager.py  # NEW: Central orchestrator
│   ├── portfolio_calculator.py       # Enhanced with all calculations
│   ├── metrics_cache.py             # NEW: Caching layer
│   └── [existing services...]
```

### Enhanced Data Flow

```
Frontend Request
    ↓
API Route
    ↓
Portfolio Metrics Manager  ← [Cache Check]
    ↓                         ↓
Portfolio Calculator      [Cache Hit → Return]
    ↓
Price Services
    ↓
Database
    ↓
[Cache Update] → Response
```

## 💻 Implementation Details

### 1. Portfolio Metrics Manager

```python
from typing import Dict, List, Optional, Union
from datetime import datetime, date
from decimal import Decimal
import asyncio
from functools import lru_cache

from .portfolio_calculator import PortfolioCalculator
from .metrics_cache import MetricsCache
from .portfolio_service import PortfolioService
from ..models import PortfolioMetrics, HoldingMetrics, PerformanceMetrics

class PortfolioMetricsManager:
    """
    Central orchestrator for all portfolio performance calculations.
    Provides a unified API with caching and consistent field naming.
    """
    
    def __init__(
        self,
        calculator: PortfolioCalculator,
        portfolio_service: PortfolioService,
        cache: Optional[MetricsCache] = None
    ):
        self.calculator = calculator
        self.portfolio_service = portfolio_service
        self.cache = cache or MetricsCache()
        
    async def get_portfolio_metrics(
        self,
        portfolio_id: int,
        include_holdings: bool = True,
        include_performance: bool = True,
        include_allocations: bool = True,
        as_of_date: Optional[date] = None
    ) -> PortfolioMetrics:
        """
        Get comprehensive portfolio metrics with intelligent caching.
        """
        cache_key = self._generate_cache_key(
            portfolio_id, include_holdings, include_performance, 
            include_allocations, as_of_date
        )
        
        # Check cache first
        if cached := await self.cache.get(cache_key):
            return cached
            
        # Build metrics
        metrics = PortfolioMetrics(portfolio_id=portfolio_id)
        
        # Parallel fetch where possible
        tasks = []
        if include_holdings:
            tasks.append(self._get_holdings_metrics(portfolio_id, as_of_date))
        if include_performance:
            tasks.append(self._get_performance_metrics(portfolio_id, as_of_date))
        if include_allocations:
            tasks.append(self._get_allocation_metrics(portfolio_id, as_of_date))
            
        results = await asyncio.gather(*tasks)
        
        # Assign results
        result_idx = 0
        if include_holdings:
            metrics.holdings = results[result_idx]
            result_idx += 1
        if include_performance:
            metrics.performance = results[result_idx]
            result_idx += 1
        if include_allocations:
            metrics.allocations = results[result_idx]
            
        # Cache and return
        await self.cache.set(cache_key, metrics)
        return metrics
        
    async def _get_holdings_metrics(
        self, 
        portfolio_id: int, 
        as_of_date: Optional[date] = None
    ) -> List[HoldingMetrics]:
        """Get detailed metrics for each holding."""
        holdings = await self.calculator.calculate_detailed_holdings(
            portfolio_id, as_of_date
        )
        
        # Enhance with additional metrics
        for holding in holdings:
            # Calculate IRR for each holding
            holding.irr = await self._calculate_holding_irr(
                portfolio_id, holding.ticker, as_of_date
            )
            # Add daily change
            holding.daily_change = await self._calculate_daily_change(
                holding.ticker, holding.quantity
            )
            
        return holdings
        
    async def _calculate_holding_irr(
        self,
        portfolio_id: int,
        ticker: str,
        as_of_date: Optional[date] = None
    ) -> Decimal:
        """
        Calculate Internal Rate of Return for a specific holding.
        Uses XIRR method with actual transaction dates.
        """
        # Get all transactions for this ticker
        transactions = await self.calculator.get_transactions_for_ticker(
            portfolio_id, ticker, as_of_date
        )
        
        # Get current value
        current_value = await self.calculator.get_holding_value(
            portfolio_id, ticker, as_of_date
        )
        
        # Calculate XIRR
        cash_flows = []
        for txn in transactions:
            # Negative for purchases, positive for sales
            flow = -txn.total if txn.type == 'BUY' else txn.total
            cash_flows.append((txn.date, flow))
            
        # Add current value as final positive flow
        cash_flows.append((as_of_date or date.today(), current_value))
        
        return self._xirr(cash_flows)
        
    def _xirr(self, cash_flows: List[tuple[date, Decimal]]) -> Decimal:
        """Calculate XIRR using Newton's method."""
        # Implementation of XIRR calculation
        # ... (detailed implementation)
        pass
```

### 2. Enhanced Portfolio Calculator

```python
class PortfolioCalculator:
    """Enhanced with all portfolio calculations in one place."""
    
    async def calculate_portfolio_performance(
        self,
        portfolio_id: int,
        start_date: date,
        end_date: date,
        benchmark: Optional[str] = 'SPY'
    ) -> PerformanceMetrics:
        """
        Calculate comprehensive performance metrics.
        """
        # Get portfolio values at start and end
        start_value = await self._get_portfolio_value(portfolio_id, start_date)
        end_value = await self._get_portfolio_value(portfolio_id, end_date)
        
        # Get cash flows during period
        cash_flows = await self._get_cash_flows(
            portfolio_id, start_date, end_date
        )
        
        # Calculate time-weighted return
        twr = self._calculate_twr(start_value, end_value, cash_flows)
        
        # Calculate money-weighted return (IRR)
        mwr = self._calculate_mwr(start_value, end_value, cash_flows)
        
        # Get benchmark performance
        benchmark_return = None
        if benchmark:
            benchmark_return = await self._get_benchmark_return(
                benchmark, start_date, end_date
            )
            
        return PerformanceMetrics(
            total_return=twr,
            annualized_return=self._annualize_return(twr, start_date, end_date),
            irr=mwr,
            benchmark_return=benchmark_return,
            alpha=twr - benchmark_return if benchmark_return else None,
            start_value=start_value,
            end_value=end_value,
            net_cash_flow=sum(cf.amount for cf in cash_flows)
        )
```

### 3. Metrics Cache Implementation

```python
from typing import Any, Optional
import json
import hashlib
from datetime import datetime, timedelta
import redis.asyncio as redis

class MetricsCache:
    """
    Intelligent caching for portfolio metrics.
    Uses Redis for distributed caching.
    """
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        default_ttl: int = 300,  # 5 minutes
        market_hours_ttl: int = 60,  # 1 minute during market hours
        after_hours_ttl: int = 3600  # 1 hour after hours
    ):
        self.redis = redis.from_url(redis_url)
        self.default_ttl = default_ttl
        self.market_hours_ttl = market_hours_ttl
        self.after_hours_ttl = after_hours_ttl
        
    async def get(self, key: str) -> Optional[Any]:
        """Get cached value if exists and not expired."""
        value = await self.redis.get(key)
        if value:
            return json.loads(value)
        return None
        
    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set cache value with appropriate TTL."""
        if ttl is None:
            ttl = self._get_ttl()
            
        await self.redis.setex(
            key,
            ttl,
            json.dumps(value, default=str)
        )
        
    def _get_ttl(self) -> int:
        """Determine TTL based on market hours."""
        now = datetime.now()
        
        # Check if market is open
        if self._is_market_open(now):
            return self.market_hours_ttl
        elif self._is_extended_hours(now):
            return self.default_ttl
        else:
            return self.after_hours_ttl
            
    def _is_market_open(self, dt: datetime) -> bool:
        """Check if US markets are open."""
        # NYSE hours: 9:30 AM - 4:00 PM ET, Mon-Fri
        # (Implementation details...)
        pass
```

### 4. Unified Response Models

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal
from datetime import date, datetime

class HoldingMetrics(BaseModel):
    """Standardized holding metrics."""
    ticker: str
    company_name: str
    quantity: Decimal
    average_cost: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_gain: Decimal
    unrealized_gain_pct: Decimal = Field(alias="unrealized_gain_percent")
    realized_gain: Decimal
    total_gain: Decimal
    total_gain_pct: Decimal = Field(alias="total_gain_percent")
    daily_change: Decimal
    daily_change_pct: Decimal = Field(alias="daily_change_percent")
    allocation_pct: Decimal = Field(alias="allocation_percent")
    irr: Decimal
    holding_period_days: int
    
    class Config:
        populate_by_name = True  # Allows both field name and alias

class PerformanceMetrics(BaseModel):
    """Standardized performance metrics."""
    total_return: Decimal
    total_return_pct: Decimal = Field(alias="total_return_percent")
    annualized_return: Decimal
    annualized_return_pct: Decimal = Field(alias="annualized_return_percent")
    irr: Decimal
    irr_pct: Decimal = Field(alias="irr_percent")
    benchmark_return: Optional[Decimal]
    benchmark_return_pct: Optional[Decimal] = Field(alias="benchmark_return_percent")
    alpha: Optional[Decimal]
    start_value: Decimal
    end_value: Decimal
    net_cash_flow: Decimal
    
class PortfolioMetrics(BaseModel):
    """Complete portfolio metrics response."""
    portfolio_id: int
    as_of_date: date
    total_value: Decimal
    total_cost: Decimal
    total_gain: Decimal
    total_gain_pct: Decimal = Field(alias="total_gain_percent")
    daily_change: Decimal
    daily_change_pct: Decimal = Field(alias="daily_change_percent")
    cash_balance: Decimal
    holdings: Optional[List[HoldingMetrics]]
    performance: Optional[PerformanceMetrics]
    allocations: Optional[List[AllocationMetrics]]
    last_updated: datetime
```

### 5. API Route Updates

```python
# backend_api_dashboard.py
@router.get("/dashboard/{portfolio_id}")
async def get_dashboard_data(
    portfolio_id: int,
    metrics_manager: PortfolioMetricsManager = Depends(get_metrics_manager)
):
    """
    Get dashboard data using centralized metrics manager.
    """
    metrics = await metrics_manager.get_portfolio_metrics(
        portfolio_id,
        include_holdings=True,
        include_performance=True,
        include_allocations=True
    )
    
    # Transform to dashboard-specific format if needed
    return DashboardResponse(
        portfolio_metrics=metrics,
        top_movers=await metrics_manager.get_top_movers(portfolio_id, limit=5),
        recent_transactions=await metrics_manager.get_recent_transactions(portfolio_id, limit=10)
    )
```

## 🔄 Data Flow Diagram

### Complete Request Flow

```
1. Frontend Component (e.g., Dashboard)
   └─> API Request: GET /api/dashboard/{portfolio_id}
   
2. API Route Handler
   └─> PortfolioMetricsManager.get_portfolio_metrics()
   
3. Metrics Manager
   ├─> Check Cache
   │   ├─> Cache Hit → Return Cached Data
   │   └─> Cache Miss → Continue
   │
   └─> Parallel Execution
       ├─> calculate_holdings()
       │   ├─> PortfolioCalculator.calculate_detailed_holdings()
       │   ├─> Calculate IRR per holding
       │   └─> Calculate daily changes
       │
       ├─> calculate_performance()
       │   ├─> Get portfolio values over time
       │   ├─> Calculate TWR/MWR
       │   └─> Compare with benchmark
       │
       └─> calculate_allocations()
           ├─> Group by sector/asset class
           └─> Calculate percentages
           
4. Data Assembly
   ├─> Combine all metrics
   ├─> Apply consistent field naming
   └─> Update cache
   
5. Response
   └─> Return standardized PortfolioMetrics object
```

## 📊 Pros and Cons Analysis

### Proposed Approach Pros

1. **Single Source of Truth**: All calculations go through one manager
2. **Consistency**: Standardized field names and calculation methods
3. **Performance**: Intelligent caching reduces computation
4. **Maintainability**: Clear separation of concerns
5. **Testability**: Easy to mock and test individual components
6. **Extensibility**: New metrics can be added without touching existing code
7. **Parallel Processing**: Async design allows concurrent calculations

### Proposed Approach Cons

1. **Additional Abstraction**: One more layer between API and calculations
2. **Complexity**: More moving parts to understand
3. **Cache Invalidation**: Need to manage when to refresh cached data
4. **Memory Usage**: Redis cache requires additional infrastructure

## 🔄 Alternative Approaches

### Alternative 1: Direct Enhancement of Existing Services

Instead of creating a new manager, enhance existing services directly.

```python
# Enhance portfolio_calculator.py directly
class PortfolioCalculator:
    def __init__(self):
        self.cache = SimpleCache()
        
    async def get_complete_metrics(self, portfolio_id: int):
        # All calculations in one place
        pass
```

**Pros:**
- Simpler architecture
- Less abstraction
- No new components

**Cons:**
- Calculator becomes a "god class"
- Harder to test
- Mixing concerns (calculation + caching + orchestration)

### Alternative 2: Microservice Architecture

Split into multiple specialized microservices.

```
portfolio-metrics-service/
├── holdings-service/
├── performance-service/
├── allocations-service/
└── api-gateway/
```

**Pros:**
- Maximum separation
- Independent scaling
- Technology flexibility

**Cons:**
- Operational complexity
- Network latency
- Data consistency challenges

### Alternative 3: Event-Driven Architecture

Use events to trigger metric calculations.

```python
# Publish events when data changes
await event_bus.publish("portfolio.updated", portfolio_id)

# Metrics service subscribes and updates
@event_handler("portfolio.updated")
async def update_metrics(portfolio_id):
    # Recalculate and cache
    pass
```

**Pros:**
- Reactive updates
- Decoupled components
- Real-time metrics

**Cons:**
- Complex event management
- Eventual consistency
- Harder debugging

## 🚦 Implementation Phases

### Phase 1: Foundation (Week 1)
- Create PortfolioMetricsManager class
- Implement basic caching with Redis
- Create standardized response models

### Phase 2: Calculation Consolidation (Week 2)
- Move all calculations to portfolio_calculator
- Implement proper IRR calculation
- Add daily change calculations

### Phase 3: API Integration (Week 3)
- Update dashboard API to use metrics manager
- Update analytics API to use metrics manager
- Ensure backward compatibility

### Phase 4: Performance & Testing (Week 4)
- Add comprehensive unit tests
- Performance benchmarking
- Cache optimization
- Documentation

## 📈 Performance Considerations

### Caching Strategy

1. **Cache Levels**:
   - L1: In-memory LRU cache (instant)
   - L2: Redis cache (milliseconds)
   - L3: Database (when cache miss)

2. **Cache Invalidation**:
   - Transaction changes → Invalidate affected portfolio
   - Price updates → Invalidate during market hours
   - Time-based → Different TTLs for market/after hours

3. **Partial Updates**:
   - Cache individual metrics separately
   - Update only changed components

### Optimization Techniques

```python
# Parallel calculation example
async def calculate_all_metrics(portfolio_id: int):
    # Run independent calculations in parallel
    holdings_task = asyncio.create_task(calculate_holdings(portfolio_id))
    performance_task = asyncio.create_task(calculate_performance(portfolio_id))
    allocation_task = asyncio.create_task(calculate_allocations(portfolio_id))
    
    # Wait for all to complete
    holdings, performance, allocations = await asyncio.gather(
        holdings_task, performance_task, allocation_task
    )
    
    return combine_metrics(holdings, performance, allocations)
```

## 🧪 Testing Strategy

### Unit Tests

```python
# test_portfolio_metrics_manager.py
async def test_get_portfolio_metrics_with_cache_hit():
    # Setup
    cache = MockCache({"key": mock_metrics})
    manager = PortfolioMetricsManager(cache=cache)
    
    # Execute
    result = await manager.get_portfolio_metrics(1)
    
    # Assert
    assert result == mock_metrics
    assert cache.get_called_count == 1
    assert calculator.calculate_called_count == 0  # Should not calculate

async def test_irr_calculation():
    # Test IRR calculation with known values
    cash_flows = [
        (date(2024, 1, 1), Decimal("-1000")),
        (date(2024, 6, 1), Decimal("-500")),
        (date(2024, 12, 31), Decimal("1650"))
    ]
    
    irr = calculator._xirr(cash_flows)
    assert abs(irr - Decimal("0.0877")) < Decimal("0.0001")  # ~8.77%
```

### Integration Tests

```python
async def test_full_dashboard_flow():
    # Test complete flow from API to database
    response = await client.get(f"/api/dashboard/{portfolio_id}")
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify all expected fields
    assert "portfolio_metrics" in data
    assert "total_value" in data["portfolio_metrics"]
    assert "holdings" in data["portfolio_metrics"]
    
    # Verify calculations
    total = sum(h["market_value"] for h in data["holdings"])
    assert data["total_value"] == total
```

## 🔒 Security Considerations

1. **Access Control**: Ensure users can only access their own portfolio metrics
2. **Rate Limiting**: Prevent cache stampede with request throttling
3. **Data Sanitization**: Validate all inputs to calculation methods
4. **Audit Trail**: Log all metric requests for compliance

## 📝 Migration Strategy

1. **Parallel Run**: Run new system alongside old for comparison
2. **Feature Flag**: Gradually roll out to users
3. **Rollback Plan**: Easy switch back to old system if issues
4. **Data Validation**: Ensure calculations match between old/new

## 🎯 Success Metrics

1. **Performance**: 50% reduction in calculation time
2. **Consistency**: 100% field naming consistency
3. **Cache Hit Rate**: >80% during market hours
4. **Code Reduction**: 30% less duplicate code
5. **Test Coverage**: >90% for critical paths

## 📚 References

- [XIRR Calculation Method](https://en.wikipedia.org/wiki/Internal_rate_of_return#Numerical_solution)
- [Time-Weighted vs Money-Weighted Returns](https://www.investopedia.com/terms/t/time-weightedror.asp)
- [Redis Caching Best Practices](https://redis.io/docs/manual/patterns/indexes/)
- [Python Async Patterns](https://docs.python.org/3/library/asyncio-task.html)

---

*Document Version: 1.0*
*Last Updated: July 17, 2025*
*Author: Portfolio Tracker Development Team*