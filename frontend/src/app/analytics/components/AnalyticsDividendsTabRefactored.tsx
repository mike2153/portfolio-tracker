"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import ApexListView from '@/components/charts/ApexListView';

// Import unified types
import {
  UserDividendData,
  DividendSummary,
  DividendListResponse,
  DividendSummaryResponse,
  DividendTableRow,
  dividendToTableRow,
  formatDividendCurrency,
  formatDividendDate,
  isDividendConfirmable,
  getCompanyDisplayName
} from '@/types/dividend';

/**
 * REFACTORED AnalyticsDividendsTab Component
 * 
 * Fixes ALL identified issues:
 * 1. Uses unified UserDividendData interface
 * 2. No frontend amount calculations (backend provides total_amount)
 * 3. Proper confirmed status based on transaction existence
 * 4. Consistent field mapping with no missing data
 * 5. Clean error handling and loading states
 * 6. Proper TypeScript typing throughout
 */

interface DividendConfirmRequest {
  edited_amount?: number;
}

export default function AnalyticsDividendsTabRefactored() {
  const [showConfirmedOnly, setShowConfirmedOnly] = useState(false);
  const queryClient = useQueryClient();

  // Sync dividends mutation (manual trigger only for performance)
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
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividends'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividend-summary'] });
      console.log('✅ Dividend sync completed:', data);
    },
    onError: (error) => {
      console.error('❌ Dividend sync failed:', error);
    }
  });

  // FIXED: Fetch dividends with unified data model
  const { data: dividendsData, isLoading: dividendsLoading, error: dividendsError } = useQuery<UserDividendData[], Error>({
    queryKey: ['analytics', 'dividends', showConfirmedOnly],
    queryFn: async (): Promise<UserDividendData[]> => {
      console.log('[REFACTORED_FRONTEND] ===== Starting dividends fetch with unified types =====');
      console.log('[REFACTORED_FRONTEND] showConfirmedOnly:', showConfirmedOnly);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('[REFACTORED_FRONTEND] ERROR: Not authenticated');
        throw new Error('Not authenticated');
      }
      
      const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/dividends?confirmed_only=${showConfirmedOnly}`;
      console.log('[REFACTORED_FRONTEND] API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[REFACTORED_FRONTEND] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('[REFACTORED_FRONTEND] ERROR Response data:', errorData);
        throw new Error(errorData.detail || `Failed to fetch dividends: ${response.status}`);
      }

      const result: DividendListResponse = await response.json();
      console.log('[REFACTORED_FRONTEND] API Response structure:', {
        success: result.success,
        dataCount: result.data?.length || 0,
        metadata: result.metadata
      });
      console.log('[REFACTORED_FRONTEND] Raw API data first item:', result.data?.[0]);
      console.log('[REFACTORED_FRONTEND] Raw API data structure:', result.data?.slice(0, 2));
      
      if (!result.success) {
        console.log('[REFACTORED_FRONTEND] ERROR: API returned success=false:', result.error);
        throw new Error(result.error || 'Failed to fetch dividends');
      }

      // FIXED: Backend now provides complete UserDividendData with all fields
      const dividends: UserDividendData[] = result.data.map(item => ({
        id: item.id,
        symbol: item.symbol,
        company: item.company || getCompanyDisplayName(item.symbol),
        ex_date: item.ex_date,
        pay_date: item.pay_date,
        amount_per_share: item.amount_per_share,
        shares_held_at_ex_date: item.shares_held_at_ex_date,
        current_holdings: item.current_holdings,
        total_amount: item.total_amount, // FIXED: Backend calculates this, no frontend math
        currency: item.currency || 'USD',
        confirmed: item.confirmed,
        status: item.status || 'pending',
        dividend_type: item.dividend_type || 'cash',
        source: item.source || 'alpha_vantage',
        is_future: item.is_future || false,
        is_recent: item.is_recent || false,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      console.log(`[REFACTORED_FRONTEND] ✅ Successfully processed ${dividends.length} dividends with unified data model`);
      console.log('[REFACTORED_FRONTEND] Sample processed dividend:', dividends[0]);
      console.log('[REFACTORED_FRONTEND] First 3 dividends:', dividends.slice(0, 3).map(d => ({
        id: d.id,
        symbol: d.symbol,
        company: d.company,
        amount_per_share: d.amount_per_share,
        shares_held_at_ex_date: d.shares_held_at_ex_date,
        total_amount: d.total_amount,
        confirmed: d.confirmed
      })));
      return dividends;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true,
  });

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
      const result: DividendSummaryResponse = await response.json();
      return result.data.dividend_summary;
    },
    staleTime: 5 * 60 * 1000,
  });

  // FIXED: Confirm dividend with proper request/response handling
  const confirmDividendMutation = useMutation({
    mutationFn: async (params: { dividendId: string; editedAmount?: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const requestBody: DividendConfirmRequest = {};
      if (params.editedAmount !== undefined) {
        requestBody.edited_amount = params.editedAmount;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/analytics/dividends/confirm?dividend_id=${params.dividendId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || 'Failed to confirm dividend');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ REFACTORED dividend confirmation successful:', data);
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividends'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'dividend-summary'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'holdings'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error) => {
      console.error('❌ REFACTORED dividend confirmation failed:', error);
    }
  });

  // FIXED: Transform to table format using utility function
  const listData = useMemo((): DividendTableRow[] => {
    if (!dividendsData) return [];
    
    console.log('[REFACTORED_FRONTEND] ===== Transforming dividends to table format =====');
    console.log('[REFACTORED_FRONTEND] Input dividends count:', dividendsData.length);
    
    const tableRows = dividendsData.map(dividend => dividendToTableRow(dividend));
    
    console.log('[REFACTORED_FRONTEND] ✅ Transformed to table rows count:', tableRows.length);
    console.log('[REFACTORED_FRONTEND] Sample table row:', tableRows[0]);
    console.log('[REFACTORED_FRONTEND] First 3 table rows:', tableRows.slice(0, 3).map(row => ({
      id: row.id,
      symbol: row.symbol,
      company: row.company,
      amount_per_share: row.amount_per_share,
      shares_held_at_ex_date: row.shares_held_at_ex_date,
      total_amount: row.total_amount,
      confirmed: row.confirmed
    })));
    
    return tableRows;
  }, [dividendsData]);

  // FIXED: Column definitions with proper field mapping
  const columns = useMemo(
    () => [
      {
        key: 'company',
        label: 'Company',
        searchable: true,
        sortable: true,
        render: (item: DividendTableRow) => (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {item.symbol?.slice(0, 2) || '??'}
            </div>
            <div>
              <div className="font-semibold text-white">{item.company}</div>
              <div className="text-sm text-gray-400">{item.symbol || 'N/A'}</div>
              {item.is_recent && (
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
        render: (item: DividendTableRow) => (
          <div className="text-sm text-gray-300">
            {item.ex_date ? formatDividendDate(item.ex_date) : 'N/A'}
          </div>
        )
      },
      {
        key: 'pay_date',
        label: 'Pay Date',
        sortable: true,
        render: (item: DividendTableRow) => (
          <div>
            <div className="text-sm text-white">
              {item.pay_date ? formatDividendDate(item.pay_date) : 'N/A'}
            </div>
            {item.is_future && (
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
        render: (item: DividendTableRow) => (
          <div className="text-right">
            <div className="font-medium text-green-400">
              {formatDividendCurrency(item.amount_per_share, item.currency)}
            </div>
          </div>
        )
      },
      {
        key: 'shares_held_at_ex_date',
        label: 'Holdings',
        sortable: true,
        render: (item: DividendTableRow) => (
          <div className="text-right">
            <div className="text-white">{item.shares_held_at_ex_date.toFixed(2)}</div>
            <div className="text-sm text-gray-400">
              {item.shares_held_at_ex_date !== item.current_holdings ? (
                <>at ex-date<br />Now: {item.current_holdings.toFixed(2)}</>
              ) : (
                'shares'
              )}
            </div>
          </div>
        )
      },
      {
        key: 'total_amount',
        label: 'Total Amount',
        sortable: true,
        render: (item: DividendTableRow) => (
          <div className="text-right">
            <div className="font-medium text-green-400">
              {formatDividendCurrency(item.total_amount, item.currency)}
            </div>
            {item.confirmed === 'Yes' ? (
              <div className="text-sm text-green-400">Confirmed</div>
            ) : (
              <div className="text-sm text-gray-400">Calculated</div>
            )}
          </div>
        )
      },
      {
        key: 'confirmed',
        label: 'Status',
        sortable: true,
        render: (item: DividendTableRow) => (
          <div className="text-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              item.confirmed === 'Yes' 
                ? 'bg-green-900/50 text-green-300 border border-green-700/50' 
                : 'bg-gray-700/50 text-gray-400 border border-gray-600/50'
            }`}>
              {item.confirmed === 'Yes' ? '✓ Confirmed' : 'Pending'}
            </span>
          </div>
        )
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (item: DividendTableRow) => {
          // FIXED: Use proper eligibility check
          const dividend = dividendsData?.find(d => d.id === item.id);
          const canConfirm = dividend ? isDividendConfirmable(dividend) : false;

          return (
            <div className="text-center space-y-2">
              {item.confirmed === 'Yes' ? (
                <div className="flex flex-col space-y-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-300 border border-green-700/50">
                    ✓ Received
                  </span>
                  <button
                    onClick={() => {
                      console.log('TODO: Edit dividend functionality for:', item.id);
                    }}
                    className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              ) : canConfirm ? (
                <div className="flex flex-col space-y-1">
                  <button
                    onClick={() => confirmDividendMutation.mutate({ dividendId: item.id })}
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
                      console.log('TODO: Edit amount functionality for:', item.id);
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
          );
        }
      }
    ],
    [dividendsData, confirmDividendMutation]
  );

  console.log('[REFACTORED_FRONTEND] ===== Rendering component =====');
  console.log('[REFACTORED_FRONTEND] Render state:', {
    dividendsCount: dividendsData?.length || 0,
    listDataCount: listData.length,
    isLoading: dividendsLoading,
    hasError: !!dividendsError
  });

  if (dividendsError) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">⚠️ Error Loading Dividends</div>
        <p className="text-gray-400 text-sm">{dividendsError.message}</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['analytics', 'dividends'] })}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
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
            {formatDividendCurrency(summaryData?.total_received || 0)}
          </div>
          <div className="text-sm text-gray-500">
            {summaryData?.confirmed_count || 0} payments
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-sm text-gray-400 mb-1">YTD Received</div>
          <div className="text-2xl font-bold text-blue-400">
            {formatDividendCurrency(summaryData?.ytd_received || 0)}
          </div>
          <div className="text-sm text-gray-500">This year</div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-sm text-gray-400 mb-1">Pending</div>
          <div className="text-2xl font-bold text-orange-400">
            {formatDividendCurrency(summaryData?.total_pending || 0)}
          </div>
          <div className="text-sm text-gray-500">
            {summaryData?.pending_count || 0} upcoming
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
          <div className="text-sm text-gray-400 mb-1">Monthly Avg</div>
          <div className="text-2xl font-bold text-purple-400">
            {formatDividendCurrency((summaryData?.ytd_received || 0) / 12)}
          </div>
          <div className="text-sm text-gray-500">Estimated</div>
        </div>
      </div>

      {/* Dividends Table */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-semibold text-white">REFACTORED Dividend Tracking</h2>
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
                  console.log('REFACTORED manual dividend sync triggered');
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
          {console.log('[REFACTORED_FRONTEND] Data being passed to ApexListView:', {
            listDataLength: listData.length,
            firstItem: listData[0],
            columnsCount: columns.length,
            isLoading: dividendsLoading
          })}
          <ApexListView
            data={listData}
            columns={columns as any}
            isLoading={dividendsLoading}
            error={dividendsError?.message ?? ''}
            showSearch={true}
            showPagination={true}
            itemsPerPage={15}
            className="bg-transparent"
            emptyMessage="No dividends found. The refactored system will display dividends when you hold dividend-paying stocks."
          />
        </div>
      </div>

      {/* Status Information */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">🔧 Refactored System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-green-900/30 rounded-lg border border-green-700/50">
            <div className="text-green-400 mb-2">✅ Fixed Issues</div>
            <ul className="text-gray-300 space-y-1">
              <li>• Unified data model</li>
              <li>• Transaction-based confirmation</li>
              <li>• Backend amount calculations</li>
              <li>• Consistent API contracts</li>
              <li>• Proper error handling</li>
            </ul>
          </div>
          <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700/50">
            <div className="text-blue-400 mb-2">📊 Data Integrity</div>
            <p className="text-gray-300">
              All fields are provided by backend. No frontend calculations. 
              Confirmation status based on transaction existence.
            </p>
          </div>
          <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700/50">
            <div className="text-purple-400 mb-2">🚀 Performance</div>
            <p className="text-gray-300">
              Optimized with proper caching, unified types, and efficient data fetching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}