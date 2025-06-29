'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineData, IChartApi, ISeriesApi ,UTCTimestamp } from 'lightweight-charts';
import type { PriceDataPoint, TimePeriod } from '@/types/stock-research';

interface PriceChartProps {
  data: PriceDataPoint[];
  ticker: string;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  height?: number;
  isLoading?: boolean;
}

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
  { value: 'max', label: 'MAX' },
];

export default function PriceChart({ 
  data, 
  ticker, 
  period, 
  onPeriodChange, 
  height = 400,
  isLoading = false 
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<{ amount: number; percentage: number } | null>(null);

  // Calculate price change
  useEffect(() => {
    if (data.length > 1) {
      const latest = data[data.length - 1];
      const previous = data[data.length - 2];
      
      const change = latest.close - previous.close;
      const changePercent = (change / previous.close) * 100;
      
      setCurrentPrice(latest.close);
      setPriceChange({ amount: change, percentage: changePercent });
    }
  }, [data]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: {  color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: {
          color: '#374151',
        },
        horzLines: {
          color: '#374151',
        },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#4b5563',
      },
      timeScale: {
        borderColor: '#4b5563',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: false,
        mouseWheel: true,
        pinch: true,
      },
    });
  //  const lineSeries = chart.addSeries(LineSeries, { color: '#2962FF' });

   /* chart.addSeries(LineSeries, { color: '#2962FF' });
    const lineSeries = chart.addLineSeries({
      color: '#10b981',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });
*/
   // chartRef.current = chart;
   // seriesRef.current = lineSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  // Update chart data
  useEffect(() => {
    if (!seriesRef.current || !data.length) return;

    const chartData: LineData[] = data.map(point => ({
      time: (new Date(point.time).getTime() / 1000) as UTCTimestamp,
      value: point.close,
    }));

    seriesRef.current.setData(chartData);

    // Auto-scale to fit data
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

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
        
        {/* Time Period Selector */}
        <div className="flex flex-wrap gap-1 mt-2 sm:mt-0">
          {TIME_PERIODS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onPeriodChange(value)}
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
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-gray-300">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Loading chart data...
            </div>
          </div>
        )}
        
        <div 
          ref={chartContainerRef} 
          className={`w-full bg-gray-800 rounded-lg ${isLoading ? 'opacity-50' : ''}`}
          style={{ height: `${height}px` }}
        />
        
        {!isLoading && data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            No price data available for {ticker}
          </div>
        )}
      </div>

      {/* Chart Info */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        Data provided by Alpha Vantage • {data.length} data points
      </div>
    </div>
  );
}