'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

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
  defaultRange = 'MAX', 
  defaultBenchmark = 'SPY' 
}: PortfolioChartProps = {}) {
  
  // === STATE MANAGEMENT ===
  const [selectedRange, setSelectedRange] = useState<RangeKey>(defaultRange);
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkTicker>(defaultBenchmark);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('value');
  
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
    isSuccess,
    isIndexOnly,
    userGuidance
  } = usePerformance(selectedRange, selectedBenchmark, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });
  
  // === DASHBOARD CONTEXT INTEGRATION ===
  const { 
    setPerformanceData,
    setIsLoadingPerformance 
  } = useDashboard();
  
  // Update dashboard context when performance data changes
  useEffect(() => {
    setIsLoadingPerformance(isLoading);
    
    if (portfolioData && portfolioData.length > 0 && benchmarkData && benchmarkData.length > 0) {
      setPerformanceData({
        portfolioPerformance: portfolioData,
        benchmarkPerformance: benchmarkData,
        comparison: metrics ? {
          portfolio_return: metrics.portfolio_return_pct,
          benchmark_return: metrics.index_return_pct,
          outperformance: metrics.outperformance_pct
        } : undefined
      });
    }
  }, [isLoading, portfolioData, benchmarkData, metrics, setPerformanceData, setIsLoadingPerformance]);

  // === CHART DATA PROCESSING ===
  // === DATE RANGE ALIGNMENT ===
  // Ensure both portfolio and benchmark data cover the same date range
  const alignDataRanges = (portfolioData: any[], benchmarkData: any[]) => {
    if (portfolioData.length === 0 || benchmarkData.length === 0) {
      return { alignedPortfolio: portfolioData, alignedBenchmark: benchmarkData };
    }
    
    // Get date ranges for both arrays
    const portfolioStartDate = portfolioData[0]?.date;
    const portfolioEndDate = portfolioData[portfolioData.length - 1]?.date;
    const benchmarkStartDate = benchmarkData[0]?.date;
    const benchmarkEndDate = benchmarkData[benchmarkData.length - 1]?.date;
    
    // Find the overlapping date range (latest start date, earliest end date)
    const alignmentStartDate = portfolioStartDate > benchmarkStartDate ? portfolioStartDate : benchmarkStartDate;
    const alignmentEndDate = portfolioEndDate < benchmarkEndDate ? portfolioEndDate : benchmarkEndDate;
    
    // Filter both arrays to the aligned date range
    const alignedPortfolio = portfolioData.filter(point => 
      point.date >= alignmentStartDate && point.date <= alignmentEndDate
    );
    
    const alignedBenchmark = benchmarkData.filter(point => 
      point.date >= alignmentStartDate && point.date <= alignmentEndDate
    );
    
    return { alignedPortfolio, alignedBenchmark };
  };
  
  // Apply date range alignment
  const { alignedPortfolio, alignedBenchmark } = alignDataRanges(portfolioData, benchmarkData);
  
  // Calculate percentage returns from initial values
  const calculatePercentageReturns = (data: Array<{ date: string; value?: number; total_value?: number }>) => {
    if (data.length === 0) {
      return [];
    }
    
    // Handle both new (value) and old (total_value) formats
    const getValue = (point: any) => point.value ?? point.total_value ?? 0;
    const initialValue = getValue(data[0]);
    
    if (initialValue === 0) {
      return data.map(() => 0);
    }
    
    const percentageReturns = data.map(point => {
      const currentValue = getValue(point);
      const returnValue = ((currentValue - initialValue) / initialValue) * 100;
      return returnValue;
    });
    
    return percentageReturns;
  };
  
  const portfolioPercentReturns = calculatePercentageReturns(alignedPortfolio as any);
  const benchmarkPercentReturns = calculatePercentageReturns(alignedBenchmark as any);
  
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Format percentage values with null safety
  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return '0.00%';
    }
    
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return '0.00%';
    }
    
    const result = `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
    return result;
  };
  
  // === EVENT HANDLERS ===
  const handleRangeChange = (newRange: RangeKey) => {
    setSelectedRange(newRange);
  };
  
  const handleBenchmarkChange = (newBenchmark: string) => {
    setSelectedBenchmark(newBenchmark as BenchmarkTicker);
  };
  
  const handleDisplayModeChange = (newMode: DisplayMode) => {
    setDisplayMode(newMode);
  };
  
  // === RENDER ===
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
      ) : isIndexOnly ? (
        // === INDEX-ONLY MODE DISPLAY ===
        <div className="h-96">
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Showing {selectedBenchmark} Performance Only</strong>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {userGuidance}
            </p>
          </div>
          
          <Plot
            data={[
              {
                x: benchmarkData.map(point => point.date),
                                 y: benchmarkData.map(point => {
                   const value = point.value ?? point.total_value ?? 0;
                   return value;
                 }),
                type: 'scatter',
                mode: 'lines',
                name: `${selectedBenchmark} Index`,
                line: { color: '#10b981', width: 2 },
                hovertemplate: `<b style="color: black; font-family: Inter, sans-serif">${selectedBenchmark}</b><br>` +
                  '<span style="color: black; font-family: Inter, sans-serif">Date: %{x}<br>' +
                  'Value: $%{y:,.2f}</span><br>' +
                  '<extra></extra>',
              }
            ]}
            layout={{
              autosize: true,
              margin: { t: 20, r: 20, b: 40, l: 60 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              xaxis: {
                type: 'category',
                showgrid: true,
                gridcolor: '#f3f4f6',
                title: 'Date'
              },
              yaxis: {
                showgrid: true,
                gridcolor: '#f3f4f6',
                title: displayMode === 'value' ? 'Value ($)' : 'Return (%)',
                tickformat: displayMode === 'value' ? ',.0f' : '.1%'
              },
              font: { family: 'Inter, sans-serif' },
              hovermode: 'x unified',
              showlegend: false
            }}
            config={{
              displayModeBar: false,
              responsive: true
            }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : alignedPortfolio.length === 0 ? (
        <div className="flex items-center justify-center h-96 text-gray-400">
          <div className="text-center">
            <p className="text-lg font-semibold">No portfolio data available</p>
                         {performanceData?.metadata?.no_data ? (
               <div className="text-sm mt-2 space-y-1">
                 <p>No portfolio data found for the selected period.</p>
                 <p className="text-xs text-gray-500">
                   This could mean:
                 </p>
                 <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
                   <li>No transactions exist for this time period</li>
                   <li>No historical price data available</li>
                   <li>Portfolio calculation returned empty results</li>
                 </ul>
                 <div className="mt-3 space-y-2">
                   <p className="text-xs text-blue-400">Try these solutions:</p>
                   <div className="flex flex-wrap gap-2">
                     {selectedRange !== 'MAX' && (
                       <button
                         onClick={() => handleRangeChange('MAX')}
                         className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                       >
                         Show All Data
                       </button>
                     )}
                     {selectedRange !== '3M' && (
                       <button
                         onClick={() => handleRangeChange('3M')}
                         className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                       >
                         Try 3 Months
                       </button>
                     )}
                     {selectedRange !== '1M' && (
                       <button
                         onClick={() => handleRangeChange('1M')}
                         className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                       >
                         Try 1 Month
                       </button>
                     )}
                   </div>
                 </div>
               </div>
             ) : (
               <div className="text-sm mt-2 space-y-2">
                 <p>Add some transactions to see your portfolio performance</p>
                 <p className="text-xs text-gray-500">
                   Once you add transactions, your portfolio chart will show here automatically.
                 </p>
               </div>
             )}
          </div>
        </div>
      ) : (
        <Plot
          data={(() => {
            // Helper to get value from either new or old format
            const getValue = (point: any) => {
              // Ensure we have a valid object
              if (!point || typeof point !== 'object') {
                return 0;
              }
              
              // Try to get value with multiple fallbacks
              let result = point.value;
              if (result === undefined || result === null) {
                result = point.total_value;
              }
              if (result === undefined || result === null) {
                result = 0;
              }
              
              // Convert to number if it's a string
              if (typeof result === 'string') {
                result = parseFloat(result);
              }
              
              if (isNaN(result)) {
                return 0;
              }
              
              return result;
            };
            
            const portfolioTrace = {
              x: alignedPortfolio.map(p => p.date),
              y: displayMode === 'value' 
                ? alignedPortfolio.map(p => getValue(p))
                : portfolioPercentReturns,
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Your Portfolio',
              line: { 
                color: '#10b981', // emerald-500
                width: 2 
              },
              hovertemplate: displayMode === 'value'
                ? '<b style="color: black; font-family: Inter, sans-serif">Portfolio</b><br><span style="color: black; font-family: Inter, sans-serif">Date: %{x}<br>Value: %{y:$,.0f}</span><extra></extra>'
                : '<b style="color: black; font-family: Inter, sans-serif">Portfolio</b><br><span style="color: black; font-family: Inter, sans-serif">Date: %{x}<br>Return: %{y:.2f}%</span><extra></extra>',
              visible: true  // Ensure portfolio line is always visible
            };
            
            const benchmarkTrace = {
              x: alignedBenchmark.map(b => b.date),
              y: displayMode === 'value' 
                ? alignedBenchmark.map(b => getValue(b))
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
                ? `<b style="color: black; font-family: Inter, sans-serif">${selectedBenchmark}</b><br><span style="color: black; font-family: Inter, sans-serif">Date: %{x}<br>Value: %{y:$,.0f}</span><extra></extra>`
                : `<b style="color: black; font-family: Inter, sans-serif">${selectedBenchmark}</b><br><span style="color: black; font-family: Inter, sans-serif">Date: %{x}<br>Return: %{y:.2f}%</span><extra></extra>`,
              visible: benchmarkData.length > 0  // Only show if benchmark data exists
            };
            
            // Filter out traces with no data to avoid empty lines
            const traces = [];
            
            // Always include portfolio trace if it has data
            if (alignedPortfolio.length > 0) {
              traces.push(portfolioTrace);
            }
            
            // Include benchmark trace only if it has data
            if (alignedBenchmark.length > 0) {
              traces.push(benchmarkTrace);
            }
            
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
              type: 'category',  // Use categorical instead of date to avoid gap-filling
              tickangle: -45,    // Rotate labels for better readability
              tickmode: 'linear',
              tick0: 0,
              dtick: Math.max(1, Math.floor(alignedPortfolio.length / 10))  // Show ~10 labels max
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
          Debug: {alignedPortfolio.length} aligned portfolio points, {alignedBenchmark.length} aligned benchmark points, 
          Range: {selectedRange}, Benchmark: {selectedBenchmark}, Mode: {displayMode}
        </div>
      )}
    </div>
  )
}
