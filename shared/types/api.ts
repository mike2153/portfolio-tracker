// API Response Types
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

// Stock Symbol Search Types
export interface StockSymbol {
  symbol: string;
  name: string;
  currency: string;
  region: string;
  source: string;
  type: string;
  // Optional fields that may be added later
  exchange?: string;
  exchange_code?: string;
  country?: string;
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
  notes?: string;
  transaction_type?: 'BUY' | 'SELL' | 'DIVIDEND';
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

// =================
// DASHBOARD TYPES
// =================

export interface KPIValue {
  value: number;
  sub_label: string;
  delta?: number;
  deltaPercent?: number;
  is_positive: boolean;
}

export interface DashboardOverview {
  marketValue: KPIValue;
  totalProfit: KPIValue;
  irr: KPIValue;
  passiveIncome: KPIValue;
}

export interface EnhancedDashboardOverview {
  marketValue: KPIValue;
  irr: KPIValue;
  dividendYield: KPIValue;
  portfolioBeta: KPIValue;
}

export interface AllocationRow {
  groupKey: string;
  value: number;
  invested: number;
  gainValue: number;
  gainPercent: number;
  allocation: number;
  accentColor: string;
}

export interface Allocation {
  rows: AllocationRow[];
}

export interface GainerLoserRow {
  logoUrl?: string;
  name: string;
  ticker: string;
  value: number;
  changePercent: number;
  changeValue: number;
}

export interface GainerLoser {
  items: GainerLoserRow[];
}

export interface DividendForecastItem {
  month: string;
  amount: number;
}

export interface DividendForecast {
  forecast: DividendForecastItem[];
  next12mTotal: number;
  monthlyAvg: number;
}

// =================
// MOBILE APP TYPES
// =================

// Analytics Types
export interface AnalyticsHolding {
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
}

export interface AnalyticsSummary {
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
}

export interface DividendData {
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
}

// Watchlist Types
export interface WatchlistItem {
  id: string;
  ticker: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  marketCap: string;
  alert?: {
    type: 'above' | 'below';
    price: number;
  };
}

export interface WatchlistGroup {
  id: string;
  name: string;
  items: WatchlistItem[];
}

// Research Types
export interface ResearchStockQuote {
  ticker: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  pe: number;
  dividend: number;
  sector: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

// Stock Price Data Types
export interface StockPriceData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockPricesResponse {
  success: boolean;
  data?: {
    symbol: string;
    price_data: StockPriceData[];
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
}

// News Response Types
export interface NewsResponse {
  success: boolean;
  data?: {
    articles: NewsItem[];
  };
  error?: string;
}

// Company Financials Types
export interface FinancialsResponse {
  success: boolean;
  data?: any;
  metadata?: {
    symbol: string;
    data_type: string;
    cache_status: 'hit' | 'miss' | 'force_refresh' | 'error';
    timestamp: string;
  };
  error?: string;
}