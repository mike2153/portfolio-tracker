import { NextRequest, NextResponse } from 'next/server'

interface SymbolInfo {
  symbol: string
  name: string
  exchange: string
  type: string
  currency: string
  country: string
}

// This endpoint fetches ALL symbols from major exchanges and caches them
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const exchange = searchParams.get('exchange') || 'all'

  try {
    const finnhubApiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY

    if (!finnhubApiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    // Fetch symbols from multiple exchanges
    const exchanges = exchange === 'all' 
      ? ['US', 'L', 'AS', 'T', 'HK', 'SS', 'SZ', 'DE', 'PA', 'TO', 'AX', 'KS', 'NS', 'SA']
      : [exchange]

    let allSymbols: SymbolInfo[] = []

    for (const exchangeCode of exchanges) {
      try {
        console.log(`Fetching symbols for exchange: ${exchangeCode}`)
        
        const response = await fetch(
          `https://finnhub.io/api/v1/stock/symbol?exchange=${exchangeCode}&token=${finnhubApiKey}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          
          // Finnhub returns: [{ description, displaySymbol, symbol, type, currency, figi }]
          const symbols: SymbolInfo[] = data.map((item: any) => ({
            symbol: item.displaySymbol || item.symbol,
            name: item.description || item.symbol,
            exchange: getExchangeDisplayName(exchangeCode),
            type: item.type || 'Common Stock',
            currency: item.currency || 'USD',
            country: getCountryFromExchange(exchangeCode)
          }))

          allSymbols = allSymbols.concat(symbols)
          console.log(`Fetched ${symbols.length} symbols from ${exchangeCode}`)
        }
      } catch (error) {
        console.error(`Error fetching symbols for ${exchangeCode}:`, error)
      }
    }

    // Remove duplicates and sort
    const uniqueSymbols = Array.from(
      new Map(allSymbols.map(s => [s.symbol, s])).values()
    ).sort((a, b) => a.symbol.localeCompare(b.symbol))

    return NextResponse.json({
      total: uniqueSymbols.length,
      symbols: uniqueSymbols,
      exchanges: exchanges,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching symbols:', error)
    return NextResponse.json(
      { error: 'Failed to fetch symbols' },
      { status: 500 }
    )
  }
}

function getExchangeDisplayName(code: string): string {
  const exchangeNames: { [key: string]: string } = {
    'US': 'NASDAQ/NYSE',
    'L': 'LSE',
    'AS': 'Euronext Amsterdam', 
    'T': 'TSE',
    'HK': 'HKEX',
    'SS': 'Shanghai Stock Exchange',
    'SZ': 'Shenzhen Stock Exchange',
    'DE': 'XETRA',
    'PA': 'Euronext Paris',
    'TO': 'TSX',
    'AX': 'ASX',
    'KS': 'Korea Exchange',
    'NS': 'NSE',
    'SA': 'B3'
  }
  return exchangeNames[code] || code
}

function getCountryFromExchange(code: string): string {
  const countries: { [key: string]: string } = {
    'US': 'United States',
    'L': 'United Kingdom',
    'AS': 'Netherlands',
    'T': 'Japan',
    'HK': 'Hong Kong',
    'SS': 'China',
    'SZ': 'China',
    'DE': 'Germany', 
    'PA': 'France',
    'TO': 'Canada',
    'AX': 'Australia',
    'KS': 'South Korea',
    'NS': 'India',
    'SA': 'Brazil'
  }
  return countries[code] || 'Unknown'
} 