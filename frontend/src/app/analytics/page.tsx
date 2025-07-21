"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { front_api_client } from '@portfolio-tracker/shared';
import { usePortfolioAllocation } from '@/hooks/usePortfolioAllocation';

// Components
import AnalyticsKPIGrid from './components/AnalyticsKPIGrid';
import AnalyticsHoldingsTable from './components/AnalyticsHoldingsTable';
import AnalyticsDividendsTabRefactored from './components/AnalyticsDividendsTabRefactored';

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

  // Use shared allocation hook for consistent data
  const { data: allocationData, isLoading: allocationLoading, error: allocationError, refetch } = usePortfolioAllocation();
  
  // Force refetch on mount to ensure fresh data
  React.useEffect(() => {
    console.log('[AnalyticsPage] Mounted, forcing data refresh');
    refetch();
  }, []);

  console.log('[AnalyticsPage] Allocation data:', allocationData);
  console.log('[AnalyticsPage] Loading:', allocationLoading, 'Error:', allocationError);

  // Transform allocation data to holdings format
  const holdingsData = allocationData?.allocations.map(allocation => {
    console.log('[AnalyticsPage] Processing allocation:', {
      symbol: allocation.symbol,
      cost_basis: allocation.cost_basis,
      current_value: allocation.current_value,
      gain_loss: allocation.gain_loss,
      realized_pnl: allocation.realized_pnl
    });
    return {
    symbol: allocation.symbol,
    quantity: allocation.quantity,
    current_price: allocation.current_price,
    current_value: allocation.current_value,
    cost_basis: allocation.cost_basis,
    unrealized_gain: allocation.gain_loss,
    unrealized_gain_percent: allocation.gain_loss_percent,
    realized_pnl: allocation.realized_pnl ?? 0,
    dividends_received: allocation.dividends_received ?? 0,
    total_profit: allocation.gain_loss + (allocation.dividends_received ?? 0) + (allocation.realized_pnl ?? 0),
    total_profit_percent: allocation.cost_basis > 0 
      ? ((allocation.gain_loss + (allocation.dividends_received ?? 0) + (allocation.realized_pnl ?? 0)) / allocation.cost_basis * 100) 
      : 0,
    daily_change: allocation.daily_change ?? 0,
    daily_change_percent: allocation.daily_change_percent ?? 0,
    irr_percent: 0 // TODO: Calculate IRR
    };
  }) || [];

  // Create summary data from allocation data
  const summaryData: AnalyticsSummary | undefined = allocationData ? {
    portfolio_value: allocationData.summary.total_value,
    total_profit: allocationData.summary.total_gain_loss + allocationData.summary.total_dividends,
    total_profit_percent: allocationData.summary.total_gain_loss_percent,
    irr_percent: 0, // TODO: Calculate IRR
    passive_income_ytd: allocationData.summary.total_dividends,
    cash_balance: 0, // TODO: Implement cash tracking
    dividend_summary: {
      total_received: allocationData.summary.total_dividends,
      total_pending: 0,
      ytd_received: allocationData.summary.total_dividends,
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
          <AnalyticsHoldingsTable
            holdings={holdingsData || []}
            isLoading={allocationLoading}
            error={allocationError}
            includeSoldHoldings={includeSoldHoldings}
            onToggleSoldHoldings={setIncludeSoldHoldings}
          />
        );
      
      case 'dividends':
        return <AnalyticsDividendsTabRefactored />;
      
      case 'general':
        return (
          <div className="bg-gray-800/50 rounded-xl p-8 text-center">
            <h3 className="text-xl font-semibold text-white mb-4">General Analytics</h3>
            <p className="text-gray-400">Coming soon - General analytics and insights</p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
          <p className="text-gray-400">Comprehensive portfolio analysis and dividend tracking</p>
        </div>

        {/* KPI Cards - Only show for non-dividend tabs */}
        {activeTab !== 'dividends' && (
          <div className="mb-8">
            <AnalyticsKPIGrid
              summary={summaryData}
              isLoading={allocationLoading}
              error={allocationError}
            />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-700">
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
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
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