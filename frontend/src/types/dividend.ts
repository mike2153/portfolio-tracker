// Unified Dividend Data Model - Frontend TypeScript Types
// This mirrors the Python types for consistent data contracts

export type DividendType = 'cash' | 'stock' | 'drp';
export type DividendSource = 'alpha_vantage' | 'manual' | 'broker';
export type DividendStatus = 'pending' | 'confirmed' | 'edited';

/**
 * Base dividend data - represents raw dividend information from external APIs
 */
export interface BaseDividendData {
  symbol: string;
  ex_date: string; // ISO date string
  pay_date: string; // ISO date string
  amount_per_share: number;
  currency: string;
  dividend_type: DividendType;
  source: DividendSource;
  declaration_date?: string;
  record_date?: string;
}

/**
 * Complete user dividend record - what the frontend receives from the API
 * Contains all necessary information for display and actions
 */
export interface UserDividendData extends BaseDividendData {
  id: string;
  user_id?: string; // null for global dividends
  
  // User-specific ownership information (ALWAYS present in API responses)
  shares_held_at_ex_date: number;
  current_holdings: number;
  total_amount: number; // CALCULATED: amount_per_share * shares_held_at_ex_date
  
  // Confirmation status (based on transaction existence, not just a flag)
  confirmed: boolean;
  status: DividendStatus;
  
  // Display information
  company: string; // Human-readable company name
  notes?: string;
  
  // Computed convenience fields
  is_future: boolean;
  is_recent: boolean;
  
  // Metadata
  created_at: string; // ISO datetime string
  updated_at?: string;
}

/**
 * Dividend summary statistics for analytics dashboard
 */
export interface DividendSummary {
  total_received: number;
  total_pending: number;
  ytd_received: number;
  confirmed_count: number;
  pending_count: number;
}

/**
 * Request types for API calls
 */
export interface DividendConfirmRequest {
  dividend_id: string;
  edited_amount?: number; // Optional override for total amount
}

export interface DividendSyncRequest {
  symbol?: string; // If provided, sync only this symbol
}

/**
 * API Response wrappers
 */
export interface DividendResponse {
  success: boolean;
  data?: UserDividendData;
  error?: string;
  message?: string;
}

export interface DividendListResponse {
  success: boolean;
  data: UserDividendData[];
  metadata: {
    timestamp: string;
    user_id: string;
    confirmed_only: boolean;
    total_dividends: number;
    [key: string]: any;
  };
  total_count: number;
  error?: string;
}

export interface DividendSummaryResponse {
  success: boolean;
  data: {
    dividend_summary: DividendSummary;
    [key: string]: any;
  };
  error?: string;
}

/**
 * Utility types for frontend components
 */
export interface DividendTableRow {
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
  const safeNumber = (value: any): number => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return 0;
    }
    return Number(value);
  };

  // DEBUG: Log the input dividend
  console.log('[dividendToTableRow] Input dividend:', {
    id: dividend.id,
    id_type: typeof dividend.id,
    symbol: dividend.symbol,
    total_amount: dividend.total_amount
  });

  const tableRow = {
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

  // DEBUG: Log the output table row
  console.log('[dividendToTableRow] Output tableRow:', {
    id: tableRow.id,
    id_type: typeof tableRow.id,
    symbol: tableRow.symbol,
    total_amount: tableRow.total_amount
  });

  return tableRow;
}

/**
 * Format currency with proper symbol and precision
 */
export function formatDividendCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  // Handle null/undefined/NaN values safely
  const safeAmount = (amount === null || amount === undefined || isNaN(Number(amount))) ? 0 : Number(amount);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(safeAmount);
}

/**
 * Format date for dividend display
 */
export function formatDividendDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

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