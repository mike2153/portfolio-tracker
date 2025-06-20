import { NextRequest, NextResponse } from 'next/server'

// Declare process for Node.js environment variables
declare const process: { env: { [key: string]: string | undefined } }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  
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
    // Alpha Vantage Global Quote endpoint
    const alphaVantageUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
    
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
    
    // Log the raw response for debugging
    console.log('Alpha Vantage Raw Response:', JSON.stringify(data, null, 2))
    
    // Check for API error responses
    if (data['Error Message']) {
      console.error('Alpha Vantage Error Message:', data['Error Message'])
      return NextResponse.json(
        { error: `Invalid symbol: ${symbol}` },
        { status: 404 }
      )
    }
    
    if (data['Note']) {
      console.error('Alpha Vantage Rate Limit:', data['Note'])
      return NextResponse.json(
        { error: 'API call frequency limit reached. Please try again later.' },
        { status: 429 }
      )
    }
    
    // Parse Alpha Vantage response format
    const quote = data['Global Quote']
    if (!quote) {
      console.error('No Global Quote in response. Available keys:', Object.keys(data))
      return NextResponse.json(
        { 
          error: `No data available for symbol: ${symbol}`,
          debug: `Response keys: ${Object.keys(data).join(', ')}`
        },
        { status: 404 }
      )
    }
    
    // Alpha Vantage response format mapping
    const currentPrice = parseFloat(quote['05. price'])
    const previousClose = parseFloat(quote['08. previous close'])
    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''))
    
    if (isNaN(currentPrice)) {
      return NextResponse.json(
        { error: `Invalid price data for symbol: ${symbol}` },
        { status: 422 }
      )
    }
    
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      price: currentPrice,
      previousClose: previousClose,
      change: currentPrice - previousClose,
      changePercent: changePercent,
      timestamp: new Date().toISOString(),
      source: 'Alpha Vantage'
    })
    
  } catch (error: any) {
    console.error('Alpha Vantage API Error:', error.message)
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - market data service is slow to respond' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Unable to fetch stock price',
        details: 'Market data service temporarily unavailable'
      },
      { status: 503 }
    )
  }
} 