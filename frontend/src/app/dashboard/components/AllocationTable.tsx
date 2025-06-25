'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api';
import { ChartSkeleton } from './Skeletons';
import { AllocationRow } from '@/types/api';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

const AllocationTable = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    init();
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboardAllocation', userId],
    queryFn: () => dashboardAPI.getAllocation(),
    enabled: !!userId,
  });

  if (isLoading) return <ChartSkeleton />;
  if (isError) return <div className="text-red-500">Error loading allocation: {String(error)}</div>;

  const rows = data?.data?.rows || [];

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
            {rows.map((row: AllocationRow) => (
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
                <td className="px-4 py-3 text-right font-medium text-white">{row.allocation.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllocationTable; 
