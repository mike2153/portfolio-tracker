import { apiEndpoints, config } from './config';
import { supabase } from './supabaseClient';
import {
  ApiResponse,
  PortfolioData,
  SymbolSearchResponse,
  HistoricalDataResponse,
  StockOverviewResponse,
  AddHoldingPayload,
  StockSymbol,
  DashboardOverview,
  Allocation,
  GainerLoser,
  DividendForecast,
  FxRates,
} from '@/types/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiService {
  public async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Get authentication token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add authorization header if user is authenticated
    if (session?.access_token) {
      defaultHeaders['Authorization'] = `Bearer ${session.access_token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include',
    };

    try {
      console.log(`%c[API] Making request to: ${url}`, 'background: #e6f3ff; color: #0066cc;');
      
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        console.log(`%c[API] Request failed: ${url} - ${response.status}`, 'background: #ffeeee; color: #cc0000;', data);
        return {
          ok: false,
          error: data.message || `HTTP error! status: ${response.status}`,
          status: response.status,
        };
      }
      
      console.log(`%c[API] Request successful: ${url}`, 'background: #eeffee; color: #006600;', data);
      return {
        ok: true,
        data,
        status: response.status,
      };

    } catch (error: any) {
      console.error(`%c[API] Request exception: ${url}`, 'background: #ffeeee; color: #cc0000;', error);
      return {
        ok: false,
        error: error.message || 'An unexpected error occurred.',
        status: 0,
      };
    }
  }

  async getPortfolio(userId: string): Promise<ApiResponse<PortfolioData>> {
    return this.makeRequest<PortfolioData>(apiEndpoints.portfolios(userId));
  }

  async addHolding(userId: string, payload: AddHoldingPayload): Promise<ApiResponse<any>> {
    return this.makeRequest(apiEndpoints.addHolding(userId), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateHolding(userId: string, holdingId: number, payload: AddHoldingPayload): Promise<ApiResponse<any>> {
    return this.makeRequest(apiEndpoints.updateHolding(userId, holdingId), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async searchSymbols(query: string, limit: number = 50): Promise<ApiResponse<SymbolSearchResponse>> {
    return this.makeRequest<SymbolSearchResponse>(apiEndpoints.symbolsSearch(query, limit));
  }

  async getHistoricalData(ticker: string, period: string = '5Y'): Promise<ApiResponse<HistoricalDataResponse>> {
    return this.makeRequest<HistoricalDataResponse>(apiEndpoints.stockHistorical(ticker, period));
  }

  async getStockOverview(ticker: string): Promise<ApiResponse<StockOverviewResponse>> {
    return this.makeRequest<StockOverviewResponse>(apiEndpoints.stockOverview(ticker));
  }

  async getQuote(ticker: string): Promise<ApiResponse<any>> {
    return this.makeRequest(apiEndpoints.stockQuote(ticker));
  }

  async removeHolding(userId: string, holdingId: number): Promise<ApiResponse<any>> {
    return this.makeRequest(apiEndpoints.deleteHolding(userId, holdingId), {
      method: 'DELETE',
    });
  }

  /**
   * Delete a user transaction by ID
   */
  async deleteTransaction(transactionId: number): Promise<ApiResponse<any>> {
    const url = `${config.apiBaseUrl}/api/transactions/${transactionId}`;
    return this.makeRequest<any>(url, {
      method: 'DELETE',
    });
  }

  /**
   * Update a user transaction by ID
   */
  async updateTransaction(transactionId: number, data: any): Promise<ApiResponse<any>> {
    const url = `${config.apiBaseUrl}/api/transactions/${transactionId}`;
    return this.makeRequest<any>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();
export { ApiError };

// Dashboard API
export const dashboardAPI = {
  getOverview: async (): Promise<ApiResponse<DashboardOverview>> => {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.overview()}`;
    return apiService.makeRequest<DashboardOverview>(url);
  },

  getAllocation: async (groupBy: string = 'sector'): Promise<ApiResponse<Allocation>> => {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.allocation(groupBy)}`;
    return apiService.makeRequest<Allocation>(url);
  },

  getGainers: async (limit: number = 5): Promise<ApiResponse<GainerLoser>> => {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.gainers(limit)}`;
    return apiService.makeRequest<GainerLoser>(url);
  },

  getLosers: async (limit: number = 5): Promise<ApiResponse<GainerLoser>> => {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.losers(limit)}`;
    return apiService.makeRequest<GainerLoser>(url);
  },

  getDividendForecast: async (months: number = 12): Promise<ApiResponse<DividendForecast>> => {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.dividendForecast(months)}`;
    return apiService.makeRequest<DividendForecast>(url);
  },

  getFxRates: async (base: string = 'AUD'): Promise<ApiResponse<FxRates>> => {
    const url = `${config.apiBaseUrl}${apiEndpoints.fx.latest(base)}`;
    return apiService.makeRequest<FxRates>(url);
  },

  getPortfolioPerformance: async (
    userId: string,
    period: string = '1Y',
    benchmark: string = '^GSPC'
  ): Promise<ApiResponse<any>> => {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.portfolioPerformance(
      userId,
      period,
      encodeURIComponent(benchmark)
    )}`;
    return apiService.makeRequest<any>(url);
  },
};

// Add transaction API functions after existing functions

// Transaction management  
export const transactionAPI = {
  // Create a new transaction
  async createTransaction(transactionData: {
    transaction_type: 'BUY' | 'SELL' | 'DIVIDEND';
    ticker: string;
    company_name?: string;
    shares: number;
    price_per_share: number;
    transaction_date: string;
    transaction_currency?: string;
    commission?: number;
    notes?: string;
    user_id?: string;
  }): Promise<ApiResponse<{ transaction_id: number; ticker: string }>> {
    console.log('[TransactionAPI] Creating transaction:', transactionData);
    
    return apiService.makeRequest(`${config.apiBaseUrl}/api/transactions/create`, {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  },

  // Get user transactions
  async getUserTransactions(filters: {
    user_id?: string;
    transaction_type?: 'BUY' | 'SELL' | 'DIVIDEND';
    ticker?: string;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<ApiResponse<{
    transactions: Array<{
      id: number;
      transaction_type: string;
      ticker: string;
      company_name: string;
      shares: number;
      price_per_share: number;
      transaction_date: string;
      transaction_currency: string;
      commission: number;
      total_amount: number;
      daily_close_price?: number;
      notes: string;
      created_at: string;
    }>;
    count: number;
    filters_applied: any;
  }>> {
    console.log('[TransactionAPI] Getting user transactions with filters:', filters);
    
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    return apiService.makeRequest(`${config.apiBaseUrl}/api/transactions/user?${params}`);
  },

  // Update current prices with rate limiting
  async updateCurrentPrices(user_id?: string): Promise<ApiResponse<{
    prices: Record<string, {
      price: number;
      change: number;
      change_percent: number;
      volume: number;
      timestamp: string;
    }>;
    stats: {
      successful_fetches: number;
      failed_fetches: number;
      total_tickers: number;
    };
    cached_until: string;
  }>> {
    console.log('[TransactionAPI] Updating current prices for user:', user_id);
    
    return apiService.makeRequest(`${config.apiBaseUrl}/api/transactions/update-prices`, {
      method: 'POST',
      body: JSON.stringify({ user_id }),
    });
  },

  // Get cached current prices
  async getCachedPrices(user_id?: string): Promise<ApiResponse<{
    prices: Record<string, any>;
    is_cached: boolean;
  }>> {
    console.log('[TransactionAPI] Getting cached prices for user:', user_id);
    
    const params = new URLSearchParams();
    if (user_id) params.append('user_id', user_id);
    
    return apiService.makeRequest(`${config.apiBaseUrl}/api/transactions/cached-prices?${params}`);
  },

  // Get transaction summary
  async getTransactionSummary(user_id?: string): Promise<ApiResponse<{
    summary: {
      total_transactions: number;
      buy_transactions: number;
      sell_transactions: number;
      dividend_transactions: number;
      unique_tickers: number;
      total_invested: number;
      total_received: number;
      total_dividends: number;
      net_invested: number;
    };
    tickers: string[];
  }>> {
    console.log('[TransactionAPI] Getting transaction summary for user:', user_id);
    
    const params = new URLSearchParams();
    if (user_id) params.append('user_id', user_id);
    
    return apiService.makeRequest(`${config.apiBaseUrl}/api/transactions/summary?${params}`);
  },

  // Migrate existing holdings to transactions
  async migrateExistingHoldings(user_id?: string): Promise<ApiResponse<{
    migrated_count: number;
    total_holdings: number;
  }>> {
    console.log('[TransactionAPI] Migrating existing holdings for user:', user_id);
    
    return apiService.makeRequest(`${config.apiBaseUrl}/api/transactions/migrate`, {
      method: 'POST',
      body: JSON.stringify({ user_id }),
    });
  }
}; 