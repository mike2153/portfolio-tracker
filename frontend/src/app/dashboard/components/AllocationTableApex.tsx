'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import ApexListView from '@/components/charts/ApexListView';
import type { ListViewColumn, ListViewAction } from '@/components/charts/ApexListView';
import { AllocationRow } from '@/types/api';
import { cn } from '@/lib/utils';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '@/components/AuthProvider';

interface AllocationRowExtended extends AllocationRow {
  id: string;
  accentColorClass: string;
}

const AllocationTableApex = () => {
  useDashboard();
  const { user } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboardAllocation'],
    queryFn: async () => {
      //console.log('[AllocationTableApex] Making API call for allocation data...');
      // Note: Allocation API needs to be implemented in backend
      // For now, return sample data for demonstration
      //console.log('[AllocationTableApex] Allocation API not yet implemented, showing sample data');
      
      // Sample data for demonstration
      const sampleData = {
        data: {
          rows: [
            {
              groupKey: 'AAPL',
              value: 50000,
              invested: 45000,
              gainValue: 5000,
              gainPercent: 11.11,
              allocation: 35.7,
              accentColor: 'emerald'
            },
            {
              groupKey: 'MSFT',
              value: 30000,
              invested: 28000,
              gainValue: 2000,
              gainPercent: 7.14,
              allocation: 21.4,
              accentColor: 'blue'
            },
            {
              groupKey: 'GOOGL',
              value: 25000,
              invested: 26000,
              gainValue: -1000,
              gainPercent: -3.85,
              allocation: 17.9,
              accentColor: 'purple'
            },
            {
              groupKey: 'TSLA',
              value: 20000,
              invested: 18000,
              gainValue: 2000,
              gainPercent: 11.11,
              allocation: 14.3,
              accentColor: 'orange'
            },
            {
              groupKey: 'AMZN',
              value: 15000,
              invested: 16000,
              gainValue: -1000,
              gainPercent: -6.25,
              allocation: 10.7,
              accentColor: 'red'
            }
          ]
        }
      };
      
      return sampleData;
    },
    enabled: !!user,
  });

 // console.log('[AllocationTableApex] Query state:', { data, isLoading, isError, error });

  // Transform data for ApexListView
  const { listViewData, columns, actions } = useMemo(() => {
    const rows = data?.data?.rows || [];
    //console.log('[AllocationTableApex] Processing allocation rows:', rows.length);

    // Transform rows to extended format
    const transformedData: AllocationRowExtended[] = rows.map((row: AllocationRow, index: number) => ({
      ...row,
      id: row.groupKey || `row_${index}`,
      accentColorClass: `bg-${row.accentColor}-500`
    }));

    // Define columns
    const tableColumns: ListViewColumn<AllocationRowExtended>[] = [
      {
        key: 'groupKey',
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
        key: 'value',
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
        key: 'invested',
        label: 'Amount Invested',
        sortable: true,
        render: (value) => (
          <div className="text-sm text-gray-400">${Number(value).toLocaleString()}</div>
        ),
        width: '130px'
      },
      {
        key: 'gainValue',
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
        key: 'gainPercent',
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
        key: 'allocation',
        label: 'Allocation',
        sortable: true,
        render: (value) => (
          <div className="font-medium text-white">
            {safeFormatAllocation(value)}
          </div>
        ),
        width: '100px'
      }
    ];

    // Define actions
    const tableActions: ListViewAction<AllocationRowExtended>[] = [
      {
        label: 'View Details',
        onClick: (item) => {
          console.log('[AllocationTableApex] View details for:', item.groupKey);
          // TODO: Navigate to stock details page
        },
        className: 'text-blue-400 hover:text-blue-300'
      },
      {
        label: 'Add Transaction',
        onClick: (item) => {
          console.log('[AllocationTableApex] Add transaction for:', item.groupKey);
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
  }, [data]);

  // Add defensive function to safely format allocation
  const safeFormatAllocation = (allocation: any): string => {
    console.log('[AllocationTableApex] safeFormatAllocation called with:', allocation, 'type:', typeof allocation);
    
    // Handle null/undefined
    if (allocation == null) {
      console.log('[AllocationTableApex] safeFormatAllocation: allocation is null/undefined, returning 0.00%');
      return '0.00%';
    }
    
    // If it's already a number
    if (typeof allocation === 'number') {
      console.log('[AllocationTableApex] safeFormatAllocation: allocation is number, using toFixed');
      return `${allocation.toFixed(2)}%`;
    }
    
    // If it's a string, try to parse it
    if (typeof allocation === 'string') {
      console.log('[AllocationTableApex] safeFormatAllocation: allocation is string, attempting to parse');
      const parsed = parseFloat(allocation);
      if (!isNaN(parsed)) {
        console.log('[AllocationTableApex] safeFormatAllocation: successfully parsed string to number:', parsed);
        return `${parsed.toFixed(2)}%`;
      } else {
        console.log('[AllocationTableApex] safeFormatAllocation: failed to parse string, returning raw value');
        return `${allocation}%`;
      }
    }
    
    // Fallback for any other type
    return `${String(allocation)}%`;
  };

  return (
    <ApexListView
      data={listViewData}
      columns={columns}
      actions={actions}
      title="Portfolio Allocation"
      isLoading={isLoading}
      error={isError ? String(error) : null}
      onRetry={refetch}
      emptyMessage="No allocation data available. API implementation pending."
      showSearch={true}
      showPagination={false}
      searchPlaceholder="Search holdings..."
      getItemKey={(item) => item.id}
      className="rounded-xl bg-gray-800/80 shadow-lg"
    />
  );
};

export default AllocationTableApex;