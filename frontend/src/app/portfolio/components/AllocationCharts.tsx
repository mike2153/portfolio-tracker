'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { usePortfolioAllocation } from '@/hooks/usePortfolioAllocation';
import { Loader2 } from 'lucide-react';

// Dynamic import to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function AllocationCharts() {
  const { data, isLoading, isError, error } = usePortfolioAllocation();

  // Process data for charts
  const { assetData, sectorData, regionData } = useMemo(() => {
    if (!data?.allocations) {
      return { assetData: [], sectorData: [], regionData: [] };
    }

    // Asset allocation data (by symbol)
    const assetData = data.allocations
      .filter(item => item.current_value > 0)
      .sort((a, b) => b.current_value - a.current_value)
      .slice(0, 10) // Top 10 holdings
      .map(item => ({
        label: item.symbol,
        value: item.current_value,
        percent: item.allocation_percent
      }));

    // Aggregate by sector
    const sectorMap = new Map<string, number>();
    data.allocations.forEach(item => {
      if (item.sector && item.current_value > 0) {
        const current = sectorMap.get(item.sector) || 0;
        sectorMap.set(item.sector, current + item.current_value);
      }
    });

    const totalValue = data.summary.total_value;
    const sectorData = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        label: sector,
        value: value,
        percent: (value / totalValue) * 100
      }))
      .sort((a, b) => b.value - a.value);

    // Aggregate by region
    const regionMap = new Map<string, number>();
    data.allocations.forEach(item => {
      if (item.region && item.current_value > 0) {
        const current = regionMap.get(item.region) || 0;
        regionMap.set(item.region, current + item.current_value);
      }
    });

    const regionData = Array.from(regionMap.entries())
      .map(([region, value]) => ({
        label: region,
        value: value,
        percent: (value / totalValue) * 100
      }))
      .sort((a, b) => b.value - a.value);

    return { assetData, sectorData, regionData };
  }, [data]);

  // Chart options generator
  const createChartOptions = (title: string, data: Array<{ label: string; value: number; percent: number }>): ApexOptions => ({
    chart: {
      type: 'donut',
      background: 'transparent',
      animations: {
        enabled: true,
        speed: 800
      }
    },
    labels: data.map(item => item.label),
    series: data.map(item => item.value),
    colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#f97316'],
    dataLabels: {
      enabled: false
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff'
            },
            value: {
              show: true,
              fontSize: '16px',
              fontWeight: 700,
              color: '#ffffff',
              formatter: (val: string) => `$${parseFloat(val).toLocaleString()}`
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '14px',
              fontWeight: 600,
              color: '#8B949E',
              formatter: (w: any) => {
                const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                return `$${total.toLocaleString()}`;
              }
            }
          }
        }
      }
    },
    legend: {
      position: 'bottom',
      labels: {
        colors: '#ffffff'
      },
      formatter: (seriesName: string, opts: any) => {
        const percent = data[opts.seriesIndex]?.percent || 0;
        return `${seriesName}: ${percent.toFixed(1)}%`;
      }
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (value: number) => `$${value.toLocaleString()}`
      }
    },
    stroke: {
      width: 0
    },
    states: {
      hover: {
        filter: {
          type: 'lighten'
        }
      }
    }
  });

  if (isLoading) {
    return (
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Portfolio Allocation</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-[#161B22]/50 p-6 shadow-lg">
              <div className="flex items-center justify-center h-80">
                <Loader2 className="w-8 h-8 animate-spin text-[#8B949E]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Portfolio Allocation</h2>
        <div className="rounded-xl bg-red-800/50 p-6 shadow-lg">
          <p className="text-red-400">Failed to load allocation data: {error?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-white mb-4">Portfolio Allocation</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Asset Allocation Chart */}
        <div className="rounded-xl bg-[#161B22]/50 p-6 shadow-lg">
          <h3 className="text-lg font-medium text-[#8B949E] mb-4">Top Holdings</h3>
          {assetData.length > 0 ? (
            <ReactApexChart
              options={createChartOptions('Asset Allocation', assetData)}
              series={assetData.map(item => item.value)}
              type="donut"
              height={320}
            />
          ) : (
            <div className="flex items-center justify-center h-80 text-[#8B949E]">
              No holdings data available
            </div>
          )}
        </div>

        {/* Sector Allocation Chart */}
        <div className="rounded-xl bg-[#161B22]/50 p-6 shadow-lg">
          <h3 className="text-lg font-medium text-[#8B949E] mb-4">Sector Allocation</h3>
          {sectorData.length > 0 ? (
            <ReactApexChart
              options={createChartOptions('Sector Allocation', sectorData)}
              series={sectorData.map(item => item.value)}
              type="donut"
              height={320}
            />
          ) : (
            <div className="flex items-center justify-center h-80 text-[#8B949E]">
              No sector data available
            </div>
          )}
        </div>

        {/* Region Allocation Chart */}
        <div className="rounded-xl bg-[#161B22]/50 p-6 shadow-lg">
          <h3 className="text-lg font-medium text-[#8B949E] mb-4">Geographic Allocation</h3>
          {regionData.length > 0 ? (
            <ReactApexChart
              options={createChartOptions('Region Allocation', regionData)}
              series={regionData.map(item => item.value)}
              type="donut"
              height={320}
            />
          ) : (
            <div className="flex items-center justify-center h-80 text-[#8B949E]">
              No region data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}