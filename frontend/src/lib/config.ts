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
} as const; 