'use client';

import React from 'react';
import { useSessionPortfolio } from '@/hooks/useSessionPortfolio';
import ApexListView, { ListViewColumn } from '@/components/charts/ApexListView';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function HoldingsTable() {
  const { portfolioData, isLoading, isError, error, refetch } = useSessionPortfolio();

  // Define columns for the holdings table
  const columns: ListViewColumn<Record<string, unknown>>[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      sortable: true,
      searchable: true,
      render: (value) => (
        <span className="font-semibold text-white">{String(value)}</span>
      ),
    },
    {
      key: 'quantity',
      label: 'Shares',
      sortable: true,
      render: (value) => (
        <span className="text-[#8B949E]">{Number(value).toLocaleString()}</span>
      ),
    },
    {
      key: 'current_price',
      label: 'Price',
      sortable: true,
      render: (value) => (
        <span className="text-[#8B949E]">${Number(value).toFixed(2)}</span>
      ),
    },
    {
      key: 'current_value',
      label: 'Market Value',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-white">${Number(value).toLocaleString()}</span>
      ),
    },
    {
      key: 'total_cost',
      label: 'Cost Basis',
      sortable: true,
      render: (value) => (
        <span className="text-[#8B949E]">${Number(value).toLocaleString()}</span>
      ),
    },
    {
      key: 'gain_loss',
      label: 'Gain/Loss',
      sortable: true,
      render: (value, _item) => {
        const isPositive = Number(value) >= 0;
        return (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
              ${Math.abs(Number(value)).toLocaleString()}
            </span>
          </div>
        );
      },
    },
    {
      key: 'gain_loss_percent',
      label: 'Gain/Loss %',
      sortable: true,
      render: (value) => {
        const isPositive = Number(value) >= 0;
        return (
          <span className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{Number(value).toFixed(2)}%
          </span>
        );
      },
    },
    {
      key: 'allocation_percent',
      label: 'Allocation',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-[#30363D] rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full"
              style={{ width: `${Math.min(Number(value), 100)}%` }}
            />
          </div>
          <span className="text-[#8B949E] text-sm">{Number(value).toFixed(1)}%</span>
        </div>
      ),
    },
    {
      key: 'dividends_received',
      label: 'Dividends',
      sortable: true,
      render: (value) => (
        <span className="text-[#8B949E]">${Number(value).toFixed(2)}</span>
      ),
    },
  ];

  // Use the complete portfolio holdings data and cast to the expected type
  const enhancedData = (portfolioData?.holdings || []) as unknown as Record<string, unknown>[];

  return (
    <div className="mb-6">
      <ApexListView
        title="Holdings"
        data={enhancedData}
        columns={columns}
        isLoading={isLoading}
        error={isError ? error?.message || 'Failed to load holdings' : null}
        onRetry={refetch}
        searchPlaceholder="Search holdings..."
        emptyMessage="No holdings found"
        showSearch={true}
        showPagination={true}
        itemsPerPage={20}
        className="bg-[#1a1f2e]/50"
      />
    </div>
  );
}