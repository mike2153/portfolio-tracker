"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { front_api_get_stock_prices } from '@/lib/front_api_client';
import { StockChart } from '.';
import type { StockPriceData } from '@/lib/front_api_client';

interface ResearchStockChartProps {
  symbol: string;
  height?: number;
  width?: number;
  showVolume?: boolean;
  compareSymbols?: string[];
  theme?: 'dark' | 'light';
}

const ResearchStockChart: React.FC<ResearchStockChartProps> = ({
  symbol,
  height = 400,
  width,
  showVolume = false,
  compareSymbols = [],
  theme = 'dark',
}) => {
  const [timePeriod, _setTimePeriod] = useState('1Y');
  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'area'>('line');

  // Fetch main symbol data
  const { data: mainData, isLoading: mainLoading } = useQuery({
    queryKey: ['stock-prices', symbol, timePeriod],
    queryFn: () => front_api_get_stock_prices(symbol, timePeriod),
    enabled: !!symbol,
  });

  // Fetch comparison symbols data - use individual queries with fixed length
  // React hooks must be called unconditionally, so we create fixed number of queries
  const comparisonQuery1 = useQuery({
    queryKey: ['stock-prices', compareSymbols[0], timePeriod],
    queryFn: () => front_api_get_stock_prices(compareSymbols[0]!, timePeriod),
    enabled: !!compareSymbols[0] && compareSymbols.length > 0,
  });
  
  const comparisonQuery2 = useQuery({
    queryKey: ['stock-prices', compareSymbols[1], timePeriod],
    queryFn: () => front_api_get_stock_prices(compareSymbols[1]!, timePeriod),
    enabled: !!compareSymbols[1] && compareSymbols.length > 1,
  });
  
  const comparisonQuery3 = useQuery({
    queryKey: ['stock-prices', compareSymbols[2], timePeriod],
    queryFn: () => front_api_get_stock_prices(compareSymbols[2]!, timePeriod),
    enabled: !!compareSymbols[2] && compareSymbols.length > 2,
  });
  
  // Combine results into array for backwards compatibility
  const comparisonQueries = [comparisonQuery1, comparisonQuery2, comparisonQuery3].slice(0, compareSymbols.length);

  // Format data for chart
  const chartData = React.useMemo(() => {
    const data = [];

    // Add main symbol data
    if (mainData?.success && mainData.data?.price_data) {
      data.push({
        symbol: symbol,
        data: mainData.data.price_data.map((point: StockPriceData) => ({
          date: new Date(point.time),
          price: point.close,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: point.volume,
        })),
        color: '#3b82f6',
      });
    }

    // Add comparison data
    comparisonQueries.forEach((query, index) => {
      if (query.data?.success && query.data.data?.price_data) {
        const compareSymbol = compareSymbols[index];
        data.push({
          symbol: compareSymbol,
          data: query.data.data.price_data.map((point: StockPriceData) => ({
            date: new Date(point.time),
            price: point.close,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
          })),
        });
      }
    });

    return data;
  }, [mainData, comparisonQueries, symbol, compareSymbols]);

  const isLoading = mainLoading || comparisonQueries.some(q => q.isLoading);

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
          <p style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>Loading price data...</p>
        </div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
        borderRadius: '8px',
      }}>
        <p style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>No price data available</p>
      </div>
    );
  }

  return (
    <div>
      {/* Chart Type Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px',
        justifyContent: 'flex-end',
      }}>
        {(['line', 'candlestick', 'area'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setChartType(type)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: chartType === type 
                ? '#3b82f6' 
                : theme === 'dark' ? '#374151' : '#e5e7eb',
              color: chartType === type 
                ? '#fff' 
                : theme === 'dark' ? '#d1d5db' : '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              textTransform: 'capitalize',
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Chart */}
      <StockChart
        data={chartData}
        height={height}
        width={width || 800}
        showVolume={showVolume}
        chartType={chartType}
        timePeriod={timePeriod}
        showLegend={compareSymbols.length > 0}
        theme={theme}
        compareMode={compareSymbols.length > 0}
      />
    </div>
  );
};

export default ResearchStockChart;