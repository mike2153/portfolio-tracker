/**
 * React Query hook for portfolio vs benchmark performance comparison data
 * Leverages existing front_api_client infrastructure with extensive debugging
 */
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { front_api_client } from '@/lib/front_api_client';
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
function logPerformanceRequest(range: RangeKey, benchmark: BenchmarkTicker, userId?: string) {
  //console.log('[usePerformance] === PERFORMANCE REQUEST START ===');
  //console.log('[usePerformance] Timestamp:', new Date().toISOString());
  //console.log('[usePerformance] Range:', range);
  //console.log('[usePerformance] Benchmark:', benchmark);
  //console.log('[usePerformance] User ID present:', !!userId);
  //console.log('[usePerformance] React Query key:', ['performance', range, benchmark, userId]);
}

function logPerformanceResponse(data: PerformanceResponse | undefined, error: Error | null) {
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
  
  // Validate inputs
  try {
    validateInputs(range, benchmark);
  } catch (error) {
    //console.error('[usePerformance] Input validation failed:', error);
    // Return error state immediately for invalid inputs
    return {
      data: undefined,
      isLoading: false,
      isError: true,
      error: error as Error,
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
  
  // Default options with extensive debugging
  const queryOptions = {
    enabled: options.enabled !== false && !!user && !!userId,
    staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes default
    refetchOnWindowFocus: options.refetchOnWindowFocus !== undefined ? options.refetchOnWindowFocus : false,
    retry: 3,
    retryDelay: (attemptIndex: number) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
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
      console.log('[usePerformance] 🚀 === QUERY FUNCTION START ===');
      console.log('[usePerformance] - range:', range);
      console.log('[usePerformance] - benchmark:', benchmark);
      console.log('[usePerformance] - userId:', userId);
      
      logPerformanceRequest(range, benchmark, userId);
      
      console.log('[usePerformance] 📡 Making API call...');
      console.log('[usePerformance] API call: front_api_client.front_api_get_performance');
      console.log('[usePerformance] Parameters: period =', range);
      
      try {
        // Use existing API client that already handles JWT authentication
        const response = await front_api_client.front_api_get_performance(range);
        console.log('[usePerformance] ✅ API response received');
        console.log('[usePerformance] Response type:', typeof response);
        console.log('[usePerformance] Response keys:', Object.keys(response || {}));
        
        // === COMPREHENSIVE ERROR HANDLING ===
        if (!response) {
          console.error('[usePerformance] ❌ Response is null or undefined');
          throw new Error('No response received from performance API');
        }
        
        if (typeof response !== 'object') {
          console.error('[usePerformance] ❌ Response is not an object:', typeof response);
          throw new Error('Invalid response format from performance API');
        }
        
        // Type assertion for response object
        const responseObj = response as any;
        
        // Validate response structure
        if (!responseObj.hasOwnProperty('success')) {
          console.error('[usePerformance] ❌ Response missing success field');
          throw new Error('Invalid response structure from performance API');
        }
        
        if (!responseObj.success) {
          console.error('[usePerformance] ❌ API returned success=false');
          console.error('[usePerformance] Error details:', responseObj);
          throw new Error(responseObj.error || 'Performance API returned error');
        }
        
        // === DATA VALIDATION AND SANITIZATION ===
        console.log('[usePerformance] 🔍 Validating and sanitizing response data...');
        
        // Ensure arrays exist and are valid
        const portfolioData = Array.isArray(responseObj.portfolio_performance) ? responseObj.portfolio_performance : [];
        const benchmarkData = Array.isArray(responseObj.benchmark_performance) ? responseObj.benchmark_performance : [];
        
        console.log('[usePerformance] 📊 Portfolio data points:', portfolioData.length);
        console.log('[usePerformance] 📊 Benchmark data points:', benchmarkData.length);
        
        // Sanitize data points to prevent NaN values
        const sanitizeDataPoint = (point: any, index: number, arrayName: string): any => {
          if (!point || typeof point !== 'object') {
            console.warn(`[usePerformance] ⚠️ Invalid ${arrayName} point at index ${index}:`, point);
            return null;
          }
          
          // Ensure date exists and is valid
          if (!point.date || typeof point.date !== 'string') {
            console.warn(`[usePerformance] ⚠️ Invalid date in ${arrayName} point at index ${index}:`, point.date);
            return null;
          }
          
          // Ensure value exists and is numeric
          let value = point.value ?? point.total_value ?? 0;
          if (typeof value === 'string') {
            value = parseFloat(value);
          }
          if (typeof value !== 'number' || isNaN(value)) {
            console.warn(`[usePerformance] ⚠️ Invalid value in ${arrayName} point at index ${index}:`, point.value, point.total_value);
            value = 0;
          }
          
          return {
            date: point.date,
            value: value,
            total_value: value, // Ensure backward compatibility
          };
        };
        
        // Sanitize both arrays
        const sanitizedPortfolioData = portfolioData
          .map((point: any, index: number) => sanitizeDataPoint(point, index, 'portfolio'))
          .filter((point: any) => point !== null);
        
        const sanitizedBenchmarkData = benchmarkData
          .map((point: any, index: number) => sanitizeDataPoint(point, index, 'benchmark'))
          .filter((point: any) => point !== null);
        
        console.log('[usePerformance] ✅ Data sanitization complete');
        console.log('[usePerformance] 📊 Sanitized portfolio points:', sanitizedPortfolioData.length);
        console.log('[usePerformance] 📊 Sanitized benchmark points:', sanitizedBenchmarkData.length);
        
        // === METADATA VALIDATION ===
        const metadata = responseObj.metadata || {};
        const performanceMetrics = responseObj.performance_metrics || {};
        
        // Ensure metadata has required fields
        const validatedMetadata = {
          start_date: metadata.start_date || '',
          end_date: metadata.end_date || '',
          total_points: metadata.total_points || sanitizedPortfolioData.length,
          portfolio_final_value: metadata.portfolio_final_value || 0,
          index_final_value: metadata.index_final_value || 0,
          benchmark_name: metadata.benchmark_name || benchmark,
          calculation_timestamp: metadata.calculation_timestamp || new Date().toISOString(),
          cached: metadata.cached || false,
          cache_date: metadata.cache_date || null,
          no_data: metadata.no_data || false,
          index_only: metadata.index_only || false,
          reason: metadata.reason || '',
          user_guidance: metadata.user_guidance || '',
          chart_type: metadata.chart_type || 'normal',
        };
        
        // Sanitize performance metrics to prevent NaN
        const sanitizeMetric = (value: any, defaultValue: number = 0) => {
          if (typeof value === 'string') {
            value = parseFloat(value);
          }
          if (typeof value !== 'number' || isNaN(value)) {
            return defaultValue;
          }
          return value;
        };
        
        const validatedMetrics = {
          portfolio_start_value: sanitizeMetric(performanceMetrics.portfolio_start_value, 0),
          portfolio_end_value: sanitizeMetric(performanceMetrics.portfolio_end_value, 0),
          portfolio_return_pct: sanitizeMetric(performanceMetrics.portfolio_return_pct, 0),
          index_start_value: sanitizeMetric(performanceMetrics.index_start_value, 0),
          index_end_value: sanitizeMetric(performanceMetrics.index_end_value, 0),
          index_return_pct: sanitizeMetric(performanceMetrics.index_return_pct, 0),
          outperformance_pct: sanitizeMetric(performanceMetrics.outperformance_pct, 0),
          absolute_outperformance: sanitizeMetric(performanceMetrics.absolute_outperformance, 0),
        };
        
        // Build final validated response
        const validatedResponse: PerformanceResponse = {
          success: true,
          period: responseObj.period || range,
          benchmark: responseObj.benchmark || benchmark,
          portfolio_performance: sanitizedPortfolioData,
          benchmark_performance: sanitizedBenchmarkData,
          metadata: validatedMetadata,
          performance_metrics: validatedMetrics,
        };
        
        console.log('[usePerformance] ✅ Response validation complete');
        console.log('[usePerformance] 📊 Final response structure validated');
        
        return validatedResponse;
        
      } catch (error) {
        console.error('[usePerformance] ❌ Error in query function:', error);
        throw error;
      }
    },
    ...queryOptions
  });
  
  // Extract query state with debugging
  const { data, isLoading, isError, error, refetch, isSuccess } = query;
  
  console.log('[usePerformance] 📊 Query state:');
  console.log('[usePerformance] - isLoading:', isLoading);
  console.log('[usePerformance] - isError:', isError);
  console.log('[usePerformance] - isSuccess:', isSuccess);
  console.log('[usePerformance] - hasData:', !!data);
  console.log('[usePerformance] - error:', error?.message);
  
  // Process data with extensive debugging
  console.log('[usePerformance] 🔍 === DATA PROCESSING DEBUG ===');
  console.log('[usePerformance] - data object:', data);
  console.log('[usePerformance] - data type:', typeof data);
  console.log('[usePerformance] - data keys:', data ? Object.keys(data) : 'no data');
  console.log('[usePerformance] - data.portfolio_performance:', data?.portfolio_performance);
  console.log('[usePerformance] - data.benchmark_performance:', data?.benchmark_performance);
  console.log('[usePerformance] - data.performance_metrics:', data?.performance_metrics);
  
  const portfolioData: PerformanceDataPoint[] = data?.portfolio_performance || [];
  const benchmarkData: PerformanceDataPoint[] = data?.benchmark_performance || [];
  const metrics: PerformanceMetrics | undefined = data?.performance_metrics;
  
  console.log('[usePerformance] 📈 Processed data:');
  console.log('[usePerformance] - Portfolio data points:', portfolioData.length);
  console.log('[usePerformance] - Benchmark data points:', benchmarkData.length);
  console.log('[usePerformance] - Has metrics:', !!metrics);
  console.log('[usePerformance] 🔍 === END DATA PROCESSING DEBUG ===');
  
  if (portfolioData.length > 0) {
    //console.log('[usePerformance] - Portfolio sample data:', portfolioData.slice(0, 3));
    //console.log('[usePerformance] - Portfolio final value:', portfolioData[portfolioData.length - 1]?.total_value);
  }
  
  if (benchmarkData.length > 0) {
    //console.log('[usePerformance] - Benchmark sample data:', benchmarkData.slice(0, 3));
    //console.log('[usePerformance] - Benchmark final value:', benchmarkData[benchmarkData.length - 1]?.total_value);
  }
  
  //console.log('[usePerformance] === HOOK RESULT READY ===');
  
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
  //console.log('[usePerformanceComparison] 🔄 Multi-benchmark comparison starting...');
  
  // Get data for multiple benchmarks
  const spyData = usePerformance(range, 'SPY', options);
  const qqqData = usePerformance(range, 'QQQ', { ...options, enabled: false }); // Disabled by default
  
  //console.log('[usePerformanceComparison] 📊 Comparison data:');
  //console.log('[usePerformanceComparison] - SPY loading:', spyData.isLoading);
  //console.log('[usePerformanceComparison] - QQQ loading:', qqqData.isLoading);
  
  return {
    spy: spyData,
    qqq: qqqData,
    // Add helper function to switch active benchmark
    switchBenchmark: (benchmark: BenchmarkTicker) => {
      console.log('[usePerformanceComparison] 🔄 Switching to benchmark:', benchmark);
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
  
  //console.log('[usePerformanceMetrics] 📊 Metrics-only hook result:');
  //console.log('[usePerformanceMetrics] - Has metrics:', !!metrics);
  //console.log('[usePerformanceMetrics] - Loading:', isLoading);
  //console.log('[usePerformanceMetrics] - Error:', isError);
  
  return { metrics, isLoading, isError };
}