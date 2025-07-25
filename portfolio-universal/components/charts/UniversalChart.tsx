import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryArea,
  VictoryAxis,
  VictoryTheme,
  VictoryContainer,
  VictoryPie,
  VictoryLabel,
  VictoryLegend,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory-native';
import { format } from 'date-fns';

export interface UniversalChartProps {
  data: Array<{
    name: string;
    data: Array<[number, number]> | Array<{ x: number | string; y: number }>;
    color?: string;
  }>;
  type?: 'line' | 'area' | 'donut';
  height?: number;
  title?: string;
  xAxisType?: 'datetime' | 'category' | 'numeric';
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  showLegend?: boolean;
  showToolbar?: boolean;
  timeRanges?: Array<{ id: string; label: string }>;
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  colors?: string[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  darkMode?: boolean;
  // Donut chart specific props
  donutLabels?: string[];
  donutValues?: number[];
}

const defaultTimeRanges = [
  { id: '7D', label: '7D' },
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: '1Y', label: '1Y' },
  { id: 'YTD', label: 'YTD' },
  { id: 'MAX', label: 'MAX' }
];

export default function UniversalChart({
  data,
  type = 'area',
  height = 350,
  title,
  xAxisType = 'datetime',
  yAxisFormatter = (value) => value.toFixed(1),
  tooltipFormatter = (value) => value.toFixed(2),
  showLegend = false,
  showToolbar = false,
  timeRanges = defaultTimeRanges,
  selectedRange,
  onRangeChange,
  colors = ['#10b981', '#6b7280', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'],
  isLoading = false,
  error = null,
  onRetry,
  className = '',
  darkMode = true,
  donutLabels,
  donutValues,
}: UniversalChartProps) {
  
  // Convert data for Victory Native format
  const victoryData = useMemo(() => {
    if (type === 'donut' && donutLabels && donutValues) {
      return donutLabels.map((label, index) => ({
        x: label,
        y: donutValues[index],
      }));
    }

    return data.map((series) => ({
      name: series.name,
      data: series.data.map((point) => {
        if (Array.isArray(point)) {
          return { x: point[0], y: point[1] };
        }
        return point;
      }),
      color: series.color || colors[data.indexOf(series) % colors.length],
    }));
  }, [data, type, donutLabels, donutValues, colors]);

  // Determine dynamic colors based on performance
  const dynamicColors = useMemo(() => {
    if (type === 'donut' || !data || data.length === 0) return colors;
    
    const seriesData = data[0].data;
    if (!seriesData || seriesData.length === 0) return colors;
    
    const getValue = (pt: any): number => {
      if (Array.isArray(pt)) {
        return pt[1];
      } else {
        return pt.y;
      }
    };
    
    const firstValue = getValue(seriesData[0]);
    const lastValue = getValue(seriesData[seriesData.length - 1]);
    const isPositive = lastValue >= firstValue;
    const primaryColor = isPositive ? '#10b981' : '#ef4444';
    
    return [primaryColor, ...colors.slice(1)];
  }, [data, colors, type]);

  // Chart theme configuration
  const chartTheme = useMemo(() => ({
    ...VictoryTheme.material,
    axis: {
      style: {
        axis: { stroke: darkMode ? '#374151' : '#e5e7eb' },
        axisLabel: { fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 },
        grid: { stroke: darkMode ? '#374151' : '#e5e7eb', strokeDasharray: '3' },
        ticks: { stroke: darkMode ? '#374151' : '#e5e7eb' },
        tickLabels: { fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 11 },
      },
    },
  }), [darkMode]);

  // Loading state
  if (isLoading) {
    return (
      <View className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
        {title && (
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-white">{title}</Text>
          </View>
        )}
        <View className="flex items-center justify-center" style={{ height }}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-300 mt-2">Loading chart data...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
        {title && (
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-white">{title}</Text>
          </View>
        )}
        <View className="flex items-center justify-center" style={{ height }}>
          <View className="items-center">
            <Text className="text-lg font-semibold text-red-400">Failed to load chart data</Text>
            <Text className="text-sm text-red-400 mt-2">{error}</Text>
            {onRetry && (
              <TouchableOpacity 
                onPress={onRetry}
                className="mt-4 px-4 py-2 bg-red-600 rounded-md"
              >
                <Text className="text-white">Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Render donut chart
  if (type === 'donut') {
    const pieData = victoryData as Array<{ x: string; y: number }>;
    const totalValue = pieData.reduce((sum, item) => sum + item.y, 0);

    return (
      <View className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
        {title && (
          <View className="mb-4">
            <Text className="text-lg font-semibold text-white">{title}</Text>
          </View>
        )}
        
        <View style={{ height, alignItems: 'center' }}>
          <VictoryPie
            data={pieData}
            width={height}
            height={height}
            innerRadius={height * 0.3}
            padAngle={2}
            labelRadius={height * 0.4}
            colorScale={dynamicColors}
            labelComponent={
              <VictoryLabel
                style={{
                  fontSize: 11,
                  fill: darkMode ? '#e5e7eb' : '#374151',
                }}
              />
            }
          />
          
          {/* Center label */}
          <View className="absolute" style={{ top: height / 2 - 30 }}>
            <Text className="text-center text-gray-400 text-sm">Total</Text>
            <Text className="text-center text-white text-lg font-semibold">
              {yAxisFormatter(totalValue)}
            </Text>
          </View>
        </View>

        {/* Legend */}
        {showLegend && (
          <View className="mt-4">
            {pieData.slice(0, 5).map((item, index) => (
              <View key={item.x} className="flex-row items-center justify-between py-1">
                <View className="flex-row items-center">
                  <View 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: dynamicColors[index % dynamicColors.length] }}
                  />
                  <Text className="text-gray-300 text-sm">{item.x}</Text>
                </View>
                <Text className="text-gray-400 text-sm">
                  {yAxisFormatter(item.y)} ({((item.y / totalValue) * 100).toFixed(1)}%)
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // Render line/area chart
  return (
    <View className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
      {/* Header with title and time range controls */}
      <View className="flex-row items-center justify-between mb-4">
        {title && (
          <Text className="text-lg font-semibold text-white">{title}</Text>
        )}
        
        {timeRanges && timeRanges.length > 0 && onRangeChange && (
          <View className="flex-row">
            {timeRanges.map(range => (
              <TouchableOpacity
                key={range.id}
                onPress={() => onRangeChange(range.id)}
                className={`px-3 py-1 mx-0.5 rounded-md ${
                  selectedRange === range.id 
                    ? 'bg-emerald-600' 
                    : 'bg-gray-700'
                }`}
              >
                <Text className={`text-xs ${
                  selectedRange === range.id ? 'text-white' : 'text-gray-300'
                }`}>
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Chart */}
      <View style={{ height }}>
        <VictoryChart
          theme={chartTheme}
          height={height}
          padding={{ left: 70, top: 20, right: 20, bottom: 50 }}
          containerComponent={
            <VictoryVoronoiContainer
              labels={({ datum }) => tooltipFormatter(datum.y)}
              labelComponent={
                <VictoryTooltip
                  style={{ fontSize: 12, fill: darkMode ? '#e5e7eb' : '#374151' }}
                  flyoutStyle={{ 
                    fill: darkMode ? '#1f2937' : '#ffffff',
                    stroke: darkMode ? '#374151' : '#e5e7eb'
                  }}
                />
              }
            />
          }
        >
          {/* X Axis */}
          <VictoryAxis
            dependentAxis={false}
            style={chartTheme.axis.style}
            tickFormat={(x) => {
              if (xAxisType === 'datetime') {
                return format(new Date(x), 'MMM dd');
              }
              return x;
            }}
          />
          
          {/* Y Axis */}
          <VictoryAxis
            dependentAxis
            style={chartTheme.axis.style}
            tickFormat={yAxisFormatter}
          />
          
          {/* Data series */}
          {victoryData.map((series, index) => {
            const ChartComponent = type === 'area' ? VictoryArea : VictoryLine;
            return (
              <ChartComponent
                key={series.name}
                data={series.data}
                style={{
                  data: { 
                    stroke: series.color,
                    fill: type === 'area' ? series.color : 'none',
                    fillOpacity: type === 'area' ? 0.3 : 1,
                    strokeWidth: 2,
                  },
                }}
                interpolation="catmullRom"
              />
            );
          })}
          
          {/* Legend */}
          {showLegend && (
            <VictoryLegend
              x={height * 0.2}
              y={10}
              orientation="horizontal"
              gutter={20}
              style={{
                labels: { fontSize: 12, fill: darkMode ? '#e5e7eb' : '#374151' },
              }}
              data={victoryData.map((series, index) => ({
                name: series.name,
                symbol: { fill: series.color },
              }))}
            />
          )}
        </VictoryChart>
      </View>
    </View>
  );
}