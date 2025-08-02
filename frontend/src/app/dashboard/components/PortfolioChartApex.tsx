'use client'

import { useState, useEffect, useMemo } from 'react'
import { ApexChart } from '@/components/charts'
// Removed unused import: ChartSkeleton
import { useDashboard } from '../contexts/DashboardContext'
// Using performance hook for historical data
import { usePerformance } from '@/hooks/usePerformance'

// Temporary types for backward compatibility 
export type RangeKey = '7D' | '1M' | '3M' | '1Y' | 'YTD' | 'MAX';
export type BenchmarkTicker = 'SPY' | 'QQQ' | 'A200' | 'URTH' | 'VTI' | 'VXUS';

// Simple data point interface for portfolio chart (used by usePerformance hook)
interface _PerformanceDataPoint {
  date: string;
  value: number;
  total_value?: number;
}
// Import centralized formatters
import { formatCurrency } from '../../../../../shared/utils/formatters'

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
  // Use performance hook for historical data
  const {
    isLoading,
    isError,
    error,
    refetch,
    portfolioData,
    benchmarkData,
    metrics,
    noData,
    isIndexOnly,
    userGuidance
  } = usePerformance(selectedRange, selectedBenchmark, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Performance data is now available from usePerformance hook
  // portfolioData and benchmarkData are already provided by the hook
  
  // === DASHBOARD CONTEXT INTEGRATION ===
  const { 
    setPerformanceData,
    setIsLoadingPerformance 
  } = useDashboard();
  
  // Update dashboard context when performance data changes
  useEffect(() => {
    setIsLoadingPerformance(isLoading);
    
    if (portfolioData && portfolioData.length > 0) {
      setPerformanceData({
        portfolioPerformance: portfolioData,
        benchmarkPerformance: benchmarkData || [],
        ...(metrics && {
          comparison: {
            portfolio_return: metrics.portfolio_return_pct,
            benchmark_return: metrics.index_return_pct,
            outperformance: metrics.outperformance_pct
          }
        })
      });
    }
  }, [isLoading, portfolioData, benchmarkData, metrics, setPerformanceData, setIsLoadingPerformance]);

  // === OPTIMIZED CHART DATA PROCESSING ===
  // Memoize heavy data processing operations
  const processedChartData = useMemo(() => {
    // Helper function to get value from data point
    const getValue = (point: { value?: number; total_value?: number }) => point.value ?? point.total_value ?? 0;
    
    // Date range alignment with early return for empty data
    const alignDataRanges = (
      portfolioData: Array<{ date: string; value?: number; total_value?: number }>, 
      benchmarkData: Array<{ date: string; value?: number; total_value?: number }>
    ) => {
      if (portfolioData.length === 0 || benchmarkData.length === 0) {
        return { alignedPortfolio: portfolioData, alignedBenchmark: benchmarkData };
      }
      
      // Get date ranges for both arrays
      const portfolioStartDate = portfolioData[0]?.date;
      const portfolioEndDate = portfolioData[portfolioData.length - 1]?.date;
      const benchmarkStartDate = benchmarkData[0]?.date;
      const benchmarkEndDate = benchmarkData[benchmarkData.length - 1]?.date;
      
      // Check if we have valid dates
      if (!portfolioStartDate || !portfolioEndDate || !benchmarkStartDate || !benchmarkEndDate) {
        return { alignedPortfolio: portfolioData, alignedBenchmark: benchmarkData };
      }
      
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
    
    // Calculate percentage returns from initial values
    const calculatePercentageReturns = (data: Array<{ date: string; value?: number; total_value?: number }>) => {
      if (data.length === 0) return [];
      
      const firstPoint = data[0];
      if (!firstPoint) return [];
      
      const initialValue = getValue(firstPoint);
      if (initialValue === 0) return data.map(() => 0);
      
      return data.map(point => {
        const currentValue = getValue(point);
        return ((currentValue - initialValue) / initialValue) * 100;
      });
    };
    
    // Apply date range alignment
    const { alignedPortfolio, alignedBenchmark } = alignDataRanges(portfolioData || [], benchmarkData || []);
    
    // Calculate percentage returns
    const portfolioPercentReturns = calculatePercentageReturns(alignedPortfolio);
    const benchmarkPercentReturns = calculatePercentageReturns(alignedBenchmark);
    
    return {
      alignedPortfolio,
      alignedBenchmark,
      portfolioPercentReturns,
      benchmarkPercentReturns,
      getValue
    };
  }, [portfolioData, benchmarkData]);
  
  const { alignedPortfolio, alignedBenchmark, portfolioPercentReturns, benchmarkPercentReturns, getValue } = processedChartData;
  
  
  // Prepare data for ApexChart with optimized processing
  const chartData = useMemo<{ name: string; data: [number, number][]; color: string }[]>(() => {
    console.log('[PortfolioChartApex] Preparing chart data:', 
      {
      portfolioCount: alignedPortfolio?.length || 0,
      benchmarkCount: alignedBenchmark?.length || 0,
      displayMode,
      selectedRange,
      selectedBenchmark
    });
    
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
        color: '#238636'
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
        color: '#58A6FF'
      });
    }
    
    return result;
  }, [alignedPortfolio, alignedBenchmark, displayMode, portfolioPercentReturns, benchmarkPercentReturns, selectedBenchmark, selectedRange, getValue]);

  // Format currency values using centralized formatter
  const _formatCurrency = (value: number) => {
    return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0
    });
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
    <div className="rounded-xl bg-[#0D1117] border border-[#30363D] p-6 shadow-lg">
      {/* Header with title and range selection */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#FFFFFF]">Portfolio vs Benchmark</h3>
          {metrics && (
            <div className="text-sm text-[#8B949E] mt-1">
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
                  ? 'bg-[#238636] text-white' 
                  : 'text-[#8B949E] hover:text-white hover:bg-[#30363D]'
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
          <label className="text-sm text-[#8B949E]">Benchmark:</label>
          <select
            value={selectedBenchmark}
            onChange={e => handleBenchmarkChange(e.target.value)}
            className="px-2 py-1 text-xs rounded-md bg-[#0D1117] text-white border border-[#30363D] focus:border-[#58A6FF] focus:outline-none"
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
                ? 'bg-[#F0883E] text-white' 
                : 'text-[#8B949E] hover:text-white hover:bg-[#30363D]'
            }`}
          >
            $ Value
          </button>
          <button
            onClick={() => handleDisplayModeChange('percentage')}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              displayMode === 'percentage' 
                ? 'bg-[#F0883E] text-white' 
                : 'text-[#8B949E] hover:text-white hover:bg-[#30363D]'
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
          <div className="mb-4 p-3 bg-[#58A6FF]/10 border border-[#58A6FF]/30 rounded-lg">
            <p className="text-sm text-[#58A6FF]">
              <strong>Showing {selectedBenchmark} Performance Only</strong>
            </p>
            <p className="text-xs text-[#58A6FF] mt-1">
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
                color: '#238636'
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
      ) : noData ? (
        <div className="flex items-center justify-center h-96 text-[#8B949E]">
          <div className="text-center">
            <p className="text-lg font-semibold">No portfolio data available</p>
            <div className="text-sm mt-2 space-y-2">
              <p>Add some transactions to see your portfolio performance</p>
              <p className="text-xs text-[#8B949E]">
                Once you add transactions, your portfolio chart will show here automatically.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ApexChart
          data={chartData}
          type="line"
          height={400}
          yAxisFormatter={displayMode === 'value' ? 
            (value) => `$${value.toLocaleString()}` : 
            (value) => `${value.toFixed(1)}%`}
          tooltipFormatter={displayMode === 'value' ? 
            (value) => `$${value.toLocaleString()}` : 
            (value) => `${value.toFixed(2)}%`}
          showLegend={true}
          isLoading={isLoading}
          error={isError ? error?.message || 'Unknown error occurred' : null}
          onRetry={refetch}
        />
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-[#8B949E]">
          Debug: Portfolio points: {portfolioData?.length || 0}, 
          Benchmark points: {benchmarkData?.length || 0}, 
          Range: {selectedRange}, Benchmark: {selectedBenchmark}
        </div>
      )}
    </div>
  )
}