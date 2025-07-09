'use client';

import React, { useMemo } from 'react';
import ApexChart from './ApexChart';

interface PriceEpsData {
  date: string;
  price: number;
  eps: number;
  peRatio?: number;
}

interface PriceEpsChartApexProps {
  data: PriceEpsData[];
  ticker: string;
  title?: string;
  height?: number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  showPeRatio?: boolean;
}

export default function PriceEpsChartApex({
  data,
  ticker,
  title,
  height = 400,
  isLoading = false,
  error = null,
  onRetry,
  showPeRatio = true
}: PriceEpsChartApexProps) {
  
  console.log('[PriceEpsChartApex] Rendering with data:', {
    dataLength: data?.length,
    ticker,
    title,
    showPeRatio,
    isLoading
  });

  const chartTitle = title || `${ticker} Price vs EPS Analysis`;

  // Transform data for ApexChart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Create price series
    const priceSeries = sortedData.map(item => ({
      x: new Date(item.date).getTime(),
      y: item.price
    }));

    // Create EPS series (scaled for better visualization)
    const epsSeries = sortedData.map(item => ({
      x: new Date(item.date).getTime(),
      y: item.eps
    }));

    const series = [
      {
        name: `${ticker} Price`,
        data: priceSeries,
        color: '#10b981'
      },
      {
        name: 'EPS (Scaled)',
        data: epsSeries,
        color: '#3b82f6'
      }
    ];

    // Add P/E ratio series if requested and data is available
    if (showPeRatio && sortedData.some(item => item.peRatio !== undefined)) {
      const peRatioSeries = sortedData
        .filter(item => item.peRatio !== undefined && item.peRatio > 0)
        .map(item => ({
          x: new Date(item.date).getTime(),
          y: item.peRatio!
        }));

      if (peRatioSeries.length > 0) {
        series.push({
          name: 'P/E Ratio',
          data: peRatioSeries,
          color: '#8b5cf6'
        });
      }
    }

    return series;
  }, [data, ticker, showPeRatio]);

  // Calculate current metrics
  const currentMetrics = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const latest = data[data.length - 1];
    const previousYear = data.find(item => {
      const latestDate = new Date(latest.date);
      const itemDate = new Date(item.date);
      return itemDate.getFullYear() === latestDate.getFullYear() - 1;
    });

    return {
      currentPrice: latest.price,
      currentEps: latest.eps,
      currentPeRatio: latest.peRatio || (latest.eps > 0 ? latest.price / latest.eps : null),
      priceChange: previousYear ? ((latest.price - previousYear.price) / previousYear.price) * 100 : null,
      epsGrowth: previousYear ? ((latest.eps - previousYear.eps) / Math.abs(previousYear.eps)) * 100 : null
    };
  }, [data]);

  return (
    <div className="w-full">
      {/* Current Metrics */}
      {!isLoading && !error && currentMetrics && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Current Price</div>
            <div className="text-lg font-semibold text-white">
              ${currentMetrics.currentPrice.toFixed(2)}
            </div>
            {currentMetrics.priceChange !== null && (
              <div className={`text-xs ${currentMetrics.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {currentMetrics.priceChange >= 0 ? '+' : ''}{currentMetrics.priceChange.toFixed(1)}% YoY
              </div>
            )}
          </div>
          
          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Current EPS</div>
            <div className="text-lg font-semibold text-white">
              ${currentMetrics.currentEps.toFixed(2)}
            </div>
            {currentMetrics.epsGrowth !== null && (
              <div className={`text-xs ${currentMetrics.epsGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {currentMetrics.epsGrowth >= 0 ? '+' : ''}{currentMetrics.epsGrowth.toFixed(1)}% YoY
              </div>
            )}
          </div>
          
          {currentMetrics.currentPeRatio && (
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400">P/E Ratio</div>
              <div className="text-lg font-semibold text-white">
                {currentMetrics.currentPeRatio.toFixed(1)}x
              </div>
            </div>
          )}

          <div className="bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-400">Data Points</div>
            <div className="text-lg font-semibold text-white">{data.length}</div>
          </div>
        </div>
      )}

      {/* Chart */}
      <ApexChart
        data={chartData}
        type="line"
        height={height}
        title={chartTitle}
        yAxisFormatter={(value) => `$${value.toFixed(2)}`}
        tooltipFormatter={(value) => `$${value.toFixed(2)}`}
        showLegend={true}
        showToolbar={false}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        colors={['#10b981', '#3b82f6', '#8b5cf6']}
      />

      {/* Analysis Notes */}
      {!isLoading && !error && data && data.length > 0 && (
        <div className="mt-4 text-xs text-gray-400">
          <p>
            <strong>Note:</strong> EPS values are scaled for chart visualization. 
            P/E ratio shows price-to-earnings multiple over time.
            {currentMetrics?.currentPeRatio && (
              ` Current P/E of ${currentMetrics.currentPeRatio.toFixed(1)}x indicates ${
                currentMetrics.currentPeRatio > 25 ? 'high' : 
                currentMetrics.currentPeRatio > 15 ? 'moderate' : 'low'
              } valuation.`
            )}
          </p>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Debug: {data?.length || 0} data points, Current P/E: {currentMetrics?.currentPeRatio?.toFixed(2) || 'N/A'}
        </div>
      )}
    </div>
  );
}