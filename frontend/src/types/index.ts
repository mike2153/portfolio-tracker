/**
 * Frontend Types Index
 * Re-exports types from shared/types for consistency
 * Also includes frontend-specific types
 */

// Import all shared types
import type {
  User,
  FinancialReport,
  FinancialStatements,
  HoldingData,
  BenchmarkData,
  DividendByStock,
  ValuationMetrics,
  FinancialHealthMetrics,
  PerformanceMetrics,
  ProfitabilityMetrics,
  DividendMetrics,
  RawDataSummary,
  AdvancedFinancials,
  HoldingAnalysis,
  PortfolioMetrics,
  DiversificationAnalysis,
  RiskAssessment,
  OptimizationRecommendations,
  RebalancingSuggestion,
  NewHoldingSuggestion,
  PortfolioOptimizationAnalysis,
  PriceAlert,
  AlertStatistics,
  CacheStatistics,
  EnhancedPortfolioPerformance,
  ChartDataPoint,
  PieChartData,
  RiskGaugeData
} from '../../../shared/types/api-contracts';

// Re-export shared types
export type {
  User,
  FinancialReport,
  FinancialStatements,
  HoldingData,
  BenchmarkData,
  DividendByStock,
  ValuationMetrics,
  FinancialHealthMetrics,
  PerformanceMetrics,
  ProfitabilityMetrics,
  DividendMetrics,
  RawDataSummary,
  AdvancedFinancials,
  HoldingAnalysis,
  PortfolioMetrics,
  DiversificationAnalysis,
  RiskAssessment,
  OptimizationRecommendations,
  RebalancingSuggestion,
  NewHoldingSuggestion,
  PortfolioOptimizationAnalysis,
  PriceAlert,
  AlertStatistics,
  CacheStatistics,
  EnhancedPortfolioPerformance,
  ChartDataPoint,
  PieChartData,
  RiskGaugeData
};

// Frontend-specific types that don't belong in shared

/**
 * Simple stock data for display
 */
export interface StockData {
  symbol: string;
  company: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
}

// Global window interface extension
declare global {
  interface Window {
    searchTimeout?: NodeJS.Timeout;
  }
}