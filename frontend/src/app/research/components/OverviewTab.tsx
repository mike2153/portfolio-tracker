'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import PriceChart from '@/components/charts/PriceChart';
import type { TabContentProps, TimePeriod, PriceDataPoint } from '@/types/stock-research';

export default function OverviewTab({ ticker, data, isLoading, onRefresh }: TabContentProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1y');
  const [priceData, setPriceData] = useState<PriceDataPoint[]>(data.priceData || []);
  const [loadingChart, setLoadingChart] = useState(false);

  // Load price data for different periods
  const handlePeriodChange = async (period: TimePeriod) => {
    setSelectedPeriod(period);
    setLoadingChart(true);
    
    try {
      const response = await stockResearchAPI.getPriceData(ticker, period);
      if (response.ok && response.data && response.data.data) {
        setPriceData(response.data.data);
      } else {
        console.error('Failed to load price data:', response.error);
        setPriceData([]);
      }
    } catch (error) {
      console.error('Error loading price data:', error);
      setPriceData([]);
    } finally {
      setLoadingChart(false);
    }
  };

  // Update price data when data prop changes
  useEffect(() => {
    if (data.priceData) {
      setPriceData(data.priceData);
    }
  }, [data.priceData]);

  const formatValue = (value: string | number | undefined, fallback = 'N/A') => {
    if (!value || value === 'None' || value === 'null') return fallback;
    
    // Convert to string if it's a number
    const strValue = typeof value === 'number' ? value.toString() : value;
    
    // Handle percentage values
    if (strValue.includes('%')) return strValue;
    
    // Handle numeric values
    const num = typeof value === 'number' ? value : parseFloat(strValue);
    if (isNaN(num)) return strValue;
    
    // Format large numbers
    if (Math.abs(num) >= 1e12) {
      return `$${(num / 1e12).toFixed(2)}T`;
    }
    if (Math.abs(num) >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(num) >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (value: string | number | undefined) => {
    if (!value || value === 'None' || value === 'null') return 'N/A';
    
    // Convert to string if it's a number
    const strValue = typeof value === 'number' ? value.toString() : value;
    if (strValue.includes('%')) return strValue;
    
    const num = typeof value === 'number' ? value : parseFloat(strValue);
    if (isNaN(num)) return 'N/A';
    
    return `${(num * 100).toFixed(2)}%`;
  };

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon 
  }: { 
    title: string; 
    value: string; 
    change?: { value: number; isPositive: boolean }; 
    icon: React.ReactNode;
  }) => (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-400">{title}</h4>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      {change && (
        <div className={`flex items-center gap-1 text-sm ${
          change.isPositive ? 'text-green-400' : 'text-red-400'
        }`}>
          {change.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(change.value).toFixed(2)}%
        </div>
      )}
    </div>
  );

  if (isLoading && !data.overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading stock overview...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Overview</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Market Cap"
          value={formatValue(data.overview?.market_cap)}
          icon={<BarChart3 size={16} />}
        />
        <MetricCard
          title="P/E Ratio"
          value={data.overview?.pe_ratio || 'N/A'}
          icon={<TrendingUp size={16} />}
        />
        <MetricCard
          title="EPS"
          value={formatValue(data.overview?.eps)}
          icon={<DollarSign size={16} />}
        />
        <MetricCard
          title="Dividend Yield"
          value={formatPercent(data.overview?.dividend_yield)}
          icon={<DollarSign size={16} />}
        />
        <MetricCard
          title="Beta"
          value={data.overview?.beta || 'N/A'}
          icon={<TrendingUp size={16} />}
        />
        <MetricCard
          title="52W High"
          value={formatValue(data.overview?.['52_week_high'])}
          icon={<TrendingUp size={16} />}
        />
        <MetricCard
          title="52W Low"
          value={formatValue(data.overview?.['52_week_low'])}
          icon={<TrendingDown size={16} />}
        />
        <MetricCard
          title="Book Value"
          value={formatValue(data.overview?.book_value)}
          icon={<BarChart3 size={16} />}
        />
      </div>

      {/* Price Chart */}
      <div className="bg-gray-800 rounded-lg p-4">
        <PriceChart
          data={priceData}
          ticker={ticker}
          period={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          height={400}
          isLoading={loadingChart}
        />
      </div>

      {/* Company Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Details */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Company Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Sector:</span>
              <span className="text-white">{data.overview?.sector || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Industry:</span>
              <span className="text-white">{data.overview?.industry || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Country:</span>
              <span className="text-white">{data.overview?.country || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Exchange:</span>
              <span className="text-white">{data.overview?.exchange || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Financial Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Revenue (TTM):</span>
              <span className="text-white">{formatValue(data.overview?.revenue_ttm)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Gross Profit (TTM):</span>
              <span className="text-white">{formatValue(data.overview?.gross_profit_ttm)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Profit Margin:</span>
              <span className="text-white">{formatPercent(data.overview?.profit_margin)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Book Value:</span>
              <span className="text-white">{formatValue(data.overview?.book_value)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Company Description */}
      {data.overview?.description && data.overview.description !== 'N/A' && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">About {data.overview?.name || ticker}</h3>
          <p className="text-gray-300 leading-relaxed">
            {data.overview.description}
          </p>
        </div>
      )}

      {/* Data Attribution */}
      <div className="text-center text-xs text-gray-500">
        Market data provided by Alpha Vantage • Prices may be delayed up to 15 minutes
      </div>
    </div>
  );
}