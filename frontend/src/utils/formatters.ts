/**
 * CENTRALIZED FORMATTING UTILITIES
 * 
 * Consolidates all duplicate formatting functions from across the codebase.
 * Following CLAUDE.md protocol: DRY principle - single source of truth for formatting.
 */

/**
 * Format currency values with proper symbol and precision
 * Replaces all duplicate formatCurrency functions across components
 */
export function formatCurrency(
  value: number | null | undefined, 
  options: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  // Handle null/undefined/NaN values safely
  const safeValue = (value === null || value === undefined || isNaN(Number(value))) ? 0 : Number(value);
  
  const {
    currency = 'USD',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = options;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeValue);
}

/**
 * Format percentage values with proper precision
 * Replaces all duplicate percentage formatting functions
 */
export function formatPercentage(
  value: number | null | undefined,
  decimalPlaces: number = 2
): string {
  const safeValue = (value === null || value === undefined || isNaN(Number(value))) ? 0 : Number(value);
  
  if (!Number.isFinite(safeValue)) {
    return '0.00%';
  }

  return `${safeValue.toFixed(decimalPlaces)}%`;
}

/**
 * Format numbers with thousands separators
 * General number formatting for non-currency values
 */
export function formatNumber(
  value: number | null | undefined,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const safeValue = (value === null || value === undefined || isNaN(Number(value))) ? 0 : Number(value);
  
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = options;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeValue);
}

/**
 * Format date for consistent display across components
 * Replaces duplicate date formatting functions
 */
export function formatDate(
  dateString: string | Date,
  options: {
    year?: 'numeric' | '2-digit';
    month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
    day?: 'numeric' | '2-digit';
  } = {}
): string {
  const {
    year = 'numeric',
    month = 'short',
    day = 'numeric'
  } = options;

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return date.toLocaleDateString('en-US', {
    year,
    month,
    day
  });
}

/**
 * Format large numbers with K/M/B suffixes
 * Useful for compact display of large values
 */
export function formatCompactNumber(value: number | null | undefined): string {
  const safeValue = (value === null || value === undefined || isNaN(Number(value))) ? 0 : Number(value);
  
  if (Math.abs(safeValue) >= 1e9) {
    return `${(safeValue / 1e9).toFixed(1)}B`;
  }
  if (Math.abs(safeValue) >= 1e6) {
    return `${(safeValue / 1e6).toFixed(1)}M`;
  }
  if (Math.abs(safeValue) >= 1e3) {
    return `${(safeValue / 1e3).toFixed(1)}K`;
  }
  return safeValue.toFixed(0);
}

/**
 * Format shares with appropriate decimal places
 * Specifically for share quantities in holdings
 */
export function formatShares(shares: number | null | undefined): string {
  const safeShares = (shares === null || shares === undefined || isNaN(Number(shares))) ? 0 : Number(shares);
  
  // Show more precision for fractional shares, less for whole shares
  if (safeShares % 1 === 0) {
    return safeShares.toFixed(0);
  } else {
    return safeShares.toFixed(2);
  }
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use formatCurrency instead
 */
export const formatCurrencyValue = formatCurrency;

/**
 * Legacy alias for backward compatibility
 * @deprecated Use formatPercentage instead
 */
export const formatPercentageValue = formatPercentage;

/**
 * Legacy dividend-specific aliases for backward compatibility
 * @deprecated Use the general formatters instead
 */
export const formatDividendCurrency = formatCurrency;
export const formatDividendDate = formatDate;