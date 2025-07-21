import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@shared/components/AuthProvider';
import { RootStackParamList } from './types';
import AuthScreen from '../screens/AuthScreen';
import MainTabNavigator from './MainTabNavigator';
import StockDetailScreen from '../screens/StockDetailScreen';
import TransactionFormScreen from '../screens/TransactionFormScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen 
              name="StockDetail" 
              component={StockDetailScreen}
              options={{
                headerShown: true,
                headerTitle: 'Stock Details',
                headerStyle: { backgroundColor: '#1f2937' },
                headerTintColor: '#fff',
              }}
            />
            <Stack.Screen 
              name="TransactionForm" 
              component={TransactionFormScreen}
              options={{
                headerShown: true,
                headerTitle: 'Add Transaction',
                presentation: 'modal',
                headerStyle: { backgroundColor: '#1f2937' },
                headerTintColor: '#fff',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}