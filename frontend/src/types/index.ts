// User and Auth types
export interface User {
  id: string
  email?: string
  user_metadata?: any
  app_metadata?: any
  aud: string
  created_at?: string
}

// Financial data types
export interface FinancialReport {
  fiscalDateEnding: string
  totalRevenue?: string
  grossProfit?: string
  totalOperatingExpenses?: string
  operatingIncome?: string
  netIncome?: string
  totalAssets?: string
  totalLiabilities?: string
  totalShareholderEquity?: string
  operatingCashflow?: string
  [key: string]: string | undefined
}

export interface FinancialStatements {
  symbol: string
  annual_reports: FinancialReport[]
  quarterly_reports: FinancialReport[]
}

// Holdings and Portfolio types
export interface HoldingData {
  id: number
  ticker: string
  company_name: string
  shares: number
  purchase_price: number
  current_price?: number
  total_value?: number
  gain_loss?: number
  gain_loss_percent?: number
  purchase_date: string
  commission: number
}

// Benchmark data
export interface BenchmarkData {
  date: string
  indexed_performance: number
}

// Stock data types
export interface StockData {
  symbol: string
  company: string
  price: number
  change: number
  change_percent: number
  volume: number
}

// Dividend grouped by stock
export interface DividendByStock {
  ticker: string
  company_name: string
  total_annual: number
  dividends: any[]
  total_amount: number
  confirmed_amount: number
}

// Global window interface extension
declare global {
  interface Window {
    searchTimeout?: NodeJS.Timeout
  }
} 