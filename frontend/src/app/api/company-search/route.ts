import { NextRequest, NextResponse } from 'next/server'

// Declare process for Node.js environment variables
declare const process: { env: { [key: string]: string | undefined } }

interface CompanyResult {
  symbol: string
  name: string
  exchange: string
  currency: string
  country: string
  type?: string
}

// Company search with extensive fallback + API when available
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  
  if (!q || q.trim().length < 1) {
    return NextResponse.json(
      { error: 'Search query parameter "q" is required' },
      { status: 400 }
    )
  }

  // Check for Alpha Vantage API key
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY
  if (!apiKey) {
    console.error('ALPHA_VANTAGE_API_KEY environment variable is not set')
    return NextResponse.json(
      { 
        error: 'Symbol search service unavailable',
        details: 'API configuration required for production deployment'
      },
      { status: 503 }
    )
  }

  try {
    // Alpha Vantage Symbol Search endpoint
    const alphaVantageUrl = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${apiKey}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(alphaVantageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Portfolio-Analytics/1.0'
      }
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Check for API error responses
    if (data['Error Message']) {
      return NextResponse.json(
        { error: 'Invalid search query' },
        { status: 400 }
      )
    }
    
    if (data['Note']) {
      return NextResponse.json(
        { error: 'API call frequency limit reached. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Parse Alpha Vantage response format
    const matches = data['bestMatches'] || []
    
    // Convert to our expected format
    const results = matches.slice(0, 10).map((match: any) => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: match['3. type'],
      region: match['4. region'],
      marketOpen: match['5. marketOpen'],
      marketClose: match['6. marketClose'],
      timezone: match['7. timezone'],
      currency: match['8. currency'],
      matchScore: parseFloat(match['9. matchScore'])
    }))
    
    return NextResponse.json({
      results,
      total: results.length,
      query: q.trim(),
      source: 'Alpha Vantage'
    })
    
  } catch (error: any) {
    console.error('Alpha Vantage Symbol Search Error:', error.message)
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - symbol search service is slow to respond' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Unable to search symbols',
        details: 'Symbol search service temporarily unavailable'
      },
      { status: 503 }
    )
  }
}

function sortByRelevance(results: CompanyResult[], query: string): CompanyResult[] {
  const queryLower = query.toLowerCase()
  
  return results.sort((a, b) => {
    const aSymbol = a.symbol.toLowerCase()
    const bSymbol = b.symbol.toLowerCase()
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()

    // Exact symbol matches first
    if (aSymbol === queryLower && bSymbol !== queryLower) return -1
    if (bSymbol === queryLower && aSymbol !== queryLower) return 1

    // Symbol starts with query
    if (aSymbol.startsWith(queryLower) && !bSymbol.startsWith(queryLower)) return -1
    if (bSymbol.startsWith(queryLower) && !aSymbol.startsWith(queryLower)) return 1

    // Name starts with query
    if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1
    if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1

    // Exchange priority
    const exchangePriority: { [key: string]: number } = {
      'NASDAQ/NYSE': 1, 'LSE': 2, 'XETRA': 3, 'TSE': 4, 'HKEX': 5, 'ASX': 6
    }
    const aPriority = exchangePriority[a.exchange] || 10
    const bPriority = exchangePriority[b.exchange] || 10
    
    if (aPriority !== bPriority) return aPriority - bPriority

    return a.symbol.localeCompare(b.symbol)
  })
}

function getComprehensiveFallback(query: string): NextResponse {
  // MASSIVE fallback list - covers most popular stocks
  const companies: CompanyResult[] = [
    // Big Tech
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'GOOG', name: 'Alphabet Inc. Class C', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'NFLX', name: 'Netflix, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'CRM', name: 'Salesforce, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    
    // Financial
    { symbol: 'V', name: 'Visa Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'MA', name: 'Mastercard Incorporated', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'BAC', name: 'Bank of America Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'WFC', name: 'Wells Fargo & Company', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'GS', name: 'The Goldman Sachs Group, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'MS', name: 'Morgan Stanley', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    
    // Consumer
    { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'HD', name: 'The Home Depot, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'PG', name: 'The Procter & Gamble Company', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'DIS', name: 'The Walt Disney Company', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'PEP', name: 'PepsiCo, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'NKE', name: 'NIKE, Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'MCD', name: "McDonald's Corporation", exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    
    // Energy & Industrial
    { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'BA', name: 'The Boeing Company', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'GE', name: 'General Electric Company', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    
    // ETFs
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'IWM', name: 'iShares Russell 2000 ETF', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'EFA', name: 'iShares MSCI EAFE ETF', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'United States' },
    
    // International
    { symbol: 'TSM', name: 'Taiwan Semiconductor Manufacturing Company Limited', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'Taiwan' },
    { symbol: 'BABA', name: 'Alibaba Group Holding Limited', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'China' },
    { symbol: 'NVO', name: 'Novo Nordisk A/S', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'Denmark' },
    { symbol: 'ASML', name: 'ASML Holding N.V.', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'Netherlands' },
    { symbol: 'SAP', name: 'SAP SE', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'Germany' },
    { symbol: 'TM', name: 'Toyota Motor Corporation', exchange: 'NASDAQ/NYSE', currency: 'USD', country: 'Japan' },
    
    // UK Stocks
    { symbol: 'VOD.L', name: 'Vodafone Group plc', exchange: 'LSE', currency: 'GBP', country: 'United Kingdom' },
    { symbol: 'BP.L', name: 'BP p.l.c.', exchange: 'LSE', currency: 'GBP', country: 'United Kingdom' },
    { symbol: 'SHEL.L', name: 'Shell plc', exchange: 'LSE', currency: 'GBP', country: 'United Kingdom' },
    { symbol: 'AZN.L', name: 'AstraZeneca PLC', exchange: 'LSE', currency: 'GBP', country: 'United Kingdom' },
    { symbol: 'LLOY.L', name: 'Lloyds Banking Group plc', exchange: 'LSE', currency: 'GBP', country: 'United Kingdom' },
    
    // German Stocks
    { symbol: 'SAP.DE', name: 'SAP SE', exchange: 'XETRA', currency: 'EUR', country: 'Germany' },
    { symbol: 'SIE.DE', name: 'Siemens Aktiengesellschaft', exchange: 'XETRA', currency: 'EUR', country: 'Germany' },
    
    // Japanese Stocks
    { symbol: '7203.T', name: 'Toyota Motor Corporation', exchange: 'TSE', currency: 'JPY', country: 'Japan' },
    { symbol: '6758.T', name: 'Sony Group Corporation', exchange: 'TSE', currency: 'JPY', country: 'Japan' },
    
    // Hong Kong Stocks
    { symbol: '0700.HK', name: 'Tencent Holdings Limited', exchange: 'HKEX', currency: 'HKD', country: 'Hong Kong' },
    { symbol: '0941.HK', name: 'China Mobile Limited', exchange: 'HKEX', currency: 'HKD', country: 'Hong Kong' },
    
    // Australian Stocks
    { symbol: 'CBA.AX', name: 'Commonwealth Bank of Australia', exchange: 'ASX', currency: 'AUD', country: 'Australia' },
    { symbol: 'BHP.AX', name: 'BHP Group Limited', exchange: 'ASX', currency: 'AUD', country: 'Australia' },
    
    // Canadian Stocks
    { symbol: 'SHOP.TO', name: 'Shopify Inc.', exchange: 'TSX', currency: 'CAD', country: 'Canada' },
    { symbol: 'RY.TO', name: 'Royal Bank of Canada', exchange: 'TSX', currency: 'CAD', country: 'Canada' }
  ]

  const queryLower = query.toLowerCase()
  const filtered = companies.filter(company =>
    company.symbol.toLowerCase().includes(queryLower) ||
    company.name.toLowerCase().includes(queryLower)
  )

  const sorted = sortByRelevance(filtered, query)
  
  console.log(`Using comprehensive fallback, found ${sorted.length} results for "${query}"`)

  return NextResponse.json({
    results: sorted,
    total: sorted.length,
    query,
    source: 'comprehensive_fallback'
  })
}

function detectExchange(symbol: string): string {
  if (!symbol) return 'Unknown'
  
  if (symbol.includes('.L') || symbol.includes('.LN')) return 'LSE'
  if (symbol.includes('.DE')) return 'XETRA' 
  if (symbol.includes('.T') || symbol.includes('.TYO')) return 'TSE'
  if (symbol.includes('.HK')) return 'HKEX'
  if (symbol.includes('.AX') || symbol.includes('.AU')) return 'ASX'
  if (symbol.includes('.TO')) return 'TSX'
  if (symbol.includes('.PA')) return 'Euronext Paris'
  if (symbol.includes('.AS')) return 'Euronext Amsterdam'
  
  return 'NASDAQ/NYSE'
}

function getCurrencyFromSymbol(symbol: string): string {
  const exchange = detectExchange(symbol)
  const currencies: { [key: string]: string } = {
    'NASDAQ/NYSE': 'USD', 'LSE': 'GBP', 'XETRA': 'EUR', 'TSE': 'JPY', 
    'HKEX': 'HKD', 'ASX': 'AUD', 'TSX': 'CAD'
  }
  return currencies[exchange] || 'USD'
}

function getCountryFromSymbol(symbol: string): string {
  const exchange = detectExchange(symbol)
  const countries: { [key: string]: string } = {
    'NASDAQ/NYSE': 'United States', 'LSE': 'United Kingdom', 'XETRA': 'Germany', 
    'TSE': 'Japan', 'HKEX': 'Hong Kong', 'ASX': 'Australia', 'TSX': 'Canada'
  }
  return countries[exchange] || 'Unknown'
} 