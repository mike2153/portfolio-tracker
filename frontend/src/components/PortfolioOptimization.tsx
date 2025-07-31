'use client'

import { useState, useEffect, useCallback } from 'react'
// dynamic import removed
import GradientText from '@/components/ui/GradientText'
import { 
  PortfolioOptimizationAnalysis
} from '@/types'
import { 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  PieChart, 
  BarChart3, 
  Shield, 
  Zap,
  ChevronRight,
  Info
} from 'lucide-react'

// Plotly removed for bundle size optimization

interface PortfolioOptimizationProps {
  userId: string
}

interface RiskGaugeProps {
  value: number
  max: number
  title: string
  description: string
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ value, max, title, description }) => {
  const percentage = (value / max) * 100
  const getColor = () => {
    if (percentage <= 30) return 'bg-green-500' // Green
    if (percentage <= 70) return 'bg-yellow-500' // Yellow
    return 'bg-red-500' // Red
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
      <h4 className="text-sm font-medium text-gray-300 mb-2">{title}</h4>
      <div className="relative h-32 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full border-8 border-gray-700 relative flex items-center justify-center">
          <div className={`absolute inset-2 rounded-full ${getColor()}`} style={{opacity: 0.3}}></div>
          <div className="text-2xl font-bold text-white">{value.toFixed(1)}</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2">{description}</p>
    </div>
  )
}

export default function PortfolioOptimization({ userId }: PortfolioOptimizationProps) {
  const [analysis, setAnalysis] = useState<PortfolioOptimizationAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'overview' | 'diversification' | 'risk' | 'recommendations'>('overview')

  const fetchOptimizationAnalysis = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/portfolios/${userId}/optimization`)
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio optimization analysis')
      }
      
      const responseData = await response.json()
      if (responseData && responseData.analysis) {
        setAnalysis(responseData.analysis)
      } else {
        // Handle cases where the API responds with success but no analysis data
        setAnalysis(null);
        setError('No analysis data returned from the server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analysis')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Fetch optimization analysis on component mount
  useEffect(() => {
    fetchOptimizationAnalysis();
  }, [fetchOptimizationAnalysis]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Analyzing your portfolio...</p>
          <p className="text-sm text-gray-400">This may take a few moments</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-600">No portfolio data available for analysis</p>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'diversification', label: 'Diversification', icon: <PieChart className="w-4 h-4" /> },
    { id: 'risk', label: 'Risk Assessment', icon: <Shield className="w-4 h-4" /> },
    { id: 'recommendations', label: 'Recommendations', icon: <Target className="w-4 h-4" /> }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
        <GradientText className="text-2xl font-bold mb-2">Portfolio Optimization Analysis</GradientText>
        <p className="text-purple-100">Advanced analytics and recommendations for your portfolio</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="block text-purple-200">Total Value</span>
            <span className="text-lg font-semibold">
              ${analysis.portfolio_metrics.total_value.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="block text-purple-200">Holdings</span>
            <span className="text-lg font-semibold">{analysis.total_holdings}</span>
          </div>
          <div>
            <span className="block text-purple-200">Sharpe Ratio</span>
            <span className="text-lg font-semibold">
              {analysis.portfolio_metrics.sharpe_ratio.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="block text-purple-200">Risk Score</span>
            <span className="text-lg font-semibold">
              {analysis.risk_assessment.overall_risk_score.toFixed(1)}/10
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Portfolio Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Expected Return</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(analysis.portfolio_metrics.expected_return * 100).toFixed(2)}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Volatility</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {(analysis.portfolio_metrics.volatility * 100).toFixed(2)}%
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Beta</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {analysis.portfolio_metrics.beta.toFixed(2)}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">VaR (95%)</p>
                  <p className="text-2xl font-bold text-red-600">
                    {(analysis.portfolio_metrics.var_95 * 100).toFixed(2)}%
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>

          {/* Holdings Analysis Chart */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Holdings Analysis</h3>
            <div className="h-64 flex items-center justify-center border border-gray-600 rounded bg-gray-800">
              <p className="text-gray-400">Chart temporarily disabled for build optimization</p>
            </div>
            {/* <Plot
              data={[
                {
                  x: analysis.holdings_analysis.map(h => h.ticker),
                  y: analysis.holdings_analysis.map(h => h.weight * 100),
                  type: 'bar',
                  name: 'Portfolio Weight (%)',
                  marker: { color: '#3B82F6' }
                },
                {
                  x: analysis.holdings_analysis.map(h => h.ticker),
                  y: analysis.holdings_analysis.map(h => h.expected_return * 100),
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Expected Return (%)',
                  marker: { color: '#10B981', size: 10 },
                  yaxis: 'y2'
                }
              ]}
              layout={{
                height: 400,
                margin: { t: 20, r: 60, b: 60, l: 60 },
                xaxis: { title: 'Holdings' },
                yaxis: { title: 'Portfolio Weight (%)' },
                yaxis2: {
                  title: 'Expected Return (%)',
                  overlaying: 'y',
                  side: 'right'
                },
                showlegend: true,
                plot_bgcolor: 'transparent',
                paper_bgcolor: 'transparent'
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            */ }
          </div>

          {/* Risk vs Return Scatter */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Risk vs Return Analysis</h3>
            <div className="h-64 flex items-center justify-center border border-gray-600 rounded bg-gray-800">
              <p className="text-gray-400">Chart temporarily disabled for build optimization</p>
            </div>
            {/* <Plot
              data={[
                {
                  x: analysis.holdings_analysis.map(h => h.volatility * 100),
                  y: analysis.holdings_analysis.map(h => h.expected_return * 100),
                  type: 'scatter',
                  mode: 'markers+text',
                  text: analysis.holdings_analysis.map(h => h.ticker),
                  textposition: 'top center',
                  marker: {
                    size: analysis.holdings_analysis.map(h => h.weight * 1000),
                    color: analysis.holdings_analysis.map(h => h.beta),
                    colorscale: 'RdYlBu',
                    colorbar: { title: 'Beta' },
                    line: { width: 1, color: 'white' }
                  }
                }
              ]}
              layout={{
                height: 400,
                margin: { t: 20, r: 20, b: 60, l: 60 },
                xaxis: { title: 'Volatility (%)' },
                yaxis: { title: 'Expected Return (%)' },
                showlegend: false,
                plot_bgcolor: 'transparent',
                paper_bgcolor: 'transparent'
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            */ }
          </div>
        </div>
      )}

      {/* Diversification Tab */}
      {activeTab === 'diversification' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sector Concentration */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Sector Allocation</h3>
              <div className="h-64 flex items-center justify-center border border-gray-600 rounded bg-gray-800">
                <p className="text-gray-400">Chart temporarily disabled for build optimization</p>
              </div>
              {/* <Plot
                data={[
                  {
                    labels: Object.keys(analysis.diversification.sector_concentration),
                    values: Object.values(analysis.diversification.sector_concentration).map(v => v * 100),
                    type: 'pie',
                    marker: {
                      colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
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
              */ }
            </div>

            {/* Market Cap Concentration */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Market Cap Allocation</h3>
              <div className="h-64 flex items-center justify-center border border-gray-600 rounded bg-gray-800">
                <p className="text-gray-400">Chart temporarily disabled for build optimization</p>
              </div>
              {/* <Plot
                data={[
                  {
                    labels: Object.keys(analysis.diversification.market_cap_concentration),
                    values: Object.values(analysis.diversification.market_cap_concentration).map(v => v * 100),
                    type: 'pie',
                    marker: {
                      colors: ['#1E40AF', '#3B82F6', '#60A5FA', '#93C5FD']
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
              */ }
            </div>
          </div>

          {/* Diversification Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Concentration Risk Score</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {analysis.diversification.concentration_risk_score.toFixed(1)}/10
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Herfindahl Index</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {analysis.diversification.herfindahl_index.toFixed(3)}
                  </p>
                </div>
                <PieChart className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Number of Holdings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {analysis.diversification.number_of_holdings}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Assessment Tab */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          {/* Risk Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <RiskGauge
              value={analysis.risk_assessment.overall_risk_score}
              max={10}
              title="Overall Risk Score"
              description="Comprehensive risk assessment"
            />
            <RiskGauge
              value={analysis.risk_assessment.volatility_risk}
              max={10}
              title="Volatility Risk"
              description="Price fluctuation risk"
            />
            <RiskGauge
              value={analysis.risk_assessment.concentration_risk}
              max={10}
              title="Concentration Risk"
              description="Diversification risk"
            />
            <RiskGauge
              value={analysis.risk_assessment.correlation_risk}
              max={10}
              title="Correlation Risk"
              description="Holdings correlation risk"
            />
            <RiskGauge
              value={analysis.risk_assessment.liquidity_risk}
              max={10}
              title="Liquidity Risk"
              description="Asset liquidity risk"
            />
          </div>

          {/* Risk Factors */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
              Risk Factors
            </h3>
            <div className="space-y-3">
              {analysis.risk_assessment.risk_factors.map((factor, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{factor}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Recommendations */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Risk Mitigation Recommendations
            </h3>
            <div className="space-y-3">
              {analysis.risk_assessment.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">{recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          {/* Rebalancing Suggestions */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-green-600" />
              Rebalancing Suggestions
            </h3>
            <div className="space-y-4">
              {analysis.optimization_recommendations.rebalancing_suggestions.map((suggestion, index) => (
                <div key={index} className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-100">{suggestion.ticker}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      suggestion.suggested_action === 'increase' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {suggestion.suggested_action === 'increase' ? 'Increase' : 'Reduce'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
                    <div>Current Weight: {(suggestion.current_weight * 100).toFixed(1)}%</div>
                    <div>Suggested Weight: {(suggestion.suggested_weight * 100).toFixed(1)}%</div>
                  </div>
                  <p className="text-sm text-gray-300">{suggestion.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* New Holdings Suggestions */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-purple-600" />
              Potential New Holdings
            </h3>
            <div className="space-y-4">
              {analysis.optimization_recommendations.potential_new_holdings.map((holding, index) => (
                <div key={index} className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-100">{holding.ticker}</h4>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      {holding.sector}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Suggested Weight: {(holding.suggested_weight * 100).toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-300">{holding.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Other Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
              <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                <PieChart className="w-5 h-5 mr-2 text-blue-600" />
                Diversification Suggestions
              </h3>
              <div className="space-y-3">
                {analysis.optimization_recommendations.diversification_suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800">{suggestion}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-gray-100">
              <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-orange-600" />
                Risk Reduction Suggestions
              </h3>
              <div className="space-y-3">
                {analysis.optimization_recommendations.risk_reduction_suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                    <ChevronRight className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-orange-800">{suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 