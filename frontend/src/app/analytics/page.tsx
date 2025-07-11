"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { front_api_client } from '@/lib/front_api_client';

// Components
import AnalyticsKPIGrid from './components/AnalyticsKPIGrid';
import AnalyticsHoldingsTable from './components/AnalyticsHoldingsTable';
import AnalyticsDividendsTab from './components/AnalyticsDividendsTab';

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

interface Holding {
  symbol: string;
  quantity: number;
  current_price: number;
  current_value: number;
  cost_basis: number;
  unrealized_gain: number;
  unrealized_gain_percent: number;
  realized_pnl: number;
  dividends_received: number;
  total_profit: number;
  total_profit_percent: number;
  daily_change: number;
  daily_change_percent: number;
  irr_percent: number;
}

type TabType = 'holdings' | 'general' | 'dividends' | 'returns';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('holdings');
  const [includeSoldHoldings, setIncludeSoldHoldings] = useState(false);

  // Fetch analytics summary
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/summary`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch analytics summary');
      const data = await response.json();
      return data.data as AnalyticsSummary;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch holdings data
  const { data: holdingsData, isLoading: holdingsLoading, error: holdingsError } = useQuery({
    queryKey: ['analytics', 'holdings', includeSoldHoldings],
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/holdings?include_sold=${includeSoldHoldings}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch holdings data');
      const data = await response.json();
      return data.data as Holding[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'holdings':
      case 'returns':
        return (
          <AnalyticsHoldingsTable
            holdings={holdingsData || []}
            isLoading={holdingsLoading}
            error={holdingsError}
            includeSoldHoldings={includeSoldHoldings}
            onToggleSoldHoldings={setIncludeSoldHoldings}
          />
        );
      
      case 'dividends':
        return <AnalyticsDividendsTab />;
      
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

        {/* KPI Cards */}
        <div className="mb-8">
          <AnalyticsKPIGrid
            summary={summaryData}
            isLoading={summaryLoading}
            error={summaryError}
          />
        </div>

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