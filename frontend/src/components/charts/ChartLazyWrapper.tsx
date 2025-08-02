'use client';

import React, { Suspense } from 'react';

// Loading component for chart components
const ChartLoadingSpinner = ({ height = 350 }: { height?: number }) => (
  <div 
    className="rounded-xl bg-[#0D1117] border border-[#30363D] p-6 shadow-lg flex items-center justify-center"
    style={{ height }}
  >
    <div className="flex items-center gap-2 text-[#8B949E]">
      <div className="w-6 h-6 border-2 border-[#58A6FF] border-t-transparent rounded-full animate-spin"></div>
      Loading chart...
    </div>
  </div>
);

// Higher-order component for lazy loading charts
export function withChartLazyLoading<P extends Record<string, unknown>>(
  ChartComponent: React.ComponentType<P>,
  displayName: string,
  defaultHeight = 350
) {
  const LazyChart = React.forwardRef<HTMLDivElement, P>((props, ref) => (
    <div ref={ref}>
      <Suspense fallback={<ChartLoadingSpinner height={defaultHeight} />}>
        <ChartComponent {...(props as P)} />
      </Suspense>
    </div>
  ));
  
  LazyChart.displayName = `LazyLoaded${displayName}`;
  return LazyChart;
}

export default ChartLoadingSpinner;