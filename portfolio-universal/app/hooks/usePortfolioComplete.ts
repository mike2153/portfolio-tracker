/**
 * Universal App Consolidated Portfolio Hook
 * 
 * This hook provides access to the consolidated /api/portfolio/complete endpoint
 * for React Native components. It mirrors the functionality of the frontend's
 * useSessionPortfolio hook but is optimized for mobile usage.
 */

import { useQuery } from '@tanstack/react-query';
import { front_api_client } from '@portfolio-tracker/shared';

// Types for the consolidated response
export interface ConsolidatedPortfolioData {
  portfolio_summary: {
    holdings: Array<any>;
    total_value: number;
    total_cost: number;
    total_gain_loss: number;
    total_gain_loss_percent: number;
    base_currency: string;
  };
  performance_data: {
    daily_change: number;
    daily_change_percent: number;
    ytd_return: number;
    ytd_return_percent: number;
    total_return_percent: number;
    volatility: number;
    sharpe_ratio: number;
    max_drawdown: number;
  };
  allocation_data: {
    by_sector: Array<{ sector: string; value: number; percentage: number }>;
    by_asset_type: Array<{ asset_type: string; value: number; percentage: number }>;
  };
  dividend_data: {
    total_received_ytd: number;
    dividend_count: number;
    upcoming_dividends: Array<any>;
  };
  transactions_summary: {
    total_transactions: number;
    last_transaction_date: string | null;
    realized_gains: number;
  };
  metadata: {
    cache_hit: boolean;
    last_updated: string;
    computation_time_ms: number;
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
        // Use the consolidated endpoint
        const response = await front_api_client.get('/api/complete');
        
        if (!response.success) {
          throw new Error(response.message || 'Failed to load portfolio data');
        }
        
        console.log('[usePortfolioComplete] ✓ Consolidated data loaded successfully');
        return response.data;
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
    
    // Convenience accessors
    portfolioSummary: query.data?.portfolio_summary,
    performanceData: query.data?.performance_data,
    allocationData: query.data?.allocation_data,
    dividendData: query.data?.dividend_data,
    transactionsSummary: query.data?.transactions_summary,
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
    cacheHit: query.data?.metadata?.cache_hit || false,
  };
}

/**
 * Derived hook for portfolio summary data
 */
export function usePortfolioSummary(options: UsePortfolioCompleteOptions = {}) {
  const { portfolioSummary, isLoading, isError, error, refetch, hasData } = usePortfolioComplete(options);
  
  return {
    data: portfolioSummary,
    totalValue: portfolioSummary?.total_value || 0,
    totalCost: portfolioSummary?.total_cost || 0,
    totalGainLoss: portfolioSummary?.total_gain_loss || 0,
    totalGainLossPercent: portfolioSummary?.total_gain_loss_percent || 0,
    holdings: portfolioSummary?.holdings || [],
    baseCurrency: portfolioSummary?.base_currency || 'USD',
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
    byAssetType: allocationData?.by_asset_type || [],
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
    totalReceivedYtd: dividendData?.total_received_ytd || 0,
    dividendCount: dividendData?.dividend_count || 0,
    upcomingDividends: dividendData?.upcoming_dividends || [],
    isLoading,
    isError,
    error,
    refetch,
    hasData,
  };
}