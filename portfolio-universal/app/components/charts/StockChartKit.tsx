import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { formatCurrency, formatPercentage, COLORS } from '@portfolio-tracker/shared';

const { width: screenWidth } = Dimensions.get('window');

interface StockData {
  date: Date | string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

interface ChartData {
  symbol: string;
  data: StockData[];
  color?: string;
}

interface StockChartProps {
  data: ChartData[];
  height?: number;
  timePeriod?: string;
  onTimePeriodChange?: (period: string) => void;
  showLegend?: boolean;
  title?: string;
  compareMode?: boolean;
}

const StockChartKit: React.FC<StockChartProps> = ({
  data,
  height = 300,
  timePeriod = '1Y',
  onTimePeriodChange,
  showLegend = true,
  title,
  compareMode = false,
}) => {
  const chartWidth = screenWidth - 32;

  // Process data for percentage comparison mode
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { labels: [], datasets: [] };

    // Get all unique dates
    const allDates = new Set<string>();
    data.forEach(series => {
      series.data.forEach(point => {
        try {
          const date = new Date(point.date);
          if (!isNaN(date.getTime())) {
            allDates.add(date.toISOString().split('T')[0]);
          }
        } catch (e) {
          console.warn('Invalid date:', point.date);
        }
      });
    });

    // Sort dates
    const sortedDates = Array.from(allDates).sort();
    
    // Take a sample of dates for labels (every nth date)
    const labelInterval = Math.max(1, Math.floor(sortedDates.length / 6));
    const labels = sortedDates
      .filter((_, index) => index % labelInterval === 0)
      .map(date => {
        try {
          const d = new Date(date);
          if (!isNaN(d.getTime())) {
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }
          return '';
        } catch (e) {
          return '';
        }
      })
      .filter(label => label !== '');

    // Process each series
    const datasets = data.map((series, index) => {
      const firstPrice = series.data[0]?.price || series.data[0]?.close || 1;
      
      const values = sortedDates.map(date => {
        const point = series.data.find(p => {
          try {
            const pDate = new Date(p.date);
            if (!isNaN(pDate.getTime())) {
              return pDate.toISOString().split('T')[0] === date;
            }
            return false;
          } catch (e) {
            return false;
          }
        });
        
        if (!point) return null;
        
        const value = point.price || point.close || 0;
        
        if (compareMode) {
          return ((value / firstPrice - 1) * 100);
        }
        return value;
      }).filter(v => v !== null) as number[];

      return {
        data: values,
        color: () => series.color || (index === 0 ? COLORS.primary : COLORS.success),
        strokeWidth: 2,
      };
    });

    return { labels, datasets };
  }, [data, compareMode]);

  const chartConfig = {
    backgroundColor: COLORS.surface,
    backgroundGradientFrom: COLORS.surface,
    backgroundGradientTo: COLORS.surface,
    decimalPlaces: compareMode ? 1 : 0,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(209, 213, 219, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '0',
    },
    propsForLabels: {
      fontSize: 10,
    },
  };

  const timePeriods = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

  if (!processedData.datasets.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={{
            labels: processedData.labels,
            datasets: processedData.datasets,
          }}
          width={chartWidth}
          height={height}
          yAxisLabel={compareMode ? '' : '$'}
          yAxisSuffix={compareMode ? '%' : ''}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withInnerLines={true}
          withOuterLines={true}
          withVerticalLines={true}
          withHorizontalLines={true}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          segments={5}
        />
      </ScrollView>

      {/* Legend */}
      {showLegend && data.length > 1 && (
        <View style={styles.legend}>
          {data.map((series, index) => (
            <View key={series.symbol} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { 
                    backgroundColor: series.color || 
                      (index === 0 ? COLORS.primary : COLORS.success) 
                  },
                ]}
              />
              <Text style={styles.legendText}>{series.symbol}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Time period selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodSelector}
      >
        {timePeriods.map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              timePeriod === period && styles.periodButtonActive,
            ]}
            onPress={() => onTimePeriodChange?.(period)}
          >
            <Text
              style={[
                styles.periodButtonText,
                timePeriod === period && styles.periodButtonTextActive,
              ]}
            >
              {period}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  periodSelector: {
    marginTop: 16,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: COLORS.text,
  },
  noDataText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 16,
    paddingVertical: 40,
  },
});

export default StockChartKit;