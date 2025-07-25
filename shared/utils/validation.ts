// =================
// VALIDATION UTILITIES
// =================

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate stock ticker symbol
 * @param ticker - Ticker to validate
 * @returns true if valid ticker format
 */
export function isValidTicker(ticker: string): boolean {
  const tickerRegex = /^[A-Z]{1,5}$/;
  return tickerRegex.test(ticker.toUpperCase());
}

/**
 * Validate positive number
 * @param value - Value to validate
 * @returns true if positive number
 */
export function isPositiveNumber(value: string | number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
}

/**
 * Validate non-negative number
 * @param value - Value to validate
 * @returns true if non-negative number
 */
export function isNonNegativeNumber(value: string | number): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num >= 0;
}

/**
 * Validate date string (YYYY-MM-DD format)
 * @param dateString - Date string to validate
 * @returns true if valid date format
 */
export function isValidDate(dateString: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validate that date is not in the future
 * @param dateString - Date string to validate
 * @returns true if date is today or in the past
 */
export function isNotFutureDate(dateString: string): boolean {
  if (!isValidDate(dateString)) {
    return false;
  }
  
  const inputDate = new Date(dateString);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  return inputDate <= today;
}

/**
 * Validate currency code
 * @param currency - Currency code to validate
 * @returns true if valid 3-letter currency code
 */
export function isValidCurrency(currency: string): boolean {
  const currencyRegex = /^[A-Z]{3}$/;
  return currencyRegex.test(currency);
}

/**
 * Validate exchange rate
 * @param rate - Exchange rate to validate
 * @returns true if valid positive exchange rate
 */
export function isValidExchangeRate(rate: string | number): boolean {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  return !isNaN(num) && num > 0 && num < 1000; // Reasonable range for FX rates
}

/**
 * Validate percentage value
 * @param percentage - Percentage to validate
 * @param min - Minimum allowed value (default: -100)
 * @param max - Maximum allowed value (default: 1000)
 * @returns true if valid percentage
 */
export function isValidPercentage(
  percentage: string | number, 
  min: number = -100, 
  max: number = 1000
): boolean {
  const num = typeof percentage === 'string' ? parseFloat(percentage) : percentage;
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate shares quantity
 * @param shares - Number of shares to validate
 * @returns true if valid positive number with max 6 decimal places
 */
export function isValidShares(shares: string | number): boolean {
  const str = typeof shares === 'number' ? shares.toString() : shares;
  const num = parseFloat(str);
  
  if (isNaN(num) || num <= 0) {
    return false;
  }
  
  // Check for reasonable decimal places (max 6)
  const decimalPlaces = (str.split('.')[1] || '').length;
  return decimalPlaces <= 6;
}

/**
 * Validate price value
 * @param price - Price to validate
 * @returns true if valid positive price with max 4 decimal places
 */
export function isValidPrice(price: string | number): boolean {
  const str = typeof price === 'number' ? price.toString() : price;
  const num = parseFloat(str);
  
  if (isNaN(num) || num <= 0) {
    return false;
  }
  
  // Check for reasonable decimal places (max 4)
  const decimalPlaces = (str.split('.')[1] || '').length;
  return decimalPlaces <= 4 && num < 1000000; // Max price $1M
}

/**
 * Validate commission value
 * @param commission - Commission to validate
 * @returns true if valid non-negative commission
 */
export function isValidCommission(commission: string | number): boolean {
  const num = typeof commission === 'string' ? parseFloat(commission) : commission;
  return !isNaN(num) && num >= 0 && num < 10000; // Max $10k commission
}

// =================
// FORM VALIDATION
// =================

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate add holding form data
 * @param data - Form data to validate
 * @returns Validation result with errors
 */
export function validateAddHoldingForm(data: {
  ticker: string;
  shares: string;
  purchase_price: string;
  purchase_date: string;
  commission: string;
  currency: string;
  fx_rate: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  
  // Ticker validation
  if (!data.ticker.trim()) {
    errors.ticker = 'Ticker symbol is required';
  } else if (!isValidTicker(data.ticker)) {
    errors.ticker = 'Invalid ticker symbol format';
  }
  
  // Shares validation
  if (!data.shares.trim()) {
    errors.shares = 'Number of shares is required';
  } else if (!isValidShares(data.shares)) {
    errors.shares = 'Invalid number of shares';
  }
  
  // Purchase price validation
  if (!data.purchase_price.trim()) {
    errors.purchase_price = 'Purchase price is required';
  } else if (!isValidPrice(data.purchase_price)) {
    errors.purchase_price = 'Invalid purchase price';
  }
  
  // Purchase date validation
  if (!data.purchase_date.trim()) {
    errors.purchase_date = 'Purchase date is required';
  } else if (!isValidDate(data.purchase_date)) {
    errors.purchase_date = 'Invalid date format';
  } else if (!isNotFutureDate(data.purchase_date)) {
    errors.purchase_date = 'Purchase date cannot be in the future';
  }
  
  // Commission validation
  if (data.commission.trim() && !isValidCommission(data.commission)) {
    errors.commission = 'Invalid commission amount';
  }
  
  // Currency validation
  if (!data.currency.trim()) {
    errors.currency = 'Currency is required';
  } else if (!isValidCurrency(data.currency)) {
    errors.currency = 'Invalid currency code';
  }
  
  // FX rate validation
  if (data.currency !== 'USD' && data.fx_rate.trim()) {
    if (!isValidExchangeRate(data.fx_rate)) {
      errors.fx_rate = 'Invalid exchange rate';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Sanitize string input by removing dangerous characters
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>"'&]/g, '') // Remove potentially dangerous HTML chars
    .substring(0, 255); // Limit length
}

/**
 * Validate and sanitize ticker input
 * @param ticker - Ticker to validate and sanitize
 * @returns Clean ticker or null if invalid
 */
export function sanitizeTicker(ticker: string): string | null {
  const clean = ticker.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return isValidTicker(clean) ? clean : null;
}