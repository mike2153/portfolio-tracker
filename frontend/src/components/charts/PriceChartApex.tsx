'use client';

import React, { useEffect, useState, useMemo } from 'react';
// import ApexCharts from 'apexcharts';
import { ApexChart } from '.';
import type { PriceDataPoint, TimePeriod } from '@/types/stock-research';

interface PriceChartApexProps {
  data: PriceDataPoint[];
  ticker: string;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  height?: number;
  isLoading?: boolean;
  chartType?: 'line' | 'candlestick' | 'mountain';
  showVolume?: boolean;
  background?: string;
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
  { value: '5y', label: '5Y' },
  { value: 'max', label: 'MAX' },
];

export default function PriceChartApex({ 
  data, 
  ticker, 
  period, 
  onPeriodChange, 
  height = 400,
  isLoading = false,
  chartType = 'candlestick',
  showVolume = true,
  background = 'transparent'
}: PriceChartApexProps) {
  // Unique chart ID for zoom operations
  const chartId = `price-chart-${ticker}`;
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<{ amount: number; percentage: number } | null>(null);
  const [currentChartType, _setCurrentChartType] = useState<'line' | 'candlestick' | 'mountain'>(chartType);

  console.log('[PriceChartApex] Rendering with data:', {
    dataLength: data?.length,
    ticker,
    period,
    isLoading,
    chartType: currentChartType,
    firstDataPoint: data?.[0],
    lastDataPoint: data?.[data.length - 1]
  });

  // Calculate price change
  useEffect(() => {
    if (data.length > 1) {
      const latest = data[data.length - 1];
      const previous = data[data.length - 2];
      
      if (latest && previous) {
        const change = latest.close - previous.close;
        const changePercent = (change / previous.close) * 100;
        
        setCurrentPrice(latest.close);
        setPriceChange({ amount: change, percentage: changePercent });
      }
    }
  }, [data]);

  // Prepare chart data based on chart type
  const chartData = useMemo(() => {
    console.log('[PriceChartApex] Preparing chart data for type:', currentChartType);
    
    if (!data || data.length === 0) {
      return [];
    }

    if (currentChartType === 'candlestick') {
      // For candlestick charts, we need OHLC data
      const candlestickData = data.map(point => {
        const timestamp = new Date(point.time).getTime();
        return {
          x: timestamp,
          y: [point.open, point.high, point.low, point.close]
        };
      });

      return [{
        name: `${ticker} Price`,
        data: candlestickData
      }];
    } else {
      // For line and mountain (area) charts, use close price
      console.log('[PriceChartApex] Raw data point structure:', data[0]);
      const priceData = data.map((point, index) => {
        // Check different possible field names for the date
        const dateValue = point.time || (point as any).date || (point as any).timestamp || (point as any).x;
        if (index === 0) {
          console.log('[PriceChartApex] First point date field check:', {
            time: point.time,
            date: (point as any).date,
            timestamp: (point as any).timestamp,
            x: (point as any).x,
            allKeys: Object.keys(point)
          });
        }
        const timestamp = dateValue ? new Date(dateValue).getTime() : null;
        if (timestamp === null || isNaN(timestamp)) {
          console.warn('[PriceChartApex] Invalid timestamp for point:', point);
        }
        return [timestamp, point.close] as [number, number];
      });

      const result = [{
        name: `${ticker} Price`,
        data: priceData,
        color: '#04B2F8'
      }];
      console.log('[PriceChartApex] Line/Mountain chart data prepared:', {
        seriesCount: result.length,
        dataPointsInSeries: result[0]?.data?.length || 0,
        firstDataPoint: result[0]?.data?.[0],
        lastDataPoint: result[0]?.data?.[result[0]?.data?.length - 1]
      });
      return result;
    }
  }, [data, currentChartType, ticker]);

  // Prepare volume data if enabled
  const volumeData = useMemo(() => {
    if (!showVolume || !data || data.length === 0) return [];

    const volumeSeries = data.map(point => {
      const timestamp = new Date(point.time).getTime();
      return [timestamp, point.volume] as [number, number];
    });

    return [{
      name: 'Volume',
      data: volumeSeries,
      color: '#6b7280'
    }];
  }, [data, showVolume]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (change: number, percentage: number) => {
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green-400' : 'text-red-400';
    
    return (
      <span className={color}>
        {sign}{formatPrice(change)} ({sign}{percentage.toFixed(2)}%)
      </span>
    );
  };

  const getApexChartType = () => {
    switch (currentChartType) {
      case 'candlestick':
        return 'candlestick';
      case 'mountain':
        return 'area';
      case 'line':
      default:
        return 'line';
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {ticker} Price Chart
          </h3>
          {currentPrice && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white font-medium">
                {formatPrice(currentPrice)}
              </span>
              {priceChange && formatChange(priceChange.amount, priceChange.percentage)}
            </div>
          )}
        </div>
        
        {/* Time Period Selector with client-side zoom */}
        <div className="flex flex-wrap gap-1 mt-2">
          {TIME_PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                // Update period state - this will trigger a new data fetch with the correct date range
                onPeriodChange(value);
                console.log('[PriceChartApex] Period changed to:', value);
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                period === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {/* Main Price Chart */}
        {(() => {
          console.log('[PriceChartApex] Passing to ApexChart:', {
            chartDataLength: chartData.length,
            chartDataFirstSeries: chartData[0],
            chartType: getApexChartType()
          });
          return null;
        })()}
        <ApexChart
          data={chartData}
          type={getApexChartType() as any}
          height={height}
          additionalOptions={{ 
            chart: { 
              id: chartId, 
              background: background,
              zoom: {
                enabled: false  // Disable zoom since data is already filtered by date range
              }
            }
          }}
          yAxisFormatter={(value) => formatPrice(value)}
          tooltipFormatter={(value) => formatPrice(value)}
          showLegend={false}
          showToolbar={false}
          isLoading={isLoading}
          error={!isLoading && data.length === 0 ? `No price data available for ${ticker}` : null}
          className="mb-4"
        />

        {/* Volume Chart (if enabled) */}
        {showVolume && volumeData.length > 0 && (
          <ApexChart
            data={volumeData}
            type="bar"
            height={120}
            yAxisFormatter={(value) => value.toLocaleString()}
            tooltipFormatter={(value) => value.toLocaleString()}
            showLegend={false}
            showToolbar={false}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Chart Info */}
      <div className="mt-2 text-xs text-gray-400 flex justify-between items-center">
        <span>Data provided by Alpha Vantage • {data.length} data points</span>
        <div className="flex gap-4">
          <span>Chart: {
            currentChartType === 'candlestick' ? 'Candlesticks' : 
            currentChartType === 'mountain' ? 'Mountain' : 'Line'
          }</span>
          {showVolume && <span>Volume: Enabled</span>}
        </div>
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Debug: {data.length} price points, Type: {currentChartType}, Period: {period}
        </div>
      )}
    </div>
  );
}