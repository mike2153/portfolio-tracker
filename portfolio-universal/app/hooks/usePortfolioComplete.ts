/**
 * Universal App Consolidated Portfolio Hook
 * 
 * This hook provides access to the consolidated /api/complete endpoint
 * for React Native components. It mirrors the functionality of the frontend's
 * useSessionPortfolio hook but is optimized for mobile usage.
 */

import { useQuery } from '@tanstack/react-query';
import { front_api_client } from '@portfolio-tracker/shared';

// Individual holding interface
export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  current_value: number;
  allocation: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  sector?: string;
  region?: string;
  company_name?: string;
}

// Types for the consolidated response (matching backend API documentation)
export interface ConsolidatedPortfolioData {
  portfolio_data: {
    total_value: number;
    total_cost: number;
    total_gain_loss: number;
    total_gain_loss_percent: number;
    daily_change: number;
    daily_change_percent: number;
    holdings_count: number;
    holdings: PortfolioHolding[];
  };
  performance_data: {
    portfolio_performance: Array<{ date: string; value: number }>;
    benchmark_performance: Array<{ date: string; value: number }>;
    metrics: {
      portfolio_return_pct: number;
      index_return_pct: number;
      outperformance_pct: number;
      sharpe_ratio: number;
      volatility: number;
      max_drawdown: number;
    };
  };
  allocation_data: {
    by_sector: Array<{ sector: string; value: number; percentage: number }>;
    by_region: Array<{ region: string; value: number; percentage: number }>;
  };
  dividend_data: {
    ytd_received: number;
    total_received: number;
    total_pending: number;
    confirmed_count: number;
    pending_count: number;
    recent_dividends: Array<{
      symbol: string;
      amount: number;
      ex_date: string;
      pay_date: string;
      confirmed: boolean;
    }>;
  };
  transactions_summary: {
    total_invested: number;
    total_sold: number;
    net_invested: number;
    total_transactions: number;
    recent_transactions: Array<{
      symbol: string;
      type: string;
      quantity: number;
      price: number;
      date: string;
    }>;
  };
  time_series_data: {
    chart_data: {
      portfolio_values: Array<{ date: string; value: number }>;
      benchmark_values: Array<{ date: string; value: number }>;
    };
  };
  metadata: {
    cache_status: string;
    computation_time_ms: number;
    data_freshness: string;
    replaced_endpoints: number;
    performance_improvement: string;
  };
}

export interface UsePortfolioCompleteOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Main consolidated portfolio hook for React Native
 */
export function usePortfolioComplete(options: UsePortfolioCompleteOptions = {}) {
  const { enabled = true, refetchInterval = 30 * 60 * 1000 } = options; // 30 min default

  const query = useQuery({
    queryKey: ['portfolio-complete'],
    queryFn: async (): Promise<ConsolidatedPortfolioData> => {
      console.log('[usePortfolioComplete] Fetching consolidated portfolio data...');
      
      try {
        // Use the consolidated endpoint (Crown Jewel endpoint)
        const response = await front_api_client.get('/api/complete');
        
        console.log('[usePortfolioComplete] Raw response:', response);
        
        // Handle different response structures
        if (response && typeof response === 'object') {
          // If response has success field, check it
          if ('success' in response && !response.success) {
            throw new Error(response.message || 'Failed to load portfolio data');
          }
          
          // Return the data directly if it exists, otherwise return the response itself
          const data = response.data || response;
          console.log('[usePortfolioComplete] ✓ Consolidated data loaded successfully');
          return data;
        }
        
        throw new Error('Invalid response format');
      } catch (error) {
        console.error('[usePortfolioComplete] ✗ Failed to load portfolio data:', error);
        throw error;
      }
    },
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - data stays fresh
    cacheTime: 60 * 60 * 1000, // 1 hour - data stays in cache
    refetchInterval: refetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // Mobile-specific: don't refetch on app focus
    retry: 2,
  });

  return {
    // Raw data
    data: query.data,
    
    // Convenience accessors (updated to match new structure)
    portfolioData: query.data?.portfolio_data,
    performanceData: query.data?.performance_data,
    allocationData: query.data?.allocation_data,
    dividendData: query.data?.dividend_data,
    transactionsSummary: query.data?.transactions_summary,
    timeSeriesData: query.data?.time_series_data,
    metadata: query.data?.metadata,
    
    // Query state
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,
    isFetching: query.isFetching,
    refetch: query.refetch,
    
    // Status helpers
    hasData: !!query.data,
    cacheHit: query.data?.metadata?.cache_status === 'hit' || false,
  };
}

/**
 * Derived hook for portfolio summary data
 */
export function usePortfolioSummary(options: UsePortfolioCompleteOptions = {}) {
  const { portfolioData, isLoading, isError, error, refetch, hasData } = usePortfolioComplete(options);
  
  return {
    data: portfolioData,
    totalValue: portfolioData?.total_value || 0,
    totalCost: portfolioData?.total_cost || 0,
    totalGainLoss: portfolioData?.total_gain_loss || 0,
    totalGainLossPercent: portfolioData?.total_gain_loss_percent || 0,
    dailyChange: portfolioData?.daily_change || 0,
    dailyChangePercent: portfolioData?.daily_change_percent || 0,
    holdingsCount: portfolioData?.holdings_count || 0,
    holdings: portfolioData?.holdings || [],
    isLoading,
    isError,
    error,
    refetch,
    hasData,
  };
}

/**
 * Derived hook for performance metrics
 */
export function usePerformanceData(options: UsePortfolioCompleteOptions = {}) {
  const { performanceData, isLoading, isError, error, refetch, hasData } = usePortfolioComplete(options);
  
  return {
    data: performanceData,
    portfolioPerformance: performanceData?.portfolio_performance || [],
    benchmarkPerformance: performanceData?.benchmark_performance || [],
    portfolioReturnPct: performanceData?.metrics?.portfolio_return_pct || 0,
    indexReturnPct: performanceData?.metrics?.index_return_pct || 0,
    outperformancePct: performanceData?.metrics?.outperformance_pct || 0,
    volatility: performanceData?.metrics?.volatility || 0,
    sharpeRatio: performanceData?.metrics?.sharpe_ratio || 0,
    maxDrawdown: performanceData?.metrics?.max_drawdown || 0,
    isLoading,
    isError,
    error,
    refetch,
    hasData,
  };
}

/**
 * Derived hook for allocation data
 */
export function useAllocationData(options: UsePortfolioCompleteOptions = {}) {
  const { allocationData, isLoading, isError, error, refetch, hasData } = usePortfolioComplete(options);
  
  return {
    data: allocationData,
    bySector: allocationData?.by_sector || [],
    byRegion: allocationData?.by_region || [],
    isLoading,
    isError,
    error,
    refetch,
    hasData,
  };
}

/**
 * Derived hook for dividend data
 */
export function useDividendData(options: UsePortfolioCompleteOptions = {}) {
  const { dividendData, isLoading, isError, error, refetch, hasData } = usePortfolioComplete(options);
  
  return {
    data: dividendData,
    ytdReceived: dividendData?.ytd_received || 0,
    totalReceived: dividendData?.total_received || 0,
    totalPending: dividendData?.total_pending || 0,
    confirmedCount: dividendData?.confirmed_count || 0,
    pendingCount: dividendData?.pending_count || 0,
    recentDividends: dividendData?.recent_dividends || [],
    // Legacy aliases for backward compatibility
    totalReceivedYtd: dividendData?.ytd_received || 0,
    dividendCount: dividendData?.confirmed_count || 0,
    upcomingDividends: dividendData?.recent_dividends || [],
    isLoading,
    isError,
    error,
    refetch,
    hasData,
  };
}