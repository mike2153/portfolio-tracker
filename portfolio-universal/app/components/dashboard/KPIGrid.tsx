import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import KPICard from './KPICard';
import { useDashboard } from '../../../shared/contexts/DashboardContext';
import { useAuth } from '../../../shared/components/AuthProvider';
import { front_api_get_dashboard, front_api_get_analytics_summary } from '../../../shared/api/client';

interface KPIGridProps {
  initialData?: any;
}

const KPIGridSkeleton = () => (
  <View className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
    {[1, 2, 3, 4].map((i) => (
      <View key={i} className="rounded-xl bg-gray-800/50 p-4 h-24">
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    ))}
  </View>
);

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

  const { data: apiData, isLoading, isError, error } = useQuery<any, Error>({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<any> => {
      try {
        const result: any = await front_api_get_dashboard();
        
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
  const { data: analyticsData } = useQuery<any, Error>({
    queryKey: ['analytics-summary'],
    queryFn: async (): Promise<any> => {
      try {
        const result: any = await front_api_get_analytics_summary();
        
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

  // Transform the dashboard API response to KPI format
  const transformedData = data ? {
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

  if (isLoading) {
    return <KPIGridSkeleton />;
  }

  if (isError) {
    return (
      <View className="rounded-xl bg-red-800/50 p-6 shadow-lg">
        <Text className="text-lg font-semibold text-red-400">Error Loading KPI Data</Text>
        <Text className="text-sm text-red-300 mt-2">{error?.message || 'Failed to load dashboard data'}</Text>
        <Text className="text-xs text-red-400 mt-1">Check browser console for detailed debugging info</Text>
      </View>
    );
  }

  if (!transformedData) {
    return <KPIGridSkeleton />;
  }

  const performanceKPIData = performanceData ? {
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
    <View className="flex-row flex-wrap -mx-3">
      <View className="w-full md:w-1/2 xl:w-1/4 px-3 mb-6">
        <KPICard title="Portfolio Value" data={transformedData.marketValue} prefix="$" />
      </View>
      <View className="w-full md:w-1/2 xl:w-1/4 px-3 mb-6">
        <KPICard 
          title="Capital Gains" 
          data={transformedData.capitalGains} 
          prefix="$" 
          showPercentage={true}
          percentValue={(data?.portfolio?.total_gain_loss_percent || 0)}
        />
      </View>
      <View className="w-full md:w-1/2 xl:w-1/4 px-3 mb-6">
        <KPICard 
          title="IRR" 
          data={transformedData.irr} 
          prefix="" 
          suffix="%" 
          showValueAsPercent={true}
        />
      </View>
      <View className="w-full md:w-1/2 xl:w-1/4 px-3 mb-6">
        <KPICard title="Total Return" data={totalReturnData} prefix="$" />
      </View>
    </View>
  );
};

export default KPIGrid;