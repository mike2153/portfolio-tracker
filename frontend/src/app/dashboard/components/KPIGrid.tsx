'use client';

import { useQuery } from '@tanstack/react-query';
// Removed unused DashboardOverview import
import KPICard from './KPICard';
import { 
  DashboardAPIResponse,
  AnalyticsAPIResponse,
  TransformedKPIData,
  KPIGridProps,
  DashboardQueryError,
  isDashboardAPIResponse,
  isAnalyticsAPIResponse,
  // formatCurrencyValue,
  // formatPercentageValue
} from '@/types/dashboard';
import { KPIGridSkeleton } from './Skeletons';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '@/components/AuthProvider';
import { front_api_get_dashboard, front_api_get_analytics_summary } from '@/lib/front_api_client';

// Props now imported from centralized types

const KPIGrid = ({ initialData }: KPIGridProps) => {
  const {
    userId,
    portfolioDollarGain,
    portfolioPercentGain,
    selectedBenchmark,
    benchmarkDollarGain,
    benchmarkPercentGain,
    performanceData,
  } = useDashboard();
  const { user } = useAuth();

  const { data: apiData, isLoading, isError, error } = useQuery<DashboardAPIResponse, DashboardQueryError>({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardAPIResponse> => {
      try {
        const result = await front_api_get_dashboard();
        
        // Type guard validation
        if (!isDashboardAPIResponse(result)) {
          throw new DashboardQueryError({
            message: 'Invalid dashboard API response format',
            code: 'INVALID_RESPONSE_FORMAT',
            timestamp: new Date().toISOString()
          });
        }
        
        if (!result.success) {
          throw new Error(result.error || 'API returned an error');
        }
        
        return result;
      } catch (apiError) {
        throw apiError;
      }
    },
    enabled: !!user && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
      return delay;
    },
  });

  // Fetch analytics summary for dividend and IRR data
  const { data: analyticsData } = useQuery<AnalyticsAPIResponse, DashboardQueryError>({
    queryKey: ['analytics-summary'],
    queryFn: async (): Promise<AnalyticsAPIResponse> => {
      try {
        const result = await front_api_get_analytics_summary();
        
        // Type guard validation
        if (!isAnalyticsAPIResponse(result)) {
          throw new DashboardQueryError({
            message: 'Invalid analytics API response format',
            code: 'INVALID_RESPONSE_FORMAT',
            timestamp: new Date().toISOString()
          });
        }
        
        if (!result.success) {
          throw new Error(result.error || 'Analytics API returned an error');
        }
        
        return result;
      } catch (apiError) {
        throw apiError;
      }
    },
    enabled: !!user && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
  });

  const data = apiData || initialData;

  // Transform the dashboard API response to KPI format with strict typing
  const transformedData: TransformedKPIData | null = data ? {
    marketValue: {
      value: data.portfolio?.total_value || 0,
      sub_label: `Cost Basis: $${(data.portfolio?.total_cost || 0).toLocaleString()}`,
      is_positive: (data.portfolio?.total_gain_loss || 0) >= 0
    },
    capitalGains: {
      value: data.portfolio?.total_gain_loss || 0,
      sub_label: `${(data.portfolio?.total_gain_loss_percent || 0).toFixed(2)}%`,
      is_positive: (data.portfolio?.total_gain_loss || 0) >= 0
    },
    irr: {
      value: analyticsData?.data?.irr_percent || 0,
      sub_label: 'Internal Rate of Return',
      is_positive: (analyticsData?.data?.irr_percent || 0) >= 0
    },
    passiveIncome: {
      value: analyticsData?.data?.passive_income_ytd || 0,
      sub_label: `${analyticsData?.data?.dividend_summary?.confirmed_count || 0} dividends YTD`,
      is_positive: true
    }
  } : null;

  // Type-safe error handling
  const typedError = error as DashboardQueryError | undefined;

  if (isLoading) {
    return <KPIGridSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-red-900/20 border border-red-800 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-red-400">Error Loading KPI Data</h3>
        <p className="text-sm text-red-300 mt-2">{typedError?.message || 'Failed to load dashboard data'}</p>
        {typedError?.code && (
          <p className="text-xs text-red-400 mt-1">Error Code: {typedError.code}</p>
        )}
        <p className="text-xs text-red-400 mt-1">Check browser console for detailed debugging info</p>
      </div>
    );
  }

  if (!transformedData) {
    return <KPIGridSkeleton />;
  }

  const _performanceKPIData = performanceData ? {
    value: portfolioDollarGain,
    percentGain: portfolioPercentGain,
    sub_label: `${selectedBenchmark}: ${benchmarkDollarGain.toFixed(2)} (${benchmarkPercentGain.toFixed(2)}%)`,
    is_positive: portfolioDollarGain >= 0
  } : transformedData.capitalGains;

  const dividendValue = analyticsData?.data?.passive_income_ytd || 0;
  const capitalGains = performanceData ? portfolioDollarGain : (data?.portfolio?.total_gain_loss || 0);
  const totalReturnValue = capitalGains + dividendValue;
  const totalReturnData = {
    value: totalReturnValue,
    sub_label: `Capital Gains + Dividends`,
    is_positive: totalReturnValue >= 0
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <KPICard title="Portfolio Value" data={transformedData.marketValue} prefix="" />
      <KPICard 
        title="Capital Gains" 
        data={transformedData.capitalGains} 
        prefix="" 
        showPercentage={true}
        percentValue={(data?.portfolio?.total_gain_loss_percent || 0)}
      />
      <KPICard 
        title="IRR" 
        data={transformedData.irr} 
        prefix="" 
        suffix="%" 
        showValueAsPercent={true}
      />
      <KPICard title="Total Return" data={totalReturnData} prefix="" />
    </div>
  );
};

export default KPIGrid; 