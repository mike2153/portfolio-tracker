'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [timePeriod, setTimePeriod] = useState('1Y')
  const [selectedBenchmark, setSelectedBenchmark] = useState('^GSPC')

  const periods = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y']
  const benchmarks = [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^IXIC', name: 'Nasdaq Composite' },
    { symbol: '^DJI', name: 'Dow Jones' },
    { symbol: '^RUT', name: 'Russell 2000' },
    { symbol: 'VTI', name: 'Total Stock Market' }
  ]

  const fetchPortfolioSummary = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`http://localhost:8000/api/portfolios/${user.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Creating default portfolio for user:', user?.id)
          return
        }
        throw new Error('Failed to fetch portfolio')
      }

      const data = await response.json()
      const holdings = data.holdings || []
      const summary = data.summary || { total_value: 0, total_holdings: 0 }
      const cash_balance = data.cash_balance || 0

      let topPerformer = ''
      let topPerformerGain = 0
      holdings.forEach((holding: HoldingData) => {
        if (holding.gain_loss && holding.gain_loss > topPerformerGain) {
          topPerformerGain = holding.gain_loss
          topPerformer = holding.ticker
        }
      })

      setPortfolioSummary({
        totalValue: summary.total_value,
        totalGainLoss: holdings.reduce((sum: number, h: HoldingData) => sum + (h.gain_loss || 0), 0),
        totalGainLossPercent: holdings.length > 0 ?
          (holdings.reduce((sum: number, h: HoldingData) => sum + (h.gain_loss_percent || 0), 0) / holdings.length) : 0,
        topPerformer,
        topPerformerGain,
        holdingsCount: holdings.length,
        cashBalance: cash_balance
      })

    } catch (error) {
      console.error('Error fetching portfolio summary:', error)
    }
  }, [user]);

  const fetchPortfolioPerformance = useCallback(async (period: string) => {
    if (!user?.id) return

    try {
      const response = await fetch(`http://localhost:8000/api/portfolios/${user.id}/performance?period=${period}&benchmark=${selectedBenchmark}`)
      if (!response.ok) return

      const data = await response.json()
      setPortfolioPerformance(data.portfolio_performance || [])
      setBenchmarkPerformance(data.benchmark_performance || [])
      setPerformanceComparison(data.comparison)
    } catch (error) {
      console.error('Error fetching portfolio performance:', error)
    }
  }, [user, selectedBenchmark]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) {
        setLoading(false)
      }
    }
    checkUser()
  }, []);

  useEffect(() => {
    if (user) {
      fetchPortfolioSummary();
      fetchPortfolioPerformance('1Y'); // Default to 1Y performance
    }
  }, [user, fetchPortfolioSummary, fetchPortfolioPerformance]);

  useEffect(() => {
    if (user) {
      fetchPortfolioPerformance(timePeriod);
    }
  }, [timePeriod, user, fetchPortfolioPerformance]);

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
        <p className="text-gray-600">Welcome back, you&apos;re logged in.</p>
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
                  onClick={() => setTimePeriod(period)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    timePeriod === period
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

        {/* Enhanced Quick Actions */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a 
              href="/portfolio" 
              className="flex items-center justify-between w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-blue-900">Manage Portfolio</div>
                  <div className="text-sm text-blue-700">Add, edit, or remove holdings</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            
            <a 
              href="/analytics" 
              className="flex items-center justify-between w-full p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-purple-600 p-2 rounded-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-purple-900">Advanced Analytics</div>
                  <div className="text-sm text-purple-700">AI insights & optimization</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>

            <button 
              className="flex items-center justify-between w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
              onClick={() => {
                window.location.href = '/analytics#alerts'
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="bg-green-600 p-2 rounded-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7l-5 5h5V7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-green-900">Price Alerts</div>
                  <div className="text-sm text-green-700">Set up smart notifications</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button 
              className="flex items-center justify-between w-full p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200"
              onClick={() => {
                window.location.href = '/analytics#optimization'
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="bg-orange-600 p-2 rounded-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-orange-900">Optimize Portfolio</div>
                  <div className="text-sm text-orange-700">AI-powered recommendations</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
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

      {/* AI Insights Preview */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-blue-900">Portfolio Health</h3>
          </div>
          <p className="text-blue-800 mb-4">
            Your portfolio shows strong fundamentals with balanced risk distribution across sectors.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">Risk Score: 6.2/10</span>
            <a href="/analytics#optimization" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View Details →
            </a>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-green-600 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7l-5 5h5V7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-green-900">Active Alerts</h3>
          </div>
          <p className="text-green-800 mb-4">
            You have 3 active price alerts monitoring key positions in your portfolio.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-green-700">2 triggered this week</span>
            <a href="/analytics#alerts" className="text-green-600 hover:text-green-800 text-sm font-medium">
              Manage Alerts →
            </a>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-purple-600 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-purple-900">AI Recommendation</h3>
          </div>
          <p className="text-purple-800 mb-4">
            Consider rebalancing: Technology sector is 15% overweight in your portfolio.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-purple-700">Updated today</span>
            <a href="/analytics#optimization" className="text-purple-600 hover:text-purple-800 text-sm font-medium">
              Optimize Now →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
} 