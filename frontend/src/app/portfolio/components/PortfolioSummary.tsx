'use client';

import { useAllocationData } from '@/hooks/useSessionPortfolio';
import KPICard from '@/app/dashboard/components/KPICard';
import { KPIGridSkeleton } from '@/app/dashboard/components/Skeletons';

export default function PortfolioSummary() {
  // Use the portfolio allocation hook which already has cached data
  const { data: allocationData, isLoading } = useAllocationData();

  if (isLoading) {
    return <KPIGridSkeleton />;
  }

  if (!allocationData) {
    return null;
  }

  // Calculate daily change from holdings
  const dailyChange = allocationData.allocations.reduce((sum, holding) => 
    sum + (holding.daily_change || 0), 0
  );
  const dailyChangePercent = allocationData.summary.total_value > 0 
    ? (dailyChange / allocationData.summary.total_value) * 100 
    : 0;

  // Transform data for KPI cards using the allocation data
  const marketValueData = {
    value: allocationData.summary.total_value,
    sub_label: `Cost Basis: $${allocationData.summary.total_cost.toLocaleString()}`,
    is_positive: allocationData.summary.total_gain_loss >= 0
  };

  const capitalGainsData = {
    value: allocationData.summary.total_gain_loss,
    sub_label: `${allocationData.summary.total_gain_loss_percent.toFixed(2)}%`,
    is_positive: allocationData.summary.total_gain_loss >= 0
  };

  // Calculate total return (capital gains + dividends)
  const totalDividends = allocationData.summary.total_dividends || 0;
  const totalReturnValue = allocationData.summary.total_gain_loss + totalDividends;
  const totalReturnData = {
    value: totalReturnValue,
    sub_label: 'Capital Gains + Dividends',
    is_positive: totalReturnValue >= 0
  };

  // Calculate net invested from allocations
  const netInvested = allocationData.summary.total_cost;
  const totalTransactions = allocationData.allocations.length;
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
  const totalReturnPercent = allocationData.summary.total_cost > 0
    ? (totalReturnValue / allocationData.summary.total_cost) * 100
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
          percentValue={allocationData.summary.total_gain_loss_percent}
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