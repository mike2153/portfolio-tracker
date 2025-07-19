/**
 * Shared hook for portfolio allocation data
 * Used by both dashboard and analytics pages for consistent data
 */
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export interface AllocationItem {
  symbol: string;
  company_name: string;
  quantity: number;
  current_price: number;
  cost_basis: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  dividends_received: number;
  realized_pnl: number;
  allocation_percent: number;
  color: string;
}

export interface AllocationSummary {
  total_value: number;
  total_cost: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  total_dividends: number;
}

export interface AllocationData {
  allocations: AllocationItem[];
  summary: AllocationSummary;
}

export interface UsePortfolioAllocationResult {
  data: AllocationData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePortfolioAllocation(): UsePortfolioAllocationResult {
  const query: UseQueryResult<AllocationData, Error> = useQuery({
    queryKey: ['portfolioAllocation'],
    queryFn: async (): Promise<AllocationData> => {
      console.log('[usePortfolioAllocation] Fetching allocation data...');
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.access_token) throw new Error('Not authenticated');
      
      const token = data.session.access_token;
      
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/allocation?t=${Date.now()}`;
      console.log('[usePortfolioAllocation] Making API request to:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch allocation data: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('[usePortfolioAllocation] API Response:', result);
      
      if (!result.success || !result.data) {
        console.error('[usePortfolioAllocation] Invalid response format:', result);
        throw new Error('Invalid response format');
      }
      
      console.log('[usePortfolioAllocation] Returning data with', result.data.allocations?.length || 0, 'allocations');
      return result.data;
    },
    staleTime: 0, // Always consider data stale to force fresh fetches
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time (formerly cacheTime)
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: 'always' // Always refetch on mount
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}