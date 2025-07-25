import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';
import { formatCurrency, formatPercentage } from '@portfolio-tracker/shared';
import GradientText from '../GradientText';

interface OverviewTabProps {
  data: any;
  news: any[];
}

const OverviewTab: React.FC<OverviewTabProps> = ({ data, news }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  if (!data) return null;

  const fundamentals = data.fundamentals || data;
  
  // Extract price data - handle various data structures
  const currentPrice = fundamentals.price || 
                      data.price_data?.price || 
                      parseFloat(fundamentals['50_day_ma'] || fundamentals['50DayMovingAverage'] || '0');
  
  const priceChange = data.price_data?.change || 0;
  const priceChangePercent = data.price_data?.change_percent || 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Company Info */}
      <View style={styles.section}>
        <GradientText style={styles.sectionTitle}>Company Information</GradientText>
        <View style={styles.card}>
          <Text style={styles.companyName}>{fundamentals.name || fundamentals.Name}</Text>
          <Text style={styles.companyDetails}>
            {fundamentals.exchange || fundamentals.Exchange} • {fundamentals.sector || fundamentals.Sector}
          </Text>
          {fundamentals.description || fundamentals.Description ? (
            <Text style={styles.description}>
              {fundamentals.description || fundamentals.Description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Price Info */}
      <View style={styles.section}>
        <GradientText style={styles.sectionTitle}>Price Information</GradientText>
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Current Price</Text>
            <Text style={styles.priceValue}>
              {currentPrice > 0 ? formatCurrency(currentPrice) : 'N/A'}
            </Text>
          </View>
          {priceChange !== 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Change</Text>
              <Text style={[
                styles.priceValue,
                priceChange >= 0 ? styles.positive : styles.negative
              ]}>
                {priceChange >= 0 ? '+' : ''}{formatCurrency(Math.abs(priceChange))} 
                ({formatPercentage(Math.abs(priceChangePercent) / 100)})
              </Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>52-Week Range</Text>
            <Text style={styles.priceValue}>
              {formatCurrency(parseFloat(fundamentals['52_week_low'] || fundamentals['52WeekLow'] || '0'))} - 
              {formatCurrency(parseFloat(fundamentals['52_week_high'] || fundamentals['52WeekHigh'] || '0'))}
            </Text>
          </View>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.section}>
        <GradientText style={styles.sectionTitle}>Key Metrics</GradientText>
        <View style={styles.metricsGrid}>
          <MetricItem 
            label="Market Cap" 
            value={formatMarketCap(fundamentals.market_cap || fundamentals.MarketCapitalization)} 
          />
          <MetricItem 
            label="P/E Ratio" 
            value={fundamentals.pe_ratio || fundamentals.PERatio || 'N/A'} 
          />
          <MetricItem 
            label="EPS" 
            value={fundamentals.eps || fundamentals.EPS ? `$${fundamentals.eps || fundamentals.EPS}` : 'N/A'} 
          />
          <MetricItem 
            label="Dividend Yield" 
            value={fundamentals.dividend_yield ? formatPercentage(fundamentals.dividend_yield) : 'N/A'} 
          />
        </View>
      </View>

      {/* Recent News */}
      {news && news.length > 0 && (
        <View style={styles.section}>
          <GradientText style={styles.sectionTitle}>Recent News</GradientText>
          {news.slice(0, 3).map((item: any, index: number) => (
            <View key={index} style={styles.newsItem}>
              <Text style={styles.newsTitle}>{item.title}</Text>
              <Text style={styles.newsSource}>
                {item.source} • {new Date(item.published_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const MetricItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
};

const formatMarketCap = (value: number | string | undefined): string => {
  if (!value) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return formatCurrency(num);
};

const getStyles = (theme: Theme) => StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: theme.colors.primaryText,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  priceLabel: {
    fontSize: 14,
    color: theme.colors.secondaryText,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
  },
  positive: {
    color: theme.colors.positive,
  },
  negative: {
    color: theme.colors.negative,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '48%',
    marginBottom: 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
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
    marginBottom: 4,
  },
  newsSource: {
    fontSize: 12,
    color: theme.colors.secondaryText,
  },
});

export default OverviewTab;