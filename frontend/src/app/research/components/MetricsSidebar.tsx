import React from 'react';
import { StockResearchData } from '@/types/stock-research';

interface MetricsSidebarProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
}

/**
 * Metrics Sidebar Component - ResearchEd Style
 * 
 * Displays all company metrics in grouped categories without cards or borders.
 * Clean, minimal design with grouped sections for easy scanning.
 */
const MetricsSidebar: React.FC<MetricsSidebarProps> = ({ ticker, data, isLoading }) => {
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

  const formatPercentage = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return `${(num * 100).toFixed(2)}%`;
  };

  const getColorForValue = (value: string | number, isPercentage = false) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return 'text-white';
    return num > 0 ? 'text-green-400' : 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="w-full md:w-80 bg-gray-800 rounded-xl p-6">
        <div className="space-y-6">
          {[...Array(4)].map((_, groupIndex) => (
            <div key={groupIndex}>
              <div className="h-4 bg-gray-700 rounded w-20 mb-3"></div>
              <div className="space-y-2">
                {[...Array(4)].map((_, itemIndex) => (
                  <div key={itemIndex} className="flex justify-between">
                    <div className="h-3 bg-gray-700 rounded w-24"></div>
                    <div className="h-3 bg-gray-700 rounded w-16"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.overview) {
    return (
      <div className="w-full md:w-80 bg-gray-800 rounded-xl p-6">
        <div className="text-center text-gray-400 py-8">
          <p>No metrics available for {ticker}</p>
        </div>
      </div>
    );
  }

  const { overview } = data;

  return (
    <div className="w-full md:w-80 bg-gray-800 rounded-xl p-6">
      {/* Estimate Section */}
      <div className="mb-6">
        <div className="mb-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">
          Estimate
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">P/E</span>
            <span className="text-white font-semibold text-sm">
              {overview.pe_ratio || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">EPS</span>
            <span className="text-white font-semibold text-sm">
              {overview.eps ? `$${overview.eps}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Beta</span>
            <span className="text-white font-semibold text-sm">
              {overview.beta || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Book Value</span>
            <span className="text-white font-semibold text-sm">
              {overview.book_value ? `$${overview.book_value}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Growth Section */}
      <div className="mb-6">
        <div className="mb-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">
          Growth
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Revenue, YoY</span>
            <span className={`font-semibold text-sm ${getColorForValue(overview.quarterly_revenue_growth || 0, true)}`}>
              {overview.quarterly_revenue_growth ? formatPercentage(overview.quarterly_revenue_growth) : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Earnings, YoY</span>
            <span className={`font-semibold text-sm ${getColorForValue(overview.quarterly_earnings_growth || 0, true)}`}>
              {overview.quarterly_earnings_growth ? formatPercentage(overview.quarterly_earnings_growth) : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Profit Margin</span>
            <span className={`font-semibold text-sm ${getColorForValue(overview.profit_margin || 0, true)}`}>
              {overview.profit_margin ? formatPercentage(overview.profit_margin) : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Operating Margin</span>
            <span className={`font-semibold text-sm ${getColorForValue(overview.operating_margin || 0, true)}`}>
              {overview.operating_margin ? formatPercentage(overview.operating_margin) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Forecast Section */}
      <div className="mb-6">
        <div className="mb-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">
          Forecast
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Forward P/E</span>
            <span className="text-white font-semibold text-sm">
              {overview.forward_pe || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">PEG Ratio</span>
            <span className="text-white font-semibold text-sm">
              {overview.peg_ratio || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Price/Sales</span>
            <span className="text-white font-semibold text-sm">
              {overview.price_to_sales || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Price/Book</span>
            <span className="text-white font-semibold text-sm">
              {overview.price_to_book || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Dividends Section */}
      <div className="mb-6">
        <div className="mb-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">
          Dividends
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Div. yield, TTM</span>
            <span className={`font-semibold text-sm ${
              overview.dividend_yield && parseFloat(overview.dividend_yield) > 0 
                ? 'text-green-400' : 'text-white'
            }`}>
              {overview.dividend_yield ? `${overview.dividend_yield}%` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Div. per share</span>
            <span className="text-white font-semibold text-sm">
              {overview.dividend_per_share ? `$${overview.dividend_per_share}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Ex-Dividend Date</span>
            <span className="text-white font-semibold text-sm">
              {overview.ex_dividend_date || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Dividend Date</span>
            <span className="text-white font-semibold text-sm">
              {overview.dividend_date || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Trading Section */}
      <div>
        <div className="mb-3 text-gray-400 font-semibold text-xs uppercase tracking-wide">
          Trading
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">52W High</span>
            <span className="text-white font-semibold text-sm">
              {overview['52_week_high'] ? `$${overview['52_week_high']}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">52W Low</span>
            <span className="text-white font-semibold text-sm">
              {overview['52_week_low'] ? `$${overview['52_week_low']}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">50D MA</span>
            <span className="text-white font-semibold text-sm">
              {overview['50_day_ma'] ? `$${overview['50_day_ma']}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">200D MA</span>
            <span className="text-white font-semibold text-sm">
              {overview['200_day_ma'] ? `$${overview['200_day_ma']}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsSidebar;