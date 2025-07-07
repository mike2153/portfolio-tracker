'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineData, IChartApi, ISeriesApi, UTCTimestamp, ColorType, LineSeries } from 'lightweight-charts';

export interface FinancialDataPoint {
  date: string; // YYYY-MM-DD format
  value: number;
  label?: string; // For tooltips
}

export interface FinancialMetricsChartProps {
  data: FinancialDataPoint[];
  title: string;
  ticker: string;
  metric: string;
  height?: number;
  isLoading?: boolean;
  formatValue?: (value: number) => string;
  color?: string;
  showGrid?: boolean;
  yAxisTitle?: string;
}

const FinancialMetricsChart: React.FC<FinancialMetricsChartProps> = ({
  data,
  title,
  ticker,
  metric,
  height = 300,
  isLoading = false,
  formatValue,
  color = '#10b981',
  showGrid = true,
  yAxisTitle
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  // Default value formatter
  const defaultFormatValue = (value: number): string => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  const valueFormatter = formatValue || defaultFormatValue;

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      setChartError(null);

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#d1d5db',
        },
        grid: {
          vertLines: {
            color: showGrid ? '#374151' : 'transparent',
          },
          horzLines: {
            color: showGrid ? '#374151' : 'transparent',
          },
        },
        crosshair: {
          mode: 1,
        },
        rightPriceScale: {
          borderColor: '#4b5563',
          textColor: '#d1d5db',
        },
        timeScale: {
          borderColor: '#4b5563',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: false,
          mouseWheel: true,
          pinch: true,
        },
      });

      // Add line series using the correct API
      const lineSeries = chart.addSeries(LineSeries, {
        color,
        lineWidth: 3,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 6,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => valueFormatter(price),
        },
      });

      chartRef.current = chart;
      seriesRef.current = lineSeries;

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          chart.applyOptions({ 
            width: chartContainerRef.current.clientWidth 
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chart) {
          chart.remove();
        }
      };
    } catch (error) {
      console.error('[FinancialMetricsChart] Error initializing chart:', error);
      setChartError('Failed to initialize chart');
    }
  }, [height, color, showGrid, yAxisTitle, valueFormatter]);

  // Update chart data
  useEffect(() => {
    if (!seriesRef.current || !data.length || chartError) return;

    try {
      // Convert data to TradingView format
      const chartData: LineData[] = data.map(point => ({
        time: (new Date(point.date).getTime() / 1000) as UTCTimestamp,
        value: point.value,
      }));

      // Sort by time to ensure proper chart rendering
      chartData.sort((a, b) => (a.time as number) - (b.time as number));

      seriesRef.current.setData(chartData);

      // Auto-scale to fit data
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('[FinancialMetricsChart] Error updating chart data:', error);
      setChartError('Failed to update chart data');
    }
  }, [data, chartError]);

  // Calculate growth metrics
  const getGrowthMetrics = () => {
    if (data.length < 2) return null;

    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const growth = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;

    return {
      firstValue,
      lastValue,
      growth,
      isPositive: growth >= 0
    };
  };

  const growthMetrics = getGrowthMetrics();

  if (chartError) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white">{title}</h4>
        </div>
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400">{chartError}</p>
          <p className="text-gray-400 text-sm mt-2">Unable to display chart for {metric}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-white">{title}</h4>
          <p className="text-sm text-gray-400">{ticker} • {metric}</p>
        </div>
        
        {/* Growth metrics */}
        {growthMetrics && (
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <div className="text-right">
              <div className="text-sm text-gray-400">Latest</div>
              <div className="text-white font-medium">
                {valueFormatter(growthMetrics.lastValue)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Growth</div>
              <div className={`font-medium ${
                growthMetrics.isPositive ? 'text-green-400' : 'text-red-400'
              }`}>
                {growthMetrics.isPositive ? '+' : ''}{growthMetrics.growth.toFixed(2)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-gray-300">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Loading {metric} data...
            </div>
          </div>
        )}
        
        <div 
          ref={chartContainerRef} 
          className={`w-full bg-gray-800 rounded-lg ${isLoading ? 'opacity-50' : ''}`}
          style={{ height: `${height}px` }}
        />
        
        {!isLoading && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p>No {metric} data available</p>
              <p className="text-sm mt-1">Historical data may not be available for this metric</p>
            </div>
          </div>
        )}
      </div>

      {/* Chart Info */}
      <div className="mt-2 text-xs text-gray-400 flex justify-between items-center">
        <span>{data.length} data points • TradingView Lightweight Charts</span>
        {data.length > 0 && (
          <span>
            Period: {data[0].date} to {data[data.length - 1].date}
          </span>
        )}
      </div>
    </div>
  );
};

export default FinancialMetricsChart;