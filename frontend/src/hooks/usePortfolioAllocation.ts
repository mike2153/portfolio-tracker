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
  daily_change: number;
  daily_change_percent: number;
  sector?: string;
  region?: string;
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
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [usePortfolioAllocation] Starting allocation data fetch...`);
      
      const { data, error: sessionError } = await supabase.auth.getSession();
      console.log(`[${timestamp}] [usePortfolioAllocation] Session status:`, {
        hasSession: !!data?.session,
        hasToken: !!data?.session?.access_token,
        userEmail: data?.session?.user?.email,
        userId: data?.session?.user?.id,
        sessionError: sessionError
      });
      
      if (!data?.session?.access_token) {
        const error = new Error('Not authenticated');
        console.error(`[${timestamp}] [usePortfolioAllocation] Authentication error:`, error);
        throw error;
      }
      
      const token = data.session.access_token;
      console.log(`[${timestamp}] [usePortfolioAllocation] Using token:`, token.substring(0, 20) + '...');
      
      const url = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/allocation?t=${Date.now()}`;
      console.log(`[${timestamp}] [usePortfolioAllocation] Request URL:`, url);
      console.log(`[${timestamp}] [usePortfolioAllocation] Request headers:`, {
        'Authorization': `Bearer ${token.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      });
      
      const startTime = performance.now();
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const endTime = performance.now();
      
      console.log(`[${timestamp}] [usePortfolioAllocation] Response received:`, {
        status: response.status,
        statusText: response.statusText,
        duration: `${(endTime - startTime).toFixed(2)}ms`,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.text();
          console.error(`[${timestamp}] [usePortfolioAllocation] Error response body:`, errorBody);
        } catch (e) {
          console.error(`[${timestamp}] [usePortfolioAllocation] Could not read error body:`, e);
        }
        const error = new Error(`Failed to fetch allocation data: ${response.status} ${response.statusText}`);
        console.error(`[${timestamp}] [usePortfolioAllocation] Request failed:`, error);
        throw error;
      }
      
      const result = await response.json();
      console.log(`[${timestamp}] [usePortfolioAllocation] API Response:`, {
        success: result.success,
        hasData: !!result.data,
        allocationsCount: result.data?.allocations?.length || 0,
        summary: result.data?.summary
      });
      
      if (!result.success || !result.data) {
        console.error(`[${timestamp}] [usePortfolioAllocation] Invalid response format:`, result);
        throw new Error('Invalid response format');
      }
      
      console.log(`[${timestamp}] [usePortfolioAllocation] Success! Returning data with ${result.data.allocations?.length || 0} allocations`);
      if (result.data.allocations?.length > 0) {
        console.log(`[${timestamp}] [usePortfolioAllocation] Sample allocation:`, result.data.allocations[0]);
      }
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