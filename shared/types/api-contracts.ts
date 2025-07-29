/**
 * API Contract Types - Single Source of Truth
 * 
 * This file defines all TypeScript types for API communication between
 * frontend and backend. It mirrors the backend Pydantic models to ensure
 * type safety across the entire stack.
 * 
 * IMPORTANT: This is the ONLY place where API types should be defined.
 * All other type files should import from here.
 */

// ============================================
// BASE RESPONSE STRUCTURES
// ============================================

/**
 * Standard API response wrapper matching backend APIResponse model
 * All API responses should be wrapped in this structure
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata: {
    timestamp: string;
    version: string;
    [key: string]: any;
  };
}

/**
 * Detailed error information for validation and field-specific errors
 */
export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: ErrorDetail[];
  request_id?: string;
  timestamp: string;
}

// ============================================
// AUTHENTICATION & USER TYPES
// ============================================

export interface User {
  id: string;
  email?: string;
  user_metadata?: any;
  app_metadata?: any;
  aud: string;
  created_at?: string;
}

export interface UserCredentials {
  user_id: string;
  user_token: string;
}

// ============================================
// PORTFOLIO & HOLDINGS TYPES
// ============================================

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

export interface HoldingData {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  purchase_price: number;
  current_price?: number;
  total_value?: number;
  gain_loss?: number;
  gain_loss_percent?: number;
  purchase_date: string;
  commission: number;
}

// ============================================
// TRANSACTION & FORM TYPES
// ============================================

export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND';

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
  transaction_type?: TransactionType;
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

// ============================================
// STOCK DATA & QUOTES
// ============================================

export interface StockSymbol {
  symbol: string;
  name: string;
  currency: string;
  region: string;
  source: string;
  type: string;
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

// ============================================
// DIVIDEND TYPES
// ============================================

export type DividendType = 'cash' | 'stock' | 'drp';
export type DividendSource = 'alpha_vantage' | 'manual' | 'broker';
export type DividendStatus = 'pending' | 'confirmed' | 'edited';

export interface BaseDividendData {
  symbol: string;
  ex_date: string;
  pay_date: string;
  amount_per_share: number;
  currency: string;
  dividend_type: DividendType;
  source: DividendSource;
  declaration_date?: string;
  record_date?: string;
}

export interface UserDividendData extends BaseDividendData {
  id: string;
  user_id?: string;
  shares_held_at_ex_date: number;
  current_holdings: number;
  total_amount: number;
  confirmed: boolean;
  status: DividendStatus;
  company: string;
  notes?: string;
  is_future: boolean;
  is_recent: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DividendSummary {
  total_received: number;
  total_pending: number;
  ytd_received: number;
  confirmed_count: number;
  pending_count: number;
}

export interface DividendByStock {
  ticker: string;
  company_name: string;
  total_annual: number;
  dividends: UserDividendData[];
  total_amount: number;
  confirmed_amount: number;
}

export interface DividendConfirmRequest {
  dividend_id: string;
  edited_amount?: number;
}

export interface DividendSyncRequest {
  symbol?: string;
}

// Simplified dividend data for mobile/analytics
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

// ============================================
// DASHBOARD & ANALYTICS TYPES
// ============================================

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

// ============================================
// ANALYTICS & PERFORMANCE TYPES
// ============================================

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
  dividend_summary: DividendSummary;
}

export interface BenchmarkData {
  date: string;
  indexed_performance: number;
}

export interface EnhancedPortfolioPerformance {
  portfolio_performance: Array<{
    date: string;
    total_value: number;
    indexed_performance: number;
  }>;
  benchmark_performance: BenchmarkData[];
  comparison: {
    portfolio_return: number;
    benchmark_return: number;
    outperformance: number;
    portfolio_cagr: number;
    benchmark_cagr: number;
    summary: string;
  };
  period: string;
  benchmark_symbol: string;
  benchmark_name: string;
}

// ============================================
// FINANCIAL STATEMENTS & METRICS
// ============================================

export interface FinancialReport {
  fiscalDateEnding: string;
  totalRevenue?: string;
  grossProfit?: string;
  totalOperatingExpenses?: string;
  operatingIncome?: string;
  netIncome?: string;
  totalAssets?: string;
  totalLiabilities?: string;
  totalShareholderEquity?: string;
  operatingCashflow?: string;
  [key: string]: string | undefined;
}

export interface FinancialStatements {
  symbol: string;
  annual_reports: FinancialReport[];
  quarterly_reports: FinancialReport[];
}

export interface FinancialStatement {
  [key: string]: string | number;
}

export interface FinancialsData {
  annual: FinancialStatement[];
  quarterly: FinancialStatement[];
}

export interface ValuationMetrics {
  market_capitalization?: number;
  pe_ratio?: number;
  pb_ratio?: number;
  peg_ratio?: number;
  ev_to_ebitda?: number;
  dividend_yield?: number;
}

export interface FinancialHealthMetrics {
  current_ratio?: number;
  debt_to_equity_ratio?: number;
  interest_coverage_ratio?: number;
  free_cash_flow_ttm?: number;
}

export interface PerformanceMetrics {
  revenue_growth_yoy?: number;
  revenue_growth_5y_cagr?: number;
  eps_growth_yoy?: number;
  eps_growth_5y_cagr?: number;
  return_on_equity_ttm?: number;
  return_on_assets_ttm?: number;
}

export interface ProfitabilityMetrics {
  gross_margin?: number;
  operating_margin?: number;
  net_profit_margin?: number;
}

export interface DividendMetrics {
  dividend_payout_ratio?: number;
  dividend_growth_rate_3y_cagr?: number;
}

export interface RawDataSummary {
  beta?: number;
  eps_ttm?: number;
  shares_outstanding?: number;
}

export interface AdvancedFinancials {
  valuation: ValuationMetrics;
  financial_health: FinancialHealthMetrics;
  performance: PerformanceMetrics;
  profitability: ProfitabilityMetrics;
  dividends: DividendMetrics;
  raw_data_summary: RawDataSummary;
  source?: string;
  cache_note?: string;
  cache_age_hours?: number;
}

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
  overview?: StockOverview & {
    last_updated?: string;
    cache_metadata?: FinancialDataCache;
  };
  income_statement?: {
    annual: FinancialStatement[];
    quarterly: FinancialStatement[];
    metadata?: FinancialDataCache;
  };
  balance_sheet?: {
    annual: FinancialStatement[];
    quarterly: FinancialStatement[];
    metadata?: FinancialDataCache;
  };
  cash_flow?: {
    annual: FinancialStatement[];
    quarterly: FinancialStatement[];
    metadata?: FinancialDataCache;
  };
}

// ============================================
// PORTFOLIO OPTIMIZATION TYPES
// ============================================

export interface HoldingAnalysis {
  ticker: string;
  weight: number;
  expected_return: number;
  volatility: number;
  beta: number;
  sector: string;
  market_cap: string;
  current_value: number;
}

export interface PortfolioMetrics {
  total_value: number;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  beta: number;
  var_95: number;
  max_drawdown: number;
}

export interface DiversificationAnalysis {
  sector_concentration: Record<string, number>;
  geographic_concentration: Record<string, number>;
  market_cap_concentration: Record<string, number>;
  concentration_risk_score: number;
  number_of_holdings: number;
  herfindahl_index: number;
}

export interface RiskAssessment {
  overall_risk_score: number;
  volatility_risk: number;
  concentration_risk: number;
  correlation_risk: number;
  liquidity_risk: number;
  risk_factors: string[];
  recommendations: string[];
}

export interface RebalancingSuggestion {
  ticker: string;
  current_weight: number;
  suggested_action: 'reduce' | 'increase';
  suggested_weight: number;
  reason: string;
}

export interface NewHoldingSuggestion {
  ticker: string;
  sector: string;
  reason: string;
  suggested_weight: number;
}

export interface OptimizationRecommendations {
  rebalancing_suggestions: RebalancingSuggestion[];
  diversification_suggestions: string[];
  risk_reduction_suggestions: string[];
  potential_new_holdings: NewHoldingSuggestion[];
  target_allocation: Record<string, number>;
}

export interface PortfolioOptimizationAnalysis {
  portfolio_metrics: PortfolioMetrics;
  holdings_analysis: HoldingAnalysis[];
  diversification: DiversificationAnalysis;
  risk_assessment: RiskAssessment;
  optimization_recommendations: OptimizationRecommendations;
  analysis_date: string;
  total_holdings: number;
}

// ============================================
// STOCK RESEARCH TYPES
// ============================================

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

export interface PriceDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DividendHistory {
  date: string;
  amount: number;
}

export interface DividendResearchData {
  yield: string;
  payout_ratio: string;
  ex_dividend_date: string;
  dividend_date: string;
  history: DividendHistory[];
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

export interface StockResearchData {
  overview?: StockOverview;
  quote?: StockQuote;
  priceData?: PriceDataPoint[];
  financials?: {
    income?: FinancialsData;
    balance?: FinancialsData;
    cashflow?: FinancialsData;
  };
  dividends?: DividendResearchData;
  news?: NewsArticle[];
  notes?: StockNote[];
  isInWatchlist?: boolean;
}

// ============================================
// WATCHLIST TYPES
// ============================================

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
  added_date?: string;
  name?: string;
}

export interface WatchlistGroup {
  id: string;
  name: string;
  items: WatchlistItem[];
}

// ============================================
// PRICE ALERT TYPES
// ============================================

export interface PriceAlert {
  id: number;
  ticker: string;
  alert_type: 'above' | 'below';
  target_price: number;
  is_active: boolean;
  created_at: string;
  triggered_at?: string;
}

export interface AlertStatistics {
  total_alerts: number;
  active_alerts: number;
  triggered_alerts: number;
  recent_activity: {
    triggered_last_24h: number;
    created_last_24h: number;
  };
  top_tickers: Array<{
    ticker: string;
    alert_count: number;
  }>;
}

// ============================================
// MARKET DATA & NEWS TYPES
// ============================================

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface NewsResponse {
  success: boolean;
  data?: {
    articles: NewsItem[];
  };
  error?: string;
}

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

// ============================================
// CACHE & METADATA TYPES
// ============================================

export interface CacheStatistics {
  daily_prices: {
    total_records: number;
    unique_symbols: number;
    latest_date: string;
    oldest_date: string;
  };
  fundamentals: {
    total_records: number;
    unique_symbols: number;
    latest_update: string;
    oldest_update: string;
  };
}

// ============================================
// ERROR & VALIDATION TYPES
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormErrors {
  [key: string]: string;
}

// ============================================
// CHART & VISUALIZATION TYPES
// ============================================

export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

export interface PieChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}

export interface RiskGaugeData {
  value: number;
  max: number;
  title: string;
  color: string;
}

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

// ============================================
// COMPONENT PROPS & UI TYPES
// ============================================

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

// ============================================
// DEPRECATED - TO BE REMOVED
// ============================================

/**
 * @deprecated Use APIResponse<T> instead
 */
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
}

/**
 * @deprecated Use StockPricesResponse instead
 */
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

// ============================================
// TYPE GUARDS & UTILITIES
// ============================================

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse(response: APIResponse<any> | ErrorResponse): response is ErrorResponse {
  return response.success === false && 'details' in response;
}

/**
 * Type guard to check if a response is a success response
 */
export function isSuccessResponse<T>(response: APIResponse<T> | ErrorResponse): response is APIResponse<T> {
  return response.success === true;
}

/**
 * Utility to extract data from APIResponse safely
 */
export function extractResponseData<T>(response: APIResponse<T>): T | null {
  return response.success && response.data ? response.data : null;
}

// ============================================
// TYPE ALIASES FOR BACKWARD COMPATIBILITY
// ============================================

// Define missing types that are expected by front_api_client
export interface TransactionData {
  id?: string;
  user_id?: string;
  symbol: string;
  transaction_type: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  commission?: number;
  currency?: string;
  exchange_rate?: number;
  date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfileData {
  id?: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  country?: string;
  base_currency?: string;
  created_at?: string;
  updated_at?: string;
}

export type SymbolSearchResult = StockSearchResult;
export type Transaction = TransactionData;
export type UserProfile = UserProfileData;
export type DividendRecord = UserDividendData;
export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  exchange_rate: number;
  last_refreshed: string;
  bid_price?: number;
  ask_price?: number;
}