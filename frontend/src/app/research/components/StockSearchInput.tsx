'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { apiService } from '@/lib/api';
import type { StockSearchResult } from '@/types/stock-research';
import type { StockSymbol } from '@/types/api';

interface StockSearchInputProps {
  onStockSelect: (ticker: string) => void;
  placeholder?: string;
  className?: string;
}

export default function StockSearchInput({ 
  onStockSelect, 
  placeholder = "Search stocks...",
  className = ""
}: StockSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle search with debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const apiResp = await apiService.searchSymbols(query.trim(), 20);
        let mapped: StockSearchResult[] = [];
        if (apiResp.ok && apiResp.data) {
          mapped = apiResp.data.results.map((s: any): StockSearchResult => {
            const src = s.source === 'alpha_vantage' ? 'alpha_vantage' : 'local';
            const region = s.region ?? s.country ?? s.exchange ?? '';
            return {
              ticker: s.symbol,
              name: s.name,
              type: s.type ?? 'Equity',
              region,
              currency: s.currency ?? '',
              source: src,
            };
          });
        }
        setResults(mapped);
        setShowResults(true);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        } else if (results.length > 0) {
          handleSelect(results[0]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle stock selection
  const handleSelect = (stock: StockSearchResult) => {
    setQuery(stock.ticker);
    setShowResults(false);
    setSelectedIndex(-1);
    onStockSelect(stock.ticker);
    inputRef.current?.blur();
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current && 
        !resultsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatMarketCap = (marketCap: string) => {
    const num = parseFloat(marketCap);
    if (isNaN(num)) return '';
    
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return `$${num.toFixed(0)}`;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
          placeholder={placeholder}
          className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Search Results */}
      {showResults && (
        <div 
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {results.length > 0 ? (
            <div className="py-1">
              {results.map((stock, index) => (
                <button
                  key={`${stock.ticker}-${stock.source}`}
                  onClick={() => handleSelect(stock)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors ${
                    index === selectedIndex ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {stock.ticker}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
                          {stock.type}
                        </span>
                        {stock.source === 'alpha_vantage' && (
                          <span className="text-xs text-blue-400">Live</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-300 mt-1 line-clamp-2">
                        {stock.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{stock.region}</span>
                        <span>•</span>
                        <span>{stock.currency}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-gray-400 text-sm">
              {isSearching ? 'Searching...' : 'No results found'}
            </div>
          )}
          
          {/* Footer */}
          <div className="border-t border-gray-600 px-4 py-2 text-xs text-gray-400">
            {results.length > 0 && (
              <div className="flex justify-between items-center">
                <span>{results.length} results</span>
                <span>Use ↑↓ keys to navigate, Enter to select</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}