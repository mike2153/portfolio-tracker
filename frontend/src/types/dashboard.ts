/**
 * 🛡️ BULLETPROOF DASHBOARD TYPE DEFINITIONS
 * 
 * Centralized, strict types for all dashboard components.
 * ZERO implicit types allowed - everything must be explicitly typed.
 */

import { APIResponse as _APIResponse, KPIValue } from '../../../shared/types/api-contracts';

// ============================================
// CORE DASHBOARD TYPES
// ============================================

/**
 * API response type for dashboard data
 * Replaces implicit typing in dashboard queries
 */
export interface DashboardAPIResponse {
  success: boolean;
  portfolio: {
    total_value: number;
    total_cost: number;
    total_gain_loss: number;
    total_gain_loss_percent: number;
    cash_balance: number;
  };
  error?: string;
  message?: string;
  metadata: {
    timestamp: string;
    version: string;
    [key: string]: unknown;
  };
}

/**
 * Analytics API response type
 * Replaces implicit typing in analytics queries  
 */
export interface AnalyticsAPIResponse {
  success: boolean;
  data: {
    irr_percent: number;
    passive_income_ytd: number;
    dividend_summary: {
      confirmed_count: number;
      total_received: number;
      ytd_received: number;
    };
  };
  error?: string;
  message?: string;
  metadata: {
    timestamp: string;
    version: string;
    [key: string]: unknown;
  };
}

/**
 * Performance data point with strict typing
 * Supports both new and legacy formats
 */
export interface PerformanceDataPoint {
  date: string;
  value?: number;          // New backend format
  total_value?: number;    // Legacy format for backward compatibility
  indexed_performance?: number;
}

/**
 * Complete performance data structure
 */
export interface PerformanceData {
  portfolioPerformance: PerformanceDataPoint[];
  benchmarkPerformance: PerformanceDataPoint[];
  comparison?: {
    portfolio_return: number;
    benchmark_return: number;
    outperformance: number;
  };
}

/**
 * Dashboard context state type
 * Replaces all implied types in DashboardContext
 */
export interface DashboardContextState {
  // Selected values
  selectedPeriod: string;
  selectedBenchmark: string;
  
  // Performance data
  performanceData: PerformanceData | null;
  
  // Calculated values for KPIs (always numbers, never undefined)
  portfolioDollarGain: number;
  portfolioPercentGain: number;
  benchmarkDollarGain: number;
  benchmarkPercentGain: number;
  
  // Loading state
  isLoadingPerformance: boolean;
  
  // User ID (can be null during initialization)
  userId: string | null;
}

/**
 * Dashboard context actions
 */
export interface DashboardContextActions {
  setSelectedPeriod: (period: string) => void;
  setSelectedBenchmark: (benchmark: string) => void;
  setPerformanceData: (data: PerformanceData | null) => void;
  setIsLoadingPerformance: (loading: boolean) => void;
}

/**
 * Complete dashboard context type
 */
export type DashboardContextType = DashboardContextState & DashboardContextActions;

// ============================================
// KPI COMPONENT TYPES
// ============================================

/**
 * Enhanced KPI value with additional metadata
 * Extends the base KPIValue with component-specific needs
 */
export interface EnhancedKPIValue extends KPIValue {
  percentGain?: number;     // Additional percentage for display
  formatted_value?: string; // Pre-formatted string representation
  trend_direction?: 'up' | 'down' | 'neutral';
  confidence_level?: 'high' | 'medium' | 'low';
}

/**
 * KPI Card component props with strict typing
 * Replaces all undefined props in KPICard
 */
export interface KPICardProps {
  title: string;
  data: EnhancedKPIValue;
  prefix?: string;
  suffix?: string;
  showPercentage?: boolean;
  percentValue?: number;
  showValueAsPercent?: boolean;
  loading?: boolean;
  error?: string | null;
}

/**
 * KPI Grid component props
 * Ensures type safety for initial data
 */
export interface KPIGridProps {
  initialData?: DashboardAPIResponse;
  loading?: boolean;
  error?: string | null;
}

/**
 * Transformed KPI data structure
 * Used internally by KPIGrid to structure API data
 */
export interface TransformedKPIData {
  marketValue: EnhancedKPIValue;
  capitalGains: EnhancedKPIValue;
  irr: EnhancedKPIValue;
  passiveIncome: EnhancedKPIValue;
  totalReturn?: EnhancedKPIValue;
}

// ============================================
// QUERY & API TYPES
// ============================================

/**
 * React Query error type for dashboard queries
 * Replaces generic Error with specific error structure
 */
export class DashboardQueryError extends Error {
  code?: string | undefined;
  details?: Record<string, unknown> | undefined;
  timestamp: string;

  constructor(errorData: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
    timestamp: string;
  }) {
    super(errorData.message);
    this.name = 'DashboardQueryError';
    this.code = errorData.code;
    this.details = errorData.details;
    this.timestamp = errorData.timestamp;
  }
}

/**
 * React Query options for dashboard data
 * Ensures consistent query configuration
 */
export interface DashboardQueryOptions {
  enabled: boolean;
  staleTime: number;
  refetchOnWindowFocus: boolean;
  retry: number;
  retryDelay: (attemptIndex: number) => number;
}

/**
 * Query key factory for consistent caching
 */
export const DashboardQueryKeys = {
  dashboard: ['dashboard'] as const,
  analytics: ['analytics-summary'] as const,
  performance: (period: string, benchmark: string) => 
    ['performance', period, benchmark] as const,
} as const;

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Type guard to check if response is DashboardAPIResponse
 */
export function isDashboardAPIResponse(
  response: unknown
): response is DashboardAPIResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    typeof (response as DashboardAPIResponse).success === 'boolean' &&
    typeof (response as DashboardAPIResponse).portfolio === 'object'
  );
}

/**
 * Type guard to check if response is AnalyticsAPIResponse
 */
export function isAnalyticsAPIResponse(
  response: unknown
): response is AnalyticsAPIResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    typeof (response as AnalyticsAPIResponse).success === 'boolean' &&
    typeof (response as AnalyticsAPIResponse).data === 'object'
  );
}

/**
 * Helper to safely extract value from performance data point
 */
export function getPerformanceValue(dataPoint: PerformanceDataPoint): number {
  return dataPoint.value ?? dataPoint.total_value ?? 0;
}

// Import centralized formatters to avoid duplication
import { formatCurrency, formatPercentage } from '../../../shared/utils/formatters';

/**
 * Legacy aliases for backward compatibility - redirect to centralized formatters
 * @deprecated Use formatters from utils/formatters.ts directly
 */
export const formatCurrencyValue = formatCurrency;
export const formatPercentageValue = formatPercentage;

// ============================================
// FEATURE FLAG INTEGRATION
// ============================================

/**
 * Dashboard feature flags
 * Integrates with the bulletproof feature flag system
 */
export interface DashboardFeatureFlags {
  enhancedKPIs: boolean;
  realTimeUpdates: boolean;
  performanceComparison: boolean;
  advancedCharts: boolean;
}

/**
 * Dashboard component wrapped with feature flags
 */
export interface FeatureFlaggedDashboardProps {
  flags: DashboardFeatureFlags;
  fallbackComponent?: React.ComponentType;
}

// ============================================
// ERROR HANDLING TYPES
// ============================================

/**
 * Dashboard-specific error boundary state
 */
export interface DashboardErrorState {
  hasError: boolean;
  error?: Error;
  errorInfo?: {
    componentStack: string;
  };
  lastKnownGoodData?: TransformedKPIData;
}

/**
 * Error recovery actions
 */
export interface DashboardErrorActions {
  retry: () => void;
  reset: () => void;
  reportError: (error: Error, errorInfo: unknown) => void;
}

/**
 * Complete error boundary context
 */
export type DashboardErrorBoundaryContext = DashboardErrorState & DashboardErrorActions;