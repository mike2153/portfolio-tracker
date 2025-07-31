'use client';

import React, { useRef, useEffect } from 'react';
import { useStockSearch } from '@/lib/useStockSearch';
import { StockSymbol } from '@/types/api';
import CompanyIcon from '@/components/ui/CompanyIcon';

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
    setSuggestions,
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
    const newValue = e.target.value.toUpperCase();
    
    // In controlled mode, just notify parent
    if (onChange) {
      onChange(newValue);
    }
    
    // Always perform search regardless of controlled/uncontrolled mode
    handleSearch(newValue);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (symbol: StockSymbol) => {
    onSelectSymbol(symbol);
    
    // In controlled mode, don't clear internal state
    if (value === undefined) {
      // Uncontrolled mode - clear everything
      clearSuggestions();
    } else {
      // Controlled mode - just hide suggestions
      setShowSuggestions(false);
      setSuggestions([]);
    }
    
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
          const selectedSuggestion = suggestions[highlightedIndex];
          if (selectedSuggestion) {
            handleSuggestionClick(selectedSuggestion);
          }
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

  // When in controlled mode and value changes externally, update search
  useEffect(() => {
    if (value !== undefined && value !== searchQuery) {
      handleSearch(value);
    }
  }, [value]);

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
    
    if (shouldShow) {
      
      if (isLoading) {
       // console.log(`🔄 [StockSearchInput] Rendering loading state`);
      } else if (suggestions.length > 0) {
        //console.log(`📋 [StockSearchInput] Rendering ${suggestions.length} suggestions`);
        suggestions.forEach((_symbol, _index) => {
          //console.log(`🎯 [StockSearchInput] Suggestion ${index}: ${symbol.symbol} - ${symbol.name}`);
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
        className={`w-full p-2 border ${error ? 'border-red-500' : 'border-[#30363D]'} rounded-lg ${inputClassName}`}
        autoComplete="off"
        autoFocus={autoFocus}
        required={required}
      />
      
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}

      {showSuggestions && (searchQuery.length > 0 || suggestions.length > 0) && (
        <div className="absolute z-50 w-full bg-[#0D1117] border border-[#30363D] rounded-lg mt-1 shadow-lg max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-[#8B949E]">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-[#8B949E]"></div>
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
                  <div className="flex items-center space-x-3">
                    <CompanyIcon 
                      symbol={symbol.symbol} 
                      size={28} 
                      fallback="initials"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {symbol.symbol}
                        {symbol.region && (
                          <span className="ml-2 text-xs text-[#8B949E] font-normal">
                            {symbol.region}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#8B949E] mt-0.5 line-clamp-1">
                        {symbol.name}
                      </div>
                    </div>
                    {symbol.currency && symbol.currency !== 'USD' && (
                      <span className="text-xs text-[#8B949E] bg-[#0D1117] border border-[#30363D] px-1.5 py-0.5 rounded ml-2">
                        {symbol.currency}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div className="px-3 py-2 text-xs text-[#8B949E] border-t border-[#30363D]">
                Showing top {suggestions.length} results
              </div>
            </div>
          ) : searchQuery.length > 0 ? (
            <div className="p-4 text-center text-[#8B949E]">
              No results found for &quot;{searchQuery}&quot;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
} 
