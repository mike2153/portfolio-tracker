/**
 * 🏆 CROWN JEWEL HOOK: useSessionPortfolio
 * 
 * The ultimate React Query hook that consolidates 8+ API calls into one optimized endpoint.
 * Replaces fragmented data fetching with a single, cached, comprehensive response.
 * 
 * Performance targets:
 * - <1s cached responses
 * - <5s fresh data generation
 * - 30 minute staleTime for aggressive caching
 * - 1 hour cacheTime for memory efficiency
 * 
 * Features:
 * - Complete TypeScript safety with zero type errors
 * - Comprehensive error handling with fallback strategies
 * - Performance monitoring and payload size tracking
 * - Retry logic with exponential backoff
 * - Force refresh and historical data control
 * - Memory-efficient caching with strategic invalidation
 */

import { useQuery, UseQueryResult, useQueryClient } from '@tanstack/react-query';
import { front_api_client } from '@/lib/front_api_client';
import { useAuth } from '@/components/AuthProvider';
import { useCallback, useMemo } from 'react';

// Debug logging - disable in production
const DEBUG_LOGGING = process.env.NODE_ENV === 'development';

// Helper function to conditionally log debug information
const debugLog = (...args: any[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};

// ================================================================================================
// TYPE DEFINITIONS - Complete TypeScript interfaces for the /api/portfolio/complete endpoint
// ================================================================================================

/**
 * Core holding data from portfolio
 */
export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  avg_cost: number;
  total_cost: number;
  current_price: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  allocation_percent: number;
  dividends_received: number;
  price_date: string;
  currency: string;
}

/**
 * Portfolio summary aggregates
 */
export interface PortfolioSummary {
  holdings: PortfolioHolding[];
  total_value: number;
  total_cost: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  base_currency: string;
}

/**
 * Performance metrics and analytics
 */
export interface PerformanceMetrics {
  daily_change: number;
  daily_change_percent: number;
  ytd_return: number;
  ytd_return_percent: number;
  total_return_percent: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
}

/**
 * Allocation breakdown by symbol
 */
export interface AllocationItem {
  symbol: string;
  allocation_percent: number;
  current_value: number;
}

export interface AllocationData {
  by_symbol: AllocationItem[];
  diversification_score: number;
  concentration_risk: string;
  number_of_positions: number;
}

/**
 * Dividend information
 */
export interface DividendRecord {
  id: string;
  symbol: string;
  ex_date: string;
  pay_date: string;
  amount: number;
  currency: string;
  confirmed: boolean;
}

export interface DividendData {
  recent_dividends: DividendRecord[];
  total_received_ytd: number;
  total_received_all_time: number;
  dividend_count: number;
}

/**
 * Transaction summary
 */
export interface TransactionsSummary {
  total_transactions: number;
  last_transaction_date: string | null;
  realized_gains: number;
}

/**
 * Market analysis data
 */
export interface MarketAnalysis {
  portfolio_diversification?: {
    diversification_score: number;
    concentration_risk: string;
  };
  [key: string]: any; // Allow for additional market analysis fields
}

/**
 * Currency conversion rates
 */
export interface CurrencyConversions {
  [currencyPair: string]: number;
}

/**
 * Gainer/Loser data structure for dashboard cards
 */
export interface GainerLoserItem {
  name: string;
  ticker: string;
  value: number;
  changePercent: number;
  changeValue: number;
}

/**
 * Performance metadata for monitoring
 */
export interface PerformanceMetadata {
  total_processing_time_ms: number;
  data_generation_time_ms: number;
  data_transformation_time_ms: number;
  service_computation_time_ms: number;
  cache_hit_ratio: number;
  payload_size_bytes: number;
  payload_size_kb: number;
  data_sources: string[];
  fallback_strategies_used: string[];
}

/**
 * Complete response metadata
 */
export interface CompletePortfolioMetadata {
  generated_at: string;
  cache_hit: boolean;
  cache_strategy: string;
  data_completeness: number;
  performance_metadata: PerformanceMetadata;
}

/**
 * Main complete portfolio data structure
 */
export interface CompletePortfolioData {
  portfolio_data: PortfolioSummary;
  performance_data: PerformanceMetrics;
  allocation_data: AllocationData;
  dividend_data: DividendData;
  transactions_summary: TransactionsSummary;
  market_analysis: MarketAnalysis;
  currency_conversions: CurrencyConversions;
  top_gainers: GainerLoserItem[];
  top_losers: GainerLoserItem[];
  metadata: CompletePortfolioMetadata;
}

/**
 * API Response wrapper
 */
export interface CompletePortfolioResponse {
  success: boolean;
  portfolio_data: PortfolioSummary;
  performance_data: PerformanceMetrics;
  allocation_data: AllocationData;
  dividend_data: DividendData;
  transactions_summary: TransactionsSummary;
  market_analysis: MarketAnalysis;
  currency_conversions: CurrencyConversions;
  top_gainers: GainerLoserItem[];
  top_losers: GainerLoserItem[];
  metadata: CompletePortfolioMetadata;
  error?: string;
}

/**
 * Hook options for customization
 */
export interface UseSessionPortfolioOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean | 'always';
  retry?: number;
  forceRefresh?: boolean;
  includeHistorical?: boolean;
}

/**
 * Main hook result with convenience accessors
 */
export interface UseSessionPortfolioResult {
  // Core React Query state
  data: CompletePortfolioData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
  isFetching: boolean;
  refetch: () => void;
  
  // Convenience accessors for specific data segments
  portfolioData: PortfolioSummary | undefined;
  performanceData: PerformanceMetrics | undefined;
  allocationData: AllocationData | undefined;
  dividendData: DividendData | undefined;
  transactionsSummary: TransactionsSummary | undefined;
  marketAnalysis: MarketAnalysis | undefined;
  currencyConversions: CurrencyConversions | undefined;
  topGainers: GainerLoserItem[] | undefined;
  topLosers: GainerLoserItem[] | undefined;
  
  // Performance and cache information
  metadata: CompletePortfolioMetadata | undefined;
  cacheHit: boolean;
  payloadSizeKB: number;
  processingTimeMS: number;
  
  // Utility functions
  forceRefresh: () => void;
  invalidateCache: () => void;
  
  // Status helpers
  hasData: boolean;
  isEmpty: boolean;
  isCached: boolean;
}

// ================================================================================================
// DEBUGGING AND PERFORMANCE UTILITIES
// ================================================================================================

/**
 * Log performance metrics for monitoring
 */
function logPerformanceMetrics(
  metadata: CompletePortfolioMetadata | undefined,
  userId?: string
) {
  if (!metadata) return;
  
  const { performance_metadata } = metadata;
  
  debugLog('[useSessionPortfolio] 📊 Performance Metrics:');
  debugLog(`[useSessionPortfolio] - Total Processing Time: ${performance_metadata.total_processing_time_ms}ms`);
  debugLog(`[useSessionPortfolio] - Cache Hit Ratio: ${(performance_metadata.cache_hit_ratio * 100).toFixed(1)}%`);
  debugLog(`[useSessionPortfolio] - Payload Size: ${performance_metadata.payload_size_kb}KB`);
  debugLog(`[useSessionPortfolio] - Data Sources: ${performance_metadata.data_sources.join(', ')}`);
  debugLog(`[useSessionPortfolio] - Generated At: ${metadata.generated_at}`);
  debugLog(`[useSessionPortfolio] - User ID: ${userId}`);
}

/**
 * Validate response data structure
 */
function validateCompletePortfolioResponse(
  response: unknown
): response is CompletePortfolioResponse {
  if (!response || typeof response !== 'object') {
    console.error('[useSessionPortfolio] ❌ Invalid response: not an object');
    return false;
  }
  
  const resp = response as Record<string, unknown>;
  
  // Check required top-level fields
  const requiredFields = [
    'success',
    'portfolio_data',
    'performance_data',
    'allocation_data',
    'dividend_data',
    'transactions_summary',
    'metadata'
  ];
  
  for (const field of requiredFields) {
    if (!(field in resp)) {
      console.error(`[useSessionPortfolio] ❌ Missing required field: ${field}`);
      return false;
    }
  }
  
  if (!resp.success) {
    console.error('[useSessionPortfolio] ❌ API returned success=false');
    return false;
  }
  
  // Basic structure validation
  if (!resp.portfolio_data || typeof resp.portfolio_data !== 'object') {
    console.error('[useSessionPortfolio] ❌ Invalid portfolio_data structure');
    return false;
  }
  
  const portfolioData = resp.portfolio_data as Record<string, unknown>;
  if (!Array.isArray(portfolioData.holdings)) {
    console.error('[useSessionPortfolio] ❌ Portfolio holdings is not an array');
    return false;
  }
  
  debugLog('[useSessionPortfolio] ✅ Response validation passed');
  return true;
}

/**
 * Sanitize and normalize response data
 */
function sanitizeCompletePortfolioData(
  response: CompletePortfolioResponse
): CompletePortfolioData {
  // Ensure all numeric values are valid numbers (not NaN or null)
  const sanitizeNumber = (value: unknown, defaultValue: number = 0): number => {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return !isNaN(parsed) ? parsed : defaultValue;
    }
    return defaultValue;
  };
  
  // Sanitize holdings array
  const sanitizedHoldings: PortfolioHolding[] = response.portfolio_data.holdings.map(holding => ({
    symbol: holding.symbol || '',
    quantity: sanitizeNumber(holding.quantity),
    avg_cost: sanitizeNumber(holding.avg_cost),
    total_cost: sanitizeNumber(holding.total_cost),
    current_price: sanitizeNumber(holding.current_price),
    current_value: sanitizeNumber(holding.current_value),
    gain_loss: sanitizeNumber(holding.gain_loss),
    gain_loss_percent: sanitizeNumber(holding.gain_loss_percent),
    allocation_percent: sanitizeNumber(holding.allocation_percent),
    dividends_received: sanitizeNumber(holding.dividends_received),
    price_date: holding.price_date || '',
    currency: holding.currency || 'USD'
  }));
  
  // Sanitize portfolio summary
  const sanitizedPortfolioData: PortfolioSummary = {
    holdings: sanitizedHoldings,
    total_value: sanitizeNumber(response.portfolio_data.total_value),
    total_cost: sanitizeNumber(response.portfolio_data.total_cost),
    total_gain_loss: sanitizeNumber(response.portfolio_data.total_gain_loss),
    total_gain_loss_percent: sanitizeNumber(response.portfolio_data.total_gain_loss_percent),
    base_currency: response.portfolio_data.base_currency || 'USD'
  };
  
  // Return sanitized complete data
  return {
    portfolio_data: sanitizedPortfolioData,
    performance_data: {
      daily_change: sanitizeNumber(response.performance_data.daily_change),
      daily_change_percent: sanitizeNumber(response.performance_data.daily_change_percent),
      ytd_return: sanitizeNumber(response.performance_data.ytd_return),
      ytd_return_percent: sanitizeNumber(response.performance_data.ytd_return_percent),
      total_return_percent: sanitizeNumber(response.performance_data.total_return_percent),
      volatility: sanitizeNumber(response.performance_data.volatility),
      sharpe_ratio: sanitizeNumber(response.performance_data.sharpe_ratio),
      max_drawdown: sanitizeNumber(response.performance_data.max_drawdown)
    },
    allocation_data: {
      by_symbol: response.allocation_data.by_symbol || [],
      diversification_score: sanitizeNumber(response.allocation_data.diversification_score),
      concentration_risk: response.allocation_data.concentration_risk || 'unknown',
      number_of_positions: sanitizeNumber(response.allocation_data.number_of_positions)
    },
    dividend_data: {
      recent_dividends: response.dividend_data.recent_dividends || [],
      total_received_ytd: sanitizeNumber(response.dividend_data.total_received_ytd),
      total_received_all_time: sanitizeNumber(response.dividend_data.total_received_all_time),
      dividend_count: sanitizeNumber(response.dividend_data.dividend_count)
    },
    transactions_summary: {
      total_transactions: sanitizeNumber(response.transactions_summary.total_transactions),
      last_transaction_date: response.transactions_summary.last_transaction_date,
      realized_gains: sanitizeNumber(response.transactions_summary.realized_gains)
    },
    market_analysis: response.market_analysis || {},
    currency_conversions: response.currency_conversions || {},
    top_gainers: response.top_gainers || [],
    top_losers: response.top_losers || [],
    metadata: response.metadata
  };
}

// ================================================================================================
// MAIN HOOK IMPLEMENTATION
// ================================================================================================

/**
 * 🏆 PRIMARY HOOK: useSessionPortfolio
 * 
 * The crown jewel hook that consolidates all portfolio data into a single optimized call.
 * Replaces 8+ individual API calls with one comprehensive, cached response.
 */
export function useSessionPortfolio(
  options: UseSessionPortfolioOptions = {}
): UseSessionPortfolioResult {
  debugLog('[useSessionPortfolio] 🚀 Hook initialized with options:', options);
  
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  
  debugLog('[useSessionPortfolio] 🔐 Authentication status:');
  debugLog('[useSessionPortfolio] - User present:', !!user);
  debugLog('[useSessionPortfolio] - User ID:', userId);
  debugLog('[useSessionPortfolio] - User email:', user?.email);
  
  // Aggressive caching configuration optimized for portfolio data
  const queryOptions = {
    enabled: options.enabled !== false && !!user && !!userId,
    staleTime: options.staleTime || 30 * 60 * 1000, // 30 minutes - aggressive caching for relatively stable financial data
    cacheTime: options.cacheTime || 60 * 60 * 1000, // 1 hour memory retention
    refetchOnWindowFocus: options.refetchOnWindowFocus !== undefined ? options.refetchOnWindowFocus : false,
    refetchOnMount: options.refetchOnMount !== undefined ? options.refetchOnMount : false,
    retry: options.retry !== undefined ? options.retry : 3, // More retries for critical data
    retryDelay: (attemptIndex: number) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 15000); // Max 15s delay
      debugLog(`[useSessionPortfolio] 🔄 Retry attempt ${attemptIndex + 1}, delay: ${delay}ms`);
      return delay;
    }
  };
  
  debugLog('[useSessionPortfolio] 📋 Query configuration:');
  debugLog('[useSessionPortfolio] - Enabled:', queryOptions.enabled);
  debugLog('[useSessionPortfolio] - Stale time:', queryOptions.staleTime + 'ms');
  debugLog('[useSessionPortfolio] - Cache time:', queryOptions.cacheTime + 'ms');
  
  // Create unique query key for user-specific complete portfolio data
  const queryKey = useMemo(() => [
    'session-portfolio',
    userId,
    {
      forceRefresh: options.forceRefresh || false,
      includeHistorical: options.includeHistorical !== false
    }
  ], [userId, options.forceRefresh, options.includeHistorical]);
  
  const query: UseQueryResult<CompletePortfolioData, Error> = useQuery({
    queryKey,
    queryFn: async (): Promise<CompletePortfolioData> => {
      const requestStart = performance.now();
      debugLog('[useSessionPortfolio] 🎯 Starting complete portfolio data fetch...');
      debugLog('[useSessionPortfolio] - Query key:', queryKey);
      debugLog('[useSessionPortfolio] - Force refresh:', options.forceRefresh);
      debugLog('[useSessionPortfolio] - Include historical:', options.includeHistorical);
      
      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (options.forceRefresh) params.append('force_refresh', 'true');
        if (options.includeHistorical === false) params.append('include_historical', 'false');
        
        const endpoint = `/api/complete${params.toString() ? '?' + params.toString() : ''}`;
        debugLog('[useSessionPortfolio] 📡 Fetching from endpoint:', endpoint);
        
        // Make the API call using existing infrastructure
        const response = await front_api_client.get(endpoint);
        
        const requestEnd = performance.now();
        const requestDuration = Math.round(requestEnd - requestStart);
        debugLog(`[useSessionPortfolio] ⚡ API call completed in ${requestDuration}ms`);
        
        // Comprehensive response validation
        if (!validateCompletePortfolioResponse(response)) {
          throw new Error('Invalid response structure from complete portfolio API');
        }
        
        // Type-safe casting after validation
        const validatedResponse = response as CompletePortfolioResponse;
        
        // Sanitize and normalize the data
        const sanitizedData = sanitizeCompletePortfolioData(validatedResponse);
        
        // Log performance metrics
        logPerformanceMetrics(sanitizedData.metadata, userId);
        
        debugLog('[useSessionPortfolio] ✅ Complete portfolio data processed successfully');
        debugLog(`[useSessionPortfolio] - Holdings: ${sanitizedData.portfolio_data.holdings.length}`);
        debugLog(`[useSessionPortfolio] - Portfolio Value: $${sanitizedData.portfolio_data.total_value.toLocaleString()}`);
        debugLog(`[useSessionPortfolio] - Dividends: ${sanitizedData.dividend_data.dividend_count}`);
        debugLog(`[useSessionPortfolio] - Cache Hit: ${sanitizedData.metadata.cache_hit}`);
        
        return sanitizedData;
        
      } catch (error) {
        const requestEnd = performance.now();
        const requestDuration = Math.round(requestEnd - requestStart);
        
        console.error(`[useSessionPortfolio] ❌ Error after ${requestDuration}ms:`, error);
        
        if (error instanceof Error) {
          // Enhance error with context
          const enhancedError = new Error(
            `Complete portfolio fetch failed: ${error.message}`
          );
          // TypeScript compatibility: set cause property if supported
          if ('cause' in Error.prototype) {
            (enhancedError as any).cause = error;
          }
          throw enhancedError;
        }
        
        throw new Error('Unknown error occurred while fetching complete portfolio data');
      }
    },
    ...queryOptions
  });
  
  // Extract query state
  const { 
    data, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isSuccess, 
    isFetching 
  } = query;
  
  // Memoized convenience accessors
  const portfolioData = useMemo(() => data?.portfolio_data, [data?.portfolio_data]);
  const performanceData = useMemo(() => data?.performance_data, [data?.performance_data]);
  const allocationData = useMemo(() => data?.allocation_data, [data?.allocation_data]);
  const dividendData = useMemo(() => data?.dividend_data, [data?.dividend_data]);
  const transactionsSummary = useMemo(() => data?.transactions_summary, [data?.transactions_summary]);
  const marketAnalysis = useMemo(() => data?.market_analysis, [data?.market_analysis]);
  const currencyConversions = useMemo(() => data?.currency_conversions, [data?.currency_conversions]);
  const topGainers = useMemo(() => data?.top_gainers, [data?.top_gainers]);
  const topLosers = useMemo(() => data?.top_losers, [data?.top_losers]);
  const metadata = useMemo(() => data?.metadata, [data?.metadata]);
  
  // Memoized derived properties
  const cacheHit = useMemo(() => metadata?.cache_hit || false, [metadata?.cache_hit]);
  const payloadSizeKB = useMemo(() => metadata?.performance_metadata?.payload_size_kb || 0, [metadata]);
  const processingTimeMS = useMemo(() => metadata?.performance_metadata?.total_processing_time_ms || 0, [metadata]);
  const hasData = useMemo(() => !!data && !!portfolioData && portfolioData.holdings.length > 0, [data, portfolioData]);
  const isEmpty = useMemo(() => !hasData, [hasData]);
  const isCached = useMemo(() => cacheHit, [cacheHit]);
  
  // Utility functions
  const forceRefresh = useCallback(() => {
    debugLog('[useSessionPortfolio] 🔄 Force refreshing complete portfolio data...');
    queryClient.removeQueries({ queryKey: ['session-portfolio', userId] });
    refetch();
  }, [queryClient, userId, refetch]);
  
  const invalidateCache = useCallback(() => {
    debugLog('[useSessionPortfolio] 🗑️ Invalidating session portfolio cache...');
    queryClient.invalidateQueries({ queryKey: ['session-portfolio', userId] });
  }, [queryClient, userId]);
  
  // Performance logging on data changes
  useMemo(() => {
    if (data && metadata) {
      const perfData = metadata.performance_metadata;
      debugLog('[useSessionPortfolio] 📈 Updated performance stats:', {
        processingTime: perfData.total_processing_time_ms + 'ms',
        payloadSize: perfData.payload_size_kb + 'KB',
        cacheHitRatio: (perfData.cache_hit_ratio * 100).toFixed(1) + '%',
        dataCompleteness: metadata.data_completeness
      });
    }
  }, [data, metadata]);
  
  return {
    // Core React Query state
    data,
    isLoading,
    isError,
    error,
    isSuccess,
    isFetching,
    refetch,
    
    // Convenience accessors
    portfolioData,
    performanceData,
    allocationData,
    dividendData,
    transactionsSummary,
    marketAnalysis,
    currencyConversions,
    topGainers,
    topLosers,
    
    // Performance and cache information
    metadata,
    cacheHit,
    payloadSizeKB,
    processingTimeMS,
    
    // Utility functions
    forceRefresh,
    invalidateCache,
    
    // Status helpers
    hasData,
    isEmpty,
    isCached
  };
}

// ================================================================================================
// DERIVED HOOKS - Specialized hooks that leverage the main useSessionPortfolio hook
// ================================================================================================

/**
 * 📊 DERIVED HOOK: usePortfolioSummary
 * Provides just the core portfolio holdings and summary data
 */
export function usePortfolioSummary(options: UseSessionPortfolioOptions = {}) {
  const { 
    portfolioData, 
    isLoading, 
    isError, 
    error, 
    refetch,
    hasData,
    cacheHit
  } = useSessionPortfolio(options);
  
  return {
    data: portfolioData,
    holdings: portfolioData?.holdings || [],
    totalValue: portfolioData?.total_value || 0,
    totalCost: portfolioData?.total_cost || 0,
    totalGainLoss: portfolioData?.total_gain_loss || 0,
    totalGainLossPercent: portfolioData?.total_gain_loss_percent || 0,
    baseCurrency: portfolioData?.base_currency || 'USD',
    isLoading,
    isError,
    error,
    refetch,
    hasData,
    cacheHit
  };
}

/**
 * 🥧 DERIVED HOOK: useAllocationData
 * Provides portfolio allocation and diversification data
 */
export function useAllocationData(options: UseSessionPortfolioOptions = {}) {
  const { 
    allocationData, 
    isLoading, 
    isError, 
    error, 
    refetch,
    hasData,
    cacheHit
  } = useSessionPortfolio(options);
  
  return {
    data: allocationData,
    allocations: allocationData?.by_symbol || [],
    diversificationScore: allocationData?.diversification_score || 0,
    concentrationRisk: allocationData?.concentration_risk || 'unknown',
    numberOfPositions: allocationData?.number_of_positions || 0,
    isLoading,
    isError,
    error,
    refetch,
    hasData,
    cacheHit
  };
}

/**
 * 📈 DERIVED HOOK: usePerformanceData
 * Provides performance metrics and analytics
 */
export function usePerformanceData(options: UseSessionPortfolioOptions = {}) {
  const { 
    performanceData, 
    isLoading, 
    isError, 
    error, 
    refetch,
    hasData,
    cacheHit
  } = useSessionPortfolio(options);
  
  return {
    data: performanceData,
    dailyChange: performanceData?.daily_change || 0,
    dailyChangePercent: performanceData?.daily_change_percent || 0,
    ytdReturn: performanceData?.ytd_return || 0,
    ytdReturnPercent: performanceData?.ytd_return_percent || 0,
    totalReturnPercent: performanceData?.total_return_percent || 0,
    volatility: performanceData?.volatility || 0,
    sharpeRatio: performanceData?.sharpe_ratio || 0,
    maxDrawdown: performanceData?.max_drawdown || 0,
    isLoading,
    isError,
    error,
    refetch,
    hasData,
    cacheHit
  };
}

/**
 * 💰 DERIVED HOOK: useDividendData
 * Provides dividend history and summaries
 */
export function useDividendData(options: UseSessionPortfolioOptions = {}) {
  const { 
    dividendData, 
    isLoading, 
    isError, 
    error, 
    refetch,
    hasData,
    cacheHit
  } = useSessionPortfolio(options);
  
  return {
    data: dividendData,
    recentDividends: dividendData?.recent_dividends || [],
    totalReceivedYTD: dividendData?.total_received_ytd || 0,
    totalReceivedAllTime: dividendData?.total_received_all_time || 0,
    dividendCount: dividendData?.dividend_count || 0,
    isLoading,
    isError,
    error,
    refetch,
    hasData,
    cacheHit
  };
}

/**
 * 🔄 DERIVED HOOK: useTransactionSummary
 * Provides transaction counts and recent activity
 */
export function useTransactionSummary(options: UseSessionPortfolioOptions = {}) {
  const { 
    transactionsSummary, 
    isLoading, 
    isError, 
    error, 
    refetch,
    hasData,
    cacheHit
  } = useSessionPortfolio(options);
  
  return {
    data: transactionsSummary,
    totalTransactions: transactionsSummary?.total_transactions || 0,
    lastTransactionDate: transactionsSummary?.last_transaction_date,
    realizedGains: transactionsSummary?.realized_gains || 0,
    isLoading,
    isError,
    error,
    refetch,
    hasData,
    cacheHit
  };
}

/**
 * 📊 DERIVED HOOK: useGainersLosers
 * Provides top gainers and losers data for dashboard cards
 */
export function useGainersLosers(options: UseSessionPortfolioOptions = {}) {
  const { 
    topGainers, 
    topLosers, 
    isLoading, 
    isError, 
    error, 
    refetch,
    hasData,
    cacheHit
  } = useSessionPortfolio(options);
  
  return {
    topGainers: topGainers || [],
    topLosers: topLosers || [],
    isLoading,
    isError,
    error,
    refetch,
    hasData,
    cacheHit
  };
}

// ================================================================================================
// UTILITY HOOKS AND CACHE MANAGEMENT
// ================================================================================================

/**
 * 🔧 UTILITY HOOK: useSessionPortfolioCache
 * Provides cache management utilities
 */
export function useSessionPortfolioCache() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  
  const clearCache = useCallback(() => {
    debugLog('[useSessionPortfolioCache] 🗑️ Clearing all session portfolio cache...');
    queryClient.removeQueries({ queryKey: ['session-portfolio'] });
  }, [queryClient]);
  
  const invalidateUserCache = useCallback(() => {
    if (!userId) return;
    debugLog('[useSessionPortfolioCache] ♻️ Invalidating cache for user:', userId);
    queryClient.invalidateQueries({ queryKey: ['session-portfolio', userId] });
  }, [queryClient, userId]);
  
  const prefetchPortfolio = useCallback(async () => {
    if (!userId) return;
    debugLog('[useSessionPortfolioCache] 🚀 Prefetching portfolio data for user:', userId);
    await queryClient.prefetchQuery({
      queryKey: ['session-portfolio', userId, { forceRefresh: false, includeHistorical: true }],
      staleTime: 30 * 60 * 1000 // 30 minutes
    });
  }, [queryClient, userId]);
  
  const getCacheData = useCallback(() => {
    if (!userId) return null;
    const cacheData = queryClient.getQueryData(['session-portfolio', userId]);
    debugLog('[useSessionPortfolioCache] 📦 Retrieved cache data:', !!cacheData);
    return cacheData;
  }, [queryClient, userId]);
  
  return {
    clearCache,
    invalidateUserCache,
    prefetchPortfolio,
    getCacheData
  };
}

// Export default hook for convenience
export default useSessionPortfolio;