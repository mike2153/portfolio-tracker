'use client';

import { useMemo, useState, useEffect } from 'react';
import ApexListView from '@/components/charts/ApexListView';
import type { ListViewColumn, ListViewAction } from '@/components/charts/ApexListView';
import { cn } from '@/lib/utils';
import { useDashboard } from '../contexts/DashboardContext';
import { usePortfolioAllocation, AllocationItem } from '@/hooks/usePortfolioAllocation';
import { Star, StarOff } from 'lucide-react';
import { front_api_get_watchlist, front_api_add_to_watchlist, front_api_remove_from_watchlist } from '@/hooks/api/front_api_watchlist';
import { useToast } from '@/components/ui/Toast';

interface AllocationRowExtended extends AllocationItem {
  id: string;
  accentColorClass: string;
}

const AllocationTableApex = () => {
  useDashboard();
  const { data: allocationData, isLoading, isError, error, refetch } = usePortfolioAllocation();
  const [watchlistItems, setWatchlistItems] = useState<Set<string>>(new Set());
  const { addToast } = useToast();

  // Load watchlist status on mount
  useEffect(() => {
    loadWatchlistStatus();
  }, []);

  const loadWatchlistStatus = async () => {
    try {
      const response = await front_api_get_watchlist(false);
      if (response.success) {
        const symbols = new Set(response.watchlist.map(item => item.symbol));
        setWatchlistItems(symbols);
      }
    } catch (err) {
      console.error('Failed to load watchlist status:', err);
    }
  };

  const handleWatchlistToggle = async (item: AllocationRowExtended) => {
    try {
      if (watchlistItems.has(item.symbol)) {
        await front_api_remove_from_watchlist(item.symbol);
        setWatchlistItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.symbol);
          return newSet;
        });
        addToast({
          type: 'success',
          title: "Success",
          message: `${item.symbol} removed from watchlist`
        });
      } else {
        await front_api_add_to_watchlist(item.symbol);
        setWatchlistItems(prev => new Set(prev).add(item.symbol));
        addToast({
          type: 'success',
          title: "Success",
          message: `${item.symbol} added to watchlist`
        });
      }
    } catch (err) {
      console.error('Failed to update watchlist:', err);
      addToast({
        type: 'error',
        title: "Error",
        message: "Failed to update watchlist"
      });
    }
  };

  // Transform data for ApexListView
  const { listViewData, columns, actions } = useMemo(() => {
    if (!allocationData) {
      return { listViewData: [], columns: [], actions: [] };
    }
    
    // Transform allocations to extended format
    const transformedData: AllocationRowExtended[] = allocationData.allocations.map((allocation, index) => ({
      ...allocation,
      id: allocation.symbol || `row_${index}`,
      accentColorClass: `bg-${allocation.color}-500`
    }));

    // Define columns
    const tableColumns: ListViewColumn<AllocationRowExtended>[] = [
      {
        key: 'symbol',
        label: 'Symbol',
        sortable: true,
        searchable: true,
        render: (value, item) => (
          <div className="flex items-center">
            <span className={cn("mr-3 h-4 w-1 rounded-full", item.accentColorClass)}></span>
            <span className="font-medium text-white">{value}</span>
          </div>
        ),
        width: '150px'
      },
      {
        key: 'current_value',
        label: 'Current Value',
        sortable: true,
        render: (value) => (
          <div>
            <div className="font-medium text-white">${Number(value).toLocaleString()}</div>
          </div>
        ),
        width: '130px'
      },
      {
        key: 'cost_basis',
        label: 'Amount Invested',
        sortable: true,
        render: (value) => (
          <div className="text-sm text-gray-400">${Number(value).toLocaleString()}</div>
        ),
        width: '130px'
      },
      {
        key: 'gain_loss',
        label: 'Gain/Loss ($)',
        sortable: true,
        render: (value) => (
          <div className={cn("font-medium", Number(value) >= 0 ? 'text-green-400' : 'text-red-400')}>
            {Number(value) >= 0 ? '+' : ''}${Number(value).toLocaleString()}
          </div>
        ),
        width: '120px'
      },
      {
        key: 'gain_loss_percent',
        label: 'Gain/Loss (%)',
        sortable: true,
        render: (value) => (
          <div className={cn("text-sm", Number(value) >= 0 ? 'text-green-400' : 'text-red-400')}>
            {Number(value) >= 0 ? '+' : ''}{Number(value).toFixed(2)}%
          </div>
        ),
        width: '120px'
      },
      {
        key: 'allocation_percent',
        label: 'Allocation',
        sortable: true,
        render: (value) => (
          <div className="font-medium text-white">
            {Number(value).toFixed(2)}%
          </div>
        ),
        width: '100px'
      }
    ];

    // Define actions
    const tableActions: ListViewAction<AllocationRowExtended>[] = [
      {
        label: (item) => watchlistItems.has(item.symbol) ? 'Remove from Watchlist' : 'Add to Watchlist',
        icon: (item) => watchlistItems.has(item.symbol) ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />,
        onClick: handleWatchlistToggle,
        className: 'text-yellow-400 hover:text-yellow-300'
      },
      {
        label: 'View Details',
        onClick: (item) => {
          //console.log('[AllocationTableApex] View details for:', item.symbol);
          // TODO: Navigate to stock details page
        },
        className: 'text-blue-400 hover:text-blue-300'
      },
      {
        label: 'Add Transaction',
        onClick: (item) => {
          //console.log('[AllocationTableApex] Add transaction for:', item.symbol);
          // TODO: Open add transaction modal with pre-filled symbol
        },
        className: 'text-green-400 hover:text-green-300'
      }
    ];

    return {
      listViewData: transformedData,
      columns: tableColumns,
      actions: tableActions
    };
  }, [allocationData, watchlistItems, handleWatchlistToggle]);

  return (
    <ApexListView
      data={listViewData}
      columns={columns}
      actions={actions}
      title="Portfolio Allocation"
      isLoading={isLoading}
      error={isError ? String(error) : null}
      onRetry={refetch}
      emptyMessage={allocationData?.allocations.length === 0 ? "No holdings found. Add transactions to see your portfolio allocation." : "Loading allocation data..."}
      showSearch={true}
      showPagination={false}
      searchPlaceholder="Search holdings..."
      getItemKey={(item) => item.id}
      className="rounded-xl bg-gray-800/80 shadow-lg"
    />
  );
};

export default AllocationTableApex;