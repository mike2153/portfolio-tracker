'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { RefreshCw, BarChart3, TrendingUp, TrendingDown, Minus, CheckSquare, Square } from 'lucide-react';
import ApexChart from './ApexChart';
import ApexListView from './ApexListView';
import type { ListViewColumn } from './ApexListView';

export interface FinancialBarChartApexEnhancedProps {
  data: Array<{
    [key: string]: any;
    fiscalDateEnding?: string;
  }>;
  statementType: 'income' | 'balance' | 'cashflow';
  selectedMetrics: string[];
  onMetricToggle: (metric: string) => void;
  height?: number;
  ticker: string;
  selectedPeriod: 'annual' | 'quarterly';
  onPeriodChange: (period: 'annual' | 'quarterly') => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface FinancialMetric {
  key: string;
  label: string;
  category: string;
  isSelected: boolean;
  currentValue: number;
  previousValue: number;
  growthRate: number;
  cagr: number;
  hasData: boolean;
}

// Define metrics for each statement type
const FINANCIAL_METRICS = {
  income: [
    { key: 'totalRevenue', label: 'Total Revenue', category: 'Revenue' },
    { key: 'costOfRevenue', label: 'Cost of Revenue', category: 'Revenue' },
    { key: 'grossProfit', label: 'Gross Profit', category: 'Revenue' },
    { key: 'operatingIncome', label: 'Operating Income', category: 'Operating' },
    { key: 'operatingExpenses', label: 'Operating Expenses', category: 'Operating' },
    { key: 'researchAndDevelopment', label: 'R&D Expenses', category: 'Operating' },
    { key: 'sellingGeneralAndAdministrative', label: 'SG&A Expenses', category: 'Operating' },
    { key: 'netIncome', label: 'Net Income', category: 'Profit' },
    { key: 'ebitda', label: 'EBITDA', category: 'Profit' },
    { key: 'interestExpense', label: 'Interest Expense', category: 'Other' },
    { key: 'incomeTaxExpense', label: 'Income Tax Expense', category: 'Other' }
  ],
  balance: [
    { key: 'totalAssets', label: 'Total Assets', category: 'Assets' },
    { key: 'totalCurrentAssets', label: 'Current Assets', category: 'Assets' },
    { key: 'cashAndCashEquivalentsAtCarryingValue', label: 'Cash & Cash Equivalents', category: 'Assets' },
    { key: 'inventory', label: 'Inventory', category: 'Assets' },
    { key: 'propertyPlantEquipment', label: 'Property, Plant & Equipment', category: 'Assets' },
    { key: 'totalLiabilities', label: 'Total Liabilities', category: 'Liabilities' },
    { key: 'totalCurrentLiabilities', label: 'Current Liabilities', category: 'Liabilities' },
    { key: 'longTermDebt', label: 'Long-Term Debt', category: 'Liabilities' },
    { key: 'totalShareholderEquity', label: 'Shareholder Equity', category: 'Equity' },
    { key: 'retainedEarnings', label: 'Retained Earnings', category: 'Equity' },
    { key: 'commonStock', label: 'Common Stock', category: 'Equity' }
  ],
  cashflow: [
    { key: 'operatingCashflow', label: 'Operating Cash Flow', category: 'Operating' },
    { key: 'netIncomeFromContinuingOps', label: 'Net Income (Continuing Ops)', category: 'Operating' },
    { key: 'depreciationDepletionAndAmortization', label: 'Depreciation & Amortization', category: 'Operating' },
    { key: 'changeInWorkingCapital', label: 'Change in Working Capital', category: 'Operating' },
    { key: 'cashflowFromInvestment', label: 'Cash Flow from Investing', category: 'Investing' },
    { key: 'capitalExpenditures', label: 'Capital Expenditures', category: 'Investing' },
    { key: 'cashflowFromFinancing', label: 'Cash Flow from Financing', category: 'Financing' },
    { key: 'dividendsPaid', label: 'Dividends Paid', category: 'Financing' },
    { key: 'changeInCashAndCashEquivalents', label: 'Net Change in Cash', category: 'Net Change' }
  ]
};

const FinancialBarChartApexEnhanced: React.FC<FinancialBarChartApexEnhancedProps> = ({
  data,
  statementType,
  selectedMetrics,
  onMetricToggle,
  height = 450,
  ticker,
  selectedPeriod,
  onPeriodChange,
  isLoading = false,
  onRefresh
}) => {
  const [showMetricsList, setShowMetricsList] = useState(true);

  console.log('[FinancialBarChartApexEnhanced] Rendering with data:', {
    dataLength: data?.length,
    statementType,
    selectedMetrics: selectedMetrics.length,
    selectedPeriod,
    ticker
  });

  // Format financial numbers
  const formatNumber = useCallback((value: number) => {
    if (isNaN(value) || value === 0) return '$0';
    
    const absNum = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    if (absNum >= 1e12) {
      return `${sign}$${(absNum / 1e12).toFixed(1)}T`;
    } else if (absNum >= 1e9) {
      return `${sign}$${(absNum / 1e9).toFixed(1)}B`;
    } else if (absNum >= 1e6) {
      return `${sign}$${(absNum / 1e6).toFixed(1)}M`;
    } else if (absNum >= 1e3) {
      return `${sign}$${(absNum / 1e3).toFixed(1)}K`;
    } else {
      return `${sign}$${absNum.toFixed(0)}`;
    }
  }, []);

  // Calculate growth rate with proper validation and clamping
  const calculateGrowthRate = useCallback((current: number, previous: number): number => {
    // Handle invalid inputs
    if (!current && current !== 0) return 0;
    if (!previous && previous !== 0) return 0;
    if (isNaN(current) || isNaN(previous)) return 0;
    if (Math.abs(previous) < 1e-6) return 0; // Avoid division by nearly zero
    
    const growthRate = ((current - previous) / Math.abs(previous)) * 100;
    
    // Clamp extreme values to reasonable range
    if (Math.abs(growthRate) > 200) return 0; // Filter out unrealistic growth rates
    if (!isFinite(growthRate)) return 0;
    
    return growthRate;
  }, []);

  // Calculate CAGR (Compound Annual Growth Rate) with validation
  const calculateCAGR = useCallback((values: number[], periods: number): number => {
    if (values.length < 2 || periods <= 0) return 0;
    
    // Filter out invalid values
    const validValues = values.filter(v => !isNaN(v) && isFinite(v) && v !== null && v !== undefined);
    if (validValues.length < 2) return 0;
    
    const startValue = validValues[0];
    const endValue = validValues[validValues.length - 1];
    
    if (!startValue || Math.abs(startValue) < 1e-6) return 0; // Avoid division by nearly zero
    if (!endValue && endValue !== 0) return 0;
    
    const cagr = (Math.pow(Math.abs(endValue / startValue), 1 / periods) - 1) * 100;
    
    // Clamp extreme CAGR values
    if (Math.abs(cagr) > 200 || !isFinite(cagr)) return 0;
    
    return cagr;
  }, []);

  // Process financial metrics with growth calculations
  const processedMetrics = useMemo(() => {
    const metrics = FINANCIAL_METRICS[statementType] || [];
    
    return metrics.map(metric => {
      const isSelected = selectedMetrics.includes(metric.key);
      
      // Get values for the metric across all periods
      const values = data.map(period => {
        const value = period[metric.key];
        return typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
      }).filter(v => !isNaN(v));
      
      const hasData = values.some(v => v !== 0);
      const currentValue = values[0] || 0; // Most recent period
      const previousValue = values[1] || 0; // Previous period
      
      const growthRate = calculateGrowthRate(currentValue, previousValue);
      const cagr = calculateCAGR(values.reverse(), Math.min(values.length - 1, 5)); // Up to 5 years
      
      return {
        ...metric,
        isSelected,
        currentValue,
        previousValue,
        growthRate,
        cagr,
        hasData
      };
    });
  }, [data, statementType, selectedMetrics, calculateGrowthRate, calculateCAGR]);

  // Prepare chart data for selected metrics
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const selectedMetricKeys = selectedMetrics.filter(key => 
      processedMetrics.find(m => m.key === key)?.hasData
    );

    if (selectedMetricKeys.length === 0) return [];

    // Create series for each selected metric
    const valueSeries = selectedMetricKeys.map((metricKey, index) => {
      const metric = processedMetrics.find(m => m.key === metricKey);
      const metricData = data.map(period => {
        const value = period[metricKey];
        const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
        return {
          x: period.fiscalDateEnding || `Period ${data.indexOf(period) + 1}`,
          y: numValue
        };
      });

      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
      
      return {
        name: metric?.label || metricKey,
        data: metricData,
        type: 'column',
        yAxisIndex: 0,
        color: colors[index % colors.length]
      };
    });

    // Create growth rate series (line chart on secondary axis)
    const growthSeries = selectedMetricKeys.map((metricKey, index) => {
      const growthData = data.slice(1).map((period, idx) => {
        const currentValue = period[metricKey];
        const previousValue = data[idx][metricKey];
        
        const current = typeof currentValue === 'string' ? parseFloat(currentValue) || 0 : currentValue || 0;
        const previous = typeof previousValue === 'string' ? parseFloat(previousValue) || 0 : previousValue || 0;
        
        const growthRate = calculateGrowthRate(current, previous);
        
        return {
          x: period.fiscalDateEnding || `Period ${idx + 2}`,
          y: growthRate
        };
      }).filter(point => point.y !== 0 && !isNaN(point.y) && isFinite(point.y)); // Filter out invalid data points

      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
      
      return {
        name: `${processedMetrics.find(m => m.key === metricKey)?.label || metricKey} Growth %`,
        data: growthData,
        type: 'line',
        yAxisIndex: 1,
        color: colors[index % colors.length]
      };
    });

    return [...valueSeries, ...growthSeries];
  }, [data, selectedMetrics, processedMetrics, calculateGrowthRate]);

  // Columns for metrics list
  const listViewColumns: ListViewColumn<FinancialMetric>[] = [
    {
      key: 'isSelected',
      label: '',
      width: '40px',
      render: (_, item) => (
        <button
          onClick={() => onMetricToggle(item.key)}
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          {item.isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      )
    },
    {
      key: 'label',
      label: 'Financial Metric',
      searchable: true,
      sortable: true,
      render: (value, item) => (
        <div className="flex flex-col">
          <span className="text-white font-medium">{value}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">
              Current: {formatNumber(item.currentValue)}
            </span>
            {item.growthRate !== 0 && (
              <span className={`text-xs flex items-center gap-1 ${
                item.growthRate > 0 ? 'text-green-400' : 
                item.growthRate < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {item.growthRate > 0 ? <TrendingUp className="w-3 h-3" /> : 
                 item.growthRate < 0 ? <TrendingDown className="w-3 h-3" /> : 
                 <Minus className="w-3 h-3" />}
                {Math.abs(item.growthRate).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'growthRate',
      label: 'Growth Rate',
      sortable: true,
      render: (value) => (
        <span className={`font-mono ${
          value > 0 ? 'text-green-400' : 
          value < 0 ? 'text-red-400' : 'text-gray-400'
        }`}>
          {value !== 0 ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : 'N/A'}
        </span>
      ),
      width: '100px'
    },
    {
      key: 'cagr',
      label: 'CAGR',
      sortable: true,
      render: (value) => (
        <span className={`font-mono ${
          value > 0 ? 'text-green-400' : 
          value < 0 ? 'text-red-400' : 'text-gray-400'
        }`}>
          {value !== 0 ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : 'N/A'}
        </span>
      ),
      width: '100px'
    }
  ];

  // Group metrics by category
  const categoryGroups = useMemo(() => {
    const categories = [...new Set(processedMetrics.map(m => m.category))];
    return categories.map(category => ({
      key: category.toLowerCase().replace(/\s+/g, '_'),
      label: category,
      items: processedMetrics
        .filter(m => m.category === category)
        .map(m => m.key) as Array<keyof FinancialMetric>
    }));
  }, [processedMetrics]);

  return (
    <div className="w-full space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="text-lg font-semibold text-white">
            {statementType === 'income' && 'Income Statement Analysis'}
            {statementType === 'balance' && 'Balance Sheet Analysis'} 
            {statementType === 'cashflow' && 'Cash Flow Analysis'}
          </h4>
          <p className="text-sm text-gray-400 mt-1">
            {ticker} • {selectedPeriod === 'annual' ? 'Annual' : 'Quarterly'} • 
            {selectedMetrics.length} metric{selectedMetrics.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        <div className="flex gap-2">
          {/* Period Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => onPeriodChange('annual')}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                selectedPeriod === 'annual'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => onPeriodChange('quarterly')}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                selectedPeriod === 'quarterly'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Quarterly
            </button>
          </div>

          {/* Metrics List Toggle */}
          <button
            onClick={() => setShowMetricsList(!showMetricsList)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white text-sm transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            {showMetricsList ? 'Hide' : 'Show'} Metrics
          </button>

          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Metrics Selection List */}
      {showMetricsList && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-md font-medium text-white">Select Financial Metrics</h5>
            <div className="text-sm text-gray-400">
              {selectedMetrics.length} of {processedMetrics.length} selected
            </div>
          </div>
          
          <ApexListView
            data={processedMetrics}
            columns={listViewColumns}
            getItemKey={(item) => item.key}
            showSearch={true}
            showPagination={false}
            searchPlaceholder="Search financial metrics..."
            categoryGroups={categoryGroups}
            className="bg-transparent p-0 shadow-none"
            emptyMessage="No financial metrics available"
          />
        </div>
      )}

      {/* Chart */}
      <div className="bg-gray-800 rounded-lg p-6">
        {chartData.length > 0 ? (
          <ApexChart
            data={chartData}
            type="bar" // Use bar chart type to ensure bars are visible
            height={height}
            title={`${ticker} Financial Metrics - ${selectedPeriod === 'annual' ? 'Annual' : 'Quarterly'} Data`}
            yAxisFormatter={formatNumber}
            tooltipFormatter={(value: number) => formatNumber(value)}
            showLegend={true}
            showToolbar={true}
            isLoading={isLoading}
            error={chartData.length === 0 ? 'No data available for selected metrics' : undefined}
            // Additional chart options for dual axis
            additionalOptions={{
              chart: {
                type: 'bar', // Use bar type as base
                stacked: false
              },
              stroke: {
                width: Array(selectedMetrics.length).fill(0).concat(Array(selectedMetrics.length).fill(2)) // Bars have 0 width, lines have 2px width
              },
              plotOptions: {
                bar: {
                  columnWidth: '60%'
                }
              },
              yaxis: [
                {
                  title: {
                    text: 'Financial Values',
                    style: { color: '#9ca3af' }
                  },
                  labels: {
                    formatter: (value: number) => formatNumber(value),
                    style: { colors: '#9ca3af' }
                  }
                },
                {
                  opposite: true,
                  min: -200,
                  max: 200,
                  title: {
                    text: 'Growth Rate (%)',
                    style: { color: '#9ca3af' }
                  },
                  labels: {
                    formatter: (value: number) => `${value.toFixed(1)}%`,
                    style: { colors: '#9ca3af' }
                  }
                }
              ],
              legend: {
                position: 'top',
                horizontalAlign: 'left',
                labels: { colors: '#9ca3af' }
              }
            }}
          />
        ) : (
          <div className="text-center text-gray-400 py-12">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No metrics selected</p>
            <p className="text-sm">
              Select financial metrics from the list above to display the chart
            </p>
          </div>
        )}
      </div>


      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500">
          Debug: {data.length} periods, {processedMetrics.length} metrics, {selectedMetrics.length} selected, {chartData.length} series
        </div>
      )}
    </div>
  );
};

export default FinancialBarChartApexEnhanced;