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

export interface FxRate {
  pair: string;
  rate: number;
  change: number;
}

export interface FxRates {
  rates: FxRate[];
}

// Assuming Dividend interface exists; extend it:
interface Dividend {
  // Original fields only (e.g., id, symbol, ex_date, amount, etc.)
  // ... no changes here; ensure it matches pre-extension
}