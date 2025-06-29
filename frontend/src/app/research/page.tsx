'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Star, StarOff, TrendingUp, TrendingDown, BarChart3, DollarSign, FileText, Users, Target, GitCompare } from 'lucide-react';
import { stockResearchAPI } from '@/lib/stockResearchAPI';
import type { 
  StockResearchTab, 
  StockSearchResult, 
  StockResearchData,
  TimePeriod
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
  const [stockData, setStockData] = useState<Record<string, StockResearchData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
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
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const watchlistData = await stockResearchAPI.getWatchlist();
      setWatchlist(watchlistData.map(item => item.ticker));
    } catch (error) {
      console.error('Error loading watchlist:', error);
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
    if (!stockData[upperTicker]) {
      await loadStockData(upperTicker);
    }
  }, [searchParams, router, stockData]);

  const loadStockData = async (ticker: string) => {
    setIsLoading(true);
    try {
      const data = await stockResearchAPI.getStockData(ticker);
      
      setStockData(prev => ({
        ...prev,
        [ticker]: {
          overview: data.overview?.overview,
          quote: data.overview?.quote,
          priceData: data.priceData || [],
          news: data.news || [],
          notes: data.notes || [],
          isInWatchlist: data.isInWatchlist || false
        }
      }));
    } catch (error) {
      console.error('Error loading stock data:', error);
      setError('Failed to load stock data. Please try again.');
    } finally {
      setIsLoading(false);
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

  const handleWatchlistToggle = async () => {
    if (!selectedTicker) return;
    
    try {
      const isInWatchlist = watchlist.includes(selectedTicker);
      
      if (isInWatchlist) {
        await stockResearchAPI.removeFromWatchlist(selectedTicker);
        setWatchlist(prev => prev.filter(t => t !== selectedTicker));
      } else {
        await stockResearchAPI.addToWatchlist(selectedTicker);
        setWatchlist(prev => [...prev, selectedTicker]);
      }
      
      // Update stock data
      setStockData(prev => ({
        ...prev,
        [selectedTicker]: {
          ...prev[selectedTicker],
          isInWatchlist: !isInWatchlist
        }
      }));
    } catch (error) {
      console.error('Error toggling watchlist:', error);
    }
  };

  const handleRefresh = async () => {
    if (selectedTicker) {
      await loadStockData(selectedTicker);
    }
  };

  const currentData = selectedTicker ? stockData[selectedTicker] : undefined;
  const isInWatchlist = selectedTicker ? watchlist.includes(selectedTicker) : false;

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
                      ({currentData.quote.change_percent})
                    </div>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleWatchlistToggle}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isInWatchlist
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {isInWatchlist ? <Star size={16} /> : <StarOff size={16} />}
                  {isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Tabs */}
        {selectedTicker && (
          <div className="mb-6">
            <div className="border-b border-gray-700">
              <nav className="flex space-x-8 overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.id === 'notes' && currentData?.notes && currentData.notes.length > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                        {currentData.notes.length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}