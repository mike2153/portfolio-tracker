import { NextRequest, NextResponse } from 'next/server'

// Declare process for Node.js environment variables  
declare const process: { env: { [key: string]: string | undefined } }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  
  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required' },
      { status: 400 }
    )
  }

  // Check for Alpha Vantage API key
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY
  if (!apiKey) {
    console.error('ALPHA_VANTAGE_API_KEY environment variable is not set')
    return NextResponse.json(
      { 
        error: 'Market data service unavailable',
        details: 'API configuration required for production deployment'
      },
      { status: 503 }
    )
  }

  try {
    // Alpha Vantage Daily Time Series endpoint with full output
    const alphaVantageUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout for historical data
    
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
        { error: `Invalid symbol: ${symbol}` },
        { status: 404 }
      )
    }
    
    if (data['Note']) {
      return NextResponse.json(
        { error: 'API call frequency limit reached. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Parse Alpha Vantage response format
    const timeSeries = data['Time Series (Daily)']
    if (!timeSeries) {
      return NextResponse.json(
        { error: `No historical data available for symbol: ${symbol}` },
        { status: 404 }
      )
    }
    
    // Convert Alpha Vantage format to our format
    let historicalData = Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
      date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'])
    }))
    
    // Sort by date (oldest first)
    historicalData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    // Apply date filtering if provided
    if (from) {
      const fromDate = new Date(from)
      if (!isNaN(fromDate.getTime())) {
        historicalData = historicalData.filter(item => new Date(item.date) >= fromDate)
      }
    }
    
    if (to) {
      const toDate = new Date(to)
      if (!isNaN(toDate.getTime())) {
        historicalData = historicalData.filter(item => new Date(item.date) <= toDate)
      }
    }
    
    // Validate we have data in the requested range
    if (historicalData.length === 0) {
      return NextResponse.json(
        { 
          error: 'No data available for the requested date range',
          requestedRange: { from, to },
          symbol: symbol.toUpperCase()
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      data: historicalData,
      count: historicalData.length,
      dateRange: {
        from: historicalData[0]?.date,
        to: historicalData[historicalData.length - 1]?.date
      },
      source: 'Alpha Vantage',
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('Alpha Vantage Historical API Error:', error.message)
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - historical data service is slow to respond' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Unable to fetch historical data',
        details: 'Historical data service temporarily unavailable'
      },
      { status: 503 }
    )
  }
} 