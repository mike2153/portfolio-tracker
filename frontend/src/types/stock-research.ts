// Stock Research Types
// Import base types from shared API contracts
import type {
  StockSearchResult,
  StockOverview,
  StockQuote as BaseStockQuote,
  PriceDataPoint,
  FinancialStatement,
  FinancialsData,
  DividendResearchData as DividendData,
  NewsArticle,
  StockNote,
  WatchlistItem as BaseWatchlistItem,
  TimePeriod,
  StockResearchTab,
  FinancialStatementType,
  FinancialPeriodType,
  ChartConfig,
  ApiResponse,
  StockResearchData,
  FinancialDataCache,
  CompanyFinancialsResponse,
  CompanyFinancials
} from '../../../shared/types/api-contracts';

// Re-export imported types
export type {
  StockSearchResult,
  StockOverview,
  PriceDataPoint,
  FinancialStatement,
  FinancialsData,
  DividendData,
  NewsArticle,
  StockNote,
  TimePeriod,
  StockResearchTab,
  FinancialStatementType,
  FinancialPeriodType,
  ChartConfig,
  ApiResponse,
  StockResearchData,
  FinancialDataCache,
  CompanyFinancialsResponse,
  CompanyFinancials
};

// Frontend-specific extensions

/**
 * Stock quote with string values for display
 * TODO: Consider if this should be in shared types
 */
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

/**
 * Extended watchlist item for frontend display
 */
export interface WatchlistItem extends BaseWatchlistItem {
  ticker: string;
  name: string;
  added_date: string;
}

export interface ComparisonStock {
  ticker: string;
  name: string;
  isSelected: boolean;
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