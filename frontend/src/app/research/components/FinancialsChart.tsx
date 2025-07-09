import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface FinancialsChartProps {
  selectedMetrics: string[];
  financialData: Record<string, Record<string, number>>;
  metricLabels: Record<string, string>;
  years: string[];
}

/**
 * FinancialsChart Component
 * 
 * Renders a stacked/clustered bar chart showing selected financial metrics
 * across multiple years using ApexCharts. Auto-scales and updates based
 * on user selections from the financial table.
 */
const FinancialsChart: React.FC<FinancialsChartProps> = ({
  selectedMetrics,
  financialData,
  metricLabels,
  years
}) => {
  // Format large numbers for better readability
  const formatValue = (value: number): string => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Prepare chart series data from selected metrics
  const chartSeries = selectedMetrics.map((metricKey, index) => ({
    name: metricLabels[metricKey] || metricKey,
    data: years.map(year => financialData[metricKey]?.[year] || 0),
    color: getMetricColor(index) // Assign consistent colors
  }));

  // Chart configuration optimized for financial data
  const chartOptions = {
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false
        }
      },
      fontFamily: 'inherit'
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '70%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: false // Clean look without data labels on bars
    },
    stroke: {
      show: true,
      width: 1,
      colors: ['transparent']
    },
    xaxis: {
      categories: years,
      labels: {
        style: {
          colors: '#9CA3AF',
          fontSize: '12px'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: '#9CA3AF',
          fontSize: '12px'
        },
        formatter: (value: number) => formatValue(value)
      },
      title: {
        text: 'Value (USD)',
        style: {
          color: '#9CA3AF',
          fontSize: '12px'
        }
      }
    },
    fill: {
      opacity: 0.9
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (value: number) => formatValue(value)
      },
      style: {
        fontSize: '12px'
      }
    },
    legend: {
      position: 'bottom' as const,
      horizontalAlign: 'center' as const,
      floating: false,
      fontSize: '12px',
      fontWeight: 400,
      labels: {
        colors: '#D1D5DB'
      },
      markers: {
        width: 12,
        height: 12,
        radius: 2
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5
      }
    },
    grid: {
      borderColor: '#374151',
      strokeDashArray: 1,
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    theme: {
      mode: 'dark' as const
    }
  };

  // Display message when no metrics are selected
  if (selectedMetrics.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 h-96 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-lg font-medium mb-2">Select Financial Metrics</div>
          <div className="text-sm">
            Click on table rows below to add metrics to the chart
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Financial Metrics Comparison</h3>
        <div className="text-sm text-gray-400">
          Showing {selectedMetrics.length} selected metric{selectedMetrics.length !== 1 ? 's' : ''} across {years.length} periods
        </div>
      </div>
      
      {/* ApexCharts Component */}
      <div className="h-96">
        <Chart
          options={chartOptions}
          series={chartSeries}
          type="bar"
          height="100%"
        />
      </div>
    </div>
  );
};

/**
 * Generate consistent colors for chart series
 * Uses a predefined color palette for better visual distinction
 */
function getMetricColor(index: number): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6B7280'  // Gray
  ];
  return colors[index % colors.length];
}

export default FinancialsChart;