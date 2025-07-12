'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { AdvancedFinancials } from '@/types'
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, BarChart3, PieChart, Activity, Shield } from 'lucide-react'

// Dynamically import ApexChart
const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })

interface AdvancedFinancialsProps {
  symbol: string
}

interface MetricCardProps {
  title: string
  value: number | undefined
  format: 'currency' | 'percentage' | 'number' | 'ratio'
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  description?: string
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, format, icon, trend, description }) => {
  const formatValue = (val: number | undefined) => {
    if (val === undefined || val === null) return 'N/A'
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(val)
      case 'percentage':
        return `${(val * 100).toFixed(2)}%`
      case 'ratio':
        return val.toFixed(2)
      case 'number':
        return new Intl.NumberFormat('en-US').format(val)
      default:
        return val.toString()
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4" />
      case 'down': return <TrendingDown className="w-4 h-4" />
      default: return null
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 hover:shadow-md transition-shadow text-gray-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="text-blue-600">{icon}</div>
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        </div>
        {getTrendIcon() && (
          <div className={getTrendColor()}>{getTrendIcon()}</div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {formatValue(value)}
      </div>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  )
}

export default function AdvancedFinancialsComponent({ symbol }: AdvancedFinancialsProps) {
  const [financials, setFinancials] = useState<AdvancedFinancials | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const fetchAdvancedFinancials = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/stocks/${symbol}/advanced_financials`)
      if (!response.ok) {
        throw new Error('Failed to fetch advanced financials')
      }
      
      const data = await response.json()
      setFinancials(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [symbol])

  // Fetch advanced financials on component mount
  useEffect(() => {
    fetchAdvancedFinancials();
  }, [fetchAdvancedFinancials]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading advanced financial metrics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  if (!financials) {
    return (
      <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400">No financial data available for {symbol}</p>
      </div>
    )
  }

  // Prepare data for charts
  const valuationData = [
    { metric: 'P/E Ratio', value: financials.valuation.pe_ratio || 0 },
    { metric: 'P/B Ratio', value: financials.valuation.pb_ratio || 0 },
    { metric: 'PEG Ratio', value: financials.valuation.peg_ratio || 0 },
    { metric: 'EV/EBITDA', value: financials.valuation.ev_to_ebitda || 0 }
  ]

  const profitabilityData = [
    { metric: 'Gross Margin', value: (financials.profitability.gross_margin || 0) * 100 },
    { metric: 'Operating Margin', value: (financials.profitability.operating_margin || 0) * 100 },
    { metric: 'Net Margin', value: (financials.profitability.net_profit_margin || 0) * 100 }
  ]

  const performanceData = [
    { metric: 'Revenue Growth (YoY)', value: (financials.performance.revenue_growth_yoy || 0) * 100 },
    { metric: 'Revenue Growth (5Y CAGR)', value: (financials.performance.revenue_growth_5y_cagr || 0) * 100 },
    { metric: 'EPS Growth (YoY)', value: (financials.performance.eps_growth_yoy || 0) * 100 },
    { metric: 'EPS Growth (5Y CAGR)', value: (financials.performance.eps_growth_5y_cagr || 0) * 100 }
  ]

  const getChangeColor = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'text-gray-600'
    if (value > 0) return 'text-green-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Advanced Financial Analysis</h2>
        <p className="text-blue-100">Comprehensive financial metrics for {symbol}</p>
        {financials.source && (
          <div className="mt-4 flex items-center space-x-2 text-sm">
            <span className="bg-gray-800/40 px-2 py-1 rounded">
              Source: {financials.source === 'cache' ? 'Cached Data' : 'Live Data'}
            </span>
            {financials.cache_age_hours && (
              <span className="bg-gray-800/40 px-2 py-1 rounded">
                Updated: {financials.cache_age_hours}h ago
              </span>
            )}
          </div>
        )}
      </div>

      {/* Valuation Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2 text-green-600" />
          Valuation Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Market Cap"
            value={financials.valuation.market_capitalization}
            format="currency"
            icon={<DollarSign className="w-4 h-4" />}
            description="Total market value"
          />
          <MetricCard
            title="P/E Ratio"
            value={financials.valuation.pe_ratio}
            format="ratio"
            icon={<BarChart3 className="w-4 h-4" />}
            description="Price to earnings"
          />
          <MetricCard
            title="P/B Ratio"
            value={financials.valuation.pb_ratio}
            format="ratio"
            icon={<BarChart3 className="w-4 h-4" />}
            description="Price to book value"
          />
          <MetricCard
            title="PEG Ratio"
            value={financials.valuation.peg_ratio}
            format="ratio"
            icon={<TrendingUp className="w-4 h-4" />}
            description="P/E to growth ratio"
          />
          <MetricCard
            title="EV/EBITDA"
            value={financials.valuation.ev_to_ebitda}
            format="ratio"
            icon={<BarChart3 className="w-4 h-4" />}
            description="Enterprise value multiple"
          />
          <MetricCard
            title="Dividend Yield"
            value={financials.valuation.dividend_yield}
            format="percentage"
            icon={<DollarSign className="w-4 h-4" />}
            description="Annual dividend rate"
          />
        </div>

        {/* Valuation Ratios Chart */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
          <h4 className="text-md font-medium text-gray-100 mb-4">Valuation Ratios</h4>
          {/* <Plot
            data={[
              {
                x: valuationData.map(d => d.metric),
                y: valuationData.map(d => d.value),
                type: 'bar',
                marker: {
                  color: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B']
                },
                text: valuationData.map(d => d.value.toFixed(2)),
                textposition: 'auto'
              }
            ]}
            layout={{
              height: 300,
              margin: { t: 20, r: 20, b: 80, l: 60 },
              xaxis: { title: 'Metrics' },
              yaxis: { title: 'Ratio' },
              showlegend: false,
              plot_bgcolor: 'transparent',
              paper_bgcolor: 'transparent'
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          */}
          <div className="text-center text-gray-400 py-8">Chart temporarily disabled during ApexCharts migration</div>
        </div>
      </div>

      {/* Financial Health */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-blue-600" />
          Financial Health
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Current Ratio"
            value={financials.financial_health.current_ratio}
            format="ratio"
            icon={<Shield className="w-4 h-4" />}
            description="Liquidity measure"
          />
          <MetricCard
            title="Debt-to-Equity"
            value={financials.financial_health.debt_to_equity_ratio}
            format="ratio"
            icon={<BarChart3 className="w-4 h-4" />}
            description="Financial leverage"
          />
          <MetricCard
            title="Interest Coverage"
            value={financials.financial_health.interest_coverage_ratio}
            format="ratio"
            icon={<Shield className="w-4 h-4" />}
            description="Debt service ability"
          />
          <MetricCard
            title="Free Cash Flow (TTM)"
            value={financials.financial_health.free_cash_flow_ttm}
            format="currency"
            icon={<DollarSign className="w-4 h-4" />}
            description="Cash generation"
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
          Performance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Revenue Growth (YoY)"
            value={financials.performance.revenue_growth_yoy}
            format="percentage"
            icon={<TrendingUp className="w-4 h-4" />}
            trend={financials.performance.revenue_growth_yoy && financials.performance.revenue_growth_yoy > 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="Revenue Growth (5Y CAGR)"
            value={financials.performance.revenue_growth_5y_cagr}
            format="percentage"
            icon={<TrendingUp className="w-4 h-4" />}
            trend={financials.performance.revenue_growth_5y_cagr && financials.performance.revenue_growth_5y_cagr > 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="EPS Growth (YoY)"
            value={financials.performance.eps_growth_yoy}
            format="percentage"
            icon={<Activity className="w-4 h-4" />}
            trend={financials.performance.eps_growth_yoy && financials.performance.eps_growth_yoy > 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="EPS Growth (5Y CAGR)"
            value={financials.performance.eps_growth_5y_cagr}
            format="percentage"
            icon={<Activity className="w-4 h-4" />}
            trend={financials.performance.eps_growth_5y_cagr && financials.performance.eps_growth_5y_cagr > 0 ? 'up' : 'down'}
          />
          <MetricCard
            title="Return on Equity (TTM)"
            value={financials.performance.return_on_equity_ttm}
            format="percentage"
            icon={<BarChart3 className="w-4 h-4" />}
            description="ROE efficiency"
          />
          <MetricCard
            title="Return on Assets (TTM)"
            value={financials.performance.return_on_assets_ttm}
            format="percentage"
            icon={<BarChart3 className="w-4 h-4" />}
            description="ROA efficiency"
          />
        </div>

        {/* Performance Growth Chart */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
          <h4 className="text-md font-medium text-gray-100 mb-4">Growth Metrics (%)</h4>
          {/* <Plot
            data={[
              {
                x: performanceData.map(d => d.metric),
                y: performanceData.map(d => d.value),
                type: 'bar',
                marker: {
                  color: performanceData.map(d => d.value >= 0 ? '#10B981' : '#EF4444')
                },
                text: performanceData.map(d => `${d.value.toFixed(1)}%`),
                textposition: 'auto'
              }
            ]}
            layout={{
              height: 300,
              margin: { t: 20, r: 20, b: 100, l: 60 },
              xaxis: { title: 'Growth Metrics', tickangle: -45 },
              yaxis: { title: 'Percentage (%)' },
              showlegend: false,
              plot_bgcolor: 'transparent',
              paper_bgcolor: 'transparent'
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          */}
          <div className="text-center text-gray-400 py-8">Chart temporarily disabled during ApexCharts migration</div>
        </div>
      </div>

      {/* Profitability */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <PieChart className="w-5 h-5 mr-2 text-purple-600" />
          Profitability
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="grid grid-cols-1 gap-4">
            <MetricCard
              title="Gross Margin"
              value={financials.profitability.gross_margin}
              format="percentage"
              icon={<PieChart className="w-4 h-4" />}
              description="Revenue after COGS"
            />
            <MetricCard
              title="Operating Margin"
              value={financials.profitability.operating_margin}
              format="percentage"
              icon={<PieChart className="w-4 h-4" />}
              description="Operating efficiency"
            />
            <MetricCard
              title="Net Profit Margin"
              value={financials.profitability.net_profit_margin}
              format="percentage"
              icon={<PieChart className="w-4 h-4" />}
              description="Bottom line profitability"
            />
          </div>

          {/* Profitability Margins Chart */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
            <h4 className="text-md font-medium text-gray-100 mb-4">Profit Margins</h4>
            {/* <Plot
              data={[
                {
                  labels: profitabilityData.map(d => d.metric),
                  values: profitabilityData.map(d => d.value),
                  type: 'pie',
                  marker: {
                    colors: ['#3B82F6', '#8B5CF6', '#10B981']
                  },
                  textinfo: 'label+percent',
                  textposition: 'auto'
                }
              ]}
              layout={{
                height: 300,
                margin: { t: 20, r: 20, b: 20, l: 20 },
                showlegend: false,
                plot_bgcolor: 'transparent',
                paper_bgcolor: 'transparent'
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            */}
            <div className="text-center text-gray-400 py-8">Chart temporarily disabled during ApexCharts migration</div>
          </div>
        </div>
      </div>

      {/* Dividend & Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            Dividend Analysis
          </h3>
          <div className="space-y-4">
            <MetricCard
              title="Dividend Payout Ratio"
              value={financials.dividends.dividend_payout_ratio}
              format="percentage"
              icon={<DollarSign className="w-4 h-4" />}
              description="% of earnings paid as dividends"
            />
            <MetricCard
              title="Dividend Growth (3Y CAGR)"
              value={financials.dividends.dividend_growth_rate_3y_cagr}
              format="percentage"
              icon={<TrendingUp className="w-4 h-4" />}
              description="Dividend growth rate"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-orange-600" />
            Risk Indicators
          </h3>
          <div className="space-y-4">
            <MetricCard
              title="Beta"
              value={financials.raw_data_summary.beta}
              format="ratio"
              icon={<Activity className="w-4 h-4" />}
              description="Market risk relative to S&P 500"
            />
            <MetricCard
              title="EPS (TTM)"
              value={financials.raw_data_summary.eps_ttm}
              format="currency"
              icon={<BarChart3 className="w-4 h-4" />}
              description="Earnings per share"
            />
          </div>
        </div>
      </div>
    </div>
  )
}