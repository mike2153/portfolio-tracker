'use client';

import { useSessionPortfolio } from '@/hooks/useSessionPortfolio';
import KPICard from '@/app/dashboard/components/KPICard';
import { KPIGridSkeleton } from '@/app/dashboard/components/Skeletons';

export default function PortfolioSummary() {
  // Use the portfolio session hook which already has cached data
  const { portfolioData, performanceData, isLoading } = useSessionPortfolio();

  if (isLoading) {
    return <KPIGridSkeleton />;
  }

  if (!portfolioData) {
    return null;
  }

  // Get daily change from performance data
  const dailyChange = performanceData?.daily_change || 0;
  const dailyChangePercent = performanceData?.daily_change_percent || 0;

  // Transform data for KPI cards using the portfolio data
  const marketValueData = {
    value: portfolioData.total_value,
    sub_label: `Cost Basis: $${portfolioData.total_cost.toLocaleString()}`,
    is_positive: portfolioData.total_gain_loss >= 0
  };

  const capitalGainsData = {
    value: portfolioData.total_gain_loss,
    sub_label: `${portfolioData.total_gain_loss_percent.toFixed(2)}%`,
    is_positive: portfolioData.total_gain_loss >= 0
  };

  // Calculate total return (capital gains + dividends)
  const totalDividends = portfolioData.holdings.reduce((sum, holding) => sum + (holding.dividends_received || 0), 0);
  const totalReturnValue = portfolioData.total_gain_loss + totalDividends;
  const totalReturnData = {
    value: totalReturnValue,
    sub_label: 'Capital Gains + Dividends',
    is_positive: totalReturnValue >= 0
  };

  // Calculate net invested from holdings
  const netInvested = portfolioData.total_cost;
  const totalTransactions = portfolioData.holdings.length;
  const netInvestedData = {
    value: netInvested,
    sub_label: `${totalTransactions} holdings`,
    is_positive: true
  };

  const dailyChangeData = {
    value: dailyChange,
    sub_label: `${dailyChangePercent.toFixed(2)}%`,
    is_positive: dailyChange >= 0
  };

  // Calculate total return percentage
  const totalReturnPercent = portfolioData.total_cost > 0
    ? (totalReturnValue / portfolioData.total_cost) * 100
    : 0;

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-white mb-4">Portfolio Overview</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard title="Portfolio Value" data={marketValueData} prefix="$" />
        <KPICard 
          title="Capital Gains" 
          data={capitalGainsData} 
          prefix="$" 
          showPercentage={true}
          percentValue={portfolioData.total_gain_loss_percent}
        />
        <KPICard 
          title="Total Return" 
          data={totalReturnData} 
          prefix="$" 
          showPercentage={true}
          percentValue={totalReturnPercent}
        />
        <KPICard title="Net Invested" data={netInvestedData} prefix="$" />
        <KPICard 
          title="Daily Change" 
          data={dailyChangeData} 
          prefix="$" 
          showPercentage={true}
          percentValue={dailyChangePercent}
        />
      </div>
    </div>
  );
}