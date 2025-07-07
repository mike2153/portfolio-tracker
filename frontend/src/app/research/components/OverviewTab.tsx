import React, { useState } from 'react';
import { StockResearchData, TimePeriod } from '@/types/stock-research';
import PriceChart from '@/components/charts/PriceChart';

interface OverviewTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ ticker, data, isLoading }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('3y');

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

  const { name, description, exchange, currency, country, sector } = data.overview;

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
            <span className="text-white ml-2">{currency}</span>
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
        {data.priceData && data.priceData.length > 0 ? (
          <PriceChart
            data={data.priceData}
            ticker={ticker}
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            height={400}
            isLoading={false}
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

      {/* Key Metrics Grid - Placeholder for Phase 4 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4">Key Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded p-4 text-center">
            <div className="text-sm text-gray-400">Market Cap</div>
            <div className="text-lg font-semibold text-white">{formatNumber(data.overview.market_cap || 0)}</div>
          </div>
          <div className="bg-gray-700 rounded p-4 text-center">
            <div className="text-sm text-gray-400">P/E Ratio</div>
            <div className="text-lg font-semibold text-white">{data.overview.pe_ratio || 'N/A'}</div>
          </div>
          <div className="bg-gray-700 rounded p-4 text-center">
            <div className="text-sm text-gray-400">EPS</div>
            <div className="text-lg font-semibold text-white">${data.overview.eps || 'N/A'}</div>
          </div>
          <div className="bg-gray-700 rounded p-4 text-center">
            <div className="text-sm text-gray-400">Dividend Yield</div>
            <div className="text-lg font-semibold text-white">{data.overview.dividend_yield || 'N/A'}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
