import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MainTabScreenProps } from '../navigation/types';
import { 
  front_api_get_dashboard,
  front_api_get_quote,
  front_api_get_news,
  formatCurrency,
  formatPercentage
} from '@portfolio-tracker/shared';
import GradientText from '../components/GradientText';
import { colors } from '../theme/colors';

type Props = MainTabScreenProps<'Research'>;

export default function ResearchScreen({ navigation }: Props): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [searchedSymbol, setSearchedSymbol] = useState('');

  // Fetch dashboard data for market indices
  const { data: dashboardData, refetch: refetchDashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: front_api_get_dashboard,
    refetchInterval: 60000,
  });

  // Fetch quote data when user searches
  const { data: quoteData, isLoading: quoteLoading } = useQuery({
    queryKey: ['quote', searchedSymbol],
    queryFn: () => front_api_get_quote(searchedSymbol),
    enabled: !!searchedSymbol,
  });

  // Fetch news for searched symbol
  const { data: newsData } = useQuery({
    queryKey: ['news', searchedSymbol],
    queryFn: () => front_api_get_news(searchedSymbol, 10),
    enabled: !!searchedSymbol,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetchDashboard();
    setRefreshing(false);
  }, [refetchDashboard]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSearchedSymbol(searchQuery.trim().toUpperCase());
    }
  };

  // Extract data - API returns data directly
  const dashboard = dashboardData;
  const quote = quoteData?.data || quoteData; // Handle both response formats
  const news = newsData?.data?.items || newsData?.items || [];

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

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search stocks (e.g., AAPL)"
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Market Indices - TODO: Add when available in API */}

        {/* Search Results */}
        {searchedSymbol && (
          <>
            {quoteLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.buttonBackground} />
                <Text style={styles.loadingText}>Searching for {searchedSymbol}...</Text>
              </View>
            ) : quote ? (
              <View style={styles.section}>
                <GradientText style={styles.sectionTitle}>Quote: {searchedSymbol}</GradientText>
                <TouchableOpacity 
                  style={styles.quoteCard}
                  onPress={() => navigation.navigate('StockDetail', { symbol: searchedSymbol })}
                >
                  <View style={styles.quoteHeader}>
                    <Text style={styles.quoteName}>{quote.name || searchedSymbol}</Text>
                    <Text style={styles.quoteSymbol}>{quote.symbol}</Text>
                  </View>
                  <View style={styles.quoteDetails}>
                    <Text style={styles.quotePrice}>{formatCurrency(quote.price)}</Text>
                    <Text style={[
                      styles.quoteChange,
                      quote.change >= 0 ? styles.positive : styles.negative
                    ]}>
                      {quote.change >= 0 ? '+' : ''}{formatCurrency(quote.change)} ({formatPercentage(quote.percent_change)})
                    </Text>
                  </View>
                  <View style={styles.quoteMetrics}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Volume</Text>
                      <Text style={styles.metricValue}>{(quote.volume / 1000000).toFixed(1)}M</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Day Range</Text>
                      <Text style={styles.metricValue}>{formatCurrency(quote.day_low)} - {formatCurrency(quote.day_high)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No results found for "{searchedSymbol}"</Text>
              </View>
            )}

            {/* News */}
            {news.length > 0 && (
              <View style={styles.section}>
                <GradientText style={styles.sectionTitle}>Latest News</GradientText>
                {news.slice(0, 5).map((item: any, index: number) => (
                  <View key={index} style={styles.newsItem}>
                    <Text style={styles.newsTitle}>{item.title}</Text>
                    <Text style={styles.newsSource}>{item.source} • {item.published_at}</Text>
                    {item.sentiment && (
                      <View style={[
                        styles.sentimentBadge,
                        item.sentiment === 'positive' ? styles.positiveSentiment :
                        item.sentiment === 'negative' ? styles.negativeSentiment :
                        styles.neutralSentiment
                      ]}>
                        <Text style={styles.sentimentText}>{item.sentiment}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Info Section */}
        {!searchedSymbol && (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.primaryText,
  },
  searchSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: 8,
    padding: 12,
    color: colors.primaryText,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: colors.buttonText,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 16,
  },
  indexCard: {
    backgroundColor: colors.border,
    padding: 16,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 120,
  },
  indexName: {
    fontSize: 14,
    color: colors.secondaryText,
    marginBottom: 4,
  },
  indexValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primaryText,
    marginBottom: 4,
  },
  indexChange: {
    fontSize: 14,
    fontWeight: '500',
  },
  positive: {
    color: colors.greenAccent,
  },
  negative: {
    color: '#ef4444', // Keep red for negative values
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.secondaryText,
  },
  quoteCard: {
    backgroundColor: colors.border,
    padding: 16,
    borderRadius: 12,
  },
  quoteHeader: {
    marginBottom: 12,
  },
  quoteName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
  },
  quoteSymbol: {
    fontSize: 14,
    color: colors.secondaryText,
  },
  quoteDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quotePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryText,
  },
  quoteChange: {
    fontSize: 16,
    fontWeight: '500',
  },
  quoteMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: colors.secondaryText,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    color: colors.primaryText,
    fontWeight: '500',
  },
  noResults: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    color: colors.secondaryText,
    fontSize: 16,
  },
  newsItem: {
    backgroundColor: colors.border,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primaryText,
    marginBottom: 8,
  },
  newsSource: {
    fontSize: 12,
    color: colors.secondaryText,
  },
  sentimentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  positiveSentiment: {
    backgroundColor: `${colors.greenAccent}33`, // 20% opacity
  },
  negativeSentiment: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // Keep red for negative
  },
  neutralSentiment: {
    backgroundColor: `${colors.secondaryText}33`, // 20% opacity
  },
  sentimentText: {
    fontSize: 12,
    color: colors.primaryText,
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
    color: colors.primaryText,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: colors.secondaryText,
    textAlign: 'center',
  },
});