'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, X, GitCompare, TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react';
import PriceChart from '@/components/charts/PriceChart';
import StockSearchInput from './StockSearchInput';
import { front_api_client } from '@/lib/front_api_client';
import type { 
  TabContentProps, 
  StockOverview, 
  StockQuote, 
  PriceDataPoint, 
  TimePeriod 
} from '@/types/stock-research';

interface ComparisonTabProps extends TabContentProps {
  comparisonStocks: string[];
  onStockAdd: (ticker: string) => void;
  onStockRemove: (ticker: string) => void;
}

interface ComparisonData {
  overview?: StockOverview;
  quote?: StockQuote;
  priceData?: PriceDataPoint[];
}

export default function ComparisonTab({ 
  ticker, 
  data, 
  isLoading, 
  onRefresh,
  comparisonStocks,
  onStockAdd,
  onStockRemove
}: ComparisonTabProps) {
  const [comparisonData, setComparisonData] = useState<Record<string, ComparisonData>>({});
  const [loadingData, setLoadingData] = useState<Set<string>>(new Set());
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1y');
  const [showAddStock, setShowAddStock] = useState(false);

  // Load comparison data when stocks are added
  useEffect(() => {
    comparisonStocks.forEach(stock => {
      if (!comparisonData[stock] && !loadingData.has(stock)) {
        loadStockData(stock);
      }
    });
  }, [comparisonStocks]);

  const loadStockData = async (stockTicker: string) => {
    setLoadingData(prev => new Set(prev.add(stockTicker)));
    
    try {
      const [overviewRes, priceDataRes] = await Promise.all([
        stockResearchAPI.getStockOverview(stockTicker),
        stockResearchAPI.getPriceData(stockTicker, selectedPeriod)
      ]);

      setComparisonData(prev => ({
        ...prev,
        [stockTicker]: {
          overview: overviewRes?.overview,
          quote: overviewRes?.quote,
          priceData: priceDataRes
        }
      }));
    } catch (error) {
      console.error(`Error loading data for ${stockTicker}:`, error);
    } finally {
      setLoadingData(prev => {
        const newSet = new Set(prev);
        newSet.delete(stockTicker);
        return newSet;
      });
    }
  };

  const handleAddStock = (newTicker: string) => {
    const upperTicker = newTicker.toUpperCase();
    if (!comparisonStocks.includes(upperTicker) && upperTicker !== ticker) {
      onStockAdd(upperTicker);
      setShowAddStock(false);
    }
  };

  const handlePeriodChange = async (period: TimePeriod) => {
    setSelectedPeriod(period);
    
    // Reload price data for all stocks with new period
    const allStocks = [ticker, ...comparisonStocks];
    for (const stock of allStocks) {
      try {
        const priceData = await stockResearchAPI.getPriceData(stock, period);
        
        if (stock === ticker) {
          // Update main stock data would be handled by parent component
        } else {
          setComparisonData(prev => ({
            ...prev,
            [stock]: {
              ...prev[stock],
              priceData
            }
          }));
        }
      } catch (error) {
        console.error(`Error loading price data for ${stock}:`, error);
      }
    }
  };

  const formatValue = (value: string | undefined, fallback = 'N/A') => {
    if (!value || value === 'None' || value === 'null') return fallback;
    
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    
    if (Math.abs(num) >= 1e12) {
      return `$${(num / 1e12).toFixed(2)}T`;
    }
    if (Math.abs(num) >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(num) >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`;
    }
    
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (value: string | undefined) => {
    if (!value || value === 'None' || value === 'null') return 'N/A';
    if (value.includes('%')) return value;
    
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    
    return `${(num * 100).toFixed(2)}%`;
  };

  const getChangeColor = (change: string | undefined) => {
    if (!change) return 'text-gray-400';
    const num = parseFloat(change);
    return num >= 0 ? 'text-green-400' : 'text-red-400';
  };

  // Prepare chart data for all stocks
  const allStocks = [ticker, ...comparisonStocks];
  const chartData = allStocks.map(stock => ({
    ticker: stock,
    data: stock === ticker ? data.priceData || [] : comparisonData[stock]?.priceData || [],
    color: stock === ticker ? '#10b981' : `hsl(${allStocks.indexOf(stock) * 50}, 70%, 50%)`
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Stock Comparison</h2>
          <p className="text-sm text-gray-400 mt-1">
            Compare {ticker} with other stocks side by side
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stock Selection */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Selected Stocks</h3>
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Stock
          </button>
        </div>

        {/* Add Stock Form */}
        {showAddStock && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg border border-blue-500">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <StockSearchInput
                  onStockSelect={handleAddStock}
                  placeholder="Search for stock to compare..."
                  className="w-full"
                />
              </div>
              <button
                onClick={() => setShowAddStock(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Selected Stocks List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Main Stock */}
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white">{ticker}</div>
                <div className="text-sm text-blue-400">Primary Stock</div>
              </div>
              <GitCompare size={16} className="text-blue-400" />
            </div>
            {data.quote && (
              <div className="mt-2">
                <div className="text-sm text-white">${parseFloat(data.quote.price).toFixed(2)}</div>
                <div className={`text-xs ${getChangeColor(data.quote.change)}`}>
                  {parseFloat(data.quote.change || '0') >= 0 ? '+' : ''}
                  {parseFloat(data.quote.change || '0').toFixed(2)} ({data.quote.change_percent})
                </div>
              </div>
            )}
          </div>

          {/* Comparison Stocks */}
          {comparisonStocks.map(stock => (
            <div key={stock} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{stock}</div>
                  {loadingData.has(stock) ? (
                    <div className="text-sm text-gray-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">
                      {comparisonData[stock]?.overview?.name || 'Comparison Stock'}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onStockRemove(stock)}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {comparisonData[stock]?.quote && (
                <div className="mt-2">
                  <div className="text-sm text-white">
                    ${parseFloat(comparisonData[stock]!.quote!.price).toFixed(2)}
                  </div>
                  <div className={`text-xs ${getChangeColor(comparisonData[stock]?.quote?.change)}`}>
                    {parseFloat(comparisonData[stock]?.quote?.change || '0') >= 0 ? '+' : ''}
                    {parseFloat(comparisonData[stock]?.quote?.change || '0').toFixed(2)} 
                    ({comparisonData[stock]?.quote?.change_percent})
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Chart */}
      {allStocks.length > 1 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Price Comparison Chart</h3>
          <PriceChart
            data={data.priceData || []}
            ticker={ticker}
            period={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            height={400}
          />
        </div>
      )}

      {/* Comparison Table */}
      {comparisonStocks.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Key Metrics Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-3 px-4 font-medium text-gray-300">Metric</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-300">{ticker}</th>
                  {comparisonStocks.map(stock => (
                    <th key={stock} className="text-right py-3 px-4 font-medium text-gray-300">
                      {stock}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-4 text-gray-400">Current Price</td>
                  <td className="py-2 px-4 text-right text-white font-mono">
                    {data.quote ? `$${parseFloat(data.quote.price).toFixed(2)}` : 'N/A'}
                  </td>
                  {comparisonStocks.map(stock => (
                    <td key={stock} className="py-2 px-4 text-right text-white font-mono">
                      {comparisonData[stock]?.quote 
                        ? `$${parseFloat(comparisonData[stock]!.quote!.price).toFixed(2)}` 
                        : 'N/A'
                      }
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-4 text-gray-400">Market Cap</td>
                  <td className="py-2 px-4 text-right text-white font-mono">
                    {formatValue(data.overview?.market_cap)}
                  </td>
                  {comparisonStocks.map(stock => (
                    <td key={stock} className="py-2 px-4 text-right text-white font-mono">
                      {formatValue(comparisonData[stock]?.overview?.market_cap)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-4 text-gray-400">P/E Ratio</td>
                  <td className="py-2 px-4 text-right text-white font-mono">
                    {data.overview?.pe_ratio || 'N/A'}
                  </td>
                  {comparisonStocks.map(stock => (
                    <td key={stock} className="py-2 px-4 text-right text-white font-mono">
                      {comparisonData[stock]?.overview?.pe_ratio || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-4 text-gray-400">EPS</td>
                  <td className="py-2 px-4 text-right text-white font-mono">
                    {formatValue(data.overview?.eps)}
                  </td>
                  {comparisonStocks.map(stock => (
                    <td key={stock} className="py-2 px-4 text-right text-white font-mono">
                      {formatValue(comparisonData[stock]?.overview?.eps)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-4 text-gray-400">Dividend Yield</td>
                  <td className="py-2 px-4 text-right text-white font-mono">
                    {formatPercent(data.overview?.dividend_yield)}
                  </td>
                  {comparisonStocks.map(stock => (
                    <td key={stock} className="py-2 px-4 text-right text-white font-mono">
                      {formatPercent(comparisonData[stock]?.overview?.dividend_yield)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-4 text-gray-400">Beta</td>
                  <td className="py-2 px-4 text-right text-white font-mono">
                    {data.overview?.beta || 'N/A'}
                  </td>
                  {comparisonStocks.map(stock => (
                    <td key={stock} className="py-2 px-4 text-right text-white font-mono">
                      {comparisonData[stock]?.overview?.beta || 'N/A'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {comparisonStocks.length === 0 && (
        <div className="text-center py-16">
          <GitCompare size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No Comparison Stocks Selected</h3>
          <p className="text-gray-500 mb-4">
            Add stocks to compare key metrics and performance with {ticker}.
          </p>
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
          >
            <Plus size={16} />
            Add Stock to Compare
          </button>
        </div>
      )}

      {/* Data Attribution */}
      <div className="text-center text-xs text-gray-500">
        Comparison data provided by Alpha Vantage • Data may be delayed up to 15 minutes
      </div>
    </div>
  );
}