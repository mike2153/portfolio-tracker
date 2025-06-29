'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { FinancialStatement } from '@/types/stock-research';

interface FinancialChartProps {
  data: FinancialStatement[];
  metric: string;
  title: string;
  ticker: string;
  height?: number;
}

export default function FinancialChart({ 
  data, 
  metric, 
  title, 
  ticker, 
  height = 300 
}: FinancialChartProps) {
  // Process data for the chart
  const chartData = data
    .map(statement => {
      const period = statement.fiscalDateEnding || statement.reportedCurrency || 'Unknown';
      const value = statement[metric];
      
      // Convert string values to numbers
      let numericValue = 0;
      if (typeof value === 'string') {
        // Remove commas and parse
        const cleanValue = value.replace(/,/g, '');
        numericValue = parseFloat(cleanValue) || 0;
      } else if (typeof value === 'number') {
        numericValue = value;
      }
      
      return {
        period: period.slice(0, 7), // YYYY-MM format
        value: numericValue,
        displayValue: formatValue(numericValue),
        originalValue: value
      };
    })
    .filter(item => item.value !== 0)
    .reverse() // Show oldest to newest
    .slice(-8); // Last 8 periods for better visibility

  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    } else {
      return `$${value.toFixed(0)}`;
    }
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Determine bar color based on values
  const getBarColor = () => {
    const hasNegativeValues = chartData.some(item => item.value < 0);
    return hasNegativeValues ? '#ef4444' : '#10b981'; // Red for mixed/negative, green for positive
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-white font-medium">
            {formatTooltipValue(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="w-full bg-gray-800 rounded-lg p-6 flex items-center justify-center" style={{ height }}>
        <div className="text-center text-gray-400">
          <div className="text-lg mb-2">📊</div>
          <p>No data available for {title}</p>
          <p className="text-sm mt-1">Select a metric from the table below</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-800 rounded-lg p-4">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-white mb-1">{title}</h4>
        <p className="text-sm text-gray-400">{ticker} • {chartData.length} periods</p>
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="period" 
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: '#9ca3af' }}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="value" 
            fill={getBarColor()}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        Click on table rows below to change the displayed metric
      </div>
    </div>
  );
}