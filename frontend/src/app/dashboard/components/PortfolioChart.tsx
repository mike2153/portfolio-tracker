'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { front_api_client } from '@/lib/front_api_client';
import debug from '../../../lib/debug'
import { ChartSkeleton } from './Skeletons'
import { useDashboard } from '../contexts/DashboardContext'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

const ranges = ['1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'ALL']
const benchmarks = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'Nasdaq' },
  { symbol: 'DIA', name: 'Dow Jones' },
]

type Mode = 'value' | 'performance'
type PerfPoint = { total_value: number; indexed_performance: number; date: string };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function PortfolioChart() {
  debug('[PortfolioChart] Component mounting...');
  
  const { 
    selectedPeriod, 
    setSelectedPeriod,
    selectedBenchmark,
    setSelectedBenchmark,
    setPerformanceData,
    setIsLoadingPerformance,
    userId
  } = useDashboard();
  
  const [mode, setMode] = useState<Mode>('value')

  debug('[PortfolioChart] Component state:', { userId, selectedPeriod: selectedPeriod, mode, selectedBenchmark: selectedBenchmark });

  const { data, isLoading, error } = useQuery<any, Error>({
    queryKey: ['portfolioPerformance', userId, selectedPeriod, selectedBenchmark],
    queryFn: async () => {
      console.log(`[PortfolioChart] Making API call for period: ${selectedPeriod}`);
      // This now correctly uses the central API client which hits /api/dashboard/performance
      const result = await front_api_client.front_api_get_performance(selectedPeriod);
      console.log(`[PortfolioChart] API response for period ${selectedPeriod}:`, result);
      return result;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  debug('[PortfolioChart] Query state:', { data, isLoading, error });

  // The APIResponse structure is { ok, message, data: { ...performanceData } }
  const perfRaw = (data?.data as any)?.data ?? (data?.data as any) ?? {};
  console.log('[PortfolioChart] Raw API payload:', perfRaw);

  const perf = perfRaw ? {
    portfolioPerformance: perfRaw.portfolio_performance || perfRaw.portfolioPerformance || [],
    benchmarkPerformance: perfRaw.benchmark_performance || perfRaw.benchmarkPerformance || [],
    benchmark_name: perfRaw.benchmark_name || perfRaw.benchmarkName || selectedBenchmark,
  } : undefined;
  console.log('[PortfolioChart] Transformed perf:', perf);

  const portfolio: PerfPoint[] = (perf?.portfolioPerformance as any[]) || [];
  console.log('[PortfolioChart] portfolioPerformance length:', portfolio.length);
  const benchmarkPerformance: PerfPoint[] = (perf?.benchmarkPerformance as any[]) || [];
  console.log('[PortfolioChart] benchmarkPerformance length:', benchmarkPerformance.length);
  
  debug('[PortfolioChart] Sample portfolio data:', portfolio.slice(0, 3));
  debug('[PortfolioChart] Sample benchmark data:', benchmarkPerformance.slice(0, 3));

  const portfolioY = mode === 'value'
    ? portfolio.map((p) => p.total_value)
    : portfolio.map((p) => p.indexed_performance);

  const benchmarkY = mode === 'value'
    ? benchmarkPerformance.map((b) => b.total_value)
    : benchmarkPerformance.map((b) => b.indexed_performance);

  // Removed excessive console logging for performance

  // Update context when we have performance data - use useMemo to prevent infinite loops
  useEffect(() => {
    if (perf && portfolio.length > 0 && benchmarkPerformance.length > 0) {
      setPerformanceData({
        portfolioPerformance: portfolio,
        benchmarkPerformance: benchmarkPerformance,
        comparison: perfRaw?.comparison
      });
    }
  }, [data?.ok, portfolio.length, benchmarkPerformance.length, perfRaw?.comparison, setPerformanceData]);

  return (
    <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Portfolio Performance</h3>
        <div className="space-x-1">
          {ranges.map(r => (
            <button
              key={r}
              onClick={() => setSelectedPeriod(r)}
              className={`px-2 py-1 text-xs rounded-md ${selectedPeriod === r ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2">
        <select
          value={selectedBenchmark}
          onChange={e => setSelectedBenchmark(e.target.value)}
          className="px-2 py-1 text-xs rounded-md bg-gray-700 text-white"
        >
          {benchmarks.map(b => (
            <option key={b.symbol} value={b.symbol}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2 space-x-2">
        <button
          onClick={() => setMode('value')}
          className={`px-2 py-1 text-xs rounded-md ${mode === 'value' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'}`}
        >
          Value
        </button>
        <button
          onClick={() => setMode('performance')}
          className={`px-2 py-1 text-xs rounded-md ${mode === 'performance' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'}`}
        >
          % Change
        </button>
      </div>
      {isLoading ? (
        <ChartSkeleton />
      ) : (
        <Plot
          data={[
            {
              x: portfolio.map(p => p.date),
              y: portfolioY,
              type: 'scatter',
              mode: 'lines',
              name: 'Portfolio',
              line: { color: '#3B82F6' }
            },
            {
              x: benchmarkPerformance.map(p => p.date),
              y: benchmarkY,
              type: 'scatter',
              mode: 'lines',
              name: perf?.benchmark_name || 'Benchmark',
              line: { color: '#A78BFA' }
            }
          ]}
          layout={{
            autosize: true,
            margin: { t: 20, r: 10, b: 40, l: 40 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            transition: { duration: 500, easing: 'cubic-in-out' },
            xaxis: { color: '#d1d5db' },
            yaxis: { color: '#d1d5db', title: mode === 'value' ? 'Value' : '%' }
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '400px' }}
        />
      )}
    </div>
  )
}
