import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryLabel,
  VictoryTheme,
  VictoryContainer,
  VictoryLegend,
  VictoryGroup,
  VictoryClipContainer
} from 'victory-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';
import { formatCurrency, formatPercentage } from '@portfolio-tracker/shared';

const { width: screenWidth } = Dimensions.get('window');

export interface PerformanceDataPoint {
  date: string;
  value: number;
}

export interface ChartData {
  portfolio_performance: PerformanceDataPoint[];
  benchmark_performance: PerformanceDataPoint[];
  performance_metrics?: {
    portfolio_return_pct: number;
    index_return_pct: number;
    outperformance_pct: number;
  };
}

interface Props {
  data: ChartData | null;
  height?: number;
  timePeriod: string;
  onPeriodChange: (period: string) => void;
  isLoading?: boolean;
  compareMode?: boolean;
  benchmarkSymbol?: string;
}

const TIME_PERIODS = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

export default function PortfolioComparisonChart({
  data,
  height = 300,
  timePeriod,
  onPeriodChange,
  isLoading = false,
  compareMode = false,
  benchmarkSymbol = 'SPY'
}: Props) {
  const { theme } = useTheme();
  const [displayMode, setDisplayMode] = useState<'value' | 'percent'>('value');
  const styles = getStyles(theme);

  // Process data for Victory Native
  const chartData = useMemo(() => {
    if (!data || (!data.portfolio_performance?.length && !data.benchmark_performance?.length)) {
      return null;
    }

    // Convert date strings to Date objects and prepare data
    const processDataPoints = (points: PerformanceDataPoint[], isPortfolio: boolean) => {
      if (!points || points.length === 0) return [];
      
      const firstValue = points[0]?.value || 1;
      
      return points.map((point, index) => {
        const date = new Date(point.date);
        const value = point.value || 0;
        
        let displayValue = value;
        if (displayMode === 'percent' && firstValue !== 0) {
          displayValue = ((value - firstValue) / firstValue) * 100;
        }
        
        return {
          x: date,
          y: displayValue
        };
      });
    };

    const portfolioData = processDataPoints(data.portfolio_performance, true);
    const benchmarkData = processDataPoints(data.benchmark_performance, false);

    // Find the date range
    const allDates = [...portfolioData, ...benchmarkData].map(d => d.x);
    const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date();
    const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date();

    // Find min and max Y values to adjust domain
    const allYValues = [...portfolioData, ...benchmarkData].map(d => d.y).filter(v => !isNaN(v) && isFinite(v));
    
    if (allYValues.length === 0) {
      return {
        portfolioData,
        benchmarkData,
        minDate,
        maxDate,
        minY: -10,
        maxY: 10,
        hasData: false
      };
    }
    
    let minY = Math.min(...allYValues);
    let maxY = Math.max(...allYValues);
    
    // Calculate the data range
    const dataRange = maxY - minY;
    
    // For percentage mode, ensure we show meaningful scale
    if (displayMode === 'percent') {
      // Add padding based on the range
      const padding = Math.max(dataRange * 0.2, 5); // At least 5% padding
      const adjustedMinY = minY - padding;
      const adjustedMaxY = maxY + padding;
      
      // If range is very small, ensure minimum scale
      if (dataRange < 10) {
        const center = (minY + maxY) / 2;
        return {
          portfolioData,
          benchmarkData,
          minDate,
          maxDate,
          minY: center - 10,
          maxY: center + 10,
          hasData: portfolioData.length > 0 || benchmarkData.length > 0
        };
      }
      
      return {
        portfolioData,
        benchmarkData,
        minDate,
        maxDate,
        minY: adjustedMinY,
        maxY: adjustedMaxY,
        hasData: portfolioData.length > 0 || benchmarkData.length > 0
      };
    }
    
    // For value mode, always include 0 for reference
    minY = Math.min(minY, 0);
    maxY = Math.max(maxY, 0);
    
    // Add proportional padding
    const range = maxY - minY;
    const padding = range * 0.1; // 10% padding
    const adjustedMinY = minY - padding;
    const adjustedMaxY = maxY + padding;

    return {
      portfolioData,
      benchmarkData,
      minDate,
      maxDate,
      minY: adjustedMinY,
      maxY: adjustedMaxY,
      hasData: portfolioData.length > 0 || benchmarkData.length > 0
    };
  }, [data, displayMode, benchmarkSymbol]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.buttonBackground} />
        <Text style={styles.loadingText}>Loading performance data...</Text>
      </View>
    );
  }

  if (!chartData || !chartData.hasData) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>No performance data available</Text>
        <Text style={styles.emptySubtext}>Add transactions to see your portfolio performance</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with controls */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Portfolio Performance</Text>
          {data?.performance_metrics && (
            <View style={styles.metricsContainer}>
              <Text style={styles.metricText}>
                Portfolio: {formatPercentage(data.performance_metrics.portfolio_return_pct / 100)}
              </Text>
              <Text style={styles.metricText}>
                {benchmarkSymbol}: {formatPercentage(data.performance_metrics.index_return_pct / 100)}
              </Text>
              <Text style={[
                styles.metricText,
                data.performance_metrics.outperformance_pct >= 0 ? styles.positive : styles.negative
              ]}>
                {data.performance_metrics.outperformance_pct >= 0 ? '+' : ''}
                {formatPercentage(data.performance_metrics.outperformance_pct / 100)}
              </Text>
            </View>
          )}
        </View>
        
        {/* Display mode toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, displayMode === 'value' && styles.toggleButtonActive]}
            onPress={() => setDisplayMode('value')}
          >
            <Text style={[styles.toggleText, displayMode === 'value' && styles.toggleTextActive]}>$</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, displayMode === 'percent' && styles.toggleButtonActive]}
            onPress={() => setDisplayMode('percent')}
          >
            <Text style={[styles.toggleText, displayMode === 'percent' && styles.toggleTextActive]}>%</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <VictoryChart
          width={screenWidth}
          height={height}
          padding={{ left: 20, right: 70, top: 20, bottom: 50 }}
          theme={VictoryTheme.material}
          style={{
            background: { fill: "transparent" }
          }}
          domain={{
            x: [chartData.minDate, chartData.maxDate],
            y: [chartData.minY, chartData.maxY]
          }}
        >
          {/* X Axis */}
          <VictoryAxis
            dependentAxis={false}
            style={{
              axis: { stroke: theme.colors.border },
              ticks: { stroke: theme.colors.border },
              tickLabels: { 
                fill: theme.colors.secondaryText,
                fontSize: 12,
                angle: -45
              },
              grid: { stroke: theme.colors.border, strokeOpacity: 0.2 }
            }}
            fixLabelOverlap={true}
            tickFormat={(date) => {
              const d = new Date(date);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          
          {/* Y Axis */}
          <VictoryAxis
            dependentAxis
            orientation="right"
            style={{
              axis: { stroke: theme.colors.border },
              ticks: { stroke: theme.colors.border },
              tickLabels: { 
                fill: theme.colors.secondaryText,
                fontSize: 12
              },
              grid: { stroke: theme.colors.border, strokeOpacity: 0.2 }
            }}
            tickFormat={(t) => displayMode === 'percent' ? `${t}%` : formatCurrency(t)}
          />

          {/* Zero baseline - only show if 0 is within the visible range */}
          {chartData.minY <= 0 && chartData.maxY >= 0 && (
            <VictoryLine
              data={[
                { x: chartData.minDate, y: 0 },
                { x: chartData.maxDate, y: 0 }
              ]}
              style={{
                data: { stroke: theme.colors.border, strokeWidth: 1, strokeDasharray: "3,3" }
              }}
            />
          )}

          {/* Lines wrapped in group for proper clipping */}
          <VictoryGroup>
            {/* Portfolio Line */}
            {chartData.portfolioData.length > 0 && (
              <VictoryLine
                data={chartData.portfolioData}
                style={{
                  data: { stroke: theme.colors.positive, strokeWidth: 2 }
                }}
                interpolation="monotoneX"
              />
            )}

            {/* Benchmark Line */}
            {chartData.benchmarkData.length > 0 && (
              <VictoryLine
                data={chartData.benchmarkData}
                style={{
                  data: { stroke: theme.colors.blueAccent, strokeWidth: 2 }
                }}
                interpolation="monotoneX"
              />
            )}
          </VictoryGroup>
        </VictoryChart>

        {/* Legend */}
        <View style={styles.legend}>
          {chartData.portfolioData.length > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.positive }]} />
              <Text style={styles.legendText}>Portfolio</Text>
            </View>
          )}
          {chartData.benchmarkData.length > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.blueAccent }]} />
              <Text style={styles.legendText}>{benchmarkSymbol}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Time Period Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodSelector}>
        {TIME_PERIODS.map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              timePeriod === period && styles.periodButtonActive
            ]}
            onPress={() => onPeriodChange(period)}
          >
            <Text style={[
              styles.periodButtonText,
              timePeriod === period && styles.periodButtonTextActive
            ]}>
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    padding: 0,
    marginVertical: 0,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.colors.secondaryText,
    fontSize: 16,
  },
  emptyContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: theme.colors.secondaryText,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  metricText: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
  positive: {
    color: theme.colors.positive,
  },
  negative: {
    color: theme.colors.negative,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.buttonBackground,
  },
  toggleText: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: theme.colors.buttonText,
  },
  chartContainer: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  periodSelector: {
    marginTop: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  periodButtonActive: {
    backgroundColor: theme.colors.buttonBackground,
    borderColor: theme.colors.buttonBackground,
  },
  periodButtonText: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: theme.colors.buttonText,
  },
});