'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

// Chart type definitions for strict typing - using the actual ApexCharts supported types
type ChartType = 'line' | 'area' | 'bar' | 'pie' | 'donut' | 'candlestick' | 'heatmap' | 'scatter';

interface ChartComponentProps {
  options: ApexOptions;
  series: number[] | { name: string; data: number[] }[];
  type: ChartType;
  height?: string | number;
  width?: string | number;
  className?: string;
}

interface ChartContextType {
  loadChart: (chartType: ChartType) => Promise<React.ComponentType<ChartComponentProps>>;
  isLoading: boolean;
  loadedCharts: Set<ChartType>;
}

const ChartContext = createContext<ChartContextType | null>(null);

// Simple dynamic import without complex wrapping
const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[350px] bg-gray-50 rounded-lg animate-pulse">
      <div className="text-gray-500">Loading chart...</div>
    </div>
  )
});

// Create a simple chart component
const createChartComponent = (chartType: ChartType): React.FC<ChartComponentProps> => {
  const ChartComponent: React.FC<ChartComponentProps> = (props) => {
    // Guard against null or undefined props
    if (!props) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`ChartComponent of type '${chartType}' rendered with null props.`);
      }
      return null; // Render nothing if props are null
    }

    const { 
      options = {}, 
      series = [], 
      type = chartType, 
      height = 350, 
      width = '100%',
      className = ''
    } = props;

    return (
      <div className={className}>
        <ReactApexChart
          options={options}
          series={series}
          type={type}
          height={height}
          width={width}
        />
      </div>
    );
  };

  ChartComponent.displayName = `ChartComponent(${chartType})`;
  return ChartComponent;
};

// Chart loader cache to prevent duplicate imports
const chartCache = new Map<ChartType, React.ComponentType<ChartComponentProps>>();

export const ChartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedCharts, setLoadedCharts] = useState<Set<ChartType>>(new Set());

  const loadChart = useCallback(async (chartType: ChartType): Promise<React.ComponentType<ChartComponentProps>> => {
    // Return cached chart if already loaded
    if (chartCache.has(chartType)) {
      return chartCache.get(chartType)!;
    }

    setIsLoading(true);
    
    try {
      // Create a simple chart component
      const ChartComponent = createChartComponent(chartType);
      
      chartCache.set(chartType, ChartComponent);
      setLoadedCharts(prev => new Set([...prev, chartType]));
      return ChartComponent;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const contextValue: ChartContextType = {
    loadChart,
    isLoading,
    loadedCharts
  };

  return (
    <ChartContext.Provider value={contextValue}>
      {children}
    </ChartContext.Provider>
  );
};

// Hook for accessing chart loader
export const useChart = (): ChartContextType => {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within a ChartProvider');
  }
  return context;
};

// Prebuilt chart components for common use cases
export const LazyLineChart = createChartComponent('line');
export const LazyAreaChart = createChartComponent('area');
export const LazyBarChart = createChartComponent('bar');
export const LazyPieChart = createChartComponent('pie');
export const LazyCandlestickChart = createChartComponent('candlestick');