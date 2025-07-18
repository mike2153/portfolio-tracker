// Stock Research Types

export interface StockSearchResult {
  ticker: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  source: 'alpha_vantage' | 'local';
}

export interface StockOverview {
  name: string;
  ticker: string;
  exchange: string;
  sector: string;
  industry: string;
  country: string;
  description: string;
  market_cap: string;
  pe_ratio: string;
  eps: string;
  beta: string;
  dividend_yield: string;
  book_value: string;
  '52_week_high': string;
  '52_week_low': string;
  revenue_ttm: string;
  gross_profit_ttm: string;
  profit_margin: string;
  // Additional properties for comprehensive metrics
  earnings_date?: string;
  forward_pe?: string;
  peg_ratio?: string;
  price_to_sales?: string;
  price_to_book?: string;
  operating_margin?: string;
  quarterly_revenue_growth?: string;
  quarterly_earnings_growth?: string;
  dividend_per_share?: string;
  ex_dividend_date?: string;
  dividend_date?: string;
  '50_day_ma'?: string;
  '200_day_ma'?: string;
}

export interface StockQuote {
  price: string;
  change: string;
  change_percent: string;
  volume: string;
  open: string;
  high: string;
  low: string;
  previous_close: string;
  latest_trading_day: string;
}

export interface PriceDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinancialStatement {
  [key: string]: string | number;
}

export interface FinancialsData {
  annual: FinancialStatement[];
  quarterly: FinancialStatement[];
}

export interface DividendData {
  yield: string;
  payout_ratio: string;
  ex_dividend_date: string;
  dividend_date: string;
  history: Array<{
    date: string;
    amount: number;
  }>;
}

export interface NewsArticle {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  banner_image: string;
  source: string;
  source_domain: string;
  overall_sentiment_label: string;
  overall_sentiment_score: number;
  topics: Array<{
    topic: string;
    relevance_score: string;
  }>;
  ticker_sentiment?: {
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score: string;
    ticker_sentiment_label: string;
  };
}

export interface StockNote {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  added_date: string;
}

export interface ComparisonStock {
  ticker: string;
  name: string;
  isSelected: boolean;
}

export type TimePeriod = '7d' | '1m' | '3m' | '6m' | 'ytd' | '1y' | '3y' | '5y' | 'max';

export type StockResearchTab = 
  | 'overview' 
  | 'financials' 
  | 'dividends' 
  | 'news' 
  | 'insider-trades' 
  | 'analyst-predictions' 
  | 'notes' 
  | 'comparison';

export type FinancialStatementType = 'income' | 'balance' | 'cashflow';
export type FinancialPeriodType = 'annual' | 'quarterly';

// Chart-specific types
export interface ChartConfig {
  responsive: boolean;
  layout: {
    backgroundColor: string;
    textColor: string;
  };
  grid: {
    vertLines: { color: string };
    horzLines: { color: string };
  };
  crosshair: {
    mode: number;
  };
  timeScale: {
    borderColor: string;
    timeVisible: boolean;
    secondsVisible: boolean;
  };
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
}

export interface StockResearchData {
  overview?: StockOverview;
  quote?: StockQuote;
  priceData?: PriceDataPoint[];
  financials?: {
    income?: FinancialsData;
    balance?: FinancialsData;
    cashflow?: FinancialsData;
  };
  dividends?: DividendData;
  news?: NewsArticle[];
  notes?: StockNote[];
  isInWatchlist?: boolean;
}

// Component Props
export interface StockSearchProps {
  onStockSelect: (ticker: string) => void;
  placeholder?: string;
  className?: string;
}

export interface TabContentProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

export interface ComparisonModeProps {
  selectedStocks: string[];
  onStockAdd: (ticker: string) => void;
  onStockRemove: (ticker: string) => void;
  onToggleComparison: () => void;
}

// Chart Props
export interface PriceChartProps {
  data: PriceDataPoint[];
  ticker: string;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  height?: number;
  isLoading?: boolean;
}

export interface FinancialChartProps {
  data: FinancialStatement[];
  metric: string;
  title: string;
  ticker: string;
  height?: number;
}

// Financial Data Caching
export interface FinancialDataCache {
  cache_status: 'hit' | 'miss' | 'force_refresh' | 'error';
  last_updated: string;
  freshness_hours: number;
}

export interface CompanyFinancialsResponse {
  success: boolean;
  data?: CompanyFinancials;
  metadata?: {
    symbol: string;
    data_type: string;
    cache_status: 'hit' | 'miss' | 'force_refresh' | 'error';
    timestamp: string;
  };
  error?: string;
}

export interface CompanyFinancials {
  // Overview data (extends existing StockOverview)
  overview?: StockOverview & {
    last_updated?: string;
    cache_metadata?: FinancialDataCache;
  };
  
  // Income statement data
  income_statement?: {
    annual: FinancialStatement[];
    quarterly: FinancialStatement[];
    metadata?: FinancialDataCache;
  };
  
  // Balance sheet data
  balance_sheet?: {
    annual: FinancialStatement[];
    quarterly: FinancialStatement[];
    metadata?: FinancialDataCache;
  };
  
  // Cash flow data
  cash_flow?: {
    annual: FinancialStatement[];
    quarterly: FinancialStatement[];
    metadata?: FinancialDataCache;
  };
}

// Enhanced financial statement with cache-aware typing
export type CachedFinancialStatement = FinancialStatement & {
  fiscal_date_ending?: string;
  reported_currency?: string;
  cache_metadata?: FinancialDataCache;
};

// State Management
export interface StockResearchState {
  selectedTicker: string | null;
  activeTab: StockResearchTab;
  data: Record<string, StockResearchData>;
  watchlist: WatchlistItem[];
  comparisonMode: boolean;
  comparisonStocks: string[];
  isLoading: boolean;
  error: string | null;
}