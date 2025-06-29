'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardOverview } from '@/types/api';
import { dashboardAPI } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import KPICard from './KPICard';
import { KPIGridSkeleton } from './Skeletons';
import { debug } from '@/lib/debug';
import { useDashboard } from '../contexts/DashboardContext';

interface KPIGridProps {
  initialData?: DashboardOverview;
}

const KPIGrid = ({ initialData }: KPIGridProps) => {
  // Get dashboard context which includes userId
  const {
    portfolioDollarGain,
    portfolioPercentGain,
    benchmarkDollarGain,
    benchmarkPercentGain,
    selectedBenchmark,
    selectedPeriod,
    isLoadingPerformance,
    performanceData,
    userId // Get userId from context instead of duplicating session fetch
  } = useDashboard();

  const { data: apiData, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', 'overview', userId],
    queryFn: async () => {
      debug('[KPIGrid] 📡 Making API call for dashboard overview...');
      debug('[KPIGrid] 📡 User ID for API call:', userId);
      
      try {
      const result = await dashboardAPI.getOverview();
        //console.log('[KPIGrid] 📡 Raw API result:', result);
        //console.log('[KPIGrid] 📡 API result type:', typeof result);
        //console.log('[KPIGrid] 📡 API result.ok:', result?.ok);
        //console.log('[KPIGrid] 📡 API result.data:', result?.data);
        //console.log('[KPIGrid] 📡 API result.error:', result?.error);
      
      if (!result.ok) {
        //console.error('[KPIGrid] ❌ API call failed:', result.error);
          //console.error('[KPIGrid] ❌ Full error result:', result);
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
      
        //console.log('[KPIGrid] ✅ API call successful, returning result');
      return result;
        
      } catch (fetchError) {
        //console.error('[KPIGrid] ❌ Network/fetch error:', fetchError);
        console.error('[KPIGrid] ❌ Error details:', {
          message: (fetchError as Error).message,
          name: (fetchError as Error).name,
          stack: (fetchError as Error).stack
        });
        throw fetchError;
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      debug(`[KPIGrid] 🔄 Query retry attempt ${failureCount} for error:`, error);
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
      debug(`[KPIGrid] ⏳ Retry delay: ${delay}ms for attempt ${attemptIndex}`);
      return delay;
    }
  });

  //console.log('[KPIGrid] 🎯 Query state:', { isLoading, isError, error, hasApiData: !!apiData, hasInitialData: !!initialData });

  // Use API data if available, fallback to initial data
  const rawData = apiData?.data || initialData;

  // Transform snake_case API fields to camelCase for frontend compatibility
  const data = rawData ? {
    marketValue: (rawData as any).market_value || rawData.marketValue,
    totalProfit: (rawData as any).total_profit || rawData.totalProfit,
    irr: rawData.irr,
    passiveIncome: (rawData as any).passive_income || rawData.passiveIncome
  } : null;

  //console.log('[KPIGrid] 🎯 Raw API data:', rawData);
  //console.log('[KPIGrid] 🔍 Raw data market_value:', (rawData as any)?.market_value);
  //console.log('[KPIGrid] 🔍 Raw data total_profit:', (rawData as any)?.total_profit);
  //console.log('[KPIGrid] 🔍 Raw data passive_income:', (rawData as any)?.passive_income);
  //console.log('[KPIGrid] 🎯 Transformed data:', data);
  //console.log('[KPIGrid] 🔍 Transformed marketValue:', data?.marketValue);
  //console.log('[KPIGrid] 🔍 Transformed totalProfit:', data?.totalProfit);
  console.log('[KPIGrid] 🎯 Data validation check:', {
    hasData: !!data,
    hasMarketValue: data?.marketValue ? 'yes' : 'no',
    hasTotalProfit: data?.totalProfit ? 'yes' : 'no',
    hasIRR: data?.irr ? 'yes' : 'no',
    hasPassiveIncome: data?.passiveIncome ? 'yes' : 'no'
  });

  if (isLoading) {
    //console.log('[KPIGrid] ⏳ Loading data, showing skeleton');
    return <KPIGridSkeleton />;
  }

  if (isError) {
    //console.error('[KPIGrid] ❌ Error loading data:', error);
    return (
      <div className="rounded-xl bg-red-800/50 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-red-400">Error Loading KPI Data</h3>
        <p className="text-sm text-red-300 mt-2">{error?.message || 'Failed to load dashboard data'}</p>
      </div>
    );
  }

  if (!data) {
    //console.log('[KPIGrid] ❌ No data available, showing skeleton');
    return <KPIGridSkeleton />;
  }

  //console.log('[KPIGrid] ✅ Rendering enhanced KPI cards with data structure:');
  //console.log('[KPIGrid]   📈 Portfolio Value (marketValue):', data.marketValue);
  //console.log('[KPIGrid]   📊 Portfolio Beta (totalProfit):', data.totalProfit);
  //console.log('[KPIGrid]   📈 IRR (irr):', data.irr);
  //console.log('[KPIGrid]   💰 Dividend Yield (passiveIncome):', data.passiveIncome);
  
  // Validate each KPI data structure
  const validateKPIData = (kpiData: any, name: string) => {
    //console.log(`[KPIGrid] 🔍 Validating ${name} KPI data:`, kpiData);
    if (!kpiData) {
      //console.warn(`[KPIGrid] ⚠️  ${name} KPI data is null/undefined`);
      return false;
    }
    if (typeof kpiData !== 'object') {
      //console.warn(`[KPIGrid] ⚠️  ${name} KPI data is not an object:`, typeof kpiData);
      return false;
    }
    if (!kpiData.value) {
      //console.warn(`[KPIGrid] ⚠️  ${name} KPI missing value field:`, kpiData);
      return false;
    }
    //console.log(`[KPIGrid] ✅ ${name} KPI validation passed`);
    return true;
  };
  
  validateKPIData(data.marketValue, 'Portfolio Value');
  validateKPIData(data.totalProfit, 'Portfolio Beta');
  validateKPIData(data.irr, 'IRR');
  validateKPIData(data.passiveIncome, 'Dividend Yield');

  // Format values for display
  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    if (absValue >= 1000000) {
      return `${sign}AU$${(absValue / 1000000).toFixed(2)}M`;
    } else if (absValue >= 1000) {
      return `${sign}AU$${(absValue / 1000).toFixed(1)}K`;
    }
    return `${sign}AU$${absValue.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Create performance data with context values
  const performanceKPIData = performanceData ? {
    value: portfolioDollarGain,
    percentGain: portfolioPercentGain,
    sub_label: `${selectedBenchmark}: ${formatCurrency(benchmarkDollarGain)} (${formatPercent(benchmarkPercentGain)})`,
    is_positive: portfolioDollarGain >= 0
  } : data.totalProfit;

  // Calculate total return (performance + dividends)
  const dividendValue = data.passiveIncome?.value || 0;
  const totalReturnValue = performanceData ? portfolioDollarGain + Number(dividendValue) : Number(data.totalProfit?.value || 0) + Number(dividendValue);
  const totalReturnData = {
    value: totalReturnValue,
    sub_label: `Capital Gains + Dividends (${selectedPeriod})`,
    is_positive: totalReturnValue >= 0
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <KPICard title="Portfolio Value" data={data.marketValue} prefix="" />
      <KPICard 
        title="Performance" 
        data={performanceKPIData} 
        prefix="" 
        showPercentage={true}
        percentValue={performanceData ? portfolioPercentGain : undefined}
      />
      <KPICard title="Dividend Yield" data={data.passiveIncome} prefix="" />
      <KPICard title="Total Return" data={totalReturnData} prefix="" />
    </div>
  );
};

export default KPIGrid; 