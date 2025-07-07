'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineData, CandlestickData, HistogramData, IChartApi, ISeriesApi, UTCTimestamp, LineSeries, AreaSeries } from 'lightweight-charts';
import type { PriceDataPoint, TimePeriod } from '@/types/stock-research';

interface PriceChartProps {
  data: PriceDataPoint[];
  ticker: string;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  height?: number;
  isLoading?: boolean;
  chartType?: 'line' | 'candlestick' | 'mountain';
  showVolume?: boolean;
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

export default function PriceChart({ 
  data, 
  ticker, 
  period, 
  onPeriodChange, 
  height = 400,
  isLoading = false,
  chartType = 'candlestick',
  showVolume = true
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<'Line' | 'Candlestick' | 'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<{ amount: number; percentage: number } | null>(null);
  const [currentChartType, setCurrentChartType] = useState<'line' | 'candlestick' | 'mountain'>(chartType);

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

    try {
      // Commenting out verbose debug logs
      // console.log('[PriceChart] Initializing chart for', ticker);
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
      
      if (!chart || typeof chart.addSeries !== 'function') {
        console.error('[PriceChart] Chart object is invalid or missing addSeries method');
        return;
      }
      
      // Add price series based on chart type
      let priceSeries;
      if (currentChartType === 'candlestick') {
        priceSeries = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        });
      } else if (currentChartType === 'mountain') {
        priceSeries = chart.addSeries(AreaSeries, {
          topColor: 'rgba(16, 185, 129, 0.56)',
          bottomColor: 'rgba(16, 185, 129, 0.04)',
          lineColor: 'rgba(16, 185, 129, 1)',
          lineWidth: 2,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        });
      } else {
        priceSeries = chart.addSeries(LineSeries, {
          color: '#10b981',
          lineWidth: 2,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
        });
      }

      // Add volume series if enabled
      let volumeSeries = null;
      if (showVolume) {
        volumeSeries = chart.addHistogramSeries({
          color: '#6b7280',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        });

        // Configure volume scale
        chart.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.7,
            bottom: 0,
          },
        });
      }

      chartRef.current = chart;
      priceSeriesRef.current = priceSeries;
      volumeSeriesRef.current = volumeSeries;

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
    } catch (error) {
      console.error('[PriceChart] Error initializing chart:', error);
    }
  }, [height, currentChartType, showVolume]);

  // Update chart data
  useEffect(() => {
    if (!priceSeriesRef.current || !data.length) return;

    try {
      // Prepare price data based on chart type
      if (currentChartType === 'candlestick') {
        const candlestickData: CandlestickData[] = data.map(point => ({
          time: (new Date(point.time).getTime() / 1000) as UTCTimestamp,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
        }));
        priceSeriesRef.current.setData(candlestickData);
      } else {
        // Both line and mountain charts use the same data format (LineData)
        const lineData: LineData[] = data.map(point => ({
          time: (new Date(point.time).getTime() / 1000) as UTCTimestamp,
          value: point.close,
        }));
        priceSeriesRef.current.setData(lineData);
      }

      // Update volume data if volume series exists
      if (volumeSeriesRef.current && showVolume) {
        const volumeData: HistogramData[] = data.map(point => ({
          time: (new Date(point.time).getTime() / 1000) as UTCTimestamp,
          value: point.volume,
          color: point.close >= point.open ? '#10b98150' : '#ef444450', // Semi-transparent
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      // Auto-scale to fit data
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch (error) {
      console.error('[PriceChart] Error updating chart data:', error);
    }
  }, [data, currentChartType, showVolume]);

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
        
        {/* Chart Controls */}
        <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
          {/* Chart Type Toggle */}
          <div className="flex bg-gray-700 rounded p-1">
            <button
              onClick={() => setCurrentChartType('line')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                currentChartType === 'line'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setCurrentChartType('mountain')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                currentChartType === 'mountain'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Mountain
            </button>
            <button
              onClick={() => setCurrentChartType('candlestick')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                currentChartType === 'candlestick'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Candles
            </button>
          </div>
          
          {/* Time Period Selector */}
          <div className="flex flex-wrap gap-1">
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
    </div>
  );
}