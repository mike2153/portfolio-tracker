/**
 * Shared hook for portfolio allocation data
 * Used by both dashboard and analytics pages for consistent data
 */
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthProvider';

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
  const { user } = useAuth();

  const query: UseQueryResult<AllocationData, Error> = useQuery({
    queryKey: ['portfolioAllocation', user?.id],
    queryFn: async (): Promise<AllocationData> => {
      if (!user) throw new Error('No authenticated user');
      
      const token = await user.getAccessToken();
      if (!token) throw new Error('No authentication token');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/portfolio/allocation`, {
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
      
      if (!result.success || !result.data) {
        throw new Error('Invalid response format');
      }
      
      return result.data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is relatively stable
    cacheTime: 10 * 60 * 1000, // 10 minutes cache retention
    refetchOnWindowFocus: false, // Don't refetch on window focus to reduce API calls
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}