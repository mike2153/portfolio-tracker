import { Suspense } from 'react';
import { DashboardProvider } from './contexts/DashboardContext';

import KPIGrid from './components/KPIGrid';
import DailyMovers from './components/DailyMovers';
import FxTicker from './components/FxTicker';
import { ChartSkeleton, ListSkeleton, FxTickerSkeleton } from './components/Skeletons';
import PortfolioChartApex from './components/PortfolioChartApex'
import AllocationTableApex from './components/AllocationTableApex'
import DividendChartApex from './components/DividendChartApex'

export const revalidate = 60; // Revalidate data every 60 seconds

export default function DashboardPage() {

  return (
    <DashboardProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">My Portfolio</h1>
          {/* Add top right controls here */}
        </div>

        <KPIGrid />

        <Suspense fallback={<ChartSkeleton />}>
          <AllocationTableApex />
        </Suspense>

        <Suspense fallback={<FxTickerSkeleton />}>
          <FxTicker />
        </Suspense>
        
        <Suspense fallback={<ChartSkeleton />}>
          <PortfolioChartApex />
        </Suspense>

        <Suspense fallback={<ListSkeleton title="Daily movers" />}>
          <DailyMovers />
        </Suspense>
      </div>
    </DashboardProvider>
  );
}
