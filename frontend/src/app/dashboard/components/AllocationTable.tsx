'use client';

import { useQuery } from '@tanstack/react-query';
import { ChartSkeleton } from './Skeletons';
import { AllocationRow } from '@/types/api';
import { cn } from '@/lib/utils';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '@/components/AuthProvider';

const AllocationTable = () => {
  useDashboard();
  const { user } = useAuth();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboardAllocation'],
    queryFn: async () => {
      //console.log('[AllocationTable] Making API call for allocation data...');
      // Note: Allocation API needs to be implemented in backend
      // For now, return empty allocation data
      console.log('[AllocationTable] Allocation API not yet implemented, showing empty state');
      const result = { data: { rows: [] } };
      //console.log('[AllocationTable] API response:', result);
      //////console.log('[AllocationTable] API response data type:', typeof result.data);
      ////console.log('[AllocationTable] API response rows:', result?.data?.rows);
      
      // Debug loop removed – will add back once API returns real rows
      
      return result;
    },
    enabled: !!user,
  });

  //console.log('[AllocationTable] Query state:', { data, isLoading, isError, error });

  if (isLoading) {
    console.log('[AllocationTable] Still loading, showing skeleton');
    return <ChartSkeleton />;
  }
  if (isError) {
    console.log('[AllocationTable] Error occurred:', error);
    return <div className="text-red-500">Error loading allocation: {String(error)}</div>;
  }

  const rows = data?.data?.rows || [];
  //console.log('[AllocationTable] Allocation rows:', rows);
  //console.log('[AllocationTable] Number of rows:', rows.length);

  // Add defensive function to safely format allocation
  const safeFormatAllocation = (allocation: any): string => {
    //console.log('[AllocationTable] safeFormatAllocation called with:', allocation, 'type:', typeof allocation);
    
    // Handle null/undefined
    if (allocation == null) {
      //console.log('[AllocationTable] safeFormatAllocation: allocation is null/undefined, returning 0.00%');
      return '0.00%';
    }
    
    // If it's already a number
    if (typeof allocation === 'number') {
      //console.log('[AllocationTable] safeFormatAllocation: allocation is number, using toFixed');
      return `${allocation.toFixed(2)}%`;
    }
    
    // If it's a string, try to parse it
    if (typeof allocation === 'string') {
      //console.log('[AllocationTable] safeFormatAllocation: allocation is string, attempting to parse');
      const parsed = parseFloat(allocation);
      if (!isNaN(parsed)) {
        //console.log('[AllocationTable] safeFormatAllocation: successfully parsed string to number:', parsed);
        return `${parsed.toFixed(2)}%`;
      } else {
        //console.log('[AllocationTable] safeFormatAllocation: failed to parse string, returning raw value');
        return `${allocation}%`;
      }
    }
    
    // Fallback for any other type
    //
    return `${String(allocation)}%`;
  };

  return (
    <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Portfolio Allocation</h3>
        {/* Add controls here */}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-700 text-sm text-gray-400">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium text-right">Value / Invested</th>
              <th className="px-4 py-2 font-medium text-right">Gain</th>
              <th className="px-4 py-2 font-medium text-right">Allocation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: AllocationRow) => {
              //console.log(`[AllocationTable] Rendering row ${index}:`, row);
              //console.log(`[AllocationTable] Row ${index} allocation details:`, {
                /*allocation: row.allocation,
                type: typeof row.allocation,
                value: row.allocation
              });*/
              
              return (
                <tr key={row.groupKey} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <span className={cn("mr-3 h-4 w-1 rounded-full", `bg-${row.accentColor}-500`)}></span>
                      <span className="font-medium text-white">{row.groupKey}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-medium text-white">${Number(row.value).toLocaleString()}</div>
                    <div className="text-sm text-gray-400">${Number(row.invested).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className={cn("font-medium", Number(row.gainValue) >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {Number(row.gainValue) >= 0 ? '+' : ''}${Number(row.gainValue).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-400">{Number(row.gainPercent).toFixed(2)}%</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white">
                    {safeFormatAllocation(row.allocation)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllocationTable; 
