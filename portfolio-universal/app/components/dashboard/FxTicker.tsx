import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

interface FxRate {
  pair: string;
  rate: number | string;
  change: number | string;
}

const FxTickerSkeleton = () => (
  <View className="h-8 bg-gray-800/50 rounded-xl" />
);

const FxRateItem = ({ rate }: { rate: FxRate }) => {
  const rateValue = typeof rate.rate === 'number' ? rate.rate : Number(rate.rate);
  const changeValue = typeof rate.change === 'number' ? rate.change : Number(rate.change);
  const isPositive = changeValue >= 0;

  return (
    <View className="flex-row items-center space-x-2 mx-4">
      <Text className="text-sm font-medium text-gray-400">{rate.pair}</Text>
      <Text className="text-sm font-semibold text-white">
        {isNaN(rateValue) ? 'N/A' : `$${rateValue.toFixed(2)}`}
      </Text>
      <View className={`flex-row items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        <Ionicons
          name={isPositive ? 'arrow-up' : 'arrow-down'}
          size={12}
          color={isPositive ? '#4ADE80' : '#F87171'}
        />
        <Text className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isNaN(changeValue) ? 'N/A' : `${changeValue.toFixed(2)}%`}
        </Text>
      </View>
    </View>
  );
};

const FxTicker = () => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = Dimensions.get('window');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fxRates'],
    queryFn: () => {
      // Note: FX rates API needs to be implemented in backend
      // For now, return mock data for demonstration
      return Promise.resolve({
        data: {
          rates: [
            { pair: 'EUR/USD', rate: 1.0925, change: 0.15 },
            { pair: 'GBP/USD', rate: 1.2680, change: -0.08 },
            { pair: 'USD/JPY', rate: 149.50, change: 0.25 },
            { pair: 'USD/CHF', rate: 0.8875, change: -0.12 },
          ]
        }
      });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const rates = data?.data?.rates || [];

  // Animate the ticker
  useEffect(() => {
    if (rates.length === 0) return;

    const animation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -screenWidth,
        duration: 20000,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();
  }, [rates, scrollX, screenWidth]);

  if (isLoading) return <FxTickerSkeleton />;
  if (isError || rates.length === 0) return null;

  return (
    <View className="overflow-hidden h-8">
      <Animated.View
        className="flex-row"
        style={{
          transform: [{ translateX: scrollX }],
        }}
      >
        {/* Render rates twice for seamless loop */}
        {[...rates, ...rates].map((rate, index) => (
          <FxRateItem key={`${rate.pair}-${index}`} rate={rate} />
        ))}
      </Animated.View>
    </View>
  );
};

export default FxTicker;