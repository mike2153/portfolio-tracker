import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './app/components/AuthProvider';
import RootNavigator from './app/navigation/RootNavigator';
import { ThemeProvider } from './app/contexts/ThemeContext';

console.log('🚀 Portfolio Tracker App starting...');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false, // Don't refetch when app comes to foreground
      refetchOnReconnect: false, // Don't refetch on network reconnect
      refetchInterval: false, // No automatic refetching
    },
    mutations: {
      retry: 1,
    },
  },
});

export default function App() {
  console.log('📱 Rendering Portfolio Tracker with navigation...');
  
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <AuthProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </AuthProvider>
          </NavigationContainer>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
