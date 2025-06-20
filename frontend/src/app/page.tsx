'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface HealthStatus {
  status: string
  message: string
  database: string
  symbols_loaded: number
  data_ready: boolean
  external_apis: string
  version: string
}

export default function Home() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [apiStatus, setApiStatus] = useState<string>('Checking...')

  useEffect(() => {
    // Test API connection with health endpoint
    fetch('http://localhost:8000/api/health')
      .then(res => res.json())
      .then((data: HealthStatus) => {
        setHealthStatus(data)
        setApiStatus(data.message)
      })
      .catch(() => {
        setApiStatus('API Connection Failed')
        setHealthStatus(null)
      })
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'configured':
        return 'text-green-600'
      case 'pending_configuration':
        return 'text-yellow-600'
      case 'unhealthy':
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'configured':
        return 'bg-green-500'
      case 'pending_configuration':
        return 'bg-yellow-500'
      case 'unhealthy':
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Professional Financial Analytics Platform
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Advanced portfolio management and analytics for serious investors
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/auth" className="btn-primary">
            Start Free Trial
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            View Demo
          </Link>
        </div>
      </div>

      {/* System Status */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">System Status</h2>
        <p className="text-gray-600 mb-4">
          Backend API: <span className={`font-medium ${getStatusColor(healthStatus?.status || 'error')}`}>{apiStatus}</span>
        </p>
        
        {healthStatus && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusDot(healthStatus.database)}`}></div>
                <span className="text-sm text-gray-600">Database</span>
                <span className={`text-sm font-medium ${getStatusColor(healthStatus.database)}`}>
                  {healthStatus.database}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusDot(healthStatus.data_ready ? 'configured' : 'error')}`}></div>
                <span className="text-sm text-gray-600">Market Data</span>
                <span className={`text-sm font-medium ${getStatusColor(healthStatus.data_ready ? 'configured' : 'error')}`}>
                  {healthStatus.symbols_loaded.toLocaleString()} symbols
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getStatusDot(healthStatus.external_apis)}`}></div>
                <span className="text-sm text-gray-600">External APIs</span>
                <span className={`text-sm font-medium ${getStatusColor(healthStatus.external_apis)}`}>
                  {healthStatus.external_apis}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Version</span>
                <span className="text-sm font-medium text-blue-600">
                  {healthStatus.version}
                </span>
              </div>
            </div>
            
            {!healthStatus.data_ready && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Setup Required:</strong> Run <code className="bg-yellow-100 px-1 rounded">python manage.py load_symbols</code> in the backend to load stock symbols.
                </p>
              </div>
            )}
            
            {healthStatus.external_apis === 'pending_configuration' && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>API Key Required:</strong> Configure FINNHUB_API_KEY in your backend environment for real-time market data.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Link href="/portfolio" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <div className="text-3xl mb-4">📊</div>
          <h3 className="text-lg font-semibold mb-3">Portfolio Management</h3>
          <p className="text-gray-600">
            Add stocks with purchase details, track performance, and manage your entire portfolio in one place.
          </p>
        </Link>
        
        <Link href="/dashboard" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <div className="text-3xl mb-4">📈</div>
          <h3 className="text-lg font-semibold mb-3">Real-time Data</h3>
          <p className="text-gray-600">
            Live market data integration with Finnhub API for up-to-date portfolio valuations and market overview.
          </p>
        </Link>
        
        <Link href="/analytics" className="card hover:shadow-lg transition-shadow cursor-pointer">
          <div className="text-3xl mb-4">🔬</div>
          <h3 className="text-lg font-semibold mb-3">Advanced Analytics</h3>
          <p className="text-gray-600">
            Calculate Sharpe ratio, Alpha, Beta, maximum drawdown, and other professional financial metrics.
          </p>
        </Link>
      </div>

      {/* Live Demo Section */}
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <h2 className="text-2xl font-bold mb-6">Live Portfolio Demo</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="metric-card bg-white">
            <div className="metric-value text-green-600">+12.5%</div>
            <div className="metric-label">Total Return</div>
          </div>
          <div className="metric-card bg-white">
            <div className="metric-value">1.24</div>
            <div className="metric-label">Sharpe Ratio</div>
          </div>
          <div className="metric-card bg-white">
            <div className="metric-value">0.85</div>
            <div className="metric-label">Beta</div>
          </div>
          <div className="metric-card bg-white">
            <div className="metric-value text-red-600">-8.2%</div>
            <div className="metric-label">Max Drawdown</div>
          </div>
        </div>
        
        <div className="text-center">
          <Link href="/auth" className="btn-primary mr-4">
            Sign Up Free
          </Link>
          <Link href="/portfolio" className="btn-secondary">
            Explore Features
          </Link>
        </div>
      </div>

      {/* Features List */}
      <div className="mt-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything You Need</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Stock Purchase Tracking</h3>
                <p className="text-gray-600">Record buy date, quantity, price, and commission for accurate performance calculation.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Real-time Valuation</h3>
                <p className="text-gray-600">Live market prices automatically update your portfolio value and performance metrics.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Professional Metrics</h3>
                <p className="text-gray-600">Calculate industry-standard performance metrics used by professional fund managers.</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Secure Authentication</h3>
                <p className="text-gray-600">Enterprise-grade security powered by Supabase for your financial data.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Cloud Sync</h3>
                <p className="text-gray-600">Access your portfolio from anywhere with automatic cloud synchronization.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Export & Reports</h3>
                <p className="text-gray-600">Generate detailed reports for tax purposes and investment analysis.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 