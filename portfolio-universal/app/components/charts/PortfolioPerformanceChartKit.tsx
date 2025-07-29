import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { front_api_get_performance, formatPercentage } from '@portfolio-tracker/shared';
import PortfolioComparisonChart from './PortfolioComparisonChart';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';

interface PortfolioPerformanceChartProps {
  height?: number;
  initialPeriod?: string;
  benchmarks?: string[];
}

// Map display periods to API periods
const PERIOD_MAP: { [key: string]: string } = {
  '1D': '7D',   // API doesn't support 1D, use 7D
  '1W': '7D',
  '1M': '1M',
  '3M': '3M',
  '6M': '1Y',   // API doesn't support 6M, use 1Y
  '1Y': '1Y',
  '5Y': 'MAX',  // API doesn't support 5Y, use MAX
  'MAX': 'MAX',
  'YTD': 'YTD'
};

const PortfolioPerformanceChartKit: React.FC<PortfolioPerformanceChartProps> = ({
  height = 300,
  initialPeriod = '1Y',
  benchmarks = ['SPY'],
}) => {
  const { theme } = useTheme();
  const [timePeriod, setTimePeriod] = useState(initialPeriod);
  const [selectedBenchmark] = useState(benchmarks[0] || 'SPY');
  
  // Map the display period to API period
  const apiPeriod = PERIOD_MAP[timePeriod] || '1Y';

  // Fetch portfolio performance data using the correct API endpoint
  const { data: performanceData, isLoading, error } = useQuery({
    queryKey: ['portfolio-performance', apiPeriod, selectedBenchmark],
    queryFn: async () => {
      console.log('[PortfolioPerformanceChartKit] Fetching performance data:', {
        period: apiPeriod,
        benchmark: selectedBenchmark
      });
      
      try {
        const result = await front_api_get_performance(apiPeriod, selectedBenchmark);
        console.log('[PortfolioPerformanceChartKit] API response:', {
          success: result?.success,
          hasPortfolioData: !!result?.portfolio_performance,
          portfolioDataLength: result?.portfolio_performance?.length || 0,
          hasBenchmarkData: !!result?.benchmark_performance,
          benchmarkDataLength: result?.benchmark_performance?.length || 0,
          metadata: result?.metadata,
          metrics: result?.performance_metrics
        });
        
        if (!result?.success) {
          console.error('[PortfolioPerformanceChartKit] API returned success: false', result);
          throw new Error(result?.error || 'Failed to fetch performance data');
        }
        
        return result;
      } catch (error) {
        console.error('[PortfolioPerformanceChartKit] Error fetching performance data:', error);
        throw error;
      }
    },
  });

  // Transform data for the chart component
  const chartData = useMemo(() => {
    if (!performanceData) return null;
    
    // The API returns data in the correct format already
    return {
      portfolio_performance: performanceData.portfolio_performance || [],
      benchmark_performance: performanceData.benchmark_performance || [],
      performance_metrics: performanceData.performance_metrics
    };
  }, [performanceData]);

  const styles = getStyles(theme);

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>Failed to load performance data</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Performance Summary */}
      {performanceData?.performance_metrics && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Portfolio</Text>
            <Text style={[
              styles.summaryValue,
              performanceData.performance_metrics.portfolio_return_pct >= 0 ? styles.positive : styles.negative
            ]}>
              {formatPercentage(performanceData.performance_metrics.portfolio_return_pct / 100)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{selectedBenchmark}</Text>
            <Text style={[
              styles.summaryValue,
              performanceData.performance_metrics.index_return_pct >= 0 ? styles.positive : styles.negative
            ]}>
              {formatPercentage(performanceData.performance_metrics.index_return_pct / 100)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Outperformance</Text>
            <Text style={[
              styles.summaryValue,
              performanceData.performance_metrics.outperformance_pct >= 0 ? styles.positive : styles.negative
            ]}>
              {performanceData.performance_metrics.outperformance_pct >= 0 ? '+' : ''}
              {formatPercentage(performanceData.performance_metrics.outperformance_pct / 100)}
            </Text>
          </View>
        </View>
      )}

      {/* Chart */}
      <PortfolioComparisonChart
        data={chartData}
        height={height}
        timePeriod={timePeriod}
        onPeriodChange={setTimePeriod}
        isLoading={isLoading}
        benchmarkSymbol={selectedBenchmark}
      />
    </View>
  );
};

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  errorContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: theme.colors.negative,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: theme.colors.secondaryText,
    fontSize: 14,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
    padding: 16,
    marginBottom: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  positive: {
    color: theme.colors.positive,
  },
  negative: {
    color: theme.colors.negative,
  },
});

export default PortfolioPerformanceChartKit;