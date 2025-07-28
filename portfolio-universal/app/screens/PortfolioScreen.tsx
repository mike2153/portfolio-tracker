import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MainTabScreenProps } from '../navigation/types';
import { 
  front_api_get_portfolio,
  front_api_get_transactions, 
  formatCurrency, 
  formatPercentage
} from '@portfolio-tracker/shared';
import GradientText from '../components/GradientText';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme/theme';

type Props = MainTabScreenProps<'Portfolio'>;

interface Holding {
  symbol: string;
  company_name: string;
  quantity: number;
  average_price: number;
  current_price: number;
  current_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  sector?: string;
  currency?: string;
  base_currency_value?: number;
}

export default function PortfolioScreen({ navigation }: Props): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  
  // Fetch portfolio data
  const { data: portfolioData, isLoading, refetch, error: portfolioError } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [PortfolioScreen] Starting portfolio fetch...`);
      try {
        const result = await front_api_get_portfolio();
        console.log(`[${timestamp}] [PortfolioScreen] Portfolio fetch successful:`, {
          hasData: !!result,
          dataKeys: result ? Object.keys(result) : [],
          holdingsCount: result?.holdings?.length || 0
        });
        return result;
      } catch (error) {
        console.error(`[${timestamp}] [PortfolioScreen] Portfolio fetch error:`, error);
        throw error;
      }
    },
    // refetchInterval removed - load data only once
  });

  // Fetch transactions data
  const { data: transactionsData, refetch: refetchTransactions, error: transactionsError } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [PortfolioScreen] Starting transactions fetch...`);
      try {
        const result = await front_api_get_transactions();
        console.log(`[${timestamp}] [PortfolioScreen] Transactions fetch successful:`, {
          hasData: !!result,
          dataKeys: result ? Object.keys(result) : [],
          transactionsCount: (result as any)?.transactions?.length || (result as any)?.length || 0
        });
        return result;
      } catch (error) {
        console.error(`[${timestamp}] [PortfolioScreen] Transactions fetch error:`, error);
        throw error;
      }
    },
    // refetchInterval removed - load data only once
  });

  const onRefresh = React.useCallback(async () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PortfolioScreen] Manual refresh triggered`);
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchTransactions()]);
      console.log(`[${timestamp}] [PortfolioScreen] Refresh completed successfully`);
    } catch (error) {
      console.error(`[${timestamp}] [PortfolioScreen] Refresh error:`, error);
    }
    setRefreshing(false);
  }, [refetch, refetchTransactions]);

  // Extract data - the API returns the data directly, not wrapped in a 'data' field
  const portfolio = portfolioData;
  const holdings = portfolio?.holdings || [];
  const transactions = Array.isArray(transactionsData) ? transactionsData : ((transactionsData as any)?.transactions || []);

  // Enhanced debug logging
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PortfolioScreen] Current state:`, {
    portfolioData: {
      hasData: !!portfolio,
      totalValue: portfolio?.total_value,
      holdingsCount: holdings.length,
      error: portfolioError
    },
    transactionsData: {
      hasData: !!transactionsData,
      transactionsCount: transactions.length,
      error: transactionsError
    },
    apiBase: process.env.EXPO_PUBLIC_BACKEND_API_URL,
    isLoading,
    refreshing
  });
  
  if (holdings.length > 0) {
    console.log(`[${timestamp}] [PortfolioScreen] Sample holding:`, holdings[0]);
  }
  if (transactions.length > 0) {
    console.log(`[${timestamp}] [PortfolioScreen] Sample transaction:`, transactions[0]);
  }

  // Calculate portfolio metrics
  const totalValue = portfolio?.total_value || 0;
  const totalGainLoss = portfolio?.total_gain_loss || 0;
  const totalGainLossPercent = portfolio?.total_gain_loss_percent || 0;
  const dailyChange = portfolio?.daily_change || 0;
  const dailyChangePercent = portfolio?.daily_change_percent || 0;

  // Find best performer
  const bestPerformer = useMemo(() => {
    if (!holdings.length) return null;
    return holdings.reduce((best: Holding, current: Holding) => 
      current.total_pnl_pct > best.total_pnl_pct ? current : best
    );
  }, [holdings]);

  // Calculate sector allocation
  const sectorAllocation = useMemo(() => {
    if (!holdings.length) return [];
    
    const sectors: { [key: string]: number } = {};
    const totalValue = holdings.reduce((sum: number, h: Holding) => sum + h.current_value, 0);
    
    holdings.forEach((holding: Holding) => {
      const sector = holding.sector || 'Other';
      sectors[sector] = (sectors[sector] || 0) + holding.current_value;
    });
    
    return Object.entries(sectors)
      .map(([sector, value]) => ({
        sector,
        percentage: (value / totalValue) * 100
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [holdings]);

  const styles = getStyles(theme);

  // Component definitions that need styles
  const HoldingCard = ({ holding, onPress }: { holding: Holding; onPress: () => void }) => {
    const isPositive = holding.total_pnl >= 0;
    
    return (
      <TouchableOpacity style={styles.holdingCard} onPress={onPress}>
        <View style={styles.holdingHeader}>
          <View>
            <Text style={styles.ticker}>{holding.symbol}</Text>
            <Text style={styles.companyName}>{holding.company_name}</Text>
            {holding.sector && <Text style={styles.sector}>{holding.sector}</Text>}
            {holding.currency && holding.currency !== portfolio?.base_currency && (
              <Text style={styles.currency}>{holding.currency}</Text>
            )}
          </View>
          <View style={styles.holdingValues}>
            <Text style={styles.totalValue}>
              {formatCurrency(holding.base_currency_value || holding.current_value)}
            </Text>
            <Text style={[styles.gainLoss, isPositive ? styles.positive : styles.negative]}>
              {isPositive ? '+' : ''}{formatCurrency(holding.total_pnl)} ({formatPercentage(holding.total_pnl_pct)})
            </Text>
          </View>
        </View>
        
        <View style={styles.holdingDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Shares</Text>
            <Text style={styles.detailValue}>{holding.quantity}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Avg Price</Text>
            <Text style={styles.detailValue}>
              {holding.average_price != null && !isNaN(holding.average_price) 
                ? formatCurrency(holding.average_price) 
                : 'N/A'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const SummaryCard = ({ title, value, subtitle, isPositive }: {
    title: string;
    value: string;
    subtitle?: string;
    isPositive?: boolean;
  }) => (
    <View style={styles.summaryCard}>
      <GradientText style={styles.summaryTitle}>{title}</GradientText>
      <Text style={[styles.summaryValue, isPositive !== undefined && (isPositive ? styles.positive : styles.negative)]}>
        {value}
      </Text>
      {subtitle && <Text style={styles.summarySubtitle}>{subtitle}</Text>}
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.buttonBackground} />
        <Text style={styles.loadingText}>Loading portfolio...</Text>
      </View>
    );
  }
  
  // Show error state if both portfolio and transactions failed
  if (portfolioError && transactionsError) {
    console.error(`[${timestamp}] [PortfolioScreen] Both API calls failed:`, {
      portfolioError,
      transactionsError
    });
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Failed to load portfolio data</Text>
        <Text style={styles.errorSubtext}>{portfolioError?.message || 'Unknown error'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleHoldingPress = (holding: Holding) => {
    Alert.alert(
      holding.symbol,
      `What would you like to do with ${holding.company_name}?`,
      [
        { text: 'View Details', onPress: () => navigation.navigate('StockDetail', { ticker: holding.symbol }) },
        { text: 'Buy More', onPress: () => console.log('Buy more') },
        { text: 'Sell', onPress: () => console.log('Sell') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleAddPosition = () => {
    Alert.alert('Add Position', 'Add new position functionality coming soon!');
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <GradientText style={styles.headerTitle}>My Holdings</GradientText>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPosition}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.summaryGrid}>
          <SummaryCard
            title={`Total Value ${portfolio?.base_currency ? `(${portfolio.base_currency})` : ''}`}
            value={formatCurrency(totalValue)}
          />
          <SummaryCard
            title="Total Gain/Loss"
            value={formatCurrency(Math.abs(totalGainLoss))}
            subtitle={`${totalGainLoss >= 0 ? '+' : '-'}${formatPercentage(Math.abs(totalGainLossPercent))}`}
            isPositive={totalGainLoss >= 0}
          />
          <SummaryCard
            title="Positions"
            value={holdings.length.toString()}
            subtitle="Active Holdings"
          />
          <SummaryCard
            title="Best Performer"
            value={bestPerformer?.symbol || 'N/A'}
            subtitle={bestPerformer && bestPerformer.total_pnl_pct != null && !isNaN(bestPerformer.total_pnl_pct)
              ? `${bestPerformer.total_pnl_pct >= 0 ? '+' : ''}${formatPercentage(bestPerformer.total_pnl_pct)}`
              : ''}
            isPositive={true}
          />
        </View>

        {/* Holdings List */}
        {holdings.length > 0 ? (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>Holdings</GradientText>
            {holdings.map((holding: Holding) => (
              <HoldingCard
                key={holding.symbol}
                holding={holding}
                onPress={() => handleHoldingPress(holding)}
              />
            ))}
          </View>
        ) : transactions.length > 0 ? (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>Recent Transactions</GradientText>
            <Text style={styles.sectionSubtitle}>
              Holdings are being calculated from your transactions...
            </Text>
            {transactions.slice(0, 5).map((transaction: any) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionType}>{transaction.transaction_type}</Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.transaction_date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionSymbol}>{transaction.ticker}</Text>
                  <Text style={styles.transactionQuantity}>
                    {transaction.quantity} shares @ {formatCurrency(transaction.price_per_share || transaction.price || 0)}
                  </Text>
                  <Text style={styles.transactionTotal}>
                    Total: {formatCurrency(transaction.total_amount || (transaction.quantity * (transaction.price_per_share || transaction.price || 0)) || 0)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>No Holdings</GradientText>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Add your first transaction to start tracking</Text>
            </View>
          </View>
        )}

        {/* Sector Allocation */}
        {sectorAllocation.length > 0 && (
          <View style={styles.section}>
            <GradientText style={styles.sectionTitle}>Sector Allocation</GradientText>
            <View style={styles.sectorList}>
              {sectorAllocation.map(({ sector, percentage }) => (
                <View key={sector} style={styles.sectorItem}>
                  <Text style={styles.sectorName}>{sector}</Text>
                  <Text style={styles.sectorPercentage}>{formatPercentage(percentage / 100)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Portfolio Performance */}
        <View style={styles.section}>
          <GradientText style={styles.sectionTitle}>Portfolio Performance</GradientText>
          <View style={styles.dailyPerformance}>
            <Text style={styles.dailyLabel}>Total Gain/Loss</Text>
            <Text style={[
              styles.dailyValue,
              totalGainLoss >= 0 ? styles.positive : styles.negative
            ]}>
              {totalGainLoss !== 0 
                ? `${totalGainLoss >= 0 ? '+' : ''}${formatCurrency(Math.abs(totalGainLoss))}`
                : '$0.00'} 
              {totalGainLossPercent !== 0
                ? ` (${totalGainLossPercent >= 0 ? '+' : '-'}${formatPercentage(Math.abs(totalGainLossPercent))})`
                : ' (0.00%)'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleAddPosition}>
            <Text style={styles.actionButtonText}>📈 Add Position</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => navigation.navigate('Analytics')}
          >
            <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>📊 View Analytics</Text>
          </TouchableOpacity>
        </View>
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    color: theme.colors.primaryText,
  },
  addButton: {
    backgroundColor: theme.colors.greenAccent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: theme.colors.buttonText,
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryTitle: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
  positive: {
    color: theme.colors.positive,
  },
  negative: {
    color: theme.colors.negative,
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
  holdingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ticker: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.blueAccent,
  },
  currency: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginTop: 2,
  },
  companyName: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginTop: 2,
  },
  sector: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginTop: 2,
  },
  holdingValues: {
    alignItems: 'flex-end',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
  },
  gainLoss: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  holdingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginTop: 2,
  },
  sectorList: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sectorName: {
    fontSize: 16,
    color: theme.colors.secondaryText,
  },
  sectorPercentage: {
    color: theme.colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  dailyPerformance: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dailyLabel: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    marginBottom: 4,
  },
  dailyValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginBottom: 12,
  },
  transactionCard: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.greenAccent,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
  transactionDetails: {
    gap: 4,
  },
  transactionSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
  },
  transactionQuantity: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  transactionTotal: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    color: theme.colors.secondaryText,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.colors.buttonBackground,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.buttonBackground,
  },
  actionButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: theme.colors.buttonBackground,
  },
  errorText: {
    color: theme.colors.negative,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.buttonBackground,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: theme.colors.buttonText,
    fontWeight: '600',
  },
});