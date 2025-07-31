'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  DashboardContextType,
  DashboardContextState,
  PerformanceData,
  PerformanceDataPoint,
  getPerformanceValue
} from '@/types/dashboard';

// Performance data types now imported from centralized types

// Dashboard context type now imported from centralized types

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
  const { user } = useAuth();
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
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          return;
        }

        if (session?.user) {
          setUserId(session.user.id);
        }
      } catch (unexpectedError) {
        console.error('Unexpected error during user initialization:', unexpectedError);
      }
    };
    initUserId();
  }, []);

  // Helper function to get value from either new or legacy format
  // Now uses typed helper from centralized types
  const getValue = (dataPoint: PerformanceDataPoint): number => getPerformanceValue(dataPoint);

  // Calculate dollar and percent gains from performance data
  const portfolioDollarGain = React.useMemo(() => {
    if (!performanceData?.portfolioPerformance?.length) return 0;
    const first = getValue(performanceData.portfolioPerformance[0]);
    const last = getValue(performanceData.portfolioPerformance[performanceData.portfolioPerformance.length - 1]);
    return last - first;
  }, [performanceData]);

  const portfolioPercentGain = React.useMemo(() => {
    if (!performanceData?.portfolioPerformance?.length) return 0;
    const first = getValue(performanceData.portfolioPerformance[0]);
    const last = getValue(performanceData.portfolioPerformance[performanceData.portfolioPerformance.length - 1]);
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [performanceData]);

  const benchmarkDollarGain = React.useMemo(() => {
    if (!performanceData?.benchmarkPerformance?.length) return 0;
    const first = getValue(performanceData.benchmarkPerformance[0]);
    const last = getValue(performanceData.benchmarkPerformance[performanceData.benchmarkPerformance.length - 1]);
    return last - first;
  }, [performanceData]);

  const benchmarkPercentGain = React.useMemo(() => {
    if (!performanceData?.benchmarkPerformance?.length) return 0;
    const first = getValue(performanceData.benchmarkPerformance[0]);
    const last = getValue(performanceData.benchmarkPerformance[performanceData.benchmarkPerformance.length - 1]);
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [performanceData]);

  // Ensure all context values are properly typed
  const contextValue: DashboardContextType = React.useMemo(() => ({
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
  if (userId === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}; 