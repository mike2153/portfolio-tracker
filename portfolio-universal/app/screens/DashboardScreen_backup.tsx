import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity 
} from 'react-native';
import { MainTabScreenProps } from '../navigation/types';

type Props = MainTabScreenProps<'Dashboard'>;

interface PortfolioSummary {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

const KPICard = ({ title, value, subtitle, isPositive }: {
  title: string;
  value: string;
  subtitle?: string;
  isPositive?: boolean;
}) => (
  <View style={styles.kpiCard}>
    <Text style={styles.kpiTitle}>{title}</Text>
    <Text style={[styles.kpiValue, isPositive !== undefined && (isPositive ? styles.positive : styles.negative)]}>
      {value}
    </Text>
    {subtitle && <Text style={styles.kpiSubtitle}>{subtitle}</Text>}
  </View>
);

const PlaceholderChart = ({ title }: { title: string }) => (
  <View style={styles.chartContainer}>
    <Text style={styles.chartTitle}>{title}</Text>
    <View style={styles.chartPlaceholder}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.chartPlaceholderText}>Chart coming soon</Text>
    </View>
  </View>
);

export default function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const [portfolio, setPortfolio] = useState<PortfolioSummary>({
    totalValue: 125420.75,
    dailyChange: 2341.20,
    dailyChangePercent: 1.9,
    totalGainLoss: 15420.75,
    totalGainLossPercent: 14.0
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Portfolio</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Text style={styles.settingsText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Portfolio Summary KPIs */}
        <View style={styles.kpiGrid}>
          <KPICard
            title="Total Value"
            value={formatCurrency(portfolio.totalValue)}
          />
          <KPICard
            title="Daily Change"
            value={formatCurrency(portfolio.dailyChange)}
            subtitle={formatPercent(portfolio.dailyChangePercent)}
            isPositive={portfolio.dailyChange >= 0}
          />
          <KPICard
            title="Total Gain/Loss"
            value={formatCurrency(portfolio.totalGainLoss)}
            subtitle={formatPercent(portfolio.totalGainLossPercent)}
            isPositive={portfolio.totalGainLoss >= 0}
          />
        </View>

        {/* Portfolio Performance Chart */}
        <PlaceholderChart title="Portfolio Performance vs S&P 500" />

        {/* Allocation Chart */}
        <PlaceholderChart title="Asset Allocation" />

        {/* Top Holdings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Holdings</Text>
          <View style={styles.holdingsList}>
            <View style={styles.holdingItem}>
              <Text style={styles.holdingTicker}>AAPL</Text>
              <Text style={styles.holdingName}>Apple Inc.</Text>
              <Text style={styles.holdingValue}>$15,420</Text>
            </View>
            <View style={styles.holdingItem}>
              <Text style={styles.holdingTicker}>MSFT</Text>
              <Text style={styles.holdingName}>Microsoft Corp.</Text>
              <Text style={styles.holdingValue}>$12,350</Text>
            </View>
            <View style={styles.holdingItem}>
              <Text style={styles.holdingTicker}>GOOGL</Text>
              <Text style={styles.holdingName}>Alphabet Inc.</Text>
              <Text style={styles.holdingValue}>$9,870</Text>
            </View>
          </View>
        </View>

        {/* Market Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market Overview</Text>
          <View style={styles.marketList}>
            <View style={styles.marketItem}>
              <Text style={styles.marketName}>S&P 500</Text>
              <Text style={[styles.marketValue, styles.positive]}>4,567.89 (+0.75%)</Text>
            </View>
            <View style={styles.marketItem}>
              <Text style={styles.marketName}>NASDAQ</Text>
              <Text style={[styles.marketValue, styles.positive]}>14,239.88 (+1.23%)</Text>
            </View>
            <View style={styles.marketItem}>
              <Text style={styles.marketName}>DOW</Text>
              <Text style={[styles.marketValue, styles.negative]}>34,567.12 (-0.32%)</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
  },
  settingsText: {
    fontSize: 24,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  kpiSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  positive: {
    color: '#10b981',
  },
  negative: {
    color: '#ef4444',
  },
  chartContainer: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    color: '#6b7280',
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  holdingsList: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  holdingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  holdingTicker: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b82f6',
    width: 60,
  },
  holdingName: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
    marginLeft: 12,
  },
  holdingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  marketList: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  marketName: {
    fontSize: 16,
    color: '#d1d5db',
  },
  marketValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});