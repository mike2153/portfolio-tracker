// API Response Types
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Stock Symbol Search Types
export interface StockSymbol {
  symbol: string;
  name: string;
  exchange: string;
  exchange_code: string;
  currency: string;
  country: string;
  type: string;
}

export interface SymbolSearchResponse {
  results: StockSymbol[];
  total: number;
  query: string;
  limit: number;
  source: string;
}

// Portfolio Types
export interface Holding {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  purchase_price: number;
  market_value: number;
  current_price: number;
  purchase_date: string;
  commission?: number;
  currency?: string;
  fx_rate?: number;
  used_cash_balance?: boolean;
}

export interface PortfolioSummary {
  total_holdings: number;
  total_value: number;
}

export interface PortfolioData {
  cash_balance: number;
  holdings: Holding[];
  summary: PortfolioSummary;
}

// Stock Data Types
export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  latest_trading_day: string;
  previous_close: number;
  open: number;
  high: number;
  low: number;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
  dividend_amount: number;
  split_coefficient: number;
}

export interface HistoricalDataResponse {
  symbol: string;
  data: HistoricalDataPoint[];
  last_refreshed?: string;
  time_zone?: string;
}

export interface StockOverviewResponse {
  symbol: string;
  data: Record<string, any>;
  timestamp: string;
}

// Form Types
export interface AddHoldingFormData {
  ticker: string;
  company_name: string;
  exchange: string;
  shares: string;
  purchase_price: string;
  purchase_date: string;
  commission: string;
  currency: string;
  fx_rate: string;
  use_cash_balance: boolean;
}

export interface AddHoldingPayload {
  ticker: string;
  company_name: string;
  exchange: string;
  shares: number;
  purchase_price: number;
  purchase_date: string;
  commission: number;
  currency: string;
  fx_rate: number;
  use_cash_balance: boolean;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrors {
  [key: string]: string;
} 