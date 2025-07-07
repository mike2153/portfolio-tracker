'use client';

import React, { useState } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart3, RefreshCw } from 'lucide-react';

export interface PriceEpsChartProps {
  priceData: Array<{
    time: string;
    close: number;
  }>;
  epsData: Array<{
    fiscalDateEnding: string;
    reportedEPS: string | number;
  }>;
  ticker: string;
  height?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const PriceEpsChart: React.FC<PriceEpsChartProps> = ({
  priceData,
  epsData,
  ticker,
  height = 400,
  isLoading = false,
  onRefresh
}) => {
  const [showPrice, setShowPrice] = useState(true);
  const [showEps, setShowEps] = useState(true);

  // Format price for display
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format EPS for display
  const formatEps = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  // Combine and align price and EPS data by date
  const combineData = () => {
    // Create a map of EPS data by year
    const epsMap = new Map();
    epsData.forEach(eps => {
      const year = new Date(eps.fiscalDateEnding).getFullYear();
      const epsValue = typeof eps.reportedEPS === 'string' ? parseFloat(eps.reportedEPS) : eps.reportedEPS;
      epsMap.set(year, epsValue || 0);
    });

    // Get price data for the last 5 years
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const recentPriceData = priceData.filter(point => 
      new Date(point.time) >= fiveYearsAgo
    );

    // Sample price data quarterly to align with EPS reporting
    const quarterlyPriceData = [];
    const quarters = ['03-31', '06-30', '09-30', '12-31'];
    
    for (let year = fiveYearsAgo.getFullYear(); year <= new Date().getFullYear(); year++) {
      quarters.forEach((quarter, index) => {
        const quarterDate = `${year}-${quarter}`;
        
        // Find closest price data to this quarter end
        const targetDate = new Date(quarterDate);
        let closestPrice = null;
        let minDiff = Infinity;

        recentPriceData.forEach(point => {
          const pointDate = new Date(point.time);
          const diff = Math.abs(pointDate.getTime() - targetDate.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestPrice = point.close;
          }
        });

        if (closestPrice !== null) {
          quarterlyPriceData.push({
            date: quarterDate,
            quarter: `Q${index + 1} ${year}`,
            year: year,
            price: closestPrice,
            eps: epsMap.get(year) || 0
          });
        }
      });
    }

    // Sort by date and return recent 20 quarters (5 years)
    return quarterlyPriceData
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-20);
  };

  const chartData = combineData();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-white text-sm">
              <span style={{ color: entry.color }}>●</span> {entry.name}: {
                entry.name === 'Stock Price' ? formatPrice(entry.value) : formatEps(entry.value)
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="w-full bg-gray-800 rounded-lg p-6" style={{ height }}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white">Stock Price vs EPS</h4>
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ height: height - 100 }}>
          <div className="text-center text-gray-400">
            <div className="text-lg mb-2">📊</div>
            <p>Loading price and EPS data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="w-full bg-gray-800 rounded-lg p-6" style={{ height }}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white">Stock Price vs EPS</h4>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
        </div>
        <div className="flex items-center justify-center" style={{ height: height - 100 }}>
          <div className="text-center text-gray-400">
            <div className="text-lg mb-2">📊</div>
            <p>No price or EPS data available</p>
            <p className="text-sm mt-1">Data may not be available for this symbol</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-white mb-1">Stock Price vs Earnings Per Share</h4>
          <p className="text-sm text-gray-400">{ticker} • Quarterly Data • Last 5 Years</p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          {/* Data Series Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setShowPrice(!showPrice)}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                showPrice
                  ? 'bg-green-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Price
            </button>
            <button
              onClick={() => setShowEps(!showEps)}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                showEps
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              EPS
            </button>
          </div>
          
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

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height - 100}>
        <ComposedChart
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
            dataKey="quarter" 
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: '#9ca3af' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            yAxisId="price"
            orientation="left"
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: '#9ca3af' }}
            tickFormatter={formatPrice}
          />
          <YAxis 
            yAxisId="eps"
            orientation="right"
            stroke="#9ca3af"
            fontSize={12}
            tick={{ fill: '#9ca3af' }}
            tickFormatter={formatEps}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: '#d1d5db' }}
            iconType="rect"
          />
          
          {/* Stock Price (Mountain Area) */}
          {showPrice && (
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              name="Stock Price"
              stroke="rgba(16, 185, 129, 1)"
              fill="url(#colorPrice)"
              strokeWidth={2}
            />
          )}
          
          {/* EPS (Bars) */}
          {showEps && (
            <Bar 
              yAxisId="eps"
              dataKey="eps" 
              name="EPS"
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
              opacity={0.8}
            />
          )}
          
          {/* Gradient Definitions */}
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(16, 185, 129, 0.3)" />
              <stop offset="95%" stopColor="rgba(16, 185, 129, 0.05)" />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Chart Info */}
      <div className="mt-4 text-xs text-gray-400 flex justify-between items-center">
        <span>Data combines quarterly price snapshots with annual EPS figures</span>
        <div className="flex gap-4">
          <span>Price: Mountain Area</span>
          <span>EPS: Bars</span>
        </div>
      </div>
    </div>
  );
};

export default PriceEpsChart;