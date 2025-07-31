import React from 'react';
import { StockResearchData } from '@/types/stock-research';
import CompanyIcon from '@/components/ui/CompanyIcon';

interface StockHeaderProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
}

/**
 * Stock Header Component - ResearchEd Style
 * 
 * Displays company name, ticker, current price, and key inline metrics
 * in a clean horizontal layout without cards or shadows.
 */
const StockHeader: React.FC<StockHeaderProps> = ({ ticker, data, isLoading }) => {
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

  const _formatPercentage = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return `${(num * 100).toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 mb-6 animate-pulse">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between">
          <div>
            <div className="h-8 bg-gray-700 rounded w-64 mb-2"></div>
            <div className="h-6 bg-gray-700 rounded w-24 mb-1"></div>
            <div className="h-4 bg-gray-700 rounded w-20"></div>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mt-4 md:mt-0">
            {[...Array(5)].map((_, i) => (
              <div key={i}>
                <div className="h-3 bg-gray-700 rounded w-16 mb-1"></div>
                <div className="h-4 bg-gray-700 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.overview) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <div className="text-center text-gray-400 py-4">
          <p>No company data available for {ticker}</p>
        </div>
      </div>
    );
  }

  const { overview, quote } = data;
  const currentPrice = quote?.price ? parseFloat(String(quote.price)) : 0;
  const priceChange = quote?.change ? parseFloat(String(quote.change)) : 0;
  const priceChangePercent = quote?.change_percent ? String(quote.change_percent).replace('%', '') : '0';

  return (
    <div className="bg-gray-800 rounded-xl p-6 mb-6 flex flex-col md:flex-row md:items-end md:justify-between">
      {/* Left side - Company info and current price */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <CompanyIcon 
            symbol={ticker} 
            size={48} 
            fallback="initials"
            className="flex-shrink-0"
          />
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-white">{overview.name || ticker}</h1>
            <span className="text-lg text-gray-400 font-medium">{ticker}</span>
          </div>
        </div>
        <div className="text-3xl font-bold text-white mb-1">
          {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : 'N/A'}
        </div>
        <div className={`text-sm font-medium ${
          priceChange >= 0 ? 'text-green-400' : 'text-red-400'
        }`}>
          {priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} ({priceChangePercent}%)
        </div>
      </div>

      {/* Right side - Inline key metrics */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-6 md:mt-0">
        {/* Earnings Date */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Earnings date</div>
          <div className="text-base text-white font-semibold">
            {overview.earnings_date || 'N/A'}
          </div>
        </div>

        {/* P/E Ratio */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">P/E</div>
          <div className="text-base text-white font-semibold">
            {overview.pe_ratio || 'N/A'}
          </div>
        </div>

        {/* EPS */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">EPS</div>
          <div className="text-base text-white font-semibold">
            {overview.eps ? `$${overview.eps}` : 'N/A'}
          </div>
        </div>

        {/* Market Cap */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Market Cap</div>
          <div className="text-base text-white font-semibold">
            {formatNumber(overview.market_cap || 0)}
          </div>
        </div>

        {/* Dividend Yield */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Div. yield</div>
          <div className={`text-base font-semibold ${
            overview.dividend_yield && parseFloat(overview.dividend_yield) > 0 
              ? 'text-green-400' : 'text-white'
          }`}>
            {overview.dividend_yield ? `${overview.dividend_yield}%` : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockHeader;