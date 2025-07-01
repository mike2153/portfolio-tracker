'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User, DividendByStock } from '@/types'

interface DividendPayment {
  id: number
  ex_date: string
  payment_date: string
  amount_per_share: number
  total_amount: number
  confirmed_received: boolean
  holding__ticker: string
  holding__company_name: string
}

interface DividendSummary {
  total_confirmed_dividends: number
  total_records: number
  confirmed_records: number
}

export default function DividendsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [dividends, setDividends] = useState<DividendPayment[]>([])
  const [summary, setSummary] = useState<DividendSummary>({
    total_confirmed_dividends: 0,
    total_records: 0,
    confirmed_records: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filters
  const [selectedTicker, setSelectedTicker] = useState('')
  const [showConfirmedOnly, setShowConfirmedOnly] = useState(false)
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())

  // Get unique tickers and years for filtering
  const uniqueTickers = useMemo(() => {
    return [...new Set(dividends.map(d => d.holding__ticker))].sort();
  }, [dividends]);

  const uniqueYears = useMemo(() => {
    return [...new Set(dividends.map(d => new Date(d.ex_date).getFullYear().toString()))].sort().reverse();
  }, [dividends]);

  const fetchDividends = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      if (selectedTicker) params.append('ticker', selectedTicker)
      if (showConfirmedOnly) params.append('confirmed_only', 'true')

      // Note: Dividends API needs to be implemented in backend
      // For now, show empty state with message
      console.log('[DividendsPage] Dividends API not yet implemented');
      setDividends([]);
      setSummary({ total_confirmed_dividends: 0, total_records: 0, confirmed_records: 0 });
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dividends')
    } finally {
      setLoading(false)
    }
  }, [user, selectedTicker, showConfirmedOnly])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      fetchDividends()
    }
  }, [user, fetchDividends])

  const confirmDividend = async (_dividendId: number, _exDate: string, _confirmed: boolean) => {
    try {
      // Note: Dividend confirmation API needs to be implemented in backend
      console.log('[DividendsPage] Dividend confirmation API not yet implemented');
      alert('Dividend confirmation feature is being migrated and will be available soon.');
      return;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update dividend')
    }
  }

  // Filter dividends by year
  const filteredDividends = dividends.filter(dividend => {
    if (selectedYear === 'all') return true
    return new Date(dividend.ex_date).getFullYear().toString() === selectedYear
  })

  // Group dividends by stock
  const dividendsByStock = filteredDividends.reduce((acc, dividend) => {
    const ticker = dividend.holding__ticker
    if (!acc[ticker]) {
      acc[ticker] = {
        ticker,
        company_name: dividend.holding__company_name,
        total_annual: 0,
        dividends: [],
        total_amount: 0,
        confirmed_amount: 0
      }
    }
    
    acc[ticker].dividends.push(dividend)
    acc[ticker].total_amount += Number(dividend.total_amount) || 0
    if (dividend.confirmed_received) {
      acc[ticker].confirmed_amount += Number(dividend.total_amount) || 0
    }
    
    return acc
          }, {} as Record<string, DividendByStock>)

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading dividends...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Dividend Tracker</h1>
          <p className="text-gray-600 mb-8">Please sign in to view your dividend history</p>
          <a href="/auth" className="btn-primary">Sign In</a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dividend Tracker</h1>
        <p className="text-gray-600">Track and confirm your dividend payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="metric-card">
          <div className="metric-value text-green-600">${summary.total_confirmed_dividends.toFixed(2)}</div>
          <div className="metric-label">Confirmed Dividends</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.confirmed_records}</div>
          <div className="metric-label">Confirmed Payments</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{summary.total_records}</div>
          <div className="metric-label">Total Dividend Records</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stocks</option>
              {uniqueTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Years</option>
              {uniqueYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showConfirmedOnly}
                onChange={(e) => setShowConfirmedOnly(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Confirmed Only</span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Dividends by Stock */}
      {Object.keys(dividendsByStock).length > 0 ? (
        <div className="space-y-6">
          {Object.values(dividendsByStock).map((stock: any) => (
            <div key={stock.ticker} className="card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-blue-600">{stock.ticker}</h3>
                  <p className="text-gray-600">{stock.company_name}</p>
                </div>
                <div className="text-right mt-2 sm:mt-0">
                  <div className="text-lg font-semibold text-green-600">
                    ${(Number(stock.confirmed_amount) || 0).toFixed(2)} confirmed
                  </div>
                  <div className="text-sm text-gray-600">
                    ${(Number(stock.total_amount) || 0).toFixed(2)} total
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-300">Ex-Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-300">Payment Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-300">Per Share</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-300">Total Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-300">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-300">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.dividends
                      .sort((a: DividendPayment, b: DividendPayment) => 
                        new Date(b.ex_date).getTime() - new Date(a.ex_date).getTime())
                      .map((dividend: DividendPayment) => (
                      <tr key={dividend.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-gray-100">{new Date(dividend.ex_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-gray-100">{new Date(dividend.payment_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-gray-100">${dividend.amount_per_share.toFixed(4)}</td>
                        <td className="py-3 px-4 font-semibold text-gray-100">${dividend.total_amount.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            dividend.confirmed_received
                              ? 'bg-green-800/40 text-green-200'
                              : 'bg-yellow-800/40 text-yellow-200'
                          }`}>
                            {dividend.confirmed_received ? 'Confirmed' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => confirmDividend(
                              dividend.id, 
                              dividend.ex_date, 
                              !dividend.confirmed_received
                            )}
                            className={`text-sm font-medium ${
                              dividend.confirmed_received
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {dividend.confirmed_received ? 'Unconfirm' : 'Confirm'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Dividends Found</h3>
            <p className="text-gray-600 mb-4">
              {filteredDividends.length === 0 && dividends.length > 0
                ? 'No dividends match your current filters.'
                : 'No dividend payments have been detected yet. Add some dividend-paying stocks to your portfolio to start tracking.'}
            </p>
            {filteredDividends.length === 0 && dividends.length > 0 && (
              <button
                onClick={() => {
                  setSelectedTicker('')
                  setSelectedYear('all')
                  setShowConfirmedOnly(false)
                }}
                className="btn-secondary"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Cash Contribution Modal would go here */}
      <div className="mt-8 text-center">
        <button
          onClick={() => alert('Cash contribution feature coming soon!')}
          className="btn-primary"
        >
          Add Cash Contribution
        </button>
      </div>
    </div>
  )
} 