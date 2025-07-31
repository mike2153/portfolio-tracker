'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Dynamic import to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface ApexChartProps {
  data: Array<{
    name: string;
    data: Array<[number, number]> | Array<{ x: number | string; y: number } | { x: number | string; y: number[] }>;
    color?: string;
  }>;
  type?: 'line' | 'area' | 'bar' | 'candlestick';
  height?: number;
  title?: string;
  xAxisType?: 'datetime' | 'category' | 'numeric';
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  showLegend?: boolean;
  showToolbar?: boolean;
  timeRanges?: Array<{ id: string; label: string }>;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  colors?: string[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  darkMode?: boolean;
  additionalOptions?: ApexOptions;
}

const defaultTimeRanges = [
  { id: '7D', label: '7D' },
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '1Y', label: '1Y' },
  { id: 'YTD', label: 'YTD' },
  { id: 'MAX', label: 'MAX' }
];

export default function ApexChart({
  data,
  type = 'area',
  height = 350,
  title,
  xAxisType = 'datetime',
  yAxisFormatter = (value) => value.toFixed(1),
  tooltipFormatter = (value) => value.toFixed(2),
  showLegend = false,
  showToolbar = false,
  timeRanges = defaultTimeRanges,
  selectedRange,
  onRangeChange,
  colors = ['#58A6FF', '#238636', '#F0883E', '#F85149'],
  isLoading = false,
  error = null,
  onRetry,
  className = '',
  darkMode = true,
  additionalOptions = {},
}: ApexChartProps) {
  
  // Debug logging
  console.log('[ApexChart] Rendering with data:', {
    dataLength: data?.length,
    type,
    height,
    isLoading,
    error: error?.substring(0, 100)
  });

  // Determine dynamic colors based on performance
  const dynamicColors = useMemo(() => {
    if (!data || data.length === 0) return colors;
    const seriesData = data[0].data;
    if (!seriesData || seriesData.length === 0) return colors;
    // Helper to extract numeric value (handles tuples, point objects, and OHLC arrays)
    const getValue = (
      pt: [number, number] | { x: number | string; y: number } | { x: number | string; y: number[] }
    ): number => {
      if (Array.isArray(pt)) {
        return pt[1];
      } else if (Array.isArray(pt.y)) {
        // OHLC array: [open, high, low, close]
        return pt.y[3];
      } else {
        return pt.y;
      }
    };
    const firstValue = getValue(seriesData[0]);
    const lastValue = getValue(seriesData[seriesData.length - 1]);
    const isPositive = lastValue >= firstValue;
    const primaryColor = isPositive ? '#238636' : '#F85149';
    return [primaryColor, ...colors.slice(1)];
  }, [data, colors]);

  const options: ApexOptions = useMemo(() => ({
    chart: {
      id: `apex-chart-${type}`,
      type: type as 'line' | 'area' | 'bar' | 'candlestick',
      height,
      background: darkMode ? 'transparent' : '#ffffff',
      toolbar: { show: showToolbar },
      fontFamily: 'Inter, sans-serif',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    colors: dynamicColors,
    dataLabels: { enabled: false },
    stroke: { 
      curve: 'smooth' as 'smooth', 
      width: type === 'area' || type === 'line' ? 2 : 1 
    },
    fill: {
      type: type === 'area' ? 'gradient' : 'solid',
      opacity: type === 'bar' ? 1 : (type === 'area' ? 1 : 0.85),
      gradient: type === 'area' ? {
        shade: darkMode ? 'dark' : 'light',
        type: 'vertical',
        shadeIntensity: 0.3,
        gradientToColors: [darkMode ? '#0D1117' : '#f9fafb'],
        opacityFrom: 0.6,
        opacityTo: 0.1,
        stops: [0, 100]
      } : undefined
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '70%',
        borderRadius: 4,
        distributed: false
      },
      candlestick: {
        colors: {
          upward: '#238636',
          downward: '#F85149'
        }
      }
    },
    grid: {
      borderColor: darkMode ? '#30363D' : '#e5e7eb',
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    xaxis: {
      type: xAxisType,
      labels: { 
        style: { 
          colors: darkMode ? '#8B949E' : '#6b7280',
          fontSize: '12px' 
        },
        datetimeUTC: false
      },
      axisBorder: { color: darkMode ? '#30363D' : '#e5e7eb' },
      axisTicks: { color: darkMode ? '#30363D' : '#e5e7eb' },
      title: {
        style: { color: darkMode ? '#8B949E' : '#6b7280' }
      }
    },
    yaxis: {
      labels: {
        formatter: yAxisFormatter,
        style: { 
          colors: darkMode ? '#8B949E' : '#6b7280',
          fontSize: '12px' 
        }
      },
      axisBorder: { color: darkMode ? '#30363D' : '#e5e7eb' },
      axisTicks: { color: darkMode ? '#30363D' : '#e5e7eb' },
      title: {
        style: { color: darkMode ? '#8B949E' : '#6b7280' }
      }
    },
    legend: { 
      show: showLegend,
      labels: { colors: darkMode ? '#FFFFFF' : '#374151' }
    },
    tooltip: {
      enabled: true,
      theme: darkMode ? 'dark' : 'light',
      x: {
        format: xAxisType === 'datetime' ? 'dd MMM yyyy' : undefined
      },
      y: {
        formatter: tooltipFormatter
      },
      style: {
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif'
      }
    },
    markers: {
      size: 0,
      strokeColors: darkMode ? '#0D1117' : '#ffffff',
      strokeWidth: 2,
      hover: { size: 6 }
    },
    theme: {
      mode: darkMode ? 'dark' : 'light'
    },
    ...additionalOptions
  }), [type, height, darkMode, showToolbar, showLegend, xAxisType, yAxisFormatter, tooltipFormatter, dynamicColors, additionalOptions]);

  const series = useMemo(() => {
    if (!data || data.length === 0) return [];
    const mappedSeries = data.map(item => ({
      name: item.name,
      data: item.data,
      color: item.color,
      type: type // Explicitly set the chart type for each series
    }));
    console.log('[ApexChart] Series prepared:', {
      seriesCount: mappedSeries.length,
      firstSeriesName: mappedSeries[0]?.name,
      firstSeriesDataLength: mappedSeries[0]?.data?.length,
      firstSeriesType: mappedSeries[0]?.type
    });
    return mappedSeries;
  }, [data, type]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`rounded-xl bg-[#0D1117] border border-[#30363D] p-6 shadow-lg ${className}`}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
        )}
        <div className="flex items-center justify-center h-96">
          <div className="flex items-center gap-2 text-[#8B949E]">
            <div className="w-6 h-6 border-2 border-[#58A6FF] border-t-transparent rounded-full animate-spin"></div>
            Loading chart data...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-xl bg-[#0D1117] border border-[#30363D] p-6 shadow-lg ${className}`}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
        )}
        <div className="flex items-center justify-center h-96 text-[#F85149]">
          <div className="text-center">
            <p className="text-lg font-semibold">Failed to load chart data</p>
            <p className="text-sm mt-2">{error}</p>
            {onRetry && (
              <button 
                onClick={onRetry}
                className="mt-4 px-4 py-2 bg-[#F85149] text-white rounded-md hover:bg-[#DA3633] transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl bg-[#0D1117] border border-[#30363D] p-6 shadow-lg ${className}`}>
      {/* Header with title and time range controls */}
      <div className="flex items-center justify-between mb-4">
        {title && (
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        )}
        
        {timeRanges && timeRanges.length > 0 && onRangeChange && (
          <div className="flex space-x-1">
            {timeRanges.map(range => (
              <button
                key={range.id}
                onClick={() => onRangeChange(range.id)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  selectedRange === range.id 
                    ? 'bg-[#238636] text-white' 
                    : 'text-[#8B949E] hover:text-white hover:bg-[#30363D]'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="w-full">
        <ReactApexChart 
          options={options} 
          series={series} 
          type={type as 'line' | 'area' | 'bar' | 'candlestick'} 
          height={height} 
        />
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-[#8B949E]">
          Debug: {series.length} series, Type: {type}, Height: {height}px
        </div>
      )}
    </div>
  );
}