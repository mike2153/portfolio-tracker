import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../components/AuthProvider';
import { RootStackParamList } from './types';
import { useTheme } from '../contexts/ThemeContext';
import AuthScreenFey from '../screens/AuthScreenFey';
import { ProfileCompletionScreen } from '../screens/ProfileCompletionScreen';
import MainTabNavigator from './MainTabNavigator';
import StockDetailScreen from '../screens/StockDetailScreen';
import TransactionFormScreen from '../screens/TransactionFormScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreenFey} />
      ) : (
        <>
          <Stack.Screen name="ProfileCompletion" component={ProfileCompletionScreen} />
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen 
            name="StockDetail" 
            component={StockDetailScreen}
            options={{
              headerShown: true,
              headerTitle: 'Stock Details',
              headerStyle: { backgroundColor: theme.colors.background },
              headerTintColor: theme.colors.primaryText,
            }}
          />
          <Stack.Screen 
            name="TransactionForm" 
            component={TransactionFormScreen}
            options={{
              headerShown: true,
              headerTitle: 'Add Transaction',
              presentation: 'modal',
              headerStyle: { backgroundColor: theme.colors.background },
              headerTintColor: theme.colors.primaryText,
            }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}