'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User, CacheStatistics } from '@/types'
import AdvancedFinancialsComponent from '@/components/AdvancedFinancials'
import PortfolioOptimization from '@/components/PortfolioOptimization'
import PriceAlerts from '@/components/PriceAlerts'
import dynamic from 'next/dynamic'
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Target, 
  Bell, 
  Database,
  Activity,
  Shield,
  Zap,
  RefreshCw,
  Search
} from 'lucide-react'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface TabConfig {
  id: string
  label: string
  icon: React.ReactNode
  component: React.ReactNode
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [cacheStats, setCacheStats] = useState<CacheStatistics | null>(null)
  const [searchSymbol, setSearchSymbol] = useState('')

  useEffect(() => {
    checkUser()
    fetchCacheStatistics()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setLoading(false)
  }

  const fetchCacheStatistics = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/cache/stats')
      if (response.ok) {
        const responseData = await response.json()
        if (responseData && responseData.data) {
          setCacheStats(responseData.data)
        }
      }
    } catch (error) {
      console.error('Error fetching cache statistics:', error)
    }
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Advanced Analytics</h1>
          <p className="text-gray-600 mb-8">Please sign in to view comprehensive portfolio analytics</p>
          <a href="/auth" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Sign In
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading advanced analytics...</p>
        </div>
      </div>
    )
  }

  const tabs: TabConfig[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <BarChart3 className="w-4 h-4" />,
      component: <OverviewTab cacheStats={cacheStats} />
    },
    {
      id: 'optimization',
      label: 'Portfolio Optimization',
      icon: <Target className="w-4 h-4" />,
      component: <PortfolioOptimization userId={user.id} />
    },
    {
      id: 'alerts',
      label: 'Price Alerts',
      icon: <Bell className="w-4 h-4" />,
      component: <PriceAlerts userId={user.id} />
    },
    {
      id: 'financials',
      label: 'Advanced Financials',
      icon: <Activity className="w-4 h-4" />,
      component: (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Analysis</h3>
            <div className="flex space-x-4">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                  placeholder="Enter stock ticker (e.g., AAPL)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => {/* Search handled by component */}}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Search className="w-4 h-4" />
                <span>Analyze</span>
              </button>
            </div>
          </div>
          {searchSymbol && <AdvancedFinancialsComponent symbol={searchSymbol} />}
        </div>
      )
    }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Advanced Analytics</h1>
        <p className="text-gray-600">Comprehensive portfolio analysis and financial insights</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-screen">
        {tabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  )
}

// Overview Tab Component
interface OverviewTabProps {
  cacheStats: CacheStatistics | null
}

function OverviewTab({ cacheStats }: OverviewTabProps) {
  const [refreshing, setRefreshing] = useState(false)

  const refreshCache = async () => {
    setRefreshing(true)
    try {
      // This would trigger a cache refresh in a real implementation
      await new Promise(resolve => setTimeout(resolve, 2000))
    } finally {
      setRefreshing(false)
    }
  }

  if (!cacheStats) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading system statistics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Welcome to Advanced Analytics</h2>
        <p className="text-blue-100 mb-6">
          Your comprehensive financial analysis platform with real-time data, portfolio optimization, 
          and advanced risk assessment tools.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Target className="w-8 h-8 text-white" />
              <div>
                <h3 className="font-semibold">Portfolio Optimization</h3>
                <p className="text-sm text-blue-100">AI-powered recommendations</p>
              </div>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Bell className="w-8 h-8 text-white" />
              <div>
                <h3 className="font-semibold">Price Alerts</h3>
                <p className="text-sm text-blue-100">Real-time monitoring</p>
              </div>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-white" />
              <div>
                <h3 className="font-semibold">Advanced Metrics</h3>
                <p className="text-sm text-blue-100">Deep financial analysis</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cache Statistics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Database className="w-5 h-5 mr-2 text-blue-600" />
              Market Data Cache
            </h3>
            <button
              onClick={refreshCache}
              disabled={refreshing}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center space-x-1"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-900">Daily Prices</p>
                <p className="text-2xl font-bold text-blue-600">
                  {cacheStats.daily_prices.total_records.toLocaleString()}
                </p>
                <p className="text-xs text-blue-700">
                  {cacheStats.daily_prices.unique_symbols} symbols
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm font-medium text-green-900">Fundamentals</p>
                <p className="text-2xl font-bold text-green-600">
                  {cacheStats.fundamentals.total_records.toLocaleString()}
                </p>
                <p className="text-xs text-green-700">
                  {cacheStats.fundamentals.unique_symbols} symbols
                </p>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 space-y-1">
              <p>Latest price data: {new Date(cacheStats.daily_prices.latest_date).toLocaleDateString()}</p>
              <p>Latest fundamentals: {new Date(cacheStats.fundamentals.latest_update).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-600" />
            Quick Actions
          </h3>
          
          <div className="space-y-3">
            <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-between">
              <span>Optimize Portfolio</span>
              <Target className="w-4 h-4" />
            </button>
            
            <button className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white p-3 rounded-lg hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-between">
              <span>Create Price Alert</span>
              <Bell className="w-4 h-4" />
            </button>
            
            <button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white p-3 rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-between">
              <span>Analyze Stock</span>
              <Activity className="w-4 h-4" />
            </button>
            
            <button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-between">
              <span>Risk Assessment</span>
              <Shield className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Advanced Metrics</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Comprehensive financial analysis with TTM calculations, CAGR growth rates, 
            and advanced valuation metrics.
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• P/E, P/B, PEG ratios</li>
            <li>• Financial health indicators</li>
            <li>• Performance metrics</li>
            <li>• Dividend analysis</li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Portfolio Optimization</h3>
          </div>
          <p className="text-gray-600 mb-4">
            AI-powered portfolio analysis with risk assessment, diversification insights, 
            and rebalancing recommendations.
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Risk-return analysis</li>
            <li>• Diversification scoring</li>
            <li>• Rebalancing suggestions</li>
            <li>• New holding recommendations</li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Bell className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Smart Alerts</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Real-time price monitoring with intelligent alert system and 
            comprehensive activity tracking.
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Price threshold alerts</li>
            <li>• Alert statistics</li>
            <li>• Activity monitoring</li>
            <li>• Trigger notifications</li>
          </ul>
        </div>
      </div>

      {/* Performance Overview Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Performance Overview</h3>
        <Plot
          data={[
            {
              x: ['API Calls', 'Cache Hits', 'Cache Misses', 'Alerts Triggered', 'Optimizations Run'],
              y: [1250, 980, 270, 45, 12],
              type: 'bar',
              marker: {
                color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
              },
              text: ['1,250', '980', '270', '45', '12'],
              textposition: 'auto'
            }
          ]}
          layout={{
            height: 300,
            margin: { t: 20, r: 20, b: 60, l: 60 },
            xaxis: { title: 'System Metrics' },
            yaxis: { title: 'Count (Last 7 Days)' },
            showlegend: false,
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent'
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  )
} 