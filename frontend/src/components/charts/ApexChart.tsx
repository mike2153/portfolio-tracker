'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { ApexOptions } from 'apexcharts';
import { useChart } from '../ChartProvider';

export interface ApexChartProps {
  data: Array<{
    name: string;
    data: Array<[number, number]> | Array<{ x: number | string; y: number } | { x: number | string; y: number[] }>;
    color?: string | undefined;
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
  error?: string | null | undefined;
  onRetry?: (() => void) | undefined;
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
  const { loadChart, isLoading: chartLoading } = useChart();
  const [ChartComponent, setChartComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    loadChart(type).then(component => setChartComponent(() => component)).catch(console.error);
  }, [loadChart, type]);
  
  // Debug logging (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[ApexChart] Rendering with data:', {
      dataLength: data?.length,
      type,
      height,
      isLoading,
      error: error?.substring(0, 100)
    });
  }

  // Determine dynamic colors based on performance
  const dynamicColors = useMemo(() => {
    if (!data || data.length === 0) return colors;
    const seriesData = data[0]?.data;
    if (!seriesData || seriesData.length === 0) return colors;
    // Helper to extract numeric value (handles tuples, point objects, and OHLC arrays)
    const getValue = (
      pt: [number, number] | { x: number | string; y: number } | { x: number | string; y: number[] }
    ): number => {
      if (Array.isArray(pt)) {
        return pt[1];
      } else if (Array.isArray(pt.y)) {
        // OHLC array: [open, high, low, close]
        return pt.y[3] || 0;
      } else {
        return pt.y;
      }
    };
    if (seriesData.length === 0) return colors;
    const firstItem = seriesData[0];
    const lastItem = seriesData[seriesData.length - 1];
    if (!firstItem || !lastItem) return colors;
    const firstValue = getValue(firstItem);
    const lastValue = getValue(lastItem);
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
      curve: 'smooth' as const, 
      width: type === 'area' || type === 'line' ? 2 : 1 
    },
    fill: {
      type: type === 'area' ? 'gradient' : 'solid',
      opacity: type === 'bar' ? 1 : (type === 'area' ? 1 : 0.85),
      ...(type === 'area' ? {
        gradient: {
          shade: darkMode ? 'dark' : 'light',
          type: 'vertical',
          shadeIntensity: 0.3,
          gradientToColors: [darkMode ? '#0D1117' : '#f9fafb'],
          opacityFrom: 0.6,
          opacityTo: 0.1,
          stops: [0, 100]
        }
      } : {})
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
      shared: true, // Enable shared tooltip to show all series
      intersect: false, // Show values for all series at the same x-axis point
      ...(xAxisType === 'datetime' ? {
        x: { format: 'dd MMM yyyy' }
      } : {}),
      y: {
        formatter: (value: number, { seriesIndex, series: _series, w }: any) => {
          // Custom formatter to show both portfolio and benchmark values
          const formattedValue = tooltipFormatter(value);
          const seriesName = w.config.series[seriesIndex]?.name || '';
          
          // Add currency symbol and series identification
          return `${seriesName}: $${formattedValue}`;
        }
      },
      custom: ({ series, seriesIndex: _seriesIndex, dataPointIndex, w }: any) => {
        if (!series || series.length === 0) return '';
        
        // Get the date for this data point
        const date = w.config.series[0]?.data[dataPointIndex]?.x || 
                    w.config.xaxis.categories?.[dataPointIndex] || '';
        
        let tooltipHTML = `<div class="custom-tooltip bg-gray-800 text-white p-3 rounded shadow-lg border">`;
        tooltipHTML += `<div class="tooltip-date font-semibold mb-2">${new Date(date).toLocaleDateString()}</div>`;
        
        // Show all series values
        series.forEach((seriesData: number[], index: number) => {
          const value = seriesData[dataPointIndex];
          const seriesName = w.config.series[index]?.name || `Series ${index + 1}`;
          const color = w.config.colors[index] || '#3B82F6';
          
          if (value !== undefined && value !== null) {
            tooltipHTML += `
              <div class="tooltip-series flex items-center gap-2 py-1">
                <div class="series-color w-3 h-3 rounded-full" style="background-color: ${color}"></div>
                <span class="series-name">${seriesName}:</span>
                <span class="series-value font-medium">$${tooltipFormatter(value)}</span>
              </div>
            `;
          }
        });
        
        // Calculate performance difference if we have both portfolio and benchmark
        if (series.length >= 2 && series[0][dataPointIndex] && series[1][dataPointIndex]) {
          const portfolioValue = series[0][dataPointIndex];
          const benchmarkValue = series[1][dataPointIndex];
          const difference = portfolioValue - benchmarkValue;
          const percentDiff = benchmarkValue !== 0 ? ((difference / benchmarkValue) * 100) : 0;
          
          tooltipHTML += `
            <div class="tooltip-difference border-t pt-2 mt-2">
              <div class="text-sm opacity-75">Difference:</div>
              <div class="flex justify-between">
                <span>Value:</span>
                <span class="${difference >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">
                  ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}
                </span>
              </div>
              <div class="flex justify-between">
                <span>Percent:</span>
                <span class="${percentDiff >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">
                  ${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(2)}%
                </span>
              </div>
            </div>
          `;
        }
        
        tooltipHTML += `</div>`;
        return tooltipHTML;
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
    const mappedSeries = data.map(item => {
      // Destructure to exclude any React-specific props like 'key'
      const { key: _key, ...itemProps } = item as any;
      return {
        name: itemProps.name,
        data: itemProps.data,
        ...(itemProps.color ? { color: itemProps.color } : {}),
        type: type // Explicitly set the chart type for each series
      };
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('[ApexChart] Series prepared:', {
        seriesCount: mappedSeries.length,
        firstSeriesName: mappedSeries[0]?.name,
        firstSeriesDataLength: mappedSeries[0]?.data?.length,
        firstSeriesType: mappedSeries[0]?.type
      });
    }
    return mappedSeries;
  }, [data, type]);

  // Loading state (including chart loading)
  if (isLoading || chartLoading || !ChartComponent) {
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
        {ChartComponent && (
          <ChartComponent
            options={options}
            series={series}
            type={type}
            height={height}
          />
        )}
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