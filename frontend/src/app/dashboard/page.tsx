import { Suspense } from 'react';
import { dashboardAPI } from '@/lib/api';

import KPIGrid from './components/KPIGrid';
import AllocationTable from './components/AllocationTable';
import GainLossCard from './components/GainLossCard';
import DividendChart from './components/DividendChart';
import FxTicker from './components/FxTicker';
import { KPIGridSkeleton, ChartSkeleton, ListSkeleton, FxTickerSkeleton } from './components/Skeletons';

export const revalidate = 60; // Revalidate data every 60 seconds

export default async function DashboardPage() {
  // Fetch initial data on the server
  const overviewDataResult = await dashboardAPI.getOverview();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">My portfolio</h1>
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
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<ListSkeleton title="Top day gainers" />}>
          {/* @ts-expect-error Server Component */}
          <GainLossCard type="gainers" />
        </Suspense>
        <Suspense fallback={<ListSkeleton title="Top day losers" />}>
          {/* @ts-expect-error Server Component */}
          <GainLossCard type="losers" />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Suspense fallback={<ChartSkeleton />}>
            {/* @ts-expect-error Server Component */}
            <DividendChart />
        </Suspense>
      </div>
    </div>
  );
} 