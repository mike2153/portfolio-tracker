import { Suspense } from 'react';
import { DashboardProvider } from './contexts/DashboardContext';

import KPIGrid from './components/KPIGrid';
import FxTicker from './components/FxTicker';
import { FxTickerSkeleton } from './components/Skeletons';
// Removed unused import: PortfolioPerformanceChart
import { LazyAllocationTableApex, LazyPortfolioChartApex, LazyDailyMovers } from './components/LazyComponents'
export const revalidate = 60; // Revalidate data every 60 seconds

export default function DashboardPage() {

  return (
    <div className="min-h-screen relative">

      <div className="container mx-auto px-4 py-2 max-w-7xl relative z-10">
        <DashboardProvider>
          <div className="space-y-4">
            {/* Enhanced Header */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h1 className="section-title mb-1">Dashboard</h1>
                  <p className="text-[#8B949E] text-sm">
                    Real-time overview of your portfolio performance and market insights
                  </p>
                </div>
                {/* Add top right controls here */}
              </div>
            </div>

            <div>
              <KPIGrid />
            </div>

            <div>
              <LazyPortfolioChartApex />
            </div>

            <div>
              <Suspense fallback={<FxTickerSkeleton />}>
                <FxTicker />
              </Suspense>
            </div>
            
            <div>
              <LazyAllocationTableApex />
            </div>

            <div>
              <LazyDailyMovers />
            </div>
          </div>
        </DashboardProvider>
      </div>
    </div>
  );
}
