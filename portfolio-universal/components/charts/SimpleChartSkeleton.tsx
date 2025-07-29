import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function SimpleChartSkeleton() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    backgroundColor: 'rgba(31, 41, 55, 0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});