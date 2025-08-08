'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import ApexListView from '@/components/charts/ApexListView';
import type { ListViewColumn, ListViewAction } from '@/components/charts/ApexListView';
import { cn } from '@/lib/utils';
import { useDashboard } from '../contexts/DashboardContext';
// Use the main hook to get complete holdings data
import { useSessionPortfolio } from '@/hooks/useSessionPortfolio';
import { Star, StarOff } from 'lucide-react';

// Define AllocationItem interface for the transformed data
interface AllocationItem {
  symbol: string;
  current_value: number;
  cost_basis: number;
  gain_loss: number;
  gain_loss_percent: number;
  allocation_percent: number;
  color: string;
}
import { front_api_get_watchlist, front_api_add_to_watchlist, front_api_remove_from_watchlist } from '@/hooks/api/front_api_watchlist';
import { useToast } from '@/components/ui/Toast';

interface AllocationRowExtended extends AllocationItem, Record<string, unknown> {
  id: string;
  accentColorClass: string;
}

const AllocationTableApex = () => {
  useDashboard();
  // Get complete portfolio data including all holdings details
  const { portfolioData, isLoading, isError, error } = useSessionPortfolio();
  const [watchlistItems, setWatchlistItems] = useState<Set<string>>(new Set());
  const { addToast } = useToast();
  
  // Color palette for holdings
  const colorPalette = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime'];

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

  const handleWatchlistToggle = useCallback(async (item: AllocationRowExtended) => {
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
  }, [watchlistItems, addToast]);

  // Transform data for ApexListView
  const { listViewData, columns, actions } = useMemo(() => {
    if (!portfolioData || !portfolioData.holdings) {
      return { listViewData: [], columns: [], actions: [] };
    }
    
    // Transform holdings data to match expected format
    // Holdings array contains all the data we need
    const transformedData: AllocationRowExtended[] = portfolioData.holdings.map((holding, index) => {
      const color = colorPalette[index % colorPalette.length];
      return {
        symbol: holding.symbol,
        current_value: holding.current_value,
        cost_basis: holding.total_cost, // total_cost is the cost basis
        gain_loss: holding.gain_loss,
        gain_loss_percent: holding.gain_loss_percent,
        allocation_percent: holding.allocation_percent,
        color: color,
        id: holding.symbol || `row_${index}`,
        accentColorClass: `bg-${color}-500`
      };
    });

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
            <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>{String(value)}</span>
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
            <div className="font-medium" style={{ color: 'var(--color-text-main)' }}>${Number(value).toLocaleString()}</div>
          </div>
        ),
        width: '130px'
      },
      {
        key: 'cost_basis',
        label: 'Amount Invested',
        sortable: true,
        render: (value) => (
          <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>${Number(value).toLocaleString()}</div>
        ),
        width: '130px'
      },
      {
        key: 'gain_loss',
        label: 'Gain/Loss ($)',
        sortable: true,
        render: (value) => (
          <div className="font-medium" style={{ 
            color: Number(value) >= 0 ? 'var(--color-green)' : 'var(--color-red)' 
          }}>
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
          <div className="text-sm" style={{ 
            color: Number(value) >= 0 ? 'var(--color-green)' : 'var(--color-red)' 
          }}>
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
          <div className="font-medium" style={{ color: 'var(--color-text-main)' }}>
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
        className: 'hover:opacity-80 transition-all duration-300 text-[var(--color-gold)]'
      },
      {
        label: 'View Details',
        onClick: (_item) => {
          //console.log('[AllocationTableApex] View details for:', item.symbol);
          // TODO: Navigate to stock details page
        },
        className: 'hover:opacity-80 transition-all duration-300 text-[var(--color-text-main)]'
      },
      {
        label: 'Add Transaction',
        onClick: (_item) => {
          //console.log('[AllocationTableApex] Add transaction for:', item.symbol);
          // TODO: Open add transaction modal with pre-filled symbol
        },
        className: 'hover:opacity-80 transition-all duration-300 text-[var(--color-green)]'
      }
    ];

    return {
      listViewData: transformedData,
      columns: tableColumns,
      actions: tableActions
    };
  }, [portfolioData, watchlistItems, handleWatchlistToggle, colorPalette]);

  return (
    <ApexListView
      data={listViewData}
      columns={columns}
      actions={actions}
      title="Portfolio Allocation"
      isLoading={isLoading}
      error={isError ? String(error) : null}
      onRetry={() => {}} // Removed refetch since consolidated hook handles refreshing automatically
      emptyMessage={listViewData.length === 0 ? "No holdings found. Add transactions to see your portfolio allocation." : "Loading allocation data..."}
      showSearch={true}
      showPagination={false}
      searchPlaceholder="Search holdings..."
      getItemKey={(item) => item.id as string}
      className="metric-card-enhanced magnetic-hover animate-stagger-reveal group"
    />
  );
};

export default AllocationTableApex;