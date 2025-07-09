import React, { useState } from 'react';
import { StockResearchData, TimePeriod } from '@/types/stock-research';
import PriceChartApex from '@/components/charts/PriceChartApex';
import { usePriceData } from '@/hooks/usePriceData';

interface OverviewTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ ticker, data, isLoading }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('3y');

  // Convert TimePeriod to years for the price data hook
  const getYearsFromPeriod = (period: TimePeriod): string => {
    switch (period) {
    case '7d':  return '?days=7';
    case '1m':  return '?days=30';
    case '3m':  return '?days=90';
    case '6m':  return '?days=180';
    case 'ytd': return '?ytd=true';
    case '1y':  return '?years=1';
    case '3y':  return '?years=3';
    case '5y':  return '?years=5';
    case 'max': return '?years=5'; // adjust if you want MAX to be dynamic
    default:    return '?years=5';
    }
  };

  // Use the price data hook
  const { 
    priceData, 
    isLoading: isPriceLoading, 
    error: priceError,
    dataPoints,
    cacheStatus
  } = usePriceData(ticker, getYearsFromPeriod(selectedPeriod));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-700 rounded w-full mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
        <div className="h-96 bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  // Format financial numbers with graceful handling
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return 'N/A';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1e12) {
      return `${sign}$${(absNum / 1e12).toFixed(1)}T`;
    } else if (absNum >= 1e9) {
      return `${sign}$${(absNum / 1e9).toFixed(1)}B`;
    } else if (absNum >= 1e6) {
      return `${sign}$${(absNum / 1e6).toFixed(1)}M`;
    } else if (absNum >= 1e3) {
      return `${sign}$${(absNum / 1e3).toFixed(1)}K`;
    } else if (absNum >= 1) {
      return `${sign}$${absNum.toFixed(2)}`;
    } else {
      return `${sign}$${absNum.toFixed(4)}`;
    }
  };

  if (!data || !data.overview) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p>No overview data available for {ticker}</p>
      </div>
    );
  }

  const { name, description, exchange, country, sector } = data.overview;

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-3">{name}</h3>
        <p className="text-sm text-gray-300 mb-4 leading-relaxed">{description}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-700 rounded p-3">
            <span className="font-semibold text-gray-400">Exchange:</span>
            <span className="text-white ml-2">{exchange}</span>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <span className="font-semibold text-gray-400">Currency:</span>
            <span className="text-white ml-2">USD</span>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <span className="font-semibold text-gray-400">Country:</span>
            <span className="text-white ml-2">{country}</span>
          </div>
          <div className="bg-gray-700 rounded p-3">
            <span className="font-semibold text-gray-400">Sector:</span>
            <span className="text-white ml-2">{sector}</span>
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-bold text-white">Price Chart</h4>
          {dataPoints > 0 && (
            <div className="text-sm text-gray-400">
              {dataPoints} data points • {cacheStatus === 'hit' ? 'Cached' : 'Fresh data'}
            </div>
          )}
        </div>
        
        {isPriceLoading ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-pulse">
              <div className="h-96 bg-gray-700 rounded"></div>
            </div>
            <p className="mt-4">Loading price data...</p>
          </div>
        ) : priceError ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-red-400">Error loading price data</p>
            <p className="text-sm mt-2">{priceError}</p>
          </div>
        ) : priceData && priceData.length > 0 ? (
          <PriceChartApex
            data={priceData}
            ticker={ticker}
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            height={400}
            isLoading={isPriceLoading}
            chartType="mountain"
            showVolume={false}
          />
        ) : (
          <div className="text-center text-gray-400 py-8">
            <p>No price data available for {ticker}</p>
            <p className="text-sm mt-2">Chart data may not be available for this symbol</p>
          </div>
        )}
      </div>

      {/* Modern Financial Metrics Grid */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <h4 className="text-xl font-bold text-white mb-6">Financial Overview</h4>
        
        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Market Cap</div>
            <div className="text-lg font-bold text-white">{formatNumber(data.overview.market_cap || 0)}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">P/E Ratio</div>
            <div className="text-lg font-bold text-white">{data.overview.pe_ratio || 'N/A'}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">EPS</div>
            <div className="text-lg font-bold text-white">{data.overview.eps ? `$${data.overview.eps}` : 'N/A'}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Beta</div>
            <div className="text-lg font-bold text-white">{data.overview.beta || 'N/A'}</div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Revenue TTM</div>
            <div className="text-lg font-bold text-white mb-1">{formatNumber(data.overview.revenue_ttm || 0)}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Gross Profit TTM</div>
            <div className="text-lg font-bold text-white mb-1">{formatNumber(data.overview.gross_profit_ttm || 0)}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Profit Margin</div>
            <div className={`text-lg font-bold mb-1 ${
              data.overview.profit_margin && parseFloat(data.overview.profit_margin) > 0 
                ? 'text-green-400' : 'text-white'
            }`}>
              {data.overview.profit_margin ? `${(parseFloat(data.overview.profit_margin) * 100).toFixed(2)}%` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Book Value</div>
            <div className="text-lg font-bold text-white">{data.overview.book_value ? `$${data.overview.book_value}` : 'N/A'}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Dividend Yield</div>
            <div className={`text-lg font-bold ${
              data.overview.dividend_yield && parseFloat(data.overview.dividend_yield) > 0 
                ? 'text-green-400' : 'text-white'
            }`}>
              {data.overview.dividend_yield ? `${data.overview.dividend_yield}%` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">52W High</div>
            <div className="text-lg font-bold text-white">{data.overview['52_week_high'] ? `$${data.overview['52_week_high']}` : 'N/A'}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">52W Low</div>
            <div className="text-lg font-bold text-white">{data.overview['52_week_low'] ? `$${data.overview['52_week_low']}` : 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
