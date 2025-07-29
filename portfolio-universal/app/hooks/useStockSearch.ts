import { useState, useCallback, useRef } from 'react';
import { front_api_search_symbols } from '@portfolio-tracker/shared';

export interface StockSymbol {
  symbol: string;
  name: string;
  type?: string;
  region?: string;
  currency?: string;
  source?: string;
}

// Debounce utility function
function debounce(func: (...args: any[]) => void, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function useStockSearch() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<StockSymbol[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track the last query to handle race conditions
  const lastQuery = useRef<string>('');

  const searchSymbols = useCallback(async (query: string) => {
    if (!query || query.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    lastQuery.current = query;

    try {
      const response = await front_api_search_symbols({ 
        query: query.trim(),
        limit: 50 
      });

      // Only update if this is still the latest query
      if (lastQuery.current === query) {
        if (response.ok && response.results) {
          setSuggestions(response.results);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setError('No results found');
        }
      }
    } catch (err) {
      console.error('Stock search error:', err);
      if (lastQuery.current === query) {
        setError('Failed to search stocks');
        setSuggestions([]);
      }
    } finally {
      if (lastQuery.current === query) {
        setIsLoading(false);
      }
    }
  }, []);

  // Debounced search function (300ms delay)
  const debouncedSearch = useCallback(
    debounce((query: string) => searchSymbols(query), 300),
    [searchSymbols]
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchQuery('');
    setError(null);
  }, []);

  return {
    searchQuery,
    suggestions,
    setSuggestions,
    isLoading,
    showSuggestions,
    setShowSuggestions,
    error,
    handleSearch,
    clearSuggestions,
  };
}