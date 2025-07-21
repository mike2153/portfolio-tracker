import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';

export default function SimpleDashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Portfolio Value</Text>
        <Text style={styles.cardValue}>$125,432.10</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Change</Text>
        <Text style={[styles.cardValue, styles.positive]}>+$1,234.56 (+0.99%)</Text>
      </View>
      
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Portfolio Performance</Text>
        <View style={styles.chartPlaceholder}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  card: {
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    margin: 10,
    padding: 20,
    borderRadius: 12,
  },
  chartCard: {
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    margin: 10,
    padding: 20,
    borderRadius: 12,
    minHeight: 300,
  },
  cardTitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  positive: {
    color: '#10B981',
  },
  chartPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
});