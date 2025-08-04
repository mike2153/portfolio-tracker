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
import { usePortfolioSummary, usePerformanceData, useDividendData } from '../hooks/usePortfolioComplete';
import GradientText from '../components/GradientText';
import CompanyLogo from '../components/ui/CompanyLogo';
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
  
  const {
    ytdReceived,
    isLoading: dividendLoading
  } = useDividendData();
  
  // Combine loading states
  const dashboardLoading = portfolioLoading || performanceLoading || dividendLoading;


  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchPortfolio(), refetchPerformance()]);
    setRefreshing(false);
  }, [refetchPortfolio, refetchPerformance]);

  // Data is now directly available from hooks - no need to extract from objects
  const dashboardError = portfolioError; // For compatibility
  const totalInvested = totalValue - totalGainLoss; // Calculate total invested
  const holdingsCount = holdings.length;

  // Get top day gainers
  const topGainers = holdings
    .filter((holding: any) => (holding.total_gain_loss_percent || 0) > 0)
    .sort((a: any, b: any) => (b.total_gain_loss_percent || 0) - (a.total_gain_loss_percent || 0))
    .slice(0, 2);
    
  // Calculate passive income yield
  const passiveIncomeYield = totalValue > 0 ? (ytdReceived / totalValue) * 100 : 0;

  const styles = getStyles(theme);

  // Remove KPICard component as we're using a different layout

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
          refetchPortfolio();
          refetchPerformance();
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        bounces={false}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.content}>
          {/* CURRENT VALUE SECTION */}
          <View style={styles.valueSection}>
            <Text style={styles.currentValueLabel}>Current value</Text>
            <GradientText 
              variant="hero"
              style={styles.currentValueAmount}
            >
              {formatCurrency(totalValue || 0)}
            </GradientText>
          </View>

          {/* KEY METRICS */}
          <View style={styles.metricsSection}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Total profit</Text>
              <Text style={[styles.metricValue, totalGainLoss >= 0 ? styles.positive : styles.negative]}>
                {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(Math.abs(totalGainLoss || 0))} ▲ {formatPercentage(Math.abs(totalGainLossPercent || 0))}
              </Text>
            </View>
            
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Daily</Text>
              <Text style={[styles.metricValue, dailyChange >= 0 ? styles.positive : styles.negative]}>
                {dailyChange >= 0 ? '+' : ''}{formatCurrency(Math.abs(dailyChange || 0))} ▼ {formatPercentage(Math.abs(dailyChangePercent || 0))}
              </Text>
            </View>
            
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Passive income</Text>
              <Text style={styles.metricValue}>
                {formatPercentage(passiveIncomeYield / 100)} ({formatCurrency(ytdReceived || 0)})
              </Text>
            </View>
          </View>

          {/* PORTFOLIO PERFORMANCE CHART */}
          <View style={styles.chartContainer}>
            <PortfolioPerformanceChartKit 
              height={420}
              initialPeriod="1Y"
              benchmarks={['SPY']}
            />
          </View>
          

          {/* TOP DAY GAINERS */}
          {topGainers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top day gainers</Text>
              <View style={styles.gainersList}>
                {topGainers.map((holding: any) => (
                  <View key={holding.symbol} style={styles.gainerItem}>
                    <View style={styles.gainerLeft}>
                      <CompanyLogo
                        symbol={holding.symbol}
                        size={40}
                        style={{ marginRight: 12 }}
                      />
                      <View style={styles.gainerInfo}>
                        <Text style={styles.gainerName}>{holding.company_name || holding.symbol}</Text>
                        <Text style={styles.gainerTicker}>{holding.symbol}</Text>
                      </View>
                    </View>
                    <View style={styles.gainerRight}>
                      <Text style={styles.gainerValue}>{formatCurrency(holding.current_value || 0)}</Text>
                      <Text style={styles.gainerGain}>
                        +{formatCurrency(Math.abs(holding.total_gain_loss || 0))} ▲ {formatPercentage(Math.abs(holding.total_gain_loss_percent || 0))}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // Fey dark background
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 32, // Push everything down slightly
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
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
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Current Value Section - Fey styling
  valueSection: {
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 8, // Add slight top padding
  },
  currentValueLabel: {
    fontSize: 16,
    color: theme.colors.secondaryText,
    marginBottom: 12, // Push down text label more
    fontWeight: '400',
    marginTop: 8, // Add top margin to push down from top
  },
  currentValueAmount: {
    fontSize: 30, // Smaller font size
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  // Metrics Section - Seamless background
  metricsSection: {
    marginBottom: 16,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    padding: 0,
    marginHorizontal: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  metricLabel: {
    fontSize: 16,
    color: theme.colors.primaryText,
    fontWeight: '400',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  positive: {
    color: theme.colors.positive, // Fey green
  },
  negative: {
    color: theme.colors.negative, // Fey red
  },
  
  // Chart Section - Seamless background
  chartContainer: {
    marginBottom: 0,
    marginTop: 4, // Push chart down slightly
    marginHorizontal: -16,
    backgroundColor: 'transparent',
    padding: 0,
    paddingBottom: 40, // Extra bottom padding for chart controls
  },
  
  
  // Top Gainers Section - Seamless background
  section: {
    marginBottom: 32,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 20,
    paddingLeft: 4,
  },
  gainersList: {
    backgroundColor: 'transparent',
    padding: 16,
  },
  gainerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 0,
  },
  gainerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  // Removed tickerIcon styles - now using CompanyLogo component
  gainerInfo: {
    flex: 1,
    marginLeft: 4,
  },
  gainerName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primaryText,
    marginBottom: 2,
  },
  gainerTicker: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  gainerRight: {
    alignItems: 'flex-end',
  },
  gainerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginBottom: 2,
  },
  gainerGain: {
    fontSize: 14,
    color: theme.colors.positive, // Fey green
    fontWeight: '600',
  },
});