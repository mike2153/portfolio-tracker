'use client'

import { useState, useEffect, useMemo } from 'react'
import ApexChart from '@/components/charts/ApexChart'
import { ChartSkeleton } from './Skeletons'
import { useDashboard } from '../contexts/DashboardContext'
import { usePerformance, type RangeKey, type BenchmarkTicker } from '@/hooks/usePerformance'

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

export default function PortfolioChartApex({ 
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
  
  // Prepare data for ApexChart
  const chartData = useMemo<{ name: string; data: [number, number][]; color: string }[]>(() => {
    console.log('[PortfolioChartApex] Preparing chart data:', {
      portfolioCount: alignedPortfolio?.length || 0,
      benchmarkCount: alignedBenchmark?.length || 0,
      displayMode,
      selectedRange,
      selectedBenchmark
    });

    const getValue = (point: any) => {
      if (!point || typeof point !== 'object') return 0;
      let result = point.value;
      if (result === undefined || result === null) result = point.total_value;
      if (result === undefined || result === null) result = 0;
      if (typeof result === 'string') result = parseFloat(result);
      return isNaN(result) ? 0 : result;
    };
    
    const result = [];
    
    // Portfolio series
    if (alignedPortfolio && alignedPortfolio.length > 0) {
      const portfolioSeries: [number, number][] = alignedPortfolio.map((point, index) => {
        const timestamp = new Date(point.date).getTime();
        const value = displayMode === 'value' ? getValue(point) : 
          (portfolioPercentReturns[index] || 0);
        return [timestamp, value] as [number, number];
      });
      
      result.push({
        name: 'Your Portfolio',
        data: portfolioSeries,
        color: '#10b981'
      });
    }
    
    // Benchmark series
    if (alignedBenchmark && alignedBenchmark.length > 0) {
      const benchmarkSeries: [number, number][] = alignedBenchmark.map((point, index) => {
        const timestamp = new Date(point.date).getTime();
        const value = displayMode === 'value' ? getValue(point) : 
          (benchmarkPercentReturns[index] || 0);
        return [timestamp, value] as [number, number];
      });
      
      result.push({
        name: `${selectedBenchmark} Index`,
        data: benchmarkSeries,
        color: '#9ca3af'
      });
    }
    
    console.log('[PortfolioChartApex] Chart data prepared:', {
      seriesCount: result.length,
      portfolioPoints: result[0]?.data?.length || 0,
      benchmarkPoints: result[1]?.data?.length || 0
    });
    
    return result;
  }, [alignedPortfolio, alignedBenchmark, displayMode, portfolioPercentReturns, benchmarkPercentReturns, selectedBenchmark, selectedRange]);

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
      {isIndexOnly ? (
        // === INDEX-ONLY MODE DISPLAY ===
        <div>
          <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>Showing {selectedBenchmark} Performance Only</strong>
            </p>
            <p className="text-xs text-blue-400 mt-1">
              {userGuidance}
            </p>
          </div>
          
          <ApexChart
            data={[
              {
                name: `${selectedBenchmark} Index`,
                data: benchmarkData?.map(point => {
                  const timestamp = new Date(point.date).getTime();
                  const value = point.value ?? point.total_value ?? 0;
                  return [timestamp, value];
                }) || [],
                color: '#10b981'
              }
            ]}
            type="area"
            height={400}
            yAxisFormatter={displayMode === 'value' ? 
              (value) => `$${value.toLocaleString()}` : 
              (value) => `${value.toFixed(1)}%`}
            tooltipFormatter={displayMode === 'value' ? 
              (value) => `$${value.toLocaleString()}` : 
              (value) => `${value.toFixed(2)}%`}
            showLegend={false}
            isLoading={isLoading}
            error={isError ? error?.message || 'Unknown error occurred' : null}
            onRetry={refetch}
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
        <ApexChart
          data={chartData}
          type="area"
          height={400}
          yAxisFormatter={displayMode === 'value' ? 
            (value) => `$${value.toLocaleString()}` : 
            (value) => `${value.toFixed(1)}%`}
          tooltipFormatter={displayMode === 'value' ? 
            (value) => `$${value.toLocaleString()}` : 
            (value) => `${value.toFixed(2)}%`}
          showLegend={true}
          colors={['#10b981', '#9ca3af']}
          isLoading={isLoading}
          error={isError ? error?.message || 'Unknown error occurred' : null}
          onRetry={refetch}
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