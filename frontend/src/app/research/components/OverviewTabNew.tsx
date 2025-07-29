import React, { useState } from 'react';
import { StockResearchData, TimePeriod } from '@/types/stock-research';
import PriceChartApex from '@/components/charts/PriceChartApex';
import { usePriceData } from '@/hooks/usePriceData';
import StockHeader from './StockHeader';
import MetricsSidebar from './MetricsSidebar';

interface OverviewTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

/**
 * OverviewTab Component - ResearchEd Style
 * 
 * Complete redesign following ResearchEd layout patterns:
 * - Clean header with inline metrics (no cards)
 * - Sidebar with grouped metrics sections
 * - Main chart area with responsive layout
 * - Minimal, scannable design
 */
const OverviewTabNew: React.FC<OverviewTabProps> = ({ ticker, data, isLoading, onRefresh }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('3y');

  // Convert TimePeriod to query string for the price data hook
  const getYearsFromPeriod = (period: TimePeriod): string => {
    const queryString = (() => {
      switch (period) {
        case '7d':  return '?days=7';
        case '1m':  return '?days=30';
        case '3m':  return '?days=90';
        case '6m':  return '?days=180';
        case 'ytd': return '?ytd=true';
        case '1y':  return '?years=1';
        case '3y':  return '?years=3';
        case '5y':  return '?years=5';
        case 'max': return '?years=10'; // Increased for more historical data
        default:    return '?years=5';
      }
    })();
    
    console.log('[OverviewTabNew] Period changed:', { period, queryString });
    return queryString;
  };

  // Use the price data hook for chart data
  const { 
    priceData, 
    isLoading: isPriceLoading, 
    error: priceError,
    dataPoints,
    cacheStatus
  } = usePriceData(ticker, getYearsFromPeriod(selectedPeriod));

  return (
    <div className="space-y-6">
      {/* Header with company info and inline metrics */}
      <StockHeader 
        ticker={ticker}
        data={data}
        isLoading={isLoading}
      />

      {/* Company Description - Clean, minimal design */}
      {!isLoading && data?.overview?.description && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">About {data.overview.name || ticker}</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            {data.overview.description}
          </p>
          <div className="flex items-center gap-6 mt-4 text-sm">
            {data.overview.sector && (
              <div>
                <span className="text-gray-400">Sector:</span>
                <span className="text-white ml-2 font-medium">{data.overview.sector}</span>
              </div>
            )}
            {data.overview.country && (
              <div>
                <span className="text-gray-400">Country:</span>
                <span className="text-white ml-2 font-medium">{data.overview.country}</span>
              </div>
            )}
            {data.overview.exchange && (
              <div>
                <span className="text-gray-400">Exchange:</span>
                <span className="text-white ml-2 font-medium">{data.overview.exchange}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content layout - Chart area + Metrics sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Chart Area - Takes remaining width */}
        <div className="flex-1">
          <div className="bg-gray-800 rounded-xl p-6">
            {/* Chart header with data status */}
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-semibold text-white">Price Chart</h4>
              {dataPoints > 0 && (
                <div className="text-sm text-gray-400">
                  {dataPoints.toLocaleString()} data points • {cacheStatus === 'hit' ? 'Cached' : 'Fresh data'}
                </div>
              )}
            </div>
            
            {/* Chart component with loading/error states */}
            {isPriceLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="animate-pulse">
                  <div className="h-64 bg-gray-700 rounded-lg w-full"></div>
                </div>
              </div>
            ) : priceError ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="text-red-400 text-lg font-medium mb-2">Error loading price data</div>
                <div className="text-gray-400 text-sm mb-4">{priceError}</div>
                <button 
                  onClick={onRefresh}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : priceData && priceData.length > 0 ? (
              <PriceChartApex
                data={priceData}
                ticker={ticker}
                period={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                height={450}
                isLoading={isPriceLoading}
                chartType="mountain"
                showVolume={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="text-gray-400 text-lg font-medium mb-2">No price data available</div>
                <div className="text-gray-500 text-sm mb-4">
                  Chart data may not be available for {ticker}
                </div>
                <button 
                  onClick={onRefresh}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Refresh Data
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Sidebar - Fixed width on desktop, full width on mobile */}
        <MetricsSidebar 
          ticker={ticker}
          data={data}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default OverviewTabNew;