import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { usePortfolioSummary } from '../../hooks/usePortfolioComplete';
import { front_api_client } from '@portfolio-tracker/shared';
import PortfolioComparisonChart from './PortfolioComparisonChart';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';
import { formatPercentage } from '@portfolio-tracker/shared';

interface PortfolioPerformanceChartProps {
  height?: number;
  initialPeriod?: string;
  benchmarks?: string[];
}

const PortfolioPerformanceChartKit: React.FC<PortfolioPerformanceChartProps> = ({
  height = 300,
  initialPeriod = '1Y',
  benchmarks = ['SPY'],
}) => {
  const { theme } = useTheme();
  const [timePeriod] = useState(initialPeriod);
  const [selectedBenchmark] = useState(benchmarks[0] || 'SPY');
  
  const { totalValue } = usePortfolioSummary();
  
  // Use the same historical performance API as the web dashboard
  const { 
    data: performanceData, 
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['mobile-performance', timePeriod, selectedBenchmark],
    queryFn: async () => {
      console.log('[PortfolioPerformanceChartKit] Fetching historical performance data...');
      try {
        const response = await front_api_client.get(
          `/api/portfolio/performance/historical?period=${timePeriod}&benchmark=${selectedBenchmark}`
        );
        console.log('[PortfolioPerformanceChartKit] Performance response:', response);
        return response;
      } catch (error) {
        console.error('[PortfolioPerformanceChartKit] Performance API error:', error);
        throw error;
      }
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });
  
  const hasData = !!performanceData && performanceData.success;

  // Transform historical performance data for chart display (same as web dashboard)
  const chartData = useMemo(() => {
    if (!performanceData || !performanceData.success) {
      console.log('[PortfolioPerformanceChartKit] ❌ No performance data available');
      return null;
    }

    console.log('[PortfolioPerformanceChartKit] ✓ Using historical performance data:', {
      portfolioPoints: performanceData.portfolio_performance?.length || 0,
      benchmarkPoints: performanceData.benchmark_performance?.length || 0,
      period: performanceData.period,
      benchmark: performanceData.benchmark
    });

    return {
      portfolio_performance: performanceData.portfolio_performance || [],
      benchmark_performance: performanceData.benchmark_performance || [],
      performance_metrics: {
        portfolio_return_pct: performanceData.performance_metrics?.portfolio_return_pct || 0,
        index_return_pct: performanceData.performance_metrics?.index_return_pct || 0,
        outperformance_pct: performanceData.performance_metrics?.outperformance_pct || 0,
        daily_change: 0, // Not available in historical API
        daily_change_percent: 0, // Not available in historical API
        volatility: 0, // Not available in historical API
      }
    };
  }, [performanceData]);

  const styles = getStyles(theme);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.greenAccent} />
        <Text style={styles.loadingText}>Loading performance data...</Text>
      </View>
    );
  }

  if (!hasData || !chartData) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>📊</Text>
        <Text style={styles.errorTitle}>No Performance Data</Text>
        <Text style={styles.errorSubtitle}>
          Add holdings to your portfolio to see performance charts
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      {/* Performance Metrics Summary */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Total Return</Text>
          <Text style={[
            styles.metricValue,
            (chartData.performance_metrics?.portfolio_return_pct || 0) >= 0 ? styles.positive : styles.negative
          ]}>
            {formatPercentage((chartData.performance_metrics?.portfolio_return_pct || 0) / 100)}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>{selectedBenchmark} Return</Text>
          <Text style={[
            styles.metricValue,
            (chartData.performance_metrics?.index_return_pct || 0) >= 0 ? styles.positive : styles.negative
          ]}>
            {formatPercentage((chartData.performance_metrics?.index_return_pct || 0) / 100)}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Outperformance</Text>
          <Text style={[
            styles.metricValue,
            (chartData.performance_metrics?.outperformance_pct || 0) >= 0 ? styles.positive : styles.negative
          ]}>
            {chartData.performance_metrics?.outperformance_pct >= 0 ? '+' : ''}{formatPercentage((chartData.performance_metrics?.outperformance_pct || 0) / 100)}
          </Text>
        </View>
      </View>

      {/* Chart Component */}
      <PortfolioComparisonChart
        data={chartData}
        height={height - 40} // Reduced from 80 to 40
        timePeriod={timePeriod}
        onPeriodChange={() => {}} // Disabled for now
        benchmarkSymbol={selectedBenchmark}
        isLoading={isLoading}
      />
    </View>
  );
};

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: 0,
  },
  
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.secondaryText,
    fontSize: 14,
  },
  
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  
  errorText: {
    fontSize: 48,
    marginBottom: theme.spacing.sm,
  },
  
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginBottom: theme.spacing.xs,
  },
  
  errorSubtitle: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    textAlign: 'center',
  },
  
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8, // Reduced from theme.spacing.md
    paddingBottom: 8, // Reduced from theme.spacing.md
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  
  metricLabel: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginBottom: theme.spacing.xs,
  },
  
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  metricValueNeutral: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  
  positive: {
    color: theme.colors.positive,
  },
  
  negative: {
    color: theme.colors.negative,
  },
});

export default PortfolioPerformanceChartKit;