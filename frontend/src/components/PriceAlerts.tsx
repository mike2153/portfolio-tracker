'use client'

import { useState, useEffect } from 'react'

// Plotly removed for bundle size optimization
import { PriceAlert, AlertStatistics } from '@/types'
import { 
  Bell, 
  BellRing, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Clock,
  Target,
  Activity,
  RefreshCw
} from 'lucide-react'

// Dynamically import Plotly to avoid SSR issues
// const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface PriceAlertsProps {
  userId: string
}

interface CreateAlertFormData {
  ticker: string
  alert_type: 'above' | 'below'
  target_price: number
}

export default function PriceAlerts({ userId }: PriceAlertsProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [statistics, setStatistics] = useState<AlertStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState<CreateAlertFormData>({
    ticker: '',
    alert_type: 'above',
    target_price: 0
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (userId) {
      fetchAlerts()
      fetchStatistics()
    }
  }, [userId])

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/price-alerts/${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch price alerts')
      }
      const data = await response.json()
      setAlerts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    }
  }

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/price-alerts/${userId}/statistics`)
      if (!response.ok) {
        throw new Error('Failed to fetch alert statistics')
      }
      const data = await response.json()
      setStatistics(data)
    } catch (err) {
      console.error('Failed to fetch statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  const createAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/price-alerts/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to create alert')
      }

      await fetchAlerts()
      await fetchStatistics()
      setShowCreateForm(false)
      setFormData({ ticker: '', alert_type: 'above', target_price: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteAlert = async (alertId: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/price-alerts/${userId}/${alertId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete alert')
      }

      await fetchAlerts()
      await fetchStatistics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert')
    }
  }

  const checkAlerts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/price-alerts/${userId}/check`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to check alerts')
      }

      await fetchAlerts()
      await fetchStatistics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check alerts')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && alerts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading price alerts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center">
              <Bell className="w-6 h-6 mr-2" />
              Price Alerts
            </h2>
            <p className="text-blue-100">Monitor your investments with real-time price alerts</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={checkAlerts}
              disabled={loading}
              className="bg-gray-800/50 hover:bg-gray-700/50 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Check Now</span>
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-gray-900 text-blue-300 hover:bg-blue-800 px-4 py-2 rounded-lg flex items-center space-x-2 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Alert</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Alerts</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total_alerts}</p>
              </div>
              <Bell className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                <p className="text-2xl font-bold text-green-600">{statistics.active_alerts}</p>
              </div>
              <BellRing className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Triggered Alerts</p>
                <p className="text-2xl font-bold text-orange-600">{statistics.triggered_alerts}</p>
              </div>
              <Target className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                <p className="text-2xl font-bold text-purple-600">
                  {statistics.recent_activity.triggered_last_24h}
                </p>
                <p className="text-xs text-gray-500">Last 24h</p>
              </div>
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Top Tickers List */}
      {statistics && statistics.top_tickers.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Most Watched Stocks</h3>
          <div className="space-y-2">
            {statistics.top_tickers.slice(0, 5).map((ticker) => (
              <div key={ticker.ticker} className="flex justify-between items-center py-2 px-3 bg-gray-800 rounded">
                <span className="text-gray-100 font-medium">{ticker.ticker}</span>
                <span className="text-blue-400">{ticker.alert_count} alerts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Alert Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md text-gray-100">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Create Price Alert</h3>
            <form onSubmit={createAlert} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Ticker
                </label>
                <input
                  type="text"
                  value={formData.ticker}
                  onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., AAPL"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Type
                </label>
                <select
                  value={formData.alert_type}
                  onChange={(e) => setFormData({ ...formData, alert_type: e.target.value as 'above' | 'below' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="above">Price Above</option>
                  <option value="below">Price Below</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.target_price}
                  onChange={(e) => setFormData({ ...formData, target_price: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Create Alert'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-gray-700 text-gray-200 py-2 px-4 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 text-gray-100">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-gray-100">Your Alerts</h3>
        </div>
        
        {alerts.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No price alerts set up yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Alert</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-6 hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      alert.triggered_at 
                        ? 'bg-orange-100 text-orange-600' 
                        : alert.is_active 
                          ? 'bg-green-100 text-green-600'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {alert.triggered_at ? (
                        <Target className="w-5 h-5" />
                      ) : alert.is_active ? (
                        <BellRing className="w-5 h-5" />
                      ) : (
                        <Clock className="w-5 h-5" />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-100">{alert.ticker}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          alert.alert_type === 'above' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {alert.alert_type === 'above' ? (
                            <TrendingUp className="w-3 h-3 inline mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 inline mr-1" />
                          )}
                          {alert.alert_type} ${alert.target_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Created: {formatDate(alert.created_at)}
                        {alert.triggered_at && (
                          <span className="ml-4">
                            Triggered: {formatDate(alert.triggered_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.triggered_at
                        ? 'bg-orange-800/40 text-orange-200'
                        : alert.is_active
                          ? 'bg-green-800/40 text-green-200'
                          : 'bg-gray-800/40 text-gray-200'
                    }`}>
                      {alert.triggered_at ? 'Triggered' : alert.is_active ? 'Active' : 'Inactive'}
                    </span>
                    
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 