import React, { useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { UniversalChart, ChartSkeleton } from './index';

/**
 * Example usage of UniversalChart as a drop-in replacement for ApexCharts
 * This demonstrates all the chart types and features supported
 */
export default function UniversalChartExample() {
  const [selectedRange, setSelectedRange] = useState('1M');
  const [isLoading, setIsLoading] = useState(false);

  // Example portfolio data similar to PortfolioChartApex
  const portfolioData = {
    portfolio: [
      [1704067200000, 100000],
      [1704153600000, 102000],
      [1704240000000, 101500],
      [1704326400000, 103000],
      [1704412800000, 104500],
      [1704499200000, 105000],
      [1704585600000, 106500],
    ],
    benchmark: [
      [1704067200000, 100000],
      [1704153600000, 101000],
      [1704240000000, 101800],
      [1704326400000, 102500],
      [1704412800000, 103200],
      [1704499200000, 103800],
      [1704585600000, 104500],
    ],
  };

  // Example allocation data for donut chart
  const allocationData = {
    labels: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'],
    values: [35000, 28000, 22000, 15000, 10000],
  };

  // Simulate loading
  const handleRangeChange = (range: string) => {
    setIsLoading(true);
    setSelectedRange(range);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-4">
        <Text className="text-2xl font-bold text-white mb-6">Universal Chart Examples</Text>

        {/* Example 1: Portfolio vs Benchmark (Area Chart) */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-2">
            1. Portfolio Performance Chart (Area)
          </Text>
          <UniversalChart
            data={[
              {
                name: 'Your Portfolio',
                data: portfolioData.portfolio,
                color: '#10b981',
              },
              {
                name: 'S&P 500',
                data: portfolioData.benchmark,
                color: '#9ca3af',
              },
            ]}
            type="area"
            height={400}
            title="Portfolio vs Benchmark"
            xAxisType="datetime"
            yAxisFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            tooltipFormatter={(value) => `$${value.toLocaleString()}`}
            showLegend={true}
            timeRanges={[
              { id: '7D', label: '7D' },
              { id: '1M', label: '1M' },
              { id: '3M', label: '3M' },
              { id: '1Y', label: '1Y' },
              { id: 'YTD', label: 'YTD' },
              { id: 'MAX', label: 'MAX' },
            ]}
            selectedRange={selectedRange}
            onRangeChange={handleRangeChange}
            isLoading={isLoading}
          />
        </View>

        {/* Example 2: Same data as Line Chart */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-2">
            2. Portfolio Performance Chart (Line)
          </Text>
          <UniversalChart
            data={[
              {
                name: 'Your Portfolio',
                data: portfolioData.portfolio,
                color: '#3b82f6',
              },
              {
                name: 'S&P 500',
                data: portfolioData.benchmark,
                color: '#f59e0b',
              },
            ]}
            type="line"
            height={350}
            title="Portfolio Trend"
            xAxisType="datetime"
            yAxisFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            tooltipFormatter={(value) => `$${value.toLocaleString()}`}
            showLegend={true}
          />
        </View>

        {/* Example 3: Allocation Donut Chart */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-2">
            3. Portfolio Allocation (Donut)
          </Text>
          <UniversalChart
            data={[]} // Not used for donut charts
            type="donut"
            height={300}
            title="Holdings by Asset"
            donutLabels={allocationData.labels}
            donutValues={allocationData.values}
            yAxisFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            showLegend={true}
          />
        </View>

        {/* Example 4: Loading State */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-2">
            4. Loading State Example
          </Text>
          <ChartSkeleton
            height={350}
            title="Loading Chart"
            showTimeRanges={true}
            type="area"
          />
        </View>

        {/* Example 5: Error State */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-white mb-2">
            5. Error State Example
          </Text>
          <UniversalChart
            data={[]}
            type="area"
            height={350}
            title="Error Example"
            error="Failed to load chart data. Please try again."
            onRetry={() => console.log('Retry clicked')}
          />
        </View>

        {/* Usage Notes */}
        <View className="bg-gray-800 rounded-lg p-4 mt-6">
          <Text className="text-white font-semibold mb-2">Usage Notes:</Text>
          <Text className="text-gray-300 text-sm mb-1">
            • UniversalChart supports line, area, and donut chart types
          </Text>
          <Text className="text-gray-300 text-sm mb-1">
            • Data format matches ApexCharts: Array of [timestamp, value] or {'{x, y}'}
          </Text>
          <Text className="text-gray-300 text-sm mb-1">
            • All props from ApexChart are supported for easy migration
          </Text>
          <Text className="text-gray-300 text-sm mb-1">
            • ChartSkeleton provides loading states with matching styles
          </Text>
          <Text className="text-gray-300 text-sm mb-1">
            • Uses Victory Native for performant native rendering
          </Text>
          <Text className="text-gray-300 text-sm mb-1">
            • Supports dark/light mode themes
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}