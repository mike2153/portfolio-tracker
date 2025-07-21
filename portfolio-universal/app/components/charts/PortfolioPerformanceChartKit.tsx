import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { front_api_get_performance, front_api_get_stock_prices, formatCurrency, formatPercentage, COLORS } from '@portfolio-tracker/shared';
import StockChartKit from './StockChartKit';

interface PortfolioPerformanceChartProps {
  height?: number;
  initialPeriod?: string;
  benchmarks?: string[];
}

const DEFAULT_BENCHMARKS = ['SPY', 'QQQ', 'DIA'];

const PortfolioPerformanceChartKit: React.FC<PortfolioPerformanceChartProps> = ({
  height = 300,
  initialPeriod = '1Y',
  benchmarks = ['SPY'],
}) => {
  const [timePeriod, setTimePeriod] = useState(initialPeriod);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState(benchmarks);
  const [compareMode, setCompareMode] = useState(true);

  // Fetch portfolio performance data
  const { data: portfolioData, isLoading: portfolioLoading } = useQuery({
    queryKey: ['portfolio-performance', timePeriod],
    queryFn: () => front_api_get_performance(timePeriod),
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch benchmark data for each selected benchmark
  const benchmarkQueries = selectedBenchmarks.map(symbol => 
    useQuery({
      queryKey: ['benchmark-prices', symbol, timePeriod],
      queryFn: () => front_api_get_stock_prices(symbol, timePeriod),
      enabled: selectedBenchmarks.includes(symbol),
    })
  );

  // Combine all data into chart format
  const chartData = useMemo(() => {
    const data = [];

    // Add portfolio data
    if (portfolioData?.data?.portfolio_history) {
      data.push({
        symbol: 'Portfolio',
        data: portfolioData.data.portfolio_history.map((point: any) => ({
          date: point.date || new Date().toISOString(),
          price: point.value || 0,
        })),
        color: COLORS.primary,
      });
    }

    // Add benchmark data
    benchmarkQueries.forEach((query, index) => {
      if (query.data?.success && query.data.data?.price_data) {
        const symbol = selectedBenchmarks[index];
        data.push({
          symbol,
          data: query.data.data.price_data.map((point: any) => ({
            date: point.time || point.date || new Date().toISOString(),
            price: point.close || 0,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
          })),
        });
      }
    });

    return data;
  }, [portfolioData, benchmarkQueries, selectedBenchmarks]);

  const isLoading = portfolioLoading || benchmarkQueries.some(q => q.isLoading);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (!chartData.length) return null;

    return chartData.map(series => {
      const firstValue = series.data[0]?.price || 1;
      const lastValue = series.data[series.data.length - 1]?.price || 1;
      const change = lastValue - firstValue;
      const changePercent = (change / firstValue) * 100;

      return {
        symbol: series.symbol,
        currentValue: lastValue,
        change,
        changePercent,
        color: series.color,
      };
    });
  }, [chartData]);

  const handleBenchmarkToggle = (symbol: string) => {
    if (selectedBenchmarks.includes(symbol)) {
      setSelectedBenchmarks(prev => prev.filter(s => s !== symbol));
    } else {
      setSelectedBenchmarks(prev => [...prev, symbol]);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading performance data...</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Performance Metrics */}
      {performanceMetrics && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.metricsContainer}
        >
          {performanceMetrics.map(metric => {
            const isPositive = metric.changePercent >= 0;
            return (
              <View
                key={metric.symbol}
                style={[
                  styles.metricCard,
                  { borderLeftColor: metric.color || COLORS.neutral }
                ]}
              >
                <Text style={styles.metricSymbol}>{metric.symbol}</Text>
                <Text style={styles.metricValue}>
                  {formatCurrency(metric.currentValue)}
                </Text>
                <Text style={[
                  styles.metricChange,
                  { color: isPositive ? COLORS.positive : COLORS.negative }
                ]}>
                  {isPositive ? '+' : ''}{formatCurrency(metric.change)} ({formatPercentage(metric.changePercent / 100)})
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Chart Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => setCompareMode(!compareMode)}
          style={[
            styles.modeButton,
            compareMode && styles.modeButtonActive
          ]}
        >
          <Text style={[
            styles.modeButtonText,
            compareMode && styles.modeButtonTextActive
          ]}>
            {compareMode ? 'Percentage' : 'Absolute'}
          </Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {DEFAULT_BENCHMARKS.map(symbol => (
            <TouchableOpacity
              key={symbol}
              onPress={() => handleBenchmarkToggle(symbol)}
              style={[
                styles.benchmarkButton,
                selectedBenchmarks.includes(symbol) && styles.benchmarkButtonActive
              ]}
            >
              <Text style={[
                styles.benchmarkButtonText,
                selectedBenchmarks.includes(symbol) && styles.benchmarkButtonTextActive
              ]}>
                {symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chart */}
      <StockChartKit
        data={chartData}
        height={height}
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
        showLegend={true}
        title="Portfolio Performance"
        compareMode={compareMode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  metricsContainer: {
    marginBottom: 16,
  },
  metricCard: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    borderLeftWidth: 4,
    minWidth: 150,
  },
  metricSymbol: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricChange: {
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.background,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  modeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: COLORS.text,
  },
  benchmarkButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    marginLeft: 8,
  },
  benchmarkButtonActive: {
    backgroundColor: COLORS.primary,
  },
  benchmarkButtonText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  benchmarkButtonTextActive: {
    color: COLORS.text,
  },
});

export default PortfolioPerformanceChartKit;