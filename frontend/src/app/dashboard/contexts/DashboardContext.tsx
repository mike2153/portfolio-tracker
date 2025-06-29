'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dashboardAPI } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

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
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [selectedBenchmark, setSelectedBenchmark] = useState('SPY');
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Initialize user ID
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    init();
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

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}; 