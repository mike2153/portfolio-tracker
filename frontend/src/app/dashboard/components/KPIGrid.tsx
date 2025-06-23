'use client';

import { DashboardOverview } from '@/types/api';
import KPICard from './KPICard';
import { KPIGridSkeleton } from './Skeletons';

interface KPIGridProps {
  initialData?: DashboardOverview;
}

const KPIGrid = ({ initialData }: KPIGridProps) => {
  // TODO: Add client-side fetching with React Query to update data
  const data = initialData;

  if (!data) {
    return <KPIGridSkeleton />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      <KPICard title="Value" data={data.marketValue} prefix="AU$" />
      <KPICard title="Total profit" data={data.totalProfit} prefix="+AU$" />
      <KPICard title="IRR" data={data.irr} suffix="%" />
      <KPICard title="Passive income" data={data.passiveIncome} suffix="%" />
    </div>
  );
};

export default KPIGrid; 