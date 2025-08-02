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
      sub_label: `${finalTotalGainLossPercent.toFixed(2)}%`,
      is_positive: finalTotalGainLoss >= 0
    },
    irr: {
      value: performanceMetrics?.sharpe_ratio || 0, // Use consolidated performance data
      sub_label: 'Internal Rate of Return',
      is_positive: (performanceMetrics?.sharpe_ratio || 0) >= 0
    },
    passiveIncome: {
      value: dividendData?.total_received_ytd || 0, // Use consolidated dividend data
      sub_label: `${dividendData?.dividend_count || 0} dividends YTD`,
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
      <div className="rounded-xl bg-red-900/20 border border-red-800 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-red-400">Error Loading KPI Data</h3>
        <p className="text-sm text-red-300 mt-2">{typedError?.message || 'Failed to load portfolio data'}</p>
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

  // Calculate total return using consolidated data
  const dividendValue = dividendData?.total_received_ytd || 0;
  const capitalGains = performanceData ? portfolioDollarGain : finalTotalGainLoss;
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
        percentValue={finalTotalGainLossPercent}
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