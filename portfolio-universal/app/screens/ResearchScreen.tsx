import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MainTabScreenProps } from '../navigation/types';
import { 
  front_api_get_dashboard,
  front_api_get_quote,
  front_api_get_stock_overview,
  front_api_get_news,
  formatCurrency,
  formatPercentage
} from '@portfolio-tracker/shared';
import GradientText from '../components/GradientText';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme/theme';
import StockSearchInput from '../components/ui/StockSearchInput';
import { StockSymbol } from '../hooks/useStockSearch';
import TabSelector from '../components/ui/TabSelector';
import { OverviewTab, MetricsTab, FinancialsTab } from '../components/research';

type Props = MainTabScreenProps<'Research'>;

export default function ResearchScreen({ navigation }: Props): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<StockSymbol | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { theme } = useTheme();

  // Fetch dashboard data for market indices
  const { refetch: refetchDashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      try {
        return await front_api_get_dashboard();
      } catch (error) {
        console.log('[ResearchScreen] Dashboard data not available:', error);
        return null;
      }
    },
    enabled: false, // Disable by default since this might not be needed
    retry: false,
  });

  // Fetch quote data when user selects a symbol
  const { data: quoteData, isLoading: quoteLoading, error: quoteError } = useQuery({
    queryKey: ['quote', selectedSymbol?.symbol],
    queryFn: async () => {
      const result = await front_api_get_quote(selectedSymbol!.symbol);
      console.log('[ResearchScreen] Quote API response:', {
        symbol: selectedSymbol!.symbol,
        success: result?.success,
        hasData: !!result?.data,
        error: result?.error,
        dataKeys: result?.data ? Object.keys(result.data) : [],
        fullResponse: JSON.stringify(result, null, 2)
      });
      
      // If quote fails but we have data, try to use it
      if (result?.success === false && result?.data) {
        console.log('[ResearchScreen] Quote failed but has data, attempting to use it');
        return { ...result, success: true };
      }
      
      return result;
    },
    enabled: !!selectedSymbol,
  });

  // Fetch stock overview as fallback
  const { data: overviewData } = useQuery({
    queryKey: ['stock-overview', selectedSymbol?.symbol],
    queryFn: async () => {
      try {
        const result = await front_api_get_stock_overview(selectedSymbol!.symbol);
        console.log('[ResearchScreen] Overview API response:', {
          symbol: selectedSymbol!.symbol,
          hasData: !!result,
          topLevelKeys: result ? Object.keys(result) : [],
          fundamentalsKeys: result?.fundamentals ? Object.keys(result.fundamentals) : [],
          priceDataKeys: result?.price_data ? Object.keys(result.price_data) : [],
          fullData: JSON.stringify(result, null, 2)
        });
        return result;
      } catch (error) {
        console.error('[ResearchScreen] Overview API error:', error);
        return null;
      }
    },
    enabled: !!selectedSymbol && !quote, // Only fetch if quote failed
  });

  // Fetch news for selected symbol
  const { data: newsData } = useQuery({
    queryKey: ['news', selectedSymbol?.symbol],
    queryFn: () => front_api_get_news(selectedSymbol!.symbol, 10),
    enabled: !!selectedSymbol,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetchDashboard();
    setRefreshing(false);
  }, [refetchDashboard]);

  const handleSelectSymbol = (symbol: StockSymbol) => {
    setSelectedSymbol(symbol);
    setActiveTab('overview'); // Reset to overview tab when selecting new symbol
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'metrics', label: 'Metrics' },
    { key: 'financials', label: 'Financials' },
  ];

  // Extract data - Handle API response format
  const apiResponse = quoteData;
  const quote = apiResponse?.success === false ? null : (apiResponse?.data || apiResponse);
  const news = newsData?.data?.items || [];
  
  // Use overview data to enhance quote if available
  // Check if overview data is nested under fundamentals
  const fundamentals = overviewData?.fundamentals || overviewData;
  
  const enhancedQuote = quote || (fundamentals && Object.keys(fundamentals).length > 0 ? {
    symbol: selectedSymbol?.symbol,
    name: fundamentals.name || fundamentals.Name || selectedSymbol?.name,
    price: fundamentals.price || overviewData?.price_data?.price || 0,
    change: 0,
    change_percent: 0,
    volume: 0,
    low: parseFloat(String(fundamentals['52_week_low'] || '0')),
    high: parseFloat(String(fundamentals['52_week_high'] || '0')),
    // Additional data from overview
    marketCap: fundamentals.market_cap || fundamentals.MarketCapitalization,
    pe: fundamentals.pe_ratio || fundamentals.PERatio,
    dividend: fundamentals.dividend_per_share || fundamentals.DividendPerShare,
    sector: fundamentals.sector || fundamentals.Sector
  } : null);
  
  // Log the enhanced quote data
  if (enhancedQuote) {
    console.log('[ResearchScreen] Enhanced quote data:', {
      symbol: selectedSymbol?.symbol,
      enhancedQuote: JSON.stringify(enhancedQuote, null, 2),
      quoteData: quote,
      overviewData: overviewData
    });
  }
  
  const styles = getStyles(theme);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <GradientText style={styles.headerTitle}>📊 Research</GradientText>
        </View>

        {/* Stock Search */}
        <View style={styles.searchSection}>
          <StockSearchInput
            onSelectSymbol={handleSelectSymbol}
            placeholder="Search stocks (e.g., AAPL)"
          />
        </View>

        {/* Market Indices - TODO: Add when available in API */}

        {/* Search Results */}
        {selectedSymbol && (
          <>
            {quoteLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.buttonBackground} />
                <Text style={styles.loadingText}>Loading {selectedSymbol.symbol}...</Text>
              </View>
            ) : overviewData ? (
              <>
                {/* Stock Header */}
                <View style={styles.stockHeader}>
                  <View>
                    <Text style={styles.stockName}>
                      {overviewData.fundamentals?.name || overviewData.fundamentals?.Name || selectedSymbol.name}
                    </Text>
                    <Text style={styles.stockSymbol}>
                      {selectedSymbol.symbol} • {overviewData.fundamentals?.exchange || overviewData.fundamentals?.Exchange || 'N/A'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.detailButton}
                    onPress={() => navigation.navigate('StockDetail', { ticker: selectedSymbol.symbol })}
                  >
                    <Text style={styles.detailButtonText}>View Details →</Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Selector */}
                <TabSelector
                  tabs={tabs}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />

                {/* Tab Content */}
                <View style={styles.tabContent}>
                  {activeTab === 'overview' && (
                    <OverviewTab data={overviewData} news={news} />
                  )}
                  {activeTab === 'metrics' && (
                    <MetricsTab data={overviewData} />
                  )}
                  {activeTab === 'financials' && (
                    <FinancialsTab data={overviewData} />
                  )}
                </View>
              </>
            ) : apiResponse?.error ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>Error loading data for "{selectedSymbol.symbol}"</Text>
                <Text style={styles.errorDetail}>{apiResponse.error}</Text>
              </View>
            ) : (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No data available for "{selectedSymbol.symbol}"</Text>
              </View>
            )}
          </>
        )}

        {/* Info Section */}
        {!selectedSymbol && (
          <View style={styles.infoSection}>
            <Text style={styles.infoIcon}>🔍</Text>
            <Text style={styles.infoTitle}>Search for Stocks</Text>
            <Text style={styles.infoText}>
              Enter a stock symbol above to view quotes, news, and analysis
            </Text>
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
  searchSection: {
    marginBottom: 24,
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
  indexCard: {
    backgroundColor: theme.colors.border,
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 120,
  },
  indexName: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginBottom: 4,
  },
  indexValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  indexChange: {
    fontSize: 14,
    fontWeight: '500',
  },
  positive: {
    color: theme.colors.positive,
  },
  negative: {
    color: theme.colors.negative,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.colors.secondaryText,
  },
  stockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  stockName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  stockSymbol: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  detailButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailButtonText: {
    fontSize: 14,
    color: theme.colors.primaryText,
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
  },
  noResults: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    color: theme.colors.secondaryText,
    fontSize: 16,
  },
  errorDetail: {
    color: theme.colors.negative,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  newsItem: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.primaryText,
    marginBottom: 8,
  },
  newsSource: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
  sentimentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  positiveSentiment: {
    backgroundColor: theme.colors.positive + '20', // 20% opacity in hex
  },
  negativeSentiment: {
    backgroundColor: theme.colors.negative + '20', // 20% opacity in hex
  },
  neutralSentiment: {
    backgroundColor: theme.colors.secondaryText + '20', // 20% opacity in hex
  },
  sentimentText: {
    fontSize: 12,
    color: theme.colors.primaryText,
    textTransform: 'capitalize',
  },
  infoSection: {
    alignItems: 'center',
    padding: 48,
  },
  infoIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: theme.colors.secondaryText,
    textAlign: 'center',
  },
});