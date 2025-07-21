import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useQuery } from '@tanstack/react-query';
import { 
  front_api_get_stock_overview, 
  front_api_get_quote,
  formatCurrency,
  formatPercentage,
  COLORS 
} from '@portfolio-tracker/shared';
import StockChartKit from '../components/charts/StockChartKit';

type Props = NativeStackScreenProps<RootStackParamList, 'StockDetail'>;

export default function StockDetailScreen({ route }: Props): React.JSX.Element {
  const { symbol } = route.params;
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState('1Y');
  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'area'>('line');

  // Fetch stock quote
  const { data: quoteData, isLoading: quoteLoading, refetch: refetchQuote } = useQuery({
    queryKey: ['stock-quote', symbol],
    queryFn: () => front_api_get_quote(symbol),
  });

  // Fetch stock overview
  const { data: overviewData, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ['stock-overview', symbol],
    queryFn: () => front_api_get_stock_overview(symbol),
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    Promise.all([refetchQuote(), refetchOverview()]).finally(() => {
      setRefreshing(false);
    });
  }, [refetchQuote, refetchOverview]);

  const quote = quoteData?.data;
  const overview = overviewData?.data;
  const isLoading = quoteLoading || overviewLoading;

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading {symbol} data...</Text>
      </View>
    );
  }

  const isPositive = (quote?.change || 0) >= 0;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.companyName}>{overview?.Name || 'Loading...'}</Text>
        </View>
        <View style={styles.priceInfo}>
          <Text style={styles.price}>
            {quote ? formatCurrency(quote.price) : '--'}
          </Text>
          {quote && (
            <Text style={[styles.change, isPositive ? styles.positive : styles.negative]}>
              {isPositive ? '+' : ''}{formatCurrency(quote.change)} ({formatPercentage(quote.change_percent / 100)})
            </Text>
          )}
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartSection}>
        {/* Chart Type Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartTypeSelector}>
          {(['line', 'candlestick', 'area'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.chartTypeButton,
                chartType === type && styles.chartTypeButtonActive,
              ]}
              onPress={() => setChartType(type)}
            >
              <Text
                style={[
                  styles.chartTypeButtonText,
                  chartType === type && styles.chartTypeButtonTextActive,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <StockChartKit
          data={[{
            symbol: symbol,
            data: [], // This will be populated by the chart component
          }]}
          height={300}
          timePeriod={timePeriod}
          onTimePeriodChange={setTimePeriod}
          showLegend={false}
        />
      </View>

      {/* Key Stats */}
      {overview && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Market Cap</Text>
              <Text style={styles.statValue}>
                {overview.MarketCapitalization ? 
                  formatCurrency(parseInt(overview.MarketCapitalization)) : '--'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>P/E Ratio</Text>
              <Text style={styles.statValue}>{overview.PERatio || '--'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>EPS</Text>
              <Text style={styles.statValue}>{overview.EPS || '--'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Dividend Yield</Text>
              <Text style={styles.statValue}>
                {overview.DividendYield ? 
                  formatPercentage(parseFloat(overview.DividendYield)) : '--'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>52W High</Text>
              <Text style={styles.statValue}>{overview['52WeekHigh'] || '--'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>52W Low</Text>
              <Text style={styles.statValue}>{overview['52WeekLow'] || '--'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Company Info */}
      {overview && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Information</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Sector</Text>
            <Text style={styles.infoValue}>{overview.Sector || '--'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Industry</Text>
            <Text style={styles.infoValue}>{overview.Industry || '--'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Exchange</Text>
            <Text style={styles.infoValue}>{overview.Exchange || '--'}</Text>
          </View>
          {overview.Description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.infoLabel}>Description</Text>
              <Text style={styles.description}>{overview.Description}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, styles.buyButton]}>
          <Text style={styles.buyButtonText}>Buy {symbol}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.watchlistButton]}>
          <Text style={styles.watchlistButtonText}>Add to Watchlist</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textMuted,
    fontSize: 16,
  },
  header: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  symbol: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  companyName: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  priceInfo: {
    marginTop: 16,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  change: {
    fontSize: 18,
    marginTop: 4,
  },
  positive: {
    color: COLORS.positive,
  },
  negative: {
    color: COLORS.negative,
  },
  chartSection: {
    marginTop: 16,
  },
  chartTypeSelector: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chartTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
    marginRight: 8,
  },
  chartTypeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  chartTypeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  chartTypeButtonTextActive: {
    color: COLORS.text,
  },
  section: {
    padding: 16,
    backgroundColor: COLORS.surface,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  descriptionContainer: {
    paddingTop: 16,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: COLORS.primary,
  },
  buyButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  watchlistButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  watchlistButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});