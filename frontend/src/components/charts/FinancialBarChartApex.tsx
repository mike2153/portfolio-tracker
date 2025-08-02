'use client';

import React, { useMemo } from 'react';
import ApexChart from './ApexChart';

interface FinancialBarChartApexProps {
  data: Array<{
    label: string;
    value: number;
    category?: string;
  }>;
  title?: string;
  height?: number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  formatter?: (value: number) => string;
  colors?: string[];
  orientation?: 'vertical' | 'horizontal';
}

export default function FinancialBarChartApex({
  data,
  title = 'Financial Metrics',
  height = 350,
  isLoading = false,
  error = null,
  onRetry,
  formatter = (value) => `$${value.toLocaleString()}`,
  colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'],
  orientation = 'vertical'
}: FinancialBarChartApexProps) {
  
  console.log('[FinancialBarChartApex] Rendering with data:', {
    dataLength: data?.length,
    title,
    orientation,
    isLoading
  });

  // Transform data for ApexChart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Group data by category if available
    const categorized = data.reduce((acc, item) => {
      const category = item.category || 'default';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, typeof data>);

    // Create series for each category
    return Object.entries(categorized).map(([category, items], seriesIndex) => ({
      name: category === 'default' ? 'Financial Metrics' : category,
      data: items.map((item, _index) => ({
        x: item.label,
        y: item.value
      })),
      color: colors[seriesIndex % colors.length]
    }));
  }, [data, colors]);

  return (
    <div className="w-full">
      <ApexChart
        data={chartData}
        type="bar"
        height={height}
        title={title}
        xAxisType="category"
        yAxisFormatter={formatter}
        tooltipFormatter={formatter}
        showLegend={chartData.length > 1}
        showToolbar={false}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        colors={colors}
      />

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Debug: {data?.length || 0} data points, {chartData.length} series, Orientation: {orientation}
        </div>
      )}
    </div>
  );
}