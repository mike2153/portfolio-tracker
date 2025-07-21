// =================
// APP CONSTANTS
// =================

// Environment
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 
                           process.env.EXPO_PUBLIC_BACKEND_API_URL ?? 
                           'http://localhost:8000';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 
                           process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 
                               process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// UI Constants
export const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#6b7280',
  
  // Background colors
  background: '#1f2937',
  surface: '#374151',
  card: '#374151',
  
  // Text colors
  text: '#fff',
  textSecondary: '#d1d5db',
  textMuted: '#9ca3af',
  
  // Border colors
  border: '#4b5563',
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

// Business Constants
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
] as const;

export const STOCK_EXCHANGES = [
  { code: 'NYSE', name: 'New York Stock Exchange' },
  { code: 'NASDAQ', name: 'NASDAQ' },
  { code: 'LSE', name: 'London Stock Exchange' },
  { code: 'TSE', name: 'Tokyo Stock Exchange' },
  { code: 'TSX', name: 'Toronto Stock Exchange' },
  { code: 'ASX', name: 'Australian Securities Exchange' },
] as const;

export const MARKET_SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Materials',
  'Real Estate',
  'Utilities',
  'Communication Services',
] as const;

export const TIME_PERIODS = [
  { value: '1D', label: '1 Day' },
  { value: '1W', label: '1 Week' },
  { value: '1M', label: '1 Month' },
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '1Y', label: '1 Year' },
  { value: '2Y', label: '2 Years' },
  { value: '5Y', label: '5 Years' },
  { value: 'MAX', label: 'All Time' },
] as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Dashboard
  DASHBOARD: '/api/dashboard',
  DASHBOARD_PERFORMANCE: '/api/dashboard/performance',
  
  // Portfolio
  PORTFOLIO: '/api/portfolio',
  TRANSACTIONS: '/api/transactions',
  QUOTE: '/api/quote',
  HISTORICAL_PRICE: '/api/historical_price',
  
  // Analytics
  ANALYTICS_SUMMARY: '/api/analytics/summary',
  ANALYTICS_HOLDINGS: '/api/analytics/holdings',
  ANALYTICS_DIVIDENDS: '/api/analytics/dividends',
  ANALYTICS_CONFIRM_DIVIDEND: '/api/analytics/dividends/confirm',
  ANALYTICS_SYNC_DIVIDENDS: '/api/analytics/dividends/sync',
  
  // Research
  SYMBOL_SEARCH: '/api/symbol_search',
  STOCK_OVERVIEW: '/api/stock_overview',
  STOCK_PRICES: '/api/stock_prices',
  NEWS: '/api/news',
  FINANCIALS: '/api/financials',
  FORCE_REFRESH_FINANCIALS: '/api/financials/force-refresh',
  
  // Auth
  AUTH_VALIDATE: '/api/auth/validate',
  HEALTH_CHECK: '/',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  AUTH_ERROR: 'Authentication failed. Please log in again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  GENERIC_ERROR: 'Something went wrong. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TRANSACTION_ADDED: 'Transaction added successfully',
  TRANSACTION_UPDATED: 'Transaction updated successfully',
  TRANSACTION_DELETED: 'Transaction deleted successfully',
  DIVIDEND_CONFIRMED: 'Dividend confirmed successfully',
  WATCHLIST_ADDED: 'Stock added to watchlist',
  WATCHLIST_REMOVED: 'Stock removed from watchlist',
} as const;

// Format options
export const NUMBER_FORMAT_OPTIONS = {
  currency: {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  percentage: {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  decimal: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
} as const;