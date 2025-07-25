import { NUMBER_FORMAT_OPTIONS } from './constants';

// =================
// NUMBER FORMATTERS
// =================

/**
 * Format a number as currency
 * @param value - The number to format
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    ...NUMBER_FORMAT_OPTIONS.currency,
    currency,
  }).format(value);
}

/**
 * Format a number as percentage
 * @param value - The decimal value to format (0.05 = 5%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    ...NUMBER_FORMAT_OPTIONS.percentage,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a large number with appropriate suffix (K, M, B, T)
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string with suffix
 */
export function formatLargeNumber(value: number, decimals: number = 1): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1e12) {
    return `${sign}${(absValue / 1e12).toFixed(decimals)}T`;
  } else if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
  } else {
    return `${sign}${absValue.toFixed(decimals)}`;
  }
}

/**
 * Format a decimal number with specified decimal places
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export function formatDecimal(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a change value with proper sign and color indication
 * @param value - The change value
 * @param isPercentage - Whether the value is a percentage (default: false)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Object with formatted string and color indication
 */
export function formatChange(
  value: number, 
  isPercentage: boolean = false, 
  decimals: number = 2
): { formatted: string; isPositive: boolean; isNeutral: boolean } {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const sign = isPositive ? '+' : '';
  
  let formatted: string;
  if (isPercentage) {
    formatted = `${sign}${formatPercentage(value / 100, decimals)}`;
  } else {
    formatted = `${sign}${formatDecimal(value, decimals)}`;
  }
  
  return {
    formatted,
    isPositive,
    isNeutral,
  };
}

// =================
// DATE FORMATTERS
// =================

/**
 * Format a date string or Date object
 * @param date - Date to format
 * @param format - Format type ('short', 'medium', 'long', 'relative')
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date, 
  format: 'short' | 'medium' | 'long' | 'relative' = 'medium'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    case 'medium':
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'long':
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'relative':
      return formatRelativeTime(dateObj);
    default:
      return dateObj.toLocaleDateString();
  }
}

/**
 * Format a time string for relative display (e.g., "2h ago", "just now")
 * @param date - Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return formatDate(date, 'short');
  }
}

// =================
// UTILITY FORMATTERS
// =================

/**
 * Truncate text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 50)
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format stock ticker symbol consistently
 * @param ticker - Stock ticker
 * @returns Formatted ticker (uppercase)
 */
export function formatTicker(ticker: string): string {
  return ticker.toUpperCase().trim();
}

/**
 * Format company name for display
 * @param name - Company name
 * @param maxLength - Maximum length (default: 30)
 * @returns Formatted company name
 */
export function formatCompanyName(name: string, maxLength: number = 30): string {
  const cleaned = name
    .replace(/\b(Inc\.?|Corp\.?|Corporation|LLC|Ltd\.?|Limited)\b/gi, '')
    .trim();
  
  return truncateText(cleaned, maxLength);
}

/**
 * Format market cap value
 * @param value - Market cap value
 * @returns Formatted market cap string
 */
export function formatMarketCap(value: number): string {
  return '$' + formatLargeNumber(value);
}

/**
 * Format volume with appropriate suffix
 * @param volume - Trading volume
 * @returns Formatted volume string
 */
export function formatVolume(volume: number): string {
  return formatLargeNumber(volume);
}