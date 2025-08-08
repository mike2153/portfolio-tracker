"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { formatCurrency, formatPercentage, formatDate } from '@/lib/front_api_client';
import { useChart } from '../ChartProvider';
import { getUTCTimestamp } from '@/lib/dateUtils';

interface StockData {
  date: Date | string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

interface ChartData {
  symbol: string;
  data: StockData[];
  color?: string;
}

interface StockChartProps {
  data: ChartData[];
  height?: number;
  width?: number;
  showVolume?: boolean;
  chartType?: 'line' | 'candlestick' | 'area';
  timePeriod?: string;
  showLegend?: boolean;
  theme?: 'dark' | 'light';
  title?: string;
  compareMode?: boolean;
}

const StockChart: React.FC<StockChartProps> = ({
  data,
  height = 400,
  width = 800,
  showVolume: _showVolume = false,
  chartType = 'line',
  timePeriod = '1Y',
  showLegend = true,
  theme = 'dark',
  title,
  compareMode = false,
}) => {
  const { loadChart, isLoading: chartLoading } = useChart();
  const [ChartComponent, setChartComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    const apexType = chartType === 'candlestick' ? 'candlestick' : 'line';
    loadChart(apexType).then(setChartComponent).catch(console.error);
  }, [loadChart, chartType]);
  const chartColors = useMemo(() => [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
  ], []);

  const isDark = theme === 'dark';
  const textColor = isDark ? '#d1d5db' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const backgroundColor = isDark ? '#1f2937' : '#ffffff';

  // Process data for percentage comparison mode
  const processedData = useMemo(() => {
    if (!compareMode) return data;

    return data.map((series) => {
      const firstPrice = series.data[0]?.price || series.data[0]?.close || 1;
      return {
        ...series,
        data: series.data.map((point) => ({
          ...point,
          price: ((point.price || point.close || 0) / firstPrice - 1) * 100,
        })),
      };
    });
  }, [data, compareMode]);

  // Prepare ApexCharts data
  const chartOptions = useMemo(() => {
    const series = processedData.map((series, index) => ({
      name: series.symbol,
      data: series.data.map(point => ({
        x: getUTCTimestamp(point.date as string),
        y: point.price || point.close || 0,
        ...(point.open && { open: point.open }),
        ...(point.high && { high: point.high }),
        ...(point.low && { low: point.low }),
        ...(point.close && { close: point.close }),
      })),
      color: series.color || chartColors[index] || '#3b82f6',
    }));

    return {
      chart: {
        type: (chartType === 'candlestick' ? 'candlestick' : 'line') as 'line' | 'candlestick',
        height,
        width,
        background: backgroundColor,
        foreColor: textColor,
        toolbar: {
          show: false,
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800,
        },
      },
      series,
      xaxis: {
        type: 'datetime' as const,
        labels: {
          style: {
            colors: textColor,
          },
        },
        axisBorder: {
          color: gridColor,
        },
        axisTicks: {
          color: gridColor,
        },
      },
      yaxis: {
        labels: {
          formatter: (value: number) => {
            if (compareMode) {
              return formatPercentage(value / 100);
            }
            return formatCurrency(value);
          },
          style: {
            colors: textColor,
          },
        },
        axisBorder: {
          color: gridColor,
        },
        axisTicks: {
          color: gridColor,
        },
      },
      grid: {
        borderColor: gridColor,
        strokeDashArray: 5,
      },
      legend: {
        show: showLegend && data.length > 1,
        position: 'top' as const,
        horizontalAlign: 'right' as const,
        labels: {
          colors: textColor,
        },
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        x: {
          formatter: (value: number) => formatDate(new Date(value), 'medium'),
        },
        y: {
          formatter: (value: number) => {
            if (compareMode) {
              return formatPercentage(value / 100);
            }
            return formatCurrency(value);
          },
        },
      },
      stroke: {
        curve: 'smooth' as const,
        width: 2,
      },
      fill: {
        type: chartType === 'area' ? 'gradient' : 'solid',
        ...(chartType === 'area' ? {
          gradient: {
            shade: 'light',
            type: 'vertical',
            shadeIntensity: 1,
            opacityFrom: 0.7,
            opacityTo: 0.1,
            stops: [0, 100],
          }
        } : {}),
      },
    };
  }, [processedData, chartType, height, width, backgroundColor, textColor, gridColor, showLegend, data.length, isDark, compareMode, chartColors]);

  if (chartLoading || !ChartComponent) {
    return (
      <div style={{ backgroundColor, padding: '16px', borderRadius: '8px' }}>
        {title && (
          <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
            {title}
          </h3>
        )}
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor }}>
          Loading chart...
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor, padding: '16px', borderRadius: '8px' }}>
      {title && (
        <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
          {title}
        </h3>
      )}
      
      {ChartComponent && (
        <ChartComponent
          options={chartOptions}
          series={chartOptions.series}
          type={chartType === 'candlestick' ? 'candlestick' : 'line'}
          height={height}
          width={width}
        />
      )}

      {/* Time period selector */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        {['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'].map((period) => (
          <button
            key={period}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: timePeriod === period ? '#3b82f6' : gridColor,
              color: timePeriod === period ? '#fff' : textColor,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StockChart;