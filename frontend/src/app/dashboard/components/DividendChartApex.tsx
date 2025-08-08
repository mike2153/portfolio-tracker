'use client';

import React, { useMemo } from 'react';
import { ApexChart } from '@/components/charts';

interface DividendData {
  date: string;
  amount: number;
  symbol?: string;
  yield?: number;
}

interface DividendChartApexProps {
  data: DividendData[];
  title?: string;
  height?: number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  showYield?: boolean;
  period?: 'monthly' | 'quarterly' | 'yearly';
}

export default function DividendChartApex({
  data,
  title = 'Dividend Income',
  height = 350,
  isLoading = false,
  error = null,
  onRetry,
  showYield = false,
  period = 'monthly'
}: DividendChartApexProps) {
  
  console.log('[DividendChartApex] Rendering with data:', {
    dataLength: data?.length,
    title,
    period,
    showYield,
    isLoading
  });

  // Transform data for ApexChart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(`${a.date}T00:00:00Z`).getTime() - new Date(`${b.date}T00:00:00Z`).getTime());

    // Create dividend amount series with proper tuple typing
    const dividendSeries: Array<[number, number]> = sortedData.map(item => {
      const timestamp = new Date(`${item.date}T00:00:00Z`).getTime();
      return [timestamp, item.amount] as [number, number];
    });

    const series = [
      {
        name: 'Dividend Amount',
        data: dividendSeries,
        color: '#10b981'
      }
    ];

    // Add yield series if requested and data is available
    if (showYield && sortedData.some(item => item.yield !== undefined)) {
      const yieldSeries: Array<[number, number]> = sortedData
        .filter(item => item.yield !== undefined)
        .map(item => {
          const timestamp = new Date(item.date).getTime();
          return [timestamp, item.yield!] as [number, number];
        });

      series.push({
        name: 'Dividend Yield (%)',
        data: yieldSeries,
        color: '#3b82f6'
      });
    }

    return series;
  }, [data, showYield]);

  // Calculate total dividends for current period
  const totalDividends = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, item) => sum + item.amount, 0);
  }, [data]);

  // Calculate average yield
  const averageYield = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const yieldsWithData = data.filter(item => item.yield !== undefined);
    if (yieldsWithData.length === 0) return 0;
    return yieldsWithData.reduce((sum, item) => sum + (item.yield || 0), 0) / yieldsWithData.length;
  }, [data]);

  return (
    <div className="w-full">
      {/* Summary Stats */}
      {!isLoading && !error && data && data.length > 0 && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Total Dividends</div>
            <div className="text-lg font-semibold text-white">
              ${totalDividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Payments</div>
            <div className="text-lg font-semibold text-white">{data.length}</div>
          </div>
          {showYield && averageYield > 0 && (
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400">Avg Yield</div>
              <div className="text-lg font-semibold text-white">{averageYield.toFixed(2)}%</div>
            </div>
          )}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Period</div>
            <div className="text-lg font-semibold text-white capitalize">{period}</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <ApexChart
        data={chartData}
        type="area"
        height={height}
        title={title}
        yAxisFormatter={(value) => `$${value.toFixed(2)}`}
        tooltipFormatter={(value) => `$${value.toFixed(2)}`}
        showLegend={showYield && chartData.length > 1}
        showToolbar={false}
        isLoading={isLoading}
        error={error}
        {...(onRetry && { onRetry })}
        colors={['#10b981', '#3b82f6']}
      />

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Debug: {data?.length || 0} dividend payments, Total: ${totalDividends.toFixed(2)}, Avg Yield: {averageYield.toFixed(2)}%
        </div>
      )}
    </div>
  );
}