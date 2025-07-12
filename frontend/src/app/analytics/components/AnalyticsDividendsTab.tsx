"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import ApexListView from '@/components/charts/ApexListView';

interface Dividend {
  id: string;
  symbol: string;
  ex_date: string;
  pay_date: string;
  amount: number;
  currency: string;
  confirmed: boolean;
  current_holdings: number;
  projected_amount?: number;
  created_at: string;
}

interface DividendSummary {
  total_received: number;
  total_pending: number;
  ytd_received: number;
  confirmed_count: number;
  pending_count: number;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getCompanyName = (symbol: string): string => {
  const companies: Record<string, string> = {
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corporation',
    'GOOGL': 'Alphabet Inc.',
    'AMZN': 'Amazon.com Inc.',
    'TSLA': 'Tesla Inc.',
    'NVDA': 'NVIDIA Corporation',
    'META': 'Meta Platforms Inc.',
    'SPY': 'SPDR S&P 500 ETF',
    'QQQ': 'Invesco QQQ Trust',
    'VOO': 'Vanguard S&P 500 ETF',
  };
  return companies[symbol] || symbol;
};

export default function AnalyticsDividendsTab() {
  const [showConfirmedOnly, setShowConfirmedOnly] = useState(false);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const queryClient = useQueryClient();

  // Auto-sync dividends when component loads
  const syncDividendsMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/dividends/sync-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to sync dividends');
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch dividends data after sync
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividends'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividend-summary'] });
      setHasAutoSynced(true);
      console.log('Dividend sync completed:', data);
    },
    onError: (error) => {
      console.error('Dividend sync failed:', error);
      setHasAutoSynced(true); // Don't retry automatically on error
    }
  });

  // Fetch dividends data
  const { data: dividendsData, isLoading: dividendsLoading, error: dividendsError } = useQuery<Dividend[], Error>({
    queryKey: ['analytics', 'dividends', showConfirmedOnly],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/dividends?confirmed_only=${showConfirmedOnly}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch dividends');
      const result = await response.json();
      return result.data as Dividend[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Auto-sync dividends on component mount (only once)
  React.useEffect(() => {
    if (!hasAutoSynced && !syncDividendsMutation.isPending) {
      console.log('Auto-syncing dividends on first load...');
      syncDividendsMutation.mutate();
    }
  }, [hasAutoSynced, syncDividendsMutation]);

  // Fetch dividend summary
  const { data: summaryData } = useQuery<DividendSummary, Error>({
    queryKey: ['analytics', 'dividend-summary'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/summary`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch summary');
      const result = await response.json();
      return result.data.dividend_summary as DividendSummary;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Confirm dividend mutation
  const confirmDividendMutation = useMutation({
    mutationFn: async (dividendId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/dividends/confirm?dividend_id=${dividendId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to confirm dividend');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch dividends data
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividends'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividend-summary'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'holdings'] });
    },
  });

  // Transform dividends data for ApexListView
  const listData = dividendsData?.map(dividend => ({
    id: dividend.id || '',
    symbol: dividend.symbol || '',
    company: getCompanyName(dividend.symbol || ''),
    ex_date: dividend.ex_date || '',
    pay_date: dividend.pay_date || '',
    amount_per_share: (dividend.amount || 0) / (dividend.current_holdings || 1), // Calculate per share from total
    total_amount: dividend.amount || 0, // This is the total calculated amount
    current_holdings: dividend.current_holdings || 0,
    projected_amount: dividend.projected_amount || dividend.amount || 0,
    confirmed: dividend.confirmed || false,
    currency: dividend.currency || 'USD',
    created_at: dividend.created_at || '',
    is_future: dividend.pay_date ? new Date(dividend.pay_date) > new Date() : false,
    is_recent: dividend.created_at ? new Date(dividend.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : false
  })) || [];

  const columns = [
    {
      key: 'company',
      label: 'Company',
      searchable: true,
      sortable: true,
      render: (item: any) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            {item?.symbol?.slice(0, 2) || '??'}
          </div>
          <div>
            <div className="font-semibold text-white">{item?.company || 'Unknown Company'}</div>
            <div className="text-sm text-gray-400">{item?.symbol || 'N/A'}</div>
            {item?.is_recent && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50">
                New
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'ex_date',
      label: 'Ex-Date',
      sortable: true,
      render: (item: any) => (
        <div className="text-sm text-gray-300">
          {item?.ex_date ? formatDate(item.ex_date) : 'N/A'}
        </div>
      )
    },
    {
      key: 'pay_date',
      label: 'Pay Date',
      sortable: true,
      render: (item: any) => (
        <div>
          <div className="text-sm text-white">{item?.pay_date ? formatDate(item.pay_date) : 'N/A'}</div>
          {item?.is_future && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-900/50 text-orange-300 border border-orange-700/50">
              Upcoming
            </span>
          )}
        </div>
      )
    },
    {
      key: 'amount_per_share',
      label: 'Amount/Share',
      sortable: true,
      render: (item: any) => (
        <div className="text-right">
          <div className="font-medium text-green-400">{formatCurrency(item?.amount_per_share || 0)}</div>
        </div>
      )
    },
    {
      key: 'current_holdings',
      label: 'Holdings',
      sortable: true,
      render: (item: any) => (
        <div className="text-right">
          <div className="text-white">{(item?.current_holdings || 0).toFixed(2)}</div>
          <div className="text-sm text-gray-400">shares</div>
        </div>
      )
    },
    {
      key: 'total_amount',
      label: 'Total Amount',
      sortable: true,
      render: (item: any) => (
        <div className="text-right">
          <div className="font-medium text-green-400">{formatCurrency(item?.total_amount || 0)}</div>
          {!item?.confirmed && (item?.current_holdings || 0) > 0 && (
            <div className="text-sm text-gray-400">Calculated</div>
          )}
          {item?.confirmed && (
            <div className="text-sm text-gray-400">Confirmed</div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Actions',
      render: (item: any) => (
        <div className="text-center space-y-2">
          {item?.confirmed ? (
            <div className="flex flex-col space-y-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-300 border border-green-700/50">
                ✓ Confirmed
              </span>
              <button
                onClick={() => {
                  // TODO: Add edit functionality
                  console.log('Edit dividend:', item?.id);
                }}
                className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
              >
                Edit
              </button>
            </div>
          ) : (item?.current_holdings || 0) > 0 ? (
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => confirmDividendMutation.mutate(item?.id)}
                disabled={confirmDividendMutation.isPending}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {confirmDividendMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Confirming...
                  </>
                ) : (
                  'Received'
                )}
              </button>
              <button
                onClick={() => {
                  // TODO: Add edit functionality
                  console.log('Edit dividend:', item?.id);
                }}
                className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
              >
                Edit Amount
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700/50 text-gray-400 border border-gray-600/50">
              No Holdings
            </span>
          )}
        </div>
      )
    }
  ];

  if (dividendsError) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">⚠️ Error Loading Dividends</div>
        <p className="text-gray-400 text-sm">{dividendsError.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-sm text-gray-400 mb-1">Total Received</div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(summaryData?.total_received || 0)}
          </div>
          <div className="text-sm text-gray-500">
            {summaryData?.confirmed_count || 0} payments
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-sm text-gray-400 mb-1">YTD Received</div>
          <div className="text-2xl font-bold text-blue-400">
            {formatCurrency(summaryData?.ytd_received || 0)}
          </div>
          <div className="text-sm text-gray-500">This year</div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-sm text-gray-400 mb-1">Pending</div>
          <div className="text-2xl font-bold text-orange-400">
            {formatCurrency(summaryData?.total_pending || 0)}
          </div>
          <div className="text-sm text-gray-500">
            {summaryData?.pending_count || 0} upcoming
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-sm text-gray-400 mb-1">Monthly Avg</div>
          <div className="text-2xl font-bold text-purple-400">
            {formatCurrency((summaryData?.ytd_received || 0) / 12)}
          </div>
          <div className="text-sm text-gray-500">Estimated</div>
        </div>
      </div>

      {/* Dividends Table */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-white">Dividend Tracking</h2>
              {syncDividendsMutation.isPending && (
                <div className="flex items-center space-x-2 text-sm text-blue-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <span>Syncing dividends...</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  console.log('Manual dividend sync triggered');
                  syncDividendsMutation.mutate();
                }}
                disabled={syncDividendsMutation.isPending}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {syncDividendsMutation.isPending ? 'Syncing...' : 'Sync Dividends'}
              </button>
              <label className="flex items-center space-x-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={showConfirmedOnly}
                  onChange={(e) => setShowConfirmedOnly(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <span>Confirmed only</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-6">
          <ApexListView
            data={listData}
            columns={columns as any}
            isLoading={dividendsLoading}
            error={(dividendsError as Error | null)?.message ?? ''}
            showSearch={true}
            showPagination={true}
            itemsPerPage={15}
            className="bg-transparent"
            emptyMessage="No dividends found. Dividends will appear here when you hold dividend-paying stocks."
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Dividend Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-gray-700/30 rounded-lg">
            <div className="text-gray-400 mb-2">💡 Tip</div>
            <p className="text-gray-300">
              Click "Received" to confirm dividend payments and automatically create transactions.
            </p>
          </div>
          <div className="p-4 bg-gray-700/30 rounded-lg">
            <div className="text-gray-400 mb-2">📅 Upcoming</div>
            <p className="text-gray-300">
              {listData.filter(d => d.is_future && !d.confirmed).length} dividend payments expected this month.
            </p>
          </div>
          <div className="p-4 bg-gray-700/30 rounded-lg">
            <div className="text-gray-400 mb-2">🔄 Auto-Sync</div>
            <p className="text-gray-300">
              Dividends are automatically synced when you add new holdings to your portfolio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}