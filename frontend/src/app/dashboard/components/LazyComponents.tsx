'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton, ListSkeleton } from './Skeletons';

// Lazy load heavy dashboard components
export const LazyPortfolioChartApex = dynamic(() => import('./PortfolioChartApex'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

export const LazyAllocationTableApex = dynamic(() => import('./AllocationTableApex'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

export const LazyDailyMovers = dynamic(() => import('./DailyMovers'), {
  loading: () => <ListSkeleton title="Daily movers" />,
  ssr: false
});

export const LazyDividendChartApex = dynamic(() => import('./DividendChartApex'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

// Analytics components
export const LazyAnalyticsHoldingsTable = dynamic(() => import('../../analytics/components/AnalyticsHoldingsTable'), {
  loading: () => <ListSkeleton title="Holdings Analysis" />,
  ssr: false
});

export const LazyAnalyticsDividendsTab = dynamic(() => import('../../analytics/components/AnalyticsDividendsTabRefactored'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

// Research components
export const LazyFinancialsTabNew = dynamic(() => import('../../research/components/FinancialsTabNew'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

export const LazyNewsTab = dynamic(() => import('../../research/components/NewsTab'), {
  loading: () => <ListSkeleton title="Latest News" />,
  ssr: false
});