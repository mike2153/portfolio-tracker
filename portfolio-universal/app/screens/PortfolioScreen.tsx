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
  formatPercentage,
  COLORS 
} from '@portfolio-tracker/shared';

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
}

const HoldingCard = ({ holding, onPress }: { holding: Holding; onPress: () => void }) => {
  const isPositive = holding.total_pnl >= 0;
  
  return (
    <TouchableOpacity style={styles.holdingCard} onPress={onPress}>
      <View style={styles.holdingHeader}>
        <View>
          <Text style={styles.ticker}>{holding.symbol}</Text>
          <Text style={styles.companyName}>{holding.company_name}</Text>
          {holding.sector && <Text style={styles.sector}>{holding.sector}</Text>}
        </View>
        <View style={styles.holdingValues}>
          <Text style={styles.totalValue}>{formatCurrency(holding.current_value)}</Text>
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
          <Text style={styles.detailValue}>{formatCurrency(holding.average_price)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Current</Text>
          <Text style={styles.detailValue}>{formatCurrency(holding.current_price)}</Text>
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
    <Text style={styles.summaryTitle}>{title}</Text>
    <Text style={[styles.summaryValue, isPositive !== undefined && (isPositive ? styles.positive : styles.negative)]}>
      {value}
    </Text>
    {subtitle && <Text style={styles.summarySubtitle}>{subtitle}</Text>}
  </View>
);

export default function PortfolioScreen({ navigation }: Props): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  
  // Fetch portfolio data
  const { data: portfolioData, isLoading, refetch } = useQuery({
    queryKey: ['portfolio'],
    queryFn: front_api_get_portfolio,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch transactions data
  const { data: transactionsData, refetch: refetchTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: front_api_get_transactions,
    refetchInterval: 60000,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchTransactions()]);
    setRefreshing(false);
  }, [refetch, refetchTransactions]);

  // Extract data - the API returns the data directly, not wrapped in a 'data' field
  const portfolio = portfolioData;
  const holdings = portfolio?.holdings || [];
  const transactions = transactionsData?.transactions || transactionsData || [];

  // Debug logging
  console.log('[DEBUG PortfolioScreen] Portfolio data:', portfolio);
  console.log('[DEBUG PortfolioScreen] Transactions data:', transactionsData);
  console.log('[DEBUG PortfolioScreen] Holdings:', holdings);
  console.log('[DEBUG PortfolioScreen] Transactions:', transactions);

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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading portfolio...</Text>
      </View>
    );
  }

  const handleHoldingPress = (holding: Holding) => {
    Alert.alert(
      holding.symbol,
      `What would you like to do with ${holding.company_name}?`,
      [
        { text: 'View Details', onPress: () => navigation.navigate('StockDetail', { symbol: holding.symbol }) },
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
          <Text style={styles.headerTitle}>My Holdings</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPosition}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.summaryGrid}>
          <SummaryCard
            title="Total Value"
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
            subtitle={bestPerformer ? `+${formatPercentage(bestPerformer.total_pnl_pct)}` : ''}
            isPositive={true}
          />
        </View>

        {/* Holdings List */}
        {holdings.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Holdings</Text>
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
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
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
            <Text style={styles.sectionTitle}>No Holdings</Text>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Add your first transaction to start tracking</Text>
            </View>
          </View>
        )}

        {/* Sector Allocation */}
        {sectorAllocation.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sector Allocation</Text>
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

        {/* Daily Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Performance</Text>
          <View style={styles.dailyPerformance}>
            <Text style={styles.dailyLabel}>Daily Change</Text>
            <Text style={[
              styles.dailyValue,
              dailyChange >= 0 ? styles.positive : styles.negative
            ]}>
              {dailyChange >= 0 ? '+' : ''}{formatCurrency(dailyChange)} ({formatPercentage(dailyChangePercent)})
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

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#9ca3af',
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
  addButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summarySubtitle: {
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
  holdingCard: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ticker: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  companyName: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 2,
  },
  sector: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  holdingValues: {
    alignItems: 'flex-end',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
    marginTop: 2,
  },
  sectorList: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
  },
  sectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sectorName: {
    fontSize: 16,
    color: '#d1d5db',
  },
  sectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sectorPercentage: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  sectorPercent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  dailyPerformance: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
  },
  dailyLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
  },
  dailyValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 12,
  },
  transactionCard: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  transactionDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  transactionDetails: {
    gap: 4,
  },
  transactionSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  transactionQuantity: {
    fontSize: 14,
    color: '#d1d5db',
  },
  transactionTotal: {
    fontSize: 14,
    color: '#d1d5db',
  },
  emptyCard: {
    backgroundColor: '#374151',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#3b82f6',
  },
});