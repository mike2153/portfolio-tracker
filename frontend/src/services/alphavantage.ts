/**
 * Alpha Vantage API Service for Frontend
 * Fetches real-time bulk quotes directly from Alpha Vantage API
 * with 5-minute caching to avoid rate limits
 */

interface BulkQuoteData {
  symbol: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  change_percent: string;
  extended_hours_quote?: string;
  extended_hours_change?: string;
  extended_hours_change_percent?: string;
}

interface BulkQuotesResponse {
  data: BulkQuoteData[];
}

interface CachedQuote {
  data: Map<string, BulkQuoteData>;
  timestamp: number;
}

// Cache for 5 minutes (in milliseconds)
const CACHE_DURATION = 5 * 60 * 1000;
let quotesCache: CachedQuote | null = null;

// Get API key from environment variable
const ALPHA_VANTAGE_API_KEY = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || 'demo';

/**
 * Fetch real-time bulk quotes from Alpha Vantage
 * @param symbols Array of stock symbols to fetch
 * @returns Map of symbol to quote data
 */
export async function fetchBulkQuotes(symbols: string[]): Promise<Map<string, BulkQuoteData>> {
  // Check if we have valid cached data
  if (quotesCache && (Date.now() - quotesCache.timestamp) < CACHE_DURATION) {
    // Filter cached data to only return requested symbols
    const filteredData = new Map<string, BulkQuoteData>();
    symbols.forEach(symbol => {
      const quote = quotesCache!.data.get(symbol.toUpperCase());
      if (quote) {
        filteredData.set(symbol.toUpperCase(), quote);
      }
    });
    
    // If we have all requested symbols in cache, return them
    if (filteredData.size === symbols.length) {
      console.log('[AlphaVantage] Returning cached quotes for:', symbols);
      return filteredData;
    }
  }

  try {
    // Prepare symbols for API call (uppercase and join)
    const symbolsParam = symbols.map(s => s.toUpperCase()).join(',');
    
    // Build API URL
    const apiUrl = `https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES&symbol=${symbolsParam}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    console.log('[AlphaVantage] Fetching real-time quotes for:', symbolsParam);
    
    // Fetch data from Alpha Vantage
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
    }
    
    const data: BulkQuotesResponse = await response.json();
    
    // Check for API error messages
    if ('Error Message' in data || 'Note' in data) {
      console.error('[AlphaVantage] API error or rate limit:', data);
      // Return empty map or cached data if available
      return quotesCache?.data || new Map();
    }
    
    // Transform array to Map for easier lookup
    const quotesMap = new Map<string, BulkQuoteData>();
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(quote => {
        quotesMap.set(quote.symbol.toUpperCase(), quote);
      });
    }
    
    // Update cache with new data
    quotesCache = {
      data: quotesMap,
      timestamp: Date.now()
    };
    
    console.log('[AlphaVantage] Successfully fetched quotes for', quotesMap.size, 'symbols');
    
    return quotesMap;
    
  } catch (error) {
    console.error('[AlphaVantage] Failed to fetch bulk quotes:', error);
    
    // Return cached data if available, otherwise empty map
    return quotesCache?.data || new Map();
  }
}

/**
 * Format price for display
 * @param value Price value as string or number
 * @returns Formatted price string
 */
export function formatPrice(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '—';
  
  return `$${numValue.toFixed(2)}`;
}

/**
 * Format change value with sign
 * @param value Change value as string or number
 * @returns Formatted change string with + or - sign
 */
export function formatChange(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '—';
  
  const sign = numValue >= 0 ? '+' : '';
  return `${sign}${numValue.toFixed(2)}`;
}

/**
 * Format percentage with sign
 * @param value Percentage value as string or number
 * @returns Formatted percentage string with + or - sign
 */
export function formatPercent(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '—';
  
  const sign = numValue >= 0 ? '+' : '';
  return `${sign}${numValue.toFixed(2)}%`;
}

/**
 * Clear the quotes cache (useful for forcing refresh)
 */
export function clearQuotesCache(): void {
  quotesCache = null;
  console.log('[AlphaVantage] Cache cleared');
}