import React, { useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MainTabScreenProps } from '../navigation/types';
import { 
  formatCurrency,
  formatPercentage
} from '@portfolio-tracker/shared';
import { usePortfolioSummary, usePerformanceData, useDividendData } from '../hooks/usePortfolioComplete';
import GradientText from '../components/GradientText';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme/theme';

type Props = MainTabScreenProps<'Analytics'>;

export default function AnalyticsScreen(_props: Props): React.JSX.Element {
  const { theme } = useTheme();
  
  // NEW: Use consolidated hooks for analytics data
  const {
    holdings,
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
    isLoading: portfolioLoading
  } = usePortfolioSummary();
  
  const {
    dailyChange,
    dailyChangePercent,
    volatility,
    sharpeRatio,
    isLoading: performanceLoading
  } = usePerformanceData();
  
  const {
    totalReceivedYtd,
    dividendCount,
    isLoading: dividendLoading
  } = useDividendData();
  
  // Combine loading states
  const isLoading = portfolioLoading || performanceLoading || dividendLoading;
  
  // Create portfolio object for compatibility
  const portfolio = {
    holdings,
    total_value: totalValue,
    total_gain_loss: totalGainLoss,
    total_gain_loss_percent: totalGainLossPercent,
    daily_change: dailyChange,
    daily_change_percent: dailyChangePercent
  };
  const holdings = portfolio?.holdings || [];

  // Calculate portfolio metrics
  const metrics = useMemo<{
    totalValue: number;
    totalCost: number;
    totalReturn: number;
    totalReturnPercent: number;
    volatility: number;
    beta: number | null;
    sharpeRatio: number | null;
    maxDrawdown: number | null;
    holdingsCount: number;
    avgHoldingSize: number;
  } | null>(() => {
    if (!portfolio || !holdings.length) return null;

    // Basic metrics
    const totalValue = portfolio.total_value || 0;
    const totalCost = holdings.reduce((sum: number, h: any) => sum + (h.quantity * h.average_price), 0);
    const totalReturn = totalValue - totalCost;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

    // Calculate volatility (simplified - standard deviation of daily returns)
    const dailyReturns = holdings.map((h: any) => h.daily_change_percent || 0);
    const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a: number, b: number) => a + b, 0) / dailyReturns.length : 0;
    const variance = dailyReturns.length > 0 ? dailyReturns.reduce((sum: number, ret: number) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length : 0;
    const volatility = Math.sqrt(variance);

    // Risk metrics (calculate what we can, set others to null)
    const beta: number | null = null; // Requires market correlation data
    const sharpeRatio: number | null = null; // Requires historical returns data
    const maxDrawdown: number | null = null; // Requires historical data

    return {
      totalValue,
      totalCost,
      totalReturn,
      totalReturnPercent,
      volatility,
      beta,
      sharpeRatio,
      maxDrawdown,
      holdingsCount: holdings.length,
      avgHoldingSize: totalValue / holdings.length,
    };
  }, [portfolio, holdings]);

  // Calculate sector allocation
  const sectorAllocation = useMemo(() => {
    if (!holdings.length) return [];
    
    const sectors: { [key: string]: number } = {};
    const totalValue = holdings.reduce((sum: number, h: any) => sum + h.current_value, 0);
    
    holdings.forEach((holding: any) => {
      const sector = holding.sector || 'Other';
      sectors[sector] = (sectors[sector] || 0) + holding.current_value;
    });
    
    return Object.entries(sectors)
      .map(([sector, value]) => ({
        sector,
        value,
        percentage: (value / totalValue) * 100
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  // Find top performers
  const topPerformers = useMemo(() => {
    if (!holdings.length) return [];
    
    return [...holdings]
      .sort((a: any, b: any) => b.total_pnl_pct - a.total_pnl_pct)
      .slice(0, 3);
  }, [holdings]);

  // Find worst performers
  const worstPerformers = useMemo(() => {
    if (!holdings.length) return [];
    
    return [...holdings]
      .sort((a: any, b: any) => a.total_pnl_pct - b.total_pnl_pct)
      .slice(0, 3);
  }, [holdings]);

  const isLoading = portfolioLoading;
  const styles = getStyles(theme);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.buttonBackground} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>No Data Available</Text>
        <Text style={styles.emptySubtitle}>
          Add holdings to your portfolio to see analytics
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <GradientText style={styles.headerTitle}>📊 Portfolio Analytics</GradientText>
        </View>

        {/* Performance Overview */}
        <View style={styles.section}>
          <GradientText style={styles.sectionTitle}>Performance Overview</GradientText>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Value</Text>
              <Text style={styles.metricValue}>{formatCurrency(metrics.totalValue)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Return</Text>
              <Text style={[
                styles.metricValue,
                metrics.totalReturn >= 0 ? styles.positive : styles.negative
              ]}>
                {formatCurrency(Math.abs(metrics.totalReturn))}
              </Text>
              <Text style={[
                styles.metricSubvalue,
                metrics.totalReturnPercent >= 0 ? styles.positive : styles.negative
              ]}>
                {metrics.totalReturnPercent >= 0 ? '+' : ''}{formatPercentage(metrics.totalReturnPercent / 100)}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Holdings</Text>
              <Text style={styles.metricValue}>{metrics.holdingsCount}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Avg Position</Text>
              <Text style={styles.metricValue}>{formatCurrency(metrics.avgHoldingSize)}</Text>
            </View>
          </View>
        </View>

        {/* Risk Metrics */}
        <View style={styles.section}>
          <GradientText style={styles.sectionTitle}>Risk Metrics</GradientText>
          <View style={styles.riskGrid}>
            <View style={styles.riskItem}>
              <Text style={styles.riskLabel}>Volatility</Text>
              <Text style={styles.riskValue}>
                {metrics.volatility > 0 ? formatPercentage(metrics.volatility / 100) : 'N/A'}
              </Text>
            </View>
            <View style={styles.riskItem}>
              <Text style={styles.riskLabel}>Beta</Text>
              <Text style={styles.riskValue}>
                {metrics.beta !== null ? metrics.beta.toFixed(2) : 'N/A'}
              </Text>
            </View>
            <View style={styles.riskItem}>
              <Text style={styles.riskLabel}>Sharpe Ratio</Text>
              <Text style={styles.riskValue}>
                {metrics.sharpeRatio !== null ? metrics.sharpeRatio.toFixed(2) : 'N/A'}
              </Text>
            </View>
            <View style={styles.riskItem}>
              <Text style={styles.riskLabel}>Max Drawdown</Text>
              <Text style={[styles.riskValue, metrics.maxDrawdown != null && styles.negative]}>
                {metrics.maxDrawdown != null ? formatPercentage(Math.abs(metrics.maxDrawdown) / 100) : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sector Allocation */}
        {sectorAllocation.length > 0 && (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>Sector Allocation</GradientText>
            {sectorAllocation.map(({ sector, value, percentage }) => (
              <View key={sector} style={styles.allocationItem}>
                <View style={styles.allocationHeader}>
                  <Text style={styles.allocationSector}>{sector}</Text>
                  <Text style={styles.allocationValue}>{formatCurrency(value)}</Text>
                </View>
                <View style={styles.allocationBar}>
                  <View 
                    style={[
                      styles.allocationFill,
                      { width: `${percentage}%` }
                    ]}
                  />
                </View>
                <Text style={styles.allocationPercent}>{formatPercentage(percentage / 100)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>Top Performers</GradientText>
            {topPerformers.map((holding: any) => (
              <View key={holding.symbol} style={styles.performerItem}>
                <View>
                  <Text style={styles.performerSymbol}>{holding.symbol}</Text>
                  <Text style={styles.performerName}>{holding.company_name}</Text>
                </View>
                <View style={styles.performerMetrics}>
                  <Text style={[styles.performerReturn, styles.positive]}>
                    +{formatCurrency(holding.total_pnl)}
                  </Text>
                  <Text style={[styles.performerPercent, styles.positive]}>
                    +{formatPercentage(holding.total_pnl_pct)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Worst Performers */}
        {worstPerformers.length > 0 && worstPerformers.some((h: any) => h.total_pnl_pct < 0) && (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>Worst Performers</GradientText>
            {worstPerformers.filter((h: any) => h.total_pnl_pct < 0).map((holding: any) => (
              <View key={holding.symbol} style={styles.performerItem}>
                <View>
                  <Text style={styles.performerSymbol}>{holding.symbol}</Text>
                  <Text style={styles.performerName}>{holding.company_name}</Text>
                </View>
                <View style={styles.performerMetrics}>
                  <Text style={[styles.performerReturn, styles.negative]}>
                    {formatCurrency(holding.total_pnl)}
                  </Text>
                  <Text style={[styles.performerPercent, styles.negative]}>
                    {formatPercentage(holding.total_pnl_pct)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.colors.secondaryText,
    fontSize: 16,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: theme.colors.secondaryText,
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricLabel: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
  },
  metricSubvalue: {
    fontSize: 14,
    marginTop: 4,
  },
  positive: {
    color: theme.colors.positive,
  },
  negative: {
    color: theme.colors.negative,
  },
  riskGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  riskItem: {
    flex: 1,
    minWidth: '45%',
  },
  riskLabel: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginBottom: 4,
  },
  riskValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  allocationItem: {
    marginBottom: 16,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  allocationSector: {
    fontSize: 16,
    color: theme.colors.primaryText,
  },
  allocationValue: {
    fontSize: 16,
    color: theme.colors.secondaryText,
  },
  allocationBar: {
    height: 8,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    marginBottom: 4,
  },
  allocationFill: {
    height: '100%',
    backgroundColor: theme.colors.blueAccent,
    borderRadius: 4,
  },
  allocationPercent: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  performerItem: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  performerSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  performerName: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginTop: 2,
  },
  performerMetrics: {
    alignItems: 'flex-end',
  },
  performerReturn: {
    fontSize: 16,
    fontWeight: '600',
  },
  performerPercent: {
    fontSize: 14,
    marginTop: 2,
  },
});