'use client';

import { useState, useEffect, useCallback } from 'react';
import GradientText from '@/components/ui/GradientText';
import { useRouter } from 'next/navigation';
import { Eye, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import ApexListView, { ListViewColumn, ListViewAction } from '@/components/charts/ApexListView';
import CompanyIcon from '@/components/ui/CompanyIcon';
import { front_api_get_watchlist, front_api_remove_from_watchlist, WatchlistItem } from '@/hooks/api/front_api_watchlist';
import { useToast } from '@/components/ui/Toast';
import AuthGuard from '@/components/AuthGuard';
import { fetchBulkQuotes, formatPrice, formatChange, formatPercent } from '@/services/alphavantage';

interface WatchlistRow extends WatchlistItem, Record<string, unknown> {
  id: string;
  company_name: string;
  accentColorClass: string;
  // Real-time price data from Alpha Vantage
  current_price?: number;
  previous_close?: number;
  change?: number;
  change_percent?: number;
  volume?: string;
}

export default function WatchlistPage() {
  const router = useRouter();
  const [watchlistData, setWatchlistData] = useState<WatchlistRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const { addToast } = useToast();

  // Fetch real-time prices for watchlist items
  const fetchPrices = useCallback(async (items: WatchlistRow[]) => {
    if (items.length === 0) return items;
    
    try {
      setIsFetchingPrices(true);
      const symbols = items.map(item => item.symbol);
      const quotesMap = await fetchBulkQuotes(symbols);
      
      // Merge price data with watchlist items
      return items.map(item => {
        const quote = quotesMap.get(item.symbol.toUpperCase());
        if (quote) {
          return {
            ...item,
            current_price: parseFloat(quote.close),
            previous_close: parseFloat(quote.previous_close),
            change: parseFloat(quote.change),
            change_percent: parseFloat(quote.change_percent),
            volume: quote.volume
          };
        }
        return item;
      });
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      return items;
    } finally {
      setIsFetchingPrices(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await front_api_get_watchlist(true);
      
      if (response.success && response.watchlist) {
        // Transform data for the table
        const colors = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime'];
        
        let transformedData: WatchlistRow[] = response.watchlist.map((item, index) => ({
          ...item,
          id: item.id,
          company_name: item.symbol, // We don't have company names in the current structure
          accentColorClass: colors[index % colors.length] || 'blue'
        }));
        
        // Fetch real-time prices
        transformedData = await fetchPrices(transformedData);
        
        setWatchlistData(transformedData);
      }
    } catch (err: unknown) {
      console.error('Failed to load watchlist:', err);
      
      // Check if it's an authentication error
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage?.includes('authentication') || errorMessage?.includes('No credentials')) {
        setError('Please log in to view your watchlist.');
        addToast({
          type: 'error',
          title: "Authentication Required",
          message: "Please log in to access your watchlist"
        });
        // Redirect to auth page after a short delay
        setTimeout(() => router.push('/auth'), 2000);
      } else {
        setError('Failed to load watchlist');
        addToast({
          type: 'error',
          title: "Error",
          message: "Failed to load watchlist"
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [router, addToast]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const handleViewDetails = (item: WatchlistRow) => {
    router.push(`/research?ticker=${item.symbol}`);
  };

  const handleRemoveFromWatchlist = async (item: WatchlistRow) => {
    try {
      await front_api_remove_from_watchlist(item.symbol);
      addToast({
        type: 'success',
        title: "Success",
        message: `${item.symbol} removed from watchlist`
      });
      // Reload watchlist
      loadWatchlist();
    } catch (err) {
      console.error('Failed to remove from watchlist:', err);
      addToast({
        type: 'error',
        title: "Error",
        message: "Failed to remove from watchlist"
      });
    }
  };

  // Refresh prices without reloading entire watchlist
  const refreshPrices = async () => {
    if (watchlistData.length === 0) return;
    
    try {
      const updatedData = await fetchPrices(watchlistData);
      setWatchlistData(updatedData);
      addToast({
        type: 'success',
        title: "Prices Updated",
        message: "Latest market prices fetched successfully"
      });
    } catch (err) {
      console.error('Failed to refresh prices:', err);
      addToast({
        type: 'error',
        title: "Error",
        message: "Failed to refresh prices"
      });
    }
  };

  const columns: ListViewColumn<WatchlistRow>[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      sortable: true,
      render: (value, _row) => (
        <div className="flex items-center gap-2">
          <CompanyIcon symbol={String(value)} size={20} />
          <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>{String(value)}</span>
        </div>
      )
    },
    {
      key: 'current_price',
      label: 'Current Price',
      sortable: true,
      render: (value: unknown) => (
        <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>
          {typeof value === 'number' ? formatPrice(value) : '—'}
        </span>
      )
    },
    {
      key: 'previous_close',
      label: 'Previous Close',
      sortable: true,
      render: (value: unknown) => (
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {typeof value === 'number' ? formatPrice(value) : '—'}
        </span>
      )
    },
    {
      key: 'change_percent',
      label: 'Daily Change',
      sortable: true,
      render: (_value, row) => {
        const change = row.change as number || 0;
        const changePercent = row.change_percent as number || 0;
        const isPositive = changePercent >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        
        return (
          <div className="flex items-center gap-1">
            <Icon className={`h-4 w-4`} style={{ color: isPositive ? 'var(--color-green)' : 'var(--color-red)' }} />
            <div className="flex flex-col">
              <span className="font-medium" style={{ color: isPositive ? 'var(--color-green)' : 'var(--color-red)' }}>
                {formatChange(change)}
              </span>
              <span className="text-xs" style={{ color: isPositive ? 'var(--color-green)' : 'var(--color-red)' }}>
                {formatPercent(changePercent)}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'volume',
      label: 'Volume',
      sortable: true,
      render: (value: unknown) => {
        if (!value) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
        const vol = typeof value === 'string' ? parseInt(value) : value as number;
        const formatted = vol > 1000000 ? `${(vol / 1000000).toFixed(1)}M` : vol > 1000 ? `${(vol / 1000).toFixed(1)}K` : vol.toString();
        return <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{formatted}</span>;
      }
    },
    {
      key: 'target_price',
      label: 'Target Price',
      sortable: true,
      render: (value: unknown) => (
        <span className="font-medium" style={{ color: 'var(--color-accent-purple)' }}>
          {typeof value === 'number' ? formatPrice(value) : '—'}
        </span>
      )
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (value: unknown) => (
        <span className="text-sm truncate max-w-xs" style={{ color: 'var(--color-text-muted)' }} title={String(value || '')}>
          {String(value || '—')}
        </span>
      )
    }
  ];

  const actions: ListViewAction<WatchlistRow>[] = [
    {
      label: 'View Details',
      icon: <Eye className="h-4 w-4" />,
      onClick: handleViewDetails
    },
    {
      label: 'Remove',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleRemoveFromWatchlist,
      className: 'text-red-600 hover:text-red-700'
    }
  ];

  return (
    <AuthGuard>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <GradientText className="text-3xl font-bold">Watchlist</GradientText>
            <p className="text-[#8B949E] mt-2">Track stocks you&apos;re interested in with real-time prices</p>
          </div>
          {watchlistData.length > 0 && (
            <button
              onClick={refreshPrices}
              disabled={isFetchingPrices}
              className="flex items-center gap-2 px-4 py-2 bg-[#1C2128] border border-[#30363D] rounded-lg hover:bg-[#262C36] transition-colors disabled:opacity-50"
              style={{ color: 'var(--color-text-main)' }}
            >
              <RefreshCw className={`h-4 w-4 ${isFetchingPrices ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Refresh Prices</span>
            </button>
          )}
        </div>

        <ApexListView
          data={watchlistData}
          columns={columns}
          actions={actions}
          isLoading={isLoading}
          error={error}
          emptyMessage="Your watchlist is empty. Add stocks from the Research page to start tracking them."
          searchPlaceholder="Search watchlist..."
          title="Your Watchlist"
        />
        
        {watchlistData.length > 0 && (
          <div className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <p>Prices are cached for 5 minutes • Data provided by Alpha Vantage</p>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}