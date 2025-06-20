'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { FinancialStatements, FinancialReport } from '@/types'
import BalanceSheet from '@/components/BalanceSheet'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface StockOverview {
  Symbol: string
  Name: string
  Description: string
  MarketCapitalization: number
  PERatio: number
  EPS: number
  DividendYield: number
  '52WeekHigh': number
  '52WeekLow': number
  Beta: number
  SharesOutstanding: number
}

interface StockQuote {
  symbol: string
  price: number
  change: number
  change_percent: string
  volume: number
  open: number
  high: number
  low: number
}

interface HistoricalData {
  date: string
  close: number
  adjusted_close: number
  volume: number
  indexed_performance: number
  dividend_amount: number
}

interface NewsItem {
  title: string
  url: string
  time_published: string
  summary: string
  source: string
  sentiment: {
    label: string
    score: number
  }
}

interface StockAnalysisPageProps {
  params: { ticker: string }
}

export default function StockAnalysisPage({ params }: StockAnalysisPageProps) {
  const { ticker } = params
  const router = useRouter()
  
  const [overview, setOverview] = useState<StockOverview | null>(null)
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([])
  const [financials, setFinancials] = useState<FinancialStatements | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // UI state
  const [selectedPeriod, setSelectedPeriod] = useState('1Y')
  const [selectedStatement, setSelectedStatement] = useState('income')
  const [reportType, setReportType] = useState('annual') // 'annual' or 'quarterly'
  const [selectedTab, setSelectedTab] = useState('overview')

  const periods = ['1W', '1M', '3M', '6M', '1Y', '3Y', '5Y']
  const statements = [
    { key: 'income', label: 'Income Statement' },
    { key: 'balance', label: 'Balance Sheet' },
    { key: 'cash_flow', label: 'Cash Flow' }
  ]

  useEffect(() => {
    fetchStockData()
  }, [ticker])

  useEffect(() => {
    if (selectedTab === 'performance') {
      fetchHistoricalData()
    } else if (selectedTab === 'financials') {
      fetchFinancials()
    } else if (selectedTab === 'news') {
      fetchNews()
    }
  }, [selectedTab, selectedPeriod, selectedStatement])

  const fetchStockData = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`http://localhost:8000/api/stocks/${ticker}/overview`)
      if (!response.ok) throw new Error('Failed to fetch stock data')
      
      const data = await response.json()
      setOverview(data.overview)
      setQuote(data.quote)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock data')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/stocks/${ticker}/historical?period=${selectedPeriod}`)
      if (!response.ok) throw new Error('Failed to fetch historical data')
      
      const data = await response.json()
      setHistoricalData(data.data || [])
    } catch (err) {
      console.error('Error fetching historical data:', err)
    }
  }

  const fetchFinancials = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/stocks/${ticker}/financials/${selectedStatement}`)
      if (!response.ok) throw new Error('Failed to fetch financial data')
      
      const data = await response.json()
      setFinancials(data.data)
    } catch (err) {
      console.error('Error fetching financials:', err)
    }
  }

  const fetchNews = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/stocks/${ticker}/news?limit=20`)
      if (!response.ok) throw new Error('Failed to fetch news')
      
      const data = await response.json()
      setNews(data.news || [])
    } catch (err) {
      console.error('Error fetching news:', err)
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    return `$${value?.toLocaleString()}`
  }

  const formatPercent = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return `${num >= 0 ? '+' : ''}${num?.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Stock Data</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => router.back()}
            className="mt-4 btn-secondary"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {quote?.symbol} - {overview?.Name}
            </h1>
          </div>
          {quote && (
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-2xl font-bold">${quote.price?.toFixed(2)}</span>
              <span className={`text-lg font-semibold ${quote.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {quote.change >= 0 ? '+' : ''}${quote.change?.toFixed(2)} ({formatPercent(quote.change_percent)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Grid */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <div className="metric-card">
            <div className="metric-value">{formatCurrency(overview.MarketCapitalization)}</div>
            <div className="metric-label">Market Cap</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{overview.PERatio?.toFixed(1) || 'N/A'}</div>
            <div className="metric-label">P/E Ratio</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">${overview.EPS?.toFixed(2) || 'N/A'}</div>
            <div className="metric-label">EPS</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{(overview.DividendYield * 100)?.toFixed(2) || '0'}%</div>
            <div className="metric-label">Dividend Yield</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">${overview['52WeekHigh']?.toFixed(2)}</div>
            <div className="metric-label">52W High</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">${overview['52WeekLow']?.toFixed(2)}</div>
            <div className="metric-label">52W Low</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{overview.Beta?.toFixed(2) || 'N/A'}</div>
            <div className="metric-label">Beta</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{formatCurrency(overview.SharesOutstanding)}</div>
            <div className="metric-label">Shares Out</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'performance', label: 'Performance' },
            { key: 'financials', label: 'Financials' },
            { key: 'news', label: 'News' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {selectedTab === 'overview' && overview && (
          <div className="prose max-w-none">
            <p>{overview.Description}</p>
          </div>
        )}
        {selectedTab === 'performance' && (
          <div>
            <div className="mb-4 flex justify-end">
              {periods.map(p => (
                <button 
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1 rounded-md text-sm ml-2 ${selectedPeriod === p ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            {historicalData.length > 0 ? (
              <Plot
                data={[
                  {
                    x: historicalData.map(d => d.date),
                    y: historicalData.map(d => d.adjusted_close),
                    type: 'scatter',
                    mode: 'lines',
                    name: ticker,
                  },
                ]}
                layout={{
                  title: `${ticker} Stock Price (${selectedPeriod})`,
                  xaxis: { title: 'Date' },
                  yaxis: { title: 'Price (USD)' },
                  autosize: true,
                }}
                className="w-full h-96"
                useResizeHandler={true}
              />
            ) : <p className="text-center py-10">Loading performance data...</p>}
          </div>
        )}
        {selectedTab === 'financials' && (
          <div>
            <div className="mb-4 border-b">
              {statements.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSelectedStatement(s.key)}
                  className={`px-4 py-2 text-sm font-medium ${selectedStatement === s.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="my-4 flex justify-end space-x-2">
              <button onClick={() => setReportType('annual')} className={`px-3 py-1 rounded-md text-sm ${reportType === 'annual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                Annual
              </button>
              <button onClick={() => setReportType('quarterly')} className={`px-3 py-1 rounded-md text-sm ${reportType === 'quarterly' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                Quarterly
              </button>
            </div>
            {financials ? (
              <div>
                {selectedStatement === 'balance' && <BalanceSheet data={reportType === 'annual' ? financials.annual_reports : financials.quarterly_reports} />}
                {/* Placeholder for other statements */}
                {selectedStatement === 'income' && <p>Income Statement view coming soon...</p>}
                {selectedStatement === 'cash_flow' && <p>Cash Flow view coming soon...</p>}
              </div>
            ) : <p>Loading financial data...</p>}
          </div>
        )}
        {selectedTab === 'news' && (
          <div className="space-y-4">
            {news.length > 0 ? (
              news.map((item, index) => (
                <div key={index} className="card hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-blue-600 hover:text-blue-800">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.sentiment?.label === 'Bullish' ? 'bg-green-100 text-green-800' :
                        item.sentiment?.label === 'Bearish' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.sentiment?.label || 'Neutral'}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-3">{item.summary}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{item.source}</span>
                    <span>{new Date(item.time_published).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="card text-center py-8">
                <p className="text-gray-500">Loading news...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 