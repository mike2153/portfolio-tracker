'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface FinancialBarChartProps {
  data: any[]; // Financial statement data
  statementType: 'income' | 'balance' | 'cashflow';
  selectedMetrics: string[];
  onMetricToggle: (metric: string) => void;
  height?: number;
  ticker: string;
}

const FinancialBarChart: React.FC<FinancialBarChartProps> = ({
  data,
  statementType,
  selectedMetrics,
  onMetricToggle,
  height = 400,
  ticker
}) => {
  // Format number for display
  const formatNumber = (value: number) => {
    if (Math.abs(value) >= 1e12) {
      return `$${(value / 1e12).toFixed(1)}T`;
    } else if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    } else {
      return `$${value.toFixed(0)}`;
    }
  };

  // Get available metrics based on statement type
  const getAvailableMetrics = () => {
    if (statementType === 'income') {
      return [
        { key: 'totalRevenue', label: 'Total Revenue', color: '#10b981' },
        { key: 'costOfRevenue', label: 'Cost of Revenue', color: '#ef4444' },
        { key: 'grossProfit', label: 'Gross Profit', color: '#3b82f6' },
        { key: 'operatingIncome', label: 'Operating Income', color: '#8b5cf6' },
        { key: 'netIncome', label: 'Net Income', color: '#f59e0b' }
      ];
    } else if (statementType === 'balance') {
      return [
        { key: 'totalAssets', label: 'Total Assets', color: '#10b981' },
        { key: 'totalCurrentAssets', label: 'Current Assets', color: '#06b6d4' },
        { key: 'totalLiabilities', label: 'Total Liabilities', color: '#ef4444' },
        { key: 'totalCurrentLiabilities', label: 'Current Liabilities', color: '#f97316' },
        { key: 'totalShareholderEquity', label: 'Shareholder Equity', color: '#8b5cf6' }
      ];
    } else if (statementType === 'cashflow') {
      return [
        { key: 'operatingCashflow', label: 'Operating Cash Flow', color: '#10b981' },
        { key: 'capitalExpenditures', label: 'Capital Expenditures', color: '#ef4444' },
        { key: 'cashflowFromInvestment', label: 'Investment Cash Flow', color: '#3b82f6' },
        { key: 'cashflowFromFinancing', label: 'Financing Cash Flow', color: '#8b5cf6' },
        { key: 'netIncomeFromContinuingOps', label: 'Net Income (Continuing)', color: '#f59e0b' }
      ];
    }
    return [];
  };

  const availableMetrics = getAvailableMetrics();

  // Prepare chart data
  const chartData = data?.slice(0, 8).reverse().map(report => {
    const item: any = {
      period: report.fiscalDateEnding?.slice(0, 7) || 'Unknown'
    };
    
    availableMetrics.forEach(metric => {
      const value = report[metric.key];
      item[metric.key] = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) || 0 : value || 0;
    });
    
    return item;
  }) || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-white text-sm">
              <span style={{ color: entry.color }}>●</span> {entry.name}: {formatNumber(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-gray-800 rounded-lg p-6 flex items-center justify-center" style={{ height }}>
        <div className="text-center text-gray-400">
          <div className="text-lg mb-2">📊</div>
          <p>No financial statement data available</p>
          <p className="text-sm mt-1">Select metrics from the checkboxes to display data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-800 rounded-lg p-6">
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-white mb-3">
          {statementType === 'income' && 'Income Statement Comparison'}
          {statementType === 'balance' && 'Balance Sheet Comparison'}
          {statementType === 'cashflow' && 'Cash Flow Statement Comparison'}
        </h4>
        <p className="text-sm text-gray-400 mb-4">{ticker} • {chartData.length} periods</p>
        
        {/* Metric Selection Checkboxes */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          {availableMetrics.map(metric => (
            <label key={metric.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMetrics.includes(metric.key)}
                onChange={() => onMetricToggle(metric.key)}
                className="rounded"
              />
              <span 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: metric.color }}
              ></span>
              <span className="text-gray-300">{metric.label}</span>
            </label>
          ))}
        </div>
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
            tickFormatter={formatNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: '#d1d5db' }}
            iconType="rect"
          />
          
          {/* Render bars for selected metrics */}
          {availableMetrics
            .filter(metric => selectedMetrics.includes(metric.key))
            .map(metric => (
              <Bar 
                key={metric.key}
                dataKey={metric.key} 
                name={metric.label}
                fill={metric.color}
                radius={[2, 2, 0, 0]}
              />
            ))
          }
        </BarChart>
      </ResponsiveContainer>
      
      {/* Chart Info */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        Select metrics above to compare financial data across periods
      </div>
    </div>
  );
};

export default FinancialBarChart;