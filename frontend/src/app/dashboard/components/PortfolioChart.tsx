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
  
  if (error) {
    console.error('[PortfolioChart] ❌ Performance data error:', error.message);
  }
  
  // === INDEX-ONLY MODE HANDLING ===
  console.log('[PortfolioChart] 🎯 === INDEX-ONLY MODE CHECK ===');
  console.log('[PortfolioChart] - isIndexOnly:', isIndexOnly);
  console.log('[PortfolioChart] - userGuidance:', userGuidance);
  console.log('[PortfolioChart] - portfolioData length:', portfolioData?.length);
  console.log('[PortfolioChart] - benchmarkData length:', benchmarkData?.length);
  
  if (isIndexOnly) {
    console.log('[PortfolioChart] 🎯 INDEX-ONLY MODE ACTIVE');
    console.log('[PortfolioChart] - Will show benchmark performance only');
    console.log('[PortfolioChart] - User guidance:', userGuidance);
  }
  
  // === DASHBOARD CONTEXT INTEGRATION ===
  const { 
    setPerformanceData,
    setIsLoadingPerformance 
  } = useDashboard();
  
  // Update dashboard context when performance data changes
  useEffect(() => {
    console.log('[PortfolioChart] 🔄 === DASHBOARD CONTEXT UPDATE DEBUG ===');
    console.log('[PortfolioChart] - Loading state:', isLoading);
    console.log('[PortfolioChart] - portfolioData type:', typeof portfolioData);
    console.log('[PortfolioChart] - portfolioData is array:', Array.isArray(portfolioData));
    console.log('[PortfolioChart] - portfolioData length:', portfolioData?.length);
    console.log('[PortfolioChart] - benchmarkData type:', typeof benchmarkData);
    console.log('[PortfolioChart] - benchmarkData is array:', Array.isArray(benchmarkData));
    console.log('[PortfolioChart] - benchmarkData length:', benchmarkData?.length);
    console.log('[PortfolioChart] - portfolioData first item:', portfolioData?.[0]);
    console.log('[PortfolioChart] - benchmarkData first item:', benchmarkData?.[0]);
    console.log('[PortfolioChart] === END DASHBOARD CONTEXT UPDATE DEBUG ===');
    
    setIsLoadingPerformance(isLoading);
    
    if (portfolioData && portfolioData.length > 0 && benchmarkData && benchmarkData.length > 0) {
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
      console.log('[PortfolioChart] - Portfolio check result:', portfolioData && portfolioData.length > 0);
      console.log('[PortfolioChart] - Benchmark check result:', benchmarkData && benchmarkData.length > 0);
    }
  }, [isLoading, portfolioData, benchmarkData, metrics, setPerformanceData, setIsLoadingPerformance]);

  // === CHART DATA PROCESSING ===
  console.log('[PortfolioChart] 📊 Processing chart data...');
  console.log('[PortfolioChart] - Display mode:', displayMode);
  console.log('[PortfolioChart] - Portfolio data points:', portfolioData.length);
  console.log('[PortfolioChart] - Benchmark data points:', benchmarkData.length);
  
  // === DATE RANGE ALIGNMENT ===
  // Ensure both portfolio and benchmark data cover the same date range
  const alignDataRanges = (portfolioData: any[], benchmarkData: any[]) => {
    console.log('[PortfolioChart] 🔄 === DATE RANGE ALIGNMENT START ===');
    console.log('[PortfolioChart] - Original portfolio points:', portfolioData.length);
    console.log('[PortfolioChart] - Original benchmark points:', benchmarkData.length);
    
    if (portfolioData.length === 0 || benchmarkData.length === 0) {
      console.log('[PortfolioChart] ⚠️ One or both arrays are empty, returning original data');
      return { alignedPortfolio: portfolioData, alignedBenchmark: benchmarkData };
    }
    
    // Get date ranges for both arrays
    const portfolioStartDate = portfolioData[0]?.date;
    const portfolioEndDate = portfolioData[portfolioData.length - 1]?.date;
    const benchmarkStartDate = benchmarkData[0]?.date;
    const benchmarkEndDate = benchmarkData[benchmarkData.length - 1]?.date;
    
    console.log('[PortfolioChart] 📅 Date ranges:');
    console.log('[PortfolioChart] - Portfolio: ', portfolioStartDate, 'to', portfolioEndDate);
    console.log('[PortfolioChart] - Benchmark:', benchmarkStartDate, 'to', benchmarkEndDate);
    
    // Find the overlapping date range (latest start date, earliest end date)
    const alignmentStartDate = portfolioStartDate > benchmarkStartDate ? portfolioStartDate : benchmarkStartDate;
    const alignmentEndDate = portfolioEndDate < benchmarkEndDate ? portfolioEndDate : benchmarkEndDate;
    
    console.log('[PortfolioChart] 🎯 Alignment range:', alignmentStartDate, 'to', alignmentEndDate);
    
    // Filter both arrays to the aligned date range
    const alignedPortfolio = portfolioData.filter(point => 
      point.date >= alignmentStartDate && point.date <= alignmentEndDate
    );
    
    const alignedBenchmark = benchmarkData.filter(point => 
      point.date >= alignmentStartDate && point.date <= alignmentEndDate
    );
    
    console.log('[PortfolioChart] ✅ Aligned data:');
    console.log('[PortfolioChart] - Aligned portfolio points:', alignedPortfolio.length);
    console.log('[PortfolioChart] - Aligned benchmark points:', alignedBenchmark.length);
    console.log('[PortfolioChart] - Portfolio aligned range:', alignedPortfolio[0]?.date, 'to', alignedPortfolio[alignedPortfolio.length - 1]?.date);
    console.log('[PortfolioChart] - Benchmark aligned range:', alignedBenchmark[0]?.date, 'to', alignedBenchmark[alignedBenchmark.length - 1]?.date);
    console.log('[PortfolioChart] 🔄 === DATE RANGE ALIGNMENT END ===');
    
    return { alignedPortfolio, alignedBenchmark };
  };
  
  // Apply date range alignment
  const { alignedPortfolio, alignedBenchmark } = alignDataRanges(portfolioData, benchmarkData);
  
  // Calculate percentage returns from initial values
  const calculatePercentageReturns = (data: Array<{ date: string; value?: number; total_value?: number }>) => {
    console.log('[PortfolioChart] 📊 calculatePercentageReturns called with data length:', data.length);
    if (data.length === 0) {
      console.log('[PortfolioChart] ⚠️ No data points for percentage calculation');
      return [];
    }
    
    // Handle both new (value) and old (total_value) formats
    const getValue = (point: any) => point.value ?? point.total_value ?? 0;
    const initialValue = getValue(data[0]);
    console.log('[PortfolioChart] 📊 Initial value for percentage calculation:', initialValue);
    console.log('[PortfolioChart] 📊 Using data format:', data[0].value !== undefined ? 'new (value)' : 'old (total_value)');
    
    if (initialValue === 0) {
      console.log('[PortfolioChart] ⚠️ Initial value is zero, returning zero array');
      return data.map(() => 0);
    }
    
    const percentageReturns = data.map(point => {
      const currentValue = getValue(point);
      const returnValue = ((currentValue - initialValue) / initialValue) * 100;
      return returnValue;
    });
    
    console.log('[PortfolioChart] 📊 Percentage returns calculated:');
    console.log('[PortfolioChart] - First return:', percentageReturns[0]);
    console.log('[PortfolioChart] - Last return:', percentageReturns[percentageReturns.length - 1]);
    console.log('[PortfolioChart] - Sample values:', percentageReturns.slice(0, 5));
    
    return percentageReturns;
  };
  
  const portfolioPercentReturns = calculatePercentageReturns(alignedPortfolio as any);
  const benchmarkPercentReturns = calculatePercentageReturns(alignedBenchmark as any);
  
  // Debug: Log raw data for troubleshooting
  if (alignedPortfolio.length > 0) {
    console.log('[PortfolioChart] 📊 === ALIGNED PORTFOLIO DATA ANALYSIS ===');
    console.log('[PortfolioChart] 📊 Aligned portfolio data length:', alignedPortfolio.length);
    console.log('[PortfolioChart] 📊 Aligned portfolio data sample:', alignedPortfolio.slice(0, 3));
    console.log('[PortfolioChart] 📊 Aligned portfolio first point full object:', JSON.stringify(alignedPortfolio[0], null, 2));
    console.log('[PortfolioChart] 📊 Aligned portfolio first point keys:', Object.keys(alignedPortfolio[0]));
    console.log('[PortfolioChart] 📊 Aligned portfolio first point values:', Object.values(alignedPortfolio[0]));
    
    // Check each field individually
    const firstPoint = alignedPortfolio[0];
    console.log('[PortfolioChart] 🔍 firstPoint.value:', firstPoint.value, 'type:', typeof firstPoint.value);
    console.log('[PortfolioChart] 🔍 firstPoint.total_value:', firstPoint.total_value, 'type:', typeof firstPoint.total_value);
    console.log('[PortfolioChart] 🔍 firstPoint.date:', firstPoint.date, 'type:', typeof firstPoint.date);
    
    console.log('[PortfolioChart] 📊 === END ALIGNED PORTFOLIO DATA ANALYSIS ===');
  }
  
  if (alignedBenchmark.length > 0) {
    console.log('[PortfolioChart] 📊 Aligned benchmark data sample:', alignedBenchmark.slice(0, 3));
    const getValue = (point: any) => point.value ?? point.total_value ?? 0;
    console.log('[PortfolioChart] 📊 Aligned benchmark first value:', getValue(alignedBenchmark[0]));
    console.log('[PortfolioChart] 📊 Aligned benchmark last value:', getValue(alignedBenchmark[alignedBenchmark.length - 1]));
    console.log('[PortfolioChart] 📊 Aligned benchmark data format:', alignedBenchmark[0].value !== undefined ? 'new (value)' : 'old (total_value)');
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
  
  // Format percentage values with null safety
  const formatPercentage = (value: number | undefined | null) => {
    console.log('[PortfolioChart] 🔢 formatPercentage called with:', value, 'type:', typeof value);
    
    if (value === undefined || value === null || isNaN(value)) {
      console.log('[PortfolioChart] ⚠️ formatPercentage received invalid value, returning fallback');
      return '0.00%';
    }
    
    const numValue = Number(value);
    if (isNaN(numValue)) {
      console.log('[PortfolioChart] ⚠️ formatPercentage could not convert to number, returning fallback');
      return '0.00%';
    }
    
    const result = `${numValue >= 0 ? '+' : ''}${numValue.toFixed(2)}%`;
    console.log('[PortfolioChart] ✅ formatPercentage result:', result);
    return result;
  };
  
  // === EVENT HANDLERS ===
  const handleRangeChange = (newRange: RangeKey) => {
    //console.log('[PortfolioChart] 🔄 Range changed from', selectedRange, 'to', newRange);
    setSelectedRange(newRange);
  };
  
  const handleBenchmarkChange = (newBenchmark: string) => {
    //console.log('[PortfolioChart] 🔄 Benchmark changed from', selectedBenchmark, 'to', newBenchmark);
    setSelectedBenchmark(newBenchmark as BenchmarkTicker);
  };
  
  const handleDisplayModeChange = (newMode: DisplayMode) => {
    //console.log('[PortfolioChart] 🔄 Display mode changed from', displayMode, 'to', newMode);
    setDisplayMode(newMode);
  };
  
  // === RENDER ===
  //console.log('[PortfolioChart] 🎨 Rendering component...');
  
  return (
    <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
      {/* Header with title and range selection */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Portfolio vs Benchmark</h3>
          {(() => {
            console.log('[PortfolioChart] 📊 === METRICS DEBUG ===');
            console.log('[PortfolioChart] - metrics exists:', !!metrics);
            console.log('[PortfolioChart] - metrics object:', metrics);
            if (metrics) {
              console.log('[PortfolioChart] - portfolio_return_pct:', metrics.portfolio_return_pct, 'type:', typeof metrics.portfolio_return_pct);
              console.log('[PortfolioChart] - index_return_pct:', metrics.index_return_pct, 'type:', typeof metrics.index_return_pct);
              console.log('[PortfolioChart] - outperformance_pct:', metrics.outperformance_pct, 'type:', typeof metrics.outperformance_pct);
            }
            console.log('[PortfolioChart] === END METRICS DEBUG ===');
            return null;
          })()}
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
                hovertemplate: `<b>${selectedBenchmark}</b><br>` +
                  'Date: %{x}<br>' +
                  'Value: $%{y:,.2f}<br>' +
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
            {(() => {
              console.log('[PortfolioChart] 🔍 === NO DATA ANALYSIS ===');
              console.log('[PortfolioChart] - performanceData:', performanceData);
              console.log('[PortfolioChart] - metadata:', performanceData?.metadata);
              console.log('[PortfolioChart] - no_data flag:', performanceData?.metadata?.no_data);
              console.log('[PortfolioChart] - isLoading:', isLoading);
              console.log('[PortfolioChart] - isError:', isError);
              console.log('[PortfolioChart] - error:', error);
              return null;
            })()}
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
            // Create chart data with extensive debugging
            console.log('[PortfolioChart] 📊 Creating plot data...');
            console.log('[PortfolioChart] - Display mode:', displayMode);
            console.log('[PortfolioChart] - Aligned portfolio data points:', alignedPortfolio.length);
            console.log('[PortfolioChart] - Aligned benchmark data points:', alignedBenchmark.length);
            
            // Helper to get value from either new or old format with extensive debugging
            const getValue = (point: any, index: number) => {
              // Only log first few points to avoid console spam
              if (index < 5) {
                console.log(`[PortfolioChart] 🔍 getValue called for point ${index}:`, point);
                console.log(`[PortfolioChart] 🔍 point type:`, typeof point);
                console.log(`[PortfolioChart] 🔍 point is object:`, typeof point === 'object' && point !== null);
                console.log(`[PortfolioChart] 🔍 point keys:`, Object.keys(point || {}));
                console.log(`[PortfolioChart] 🔍 point.value:`, point?.value, 'type:', typeof point?.value);
                console.log(`[PortfolioChart] 🔍 point.total_value:`, point?.total_value, 'type:', typeof point?.total_value);
              }
              
              // Ensure we have a valid object
              if (!point || typeof point !== 'object') {
                console.error(`[PortfolioChart] ❌ Invalid point at index ${index}:`, point);
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
              
              if (index < 5) {
                console.log(`[PortfolioChart] 🔍 getValue result for point ${index}:`, result, 'type:', typeof result);
              }
              
              if (isNaN(result)) {
                console.error(`[PortfolioChart] ❌ NaN detected at index ${index}! Point:`, point);
                console.error(`[PortfolioChart] ❌ Available keys:`, Object.keys(point));
                console.error(`[PortfolioChart] ❌ All values:`, Object.values(point));
                return 0;
              }
              
              return result;
            };
            
            const portfolioTrace = {
              x: alignedPortfolio.map(p => p.date),
              y: displayMode === 'value' 
                ? alignedPortfolio.map((p, index) => getValue(p, index))
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
              x: alignedBenchmark.map(b => b.date),
              y: displayMode === 'value' 
                ? alignedBenchmark.map((b, index) => getValue(b, index))
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
            if (alignedPortfolio.length > 0) {
              traces.push(portfolioTrace);
              console.log('[PortfolioChart] ✅ Portfolio trace added to chart');
            } else {
              console.log('[PortfolioChart] ⚠️ Portfolio trace skipped - no data');
            }
            
            // Include benchmark trace only if it has data
            if (alignedBenchmark.length > 0) {
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
