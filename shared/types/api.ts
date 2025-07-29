/**
 * This file re-exports everything from api-contracts.ts for backward compatibility.
 * All types have been moved to api-contracts.ts as the single source of truth.
 * 
 * @deprecated Use imports from './api-contracts' directly
 */

export * from './api-contracts';

// Re-export specific types that might be imported by name
export type {
  APIResponse,
  APIResponse as ApiResponse, // Alias for backward compatibility
  ErrorResponse,
  ErrorDetail,
  DashboardOverview,
  KPIValue,
  Holding,
  PortfolioData,
  PortfolioSummary,
  StockQuote,
  HistoricalDataPoint,
  HistoricalDataResponse,
  StockOverviewResponse,
  AddHoldingFormData,
  AddHoldingPayload,
  ValidationError,
  FormErrors,
  EnhancedDashboardOverview,
  AllocationRow,
  Allocation,
  GainerLoserRow,
  GainerLoser,
  DividendForecastItem,
  DividendForecast,
  StockSymbol,
  SymbolSearchResponse,
  AnalyticsHolding,
  AnalyticsSummary,
  TransactionData,
  Transaction,
  UserProfileData,
  UserProfile,
  WatchlistItem,
  UserDividendData,
  DividendRecord,
  StockOverview,
  FinancialsData,
  NewsArticle,
  ExchangeRate,
  PriceDataPoint,
  StockSearchResult,
  SymbolSearchResult,
} from './api-contracts';