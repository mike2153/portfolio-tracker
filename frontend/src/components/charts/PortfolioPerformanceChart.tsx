"use client";

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { front_api_get_performance, front_api_get_stock_prices } from '@/lib/front_api_client';
import { StockChart } from '.';
import { formatCurrency, formatPercentage } from '@/lib/front_api_client';
import type { APIResponse, StockPricesResponse } from '@/types/index';

interface PerformanceHistoryPoint {
  date: string;
  value: number;
}

interface PerformanceResponse extends APIResponse {
  data?: {
    portfolio_history: PerformanceHistoryPoint[];
  };
}

interface PortfolioPerformanceChartProps {
  height?: number;
  width?: number;
  initialPeriod?: string;
  benchmarks?: string[];
  theme?: 'dark' | 'light';
}

const DEFAULT_BENCHMARKS = ['SPY', 'QQQ', 'DIA'];

const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({
  height = 400,
  width,
  initialPeriod = '1Y',
  benchmarks = ['SPY'],
  theme = 'dark',
}) => {
  const [timePeriod, _setTimePeriod] = useState(initialPeriod);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(benchmarks);
  const [compareMode, setCompareMode] = useState(true);

  // Fetch portfolio performance data
  const { data: portfolioData, isLoading: portfolioLoading } = useQuery<PerformanceResponse>({
    queryKey: ['portfolio-performance', timePeriod],
    queryFn: () => front_api_get_performance(timePeriod) as Promise<PerformanceResponse>,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch benchmark data for each selected benchmark using dynamic queries
  const enabledBenchmarks = selectedBenchmarks.slice(0, 3); // Limit to max 3 benchmarks for performance
  
  const benchmarkQueries = [
    useQuery<StockPricesResponse>({
      queryKey: ['benchmark-prices', enabledBenchmarks[0], timePeriod],
      queryFn: () => front_api_get_stock_prices(enabledBenchmarks[0]!, timePeriod),
      enabled: enabledBenchmarks.length > 0 && !!enabledBenchmarks[0],
    }),
    useQuery<StockPricesResponse>({
      queryKey: ['benchmark-prices', enabledBenchmarks[1], timePeriod],
      queryFn: () => front_api_get_stock_prices(enabledBenchmarks[1]!, timePeriod),
      enabled: enabledBenchmarks.length > 1 && !!enabledBenchmarks[1],
    }),
    useQuery<StockPricesResponse>({
      queryKey: ['benchmark-prices', enabledBenchmarks[2], timePeriod],
      queryFn: () => front_api_get_stock_prices(enabledBenchmarks[2]!, timePeriod),
      enabled: enabledBenchmarks.length > 2 && !!enabledBenchmarks[2],
    }),
  ].filter((_, index) => index < enabledBenchmarks.length);

  // Combine all data into chart format
  const chartData = useMemo(() => {
    const data = [];

    // Add portfolio data
    if (portfolioData?.data?.portfolio_history) {
      data.push({
        symbol: 'Portfolio',
        data: portfolioData.data.portfolio_history.map((point: PerformanceHistoryPoint) => ({
          date: new Date(point.date),
          price: point.value,
        })),
        color: '#3b82f6',
      });
    }

    // Add benchmark data
    benchmarkQueries.forEach((query, index) => {
      if (query.data?.success && query.data.data?.price_data && enabledBenchmarks[index]) {
        const symbol = enabledBenchmarks[index];
        data.push({
          symbol,
          data: query.data.data.price_data.map((point) => ({
            date: new Date(point.time),
            price: point.close,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
          })),
        });
      }
    });

    return data;
  }, [portfolioData, benchmarkQueries, enabledBenchmarks]);

  const isLoading = portfolioLoading || benchmarkQueries.some(q => q.isLoading);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (!chartData.length) return null;

    return chartData.map(series => {
      const firstValue = series.data[0]?.price || 1;
      const lastValue = series.data[series.data.length - 1]?.price || 1;
      const change = lastValue - firstValue;
      const changePercent = (change / firstValue) * 100;

      return {
        symbol: series.symbol,
        currentValue: lastValue,
        change,
        changePercent,
        color: series.color,
      };
    });
  }, [chartData]);

  const handleBenchmarkToggle = (symbol: string) => {
    if (selectedBenchmarks.includes(symbol)) {
      setSelectedBenchmarks(prev => prev.filter(s => s !== symbol));
    } else {
      setSelectedBenchmarks(prev => [...prev, symbol]);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
        borderRadius: '8px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>Loading performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Performance Metrics */}
      {performanceMetrics && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(${Math.min(performanceMetrics.length, 4)}, 1fr)`, 
          gap: '16px',
          marginBottom: '24px',
        }}>
          {performanceMetrics.map(metric => {
            const isPositive = metric.changePercent >= 0;
            return (
              <div
                key={metric.symbol}
                style={{
                  backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6',
                  padding: '16px',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${metric.color || '#6b7280'}`,
                }}
              >
                <h4 style={{ 
                  color: theme === 'dark' ? '#d1d5db' : '#374151',
                  fontSize: '14px',
                  marginBottom: '8px',
                }}>
                  {metric.symbol}
                </h4>
                <p style={{ 
                  color: theme === 'dark' ? '#fff' : '#111827',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                }}>
                  {formatCurrency(metric.currentValue)}
                </p>
                <p style={{ 
                  color: isPositive ? '#10b981' : '#ef4444',
                  fontSize: '14px',
                }}>
                  {isPositive ? '+' : ''}{formatCurrency(metric.change)} ({formatPercentage(metric.changePercent / 100)})
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCompareMode(!compareMode)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: compareMode ? '#3b82f6' : theme === 'dark' ? '#374151' : '#e5e7eb',
              color: compareMode ? '#fff' : theme === 'dark' ? '#d1d5db' : '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {compareMode ? 'Percentage' : 'Absolute'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {DEFAULT_BENCHMARKS.map(symbol => (
            <button
              key={symbol}
              onClick={() => handleBenchmarkToggle(symbol)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedBenchmarks.includes(symbol) 
                  ? '#3b82f6' 
                  : theme === 'dark' ? '#374151' : '#e5e7eb',
                color: selectedBenchmarks.includes(symbol) 
                  ? '#fff' 
                  : theme === 'dark' ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <StockChart
        data={chartData}
        height={height}
        width={width || 800}
        chartType="line"
        timePeriod={timePeriod}
        showLegend={true}
        theme={theme}
        title="Portfolio Performance"
        compareMode={compareMode}
      />
    </div>
  );
};

export default PortfolioPerformanceChart;