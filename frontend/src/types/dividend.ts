// Unified Dividend Data Model - Frontend TypeScript Types
// Import base types from shared API contracts
import type {
  DividendType,
  DividendSource,
  DividendStatus,
  BaseDividendData,
  UserDividendData,
  DividendSummary,
  DividendConfirmRequest,
  DividendSyncRequest,
  APIResponse
} from '../../../shared/types/api-contracts';

// Re-export imported types for backward compatibility
export type {
  DividendType,
  DividendSource,
  DividendStatus,
  BaseDividendData,
  UserDividendData,
  DividendSummary,
  DividendConfirmRequest,
  DividendSyncRequest
};

// Legacy type aliases for backward compatibility
// These types are maintained to prevent breaking changes in existing code
// New code should use APIResponse<T> directly from api-contracts

export type DividendResponse = APIResponse<UserDividendData>;
export type DividendListResponse = APIResponse<UserDividendData[]>;
export type DividendSummaryResponse = APIResponse<{ dividend_summary: DividendSummary }>;

/**
 * Utility types for frontend components
 */
export interface DividendTableRow extends Record<string, unknown> {
  id: string;
  symbol: string;
  company: string;
  ex_date: string;
  pay_date: string;
  amount_per_share: number;
  total_amount: number;
  current_holdings: number;
  shares_held_at_ex_date: number;
  confirmed: string; // 'Yes' | 'No' for display
  currency: string;
  created_at: string;
  is_future: boolean;
  is_recent: boolean;
}

/**
 * Form validation types
 */
export interface DividendFormErrors {
  [field: string]: string;
}

/**
 * Utility functions for type conversions and calculations
 */

/**
 * Convert UserDividendData to DividendTableRow for ApexListView
 */
export function dividendToTableRow(dividend: UserDividendData): DividendTableRow {
  // Robust null/undefined handling for numeric fields
  const safeNumber = (value: number | null | undefined): number => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return 0;
    }
    return Number(value);
  };

  const tableRow: DividendTableRow = {
    id: dividend.id || '',
    symbol: dividend.symbol || '',
    company: dividend.company || getCompanyDisplayName(dividend.symbol || ''),
    ex_date: dividend.ex_date || '',
    pay_date: dividend.pay_date || '',
    amount_per_share: safeNumber(dividend.amount_per_share),
    total_amount: safeNumber(dividend.total_amount),
    current_holdings: safeNumber(dividend.current_holdings),
    shares_held_at_ex_date: safeNumber(dividend.shares_held_at_ex_date),
    confirmed: dividend.confirmed ? 'Yes' : 'No',
    currency: dividend.currency || 'USD',
    created_at: dividend.created_at || '',
    is_future: dividend.is_future || false,
    is_recent: dividend.is_recent || false
  };

  return tableRow;
}

// Import centralized formatters to avoid duplication
import { formatCurrency, formatDate } from '../utils/formatters';

/**
 * Legacy aliases for backward compatibility - redirect to centralized formatters
 * @deprecated Use formatters from utils/formatters.ts directly
 */
export const formatDividendCurrency = (amount: number | null | undefined, currency: string = 'USD') => 
  formatCurrency(amount, { currency, maximumFractionDigits: 4 });

export const formatDividendDate = (dateString: string) => formatDate(dateString);

/**
 * Validate dividend data before sending to API
 */
export function validateDividendData(data: Partial<UserDividendData>): DividendFormErrors {
  const errors: DividendFormErrors = {};
  
  if (!data.symbol || data.symbol.length === 0) {
    errors.symbol = 'Symbol is required';
  }
  
  if (!data.ex_date) {
    errors.ex_date = 'Ex-date is required';
  }
  
  if (!data.pay_date) {
    errors.pay_date = 'Pay date is required';
  }
  
  if (!data.amount_per_share || data.amount_per_share <= 0) {
    errors.amount_per_share = 'Amount per share must be positive';
  }
  
  if (!data.shares_held_at_ex_date || data.shares_held_at_ex_date <= 0) {
    errors.shares_held_at_ex_date = 'Shares held must be positive';
  }
  
  return errors;
}

/**
 * Calculate total amount from per-share amount and shares
 */
export function calculateTotalDividendAmount(
  amountPerShare: number, 
  sharesHeld: number
): number {
  return amountPerShare * sharesHeld;
}

/**
 * Check if dividend is eligible for confirmation
 * (user held shares at ex-date and not already confirmed)
 */
export function isDividendConfirmable(dividend: UserDividendData): boolean {
  return !dividend.confirmed && dividend.shares_held_at_ex_date > 0;
}

/**
 * Get company name with fallback
 */
export function getCompanyDisplayName(symbol: string, company?: string): string {
  if (company && company.trim().length > 0) {
    return company;
  }
  
  // Fallback to symbol with "Corporation" suffix
  return `${symbol} Corporation`;
}