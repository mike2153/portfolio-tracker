import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ChartSkeletonProps {
  height?: number;
  title?: string;
  showTimeRanges?: boolean;
  className?: string;
  type?: 'line' | 'area' | 'donut';
}

export default function ChartSkeleton({
  height = 350,
  title,
  showTimeRanges = false,
  className = '',
  type = 'area',
}: ChartSkeletonProps) {
  const SkeletonPulse = ({ children, className: pulseClassName = '' }: { children: React.ReactNode; className?: string }) => (
    <LinearGradient
      colors={['#374151', '#4b5563', '#374151']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      className={`rounded ${pulseClassName}`}
      style={{
        animationName: 'pulse',
        animationDuration: '1.5s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
      }}
    >
      {children}
    </LinearGradient>
  );

  return (
    <View className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
      {/* Header skeleton */}
      <View className="flex-row items-center justify-between mb-4">
        <View>
          {title ? (
            <Text className="text-lg font-semibold text-white">{title}</Text>
          ) : (
            <SkeletonPulse className="h-6 w-48">
              <View className="h-6 w-48" />
            </SkeletonPulse>
          )}
        </View>
        
        {showTimeRanges && (
          <View className="flex-row space-x-1">
            {['7D', '1M', '3M', '1Y', 'YTD', 'MAX'].map((range) => (
              <SkeletonPulse key={range} className="h-7 w-10">
                <View className="h-7 w-10" />
              </SkeletonPulse>
            ))}
          </View>
        )}
      </View>

      {/* Chart skeleton based on type */}
      <View style={{ height }}>
        {type === 'donut' ? (
          // Donut chart skeleton
          <View className="flex items-center justify-center h-full">
            <SkeletonPulse className="rounded-full">
              <View 
                style={{ 
                  width: height * 0.8, 
                  height: height * 0.8,
                  borderRadius: height * 0.4,
                  borderWidth: height * 0.15,
                  borderColor: '#4b5563',
                }} 
              />
            </SkeletonPulse>
            
            {/* Legend skeleton */}
            <View className="absolute bottom-0 left-0 right-0">
              <View className="flex-row justify-center space-x-4">
                {[1, 2, 3].map((i) => (
                  <View key={i} className="flex-row items-center">
                    <SkeletonPulse className="w-3 h-3 rounded-full mr-1">
                      <View className="w-3 h-3" />
                    </SkeletonPulse>
                    <SkeletonPulse className="h-3 w-16">
                      <View className="h-3 w-16" />
                    </SkeletonPulse>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          // Line/Area chart skeleton
          <View className="flex h-full">
            {/* Y-axis labels skeleton */}
            <View className="absolute left-0 top-0 bottom-12">
              {[0, 1, 2, 3, 4].map((i) => (
                <View 
                  key={i}
                  className="absolute left-0"
                  style={{ top: `${i * 25}%` }}
                >
                  <SkeletonPulse className="h-3 w-12">
                    <View className="h-3 w-12" />
                  </SkeletonPulse>
                </View>
              ))}
            </View>
            
            {/* Chart area skeleton */}
            <View className="flex-1 ml-16 mb-8">
              <SkeletonPulse className="h-full w-full">
                <View className="h-full w-full" />
              </SkeletonPulse>
              
              {/* Animated wave effect for line/area charts */}
              <View className="absolute inset-0 overflow-hidden">
                <View 
                  className="absolute"
                  style={{
                    width: '200%',
                    height: '100%',
                    transform: [{ translateX: -100 }],
                    opacity: 0.3,
                  }}
                >
                  <LinearGradient
                    colors={['transparent', '#6b7280', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      width: '100%',
                      height: '100%',
                      animationName: 'slide',
                      animationDuration: '2s',
                      animationIterationCount: 'infinite',
                      animationTimingFunction: 'linear',
                    }}
                  />
                </View>
              </View>
            </View>
            
            {/* X-axis labels skeleton */}
            <View className="absolute bottom-0 left-16 right-0 flex-row justify-between">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonPulse key={i} className="h-3 w-12">
                  <View className="h-3 w-12" />
                </SkeletonPulse>
              ))}
            </View>
          </View>
        )}
      </View>
      
      {/* Additional info skeleton */}
      <View className="mt-4 flex-row justify-between">
        <SkeletonPulse className="h-3 w-32">
          <View className="h-3 w-32" />
        </SkeletonPulse>
        <SkeletonPulse className="h-3 w-24">
          <View className="h-3 w-24" />
        </SkeletonPulse>
      </View>
    </View>
  );
}

// Export a specific skeleton for portfolio charts
export function PortfolioChartSkeleton() {
  return (
    <ChartSkeleton
      title="Portfolio vs Benchmark"
      showTimeRanges={true}
      height={400}
      type="area"
    />
  );
}

// Export a specific skeleton for allocation charts
export function AllocationChartSkeleton() {
  return (
    <ChartSkeleton
      title="Portfolio Allocation"
      height={300}
      type="donut"
    />
  );
}