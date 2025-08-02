# 🏆 useSessionPortfolio Hook - Complete Documentation

## Overview

The `useSessionPortfolio` hook is the **crown jewel** of the Portfolio Tracker frontend, consolidating 8+ fragmented API calls into a single, optimized, cached endpoint. This hook represents a major performance optimization that transforms the user experience from multiple loading states to instant, comprehensive data access.

## 🎯 Key Benefits

### Performance Improvements
- **Before**: 8+ individual API calls, each with loading states
- **After**: 1 comprehensive API call with 30-minute aggressive caching
- **Response Time**: <1s cached, <5s fresh generation
- **Payload Efficiency**: Compressed responses for large datasets
- **Memory Usage**: Optimized React Query caching strategy

### Developer Experience
- **Type Safety**: Complete TypeScript interfaces with zero type errors
- **Error Handling**: Comprehensive error boundaries with fallback strategies  
- **Performance Monitoring**: Built-in payload size and timing metrics
- **Cache Management**: Utilities for cache invalidation and prefetching
- **Derived Hooks**: Specialized hooks for specific data segments

## 🏗️ Architecture

```typescript
useSessionPortfolio() 
├── /api/portfolio/complete (Backend endpoint)
├── React Query (Caching & state management)
├── TypeScript Interfaces (Complete type safety)
├── Performance Monitoring (Metrics & logging)
├── Error Handling (Retry logic & fallbacks)
└── Derived Hooks (Specialized data access)
```

## 📚 Usage Examples

### Basic Usage - Complete Dashboard

```typescript
import { useSessionPortfolio } from '@/hooks/useSessionPortfolio';

function Dashboard() {
  const {
    // Core data - everything you need in one call
    portfolioData,
    performanceData,
    allocationData,
    dividendData,
    
    // Loading states
    isLoading,
    isError,
    error,
    
    // Performance metrics
    cacheHit,
    payloadSizeKB,
    processingTimeMS,
    
    // Utilities
    forceRefresh,
    hasData
  } = useSessionPortfolio({
    staleTime: 30 * 60 * 1000, // 30 minutes aggressive caching
    refetchOnWindowFocus: false // Rely on cache, don't refetch on focus
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorDisplay error={error} onRetry={forceRefresh} />;
  if (!hasData) return <EmptyState />;

  return (
    <div>
      {/* All data available instantly */}
      <PortfolioValue value={portfolioData.total_value} />
      <PerformanceMetrics data={performanceData} />
      <AllocationChart data={allocationData} />
      <DividendSummary data={dividendData} />
      
      {/* Performance indicator */}
      <div className="text-sm text-gray-500">
        ⚡ Loaded in {processingTimeMS}ms • {payloadSizeKB}KB • 
        {cacheHit ? '🎯 Cached' : '🔄 Fresh'}
      </div>
    </div>
  );
}
```

### Derived Hooks - Specialized Data Access

```typescript
import { 
  usePortfolioSummary,
  useAllocationData,
  usePerformanceData,
  useDividendData 
} from '@/hooks/useSessionPortfolio';

function SpecializedComponents() {
  // Each hook uses the same cached data source
  const portfolio = usePortfolioSummary();
  const allocation = useAllocationData();
  const performance = usePerformanceData();
  const dividends = useDividendData();
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <h3>Portfolio</h3>
        <p>${portfolio.totalValue.toLocaleString()}</p>
        <p>{portfolio.holdings.length} positions</p>
      </Card>
      
      <Card>
        <h3>Performance</h3>
        <p>{performance.ytdReturnPercent.toFixed(2)}% YTD</p>
        <p>Sharpe: {performance.sharpeRatio.toFixed(2)}</p>
      </Card>
      
      <Card>
        <h3>Allocation</h3>
        <p>{allocation.numberOfPositions} positions</p>
        <p>Risk: {allocation.concentrationRisk}</p>
      </Card>
      
      <Card>
        <h3>Dividends</h3>
        <p>${dividends.totalReceivedYTD.toLocaleString()} YTD</p>
        <p>{dividends.dividendCount} total</p>
      </Card>
    </div>
  );
}
```

### Cache Management

```typescript
import { useSessionPortfolioCache } from '@/hooks/useSessionPortfolio';

function CacheControls() {
  const { 
    clearCache, 
    invalidateUserCache, 
    prefetchPortfolio 
  } = useSessionPortfolioCache();

  return (
    <div>
      <button onClick={clearCache}>Clear All Cache</button>
      <button onClick={invalidateUserCache}>Refresh User Data</button>
      <button onClick={prefetchPortfolio}>Prefetch Data</button>
    </div>
  );
}
```

## 🔧 Configuration Options

```typescript
interface UseSessionPortfolioOptions {
  enabled?: boolean;                // Enable/disable the query
  staleTime?: number;              // How long data stays fresh (default: 30min)
  cacheTime?: number;              // How long to keep in memory (default: 1hr)
  refetchOnWindowFocus?: boolean;  // Refetch when window gains focus
  refetchOnMount?: boolean;        // Refetch on component mount
  retry?: number;                  // Number of retry attempts (default: 3)
  forceRefresh?: boolean;          // Skip cache and fetch fresh data
  includeHistorical?: boolean;     // Include time series data
}
```

## 📊 Performance Monitoring

The hook includes comprehensive performance monitoring:

```typescript
const portfolio = useSessionPortfolio();

// Access performance metrics
console.log({
  processingTime: portfolio.processingTimeMS,    // Total processing time
  payloadSize: portfolio.payloadSizeKB,         // Response size
  cacheHit: portfolio.cacheHit,                 // Was this cached?
  isCached: portfolio.isCached,                 // Cache status
  dataCompleteness: portfolio.metadata?.data_completeness
});
```

## 🚨 Error Handling

Built-in comprehensive error handling with automatic retries:

```typescript
const portfolio = useSessionPortfolio({
  retry: 3,                           // Retry failed requests 3 times
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000) // Exponential backoff
});

if (portfolio.isError) {
  // Error object includes enhanced context
  console.error('Portfolio error:', portfolio.error?.message);
  
  // Manual retry options
  portfolio.refetch();      // Retry with existing cache strategy
  portfolio.forceRefresh(); // Skip cache and fetch fresh
}
```

## 🔄 Cache Strategy

Aggressive caching optimized for financial data:

- **Stale Time**: 30 minutes (data doesn't change frequently)
- **Cache Time**: 1 hour (keep in memory for fast access)
- **Background Updates**: Automatic refresh when data becomes stale
- **Manual Controls**: Force refresh and cache invalidation available

## 📋 Available Hooks

### Primary Hook
- `useSessionPortfolio()` - Complete portfolio data in one call

### Derived Hooks (all use the same cached data)
- `usePortfolioSummary()` - Holdings and portfolio totals
- `useAllocationData()` - Asset allocation breakdowns  
- `usePerformanceData()` - Performance metrics and analytics
- `useDividendData()` - Dividend history and summaries
- `useTransactionSummary()` - Transaction counts and activity

### Utility Hooks
- `useSessionPortfolioCache()` - Cache management utilities

## 🎨 TypeScript Interfaces

Complete type safety with comprehensive interfaces:

```typescript
interface CompletePortfolioData {
  portfolio_data: PortfolioSummary;
  performance_data: PerformanceMetrics;
  allocation_data: AllocationData;
  dividend_data: DividendData;
  transactions_summary: TransactionsSummary;
  market_analysis: MarketAnalysis;
  currency_conversions: CurrencyConversions;
  metadata: CompletePortfolioMetadata;
}
```

See the full type definitions in `useSessionPortfolio.ts` for complete interface details.

## 🔒 Security & Authentication

- Automatic JWT token handling via `useAuth` hook
- Secure API calls through existing `front_api_client` infrastructure
- User-specific data isolation with query keys
- Proper error handling for authentication failures

## 🚀 Migration Guide

### Replacing Existing Hooks

**Before:**
```typescript
// Multiple hooks, multiple API calls, multiple loading states
const portfolio = usePortfolioAllocation();
const performance = usePerformance('MAX', 'SPY');
const dividends = useDividends();
const transactions = useTransactions();

// Each has separate loading/error states
if (portfolio.isLoading || performance.isLoading || dividends.isLoading) {
  return <Loading />;
}
```

**After:**
```typescript
// Single hook, single API call, single loading state
const { 
  portfolioData, 
  performanceData, 
  dividendData, 
  transactionSummary,
  isLoading 
} = useSessionPortfolio();

// One loading state for everything
if (isLoading) return <Loading />;
```

### Incremental Migration

1. **Phase 1**: Use `useSessionPortfolio` alongside existing hooks
2. **Phase 2**: Replace high-traffic components with derived hooks
3. **Phase 3**: Remove old hooks and API endpoints
4. **Phase 4**: Optimize cache strategies based on usage patterns

## 🔍 Debugging & Troubleshooting

Enable detailed logging:

```typescript
// Logs are automatically enabled in development
// Look for [useSessionPortfolio] prefixed messages in console

const portfolio = useSessionPortfolio();

// Manual debugging
console.log('Portfolio debug info:', {
  hasData: portfolio.hasData,
  isEmpty: portfolio.isEmpty,
  cacheHit: portfolio.cacheHit,
  processingTime: portfolio.processingTimeMS,
  errorMessage: portfolio.error?.message
});
```

## 📈 Performance Benchmarks

Expected performance characteristics:

- **Cache Hit**: <100ms response time
- **Cache Miss**: <5000ms fresh data generation  
- **Payload Size**: 50-200KB typical, compression applied >50KB
- **Memory Usage**: Efficient React Query garbage collection
- **Network Requests**: 1 instead of 8+ (87.5% reduction)

## 🤝 Contributing

When modifying this hook:

1. **Maintain Type Safety**: All interfaces must be complete and accurate
2. **Preserve Performance**: Changes should not degrade cache efficiency
3. **Update Documentation**: Keep this README current with changes
4. **Test Thoroughly**: Validate with realistic portfolio data
5. **Monitor Metrics**: Check performance impact before/after changes

## 📝 Changelog

### v1.0.0 (Current)
- Initial implementation with complete portfolio data consolidation
- TypeScript interfaces for all response structures
- Performance monitoring and cache management
- Comprehensive error handling with retry logic
- Derived hooks for specialized data access
- Example components and usage documentation

---

This hook represents a significant architectural improvement that transforms the Portfolio Tracker from a fragmented, slow-loading experience to a fast, cohesive, professionally optimized application. 🏆