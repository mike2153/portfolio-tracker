// User and Auth types
export interface User {
  id: string
  email?: string
  user_metadata?: any
  app_metadata?: any
  aud: string
  created_at?: string
}

// Financial data types
export interface FinancialReport {
  fiscalDateEnding: string
  totalRevenue?: string
  grossProfit?: string
  totalOperatingExpenses?: string
  operatingIncome?: string
  netIncome?: string
  totalAssets?: string
  totalLiabilities?: string
  totalShareholderEquity?: string
  operatingCashflow?: string
  [key: string]: string | undefined
}

export interface FinancialStatements {
  symbol: string
  annual_reports: FinancialReport[]
  quarterly_reports: FinancialReport[]
}

// Holdings and Portfolio types
export interface HoldingData {
  id: number
  ticker: string
  company_name: string
  shares: number
  purchase_price: number
  current_price?: number
  total_value?: number
  gain_loss?: number
  gain_loss_percent?: number
  purchase_date: string
  commission: number
}

// Benchmark data
export interface BenchmarkData {
  date: string
  indexed_performance: number
}

// Stock data types
export interface StockData {
  symbol: string
  company: string
  price: number
  change: number
  change_percent: number
  volume: number
}

// Dividend grouped by stock
export interface DividendByStock {
  ticker: string
  company_name: string
  total_annual: number
  dividends: any[]
  total_amount: number
  confirmed_amount: number
}

// ============================================
// NEW TYPES FOR ENHANCED FEATURES
// ============================================

// Advanced Financial Metrics Types
export interface ValuationMetrics {
  market_capitalization?: number
  pe_ratio?: number
  pb_ratio?: number
  peg_ratio?: number
  ev_to_ebitda?: number
  dividend_yield?: number
}

export interface FinancialHealthMetrics {
  current_ratio?: number
  debt_to_equity_ratio?: number
  interest_coverage_ratio?: number
  free_cash_flow_ttm?: number
}

export interface PerformanceMetrics {
  revenue_growth_yoy?: number
  revenue_growth_5y_cagr?: number
  eps_growth_yoy?: number
  eps_growth_5y_cagr?: number
  return_on_equity_ttm?: number
  return_on_assets_ttm?: number
}

export interface ProfitabilityMetrics {
  gross_margin?: number
  operating_margin?: number
  net_profit_margin?: number
}

export interface DividendMetrics {
  dividend_payout_ratio?: number
  dividend_growth_rate_3y_cagr?: number
}

export interface RawDataSummary {
  beta?: number
  eps_ttm?: number
  shares_outstanding?: number
}

export interface AdvancedFinancials {
  valuation: ValuationMetrics
  financial_health: FinancialHealthMetrics
  performance: PerformanceMetrics
  profitability: ProfitabilityMetrics
  dividends: DividendMetrics
  raw_data_summary: RawDataSummary
  source?: string
  cache_note?: string
  cache_age_hours?: number
}

// Portfolio Optimization Types
export interface HoldingAnalysis {
  ticker: string
  weight: number
  expected_return: number
  volatility: number
  beta: number
  sector: string
  market_cap: string
  current_value: number
}

export interface PortfolioMetrics {
  total_value: number
  expected_return: number
  volatility: number
  sharpe_ratio: number
  beta: number
  var_95: number
  max_drawdown: number
}

export interface DiversificationAnalysis {
  sector_concentration: Record<string, number>
  geographic_concentration: Record<string, number>
  market_cap_concentration: Record<string, number>
  concentration_risk_score: number
  number_of_holdings: number
  herfindahl_index: number
}

export interface RiskAssessment {
  overall_risk_score: number
  volatility_risk: number
  concentration_risk: number
  correlation_risk: number
  liquidity_risk: number
  risk_factors: string[]
  recommendations: string[]
}

export interface OptimizationRecommendations {
  rebalancing_suggestions: RebalancingSuggestion[]
  diversification_suggestions: string[]
  risk_reduction_suggestions: string[]
  potential_new_holdings: NewHoldingSuggestion[]
  target_allocation: Record<string, number>
}

export interface RebalancingSuggestion {
  ticker: string
  current_weight: number
  suggested_action: 'reduce' | 'increase'
  suggested_weight: number
  reason: string
}

export interface NewHoldingSuggestion {
  ticker: string
  sector: string
  reason: string
  suggested_weight: number
}

export interface PortfolioOptimizationAnalysis {
  portfolio_metrics: PortfolioMetrics
  holdings_analysis: HoldingAnalysis[]
  diversification: DiversificationAnalysis
  risk_assessment: RiskAssessment
  optimization_recommendations: OptimizationRecommendations
  analysis_date: string
  total_holdings: number
}

// Price Alert Types
export interface PriceAlert {
  id: number
  ticker: string
  alert_type: 'above' | 'below'
  target_price: number
  is_active: boolean
  created_at: string
  triggered_at?: string
}

export interface AlertStatistics {
  total_alerts: number
  active_alerts: number
  triggered_alerts: number
  recent_activity: {
    triggered_last_24h: number
    created_last_24h: number
  }
  top_tickers: Array<{
    ticker: string
    alert_count: number
  }>
}

// Market Data Cache Types
export interface CacheStatistics {
  daily_prices: {
    total_records: number
    unique_symbols: number
    latest_date: string
    oldest_date: string
  }
  fundamentals: {
    total_records: number
    unique_symbols: number
    latest_update: string
    oldest_update: string
  }
}

// Enhanced Portfolio Performance Types
export interface EnhancedPortfolioPerformance {
  portfolio_performance: Array<{
    date: string
    total_value: number
    indexed_performance: number
  }>
  benchmark_performance: Array<{
    date: string
    indexed_performance: number
  }>
  comparison: {
    portfolio_return: number
    benchmark_return: number
    outperformance: number
    portfolio_cagr: number
    benchmark_cagr: number
    summary: string
  }
  period: string
  benchmark_symbol: string
  benchmark_name: string
}

// Chart Data Types
export interface ChartDataPoint {
  x: string | number
  y: number
  label?: string
}

export interface PieChartData {
  labels: string[]
  values: number[]
  colors?: string[]
}

export interface RiskGaugeData {
  value: number
  max: number
  title: string
  color: string
}

// Global window interface extension
declare global {
  interface Window {
    searchTimeout?: NodeJS.Timeout
  }
} 