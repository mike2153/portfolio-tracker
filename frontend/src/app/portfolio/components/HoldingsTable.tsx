'use client';

import React from 'react';
import { usePortfolioAllocation } from '@/hooks/usePortfolioAllocation';
import ApexListView, { ListViewColumn } from '@/components/charts/ApexListView';
import { AllocationItem } from '@/hooks/usePortfolioAllocation';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function HoldingsTable() {
  const { data, isLoading, isError, error, refetch } = usePortfolioAllocation();

  // Define columns for the holdings table
  const columns: ListViewColumn<AllocationItem>[] = [
    {
      key: 'symbol',
      label: 'Symbol',
      sortable: true,
      searchable: true,
      render: (value) => (
        <span className="font-semibold text-white">{value}</span>
      ),
    },
    {
      key: 'quantity',
      label: 'Shares',
      sortable: true,
      render: (value) => (
        <span className="text-gray-300">{value.toLocaleString()}</span>
      ),
    },
    {
      key: 'current_price',
      label: 'Price',
      sortable: true,
      render: (value) => (
        <span className="text-gray-300">${value.toFixed(2)}</span>
      ),
    },
    {
      key: 'current_value',
      label: 'Market Value',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-white">${value.toLocaleString()}</span>
      ),
    },
    {
      key: 'cost_basis',
      label: 'Cost Basis',
      sortable: true,
      render: (value) => (
        <span className="text-gray-300">${value.toLocaleString()}</span>
      ),
    },
    {
      key: 'gain_loss',
      label: 'Gain/Loss',
      sortable: true,
      render: (value, item) => {
        const isPositive = value >= 0;
        return (
          <div className="flex items-center gap-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
              ${Math.abs(value).toLocaleString()}
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
        const isPositive = value >= 0;
        return (
          <span className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{value.toFixed(2)}%
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
          <div className="w-16 bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${Math.min(value, 100)}%` }}
            />
          </div>
          <span className="text-gray-300 text-sm">{value.toFixed(1)}%</span>
        </div>
      ),
    },
    {
      key: 'dividends_received',
      label: 'Dividends',
      sortable: true,
      render: (value) => (
        <span className="text-gray-300">${value.toFixed(2)}</span>
      ),
    },
  ];

  // Calculate total return for each holding
  const enhancedData = data?.allocations.map(item => ({
    ...item,
    total_return: item.gain_loss + item.dividends_received,
    total_return_percent: item.cost_basis > 0 
      ? ((item.gain_loss + item.dividends_received) / item.cost_basis * 100) 
      : 0
  })) || [];

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
        className="bg-gray-800/50"
      />
    </div>
  );
}