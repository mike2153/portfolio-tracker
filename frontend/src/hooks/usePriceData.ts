import { useState, useEffect } from 'react';
import { front_api_get_stock_prices } from '@/lib/front_api_client';

interface PriceDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface UsePriceDataResult {
  priceData: PriceDataPoint[];
  isLoading: boolean;
  error: string | null;
  yearsAvailable: number;
  dataPoints: number;
  cacheStatus: string;
  dataSources: string[];
  refetch: () => void;
}

/**
 * Custom hook for fetching historical stock price data
 * Uses the new price data service with intelligent caching
 */
export function usePriceData(ticker: string | null, period: string = '?years=5'): UsePriceDataResult {
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yearsAvailable, setYearsAvailable] = useState(0);
  const [dataPoints, setDataPoints] = useState(0);
  const [cacheStatus, setCacheStatus] = useState('');
  const [dataSources, setDataSources] = useState<string[]>([]);

  const fetchPriceData = async () => {
    if (!ticker) {
      setPriceData([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`[usePriceData] Fetching price data for ${ticker} (${period})`);
      
      const response = await front_api_get_stock_prices(ticker, period);

      if (response.success && response.data) {
        console.log(`[usePriceData] Successfully fetched ${response.data.data_points} price points for ${ticker}`);
        
        setPriceData(response.data.price_data || []);
        setYearsAvailable(response.data.years_available || 0);
        setDataPoints(response.data.data_points || 0);
        setCacheStatus(response.metadata?.cache_status || 'unknown');
        setDataSources(response.metadata?.data_sources || []);
        setError(null);
      } else {
        const errorMessage = response.error || 'Failed to fetch price data';
        console.error(`[usePriceData] Error fetching price data for ${ticker}:`, errorMessage);
        setError(errorMessage);
        setPriceData([]);
        setYearsAvailable(0);
        setDataPoints(0);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch price data';
      console.error(`[usePriceData] Exception fetching price data for ${ticker}:`, err);
      setError(errorMessage);
      setPriceData([]);
      setYearsAvailable(0);
      setDataPoints(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when ticker or years change
  useEffect(() => {
    fetchPriceData();
  }, [ticker, period]);

  return {
    priceData,
    isLoading,
    error,
    yearsAvailable,
    dataPoints,
    cacheStatus,
    dataSources,
    refetch: fetchPriceData
  };
}