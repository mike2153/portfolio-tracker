'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import debug from '../../../lib/debug'

// === IMPORT VERIFICATION ===
console.log('[PORTFOLIO_CHART] 🔍 Import verification at:', new Date().toISOString());
console.log('[PORTFOLIO_CHART] 📦 debug import type:', typeof debug);
console.log('[PORTFOLIO_CHART] 🧪 debug function test:');
if (typeof debug === 'function') {
  console.log('[PORTFOLIO_CHART] ✅ debug is a function, testing call...');
  try {
    debug('[PORTFOLIO_CHART] 🎉 Debug function import successful!');
    console.log('[PORTFOLIO_CHART] ✅ Debug function call successful!');
  } catch (error) {
    console.error('[PORTFOLIO_CHART] ❌ Debug function call failed:', error);
  }
} else {
  console.error('[PORTFOLIO_CHART] ❌ debug is not a function! Type:', typeof debug, 'Value:', debug);
}

import { ChartSkeleton } from './Skeletons'
import { useDashboard } from '../contexts/DashboardContext'
import { usePerformance, type RangeKey, type BenchmarkTicker } from '@/hooks/usePerformance'

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

// === CONFIGURATION ===
const ranges: RangeKey[] = ['7D', '1M', '3M', '1Y', 'YTD', 'MAX']
const benchmarks: Array<{ symbol: BenchmarkTicker; name: string }> = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'Nasdaq' },
  { symbol: 'A200', name: 'ASX 200' },
  { symbol: 'URTH', name: 'World' },
  { symbol: 'VTI', name: 'Total Stock Market' },
  { symbol: 'VXUS', name: 'International' },
]

type DisplayMode = 'value' | 'percentage'

interface PortfolioChartProps {
  defaultRange?: RangeKey;
  defaultBenchmark?: BenchmarkTicker;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function PortfolioChart({ 
  defaultRange = '1Y', 
  defaultBenchmark = 'SPY' 
}: PortfolioChartProps = {}) {
  console.log('[PortfolioChart] === ENHANCED PORTFOLIO CHART START ===');
  console.log('[PortfolioChart] Component mounting with props:', { defaultRange, defaultBenchmark });
  console.log('[PortfolioChart] Timestamp:', new Date().toISOString());
  
  // === STATE MANAGEMENT ===
  const [selectedRange, setSelectedRange] = useState<RangeKey>(defaultRange);
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkTicker>(defaultBenchmark);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('value');
  
  console.log('[PortfolioChart] 📊 Component state:');
  console.log('[PortfolioChart] - Selected range:', selectedRange);
  console.log('[PortfolioChart] - Selected benchmark:', selectedBenchmark);
  console.log('[PortfolioChart] - Display mode:', displayMode);
  
  // === DATA FETCHING ===
  const {
    data: performanceData,
    isLoading,
    isError,
    error,
    portfolioData,
    benchmarkData,
    metrics,
    refetch,
    isSuccess
  } = usePerformance(selectedRange, selectedBenchmark, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  
  console.log('[PortfolioChart] 🔄 Performance hook state:');
  console.log('[PortfolioChart] - Loading:', isLoading);
  console.log('[PortfolioChart] - Error:', isError);
  console.log('[PortfolioChart] - Success:', isSuccess);
  console.log('[PortfolioChart] - Has data:', !!performanceData);
  console.log('[PortfolioChart] - Portfolio points:', portfolioData.length);
  console.log('[PortfolioChart] - Benchmark points:', benchmarkData.length);
  console.log('[PortfolioChart] - Has metrics:', !!metrics);
  
  if (error) {
    console.error('[PortfolioChart] ❌ Performance data error:', error.message);
  }
  
  // === DASHBOARD CONTEXT INTEGRATION ===
  const { 
    setPerformanceData,
    setIsLoadingPerformance 
  } = useDashboard();
  
  // Update dashboard context when performance data changes
  useEffect(() => {
    console.log('[PortfolioChart] 🔄 Updating dashboard context...');
    console.log('[PortfolioChart] - Loading state:', isLoading);
    console.log('[PortfolioChart] - Has portfolio data:', portfolioData.length > 0);
    console.log('[PortfolioChart] - Has benchmark data:', benchmarkData.length > 0);
    
    setIsLoadingPerformance(isLoading);
    
    if (portfolioData.length > 0 && benchmarkData.length > 0) {
      console.log('[PortfolioChart] ✅ Setting performance data in dashboard context');
      setPerformanceData({
        portfolioPerformance: portfolioData,
        benchmarkPerformance: benchmarkData,
        comparison: metrics ? {
          portfolio_return: metrics.portfolio_return_pct,
          benchmark_return: metrics.index_return_pct,
          outperformance: metrics.outperformance_pct
        } : undefined
      });
    } else {
      console.log('[PortfolioChart] ⚠️ No data available for dashboard context');
    }
  }, [isLoading, portfolioData, benchmarkData, metrics, setPerformanceData, setIsLoadingPerformance]);

  // === CHART DATA PROCESSING ===
  console.log('[PortfolioChart] 📊 Processing chart data...');
  console.log('[PortfolioChart] - Display mode:', displayMode);
  console.log('[PortfolioChart] - Portfolio data points:', portfolioData.length);
  console.log('[PortfolioChart] - Benchmark data points:', benchmarkData.length);
  
  // Calculate percentage returns from initial values
  const calculatePercentageReturns = (data: Array<{ date: string; total_value: number }>) => {
    console.log('[PortfolioChart] 📊 calculatePercentageReturns called with data length:', data.length);
    if (data.length === 0) {
      console.log('[PortfolioChart] ⚠️ No data points for percentage calculation');
      return [];
    }
    
    const initialValue = data[0].total_value;
    console.log('[PortfolioChart] 📊 Initial value for percentage calculation:', initialValue);
    
    if (initialValue === 0) {
      console.log('[PortfolioChart] ⚠️ Initial value is zero, returning zero array');
      return data.map(() => 0);
    }
    
    const percentageReturns = data.map(point => {
      const returnValue = ((point.total_value - initialValue) / initialValue) * 100;
      return returnValue;
    });
    
    console.log('[PortfolioChart] 📊 Percentage returns calculated:');
    console.log('[PortfolioChart] - First return:', percentageReturns[0]);
    console.log('[PortfolioChart] - Last return:', percentageReturns[percentageReturns.length - 1]);
    console.log('[PortfolioChart] - Sample values:', percentageReturns.slice(0, 5));
    
    return percentageReturns;
  };
  
  const portfolioPercentReturns = calculatePercentageReturns(portfolioData);
  const benchmarkPercentReturns = calculatePercentageReturns(benchmarkData);
  
  console.log('[PortfolioChart] 📈 Calculated percentage returns:');
  console.log('[PortfolioChart] - Portfolio data length:', portfolioData.length);
  console.log('[PortfolioChart] - Benchmark data length:', benchmarkData.length);
  console.log('[PortfolioChart] - Portfolio percent returns length:', portfolioPercentReturns.length);
  console.log('[PortfolioChart] - Benchmark percent returns length:', benchmarkPercentReturns.length);
  console.log('[PortfolioChart] - Portfolio final return:', portfolioPercentReturns[portfolioPercentReturns.length - 1] || 0);
  console.log('[PortfolioChart] - Benchmark final return:', benchmarkPercentReturns[benchmarkPercentReturns.length - 1] || 0);
  
  // Debug: Log raw data for troubleshooting
  if (portfolioData.length > 0) {
    console.log('[PortfolioChart] 📊 Portfolio data sample:', portfolioData.slice(0, 3));
    console.log('[PortfolioChart] 📊 Portfolio first value:', portfolioData[0].total_value);
    console.log('[PortfolioChart] 📊 Portfolio last value:', portfolioData[portfolioData.length - 1].total_value);
  }
  
  if (benchmarkData.length > 0) {
    console.log('[PortfolioChart] 📊 Benchmark data sample:', benchmarkData.slice(0, 3));
    console.log('[PortfolioChart] 📊 Benchmark first value:', benchmarkData[0].total_value);
    console.log('[PortfolioChart] 📊 Benchmark last value:', benchmarkData[benchmarkData.length - 1].total_value);
  }
  
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Format percentage values
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };
  
  // === EVENT HANDLERS ===
  const handleRangeChange = (newRange: RangeKey) => {
    console.log('[PortfolioChart] 🔄 Range changed from', selectedRange, 'to', newRange);
    setSelectedRange(newRange);
  };
  
  const handleBenchmarkChange = (newBenchmark: string) => {
    console.log('[PortfolioChart] 🔄 Benchmark changed from', selectedBenchmark, 'to', newBenchmark);
    setSelectedBenchmark(newBenchmark as BenchmarkTicker);
  };
  
  const handleDisplayModeChange = (newMode: DisplayMode) => {
    console.log('[PortfolioChart] 🔄 Display mode changed from', displayMode, 'to', newMode);
    setDisplayMode(newMode);
  };
  
  // === RENDER ===
  console.log('[PortfolioChart] 🎨 Rendering component...');
  
  return (
    <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
      {/* Header with title and range selection */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Portfolio vs Benchmark</h3>
          {metrics && (
            <div className="text-sm text-gray-400 mt-1">
              Portfolio: {formatPercentage(metrics.portfolio_return_pct)} | 
              {' '}{selectedBenchmark}: {formatPercentage(metrics.index_return_pct)} | 
              {' '}Outperformance: {formatPercentage(metrics.outperformance_pct)}
            </div>
          )}
        </div>
        <div className="space-x-1">
          {ranges.map(range => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                selectedRange === range 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      {/* Controls row */}
      <div className="flex items-center justify-between mb-4">
        {/* Benchmark selection */}
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-400">Benchmark:</label>
          <select
            value={selectedBenchmark}
            onChange={e => handleBenchmarkChange(e.target.value)}
            className="px-2 py-1 text-xs rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {benchmarks.map(benchmark => (
              <option key={benchmark.symbol} value={benchmark.symbol}>
                {benchmark.symbol} - {benchmark.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Display mode toggle */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleDisplayModeChange('value')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              displayMode === 'value' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            $ Value
          </button>
          <button
            onClick={() => handleDisplayModeChange('percentage')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              displayMode === 'percentage' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            % Return
          </button>
        </div>
      </div>
      
      {/* Chart content */}
      {isLoading ? (
        <ChartSkeleton />
      ) : isError ? (
        <div className="flex items-center justify-center h-96 text-red-400">
          <div className="text-center">
            <p className="text-lg font-semibold">Failed to load chart data</p>
            <p className="text-sm mt-2">{error?.message || 'Unknown error occurred'}</p>
            <button 
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : portfolioData.length === 0 ? (
        <div className="flex items-center justify-center h-96 text-gray-400">
          <div className="text-center">
            <p className="text-lg font-semibold">No data available</p>
            <p className="text-sm mt-2">Add some transactions to see your portfolio performance</p>
          </div>
        </div>
      ) : (
        <Plot
          data={(() => {
            // Create chart data with extensive debugging
            console.log('[PortfolioChart] 📊 Creating plot data...');
            console.log('[PortfolioChart] - Display mode:', displayMode);
            console.log('[PortfolioChart] - Portfolio data points:', portfolioData.length);
            console.log('[PortfolioChart] - Benchmark data points:', benchmarkData.length);
            
            const portfolioTrace = {
              x: portfolioData.map(p => p.date),
              y: displayMode === 'value' 
                ? portfolioData.map(p => p.total_value)
                : portfolioPercentReturns,
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Your Portfolio',
              line: { 
                color: '#10b981', // emerald-500
                width: 2 
              },
              hovertemplate: displayMode === 'value'
                ? '<b>Portfolio</b><br>Date: %{x}<br>Value: %{y:$,.0f}<extra></extra>'
                : '<b>Portfolio</b><br>Date: %{x}<br>Return: %{y:.2f}%<extra></extra>',
              visible: true  // Ensure portfolio line is always visible
            };
            
            const benchmarkTrace = {
              x: benchmarkData.map(b => b.date),
              y: displayMode === 'value' 
                ? benchmarkData.map(b => b.total_value)
                : benchmarkPercentReturns,
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: `${selectedBenchmark} Index`,
              line: { 
                color: '#9ca3af', // gray-400
                width: 2,
                dash: 'dot'
              },
              hovertemplate: displayMode === 'value'
                ? `<b>${selectedBenchmark}</b><br>Date: %{x}<br>Value: %{y:$,.0f}<extra></extra>`
                : `<b>${selectedBenchmark}</b><br>Date: %{x}<br>Return: %{y:.2f}%<extra></extra>`,
              visible: benchmarkData.length > 0  // Only show if benchmark data exists
            };
            
            console.log('[PortfolioChart] 📊 Portfolio trace data:');
            console.log('[PortfolioChart] - X points:', portfolioTrace.x.length);
            console.log('[PortfolioChart] - Y points:', portfolioTrace.y.length);
            console.log('[PortfolioChart] - Y sample:', portfolioTrace.y.slice(0, 5));
            
            console.log('[PortfolioChart] 📊 Benchmark trace data:');
            console.log('[PortfolioChart] - X points:', benchmarkTrace.x.length);
            console.log('[PortfolioChart] - Y points:', benchmarkTrace.y.length);
            console.log('[PortfolioChart] - Y sample:', benchmarkTrace.y.slice(0, 5));
            console.log('[PortfolioChart] - Benchmark visible:', benchmarkTrace.visible);
            
            // Filter out traces with no data to avoid empty lines
            const traces = [];
            
            // Always include portfolio trace if it has data
            if (portfolioData.length > 0) {
              traces.push(portfolioTrace);
              console.log('[PortfolioChart] ✅ Portfolio trace added to chart');
            } else {
              console.log('[PortfolioChart] ⚠️ Portfolio trace skipped - no data');
            }
            
            // Include benchmark trace only if it has data
            if (benchmarkData.length > 0) {
              traces.push(benchmarkTrace);
              console.log('[PortfolioChart] ✅ Benchmark trace added to chart');
            } else {
              console.log('[PortfolioChart] ⚠️ Benchmark trace skipped - no data');
            }
            
            console.log('[PortfolioChart] 📊 Final traces count:', traces.length);
            console.log('[PortfolioChart] 📊 Traces summary:', traces.map(t => ({ name: t.name, points: t.y.length })));
            
            return traces;
          })()}
          layout={{
            autosize: true,
            margin: { t: 20, r: 20, b: 40, l: 60 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#d1d5db', size: 12 },
            showlegend: true,
            legend: {
              orientation: 'h',
              x: 0,
              y: 1.02,
              bgcolor: 'transparent',
              bordercolor: 'transparent'
            },
            xaxis: { 
              color: '#d1d5db',
              gridcolor: '#374151',
              showgrid: true,
              tickformat: '%b %d',
              type: 'date'
            },
            yaxis: { 
              color: '#d1d5db',
              gridcolor: '#374151',
              showgrid: true,
              title: {
                text: displayMode === 'value' ? 'Portfolio Value (USD)' : 'Return (%)',
                font: { size: 14 }
              },
              tickformat: displayMode === 'value' ? '$,.0f' : '.1f'
            },
            hovermode: 'x unified',
            transition: { 
              duration: 300, 
              easing: 'cubic-in-out' 
            }
          }}
          config={{ 
            displayModeBar: false, 
            responsive: true,
            doubleClick: 'reset'
          }}
          style={{ width: '100%', height: '400px' }}
        />
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Debug: {portfolioData.length} portfolio points, {benchmarkData.length} benchmark points, 
          Range: {selectedRange}, Benchmark: {selectedBenchmark}, Mode: {displayMode}
        </div>
      )}
    </div>
  )
}
