"use client";

import React, { useState, useMemo } from 'react';
import ApexListView from '@/components/charts/ApexListView';
import CompanyIcon from '@/components/ui/CompanyIcon';

interface Holding {
  symbol: string;
  company: string;
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

interface AnalyticsHoldingsTableProps {
  holdings: Holding[];
  isLoading: boolean;
  error: Error | null;
  includeSoldHoldings: boolean;
  onToggleSoldHoldings: (include: boolean) => void;
}

// Use the ListViewColumn type from ApexListView directly
import { ListViewColumn } from '@/components/charts/ApexListView';
// Import centralized formatters to eliminate duplication
import { formatCurrency, formatPercentage } from '@/utils/formatters';

const getChangeColor = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return 'text-gray-400';
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
};

const getCompanyName = (symbol: string): string => {
  // This would normally come from an API, but for demo purposes:
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

export default function AnalyticsHoldingsTable({
  holdings,
  isLoading,
  error,
  includeSoldHoldings,
  onToggleSoldHoldings
}: AnalyticsHoldingsTableProps) {
  console.log('[AnalyticsHoldingsTable] Received props:', {
    holdingsCount: holdings?.length,
    firstHolding: holdings?.[0],
    isLoading
  });
  
  const [searchTerm] = useState('');
  const [sortField] = useState<keyof Holding>('current_value');
  const [sortDirection] = useState<'asc' | 'desc'>('desc');

  // Process and filter holdings data
  const processedHoldings = useMemo(() => {
    // Safety check: ensure holdings is an array
    if (!holdings || !Array.isArray(holdings)) {
      return [];
    }
    
    let filtered = holdings;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(holding =>
        holding.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCompanyName(holding.symbol).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter sold holdings if needed
    if (!includeSoldHoldings) {
      filtered = filtered.filter(holding => holding.quantity > 0);
    }

    // Sort holdings
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return filtered;
  }, [holdings, searchTerm, includeSoldHoldings, sortField, sortDirection]);

  // Transform data for ApexListView
  const listData = useMemo(() => {
    // Safety check: ensure processedHoldings is an array
    if (!processedHoldings || !Array.isArray(processedHoldings)) {
      return [];
    }
    
    const transformed = processedHoldings.map(holding => ({
      id: holding.symbol || '',
      symbol: holding.symbol || '',
      company: getCompanyName(holding.symbol || ''),
      quantity: holding.quantity || 0,
      current_price: holding.current_price || 0,
      current_value: holding.current_value || 0,
      cost_basis: holding.cost_basis || 0,
      unrealized_gain: holding.unrealized_gain || 0,
      unrealized_gain_percent: holding.unrealized_gain_percent || 0,
      realized_pnl: holding.realized_pnl || 0,
      dividends_received: holding.dividends_received || 0,
      total_profit: holding.total_profit || 0,
      total_profit_percent: holding.total_profit_percent || 0,
      daily_change: holding.daily_change || 0,
      daily_change_percent: holding.daily_change_percent || 0,
      irr_percent: holding.irr_percent || 0,
      holding: {
        symbol: holding.symbol || '',
        company: getCompanyName(holding.symbol || ''),
        quantity: holding.quantity || 0
      }
    }));
    console.log('[AnalyticsHoldingsTable] Transformed listData:', transformed);
    return transformed;
  }, [processedHoldings]);

  // Column configuration - use proper typing for the transformed list data
  type ListDataType = typeof listData extends (infer U)[] ? U : never;
  const columns: ListViewColumn<ListDataType>[] = [
    {
      key: 'holding',
      label: 'Holding',
      searchable: true,
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="flex items-center space-x-3">
          <CompanyIcon 
            symbol={_item.symbol} 
            size={40} 
            fallback="initials"
            className="flex-shrink-0"
          />
          <div>
            <div className="font-semibold text-white">{_item.company}</div>
            <div className="text-sm text-gray-400">{_item.symbol}</div>
            <div className="text-xs text-gray-500">{_item.quantity.toFixed(2)} shares</div>
          </div>
        </div>
      )
    },
    {
      key: 'cost_basis',
      label: 'Cost Basis',
      sortable: true,
      render: (value: unknown, _item: Holding) => {
        console.log('[Column Render] Cost Basis value:', value, 'item:', _item.symbol);
        return (
          <div className="text-right">
            <div className="font-medium text-white">{formatCurrency(value as number)}</div>
          </div>
        );
      }
    },
    {
      key: 'current_value',
      label: 'Current Value',
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="text-right">
          <div className="font-medium text-white">{formatCurrency(value as number)}</div>
        </div>
      )
    },
    {
      key: 'dividends_received',
      label: 'Dividends Received',
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="text-right">
          <div className="font-medium text-blue-400">{formatCurrency(value as number)}</div>
        </div>
      )
    },
    {
      key: 'unrealized_gain',
      label: 'Capital Gain',
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="text-right">
          <div className={`font-medium ${getChangeColor(value as number)}`}>
            {formatCurrency(value as number)}
          </div>
          <div className={`text-sm ${getChangeColor(_item.unrealized_gain_percent)}`}>
            {formatPercentage(_item.unrealized_gain_percent)}
          </div>
        </div>
      )
    },
    {
      key: 'realized_pnl',
      label: 'Realized P&L',
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="text-right">
          <div className={`font-medium ${getChangeColor(value as number)}`}>
            {formatCurrency(value as number)}
          </div>
        </div>
      )
    },
    {
      key: 'total_profit',
      label: 'Total Profit',
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="text-right">
          <div className={`font-medium ${getChangeColor(value as number)}`}>
            {formatCurrency(value as number)}
          </div>
          <div className={`text-sm ${getChangeColor(_item.total_profit_percent)}`}>
            {formatPercentage(_item.total_profit_percent)}
          </div>
        </div>
      )
    },
    {
      key: 'daily_change',
      label: 'Daily',
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="text-right">
          <div className={`font-medium ${getChangeColor(value as number)}`}>
            {formatCurrency(value as number)}
          </div>
          <div className={`text-sm ${getChangeColor(_item.daily_change_percent)}`}>
            {formatPercentage(_item.daily_change_percent)}
          </div>
        </div>
      )
    },
    {
      key: 'irr_percent',
      label: 'IRR',
      sortable: true,
      render: (value: unknown, _item: Holding) => (
        <div className="text-right">
          <div className={`font-medium ${getChangeColor(value as number)}`}>
            {formatPercentage(value as number)}
          </div>
        </div>
      )
    }
  ];

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">⚠️ Error Loading Holdings</div>
        <p className="text-gray-400 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Holdings Analysis</h2>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={includeSoldHoldings}
                onChange={(e) => onToggleSoldHoldings(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
              />
              <span>Include sold holdings</span>
            </label>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Total Holdings</div>
            <div className="text-white font-medium">{processedHoldings.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Total Value</div>
            <div className="text-white font-medium">
              {formatCurrency(processedHoldings.reduce((sum, h) => sum + (h.current_value || 0), 0))}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Total Cost</div>
            <div className="text-white font-medium">
              {formatCurrency(processedHoldings.reduce((sum, h) => sum + (h.cost_basis || 0), 0))}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Total Profit</div>
            <div className={`font-medium ${getChangeColor(processedHoldings.reduce((sum, h) => sum + (h.total_profit || 0), 0))}`}>
              {formatCurrency(processedHoldings.reduce((sum, h) => sum + (h.total_profit || 0), 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="p-6">
        <ApexListView
          data={listData}
          columns={columns}
          isLoading={isLoading}
          error={error ? (error as Error).message : null}
          showSearch={true}
          showPagination={true}
          itemsPerPage={10}
          className="bg-transparent"
          emptyMessage="No holdings found."
        />
      </div>
    </div>
  );
}