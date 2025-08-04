'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  BarChart3, 
  PieChart, 
  Calculator, 
  List, 
  Loader2, 
  CreditCard, 
  DollarSign,
  Plus
} from 'lucide-react';
import GradientText from '@/components/ui/GradientText';
import { useSessionPortfolio } from '@/hooks/useSessionPortfolio';
import ConsolidatedPerformanceCard from './components/ConsolidatedPerformanceCard';
import EnhancedHoldingsTable from './components/EnhancedHoldingsTable';

// Lazy load heavy components
const LazyTransactionsView = React.lazy(() => 
  import('../transactions/page').then(module => ({
    default: module.default
  }))
);

// Tab configuration with new consolidated structure
const tabs = [
  { id: 'holdings', label: 'Holdings', icon: List, description: 'Portfolio overview and holdings' },
  { id: 'allocations', label: 'Allocations', icon: PieChart, description: 'Asset allocation breakdown' },
  { id: 'transactions', label: 'Transactions', icon: CreditCard, description: 'Transaction history and management' },
  { id: 'rebalance', label: 'Rebalance', icon: Calculator, description: 'Portfolio rebalancing tools' },
];

export default function PortfolioPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('holdings');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle URL parameters for tab switching
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Portfolio data hook
  const { 
    portfolioData, 
    isLoading: portfolioLoading, 
    error: portfolioError,
    refetch 
  } = useSessionPortfolio();

  const handleHoldingClick = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-[#10B981]" />
            <p className="text-[#8B949E]">Loading your portfolio...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <GradientText className="text-2xl font-bold mb-4">Please Log In</GradientText>
            <p className="text-[#8B949E]">You need to be logged in to view your portfolio.</p>
          </div>
        </div>
      </div>
    );
  }

  // Transform portfolio data for components
  const transformedHoldings = portfolioData?.holdings?.map(holding => ({
    symbol: holding.symbol,
    company_name: holding.symbol + ' Corporation', // TODO: Add real company names
    quantity: holding.quantity || 0,
    current_price: holding.current_price || 0,
    current_value: holding.current_value || 0,
    avg_cost: holding.avg_cost || 0,
    unrealized_gain_loss: (holding.current_value || 0) - ((holding.quantity || 0) * (holding.avg_cost || 0)),
    unrealized_gain_loss_percent: holding.avg_cost ? 
      (((holding.current_price || 0) - holding.avg_cost) / holding.avg_cost) * 100 : 0,
    realized_gain_loss: 0, // TODO: Add realized P&L
    total_profit: (holding.current_value || 0) - ((holding.quantity || 0) * (holding.avg_cost || 0)),
    allocation_percent: portfolioData.total_value ? 
      ((holding.current_value || 0) / portfolioData.total_value) * 100 : 0,
    dividend_yield: 0, // TODO: Add dividend data
    daily_change: 0, // TODO: Add daily change
    daily_change_percent: 0 // TODO: Add daily change percent
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#1E3A8A]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-[#F59E0B]/10 rounded-full blur-2xl"></div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-7xl relative z-10">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold gradient-text-green mb-2">Portfolio</h1>
              <p className="text-[#8B949E] text-lg">
                Comprehensive view of your investments and performance
              </p>
            </div>
            <button
              onClick={() => router.push('/transactions?add=true')}
              className="btn-micro px-4 py-2 bg-[#10B981] hover:bg-[#059669] rounded-lg flex items-center gap-2 text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Transaction</span>
            </button>
          </div>

          {/* Portfolio Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-transparent border border-[#30363D] rounded-xl p-6 group relative overflow-hidden transition-all duration-200">
              <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 via-transparent to-[#10B981]/5 
                             opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 rounded-lg bg-[#10B981]/10">
                  <DollarSign className="w-6 h-6 text-[#10B981]" />
                </div>
                <div>
                  <p className="text-sm text-[#8B949E] mb-1">Portfolio Value</p>
                  <p className="text-2xl font-bold gradient-text-green">
                    {portfolioData ? `$${portfolioData.total_value?.toLocaleString() || '0'}` : '---'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-transparent border border-[#30363D] rounded-xl p-6 group relative overflow-hidden transition-all duration-200">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/5 via-transparent to-[#1E3A8A]/5 
                             opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 rounded-lg bg-[#1E3A8A]/10">
                  <BarChart3 className="w-6 h-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <p className="text-sm text-[#8B949E] mb-1">Total Holdings</p>
                  <p className="text-2xl font-bold text-white">
                    {portfolioData?.holdings?.length || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-transparent border border-[#30363D] rounded-xl p-6 group relative overflow-hidden transition-all duration-200">
              <div className={`absolute inset-0 bg-gradient-to-br ${
                (portfolioData?.total_gain_loss || 0) >= 0 ? 'from-[#10B981]/5 to-[#10B981]/5' : 'from-[#EF4444]/5 to-[#EF4444]/5'
              } opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 rounded-lg bg-[#F59E0B]/10">
                  <PieChart className="w-6 h-6 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-sm text-[#8B949E] mb-1">Performance</p>
                  <p className={`text-2xl font-bold ${
                    (portfolioData?.total_gain_loss || 0) >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}>
                    {portfolioData?.total_gain_loss_percent 
                      ? `${portfolioData.total_gain_loss_percent > 0 ? '+' : ''}${portfolioData.total_gain_loss_percent.toFixed(2)}%`
                      : '---'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Tab Navigation with 3D Effects */}
        <div className="mb-8">
          <div className="border-b border-[#30363D]/50">
            <nav className="flex space-x-8 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-200 relative overflow-hidden group ${
                      isActive 
                        ? 'border-[#10B981] text-[#10B981]' 
                        : 'border-transparent text-[#8B949E] hover:text-white hover:border-[#10B981]/50'
                    }`}
                    title={tab.description}
                  >
                    {/* Animated background on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#10B981]/5 to-[#10B981]/10 
                                   opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="hidden sm:inline relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'holdings' && (
            <div className="space-y-8">
              <ConsolidatedPerformanceCard 
                portfolioData={{
                  total_value: portfolioData?.total_value || 0,
                  total_gain_loss: portfolioData?.total_gain_loss || 0,
                  total_gain_loss_percent: portfolioData?.total_gain_loss_percent || 0,
                  total_dividends_received: 0, // TODO: Add dividend data
                  unrealized_gain_loss: portfolioData?.total_gain_loss || 0,
                  realized_gain_loss: 0, // TODO: Add realized gains
                  expected_annual_dividends: 0, // TODO: Calculate expected dividends
                  dividend_yield: 0, // TODO: Calculate dividend yield
                  yield_on_cost: 0 // TODO: Calculate yield on cost
                }}
                isLoading={portfolioLoading}
              />
              
              <div className="bg-transparent border border-[#30363D] rounded-2xl p-6">
                <EnhancedHoldingsTable
                  holdings={transformedHoldings}
                  isLoading={portfolioLoading}
                  onHoldingClick={handleHoldingClick}
                />
              </div>
            </div>
          )}

          {activeTab === 'allocations' && (
            <div className="space-y-8">
              <div className="bg-transparent border border-[#30363D] rounded-2xl p-12 text-center relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 via-transparent to-[#1E3A8A]/5 
                               opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative z-10">
                  <PieChart className="w-16 h-16 mx-auto mb-6 text-[#10B981]" />
                  <h3 className="text-2xl font-semibold gradient-text-green mb-4">Asset Allocation</h3>
                  <p className="text-[#8B949E] mb-8 leading-relaxed">
                    Interactive allocation charts and sector breakdown coming soon
                  </p>
                  <div className="bg-transparent border border-[#30363D] rounded-xl p-6 max-w-2xl mx-auto">
                    <p className="text-sm text-[#8B949E]">
                      This will include pie charts, sector allocation, geographic distribution, 
                      and rebalancing recommendations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Holdings table as fallback */}
              <div className="bg-transparent border border-[#30363D] rounded-2xl p-6 border-t border-[#10B981]/20">
                <EnhancedHoldingsTable
                  holdings={transformedHoldings}
                  isLoading={portfolioLoading}
                  onHoldingClick={handleHoldingClick}
                />
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="bg-transparent border border-[#30363D] rounded-2xl p-6">
              <Suspense fallback={
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto mb-4 text-[#10B981]" />
                  <p className="text-[#8B949E]">Loading transactions...</p>
                </div>
              }>
                <LazyTransactionsView />
              </Suspense>
            </div>
          )}

          {activeTab === 'rebalance' && (
            <div className="bg-transparent border border-[#30363D] rounded-2xl p-12 text-center relative overflow-hidden">
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 via-transparent to-[#1E3A8A]/5 
                             opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <Calculator className="w-16 h-16 mx-auto mb-6 text-[#10B981]" />
                <h3 className="text-2xl font-semibold gradient-text-green mb-4">Portfolio Rebalancing</h3>
                <p className="text-[#8B949E] mb-8 leading-relaxed">
                  Smart rebalancing tools and recommendations coming soon
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  <div className="bg-transparent border border-[#30363D] rounded-xl p-6 text-left group relative overflow-hidden transition-all duration-200">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 via-transparent to-[#10B981]/5 
                                   opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <h4 className="font-medium text-white mb-2 gradient-text-green relative z-10">Target Allocation</h4>
                    <p className="text-sm text-[#8B949E] group-hover:text-gray-300 transition-colors duration-300 relative z-10">
                      Set your ideal asset allocation percentages
                    </p>
                  </div>
                  <div className="bg-transparent border border-[#30363D] rounded-xl p-6 text-left group relative overflow-hidden transition-all duration-200">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/5 via-transparent to-[#1E3A8A]/5 
                                   opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <h4 className="font-medium text-white mb-2 gradient-text-green relative z-10">Rebalancing Actions</h4>
                    <p className="text-sm text-[#8B949E] group-hover:text-gray-300 transition-colors duration-300 relative z-10">
                      Get specific buy/sell recommendations
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Error State */}
        {portfolioError && (
          <div className="bg-transparent border border-[#30363D] rounded-2xl p-6 border border-[#EF4444]/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#EF4444]/5 via-transparent to-[#EF4444]/5"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-[#EF4444] rounded-full"></div>
                <p className="text-[#EF4444] font-medium">Error loading portfolio data</p>
              </div>
              <p className="text-[#8B949E] text-sm mb-4 leading-relaxed">
                {portfolioError.message || 'Please try refreshing the page'}
              </p>
              <button
                onClick={() => refetch()}
                className="px-6 py-3 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] rounded-xl text-white transition-all duration-200"
              >
                <span className="flex items-center gap-2">
                  Retry
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin opacity-0 group-hover:opacity-100"></div>
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}