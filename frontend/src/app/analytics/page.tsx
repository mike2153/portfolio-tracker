"use client";

import React, { useState } from 'react';
import GradientText from '@/components/ui/GradientText';
// import { useQuery } from '@tanstack/react-query';
// import { front_api_client } from '@/lib/front_api_client';
import { useSessionPortfolio } from '@/hooks/useSessionPortfolio';

// Components
import AnalyticsKPIGrid from './components/AnalyticsKPIGrid';
import { LazyAnalyticsHoldingsTable, LazyAnalyticsDividendsTab } from '../dashboard/components/LazyComponents';

// Types
interface AnalyticsSummary {
  portfolio_value: number;
  total_profit: number;
  total_profit_percent: number;
  irr_percent: number;
  passive_income_ytd: number;
  cash_balance: number;
  dividend_summary: {
    total_received: number;
    total_pending: number;
    ytd_received: number;
    confirmed_count: number;
    pending_count: number;
  };
}

type TabType = 'holdings' | 'general' | 'dividends' | 'returns';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('holdings');
  const [includeSoldHoldings, setIncludeSoldHoldings] = useState(false);

  // Use full portfolio data instead of just allocation data
  const { portfolioData, allocationData, isLoading: allocationLoading, error: allocationError, refetch } = useSessionPortfolio();
  
  // Force refetch on mount to ensure fresh data
  React.useEffect(() => {
    console.log('[AnalyticsPage] Mounted, forcing data refresh');
    refetch();
  }, [refetch]);

  console.log('[AnalyticsPage] Allocation data:', allocationData);
  console.log('[AnalyticsPage] Loading:', allocationLoading, 'Error:', allocationError);

  // Transform portfolio holdings data to analytics format (use portfolio holdings instead of allocation)
  const holdingsData = portfolioData?.holdings?.map(holding => {
    console.log('[AnalyticsPage] Processing holding:', {
      symbol: holding.symbol,
      current_value: holding.current_value,
      quantity: holding.quantity,
      avg_cost: holding.avg_cost
    });
    
    const costBasis = (holding.quantity || 0) * (holding.avg_cost || 0);
    const gainLoss = (holding.current_value || 0) - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    
    return {
      symbol: holding.symbol,
      company: holding.symbol + ' Corporation', // TODO: Add real company names
      quantity: holding.quantity || 0,
      current_price: holding.current_price || 0,
      current_value: holding.current_value || 0,
      cost_basis: costBasis,
      unrealized_gain: gainLoss,
      unrealized_gain_percent: gainLossPercent,
      realized_pnl: 0, // TODO: Add realized P&L data
      dividends_received: holding.dividends_received || 0,
      total_profit: gainLoss + (holding.dividends_received || 0),
      total_profit_percent: costBasis > 0 ? ((gainLoss + (holding.dividends_received || 0)) / costBasis * 100) : 0,
      daily_change: 0, // TODO: Add daily change data
      daily_change_percent: 0, // TODO: Add daily change percent
      irr_percent: 0 // TODO: Calculate IRR
    };
  }) || [];

  // Create summary data from portfolio data
  const summaryData: AnalyticsSummary | undefined = portfolioData ? {
    portfolio_value: portfolioData.total_value || 0,
    total_profit: portfolioData.total_gain_loss || 0,
    total_profit_percent: portfolioData.total_gain_loss_percent || 0,
    irr_percent: 0, // TODO: Calculate IRR
    passive_income_ytd: 0, // TODO: Calculate from dividend data
    cash_balance: 0, // TODO: Implement cash tracking
    dividend_summary: {
      total_received: 0, // TODO: Calculate from dividend data
      total_pending: 0,
      ytd_received: 0,
      confirmed_count: 0,
      pending_count: 0
    }
  } : undefined;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'holdings':
      case 'returns':
        console.log('[AnalyticsPage] Passing to AnalyticsHoldingsTable:', {
          holdingsCount: holdingsData?.length,
          firstHolding: holdingsData?.[0],
          isLoading: allocationLoading
        });
        return (
          <LazyAnalyticsHoldingsTable
            holdings={holdingsData || []}
            isLoading={allocationLoading}
            error={allocationError}
            includeSoldHoldings={includeSoldHoldings}
            onToggleSoldHoldings={setIncludeSoldHoldings}
          />
        );
      
      case 'dividends':
        return <LazyAnalyticsDividendsTab />;
      
      case 'general':
        return (
          <div className="bg-[#1a1f2e] border border-[#30363D] rounded-xl p-8 text-center">
            <h3 className="text-xl font-semibold text-white mb-4">General Analytics</h3>
            <p className="text-[#8B949E]">Coming soon - General analytics and insights</p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <GradientText className="text-3xl font-bold mb-2">Analytics</GradientText>
          <p className="text-[#8B949E]">Comprehensive portfolio analysis and dividend tracking</p>
        </div>

        {/* KPI Cards - Only show for non-dividend tabs */}
        {activeTab !== 'dividends' && (
          <div className="mb-8">
            <AnalyticsKPIGrid
              {...(summaryData && { summary: summaryData })}
              isLoading={allocationLoading}
              error={allocationError}
            />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-[#30363D]">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'holdings', label: 'My Holdings', icon: '📊' },
                { id: 'general', label: 'General', icon: '📈' },
                { id: 'dividends', label: 'Dividends', icon: '💰' },
                { id: 'returns', label: 'Returns', icon: '📊' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-[#8B949E] hover:text-white hover:border-[#30363D]'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}