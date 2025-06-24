import { Suspense } from 'react';
import { dashboardAPI } from '@/lib/api';

import KPIGrid from './components/KPIGrid';
import AllocationTable from './components/AllocationTable';
import PortfolioChart from './components/PortfolioChart';
import DailyMovers from './components/DailyMovers';
import FxTicker from './components/FxTicker';
import { KPIGridSkeleton, ChartSkeleton, ListSkeleton, FxTickerSkeleton } from './components/Skeletons';

export const revalidate = 60; // Revalidate data every 60 seconds

export default async function DashboardPage() {
  // Fetch initial data on the server
  const overviewDataResult = await dashboardAPI.getOverview();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">My portfolio</h1>
        {/* Add top right controls here */}
      </div>

      <KPIGrid initialData={overviewDataResult.ok ? overviewDataResult.data : undefined} />

      <Suspense fallback={<ChartSkeleton />}>
        {/* @ts-expect-error Server Component */}
        <AllocationTable />
      </Suspense>

      <Suspense fallback={<FxTickerSkeleton />}>
        {/* @ts-expect-error Server Component */}
        <FxTicker />
      </Suspense>
      
      <Suspense fallback={<ChartSkeleton />}>
        {/* @ts-expect-error Server Component */}
        <PortfolioChart />
      </Suspense>

      <Suspense fallback={<ListSkeleton title="Daily movers" />}>
        {/* @ts-expect-error Server Component */}
        <DailyMovers />
      </Suspense>
    </div>
  );
}
