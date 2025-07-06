import { Suspense } from 'react';
import { DashboardProvider } from './contexts/DashboardContext';

import KPIGrid from './components/KPIGrid';
import AllocationTable from './components/AllocationTable';
import PortfolioChart from './components/PortfolioChart';
import DailyMovers from './components/DailyMovers';
import FxTicker from './components/FxTicker';
import { ChartSkeleton, ListSkeleton, FxTickerSkeleton } from './components/Skeletons';



export const revalidate = 60; // Revalidate data every 60 seconds

export default function DashboardPage() {
  // console.log('[Dashboard] === DASHBOARD PAGE RENDER START ===');
  // console.log('[Dashboard] 🚀 Dashboard page loading at:', new Date().toISOString());
  // console.log('[Dashboard] Environment:', {
  //   NODE_ENV: process.env.NODE_ENV,
  //   NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  //   NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
  //   NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...'
  // });
  // console.log('[Dashboard] Page component starting render...');

  return (
    <DashboardProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">My Portfolio</h1>
          {/* Add top right controls here */}
        </div>

        <KPIGrid />

        <Suspense fallback={<ChartSkeleton />}>
          <AllocationTable />
        </Suspense>

        <Suspense fallback={<FxTickerSkeleton />}>
          <FxTicker />
        </Suspense>
        
        <Suspense fallback={<ChartSkeleton />}>
          <PortfolioChart />
        </Suspense>

        <Suspense fallback={<ListSkeleton title="Daily movers" />}>
          <DailyMovers />
        </Suspense>
      </div>
    </DashboardProvider>
  );
}
