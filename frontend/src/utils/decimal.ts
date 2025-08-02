/**
 * Decimal utility functions for handling precise financial data
 * Backend sends financial values as strings to preserve precision
 */

/**
 * Parse a string decimal value to a number for display/calculation
 * @param value String decimal value from backend
 * @returns Parsed number value
 */
export const parseDecimal = (value: string | number): number => {
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
};

/**
 * Format a string decimal value as currency
 * @param value String decimal value from backend
 * @param currency Currency code (default: USD)
 * @returns Formatted currency string
 */
export const formatCurrency = (value: string | number, currency: string = 'USD'): string => {
  const numValue = parseDecimal(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numValue);
};

/**
 * Format a string decimal value as a percentage
 * @param value String decimal value from backend (already in percentage format)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: string | number): string => {
  const numValue = parseDecimal(value);
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numValue / 100);
};

/**
 * Format a string decimal value as a number with commas
 * @param value String decimal value from backend
 * @param decimals Number of decimal places to show
 * @returns Formatted number string
 */
export const formatNumber = (value: string | number, decimals: number = 2): string => {
  const numValue = parseDecimal(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(numValue);
};

/**
 * Safe addition of string decimal values
 * @param a First value
 * @param b Second value
 * @returns Sum as number
 */
export const addDecimals = (a: string | number, b: string | number): number => {
  return parseDecimal(a) + parseDecimal(b);
};

/**
 * Safe subtraction of string decimal values
 * @param a First value
 * @param b Second value to subtract
 * @returns Difference as number
 */
export const subtractDecimals = (a: string | number, b: string | number): number => {
  return parseDecimal(a) - parseDecimal(b);
};

/**
 * Safe multiplication of string decimal values
 * @param a First value
 * @param b Second value
 * @returns Product as number
 */
export const multiplyDecimals = (a: string | number, b: string | number): number => {
  return parseDecimal(a) * parseDecimal(b);
};

/**
 * Safe division of string decimal values
 * @param a Dividend
 * @param b Divisor
 * @returns Quotient as number, or 0 if divisor is 0
 */
export const divideDecimals = (a: string | number, b: string | number): number => {
  const divisor = parseDecimal(b);
  if (divisor === 0) return 0;
  return parseDecimal(a) / divisor;
};