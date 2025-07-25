import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface KPIValue {
  value: number | string;
  sub_label: string;
  deltaPercent?: number | string;
  is_positive: boolean;
}

interface KPICardProps {
  title: string;
  data: KPIValue & { percentGain?: number };
  prefix?: string;
  suffix?: string;
  showPercentage?: boolean;
  percentValue?: number;
  showValueAsPercent?: boolean;
}

const KPICard = ({ 
  title, 
  data, 
  prefix = "", 
  suffix = "", 
  showPercentage = false, 
  percentValue, 
  showValueAsPercent = false 
}: KPICardProps) => {
  
  if (!data || typeof data !== 'object') {
    return (
      <View className="rounded-xl border border-red-700 bg-red-800/50 p-4 shadow-md">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-red-400">{title}</Text>
        </View>
        <View className="mt-2">
          <Text className="text-2xl font-semibold text-red-300">Error</Text>
          <Text className="text-xs text-red-500">Invalid data</Text>
        </View>
      </View>
    );
  }
  
  const { value, sub_label, deltaPercent, is_positive } = data;
  
  // Add defensive function to safely format value
  const safeFormatValue = (val: any): string => {
    // Handle null/undefined
    if (val == null) {
      return '0.00';
    }
    
    // If it's already a number
    if (typeof val === 'number') {
      if (isNaN(val)) {
        return '—';
      }
      // For percentage values, don't use thousands separator
      if (showValueAsPercent) {
        return val.toFixed(2);
      }
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // If it's a string, try to parse it
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        if (showValueAsPercent) {
          return parsed.toFixed(2);
        }
        return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        return '—';
      }
    }
    
    // Fallback for any other type
    return String(val);
  };

  // Add defensive function to safely format delta percentage
  const safeFormatDelta = (delta: any): string => {
    // Handle null/undefined
    if (delta == null) {
      return '0.0';
    }
    
    // If it's already a number
    if (typeof delta === 'number') {
      return delta.toFixed(1);
    }
    
    // If it's a string, try to parse it
    if (typeof delta === 'string') {
      const parsed = parseFloat(delta);
      if (!isNaN(parsed)) {
        return parsed.toFixed(1);
      } else {
        return delta;
      }
    }
    
    // Fallback for any other type
    return String(delta);
  };

  const finalSafeValue = safeFormatValue(value);
  const finalSafeDelta = deltaPercent ? safeFormatDelta(deltaPercent) : null;
  const finalDisplayValue = `${prefix}${finalSafeValue}${suffix}`;
  
  // Format percentage for Performance card
  const formatPercentageDisplay = (percent: number | undefined) => {
    if (percent === undefined) return '';
    const sign = percent >= 0 ? '+' : '';
    return ` (${sign}${percent.toFixed(2)}%)`;
  };

  return (
    <View className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 shadow-md">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-gray-400">{title}</Text>
        <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
      </View>
      <View className="mt-2">
        <View className="flex-row items-baseline">
          <Text className="text-2xl font-semibold text-white">
            {finalDisplayValue}
          </Text>
          {showPercentage && (percentValue !== undefined || data.percentGain !== undefined) && (
            <Text className="ml-2 text-lg font-medium text-gray-300">
              {formatPercentageDisplay(percentValue || data.percentGain)}
            </Text>
          )}
        </View>
        <View className="mt-1 flex-row items-center space-x-2">
          {deltaPercent && (
            <View className={`flex-row items-center ${is_positive ? 'text-green-400' : 'text-red-400'}`}>
              <Ionicons 
                name={is_positive ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color={is_positive ? '#4ADE80' : '#F87171'} 
              />
              <Text className={is_positive ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                {finalSafeDelta}%
              </Text>
            </View>
          )}
          <Text className="text-xs text-gray-500">{sub_label}</Text>
        </View>
      </View>
    </View>
  );
};

export default KPICard;