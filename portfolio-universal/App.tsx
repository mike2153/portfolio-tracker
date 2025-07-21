import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
        <StatusBar style="light" />
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>
          Portfolio Tracker
        </Text>
        <Text style={{ color: '#888', fontSize: 16, marginTop: 10 }}>
          iOS App Running Successfully! 🎉
        </Text>
      </View>
    </SafeAreaProvider>
  );
}
