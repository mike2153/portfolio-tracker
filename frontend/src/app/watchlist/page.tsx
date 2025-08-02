'use client';

import { useState, useEffect, useCallback } from 'react';
import GradientText from '@/components/ui/GradientText';
import { useRouter } from 'next/navigation';
import { Eye, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import ApexListView, { ListViewColumn, ListViewAction } from '@/components/charts/ApexListView';
import CompanyIcon from '@/components/ui/CompanyIcon';
import { front_api_get_watchlist, front_api_remove_from_watchlist, WatchlistItem } from '@/hooks/api/front_api_watchlist';
import { useToast } from '@/components/ui/Toast';
import AuthGuard from '@/components/AuthGuard';

interface WatchlistRow extends WatchlistItem, Record<string, unknown> {
  id: string;
  company_name: string;
  accentColorClass: string;
}

export default function WatchlistPage() {
  const router = useRouter();
  const [watchlistData, setWatchlistData] = useState<WatchlistRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const loadWatchlist = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await front_api_get_watchlist(true);
      
      if (response.success && response.watchlist) {
        // Transform data for the table
        const colors = ['emerald', 'blue', 'purple', 'orange', 'red', 'yellow', 'pink', 'indigo', 'cyan', 'lime'];
        
        const transformedData: WatchlistRow[] = response.watchlist.map((item, index) => ({
          ...item,
          id: item.id,
          company_name: item.symbol, // We don't have company names in the current structure
          accentColorClass: colors[index % colors.length] || 'blue'
        }));
        
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

  const columns: ListViewColumn<WatchlistRow>[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      sortable: true,
      render: (value, _row) => (
        <div className="flex items-center gap-2">
          <CompanyIcon symbol={String(value)} size={20} />
          <span className="font-medium">{String(value)}</span>
        </div>
      )
    },
    {
      key: 'current_price',
      label: 'Current Price',
      sortable: true,
      render: (value: unknown) => (
        <span className="font-mono">${typeof value === 'number' ? value.toFixed(2) : '—'}</span>
      )
    },
    {
      key: 'change_percent',
      label: 'Daily Change',
      sortable: true,
      render: (value, row) => {
        const change = row.change || 0;
        const changePercent = row.change_percent || 0;
        const isPositive = changePercent >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        
        return (
          <div className="flex items-center gap-1">
            <Icon className={`h-4 w-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(2)}%)
            </span>
          </div>
        );
      }
    },
    {
      key: 'target_price',
      label: 'Target Price',
      sortable: true,
      render: (value: unknown) => (
        <span className="font-mono">{typeof value === 'number' ? `$${value.toFixed(2)}` : '—'}</span>
      )
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (value: unknown) => (
        <span className="text-sm text-[#8B949E] truncate max-w-xs" title={String(value || '')}>
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
        <div className="mb-6">
          <GradientText className="text-3xl font-bold">Watchlist</GradientText>
          <p className="text-[#8B949E] mt-2">Track stocks you&apos;re interested in</p>
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
      </div>
    </AuthGuard>
  );
}