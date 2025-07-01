'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardOverview } from '@/types/api';
import KPICard from './KPICard';
import { KPIGridSkeleton } from './Skeletons';
import debug from '../../../lib/debug';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '@/components/AuthProvider';
import { front_api_get_dashboard } from '@/lib/front_api_client';

interface KPIGridProps {
  initialData?: DashboardOverview;
}

const KPIGrid = ({ initialData }: KPIGridProps) => {
  const { userId } = useDashboard();
  const { user } = useAuth();

  console.log(`🔥 [KPIGrid] === COMPREHENSIVE DEBUG START ===`);
  console.log(`🔥 [KPIGrid] Component rendering. UserID: ${userId}, User present: ${!!user}`);
  console.log(`🔥 [KPIGrid] User email: ${user?.email}`);
  console.log(`🔥 [KPIGrid] Initial data:`, initialData);

  const { data: apiData, isLoading, isError, error } = useQuery<any, Error>({
    queryKey: ['dashboard', 'overview', userId],
    queryFn: async (): Promise<any> => {
      console.log(`🚀 [KPIGrid Query] ================== QUERY FUNCTION START ==================`);
      console.log(`🚀 [KPIGrid Query] UserID: ${userId}, Timestamp: ${new Date().toISOString()}`);
      
      debug('📡 Making API call for dashboard overview using front_api_get_dashboard...');
      debug(`📡 User ID for API call: ${userId}`);
      
      try {
        const result: any = await front_api_get_dashboard();
        console.log(`✅ [KPIGrid Query] API call successful, result:`, result);
        console.log(`✅ [KPIGrid Query] Result type: ${typeof result}`);
        console.log(`✅ [KPIGrid Query] Result keys: ${Object.keys(result || {})}`);
        
        if (!result.success) {
          console.error(`❌ [KPIGrid Query] API returned success=false:`, result);
          throw new Error(result.error || 'API returned an error');
        }
        
        console.log(`🎉 [KPIGrid Query] Backend returned success=true! Full result:`, result);
        console.log(`🎉 [KPIGrid Query] ================== QUERY FUNCTION END ==================`);
        return result;
      } catch (apiError) {
        console.error(`❌ [KPIGrid] front_api_get_dashboard exception:`, apiError);
        console.error(`❌ [KPIGrid] Error details:`, apiError);
        throw apiError;
      }
    },
    enabled: !!user && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
      debug(`⏳ Retry delay: ${delay}ms for attempt ${attemptIndex}`);
      debug(`🔄 Query retry attempt ${attemptIndex} for error: ${error}`);
      return delay;
    },
  });

  console.log(`🔄 [KPIGrid] Query state: isLoading=${isLoading}, isError=${isError}, hasData=${!!apiData}`);
  console.log(`🔄 [KPIGrid] Error:`, error);
  console.log(`🔄 [KPIGrid] Raw API data:`, apiData);

  const data = apiData || initialData;
  console.log(`📊 [KPIGrid] Final data (apiData || initialData):`, data);

  // Transform the dashboard API response to KPI format
  console.log(`🔄 [KPIGrid] Starting data transformation...`);
  console.log(`🔄 [KPIGrid] Raw data for transformation:`, data);
  console.log(`🔄 [KPIGrid] Portfolio data:`, data?.portfolio);
  
  const transformedData = data ? {
    marketValue: {
      value: data.portfolio?.total_value || 0,
      sub_label: 'Total Portfolio Value',
      is_positive: (data.portfolio?.total_gain_loss || 0) >= 0
    },
    totalProfit: {
      value: data.portfolio?.total_gain_loss || 0,
      sub_label: `${(data.portfolio?.total_gain_loss_percent || 0).toFixed(2)}% gain/loss`,
      is_positive: (data.portfolio?.total_gain_loss || 0) >= 0
    },
    irr: {
      value: 0, // IRR calculation would need historical data
      sub_label: 'Internal Rate of Return',
      is_positive: true
    },
    passiveIncome: {
      value: 0, // Dividend data would come from transaction analysis
      sub_label: 'Annual Dividend Yield',
      is_positive: true
    }
  } : null;

  console.log(`🔄 [KPIGrid] Transformation result:`, transformedData);
  
  console.log('[KPIGrid] 🎯 Data validation check:', {
    hasData: !!transformedData,
    hasMarketValue: transformedData?.marketValue ? 'yes' : 'no',
    hasTotalProfit: transformedData?.totalProfit ? 'yes' : 'no',
    hasIRR: transformedData?.irr ? 'yes' : 'no',
    hasPassiveIncome: transformedData?.passiveIncome ? 'yes' : 'no'
  });

  if (isLoading) {
    console.log(`⏳ [KPIGrid] Rendering loading skeleton`);
    return <KPIGridSkeleton />;
  }

  if (isError) {
    console.error(`❌ [KPIGrid] Rendering error state. Error:`, error);
    return (
      <div className="rounded-xl bg-red-800/50 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-red-400">Error Loading KPI Data</h3>
        <p className="text-sm text-red-300 mt-2">{error?.message || 'Failed to load dashboard data'}</p>
        <p className="text-xs text-red-400 mt-1">Check browser console for detailed debugging info</p>
      </div>
    );
  }

  if (!transformedData) {
    console.log(`⚠️ [KPIGrid] No transformed data, showing skeleton`);
    return <KPIGridSkeleton />;
  }
  
  const { portfolioDollarGain, portfolioPercentGain, selectedBenchmark, benchmarkDollarGain, benchmarkPercentGain, performanceData } = useDashboard();
  
  console.log(`📈 [KPIGrid] Dashboard context performance data:`, {
    portfolioDollarGain,
    portfolioPercentGain,
    selectedBenchmark,
    benchmarkDollarGain,
    benchmarkPercentGain,
    performanceData
  });

  const performanceKPIData = performanceData ? {
    value: portfolioDollarGain,
    percentGain: portfolioPercentGain,
    sub_label: `${selectedBenchmark}: ${benchmarkDollarGain.toFixed(2)} (${benchmarkPercentGain.toFixed(2)}%)`,
    is_positive: portfolioDollarGain >= 0
  } : transformedData.totalProfit;

  const dividendValue = transformedData.passiveIncome?.value || 0;
  const totalReturnValue = performanceData ? portfolioDollarGain + Number(dividendValue) : Number(transformedData.totalProfit?.value || 0) + Number(dividendValue);
  const totalReturnData = {
    value: totalReturnValue,
    sub_label: `Capital Gains + Dividends`,
    is_positive: totalReturnValue >= 0
  };

  console.log(`🎨 [KPIGrid] Final KPI data for rendering:`, {
    marketValue: transformedData.marketValue,
    performance: performanceKPIData,
    passiveIncome: transformedData.passiveIncome,
    totalReturn: totalReturnData
  });

  console.log(`🔥 [KPIGrid] === COMPREHENSIVE DEBUG END ===`);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <KPICard title="Portfolio Value" data={transformedData.marketValue} prefix="" />
      <KPICard 
        title="Performance" 
        data={performanceKPIData} 
        prefix="" 
        showPercentage={true}
        percentValue={performanceData ? portfolioPercentGain : undefined}
      />
      <KPICard title="Dividend Yield" data={transformedData.passiveIncome} prefix="" />
      <KPICard title="Total Return" data={totalReturnData} prefix="" />
    </div>
  );
};

export default KPIGrid; 