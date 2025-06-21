import { apiEndpoints, config } from './config';
import {
  ApiResponse,
  PortfolioData,
  SymbolSearchResponse,
  HistoricalDataResponse,
  StockOverviewResponse,
  AddHoldingPayload,
  StockSymbol
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

  async searchSymbols(query: string, limit: number = 10): Promise<ApiResponse<SymbolSearchResponse>> {
    return this.makeRequest<SymbolSearchResponse>(apiEndpoints.symbolsSearch(query, limit));
  }

  async getHistoricalData(ticker: string, period: string = '5Y'): Promise<ApiResponse<HistoricalDataResponse>> {
    return this.makeRequest<HistoricalDataResponse>(apiEndpoints.stockHistorical(ticker, period));
  }

  async getStockOverview(ticker: string): Promise<ApiResponse<StockOverviewResponse>> {
    return this.makeRequest<StockOverviewResponse>(apiEndpoints.stockOverview(ticker));
  }
}

export const apiService = new ApiService();
export { ApiError }; 