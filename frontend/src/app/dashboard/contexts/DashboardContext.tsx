'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { KPIGridSkeleton } from '../components/Skeletons';

interface PerformanceData {
  portfolioPerformance: Array<{
    date: string;
    total_value: number;
    indexed_performance: number;
  }>;
  benchmarkPerformance: Array<{
    date: string;
    total_value: number;
    indexed_performance: number;
  }>;
  comparison?: {
    portfolio_return: number;
    benchmark_return: number;
    outperformance: number;
  };
}

interface DashboardContextType {
  // Selected values
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  selectedBenchmark: string;
  setSelectedBenchmark: (benchmark: string) => void;
  
  // Performance data
  performanceData: PerformanceData | null;
  setPerformanceData: (data: PerformanceData | null) => void;
  
  // Calculated values for KPIs
  portfolioDollarGain: number;
  portfolioPercentGain: number;
  benchmarkDollarGain: number;
  benchmarkPercentGain: number;
  
  // Loading state
  isLoadingPerformance: boolean;
  setIsLoadingPerformance: (loading: boolean) => void;
  
  // User ID
  userId: string | null;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const searchParams = useSearchParams();
  const initialPeriod = searchParams.get('period') || '1Y';
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [selectedBenchmark, setSelectedBenchmark] = useState('SPY');
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Update selectedPeriod when URL changes
  useEffect(() => {
    const period = searchParams.get('period');
    if (period) setSelectedPeriod(period);
  }, [searchParams]);

  // Initialize user ID from the session
  useEffect(() => {
    const initUserId = async () => {
      console.log('[DashboardProvider] === USER INITIALIZATION START ===');
      console.log('[DashboardProvider] Timestamp:', new Date().toISOString());
      console.log('[DashboardProvider] Attempting to initialize user ID...');
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('[DashboardProvider] Supabase session response:');
        console.log('[DashboardProvider] - Error:', error);
        console.log('[DashboardProvider] - Session exists:', !!session);
        console.log('[DashboardProvider] - User exists:', !!session?.user);
        
        if (error) {
          console.error('[DashboardProvider] ❌ Error getting session:', error);
          console.error('[DashboardProvider] Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText
          });
          return;
        }
        
        if (session?.user) {
          console.log(`[DashboardProvider] ✅ User session found!`);
          console.log(`[DashboardProvider] User details:`, {
            id: session.user.id,
            email: session.user.email,
            created_at: session.user.created_at,
            last_sign_in_at: session.user.last_sign_in_at
          });
          console.log(`[DashboardProvider] Access token present:`, !!session.access_token);
          console.log(`[DashboardProvider] Token expires at:`, session.expires_at);
          console.log(`[DashboardProvider] Setting userId state to: ${session.user.id}`);
          setUserId(session.user.id);
          console.log(`[DashboardProvider] ✅ User ID state updated successfully`);
        } else {
          console.warn('[DashboardProvider] ⚠️ No active session found. User is not logged in.');
          console.log('[DashboardProvider] Session data:', session);
        }
      } catch (unexpectedError) {
        console.error('[DashboardProvider] 💥 Unexpected error during user initialization:', unexpectedError);
      }
      
      console.log('[DashboardProvider] === USER INITIALIZATION END ===');
    };
    initUserId();
  }, []);

  // Calculate dollar and percent gains from performance data
  const portfolioDollarGain = React.useMemo(() => {
    if (!performanceData?.portfolioPerformance?.length) return 0;
    const first = performanceData.portfolioPerformance[0].total_value;
    const last = performanceData.portfolioPerformance[performanceData.portfolioPerformance.length - 1].total_value;
    return last - first;
  }, [performanceData]);

  const portfolioPercentGain = React.useMemo(() => {
    if (!performanceData?.portfolioPerformance?.length) return 0;
    const first = performanceData.portfolioPerformance[0].total_value;
    const last = performanceData.portfolioPerformance[performanceData.portfolioPerformance.length - 1].total_value;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [performanceData]);

  const benchmarkDollarGain = React.useMemo(() => {
    if (!performanceData?.benchmarkPerformance?.length) return 0;
    const first = performanceData.benchmarkPerformance[0].total_value;
    const last = performanceData.benchmarkPerformance[performanceData.benchmarkPerformance.length - 1].total_value;
    return last - first;
  }, [performanceData]);

  const benchmarkPercentGain = React.useMemo(() => {
    if (!performanceData?.benchmarkPerformance?.length) return 0;
    const first = performanceData.benchmarkPerformance[0].total_value;
    const last = performanceData.benchmarkPerformance[performanceData.benchmarkPerformance.length - 1].total_value;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [performanceData]);

  const value: DashboardContextType = React.useMemo(() => ({
    selectedPeriod,
    setSelectedPeriod,
    selectedBenchmark,
    setSelectedBenchmark,
    performanceData,
    setPerformanceData,
    portfolioDollarGain,
    portfolioPercentGain,
    benchmarkDollarGain,
    benchmarkPercentGain,
    isLoadingPerformance,
    setIsLoadingPerformance,
    userId,
  }), [
    selectedPeriod,
    selectedBenchmark,
    performanceData,
    portfolioDollarGain,
    portfolioPercentGain,
    benchmarkDollarGain,
    benchmarkPercentGain,
    isLoadingPerformance,
    userId,
  ]);

  // Do not render children until the userId has been determined.
  // This prevents child components from making authenticated API calls before the session is ready.
  console.log('[DashboardProvider] === RENDER DECISION ===');
  console.log('[DashboardProvider] Current userId state:', userId);
  console.log('[DashboardProvider] userId type:', typeof userId);
  console.log('[DashboardProvider] userId === null:', userId === null);
  console.log('[DashboardProvider] Timestamp:', new Date().toISOString());
  
  if (userId === null) {
    console.log('[DashboardProvider] 🚫 BLOCKING RENDER: userId is null, showing skeleton');
    console.log('[DashboardProvider] This prevents child components from making authenticated API calls before session is ready');
    return <KPIGridSkeleton />; // Or any other suitable loading state
  }
  
  console.log('[DashboardProvider] ✅ ALLOWING RENDER: userId is available, rendering children');
  console.log('[DashboardProvider] userId value:', userId);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}; 