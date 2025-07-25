import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import GradientText from '../components/GradientText';
import { colors } from '../theme/colors';

export default function SimpleDashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <GradientText style={styles.title}>Dashboard</GradientText>
      </View>
      
      <View style={styles.card}>
        <GradientText style={styles.cardTitle}>Portfolio Value</GradientText>
        <Text style={styles.cardValue}>$125,432.10</Text>
      </View>
      
      <View style={styles.card}>
        <GradientText style={styles.cardTitle}>Today's Change</GradientText>
        <Text style={[styles.cardValue, styles.positive]}>+$1,234.56 (+0.99%)</Text>
      </View>
      
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Portfolio Performance</Text>
        <View style={styles.chartPlaceholder}>
          <ActivityIndicator size="large" color={colors.buttonBackground} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  card: {
    backgroundColor: colors.border,
    margin: 10,
    padding: 20,
    borderRadius: 12,
  },
  chartCard: {
    backgroundColor: colors.border,
    margin: 10,
    padding: 20,
    borderRadius: 12,
    minHeight: 300,
  },
  cardTitle: {
    fontSize: 16,
    color: colors.secondaryText,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryText,
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