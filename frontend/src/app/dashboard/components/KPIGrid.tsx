'use client';

// Removed unused imports - no longer need useQuery, API functions, or response types
import KPICard from './KPICard';
import { 
  TransformedKPIData,
  KPIGridProps,
} from '@/types/dashboard';
import { KPIGridSkeleton } from './Skeletons';
import { useDashboard } from '../contexts/DashboardContext';
// import { useAuth } from '@/components/AuthProvider'; // Currently unused
// NEW: Import consolidated hooks
import { usePortfolioSummary, usePerformanceData, useDividendData } from '@/hooks/useSessionPortfolio';

// Props now imported from centralized types

const KPIGrid = ({ initialData }: KPIGridProps) => {
  const {
    portfolioDollarGain,
    portfolioPercentGain,
    selectedBenchmark,
    benchmarkDollarGain,
    benchmarkPercentGain,
    performanceData,
  } = useDashboard();

  // NEW: Use consolidated hooks instead of individual API calls
  const {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    isLoading: isPortfolioLoading,
    error: portfolioError
  } = usePortfolioSummary();
  const { data: performanceMetrics, isLoading: isPerformanceLoading } = usePerformanceData();
  const { data: dividendData, isLoading: isDividendLoading } = useDividendData();

  // Consolidate loading states - if any hook is loading, show loading
  const isLoading = isPortfolioLoading || isPerformanceLoading || isDividendLoading;
  const isError = !!portfolioError;
  const error = portfolioError;

  // Use fallback values if consolidated data is not available
  const finalTotalValue = totalValue || initialData?.portfolio?.total_value || 0;
  const finalTotalCost = totalCost || initialData?.portfolio?.total_cost || 0;
  const finalTotalGainLoss = totalGainLoss || initialData?.portfolio?.total_gain_loss || 0;
  const finalTotalGainLossPercent = totalGainLossPercent || initialData?.portfolio?.total_gain_loss_percent || 0;

  // Transform consolidated data to KPI format with strict typing
  const transformedData: TransformedKPIData | null = {
    marketValue: {
      value: finalTotalValue,
      sub_label: `Cost Basis: $${finalTotalCost.toLocaleString()}`,
      is_positive: finalTotalGainLoss >= 0
    },
    capitalGains: {
      value: finalTotalGainLoss,
      sub_label: null,
      is_positive: finalTotalGainLoss >= 0
    },
    irr: {
      value: performanceMetrics?.sharpe_ratio || 0, // Use consolidated performance data
      sub_label: null,
      is_positive: (performanceMetrics?.sharpe_ratio || 0) >= 0
    },
    passiveIncome: {
      value: dividendData?.total_received_ytd || 0, // Use consolidated dividend data
      sub_label: null,
      is_positive: true
    }
  };

  // Type-safe error handling - simplified since consolidated hooks handle errors
  const typedError = error;

  if (isLoading) {
    return <KPIGridSkeleton />;
  }

  if (isError) {
    return (
      <div className="p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#EF4444]/5 via-transparent to-[#EF4444]/5"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 bg-[#EF4444] rounded-full"></div>
            <h3 className="text-lg font-semibold text-[#EF4444]">Error Loading KPI Data</h3>
          </div>
          <p className="text-sm text-[#8B949E] mb-2">{typedError?.message || 'Failed to load portfolio data'}</p>
          <p className="text-xs text-[#EF4444]">Check browser console for detailed debugging info</p>
        </div>
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

  // Calculate total return using consolidated data
  const dividendValue = dividendData?.total_received_ytd || 0;
  const capitalGains = performanceData ? portfolioDollarGain : finalTotalGainLoss;
  const totalReturnValue = capitalGains + dividendValue;
  const totalReturnData = {
    value: totalReturnValue,
    sub_label: null,
    is_positive: totalReturnValue >= 0
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" 
         style={{ perspective: '1000px' }}>
      <div style={{ animationDelay: '0ms' }}>
        <KPICard title="Portfolio Value" data={transformedData.marketValue} prefix="" />
      </div>
      <div style={{ animationDelay: '150ms' }}>
        <KPICard 
          title="Capital Gains" 
          data={transformedData.capitalGains} 
          prefix="" 
          showPercentage={true}
          percentValue={finalTotalGainLossPercent}
        />
      </div>
      <div style={{ animationDelay: '300ms' }}>
        <KPICard 
          title="IRR" 
          data={transformedData.irr} 
          prefix="" 
          suffix="%" 
          showValueAsPercent={true}
        />
      </div>
      <div style={{ animationDelay: '450ms' }}>
        <KPICard title="Total Return" data={totalReturnData} prefix="" />
      </div>
    </div>
  );
};

export default KPIGrid; 