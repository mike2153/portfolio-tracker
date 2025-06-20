'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
import { User, HoldingData, BenchmarkData } from '@/types'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface MarketData {
  symbol: string
  price: number
  change: number
  changePercent: number
}

interface PortfolioSummary {
  totalValue: number
  totalGainLoss: number
  totalGainLossPercent: number
  topPerformer: string
  topPerformerGain: number
  holdingsCount: number
  cashBalance: number
}

interface PortfolioPerformance {
  date: string
  total_value: number
  indexed_performance: number
}

interface PerformanceComparison {
  portfolio_return: number
  benchmark_return: number
  outperformance: number
  summary: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [marketData, setMarketData] = useState<MarketData[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalGainLoss: 0,
    totalGainLossPercent: 0,
    topPerformer: '',
    topPerformerGain: 0,
    holdingsCount: 0,
    cashBalance: 0
  })
  const [portfolioPerformance, setPortfolioPerformance] = useState<PortfolioPerformance[]>([])
  const [benchmarkPerformance, setBenchmarkPerformance] = useState<BenchmarkData[]>([])
  const [performanceComparison, setPerformanceComparison] = useState<PerformanceComparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  
  // UI State
  const [selectedPeriod, setSelectedPeriod] = useState('1Y')
  const [selectedBenchmark, setSelectedBenchmark] = useState('^GSPC')

  const periods = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y']
  const benchmarks = [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^IXIC', name: 'Nasdaq Composite' },
    { symbol: '^DJI', name: 'Dow Jones' },
    { symbol: '^RUT', name: 'Russell 2000' },
    { symbol: 'VTI', name: 'Total Stock Market' }
  ]

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      Promise.all([
        fetchMarketOverview(),
        fetchPortfolioSummary(),
        fetchPortfolioPerformance()
      ]).finally(() => setLoading(false))
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchPortfolioPerformance()
    }
  }, [selectedPeriod, selectedBenchmark])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) {
      setLoading(false)
    }
  }

  const fetchMarketOverview = async () => {
    try {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA']
      const marketPromises = symbols.map(async (symbol) => {
        try {
          const response = await fetch(`/api/stock-price?symbol=${symbol}`)
          if (!response.ok) throw new Error(`Failed to fetch ${symbol}`)
          const data = await response.json()
          return {
            symbol: data.symbol,
            price: data.price,
            change: data.change || 0,
            changePercent: parseFloat(data.changePercent) || 0
          }
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error)
          return null
        }
      })

      const results = await Promise.all(marketPromises)
      const validResults = results.filter((result): result is MarketData => result !== null)
      setMarketData(validResults)
    } catch (error) {
      console.error('Error fetching market overview:', error)
    }
  }

  const fetchPortfolioSummary = async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`http://localhost:8000/api/portfolios/${user.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          // No portfolio yet - create one
          await createDefaultPortfolio()
          return
        }
        throw new Error('Failed to fetch portfolio')
      }

      const data = await response.json()
      const portfolio = data.portfolio
      const holdings = data.holdings || []

      // Calculate top performer
      let topPerformer = ''
      let topPerformerGain = 0
      
      holdings.forEach((holding: HoldingData) => {
        if (holding.gain_loss && holding.gain_loss > topPerformerGain) {
          topPerformerGain = holding.gain_loss
          topPerformer = holding.ticker
        }
      })

      setPortfolioSummary({
        totalValue: portfolio.total_value,
        totalGainLoss: holdings.reduce((sum: number, h: HoldingData) => sum + (h.gain_loss || 0), 0),
        totalGainLossPercent: holdings.length > 0 ? 
          (holdings.reduce((sum: number, h: HoldingData) => sum + (h.gain_loss_percent || 0), 0) / holdings.length) : 0,
        topPerformer,
        topPerformerGain,
        holdingsCount: holdings.length,
        cashBalance: portfolio.cash_balance
      })

    } catch (error) {
      console.error('Error fetching portfolio summary:', error)
    }
  }

  const fetchPortfolioPerformance = async () => {
    if (!user) return

    try {
      if (!user?.id) return
      
      const response = await fetch(`http://localhost:8000/api/portfolios/${user.id}/performance?period=${selectedPeriod}&benchmark=${selectedBenchmark}`)
      if (!response.ok) return

      const data = await response.json()
      setPortfolioPerformance(data.portfolio_performance || [])
      setBenchmarkPerformance(data.benchmark_performance || [])
      setPerformanceComparison(data.comparison)
    } catch (error) {
      console.error('Error fetching portfolio performance:', error)
    }
  }

  const createDefaultPortfolio = async () => {
    // This would typically be handled by the backend when a user first signs up
    console.log('Creating default portfolio for user:', user?.id)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Portfolio Dashboard</h1>
          <p className="text-gray-600 mb-8">Please sign in to view your portfolio</p>
          <a href="/auth" className="btn-primary">Sign In</a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your portfolio overview.</p>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="metric-card">
          <div className="metric-value">${portfolioSummary.totalValue.toLocaleString()}</div>
          <div className="metric-label">Total Portfolio Value</div>
        </div>
        <div className="metric-card">
          <div className={`metric-value ${portfolioSummary.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {portfolioSummary.totalGainLoss >= 0 ? '+' : ''}${portfolioSummary.totalGainLoss.toLocaleString()}
          </div>
          <div className="metric-label">Total Gain/Loss</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">${portfolioSummary.cashBalance.toLocaleString()}</div>
          <div className="metric-label">Cash Balance</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{portfolioSummary.holdingsCount}</div>
          <div className="metric-label">Holdings</div>
        </div>
      </div>

      {/* Performance Chart Section */}
      <div className="card mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 lg:mb-0">Portfolio Performance</h2>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Period Selector */}
            <div className="flex space-x-2">
              {periods.map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    selectedPeriod === period
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Benchmark Selector */}
            <select
              value={selectedBenchmark}
              onChange={(e) => setSelectedBenchmark(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              {benchmarks.map((benchmark) => (
                <option key={benchmark.symbol} value={benchmark.symbol}>
                  {benchmark.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Performance Comparison Summary */}
        {performanceComparison && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium">{performanceComparison.summary}</p>
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div>
                <span className="text-blue-600">Portfolio Return:</span>
                <span className={`ml-2 font-semibold ${performanceComparison.portfolio_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceComparison.portfolio_return >= 0 ? '+' : ''}{performanceComparison.portfolio_return}%
                </span>
              </div>
              <div>
                <span className="text-blue-600">Benchmark Return:</span>
                <span className={`ml-2 font-semibold ${performanceComparison.benchmark_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceComparison.benchmark_return >= 0 ? '+' : ''}{performanceComparison.benchmark_return}%
                </span>
              </div>
              <div>
                <span className="text-blue-600">Outperformance:</span>
                <span className={`ml-2 font-semibold ${performanceComparison.outperformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {performanceComparison.outperformance >= 0 ? '+' : ''}{performanceComparison.outperformance}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Chart */}
        {portfolioPerformance.length > 0 || benchmarkPerformance.length > 0 ? (
          <Plot
            data={[
              // Portfolio performance
              ...(portfolioPerformance.length > 0 ? [{
                x: portfolioPerformance.map(p => p.date),
                y: portfolioPerformance.map(p => p.indexed_performance),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: 'Portfolio',
                line: { color: '#2563eb', width: 3 }
              }] : []),
              // Benchmark performance
              ...(benchmarkPerformance.length > 0 ? [{
                x: benchmarkPerformance.map(b => b.date),
                y: benchmarkPerformance.map(b => b.indexed_performance),
                type: 'scatter' as const,
                mode: 'lines' as const,
                name: benchmarks.find(b => b.symbol === selectedBenchmark)?.name || selectedBenchmark,
                line: { color: '#dc2626', width: 2, dash: 'dash' }
              }] : [])
            ]}
            layout={{
              autosize: true,
              height: 400,
              margin: { l: 60, r: 30, t: 30, b: 60 },
              xaxis: { title: 'Date' },
              yaxis: { title: 'Indexed Performance (%)' },
              legend: { x: 0, y: 1 },
              hovermode: 'x unified'
            }}
            useResizeHandler
            className="w-full"
          />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="mb-2">No performance data available</p>
              <p className="text-sm">Add some holdings to see your portfolio performance</p>
            </div>
          </div>
        )}
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Market Overview</h2>
          {marketData.length > 0 ? (
            <div className="space-y-3">
              {marketData.map((stock) => (
                <div key={stock.symbol} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <div className="font-semibold text-blue-600">{stock.symbol}</div>
                    <div className="text-sm text-gray-600">${stock.price?.toFixed(2)}</div>
                  </div>
                  <div className={`text-right ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <div className="font-semibold">
                      {stock.change >= 0 ? '+' : ''}${stock.change?.toFixed(2)}
                    </div>
                    <div className="text-sm">
                      {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Loading market data...</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a 
              href="/portfolio" 
              className="block w-full btn-primary text-center"
            >
              Manage Portfolio
            </a>
            <a 
              href="/analytics" 
              className="block w-full btn-secondary text-center"
            >
              View Analytics
            </a>
            <button 
              className="block w-full btn-secondary text-center"
              onClick={() => {
                // Add cash contribution modal would go here
                alert('Cash contribution feature coming soon!')
              }}
            >
              Add Cash
            </button>
            <a 
              href="/news" 
              className="block w-full btn-secondary text-center"
            >
              Portfolio News
            </a>
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      {portfolioSummary.topPerformer && (
        <div className="mt-8 card">
          <h2 className="text-xl font-semibold mb-4">Performance Highlights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-600">Top Performer</div>
              <div className="text-lg font-semibold text-green-600">
                {portfolioSummary.topPerformer}
              </div>
              <div className="text-sm text-green-600">
                +${portfolioSummary.topPerformerGain.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Average Return</div>
              <div className={`text-lg font-semibold ${portfolioSummary.totalGainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioSummary.totalGainLossPercent >= 0 ? '+' : ''}{portfolioSummary.totalGainLossPercent.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Total Holdings</div>
              <div className="text-lg font-semibold text-gray-900">
                {portfolioSummary.holdingsCount} stocks
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 