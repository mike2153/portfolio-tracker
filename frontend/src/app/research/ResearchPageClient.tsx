'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Star, StarOff, TrendingUp, TrendingDown, BarChart3, DollarSign, FileText, Users, Target, GitCompare } from 'lucide-react';
import { stockResearchAPI } from '@/lib/stockResearchAPI';
import type { 
  StockResearchTab, 
  StockSearchResult, 
  StockResearchData,
  TimePeriod,
  WatchlistItem,
  StockOverview,
  StockQuote
} from '@/types/stock-research';

// Import tab components
import OverviewTab from './components/OverviewTab';
import FinancialsTab from './components/FinancialsTab';
import DividendsTab from './components/DividendsTab';
import NewsTab from './components/NewsTab';
import NotesTab from './components/NotesTab';
import ComparisonTab from './components/ComparisonTab';
import StockSearchInput from './components/StockSearchInput';

const TABS: { id: StockResearchTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <TrendingUp size={16} /> },
  { id: 'financials', label: 'Financials', icon: <BarChart3 size={16} /> },
  { id: 'dividends', label: 'Dividends', icon: <DollarSign size={16} /> },
  { id: 'news', label: 'News', icon: <FileText size={16} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
  { id: 'comparison', label: 'Compare', icon: <GitCompare size={16} /> },
];

export default function StockResearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StockResearchTab>('overview');
  const [stockData, setStockData] = useState<StockResearchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [comparisonStocks, setComparisonStocks] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const ticker = searchParams.get('ticker');
    const tab = searchParams.get('tab') as StockResearchTab;
    
    if (ticker) {
      setSelectedTicker(ticker.toUpperCase());
    }
    if (tab && TABS.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load watchlist on mount
  useEffect(() => {
    console.log('[ResearchPage] Initializing: Fetching watchlist.');
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    console.log('[ResearchPage] loadWatchlist: Awaiting API call.');
    const response = await stockResearchAPI.getWatchlist();
    if (response.ok && response.data) {
      console.log('[ResearchPage] loadWatchlist: Successfully fetched watchlist.', response.data.watchlist);
      setWatchlist(response.data.watchlist);
    } else {
      console.error('[ResearchPage] loadWatchlist: Failed to fetch watchlist.', response.error);
      setWatchlist([]);
    }
  };

  const handleStockSelect = useCallback(async (ticker: string) => {
    const upperTicker = ticker.toUpperCase();
    setSelectedTicker(upperTicker);
    setError(null);
    
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    newParams.set('ticker', upperTicker);
    router.push(`/research?${newParams.toString()}`, { scroll: false });
    
    // Load stock data if not already cached
    if (!stockData) {
      await loadStockData(upperTicker);
    }
  }, [searchParams, router, stockData]);

  const loadStockData = async (ticker: string) => {
    console.log(`[ResearchPage] loadStockData: Loading all data for ticker: ${ticker}`);
    setIsLoading(true);
    setStockData(null);

    try {
      const [overviewRes, priceDataRes, newsRes, notesRes, watchlistRes] = await Promise.all([
        stockResearchAPI.getStockOverview(ticker),
        stockResearchAPI.getPriceData(ticker, '1y'),
        stockResearchAPI.getNews(ticker),
        stockResearchAPI.getNotes(ticker),
        stockResearchAPI.getWatchlist()
      ]);
      
      console.log('[ResearchPage] Raw API Responses:', { overviewRes, priceDataRes, newsRes, notesRes, watchlistRes });

      if (overviewRes.ok && overviewRes.data) {
        const isInWatchlist = watchlistRes.ok && watchlistRes.data ? 
                              watchlistRes.data.watchlist.some(item => item.ticker === ticker) : false;

        const overviewData = overviewRes.data.data as (StockOverview & { quote: StockQuote });

        const combinedData: StockResearchData = {
          overview: overviewData,
          quote: overviewData.quote,
          priceData: priceDataRes.ok && priceDataRes.data ? priceDataRes.data.data : [],
          news: newsRes.ok && newsRes.data ? newsRes.data.articles : [],
          notes: notesRes.ok && notesRes.data ? notesRes.data.notes : [],
          isInWatchlist,
        };
        console.log(`[ResearchPage] loadStockData: Successfully processed data for ${ticker}.`, combinedData);
        setStockData(combinedData);
      } else {
        console.error(`[ResearchPage] loadStockData: Failed to fetch critical overview data for ${ticker}.`, overviewRes.error);
      }
    } catch (error) {
      console.error(`[ResearchPage] loadStockData: Unhandled exception for ${ticker}.`, error);
    } finally {
      setIsLoading(false);
      console.log(`[ResearchPage] loadStockData: Finished loading for ${ticker}.`);
    }
  };

  const handleTabChange = (tab: StockResearchTab) => {
    setActiveTab(tab);
    
    // Update URL
    const newParams = new URLSearchParams(searchParams);
    if (selectedTicker) {
      newParams.set('ticker', selectedTicker);
    }
    newParams.set('tab', tab);
    router.push(`/research?${newParams.toString()}`, { scroll: false });
  };

  const handleToggleWatchlist = async () => {
    if (!selectedTicker) {
      console.warn('[ResearchPage] handleToggleWatchlist: No ticker selected.');
      return;
    }

    const isInWatchlist = stockData ? stockData.isInWatchlist : false;
    console.log(`[ResearchPage] handleToggleWatchlist: Toggling ${selectedTicker}. Currently in watchlist: ${isInWatchlist}`);

    if (isInWatchlist) {
      await stockResearchAPI.removeFromWatchlist(selectedTicker);
      console.log(`[ResearchPage] handleToggleWatchlist: ${selectedTicker} removed.`);
    } else {
      await stockResearchAPI.addToWatchlist(selectedTicker);
      console.log(`[ResearchPage] handleToggleWatchlist: ${selectedTicker} added.`);
    }
    
    // Optimistically update UI and then refresh from source of truth
    if (stockData) {
      setStockData({ ...stockData, isInWatchlist: !isInWatchlist });
    }
    loadWatchlist(); // Re-fetch the watchlist to be sure
  };

  const handleRefresh = async () => {
    if (selectedTicker) {
      console.log(`[ResearchPage] handleRefresh: Refreshing data for ${selectedTicker}.`);
      await loadStockData(selectedTicker);
    } else {
      console.warn('[ResearchPage] handleRefresh: Refresh called but no ticker is selected.');
    }
  };

  const currentData = selectedTicker ? stockData : undefined;
  const isInWatchlist = selectedTicker ? stockData?.isInWatchlist || false : false;

  const renderTabContent = () => {
    if (!selectedTicker || !currentData) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Search size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Search for a stock to begin</h3>
            <p className="text-sm">Use the search bar above to find and analyze stocks</p>
          </div>
        </div>
      );
    }

    const tabProps = {
      ticker: selectedTicker,
      data: currentData,
      isLoading,
      onRefresh: handleRefresh
    };

    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...tabProps} />;
      case 'financials':
        return <FinancialsTab {...tabProps} />;
      case 'dividends':
        return <DividendsTab {...tabProps} />;
      case 'news':
        return <NewsTab {...tabProps} />;
      case 'notes':
        return <NotesTab {...tabProps} />;
      case 'comparison':
        return (
          <ComparisonTab 
            {...tabProps}
            comparisonStocks={comparisonStocks}
            onStockAdd={(ticker) => setComparisonStocks(prev => [...prev, ticker])}
            onStockRemove={(ticker) => setComparisonStocks(prev => prev.filter(t => t !== ticker))}
          />
        );
      default:
        return <OverviewTab {...tabProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4">Stock Research</h1>
          
          {/* Search Bar */}
          <div className="max-w-md">
            <StockSearchInput
              onStockSelect={handleStockSelect}
              placeholder="Search stocks by ticker or company name..."
              className="w-full"
            />
          </div>
        </div>

        {/* Stock Header */}
        {selectedTicker && currentData && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <div>
                  <h2 className="text-xl font-bold">
                    {currentData.overview?.name || selectedTicker}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{selectedTicker}</span>
                    {currentData.overview?.exchange && (
                      <>
                        <span>•</span>
                        <span>{currentData.overview.exchange}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Current Price */}
                {currentData.quote && (
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      ${parseFloat(currentData.quote.price).toFixed(2)}
                    </div>
                    <div className={`text-sm ${
                      parseFloat(currentData.quote.change) >= 0 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {parseFloat(currentData.quote.change) >= 0 ? '+' : ''}
                      {parseFloat(currentData.quote.change).toFixed(2)}
                      {' '}
                      ({parseFloat(currentData.quote.change_percent).toFixed(2)}%)
                    </div>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleToggleWatchlist}
                  className="p-2 rounded-full hover:bg-gray-700 transition-colors"
                  title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {isInWatchlist ? <StarOff size={18} /> : <Star size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel: Tabs & Content */}
          <div className="lg:w-3/4">
            {/* Tabs */}
            {selectedTicker && (
              <div className="mb-4">
                <div className="border-b border-gray-700">
                  <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`
                          group inline-flex items-center py-3 px-1 border-b-2 font-medium text-sm
                          ${activeTab === tab.id
                            ? 'border-blue-500 text-blue-400'
                            : 'border-transparent text-gray-400 hover:text-white hover:border-gray-500'
                          }
                        `}
                      >
                        {tab.icon}
                        <span className="ml-2">{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            )}
            
            {/* Tab Content */}
            <div className="bg-gray-800 rounded-lg p-6 min-h-[400px] flex">
              {renderTabContent()}
            </div>
          </div>

          {/* Right Panel: Watchlist / Comparison */}
          <div className="lg:w-1/4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">My Watchlist</h3>
              {/* Watchlist content goes here */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 