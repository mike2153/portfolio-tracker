import { Suspense } from 'react';
import { DashboardProvider } from './contexts/DashboardContext';
import GradientText from '@/components/ui/GradientText';

import KPIGrid from './components/KPIGrid';
import FxTicker from './components/FxTicker';
import { FxTickerSkeleton } from './components/Skeletons';
// Removed unused import: PortfolioPerformanceChart
import { LazyAllocationTableApex, LazyPortfolioChartApex, LazyDailyMovers } from './components/LazyComponents'
export const revalidate = 60; // Revalidate data every 60 seconds

export default function DashboardPage() {

  return (
    <DashboardProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <GradientText className="text-2xl font-bold tracking-tight">My Portfolio</GradientText>
          {/* Add top right controls here */}
        </div>

        <KPIGrid />

        <LazyAllocationTableApex />

        <Suspense fallback={<FxTickerSkeleton />}>
          <FxTicker />
        </Suspense>
        
        <LazyPortfolioChartApex />

        <LazyDailyMovers />
      </div>
    </DashboardProvider>
  );
}
