import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../AuthProvider';
import { authFetch } from '@portfolio-tracker/shared';

interface GainerLoserRow {
  ticker: string;
  name: string;
  value: number;
  changePercent: number;
  changeValue: number;
}

interface GainLossCardProps {
  type: 'gainers' | 'losers';
  title: string;
}

const ListSkeleton = ({ title }: { title: string }) => (
  <View className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
    <View className="flex-row items-center justify-between mb-4">
      <Text className="text-lg font-semibold text-white">{title}</Text>
    </View>
    <ActivityIndicator size="small" color="#3B82F6" />
  </View>
);

const GainLossCard = ({ type, title }: GainLossCardProps) => {
  const isGainers = type === 'gainers';
  const { userId } = useDashboard();
  const { user, session } = useAuth();

  const queryFn = async () => {
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }
    
    const response = await authFetch(`/api/dashboard/${type}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${type}`);
    }
    
    return response.json();
  };
  
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', type, userId],
    queryFn,
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <ListSkeleton title={title} />;
  }
  
  if (isError) {
    return <Text className="text-red-500">Error loading {type}</Text>;
  }

  const items = data?.data?.items || [];

  // Add defensive function to safely format percentage
  const safeFormatPercent = (changePercent: any): string => {
    // Handle null/undefined
    if (changePercent == null) {
      return '0.00';
    }
    
    // If it's already a number
    if (typeof changePercent === 'number') {
      return changePercent.toFixed(2);
    }
    
    // If it's a string, try to parse it
    if (typeof changePercent === 'string') {
      const parsed = parseFloat(changePercent);
      if (!isNaN(parsed)) {
        return parsed.toFixed(2);
      } else {
        return changePercent;
      }
    }
    
    // Fallback for any other type
    return String(changePercent);
  };

  // Add defensive function to safely format currency value
  const safeFormatCurrency = (changeValue: any): string => {
    // Handle null/undefined
    if (changeValue == null) {
      return '0';
    }
    
    // If it's already a number
    if (typeof changeValue === 'number') {
      return changeValue.toLocaleString();
    }
    
    // If it's a string, try to parse it
    if (typeof changeValue === 'string') {
      const parsed = parseFloat(changeValue);
      if (!isNaN(parsed)) {
        return parsed.toLocaleString();
      } else {
        return changeValue;
      }
    }
    
    // Fallback for any other type
    return String(changeValue);
  };

  return (
    <View className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-white">{title}</Text>
        <TouchableOpacity>
          <Text className="text-sm text-blue-400">See all</Text>
        </TouchableOpacity>
      </View>
      <View className="space-y-4">
        {items.map((item: GainerLoserRow) => (
          <View key={item.ticker} className="flex-row items-center space-x-4">
            <View className="flex-shrink-0">
              {/* Using a placeholder for logo */}
              <View className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
                <Text className="font-bold text-white">{item.ticker.charAt(0)}</Text>
              </View>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-medium text-white" numberOfLines={1}>{item.name}</Text>
              <Text className="text-sm text-gray-400" numberOfLines={1}>{item.ticker}</Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-semibold text-white">${safeFormatCurrency(item.value)}</Text>
              <View className={`flex-row items-center ${isGainers ? 'text-green-400' : 'text-red-400'}`}>
                <Ionicons 
                  name={isGainers ? 'arrow-up' : 'arrow-down'} 
                  size={12} 
                  color={isGainers ? '#4ADE80' : '#F87171'} 
                />
                <Text className={`text-xs ${isGainers ? 'text-green-400' : 'text-red-400'}`}>
                  {safeFormatPercent(item.changePercent)}% (${safeFormatCurrency(item.changeValue)})
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default GainLossCard;