/**
 * Frontend API Types
 * Re-exports from shared/types for consistency
 * 
 * DEPRECATED: This file is maintained for backward compatibility.
 * Please import directly from 'shared/types' in new code.
 */

export * from '../../../shared/types/api-contracts';

// Re-export specific dividend types for convenience
export type {
  BaseDividendData,
  UserDividendData,
  DividendSummary,
  DividendConfirmRequest,
  DividendSyncRequest,
  DividendTableRow
} from './dividend';

// Import helper functions from dividend types
export {
  dividendToTableRow,
  formatDividendCurrency,
  formatDividendDate,
  validateDividendData,
  calculateTotalDividendAmount,
  isDividendConfirmable,
  getCompanyDisplayName
} from './dividend';