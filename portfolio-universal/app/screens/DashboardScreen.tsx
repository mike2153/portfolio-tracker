import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator 
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MainTabScreenProps } from '../navigation/types';
import PortfolioPerformanceChartKit from '../components/charts/PortfolioPerformanceChartKit';
import { 
  front_api_get_dashboard, 
  front_api_get_portfolio,
  formatCurrency, 
  formatPercentage,
  COLORS 
} from '@portfolio-tracker/shared';

type Props = MainTabScreenProps<'Dashboard'>;

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

export default function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: front_api_get_dashboard,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch portfolio data for top holdings
  const { data: portfolioData, refetch: refetchPortfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: front_api_get_portfolio,
    refetchInterval: 60000,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDashboard(), refetchPortfolio()]);
    setRefreshing(false);
  }, [refetchDashboard, refetchPortfolio]);

  const dashboard = dashboardData?.data;
  const portfolio = portfolioData?.data;

  // Calculate KPI values from dashboard data
  const totalValue = dashboard?.total_value || 0;
  const dailyChange = dashboard?.daily_pnl || 0;
  const dailyChangePercent = dashboard?.daily_pnl_pct || 0;
  const totalGainLoss = dashboard?.total_pnl || 0;
  const totalGainLossPercent = dashboard?.total_pnl_pct || 0;
  const holdingsCount = portfolio?.holdings?.length || 0;

  // Get top 3 holdings by value
  const topHoldings = portfolio?.holdings
    ?.sort((a: any, b: any) => b.current_value - a.current_value)
    ?.slice(0, 3) || [];

  if (dashboardLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📱 NEW DASHBOARD 📱</Text>
          <Text style={styles.headerSubtitle}>iOS Portfolio Tracker</Text>
        </View>

        {/* KPI CARDS */}
        <View style={styles.kpiGrid}>
          <KPICard
            title="Total Value"
            value={formatCurrency(totalValue)}
          />
          <KPICard
            title="Daily Change"
            value={formatCurrency(Math.abs(dailyChange))}
            subtitle={`${dailyChange >= 0 ? '+' : '-'}${formatPercentage(Math.abs(dailyChangePercent))}`}
            isPositive={dailyChange >= 0}
          />
          <KPICard
            title="Total Gain/Loss"
            value={formatCurrency(Math.abs(totalGainLoss))}
            subtitle={`${totalGainLoss >= 0 ? '+' : '-'}${formatPercentage(Math.abs(totalGainLossPercent))}`}
            isPositive={totalGainLoss >= 0}
          />
          <KPICard
            title="Holdings"
            value={holdingsCount.toString()}
            subtitle="Active Positions"
          />
        </View>

        {/* PORTFOLIO PERFORMANCE CHART */}
        <PortfolioPerformanceChartKit 
          height={300}
          initialPeriod="1Y"
          benchmarks={['SPY']}
        />

        {/* TOP HOLDINGS */}
        {topHoldings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Top Holdings</Text>
            <View style={styles.holdingsList}>
              {topHoldings.map((holding: any) => (
                <View key={holding.symbol} style={styles.holdingItem}>
                  <Text style={styles.holdingTicker}>{holding.symbol}</Text>
                  <Text style={styles.holdingName}>{holding.company_name || holding.symbol}</Text>
                  <Text style={styles.holdingValue}>{formatCurrency(holding.current_value)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* MARKET DATA */}
        {dashboard?.indices && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Market Overview</Text>
            <View style={styles.marketList}>
              {dashboard.indices.map((index: any) => {
                const isPositive = index.change_pct >= 0;
                return (
                  <View key={index.symbol} style={styles.marketItem}>
                    <Text style={styles.marketName}>{index.name}</Text>
                    <Text style={[styles.marketValue, isPositive ? styles.positive : styles.negative]}>
                      {formatCurrency(index.last)} ({isPositive ? '+' : ''}{formatPercentage(index.change_pct)})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* TEST BUTTONS */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('Portfolio')}
          >
            <Text style={styles.buttonText}>Go to Portfolio →</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textMuted,
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9ca3af',
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
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});