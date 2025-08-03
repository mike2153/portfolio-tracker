/**
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Use usePerformanceData from useSessionPortfolio instead for basic performance metrics.
 * This hook remains only for components requiring historical performance data not yet available in the consolidated endpoint.
 * 
 * React Query hook for portfolio vs benchmark performance comparison data
 * Leverages existing front_api_client infrastructure with extensive debugging
 */
import { useQuery, UseQueryResult } from '@tanstack/react-query';
// import { front_api_client } from '@/lib/front_api_client'; // Currently unused due to deprecated endpoint
import { useAuth } from '@/components/AuthProvider';

// === TYPE DEFINITIONS ===
export type RangeKey = '7D' | '1M' | '3M' | '1Y' | 'YTD' | 'MAX';
export type BenchmarkTicker = 'SPY' | 'QQQ' | 'A200' | 'URTH' | 'VTI' | 'VXUS';

export interface PerformanceDataPoint {
  date: string;
  value: number;  // Updated to match new backend format
  total_value?: number;  // Keep for backward compatibility
  indexed_performance?: number;
}

export interface PerformanceMetrics {
  portfolio_start_value: number;
  portfolio_end_value: number;
  portfolio_return_pct: number;
  index_start_value: number;
  index_end_value: number;
  index_return_pct: number;
  outperformance_pct: number;
  absolute_outperformance: number;
}

export interface PerformanceResponse {
  success: boolean;
  period: string;
  benchmark: string;
  portfolio_performance: PerformanceDataPoint[];
  benchmark_performance: PerformanceDataPoint[];
  metadata: {
    start_date: string;
    end_date: string;
    total_points: number;
    portfolio_final_value: number;
    index_final_value: number;
    benchmark_name: string;
    calculation_timestamp: string;
    cached?: boolean;
    cache_date?: string;
    no_data?: boolean;
    index_only?: boolean;  // NEW: Indicates index-only mode
    reason?: string;       // NEW: Reason for index-only mode
    user_guidance?: string; // NEW: User guidance message
    chart_type?: string;   // NEW: Chart type indicator
  };
  performance_metrics: PerformanceMetrics;
  error?: string; // Added missing error property
}

export interface UsePerformanceOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}

export interface UsePerformanceResult {
  data: PerformanceResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  // Convenience accessors
  portfolioData: PerformanceDataPoint[];
  benchmarkData: PerformanceDataPoint[];
  metrics: PerformanceMetrics | undefined;
  isSuccess: boolean;
  noData: boolean;
  isIndexOnly: boolean;  // NEW: Indicates index-only mode
  userGuidance: string;  // NEW: User guidance message
}


// === DEBUGGING UTILITIES ===
function logPerformanceRequest(_range: RangeKey, _benchmark: BenchmarkTicker, _userId?: string) {
  //console.log('[usePerformance] === PERFORMANCE REQUEST START ===');
  //console.log('[usePerformance] Timestamp:', new Date().toISOString());
  //console.log('[usePerformance] Range:', range);
  //console.log('[usePerformance] Benchmark:', benchmark);
  //console.log('[usePerformance] User ID present:', !!userId);
  //console.log('[usePerformance] React Query key:', ['performance', range, benchmark, userId]);
}

function _logPerformanceResponse(data: PerformanceResponse | undefined, error: Error | null) {
  if (data) {
    //console.log('[usePerformance] ✅ Performance data received:');
    //console.log('[usePerformance] - Success:', data.success);
    //console.log('[usePerformance] - Period:', data.period);
    //console.log('[usePerformance] - Benchmark:', data.benchmark);
    //console.log('[usePerformance] - Portfolio points:', data.portfolio_performance?.length || 0);
    //console.log('[usePerformance] - Benchmark points:', data.benchmark_performance?.length || 0);
    //console.log('[usePerformance] - Portfolio final value:', data.metadata?.portfolio_final_value);
    //console.log('[usePerformance] - Index final value:', data.metadata?.index_final_value);
    //console.log('[usePerformance] - Cached:', data.metadata?.cached || false);
    //console.log('[usePerformance] - Calculation timestamp:', data.metadata?.calculation_timestamp);
    
    if (data.performance_metrics) {
      //console.log('[usePerformance] 📊 Performance metrics:');
      //console.log('[usePerformance] - Portfolio return:', data.performance_metrics.portfolio_return_pct.toFixed(2) + '%');
      //console.log('[usePerformance] - Index return:', data.performance_metrics.index_return_pct.toFixed(2) + '%');
      //console.log('[usePerformance] - Outperformance:', data.performance_metrics.outperformance_pct.toFixed(2) + '%');
    }
  }
  
  if (error) {
    //console.error('[usePerformance] ❌ Performance request failed:', error.message);
    //console.error('[usePerformance] Error details:', error);
  }
}

function validateInputs(range: RangeKey, benchmark: BenchmarkTicker): void {
  const validRanges: RangeKey[] = ['7D', '1M', '3M', '1Y', 'YTD', 'MAX'];
  const validBenchmarks: BenchmarkTicker[] = ['SPY', 'QQQ', 'A200', 'URTH', 'VTI', 'VXUS'];
  
  if (!validRanges.includes(range)) {
    //console.error('[usePerformance] ❌ Invalid range:', range);
    //console.error('[usePerformance] Valid ranges:', validRanges);
    throw new Error(`Invalid range: ${range}. Valid options: ${validRanges.join(', ')}`);
  }
  
  if (!validBenchmarks.includes(benchmark)) {
    //console.error('[usePerformance] ❌ Invalid benchmark:', benchmark);
    //console.error('[usePerformance] Valid benchmarks:', validBenchmarks);
    throw new Error(`Invalid benchmark: ${benchmark}. Valid options: ${validBenchmarks.join(', ')}`);
  }
  
  //console.log('[usePerformance] ✅ Input validation passed');
}

// === MAIN HOOK ===
export function usePerformance(
  range: RangeKey = 'MAX', 
  benchmark: BenchmarkTicker = 'SPY',
  options: UsePerformanceOptions = {}
): UsePerformanceResult {
  //console.log('[usePerformance] 🚀 Hook called with:', { range, benchmark, options });
  
  const { user } = useAuth();
  const userId = user?.id;
  
  //console.log('[usePerformance] 🔐 Authentication status:');
  //console.log('[usePerformance] - User present:', !!user);
  //console.log('[usePerformance] - User ID:', userId);
  //console.log('[usePerformance] - User email:', user?.email);
  
  // Validate inputs - store validation result instead of early return
  let validationError: Error | null = null;
  try {
    validateInputs(range, benchmark);
  } catch (error) {
    //console.error('[usePerformance] Input validation failed:', error);
    validationError = error as Error;
  }
  
  // Optimized cache settings for portfolio charts (historical data doesn't change frequently)
  const queryOptions = {
    enabled: options.enabled !== false && !!user && !!userId && !validationError,
    staleTime: options.staleTime || 30 * 60 * 1000, // 30 minutes for charts (historical data)
    cacheTime: 60 * 60 * 1000, // 1 hour cache retention
    refetchOnWindowFocus: options.refetchOnWindowFocus !== undefined ? options.refetchOnWindowFocus : false,
    refetchOnMount: false, // Don't refetch on remount if data is fresh
    retry: 2, // Reduced retries for faster failure handling
    retryDelay: (attemptIndex: number) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 10000); // Max 10s delay
      //console.log('[usePerformance] 🔄 Retry attempt', attemptIndex + 1, 'delay:', delay + 'ms');
      return delay;
    },
    ...options
  };
  
  //console.log('[usePerformance] 📋 Query configuration:');
  //console.log('[usePerformance] - Enabled:', queryOptions.enabled);
  //console.log('[usePerformance] - Stale time:', queryOptions.staleTime + 'ms');
  //console.log('[usePerformance] - Refetch on focus:', queryOptions.refetchOnWindowFocus);
  //console.log('[usePerformance] - Retry attempts:', queryOptions.retry);
  
  const query: UseQueryResult<PerformanceResponse, Error> = useQuery({
    queryKey: ['performance', range, benchmark, userId],
    queryFn: async (): Promise<PerformanceResponse> => {
      logPerformanceRequest(range, benchmark, userId);
      
      try {
        // Fetch historical performance data from new endpoint
        const { front_api_client } = await import('@/lib/front_api_client');
        
        const response = await front_api_client.get(
          `/api/portfolio/performance/historical?period=${range}&benchmark=${benchmark}`
        );
        
        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response from performance API');
        }
        
        // The response should already be in the correct format
        return response;
        
      } catch (error) {
        console.error('[usePerformance] ❌ Error in query function:', error);
        throw error;
      }
    },
    ...queryOptions
  });
  
  // Extract query state
  const { data, isLoading, isError, error, refetch, isSuccess } = query;
  
  // Process data
  const portfolioData: PerformanceDataPoint[] = data?.portfolio_performance || [];
  const benchmarkData: PerformanceDataPoint[] = data?.benchmark_performance || [];
  const metrics: PerformanceMetrics | undefined = data?.performance_metrics;
  
  if (portfolioData.length > 0) {
    //console.log('[usePerformance] - Portfolio sample data:', portfolioData.slice(0, 3));
    //console.log('[usePerformance] - Portfolio final value:', portfolioData[portfolioData.length - 1]?.total_value);
  }
  
  if (benchmarkData.length > 0) {
    //console.log('[usePerformance] - Benchmark sample data:', benchmarkData.slice(0, 3));
    //console.log('[usePerformance] - Benchmark final value:', benchmarkData[benchmarkData.length - 1]?.total_value);
  }
  
  //console.log('[usePerformance] === HOOK RESULT READY ===');
  
  // Handle validation errors by returning error state
  if (validationError) {
    return {
      data: undefined,
      isLoading: false,
      isError: true,
      error: validationError,
      refetch: () => {},
      portfolioData: [],
      benchmarkData: [],
      metrics: undefined,
      isSuccess: false,
      noData: false,
      isIndexOnly: false,
      userGuidance: ''
    };
  }
  
  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
    portfolioData,
    benchmarkData,
    metrics,
    isSuccess,
    noData: !!data?.metadata?.no_data,
    isIndexOnly: !!data?.metadata?.index_only,
    userGuidance: data?.metadata?.user_guidance || ''
  };
}

// === UTILITY HOOKS ===

/**
 * Hook to get performance data with automatic benchmark switching
 */
export function usePerformanceComparison(
  range: RangeKey = 'MAX',
  options: UsePerformanceOptions = {}
) {

  
  // Get data for multiple benchmarks
  const spyData = usePerformance(range, 'SPY', options);
  const qqqData = usePerformance(range, 'QQQ', { ...options, enabled: false }); // Disabled by default
  
  
  return {
    spy: spyData,
    qqq: qqqData,
    // Add helper function to switch active benchmark
    switchBenchmark: (_benchmark: BenchmarkTicker) => {
  
      // This would trigger re-fetch with new benchmark
      // Implementation depends on how we want to handle benchmark switching
    }
  };
}

/**
 * Hook for performance metrics only (lighter weight)
 */
export function usePerformanceMetrics(range: RangeKey = 'MAX', benchmark: BenchmarkTicker = 'SPY') {
  const { metrics, isLoading, isError } = usePerformance(range, benchmark);
  
  return { metrics, isLoading, isError };
}