import React, { Suspense } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { DashboardProvider } from '../../shared/contexts/DashboardContext';
import KPIGrid from '../components/dashboard/KPIGrid';
import FxTicker from '../components/dashboard/FxTicker';
// import UniversalChart from '../../components/charts/UniversalChart'; // Temporarily disabled due to Victory Native issues
import { usePerformance } from '../../shared/hooks/usePerformance';
import { usePortfolioAllocation } from '../../shared/hooks/usePortfolioAllocation';

import SimpleChartSkeleton from '../../components/charts/SimpleChartSkeleton';

const ChartSkeleton = SimpleChartSkeleton;

const ListSkeleton = ({ title }: { title: string }) => (
  <View className="bg-gray-800/50 rounded-xl p-4">
    <Text className="text-lg font-semibold text-white mb-4">{title}</Text>
    <ActivityIndicator size="small" color="#3B82F6" />
  </View>
);

const PortfolioChart = () => {
  const { data, isLoading } = usePerformance('1Y', 'SPY');

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!data || !data.portfolio_performance || !data.benchmark_performance) {
    return null;
  }

  // Transform performance data for UniversalChart
  const chartData = [
    {
      name: 'Portfolio',
      data: data.portfolio_performance.map(d => ({
        x: new Date(d.date).getTime(),
        y: d.value || d.total_value || 0
      })),
      color: '#3B82F6',
    },
    {
      name: 'Benchmark',
      data: data.benchmark_performance.map(d => ({
        x: new Date(d.date).getTime(),
        y: d.value || d.total_value || 0
      })),
      color: '#6B7280',
    },
  ];

  return (
    <View className="bg-gray-800/80 rounded-xl p-4">
      <Text className="text-lg font-semibold text-white mb-4">Portfolio Performance</Text>
      <ChartSkeleton />
    </View>
  );
};

const AllocationChart = () => {
  const { data: allocationData, isLoading } = usePortfolioAllocation();

  if (isLoading) {
    return <ChartSkeleton />;
  }

  if (!allocationData) {
    return null;
  }

  // Transform allocation data for UniversalChart donut format
  const donutLabels = allocationData.map(item => item.name);
  const donutValues = allocationData.map(item => item.value);

  return (
    <View className="bg-gray-800/80 rounded-xl p-4">
      <Text className="text-lg font-semibold text-white mb-4">Portfolio Allocation</Text>
      <ChartSkeleton />
    </View>
  );
};

const DailyMovers = () => {
  // Placeholder for now - would need to implement the API hook
  return (
    <View className="bg-gray-800/80 rounded-xl p-4">
      <Text className="text-lg font-semibold text-white mb-4">Daily Movers</Text>
      <Text className="text-gray-400">Coming soon...</Text>
    </View>
  );
};

export default function DashboardScreen() {
  return (
    <DashboardProvider>
      <ScrollView className="flex-1 bg-gray-900">
        <View className="p-4 space-y-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">My Portfolio</Text>
          </View>

          <KPIGrid />

          <Suspense fallback={<ChartSkeleton />}>
            <AllocationChart />
          </Suspense>

          <FxTicker />

          <Suspense fallback={<ChartSkeleton />}>
            <PortfolioChart />
          </Suspense>

          <Suspense fallback={<ListSkeleton title="Daily movers" />}>
            <DailyMovers />
          </Suspense>
        </View>
      </ScrollView>
    </DashboardProvider>
  );
}