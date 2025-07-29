/*
 * Centralised thin client for calling the backend FastAPI routes from the Next.js frontend and Expo app.
 * Each function logs inputs & outputs and returns parsed JSON.
 * This keeps API-calling logic out of React components and fixes all
 * `import '@/lib/front_api_client'` errors across the codebase.
 */

import { getSupabase } from '../utils/supabaseClient';
import { 
  APIResponse,
  DashboardOverview,
  AnalyticsHolding,
  AnalyticsSummary,
  PortfolioData,
  Transaction,
  UserProfile,
  WatchlistItem,
  DividendRecord,
  StockOverview,
  StockQuote,
  SymbolSearchResult,
  ExchangeRate
} from '../types/api-contracts';

// Type alias for backward compatibility
export type ApiResponse<T = any> = APIResponse<T>;

// API Version Configuration
interface APIConfig {
  version: 'v1' | 'v2';
  autoTransform: boolean; // Whether to automatically transform v2 responses to v1 format
}

const apiConfig: APIConfig = {
  version: 'v1', // Default to v1 for backward compatibility
  autoTransform: true
};

// Helper to set API version globally
export function setAPIVersion(version: 'v1' | 'v2', autoTransform: boolean = true): void {
  apiConfig.version = version;
  apiConfig.autoTransform = autoTransform;
  console.log(`[API Client] Switched to API version ${version}, autoTransform: ${autoTransform}`);
}

// Helper to get current API version
export function getAPIVersion(): string {
  return apiConfig.version;
}

// Use appropriate environment variable based on platform
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 
                 process.env.EXPO_PUBLIC_BACKEND_API_URL ?? 
                 'http://localhost:8000';

console.log('[front_api_client] API_BASE:', API_BASE);

/**
 * A wrapper around fetch that automatically adds the Supabase auth token.
 * This is the central point for all outgoing API requests.
 * @param path The API path to call (e.g., '/api/dashboard')
 * @param init The request init options (e.g., method, body)
 * @returns The fetch response
 */
export async function authFetch(path: string, init: RequestInit = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [authFetch] Starting request to: ${path}`);
  console.log(`[${timestamp}] [authFetch] Method: ${init.method || 'GET'}`);
  
  // Helper function to make authenticated request
  const makeAuthenticatedRequest = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    
    // Add API version header
    headers.set('X-API-Version', apiConfig.version);
    
    if ((init.method === 'POST' || init.method === 'PUT') && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    const fullUrl = `${API_BASE}${path}`;
    const requestConfig = {
      credentials: 'include' as RequestCredentials,
      ...init,
      headers,
    };
    
    console.log(`[${timestamp}] [authFetch] Full URL: ${fullUrl}`);
    if (init.body) {
      console.log(`[${timestamp}] [authFetch] Request body:`, typeof init.body === 'string' ? JSON.parse(init.body) : init.body);
    }
    
    return fetch(fullUrl, requestConfig);
  };

  const { data: { session }, error: sessionError } = await getSupabase().auth.getSession();
  
  if (sessionError) {
    console.error(`[${timestamp}] [authFetch] Session error:`, sessionError);
  }

  console.log(`[${timestamp}] [authFetch] Session status:`, {
    hasSession: !!session,
    hasToken: !!session?.access_token,
    userEmail: session?.user?.email,
    userId: session?.user?.id,
    tokenExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A'
  });

  if (!session?.access_token) {
    console.log(`[${timestamp}] [authFetch] No access token, attempting to refresh session...`);
    // Try to refresh the session
    const { data: { session: refreshedSession }, error: refreshError } = await getSupabase().auth.refreshSession();
    
    if (refreshError) {
      console.error(`[${timestamp}] [authFetch] Session refresh failed:`, refreshError);
      // Make unauthenticated request
      const headers = new Headers(init.headers);
      if ((init.method === 'POST' || init.method === 'PUT') && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      
      console.warn(`[${timestamp}] [authFetch] Making UNAUTHENTICATED request to ${path}`);
      const response = await fetch(`${API_BASE}${path}`, {
        credentials: 'include' as RequestCredentials,
        ...init,
        headers,
      });
      
      console.log(`[${timestamp}] [authFetch] Unauthenticated response status: ${response.status} ${response.statusText}`);
      return response;
    }
    
    if (!refreshedSession?.access_token) {
      const error = new Error('Authentication failed: no access token after refresh');
      console.error(`[${timestamp}] [authFetch] ${error.message}`);
      throw error;
    }
    
    console.log(`[${timestamp}] [authFetch] Session refreshed successfully, new token obtained`);
    return makeAuthenticatedRequest(refreshedSession.access_token);
  }
  
  try {
    const startTime = performance.now();
    const response = await makeAuthenticatedRequest(session.access_token);
    const endTime = performance.now();
    
    console.log(`[${timestamp}] [authFetch] Response received:`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      duration: `${(endTime - startTime).toFixed(2)}ms`
    });
    
    return response;
  } catch (fetchError) {
    console.error(`[${timestamp}] [authFetch] Request failed:`, fetchError);
    throw fetchError;
  }
}

/**
 * Transform v2 API response to v1 format for backward compatibility
 */
function transformV2ToV1<T>(response: APIResponse<T>): T {
  if (!response.success && response.error) {
    throw new Error(response.message || response.error);
  }
  if (response.data === undefined) {
    throw new Error('No data in response');
  }
  return response.data;
}

/**
 * Handle response based on API version configuration
 */
async function handleVersionedResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any;
  
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('[handleVersionedResponse] Failed to parse JSON:', text);
    throw new Error('Invalid JSON response');
  }
  
  // If using v2 and response has the v2 structure
  if (apiConfig.version === 'v2' && 'success' in data && 'data' in data) {
    // If autoTransform is enabled, extract just the data for backward compatibility
    if (apiConfig.autoTransform) {
      return transformV2ToV1<T>(data as APIResponse<T>);
    }
    // Otherwise return the full v2 response
    return data as T;
  }
  
  // For v1 or responses without v2 structure, return as is
  return data as T;
}

/**
 * A helper to make a GET request and parse the JSON response.
 * Throws an error if the request is not successful.
 * @param path The API path for the GET request
 * @returns The parsed JSON data
 */
async function getJSON<T>(path:string): Promise<T> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [getJSON] Fetching: ${path}`);
  
  try {
    const res = await authFetch(path); // Uses the authorized fetch
    
    if (!res.ok) {
      let errorBody;
      try {
        errorBody = await res.text();
        console.error(`[${timestamp}] [getJSON] Error response body:`, errorBody);
      } catch (textError) {
        errorBody = 'Could not read error response';
        console.error(`[${timestamp}] [getJSON] Could not read error response:`, textError);
      }
      
      const errorMessage = `GET ${path} → ${res.status} ${res.statusText}`;
      console.error(`[${timestamp}] [getJSON] Request failed: ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    try {
      const jsonData = await handleVersionedResponse<T>(res);
      console.log(`[${timestamp}] [getJSON] Success:`, {
        path,
        dataKeys: jsonData && typeof jsonData === 'object' ? Object.keys(jsonData) : 'N/A',
        apiVersion: apiConfig.version
      });
      return jsonData;
    } catch (jsonError) {
      console.error(`[${timestamp}] [getJSON] Response handling error:`, jsonError);
      throw new Error(`Failed to parse response from ${path}: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`[${timestamp}] [getJSON] Error for ${path}:`, error);
    throw error;
  }
}

// ───────────────────────────────── Dashboard ────────────────────────────────
export const front_api_get_dashboard = (): Promise<ApiResponse<DashboardOverview>> => {
  return getJSON<ApiResponse<DashboardOverview>>('/api/dashboard');
};

export const front_api_get_performance = (period: string, benchmark: string = 'SPY') => {
  const encodedPeriod = encodeURIComponent(period);
  const encodedBenchmark = encodeURIComponent(benchmark);
  const targetUrl = `/api/dashboard/performance?period=${encodedPeriod}&benchmark=${encodedBenchmark}`;
  
  const result = getJSON(targetUrl);
  
  return result;
};

// ───────────────────────────────── Portfolio ────────────────────────────────
export const front_api_get_portfolio = () => {
  return getJSON<any>('/api/portfolio');
};

export const front_api_get_quote = (ticker: string) => {
  return getJSON<any>(`/api/quote/${encodeURIComponent(ticker)}`);
};

// ───────────────────────────────── Transactions ─────────────────────────────
export const front_api_get_transactions = () => {
  return getJSON('/api/transactions');
};

export const front_api_get_historical_price = (symbol: string, date: string) => {
  // 🔥 VALIDATE PARAMETERS BEFORE URL CONSTRUCTION
  if (typeof symbol !== 'string') {
    throw new Error(`Invalid symbol type: expected string, got ${typeof symbol}`);
  }
  
  if (typeof date !== 'string') {
    throw new Error(`Invalid date type: expected string, got ${typeof date}`);
  }
  
  if (!symbol || symbol.trim() === '') {
    throw new Error(`Symbol cannot be empty`);
  }
  
  if (!date || date.trim() === '') {
    throw new Error(`Date cannot be empty`);
  }
  
  // 🔥 URL CONSTRUCTION WITH EXTENSIVE DEBUGGING
  const encodedSymbol = encodeURIComponent(symbol);
  const encodedDate = encodeURIComponent(date);
  
  const url = `/api/historical_price/${encodedSymbol}?date=${encodedDate}`;
  
  const result = getJSON(url);
  
  return result;
};

export const front_api_add_transaction = async (body: unknown) => {
  const response = await authFetch(`/api/transactions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const responseData = await response.json();
  
  // Handle HTTP errors (500, 404, etc.)
  if (!response.ok) {
    throw new Error(responseData.message || responseData.detail || 'Failed to add transaction');
  }
  
  // Handle validation errors (success: false)
  if (responseData.success === false) {
    throw new Error(responseData.message || 'Validation failed');
  }
  
  return responseData;
};

export const front_api_update_transaction = async (id: string, body: unknown) => {
  const response = await authFetch(`/api/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.message || responseData.detail || `Failed to update transaction ${id}`);
  }
  
  // Handle validation errors (success: false)
  if (responseData.success === false) {
    throw new Error(responseData.message || 'Validation failed');
  }
  
  return responseData;
};

export const front_api_delete_transaction = async (id: string) => {
  const response = await authFetch(`/api/transactions/${id}`, {
    method: 'DELETE',
  });
  // DELETE requests might not have a body, so we check status first.
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})); // try to parse error, but don't fail if no body
    throw new Error(errorData.message || errorData.detail || `Failed to delete transaction ${id}`);
  }
  // If there's a body, parse it, otherwise return a success object.
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  }
  return { success: true };
};

// ───────────────────────────────── Research ────────────────────────────────
export const front_api_search_symbols = (opts: { query: string; limit?: number }) => {
  const url = `/api/symbol_search?q=${encodeURIComponent(opts.query)}&limit=${opts.limit ?? 50}`;
  
  const result = getJSON<any>(url);
  console.debug(`[API] Symbol search results: ${result}`);
  return result;
};

export const front_api_get_stock_overview = (ticker: string) => {
  return getJSON(`/api/stock_overview?symbol=${encodeURIComponent(ticker)}`);
};

export const front_api_get_stock_research_data = (ticker: string) => {
  return getJSON<any>(`/api/stock_overview?symbol=${encodeURIComponent(ticker)}`);
};

// ───────────────────────────────── Financial Data ──────────────────────────────
export const front_api_get_company_financials = (
  symbol: string, 
  dataType: 'OVERVIEW' | 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW' = 'OVERVIEW',
  forceRefresh: boolean = false
) => {
  const encodedSymbol = encodeURIComponent(symbol);
  const encodedDataType = encodeURIComponent(dataType);
  const url = `/api/financials/${encodedSymbol}?data_type=${encodedDataType}&force_refresh=${forceRefresh}`;
  
  const result = getJSON<{
    success: boolean;
    data?: any;
    metadata?: {
      symbol: string;
      data_type: string;
      cache_status: 'hit' | 'miss' | 'force_refresh' | 'error';
      timestamp: string;
    };
    error?: string;
  }>(url);
  
  // Log cache performance for optimization
  result.then((data) => {
    console.debug(`[API] Financials ${data.metadata?.cache_status?.toUpperCase()} for ${symbol}:${dataType}`);
  }).catch((error) => {
    console.error(`[API] Financials fetch failed for ${symbol}:${dataType}:`, error);
  });
  
  return result;
};

export const front_api_force_refresh_financials = (
  symbol: string,
  dataType: 'overview' | 'income' | 'balance' | 'cashflow' = 'overview'
) => {
  const encodedSymbol = encodeURIComponent(symbol);
  const encodedDataType = encodeURIComponent(dataType);
  const url = `/api/financials/force-refresh?symbol=${encodedSymbol}&data_type=${encodedDataType}`;
  
  return authFetch(url, { method: 'POST' }).then(res => res.json());
};

// ───────────────────────────────── Analytics ──────────────────────────────
export const front_api_get_analytics_summary = () => {
  return getJSON<{
    success: boolean;
    data: {
      portfolio_value: number;
      total_profit: number;
      total_profit_percent: number;
      irr_percent: number;
      passive_income_ytd: number;
      cash_balance: number;
      dividend_summary: {
        total_received: number;
        total_pending: number;
        ytd_received: number;
        confirmed_count: number;
        pending_count: number;
      };
    };
  }>('/api/analytics/summary');
};

export const front_api_get_analytics_holdings = (includeSold: boolean = false) => {
  return getJSON<{
    success: boolean;
    data: Array<{
      symbol: string;
      quantity: number;
      current_price: number;
      current_value: number;
      cost_basis: number;
      unrealized_gain: number;
      unrealized_gain_percent: number;
      realized_pnl: number;
      dividends_received: number;
      total_profit: number;
      total_profit_percent: number;
      daily_change: number;
      daily_change_percent: number;
      irr_percent: number;
    }>;
  }>(`/api/analytics/holdings?include_sold=${includeSold}`);
};

export const front_api_get_analytics_dividends = (confirmedOnly: boolean = false) => {
  return getJSON<{
    success: boolean;
    data: Array<{
      id: string;
      symbol: string;
      ex_date: string;
      pay_date: string;
      amount: number;
      currency: string;
      confirmed: boolean;
      current_holdings: number;
      projected_amount?: number;
      created_at: string;
    }>;
  }>(`/api/analytics/dividends?confirmed_only=${confirmedOnly}`);
};

export const front_api_confirm_dividend = async (dividendId: string) => {
  const response = await authFetch(`/api/analytics/dividends/confirm?dividend_id=${dividendId}`, {
    method: 'POST',
  });
  const responseData = await response.json();
  
  if (!response.ok) {
    throw new Error(responseData.message || responseData.detail || 'Failed to confirm dividend');
  }
  
  if (responseData.success === false) {
    throw new Error(responseData.message || 'Confirmation failed');
  }
  
  return responseData;
};

export const front_api_sync_dividends = async (symbol: string) => {
  const response = await authFetch(`/api/analytics/dividends/sync?symbol=${encodeURIComponent(symbol)}`, {
    method: 'POST',
  });
  const responseData = await response.json();
  
  if (!response.ok) {
    throw new Error(responseData.message || responseData.detail || 'Failed to sync dividends');
  }
  
  return responseData;
};

// ───────────────────────────────── Auth / misc ──────────────────────────────
export const front_api_validate_auth_token = () => {
  return getJSON('/api/auth/validate');
};

export const front_api_health_check = () => {
  return fetch(`${API_BASE}/`).then((r) => r.json());
};

/**
 * Get historical price data for a stock ticker
 * 
 * @param ticker Stock ticker symbol (e.g., 'AAPL')
 * @param years Number of years of historical data (default: 5)
 * @returns Promise with price data response
 */
export async function front_api_get_stock_prices(
  ticker: string,
  period: string
): Promise<{
  success: boolean;
  data?: {
    symbol: string;
    price_data: Array<{
      time: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    years_requested: number;
    years_available: number;
    data_points: number;
  };
  metadata?: {
    cache_status: string;
    data_sources: string[];
    last_updated: string;
    gaps_filled: number;
    timestamp: string;
  };
  error?: string;
}> {
  console.log(`[front_api_client] Getting price data for ${ticker} (${period})`);
  
  try {
    // Remove the leading '?' from period if it exists since we're adding it ourselves
    const cleanPeriod = period.startsWith('?') ? period.substring(1) : period;
    const url = `/api/stock_prices/${ticker}${cleanPeriod ? '?' + cleanPeriod : ''}`;
    console.log(`[front_api_client] Fetching URL: ${url}`);
    const response = await authFetch(url);
    const data = await response.json();
    console.log(`[front_api_client] Price data response for ${ticker}:`, {
      success: data.success,
      dataPoints: data.data?.data_points || 0,
      cacheStatus: data.metadata?.cache_status,
      dataSources: data.metadata?.data_sources,
      startDate: data.data?.start_date,
      endDate: data.data?.end_date,
      firstDataPoint: data.data?.price_data?.[0],
      lastDataPoint: data.data?.price_data?.[data.data?.price_data?.length - 1]
    });
    return data;
  } catch (error) {
    console.error(`[front_api_client] Error getting price data for ${ticker}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch price data'
    };
  }
}

/**
 * Fetch news and sentiment data for a stock
 */
export async function front_api_get_news(symbol: string, limit: number = 50): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  console.log(`[front_api_client] Getting news for ${symbol} (limit: ${limit})`);
  
  try {
    const response = await authFetch(`/api/news/${symbol}?limit=${limit}`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[front_api_client] News API error:`, data);
      return {
        success: false,
        error: data.error || data.detail || 'Failed to fetch news'
      };
    }
    
    console.log(`[front_api_client] News response for ${symbol}:`, {
      success: data.success,
      articles: data.data?.articles?.length || 0
    });
    
    return data;
  } catch (error) {
    console.error(`[front_api_client] Error getting news for ${symbol}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch news'
    };
  }
}

// Generic get method for API calls
async function get(path: string): Promise<any> {
  console.log(`[front_api_client] GET ${path}`);
  try {
    const response = await authFetch(path);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[front_api_client] GET ${path} failed:`, data);
      return {
        success: false,
        error: data.error || data.detail || `Request failed: ${response.status}`,
        data: null
      };
    }
    
    console.log(`[front_api_client] GET ${path} success`);
    return data;
  } catch (error) {
    console.error(`[front_api_client] GET ${path} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
      data: null
    };
  }
}

// ───────────────────────────────── Forex ──────────────────────────────
export const front_api_get_exchange_rate = async (params: {
  from_currency: string;
  to_currency: string;
  date?: string;
}) => {
  const queryParams = new URLSearchParams({
    from_currency: params.from_currency,
    to_currency: params.to_currency,
    ...(params.date && { date: params.date })
  });
  
  const response = await authFetch(`/api/forex/rate?${queryParams}`);
  const responseData = await response.json();
  
  if (!response.ok) {
    throw new Error(responseData.detail || 'Failed to fetch exchange rate');
  }
  
  return responseData;
};

// ───────────────────────────────── User Profile ──────────────────────────────
export const front_api_get_user_profile = async () => {
  const response = await authFetch('/api/profile');
  const responseData = await response.json();
  
  if (!response.ok) {
    throw new Error(responseData.detail || 'Failed to fetch user profile');
  }
  
  return responseData;
};

// Convenience object for components that import as `front_api_client.front_api_*`
export const front_api_client = {
  // Generic method
  get,
  
  // Specific methods
  front_api_get_dashboard,
  front_api_get_performance,
  front_api_get_portfolio,
  front_api_get_quote,
  front_api_get_transactions,
  front_api_get_historical_price,
  front_api_add_transaction,
  front_api_update_transaction,
  front_api_delete_transaction,
  front_api_search_symbols,
  front_api_get_stock_overview,
  front_api_get_stock_research_data,
  front_api_get_company_financials,
  front_api_force_refresh_financials,
  front_api_get_analytics_summary,
  front_api_get_analytics_holdings,
  front_api_get_analytics_dividends,
  front_api_confirm_dividend,
  front_api_sync_dividends,
  front_api_validate_auth_token,
  front_api_health_check,
  front_api_get_stock_prices,
  front_api_get_news,
  front_api_get_exchange_rate,
  front_api_get_user_profile,
};