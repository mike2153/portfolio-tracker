'use client';

import React, { useMemo } from 'react';
import ApexChart from '@/components/charts/ApexChart';

interface FinancialsChartProps {
  selectedMetrics: string[];
  financialData: Record<string, Record<string, number>>;
  metricLabels: Record<string, string>;
  years: string[];
}

/**
 * FinancialsChart Component
 * 
 * Interactive chart for displaying selected financial metrics over time.
 * Uses ApexCharts for professional financial data visualization.
 */
const FinancialsChart: React.FC<FinancialsChartProps> = ({
  selectedMetrics,
  financialData,
  metricLabels,
  years
}) => {
  
  // Prepare chart data from financial metrics
  const chartData = useMemo(() => {
    if (!selectedMetrics.length || !years.length) {
      return [];
    }

    return selectedMetrics.map(metricKey => {
      const metricValues = financialData[metricKey] || {};
      const data = years.map(year => ({
        x: year,
        y: metricValues[year] || 0
      }));

      return {
        name: metricLabels[metricKey] || metricKey,
        data: data
      };
    });
  }, [selectedMetrics, financialData, metricLabels, years]);

  // Chart configuration
  const chartOptions = useMemo(() => ({
    chart: {
      type: 'line' as const,
      height: 400,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: false,
          reset: true
        }
      },
      background: 'transparent',
      foreColor: '#9CA3AF'
    },
    theme: {
      mode: 'dark' as const
    },
    stroke: {
      width: 3,
      curve: 'smooth' as const
    },
    markers: {
      size: 6,
      strokeWidth: 2,
      hover: {
        size: 8
      }
    },
    xaxis: {
      categories: years,
      title: {
        text: 'Year',
        style: {
          color: '#9CA3AF',
          fontSize: '12px'
        }
      },
      labels: {
        style: {
          colors: '#9CA3AF'
        }
      }
    },
    yaxis: {
      title: {
        text: 'Value',
        style: {
          color: '#9CA3AF',
          fontSize: '12px'
        }
      },
      labels: {
        style: {
          colors: '#9CA3AF'
        },
        formatter: (value: number) => {
          if (Math.abs(value) >= 1e9) {
            return `$${(value / 1e9).toFixed(1)}B`;
          } else if (Math.abs(value) >= 1e6) {
            return `$${(value / 1e6).toFixed(1)}M`;
          } else if (Math.abs(value) >= 1e3) {
            return `$${(value / 1e3).toFixed(1)}K`;
          }
          return `$${value.toFixed(0)}`;
        }
      }
    },
    tooltip: {
      theme: 'dark',
      shared: true,
      intersect: false,
      y: {
        formatter: (value: number) => {
          const absValue = Math.abs(value);
          const sign = value < 0 ? '-' : '';
          
          if (absValue >= 1e12) {
            return `${sign}$${(absValue / 1e12).toFixed(2)}T`;
          } else if (absValue >= 1e9) {
            return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
          } else if (absValue >= 1e6) {
            return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
          } else if (absValue >= 1e3) {
            return `${sign}$${(absValue / 1e3).toFixed(2)}K`;
          }
          return `${sign}$${absValue.toLocaleString()}`;
        }
      }
    },
    legend: {
      show: true,
      position: 'top' as const,
      horizontalAlign: 'left' as const,
      labels: {
        colors: '#9CA3AF'
      }
    },
    grid: {
      borderColor: '#374151',
      strokeDashArray: 3
    },
    colors: [
      '#3B82F6', // Blue
      '#10B981', // Green  
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#F97316'  // Orange
    ]
  }), [years]);

  // Empty state
  if (!selectedMetrics.length) {
    return (
      <div className="rounded-xl bg-gray-800/80 p-8 shadow-lg">
        <div className="text-center text-gray-400">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Select Financial Metrics</h3>
          <p className="text-sm">Choose metrics from the table below to display them on the chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
      {/* Chart Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Financial Metrics Chart</h3>
        <p className="text-sm text-gray-400">
          {selectedMetrics.length} metric{selectedMetrics.length !== 1 ? 's' : ''} selected • {years.length} years of data
        </p>
      </div>

      {/* Chart */}
      <div className="w-full">
        <ApexChart
          type="line"
          series={chartData}
          options={chartOptions}
          height={400}
        />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex flex-wrap gap-2">
          {selectedMetrics.map((metricKey) => (
            <span
              key={metricKey}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300"
            >
              {metricLabels[metricKey] || metricKey}
            </span>
          ))}
        </div>
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Debug: {selectedMetrics.length} metrics, {years.length} years, {chartData.length} series
        </div>
      )}
    </div>
  );
};

export default FinancialsChart;