import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { formatCurrency, formatPercentage } from '@portfolio-tracker/shared';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme();
  const styles = getStyles(theme);

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
      // Handle empty series data
      if (!series.data || series.data.length === 0) {
        return {
          data: [],
          color: () => index === 0 ? colors.blueAccent : colors.greenAccent,
          strokeWidth: 2,
        };
      }
      
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
        
        if (compareMode && firstPrice !== 0) {
          const percentChange = ((value / firstPrice - 1) * 100);
          // Prevent infinity or NaN values
          return isFinite(percentChange) ? percentChange : 0;
        }
        return isFinite(value) ? value : 0;
      }).filter(v => v !== null) as number[];

      return {
        data: values,
        color: () => series.color || (index === 0 ? theme.colors.blueAccent : theme.colors.greenAccent),
        strokeWidth: 2,
      };
    });

    return { labels, datasets };
  }, [data, compareMode, theme]);

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: compareMode ? 1 : 0,
    color: (opacity = 1) => theme.colors.blueAccent,
    labelColor: (opacity = 1) => theme.colors.secondaryText,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '0',
    },
    propsForLabels: {
      fontSize: 10,
    },
    propsForBackgroundLines: {
      strokeDasharray: '', // solid lines
      stroke: theme.colors.border,
      strokeWidth: 0.5, // thinner lines
    },
  };

  const timePeriods = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

  // Check if we have valid data to display
  if (!processedData.datasets.length || 
      processedData.datasets.every(ds => ds.data.length === 0) ||
      processedData.labels.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data available</Text>
          <Text style={styles.noDataSubtext}>Price data will appear here once loaded</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={{
            labels: processedData.labels.length > 0 ? processedData.labels : [''],
            datasets: processedData.datasets.map(ds => ({
              ...ds,
              data: ds.data.length > 0 ? ds.data : [0]
            })),
          }}
          width={chartWidth}
          height={height}
          yAxisLabel={compareMode ? '' : '$'}
          yAxisSuffix={compareMode ? '%' : ''}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withInnerLines={false}
          withOuterLines={false}
          withVerticalLines={false}
          withHorizontalLines={true}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          segments={3}
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
                      (index === 0 ? theme.colors.blueAccent : theme.colors.greenAccent) 
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

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primaryText,
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
    color: theme.colors.secondaryText,
  },
  periodSelector: {
    marginTop: 16,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  periodButtonActive: {
    backgroundColor: theme.colors.buttonBackground,
    borderColor: theme.colors.buttonBackground,
  },
  periodButtonText: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: theme.colors.buttonText,
  },
  noDataText: {
    textAlign: 'center',
    color: theme.colors.secondaryText,
    fontSize: 16,
  },
  noDataContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataSubtext: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default StockChartKit;