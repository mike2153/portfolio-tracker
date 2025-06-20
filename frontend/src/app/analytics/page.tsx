'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User, StockData } from '@/types'

interface LiveStock {
  symbol: string
  company: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: string
  lastUpdate: string
}

interface PortfolioMetrics {
  totalValue: number
  dailyChange: number
  dailyChangePercent: number
  sharpeRatio: number
  beta: number
  alpha: number
  maxDrawdown: number
  volatility: number
  returnsYTD: number
  returnsOneMonth: number
  returnsThreeMonth: number
  returnsOneYear: number
}

interface SectorAllocation {
  sector: string
  percentage: number
  value: number
  color: string
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveStocks, setLiveStocks] = useState<LiveStock[]>([])
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics>({
    totalValue: 0,
    dailyChange: 0,
    dailyChangePercent: 0,
    sharpeRatio: 0,
    beta: 0,
    alpha: 0,
    maxDrawdown: 0,
    volatility: 0,
    returnsYTD: 0,
    returnsOneMonth: 0,
    returnsThreeMonth: 0,
    returnsOneYear: 0
  })
  const [sectorAllocations, setSectorAllocations] = useState<SectorAllocation[]>([])
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('')

  useEffect(() => {
    checkUser()
    fetchLiveData()
    fetchPortfolioMetrics()
    fetchSectorAllocations()
    
    // Set up live data refresh every 30 seconds
    const interval = setInterval(() => {
      fetchLiveData()
      fetchPortfolioMetrics()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setLoading(false)
  }

  const fetchLiveData = async () => {
    try {
      // Fetch live data for multiple stocks
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX', 'ORCL', 'CRM']
      const stockData: LiveStock[] = []

      for (const symbol of symbols) {
        try {
          const response = await fetch(`/api/stock-price?symbol=${symbol}`)
          const data = await response.json()
          
          stockData.push({
            symbol: data.symbol,
            company: getCompanyName(data.symbol),
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            volume: Math.floor(Math.random() * 50000000) + 10000000, // Mock volume
            marketCap: getMarketCap(data.symbol),
            lastUpdate: new Date().toLocaleTimeString()
          })
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error)
        }
      }

      setLiveStocks(stockData)
      setLastUpdateTime(new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Error fetching live data:', error)
    }
  }

  const fetchPortfolioMetrics = async () => {
    try {
      // Mock advanced portfolio metrics - in real app, calculate from user's holdings
      const metrics: PortfolioMetrics = {
        totalValue: 16500.00,
        dailyChange: 425.30,
        dailyChangePercent: 2.65,
        sharpeRatio: 1.24,
        beta: 0.85,
        alpha: 0.05,
        maxDrawdown: -8.2,
        volatility: 18.5,
        returnsYTD: 12.8,
        returnsOneMonth: 3.2,
        returnsThreeMonth: 8.7,
        returnsOneYear: 15.4
      }
      setPortfolioMetrics(metrics)
    } catch (error) {
      console.error('Error fetching portfolio metrics:', error)
    }
  }

  const fetchSectorAllocations = async () => {
    try {
      // Mock sector allocation data
      const allocations: SectorAllocation[] = [
        { sector: 'Technology', percentage: 45.5, value: 7507.50, color: '#3B82F6' },
        { sector: 'Consumer Discretionary', percentage: 22.3, value: 3679.50, color: '#10B981' },
        { sector: 'Healthcare', percentage: 15.2, value: 2508.00, color: '#F59E0B' },
        { sector: 'Financials', percentage: 10.0, value: 1650.00, color: '#EF4444' },
        { sector: 'Energy', percentage: 7.0, value: 1155.00, color: '#8B5CF6' }
      ]
      setSectorAllocations(allocations)
    } catch (error) {
      console.error('Error fetching sector allocations:', error)
    }
  }

  const getCompanyName = (symbol: string): string => {
    const companies: { [key: string]: string } = {
      'AAPL': 'Apple Inc.',
      'GOOGL': 'Alphabet Inc.',
      'MSFT': 'Microsoft Corporation',
      'TSLA': 'Tesla Inc.',
      'AMZN': 'Amazon.com Inc.',
      'NVDA': 'NVIDIA Corporation',
      'META': 'Meta Platforms Inc.',
      'NFLX': 'Netflix Inc.',
      'ORCL': 'Oracle Corporation',
      'CRM': 'Salesforce Inc.'
    }
    return companies[symbol] || symbol
  }

  const getMarketCap = (symbol: string): string => {
    const marketCaps: { [key: string]: string } = {
      'AAPL': '$2.8T',
      'GOOGL': '$1.7T',
      'MSFT': '$2.9T',
      'TSLA': '$780B',
      'AMZN': '$1.5T',
      'NVDA': '$2.2T',
      'META': '$885B',
      'NFLX': '$245B',
      'ORCL': '$315B',
      'CRM': '$220B'
    }
    return marketCaps[symbol] || 'N/A'
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Advanced Analytics</h1>
          <p className="text-gray-600 mb-8">Please sign in to view analytics</p>
          <a href="/auth" className="btn-primary">Sign In</a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Analytics</h1>
          <p className="text-gray-600">
            Last updated: {lastUpdateTime} • Auto-refresh: 30s
          </p>
        </div>
        <button
          onClick={fetchLiveData}
          className="btn-primary"
        >
          🔄 Refresh Data
        </button>
      </div>

      {/* Portfolio Performance Metrics */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-6">Portfolio Performance Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="metric-card">
            <div className="metric-value">${portfolioMetrics.totalValue.toLocaleString()}</div>
            <div className="metric-label">Total Value</div>
          </div>
          <div className="metric-card">
            <div className={`metric-value ${portfolioMetrics.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioMetrics.dailyChange >= 0 ? '+' : ''}${portfolioMetrics.dailyChange.toFixed(2)}
            </div>
            <div className="metric-label">Daily Change</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{portfolioMetrics.sharpeRatio.toFixed(2)}</div>
            <div className="metric-label">Sharpe Ratio</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{portfolioMetrics.beta.toFixed(2)}</div>
            <div className="metric-label">Beta</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{(portfolioMetrics.alpha * 100).toFixed(1)}%</div>
            <div className="metric-label">Alpha</div>
          </div>
          <div className="metric-card">
            <div className="metric-value text-red-600">{portfolioMetrics.maxDrawdown.toFixed(1)}%</div>
            <div className="metric-label">Max Drawdown</div>
          </div>
        </div>
      </div>

      {/* Returns Timeline */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-6">Returns Timeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="metric-card">
            <div className={`metric-value ${portfolioMetrics.returnsOneMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioMetrics.returnsOneMonth >= 0 ? '+' : ''}{portfolioMetrics.returnsOneMonth.toFixed(1)}%
            </div>
            <div className="metric-label">1 Month</div>
          </div>
          <div className="metric-card">
            <div className={`metric-value ${portfolioMetrics.returnsThreeMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioMetrics.returnsThreeMonth >= 0 ? '+' : ''}{portfolioMetrics.returnsThreeMonth.toFixed(1)}%
            </div>
            <div className="metric-label">3 Months</div>
          </div>
          <div className="metric-card">
            <div className={`metric-value ${portfolioMetrics.returnsYTD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioMetrics.returnsYTD >= 0 ? '+' : ''}{portfolioMetrics.returnsYTD.toFixed(1)}%
            </div>
            <div className="metric-label">Year to Date</div>
          </div>
          <div className="metric-card">
            <div className={`metric-value ${portfolioMetrics.returnsOneYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {portfolioMetrics.returnsOneYear >= 0 ? '+' : ''}{portfolioMetrics.returnsOneYear.toFixed(1)}%
            </div>
            <div className="metric-label">1 Year</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Live Market Data Feed */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Live Market Data</h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">Live</span>
            </div>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {liveStocks.map((stock) => (
              <div key={stock.symbol} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900">{stock.symbol}</span>
                    <span className="text-sm text-gray-600">{stock.company}</span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-lg font-semibold">${stock.price.toFixed(2)}</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      stock.changePercent >= 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Vol: {stock.volume.toLocaleString()} • Cap: {stock.marketCap}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${
                    stock.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">{stock.lastUpdate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sector Allocation */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Sector Allocation</h2>
          <div className="space-y-4">
            {sectorAllocations.map((sector) => (
              <div key={sector.sector} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{sector.sector}</span>
                  <span className="text-sm text-gray-600">
                    {sector.percentage.toFixed(1)}% (${sector.value.toLocaleString()})
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${sector.percentage}%`,
                      backgroundColor: sector.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Risk Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Portfolio Risk</h3>
            <div className="metric-card">
              <div className="metric-value">{portfolioMetrics.volatility.toFixed(1)}%</div>
              <div className="metric-label">Volatility (Annualized)</div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Market Correlation</h3>
            <div className="metric-card">
              <div className="metric-value">{portfolioMetrics.beta.toFixed(2)}</div>
              <div className="metric-label">Beta vs S&P 500</div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Risk-Adjusted Returns</h3>
            <div className="metric-card">
              <div className="metric-value">{portfolioMetrics.sharpeRatio.toFixed(2)}</div>
              <div className="metric-label">Sharpe Ratio</div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">📊 Risk Assessment</h4>
          <div className="text-sm text-blue-800">
            <p className="mb-2">
              <strong>Beta of {portfolioMetrics.beta.toFixed(2)}</strong>: Your portfolio is {portfolioMetrics.beta < 1 ? 'less volatile' : 'more volatile'} than the market.
            </p>
            <p className="mb-2">
              <strong>Sharpe Ratio of {portfolioMetrics.sharpeRatio.toFixed(2)}</strong>: {
                portfolioMetrics.sharpeRatio > 1 ? 'Excellent' : portfolioMetrics.sharpeRatio > 0.5 ? 'Good' : 'Below Average'
              } risk-adjusted returns.
            </p>
            <p>
              <strong>Max Drawdown of {portfolioMetrics.maxDrawdown.toFixed(1)}%</strong>: The largest peak-to-trough decline in your portfolio.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 