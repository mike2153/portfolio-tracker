'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import GradientText from '@/components/ui/GradientText';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Star, StarOff, TrendingUp, BarChart3, DollarSign, FileText, GitCompare } from 'lucide-react';
import { front_api_client } from '@/lib/front_api_client';
import { front_api_add_to_watchlist, front_api_remove_from_watchlist, front_api_check_watchlist_status } from '@/hooks/api/front_api_watchlist';
import { useToast } from '@/components/ui/Toast';
import type { 
  StockResearchTab, 
  StockResearchData
} from '@/types/stock-research';

// Import tab components
import OverviewTabNew from './components/OverviewTabNew';
import DividendsTab from './components/DividendsTab';
import { LazyFinancialsTabNew, LazyNewsTab } from '../dashboard/components/LazyComponents';
import NotesTab from './components/NotesTab';
import ComparisonTab from './components/ComparisonTab';
import { StockSearchInput } from '@/components/StockSearchInput';
// import ResearchStockChart from '@/components/charts/ResearchStockChart';
// import FinancialSpreadsheetApex from '@/components/charts/FinancialSpreadsheetApex';


const TABS: { id: StockResearchTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <TrendingUp size={16} /> },
  { id: 'financials', label: 'Financials', icon: <BarChart3 size={16} /> },
  { id: 'dividends', label: 'Dividends', icon: <DollarSign size={16} /> },
  { id: 'news', label: 'News', icon: <FileText size={16} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={16} /> },
  { id: 'comparison', label: 'Compare', icon: <GitCompare size={16} /> },
];

function StockResearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  
  // State
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StockResearchTab>('overview');
  const [stockData, setStockData] = useState<Record<string, StockResearchData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_watchlist, setWatchlist] = useState<string[]>([]);
  const [_comparisonStocks, _setComparisonStocks] = useState<string[]>([]);
  const [_comparisonMode, _setComparisonMode] = useState(false);

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

  const loadStockData = useCallback(async (ticker: string) => {
    setIsLoading(true);
    try {
      console.log(`[ResearchPage] Loading stock data for: ${ticker}`);
      const data = await front_api_client.front_api_get_stock_research_data(ticker);
      console.log(`[ResearchPage] Stock data received for ${ticker}:`, data);
      
      // Check watchlist status
      let isInWatchlist = false;
      try {
        const watchlistStatus = await front_api_check_watchlist_status(ticker);
        isInWatchlist = watchlistStatus.is_in_watchlist;
      } catch (err) {
        console.error('[ResearchPage] Error checking watchlist status:', err);
      }
      
      if (data) {
        setStockData(prev => ({
          ...prev,
          [ticker]: {
            overview: data.fundamentals || {},
            quote: data.price_data || {},
            priceData: data.priceData || [],
            news: data.news || [],
            notes: data.notes || [],
            financials: data.financials || {},
            dividends: data.dividends || [],
            isInWatchlist: isInWatchlist
          } as StockResearchData
        }));
        console.log(`[ResearchPage] Stock data set for ${ticker}, overview keys:`, Object.keys(data.fundamentals || {}));
      }
    } catch (error) {
      console.error('[ResearchPage] Error loading stock data:', error);
      setError('Failed to load stock data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load stock data when selectedTicker changes
  useEffect(() => {
    if (selectedTicker && !stockData[selectedTicker]) {
      console.log(`[ResearchPage] selectedTicker changed to: ${selectedTicker}, loading data...`);
      loadStockData(selectedTicker);
    }
  }, [selectedTicker, stockData, loadStockData]);

  // Load watchlist on mount
  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      // console.log('[ResearchPage] Loading watchlist...');
      // Note: Watchlist API needs to be implemented in backend
      // For now, use empty array
      // console.log('[ResearchPage] Watchlist API not yet implemented, using empty array');
      const response = { success: true, data: { watchlist: [] } };
      if (response.success) {
        // console.log('[ResearchPage] Watchlist loaded successfully:', response.data.watchlist);
        setWatchlist(response.data.watchlist);
      } else {
        // console.log('[ResearchPage] Failed to load watchlist:', response);
        setWatchlist([]);
      }
    } catch (error) {
      console.error('[ResearchPage] Error loading watchlist:', error);
      setWatchlist([]); // Set empty array as fallback
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
  }, [searchParams, router, stockData, loadStockData]);

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
      const currentData = stockData[selectedTicker];
      const isInWatchlist = currentData?.isInWatchlist || false;
      
      if (isInWatchlist) {
        // Remove from watchlist
        await front_api_remove_from_watchlist(selectedTicker);
        setWatchlist(prev => prev.filter(t => t !== selectedTicker));
        addToast({
          type: 'success',
          title: "Success",
          message: `${selectedTicker} removed from watchlist`
        });
      } else {
        // Add to watchlist
        await front_api_add_to_watchlist(selectedTicker);
        setWatchlist(prev => [...prev, selectedTicker]);
        addToast({
          type: 'success',
          title: "Success",
          message: `${selectedTicker} added to watchlist`
        });
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
      addToast({
        type: 'error',
        title: "Error",
        message: "Failed to update watchlist"
      });
    }
  };

  const handleRefresh = async () => {
    if (selectedTicker) {
      await loadStockData(selectedTicker);
    }
  };

  const currentData = selectedTicker ? stockData[selectedTicker] : undefined;
  const isInWatchlist = currentData?.isInWatchlist || false;

  const renderTabContent = () => {
    if (!selectedTicker || !currentData) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[#8B949E]">
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
        return <OverviewTabNew {...tabProps} />;
      case 'financials':
        return <LazyFinancialsTabNew {...tabProps} />;
      case 'dividends':
        return <DividendsTab {...tabProps} />;
      case 'news':
        return <LazyNewsTab {...tabProps} />;
      case 'notes':
        return <NotesTab {...tabProps} />;
      case 'comparison':
        return (
          <ComparisonTab 
            isLoading={tabProps.isLoading}
          />
        );
      default:
        return <OverviewTabNew {...tabProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <GradientText className="text-2xl font-bold mb-8">Stock Research</GradientText>
          
          {/* Search Bar */}
          <div className="max-w-md">
            <StockSearchInput
              onSelectSymbol={(symbol) => {
                console.debug('[ResearchPage] onSelectSymbol:', symbol);
                handleStockSelect(symbol.symbol);
              }}
              placeholder="Search stocks by ticker or company name..."
              className="w-full"
            />
          </div>
        </div>

        {/* Stock Header */}
        {selectedTicker && currentData && (
          <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <div>
                  <h2 className="text-xl font-bold">
                    {currentData.overview?.name || selectedTicker}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-[#8B949E]">
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
                {currentData.quote ? (
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {currentData.quote.price ? 
                        `$${parseFloat(String(currentData.quote.price)).toFixed(2)}` : 
                        'N/A'
                      }
                    </div>
                    {currentData.quote.change ? (
                      <div className={`text-sm ${
                        parseFloat(String(currentData.quote.change)) >= 0 
                          ? 'text-green-400' 
                          : 'text-red-400'
                      }`}>
                        {parseFloat(String(currentData.quote.change)) >= 0 ? '+' : ''}
                        {parseFloat(String(currentData.quote.change)).toFixed(2)} 
                        ({currentData.quote.change_percent || '0%'})
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400">
                        Price data unavailable
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-400">N/A</div>
                    <div className="text-sm text-gray-400">Price data unavailable</div>
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
                      : 'bg-[#0D1117] border border-[#30363D] hover:bg-[#30363D] text-[#8B949E]'
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
            <div className="border-b border-[#30363D]">
              <nav className="flex space-x-8 overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-[#8B949E] hover:text-white'
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

export default function StockResearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D1117] text-white flex items-center justify-center">Loading...</div>}>
      <StockResearchPageContent />
    </Suspense>
  );
}