import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MainTabScreenProps } from '../navigation/types';
import PortfolioPerformanceChartKit from '../components/charts/PortfolioPerformanceChartKit';
import { 
  formatCurrency, 
  formatPercentage
} from '@portfolio-tracker/shared';
import { usePortfolioSummary, usePerformanceData } from '../hooks/usePortfolioComplete';
import GradientText from '../components/GradientText';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme/theme';

type Props = MainTabScreenProps<'Dashboard'>;

export default function DashboardScreen({ navigation }: Props): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();

  // NEW: Use consolidated hooks for better performance
  const {
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
    holdings,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio
  } = usePortfolioSummary();
  
  const {
    dailyChange,
    dailyChangePercent,
    isLoading: performanceLoading,
    refetch: refetchPerformance
  } = usePerformanceData();
  
  // Combine loading states
  const dashboardLoading = portfolioLoading || performanceLoading;


  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPortfolio(), refetchPerformance()]);
    setRefreshing(false);
  }, [refetchPortfolio, refetchPerformance]);

  // Data is now directly available from hooks - no need to extract from objects
  const dashboardError = portfolioError; // For compatibility
  const totalInvested = totalValue - totalGainLoss; // Calculate total invested
  const holdingsCount = holdings.length;

  // Get top 3 holdings by value
  const topHoldings = holdings
    .sort((a: any, b: any) => (b.current_value || 0) - (a.current_value || 0))
    .slice(0, 3);

  const styles = getStyles(theme);

  // KPICard component definition
  const KPICard = ({ title, value, subtitle, isPositive }: {
    title: string;
    value: string;
    subtitle?: string;
    isPositive?: boolean;
  }) => (
    <View style={styles.kpiCard}>
      <GradientText style={styles.kpiTitle}>{title}</GradientText>
      <Text style={[
        styles.kpiValue, 
        isPositive !== undefined ? (isPositive ? styles.positive : styles.negative) : undefined
      ]}>
        {value}
      </Text>
      {subtitle && <Text style={styles.kpiSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (dashboardLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.buttonBackground} />
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

        {/* KPI CARDS */}
        <View style={styles.kpiGrid}>
          <KPICard
            title="Total Value"
            value={totalValue > 0 ? formatCurrency(totalValue) : '$0.00'}
          />
          <KPICard
            title="Total Invested"
            value={formatCurrency(totalInvested)}
            subtitle={holdingsCount > 0 ? `${holdingsCount} holding(s)` : 'No holdings'}
          />
          <KPICard
            title="Total Gain/Loss"
            value={totalValue > 0 ? formatCurrency(Math.abs(totalGainLoss)) : '-'}
            subtitle={totalValue > 0 ? `${totalGainLoss >= 0 ? '+' : '-'}${formatPercentage(Math.abs(totalGainLossPercent))}` : 'No data'}
            isPositive={totalGainLoss >= 0}
          />
          <KPICard
            title="Daily Change"
            value={totalValue > 0 ? formatCurrency(Math.abs(dailyChange)) : '-'}
            subtitle={totalValue > 0 ? `${dailyChange >= 0 ? '+' : '-'}${formatPercentage(Math.abs(dailyChangePercent))}` : 'No data'}
            isPositive={dailyChange >= 0}
          />
        </View>

        {/* PORTFOLIO PERFORMANCE CHART */}
        <View style={styles.chartContainer}>
          <PortfolioPerformanceChartKit 
            height={300}
            initialPeriod="1Y"
            benchmarks={['SPY']}
          />
        </View>

        {/* TOP HOLDINGS */}
        {topHoldings.length > 0 ? (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>📈 Top Holdings</GradientText>
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
        ) : (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>📈 Getting Started</GradientText>
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No holdings yet</Text>
              <Text style={styles.emptySubtext}>Add your first transaction to start tracking your portfolio</Text>
            </View>
          </View>
        )}

        {/* MARKET DATA - TODO: Add market indices when available in API */}


      </View>
    </ScrollView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.colors.secondaryText,
    fontSize: 16,
  },
  errorText: {
    color: theme.colors.negative,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDetail: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: theme.colors.buttonBackground,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  transactionInfo: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    color: theme.colors.primaryText,
    fontSize: 16,
    marginBottom: 8,
  },
  infoSubtext: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.primaryText,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: theme.colors.buttonBackground,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: theme.colors.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kpiTitle: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  kpiSubtitle: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
  positive: {
    color: theme.colors.positive,
  },
  negative: {
    color: theme.colors.negative,
  },
  chartContainer: {
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginBottom: 16,
  },
  holdingsList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  holdingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  holdingTicker: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.blueAccent,
    width: 60,
  },
  holdingName: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    flex: 1,
    marginLeft: 12,
  },
  holdingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  marketList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  marketName: {
    fontSize: 16,
    color: theme.colors.secondaryText,
  },
  marketValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: theme.colors.buttonBackground,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});