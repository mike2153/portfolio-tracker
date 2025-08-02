// @portfolio-tracker/shared
// Main entry point for the shared module

// Re-export all API functions (includes ApiResponse alias)
export * from './api';

// Re-export all types from api-contracts except those that would conflict
export {
  // Re-export everything except APIResponse (since ApiResponse is exported from ./api)
  type ErrorResponse,
  type ErrorDetail,
  type User,
  type UserCredentials,
  type Holding,
  type PortfolioSummary,
  type PortfolioData,
  type KPIValue,
  type DashboardOverview,
  type EnhancedDashboardOverview,
  type StockQuote,
  type HistoricalDataPoint,
  type HistoricalDataResponse,
  type StockOverviewResponse,
  type StockPriceData,
  type StockPricesResponse,
  type DividendType,
  type DividendSource,
  type DividendStatus,
  type BaseDividendData,
  type UserDividendData,
  type DividendSummary,
  type DividendByStock,
  type DividendConfirmRequest,
  type DividendSyncRequest,
  type DividendRecord,
  type Transaction,
  type TransactionData,
  type AddHoldingFormData,
  type AddHoldingPayload,
  type ValidationError,
  type FormErrors,
  type AllocationRow,
  type Allocation,
  type GainerLoserRow,
  type GainerLoser,
  type DividendForecastItem,
  type DividendForecast,
  type StockSymbol,
  type SymbolSearchResponse,
  type SymbolSearchResult,
  type AnalyticsHolding,
  type AnalyticsSummary,
  type UserProfileData,
  type UserProfile,
  type WatchlistItem,
  type StockOverview,
  type FinancialsData,
  type NewsArticle,
  type ExchangeRate,
  type PriceDataPoint
} from './types/api-contracts';

// Re-export all utilities
export * from './utils';