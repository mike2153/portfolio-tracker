'use client';

import React, { useRef, useEffect } from 'react';
import { useStockSearch } from '@/lib/useStockSearch';
import { StockSymbol } from '@/types/api';

interface StockSearchInputProps {
  onSelectSymbol: (symbol: StockSymbol) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  name?: string;
  error?: string;
}

export function StockSearchInput({
  onSelectSymbol,
  placeholder = "Search by ticker or company name...",
  className = "",
  inputClassName = "",
  autoFocus = false,
  value,
  onChange,
  required = false,
  name = "ticker",
  error
}: StockSearchInputProps) {
  const {
    searchQuery,
    suggestions,
    isLoading,
    showSuggestions,
    setShowSuggestions,
    handleSearch,
    clearSuggestions
  } = useStockSearch();

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    handleSearch(value);
    if (onChange) {
      onChange(value);
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (symbol: StockSymbol) => {
    onSelectSymbol(symbol);
    clearSuggestions();
    if (onChange) {
      onChange(symbol.symbol);
    }
  };

  // Handle keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setShowSuggestions]);

  // 🔥 DEBUGGING - Log state changes
  useEffect(() => {
    //console.log(`🎨 [StockSearchInput] === DROPDOWN DISPLAY DEBUG ===`);
    //console.log(`🎨 [StockSearchInput] showSuggestions: ${showSuggestions}`);
    //console.log(`🎨 [StockSearchInput] searchQuery.length: ${searchQuery.length}`);
    //console.log(`🎨 [StockSearchInput] suggestions.length: ${suggestions.length}`);
    //console.log(`🎨 [StockSearchInput] isLoading: ${isLoading}`);
    //console.log(`🎨 [StockSearchInput] Display condition met: ${showSuggestions && (searchQuery.length > 0 || suggestions.length > 0)}`);
    //console.log(`🎨 [StockSearchInput] Dropdown should show: ${showSuggestions && (searchQuery.length > 0 || suggestions.length > 0)}`);

    if (suggestions.length > 0) {
       console.log(`🎨 [StockSearchInput] Available suggestions:`, suggestions.map(s => ({
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange
      })));
    }
  }, [showSuggestions, searchQuery, suggestions, isLoading]);

  // 🔥 DEBUG: Log when suggestions change
  useEffect(() => {
    //console.log(`📋 [StockSearchInput] === SUGGESTIONS CHANGED ===`);
    //console.log(`📋 [StockSearchInput] New suggestions count: ${suggestions.length}`);
    //console.log(`📋 [StockSearchInput] Suggestions:`, suggestions);
  }, [suggestions]);

  // 🔥 CRITICAL DEBUGGING: Check dropdown render condition
  useEffect(() => {
    const shouldShow = showSuggestions && (searchQuery.length > 0 || suggestions.length > 0);
    //console.log(`🚨 [StockSearchInput] === DROPDOWN RENDER CHECK ===`);
    //console.log(`🚨 [StockSearchInput] showSuggestions: ${showSuggestions}`);
    //console.log(`🚨 [StockSearchInput] searchQuery.length: ${searchQuery.length}`);
    //console.log(`🚨 [StockSearchInput] suggestions.length: ${suggestions.length}`);
    //console.log(`🚨 [StockSearchInput] shouldShow: ${shouldShow}`);
    //console.log(`🚨 [StockSearchInput] Rendering dropdown: ${shouldShow}`);
    
    if (shouldShow) {
      //console.log(`🎯 [StockSearchInput] === DROPDOWN CONTENT RENDER ===`);
      //console.log(`🎯 [StockSearchInput] isLoading: ${isLoading}`);
      //console.log(`🎯 [StockSearchInput] suggestions.length: ${suggestions.length}`);
      
      if (isLoading) {
        console.log(`🔄 [StockSearchInput] Rendering loading state`);
      } else if (suggestions.length > 0) {
        console.log(`📋 [StockSearchInput] Rendering ${suggestions.length} suggestions`);
        suggestions.forEach((symbol, index) => {
          console.log(`🎯 [StockSearchInput] Suggestion ${index}: ${symbol.symbol} - ${symbol.name}`);
        });
      } else if (searchQuery.length > 0) {
        console.log(`❌ [StockSearchInput] Rendering no results message`);
      }
    }
  }, [showSuggestions, searchQuery, suggestions, isLoading]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={value !== undefined ? value : searchQuery}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full p-2 border ${error ? 'border-red-500' : 'border-gray-600'} rounded-lg ${inputClassName}`}
        autoComplete="off"
        autoFocus={autoFocus}
        required={required}
      />
      
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}

      {showSuggestions && (searchQuery.length > 0 || suggestions.length > 0) && (
        <div className="absolute z-50 w-full bg-gray-900 border border-gray-700 rounded-lg mt-1 shadow-lg max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
              <span className="ml-2">Searching...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="py-1">
              {suggestions.map((symbol, index) => (
                <div
                  key={`${symbol.symbol}-${index}`}
                  onClick={() => handleSuggestionClick(symbol)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    highlightedIndex === index 
                      ? 'bg-gray-700 text-white' 
                      : 'hover:bg-gray-700/50 text-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {symbol.symbol}
                        {symbol.region && (
                          <span className="ml-2 text-xs text-gray-500 font-normal">
                            {symbol.region}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {symbol.name}
                      </div>
                    </div>
                    {symbol.currency && symbol.currency !== 'USD' && (
                      <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded ml-2">
                        {symbol.currency}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-800">
                Showing top {suggestions.length} results
              </div>
            </div>
          ) : searchQuery.length > 0 ? (
            <div className="p-4 text-center text-gray-500">
              No results found for "{searchQuery}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
} 
