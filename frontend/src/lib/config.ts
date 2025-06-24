export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
  isDevelopment: process.env.NEXT_PUBLIC_ENVIRONMENT === 'development',
  isProduction: process.env.NEXT_PUBLIC_ENVIRONMENT === 'production',
} as const;

export const apiEndpoints = {
  portfolios: (userId: string) => `${config.apiBaseUrl}/api/portfolios/${userId}`,
  addHolding: (userId: string) => `${config.apiBaseUrl}/api/portfolios/${userId}/holdings`,
  updateHolding: (userId: string, holdingId: number) => `${config.apiBaseUrl}/api/portfolios/${userId}/holdings/${holdingId}`,
  symbolsSearch: (query: string, limit: number = 10) => 
    `${config.apiBaseUrl}/api/symbols/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  stockHistorical: (ticker: string, period: string = '5Y') => 
    `${config.apiBaseUrl}/api/stocks/${ticker}/historical?period=${period}`,
  stockOverview: (ticker: string) => 
    `${config.apiBaseUrl}/api/stocks/${ticker}/overview`,
  stockQuote: (ticker: string) => 
    `${config.apiBaseUrl}/api/stocks/${ticker}/quote`,
  deleteHolding: (userId: string, holdingId: number) => `${config.apiBaseUrl}/api/portfolios/${userId}/holdings/${holdingId}`,

  dashboard: {
    overview: () => `/api/dashboard/overview`,
    allocation: (groupBy: string) => `/api/dashboard/allocation?groupBy=${groupBy}`,
    gainers: (limit: number) => `/api/dashboard/gainers?limit=${limit}`,
    losers: (limit: number) => `/api/dashboard/losers?limit=${limit}`,
    dividendForecast: (months: number) => `/api/dashboard/dividend-forecast?months=${months}`,
    portfolioPerformance: (userId: string, period: string, benchmark: string) =>
      `/api/portfolios/${userId}/performance?period=${period}&benchmark=${benchmark}`,
  },
  fx: {
    latest: (base: string) => `/api/fx/latest?base=${base}`,
  }
} as const;

// Add transaction endpoints
export const ENDPOINTS = {
  // ... existing endpoints ...
  
  // Transaction management endpoints
  transactions: {
    create: '/api/transactions/create',
    getUser: '/api/transactions/user',
    updatePrices: '/api/transactions/update-prices',
    getCachedPrices: '/api/transactions/cached-prices',
    getSummary: '/api/transactions/summary',
    migrate: '/api/transactions/migrate'
  }
  // ... existing endpoints ...
}; 