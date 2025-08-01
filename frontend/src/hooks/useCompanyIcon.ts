'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface UseCompanyIconReturn {
  iconPath: string | null;
  loading: boolean;
  error: boolean;
  hasIcon: boolean;
}

// Cache for icon paths to avoid repeated lookups
const iconCache = new Map<string, string | null>();

export const useCompanyIcon = (symbol: string): UseCompanyIconReturn => {
  const [iconPath, setIconPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Clean symbol for file lookup
  const cleanSymbol = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();

  // Possible icon paths in order of preference
  const iconPaths = useMemo(() => [
    `/icons/ticker_icons/${cleanSymbol}.png`,
    `/icons/crypto_icons/${cleanSymbol}.png`,
    `/icons/forex_icons/${cleanSymbol}.png`
  ], [cleanSymbol]);

  const findIcon = useCallback(async () => {
    if (!cleanSymbol) {
      setLoading(false);
      setError(true);
      return;
    }

    // Check cache first
    if (iconCache.has(cleanSymbol)) {
      const cachedPath = iconCache.get(cleanSymbol);
      setIconPath(cachedPath || null);
      setLoading(false);
      setError(cachedPath === null);
      return;
    }

    setLoading(true);
    setError(false);
    
    for (const path of iconPaths) {
      try {
        const response = await fetch(path, { method: 'HEAD' });
        if (response.ok) {
          // Cache the successful path
          iconCache.set(cleanSymbol, path);
          setIconPath(path);
          setLoading(false);
          return;
        }
      } catch {
        // Continue to next path
      }
    }
    
    // No icon found - cache the null result
    iconCache.set(cleanSymbol, null);
    setIconPath(null);
    setError(true);
    setLoading(false);
  }, [cleanSymbol, iconPaths]);

  useEffect(() => {
    findIcon();
  }, [findIcon]);

  return {
    iconPath,
    loading,
    error,
    hasIcon: iconPath !== null && !error
  };
};

export default useCompanyIcon;