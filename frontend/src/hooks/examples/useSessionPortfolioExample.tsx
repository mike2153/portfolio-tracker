/**
 * 📚 USAGE EXAMPLES: useSessionPortfolio Hook
 * 
 * This file demonstrates how to use the new consolidated portfolio hooks
 * to replace multiple fragmented API calls with a single optimized data source.
 * 
 * BEFORE: 8+ individual hooks/API calls
 * AFTER: 1 comprehensive hook with derived accessors
 */

import React from 'react';
import {
  useSessionPortfolio,
  usePortfolioSummary,
  useAllocationData,
  usePerformanceData,
  useDividendData,
  useTransactionSummary,
  useSessionPortfolioCache
} from '../useSessionPortfolio';

// ================================================================================================
// EXAMPLE 1: Complete Portfolio Dashboard Component
// ================================================================================================

export function CompleteDashboardExample() {
  // Single hook call replaces 8+ individual API calls
  const {
    // Core data
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
    refetchOnWindowFocus: false // Don't refetch on focus - rely on cache
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading complete portfolio data...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Portfolio Data Error</h3>
        <p className="text-red-600 text-sm mt-1">
          {error?.message || 'Failed to load portfolio data'}
        </p>
        <button 
          onClick={forceRefresh}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>No portfolio data available. Add some transactions to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
        <div className="flex items-center justify-between">
          <span>
            ⚡ Loaded in {processingTimeMS}ms • {payloadSizeKB}KB payload • 
            {cacheHit ? '🎯 Cache Hit' : '🔄 Fresh Data'}
          </span>
          <button 
            onClick={forceRefresh}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Force Refresh
          </button>
        </div>
      </div>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold text-gray-900">Portfolio Value</h3>
          <p className="text-2xl font-bold text-green-600">
            ${portfolioData?.total_value.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            Cost basis: ${portfolioData?.total_cost.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold text-gray-900">Total Return</h3>
          <p className={`text-2xl font-bold ${(portfolioData?.total_gain_loss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(portfolioData?.total_gain_loss_percent || 0) >= 0 ? '+' : ''}
            {portfolioData?.total_gain_loss_percent.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-600">
            ${portfolioData?.total_gain_loss.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold text-gray-900">Daily Change</h3>
          <p className={`text-2xl font-bold ${(performanceData?.daily_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(performanceData?.daily_change_percent || 0) >= 0 ? '+' : ''}
            {performanceData?.daily_change_percent.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-600">
            ${performanceData?.daily_change.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Holdings Summary */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Holdings ({portfolioData?.holdings.length})</h3>
        </div>
        <div className="p-4">
          {portfolioData?.holdings.slice(0, 5).map((holding) => (
            <div key={holding.symbol} className="flex justify-between items-center py-2">
              <div>
                <span className="font-medium">{holding.symbol}</span>
                <span className="text-sm text-gray-600 ml-2">
                  {holding.quantity} shares @ ${holding.current_price.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <div className="font-medium">${holding.current_value.toLocaleString()}</div>
                <div className={`text-sm ${holding.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {holding.gain_loss >= 0 ? '+' : ''}{holding.gain_loss_percent.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Allocation & Dividends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-3">Portfolio Allocation</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Positions:</span>
              <span>{allocationData?.number_of_positions}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Diversification Score:</span>
              <span>{allocationData?.diversification_score.toFixed(1)}/10</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Concentration Risk:</span>
              <span className={allocationData?.concentration_risk === 'High' ? 'text-red-600' : 'text-green-600'}>
                {allocationData?.concentration_risk}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-3">Dividend Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>YTD Received:</span>
              <span className="font-medium text-green-600">
                ${dividendData?.total_received_ytd.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>All Time:</span>
              <span>${dividendData?.total_received_all_time.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total Dividends:</span>
              <span>{dividendData?.dividend_count}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================================================
// EXAMPLE 2: Using Individual Derived Hooks
// ================================================================================================

export function DerivedHooksExample() {
  // Use individual derived hooks for specific data segments
  const portfolioSummary = usePortfolioSummary();
  const allocationData = useAllocationData();
  const performanceData = usePerformanceData();
  const dividendData = useDividendData();
  const transactionsSummary = useTransactionSummary();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Portfolio Summary Card */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Portfolio Summary</h3>
        {portfolioSummary.isLoading ? (
          <div className="animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-1 text-sm">
            <div>Value: ${portfolioSummary.totalValue.toLocaleString()}</div>
            <div>Holdings: {portfolioSummary.holdings.length}</div>
            <div>Currency: {portfolioSummary.baseCurrency}</div>
            <div className="text-xs text-gray-500">
              {portfolioSummary.cacheHit ? '🎯 Cached' : '🔄 Fresh'}
            </div>
          </div>
        )}
      </div>

      {/* Allocation Card */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Allocation</h3>
        {allocationData.isLoading ? (
          <div className="animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-1 text-sm">
            <div>Positions: {allocationData.numberOfPositions}</div>
            <div>Diversification: {allocationData.diversificationScore.toFixed(1)}</div>
            <div>Risk: {allocationData.concentrationRisk}</div>
          </div>
        )}
      </div>

      {/* Performance Card */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Performance</h3>
        {performanceData.isLoading ? (
          <div className="animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-1 text-sm">
            <div>YTD: {performanceData.ytdReturnPercent.toFixed(2)}%</div>
            <div>Volatility: {performanceData.volatility.toFixed(2)}%</div>
            <div>Sharpe: {performanceData.sharpeRatio.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Dividends Card */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Dividends</h3>
        {dividendData.isLoading ? (
          <div className="animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-1 text-sm">
            <div>YTD: ${dividendData.totalReceivedYTD.toLocaleString()}</div>
            <div>All Time: ${dividendData.totalReceivedAllTime.toLocaleString()}</div>
            <div>Count: {dividendData.dividendCount}</div>
          </div>
        )}
      </div>

      {/* Transactions Card */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Transactions</h3>
        {transactionsSummary.isLoading ? (
          <div className="animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-1 text-sm">
            <div>Total: {transactionsSummary.totalTransactions}</div>
            <div>Realized: ${transactionsSummary.realizedGains.toLocaleString()}</div>
            <div className="text-xs text-gray-500">
              Last: {transactionsSummary.lastTransactionDate || 'N/A'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ================================================================================================
// EXAMPLE 3: Cache Management
// ================================================================================================

export function CacheManagementExample() {
  const { clearCache, invalidateUserCache, prefetchPortfolio, getCacheData } = useSessionPortfolioCache();
  const portfolio = useSessionPortfolio();

  const handleClearCache = () => {
    clearCache();
    console.log('Cache cleared!');
  };

  const handleInvalidateCache = () => {
    invalidateUserCache();
    console.log('User cache invalidated!');
  };

  const handlePrefetch = async () => {
    await prefetchPortfolio();
    console.log('Portfolio data prefetched!');
  };

  const handleCheckCache = () => {
    const cacheData = getCacheData();
    console.log('Cache data:', cacheData);
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Cache Management</h3>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={handleClearCache}
          className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Clear Cache
        </button>
        <button
          onClick={handleInvalidateCache}
          className="px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
        >
          Invalidate Cache
        </button>
        <button
          onClick={handlePrefetch}
          className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Prefetch Data
        </button>
        <button
          onClick={handleCheckCache}
          className="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
        >
          Check Cache
        </button>
      </div>

      {/* Cache Status */}
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span>Cache Hit:</span>
          <span className={portfolio.cacheHit ? 'text-green-600' : 'text-orange-600'}>
            {portfolio.cacheHit ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Payload Size:</span>
          <span>{portfolio.payloadSizeKB}KB</span>
        </div>
        <div className="flex justify-between">
          <span>Processing Time:</span>
          <span>{portfolio.processingTimeMS}ms</span>
        </div>
        <div className="flex justify-between">
          <span>Is Cached:</span>
          <span>{portfolio.isCached ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </div>
  );
}

// ================================================================================================
// EXAMPLE 4: Error Handling and Loading States
// ================================================================================================

export function ErrorHandlingExample() {
  const portfolio = useSessionPortfolio({
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true
  });

  if (portfolio.isLoading) {
    return (
      <div className="space-y-4">
        {/* Skeleton Loading */}
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (portfolio.isError && portfolio.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            ❌
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Portfolio Loading Error
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{portfolio.error.message}</p>
            </div>
            <div className="mt-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => portfolio.refetch()}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  Try Again
                </button>
                <button
                  onClick={() => portfolio.forceRefresh()}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  Force Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (portfolio.isEmpty) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 text-6xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Portfolio Data</h3>
        <p className="text-gray-600 mb-4">
          Get started by adding your first transaction
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Add Transaction
        </button>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          ✅
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium text-green-800">
            Portfolio data loaded successfully!
          </p>
          <div className="mt-1 text-sm text-green-700">
            {portfolio.hasData && (
              <p>
                {portfolio.portfolioData?.holdings.length} holdings • 
                ${portfolio.portfolioData?.total_value.toLocaleString()} total value •
                {portfolio.cacheHit ? ' From cache' : ' Fresh data'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompleteDashboardExample;