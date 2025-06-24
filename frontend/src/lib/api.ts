import { apiEndpoints, config } from './config';
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
  EnhancedPortfolioPerformance,
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

class ApiService {
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`[API] Making request to: ${url}`);
      const response = await fetch(url, defaultOptions);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        let errorData: any = null;

        try {
          errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }

        console.error(`[API] Error response:`, { status: response.status, message: errorMessage, data: errorData });
        
        return {
          ok: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      console.log(`[API] Success response from ${url}:`, data);
      
      return {
        ok: true,
        data,
      };
    } catch (error) {
      console.error(`[API] Network error for ${url}:`, error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
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

  async searchSymbols(query: string, limit: number = 10): Promise<ApiResponse<SymbolSearchResponse>> {
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
}

export const apiService = new ApiService();
export { ApiError };

// Dashboard API
export const dashboardAPI = {
  // Internal helper to perform fetch with error handling
  async _safeFetch<T>(url: string): Promise<ApiResponse<T>> {
    try {
    const response = await fetch(url);
    if (!response.ok) {
        return { ok: false, error: `HTTP error! status: ${response.status}` };
    }
      const data = (await response.json()) as T;
    return { ok: true, data };
    } catch (err: any) {
      return { ok: false, error: 'network_error', message: err?.message ?? String(err) };
    }
  },

  async getOverview(): Promise<ApiResponse<DashboardOverview>> {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.overview()}`;
    return this._safeFetch<DashboardOverview>(url);
  },

  async getAllocation(groupBy: string = 'sector'): Promise<ApiResponse<Allocation>> {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.allocation(groupBy)}`;
    return this._safeFetch<Allocation>(url);
  },

  async getGainers(limit: number = 5): Promise<ApiResponse<GainerLoser>> {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.gainers(limit)}`;
    return this._safeFetch<GainerLoser>(url);
  },

  async getLosers(limit: number = 5): Promise<ApiResponse<GainerLoser>> {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.losers(limit)}`;
    return this._safeFetch<GainerLoser>(url);
  },

  async getDividendForecast(months: number = 12): Promise<ApiResponse<DividendForecast>> {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.dividendForecast(months)}`;
    return this._safeFetch<DividendForecast>(url);
  },

  async getFxRates(base: string = 'AUD'): Promise<ApiResponse<FxRates>> {
    const url = `${config.apiBaseUrl}${apiEndpoints.fx.latest(base)}`;
    return this._safeFetch<FxRates>(url);
  },

  async getPortfolioPerformance(
    userId: string,
    period: string = '1Y',
    benchmark: string = '^GSPC'
  ): Promise<ApiResponse<EnhancedPortfolioPerformance>> {
    const url = `${config.apiBaseUrl}${apiEndpoints.dashboard.portfolioPerformance(
      userId,
      period,
      encodeURIComponent(benchmark)
    )}`;
    return this._safeFetch<EnhancedPortfolioPerformance>(url);
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
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/transactions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
      
      const data = await response.json();
      console.log('[TransactionAPI] Create response:', data);
      
      return {
        ok: data.ok || response.ok,
        data: data.data,
        error: data.error,
        message: data.message
      };
    } catch (error) {
      console.error('[TransactionAPI] Create error:', error);
      return {
        ok: false,
        error: 'network_error',
        message: 'Failed to create transaction'
      };
    }
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
    
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
      
      const response = await fetch(`${config.apiBaseUrl}/api/transactions/user?${params}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      console.log('[TransactionAPI] Get transactions response:', data);
      
      return {
        ok: data.ok || response.ok,
        data: data.data,
        error: data.error,
        message: data.message
      };
    } catch (error) {
      console.error('[TransactionAPI] Get transactions error:', error);
      return {
        ok: false,
        error: 'network_error',
        message: 'Failed to get transactions'
      };
    }
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
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/transactions/update-prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id }),
      });
      
      const data = await response.json();
      console.log('[TransactionAPI] Update prices response:', data);
      
      return {
        ok: data.ok || response.ok,
        data: data.data,
        error: data.error,
        message: data.message,
        retry_after: data.retry_after
      } as ApiResponse<{
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
      }>;
    } catch (error) {
      console.error('[TransactionAPI] Update prices error:', error);
      return {
        ok: false,
        error: 'network_error',
        message: 'Failed to update prices'
      };
    }
  },

  // Get cached current prices
  async getCachedPrices(user_id?: string): Promise<ApiResponse<{
    prices: Record<string, any>;
    is_cached: boolean;
  }>> {
    console.log('[TransactionAPI] Getting cached prices for user:', user_id);
    
    try {
      const params = new URLSearchParams();
      if (user_id) params.append('user_id', user_id);
      
      const response = await fetch(`${config.apiBaseUrl}/api/transactions/cached-prices?${params}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      console.log('[TransactionAPI] Cached prices response:', data);
      
      return {
        ok: data.ok || response.ok,
        data: data.data,
        error: data.error,
        message: data.message
      };
    } catch (error) {
      console.error('[TransactionAPI] Get cached prices error:', error);
      return {
        ok: false,
        error: 'network_error',
        message: 'Failed to get cached prices'
      };
    }
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
    
    try {
      const params = new URLSearchParams();
      if (user_id) params.append('user_id', user_id);
      
      const response = await fetch(`${config.apiBaseUrl}/api/transactions/summary?${params}`, {
        method: 'GET',
      });
      
      const data = await response.json();
      console.log('[TransactionAPI] Summary response:', data);
      
      return {
        ok: data.ok || response.ok,
        data: data.data,
        error: data.error,
        message: data.message
      };
    } catch (error) {
      console.error('[TransactionAPI] Get summary error:', error);
      return {
        ok: false,
        error: 'network_error',
        message: 'Failed to get transaction summary'
      };
    }
  },

  // Migrate existing holdings to transactions
  async migrateExistingHoldings(user_id?: string): Promise<ApiResponse<{
    migrated_count: number;
    total_holdings: number;
  }>> {
    console.log('[TransactionAPI] Migrating existing holdings for user:', user_id);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/transactions/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id }),
      });
      
      const data = await response.json();
      console.log('[TransactionAPI] Migration response:', data);
      
      return {
        ok: data.ok || response.ok,
        data: data.data,
        error: data.error,
        message: data.message
      };
    } catch (error) {
      console.error('[TransactionAPI] Migration error:', error);
      return {
        ok: false,
        error: 'network_error',
        message: 'Failed to migrate holdings'
      };
    }
  }
}; 