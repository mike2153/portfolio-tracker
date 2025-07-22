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
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard, error: dashboardError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: front_api_get_dashboard,
    refetchInterval: 60000, // Refresh every minute
  });


  // Fetch portfolio data for top holdings
  const { data: portfolioData, refetch: refetchPortfolio, error: portfolioError } = useQuery({
    queryKey: ['portfolio'],
    queryFn: front_api_get_portfolio,
    refetchInterval: 60000,
  });


  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDashboard(), refetchPortfolio()]);
    setRefreshing(false);
  }, [refetchDashboard, refetchPortfolio]);

  // Extract data - the API returns the data directly, not wrapped in a 'data' field
  const dashboard = dashboardData;
  const portfolio = portfolioData;

  // Temporary debug logging to understand the issue
  console.log('[DEBUG] Dashboard data structure:', JSON.stringify(dashboard, null, 2));
  console.log('[DEBUG] Portfolio data structure:', JSON.stringify(portfolio, null, 2));
  console.log('[DEBUG] Calculated values:', {
    totalValue: dashboard?.portfolio?.total_value,
    dailyChange: dashboard?.portfolio?.daily_change,
    totalGainLoss: dashboard?.portfolio?.total_gain_loss,
    holdingsCount: dashboard?.portfolio?.holdings_count,
    transactionSummary: dashboard?.transaction_summary
  });

  // Calculate KPI values from dashboard data
  const totalValue = dashboard?.portfolio?.total_value || 0;
  const dailyChange = dashboard?.portfolio?.daily_change || 0;
  const dailyChangePercent = dashboard?.portfolio?.daily_change_percent || 0;
  const totalGainLoss = dashboard?.portfolio?.total_gain_loss || 0;
  const totalGainLossPercent = dashboard?.portfolio?.total_gain_loss_percent || 0;
  const holdingsCount = dashboard?.portfolio?.holdings_count || portfolio?.holdings?.length || 0;

  // Get top 3 holdings by value
  const topHoldings = dashboard?.top_holdings || portfolio?.holdings
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

  if (dashboardError || portfolioError) {
    console.error('[DashboardScreen] Errors:', { dashboardError, portfolioError });
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Error loading data</Text>
        <Text style={styles.errorDetail}>
          {(dashboardError as any)?.message || (portfolioError as any)?.message || 'Unknown error'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => {
          refetchDashboard();
          refetchPortfolio();
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
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
            value={totalValue > 0 ? formatCurrency(totalValue) : (dashboard?.transaction_summary?.total_invested > 0 ? 'Pending' : '$0.00')}
          />
          <KPICard
            title="Total Invested"
            value={formatCurrency(dashboard?.transaction_summary?.total_invested || 0)}
            subtitle={dashboard?.transaction_summary?.total_transactions ? `${dashboard.transaction_summary.total_transactions} transaction(s)` : 'No transactions'}
          />
          <KPICard
            title="Total Gain/Loss"
            value={totalValue > 0 ? formatCurrency(Math.abs(totalGainLoss)) : '-'}
            subtitle={totalValue > 0 ? `${totalGainLoss >= 0 ? '+' : '-'}${formatPercentage(Math.abs(totalGainLossPercent))}` : 'Awaiting prices'}
            isPositive={totalGainLoss >= 0}
          />
          <KPICard
            title="Holdings"
            value={holdingsCount > 0 ? holdingsCount.toString() : (dashboard?.transaction_summary?.buy_count > 0 ? 'Processing' : '0')}
            subtitle={holdingsCount > 0 ? 'Active Positions' : 'Pending calculation'}
          />
        </View>

        {/* PORTFOLIO PERFORMANCE CHART */}
        <PortfolioPerformanceChartKit 
          height={300}
          initialPeriod="1Y"
          benchmarks={['SPY']}
        />

        {/* TOP HOLDINGS */}
        {topHoldings.length > 0 ? (
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
        ) : dashboard?.transaction_summary?.total_transactions > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Transaction Summary</Text>
            <View style={styles.transactionInfo}>
              <Text style={styles.infoText}>
                You have {dashboard.transaction_summary.total_transactions} transaction(s) recorded.
              </Text>
              <Text style={styles.infoText}>
                Total invested: {formatCurrency(dashboard.transaction_summary.total_invested)}
              </Text>
              <Text style={styles.infoSubtext}>
                Holdings will appear here once stock prices are fetched.{"\n"}
                This may take a moment for the backend to process.
              </Text>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={() => {
                  refetchDashboard();
                  refetchPortfolio();
                }}
              >
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Getting Started</Text>
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No holdings yet</Text>
              <Text style={styles.emptySubtext}>Add your first transaction to start tracking your portfolio</Text>
            </View>
          </View>
        )}

        {/* MARKET DATA - TODO: Add market indices when available in API */}

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
  errorText: {
    color: COLORS.negative,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDetail: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  transactionInfo: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 8,
  },
  infoSubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: '#374151',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
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