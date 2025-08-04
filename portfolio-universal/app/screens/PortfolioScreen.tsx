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
import { MainTabScreenProps } from '../navigation/types';
import { 
  formatCurrency, 
  formatPercentage
} from '@portfolio-tracker/shared';
import { usePortfolioSummary, usePerformanceData, useDividendData, usePortfolioComplete } from '../hooks/usePortfolioComplete';
import PortfolioHeader from '../components/ui/PortfolioHeader';
import PortfolioTabs from '../components/ui/PortfolioTabs';
import SearchBar from '../components/ui/SearchBar';
import CompanyLogo from '../components/ui/CompanyLogo';
import GradientText from '../components/GradientText';
import GlassCard from '../components/ui/GlassCard';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme/theme';

type Props = MainTabScreenProps<'Portfolio'>;

// Remove unused Holding interface as we're using consolidated data structure

export default function PortfolioScreen({ navigation }: Props): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('holdings');
  const [searchText, setSearchText] = useState('');
  const { theme } = useTheme();
  
  // Data hooks
  const {
    holdings,
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio
  } = usePortfolioSummary();
  
  const {
    dailyChange,
    dailyChangePercent,
    volatility,
    sharpeRatio,
    isLoading: performanceLoading
  } = usePerformanceData();
  
  const {
    isLoading: dividendLoading
  } = useDividendData();
  
  // Tab definitions
  const portfolioTabs = [
    { key: 'holdings', label: 'Holdings' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'corporate-actions', label: 'Corporate actions' },
  ];

  // Combined loading state
  const isLoading = portfolioLoading || performanceLoading || dividendLoading;

  // Get transactions from consolidated data instead of separate API call
  const { transactionsSummary } = usePortfolioComplete();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchPortfolio();
    } catch (error) {
      console.error('Refresh error:', error);
    }
    setRefreshing(false);
  }, [refetchPortfolio]);

  // Extract recent transactions from consolidated data
  const transactions = transactionsSummary?.recent_transactions || [];

  // Filter holdings based on search text
  const filteredHoldings = useMemo(() => {
    if (!searchText.trim()) return holdings;
    return holdings.filter((holding: any) => 
      holding.symbol.toLowerCase().includes(searchText.toLowerCase()) ||
      (holding.company_name || '').toLowerCase().includes(searchText.toLowerCase())
    );
  }, [holdings, searchText]);

  // Remove best/worst performers calculation as it's not needed

  const styles = getStyles(theme);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.greenAccent} />
        <Text style={styles.loadingText}>Loading portfolio...</Text>
      </View>
    );
  }

  // Error state
  if (portfolioError) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.errorText}>Failed to load portfolio data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Remove Performance Dashboard as it's not in the target design

  // Holdings Table Component - matching the exact design
  const HoldingsList = () => (
    <View style={styles.holdingsContainer}>
      {filteredHoldings.length > 0 ? (
        filteredHoldings.map((holding: any, index: number) => (
          <TouchableOpacity 
            key={holding.symbol}
            style={[
              styles.holdingRow,
              index === filteredHoldings.length - 1 && styles.lastHoldingRow
            ]}
            onPress={() => navigation.navigate('StockDetail', { ticker: holding.symbol })}
          >
            <View style={styles.holdingLeft}>
              <CompanyLogo
                symbol={holding.symbol}
                size={40}
                style={{ marginRight: 12 }}
              />
              <View style={styles.holdingInfo}>
                <Text style={styles.holdingName}>{holding.company_name || holding.symbol}</Text>
                <Text style={styles.holdingDetails}>
                  {holding.symbol} • {Math.round(holding.quantity || 0)} shares
                </Text>
              </View>
            </View>
            <View style={styles.holdingRight}>
              <Text style={styles.holdingValue}>
                {formatCurrency(holding.current_value || 0)}
              </Text>
              <Text style={[
                styles.holdingGainLoss,
                (holding.total_gain_loss || 0) >= 0 ? styles.positive : styles.negative
              ]}>
                {(holding.total_gain_loss || 0) >= 0 ? '+' : ''}{formatCurrency(Math.abs(holding.total_gain_loss || 0))} ▲ {formatPercentage(Math.abs(holding.total_gain_loss_percent || 0))}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No holdings found</Text>
          <Text style={styles.emptySubtext}>Add your first transaction to start tracking</Text>
        </View>
      )}
    </View>
  );

  // Remove AllocationsView as it's not in the target design

  // Transactions Component
  const TransactionsView = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <GradientText variant="secondary" style={styles.sectionTitle}>
          Recent Transactions
        </GradientText>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      {transactions.length > 0 ? (
        transactions.map((transaction: any, index: number) => (
          <GlassCard key={`${transaction.symbol}-${transaction.date}-${index}`} style={styles.transactionCard}>
            <View style={styles.transactionHeader}>
              <Text style={styles.transactionType}>{transaction.type}</Text>
              <Text style={styles.transactionDate}>
                {new Date(transaction.date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionSymbol}>{transaction.symbol}</Text>
              <Text style={styles.transactionQuantity}>
                {transaction.quantity} shares @ {formatCurrency(transaction.price || 0)}
              </Text>
              <Text style={styles.transactionTotal}>
                Total: {formatCurrency((transaction.quantity * transaction.price) || 0)}
              </Text>
            </View>
          </GlassCard>
        ))
      ) : (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyText}>No transactions found</Text>
          <Text style={styles.emptySubtext}>Add your first transaction to get started</Text>
        </GlassCard>
      )}
    </View>
  );

  // Remove AnalyticsView as it's not in the target design

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'holdings':
        return <HoldingsList />;
      case 'transactions':
        return <TransactionsView />;
      case 'corporate-actions':
        return (
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Corporate actions coming soon</Text>
          </View>
        );
      default:
        return <HoldingsList />;
    }
  };

  return (
    <View style={styles.container}>
      <PortfolioHeader 
        title="My portfolio"
        onSearchPress={() => console.log('Search pressed')}
        onStarPress={() => console.log('Star pressed')}
        onAddPress={() => console.log('Add pressed')}
      />
      
      <PortfolioTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={portfolioTabs}
      />
      
      {activeTab === 'holdings' && (
        <SearchBar
          placeholder="Search..."
          value={searchText}
          onChangeText={setSearchText}
          onSortPress={() => console.log('Sort pressed')}
          onMenuPress={() => console.log('Menu pressed')}
        />
      )}
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.content}>
          {renderTabContent()}
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
    flex: 1,
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
    fontWeight: '600',
    marginBottom: 8,
  },
  
  retryButton: {
    backgroundColor: theme.colors.buttonBackground,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  
  retryButtonText: {
    color: theme.colors.buttonText,
    fontWeight: '600',
  },
  
  // Holdings Container - Fey glass panel
  holdingsContainer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    margin: 8,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.glassShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  
  lastHoldingRow: {
    borderBottomWidth: 0,
  },
  
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  // Removed tickerIcon styles - now using CompanyLogo component
  
  holdingInfo: {
    flex: 1,
  },
  
  holdingName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  
  holdingDetails: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  
  holdingRight: {
    alignItems: 'flex-end',
  },
  
  holdingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  
  holdingGainLoss: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  positive: {
    color: theme.colors.positive, // Fey green
  },
  
  negative: {
    color: theme.colors.negative, // Fey red
  },
  
  // Transactions View - Fey glass cards
  transactionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: theme.colors.glassShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.accentPurple, // Fey purple
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
  
  // Coming Soon - Fey styling
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  
  comingSoonText: {
    fontSize: 16,
    color: theme.colors.secondaryText,
    textAlign: 'center',
  },
  
  // Empty states - Fey styling
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: theme.colors.surface,
    margin: 16,
    borderRadius: theme.borderRadius.lg,
  },
  
  emptyText: {
    color: theme.colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  
  emptySubtext: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
  },
});