import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '@portfolio-tracker/shared';
import GradientText from '../GradientText';

interface FinancialsTabProps {
  data: any;
}

const FinancialsTab: React.FC<FinancialsTabProps> = ({ data }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  if (!data) return null;

  const fundamentals = data.fundamentals || data;

  // Extract financial data
  const financialData = [
    {
      title: 'Revenue & Profitability',
      items: [
        { 
          label: 'Revenue (TTM)', 
          value: fundamentals.revenue_ttm || fundamentals.RevenueTTM,
          format: 'currency'
        },
        { 
          label: 'Gross Profit (TTM)', 
          value: fundamentals.GrossProfitTTM,
          format: 'currency'
        },
        { 
          label: 'EBITDA', 
          value: fundamentals.EBITDA,
          format: 'currency'
        },
        { 
          label: 'Net Income', 
          value: fundamentals.NetIncomeTTM,
          format: 'currency'
        },
      ]
    },
    {
      title: 'Per Share Data',
      items: [
        { 
          label: 'Revenue per Share', 
          value: fundamentals.revenue_per_share || fundamentals.RevenuePerShareTTM,
          format: 'currency'
        },
        { 
          label: 'EPS (Diluted)', 
          value: fundamentals.eps_diluted || fundamentals.DilutedEPSTTM,
          format: 'currency'
        },
        { 
          label: 'Book Value per Share', 
          value: fundamentals.book_value || fundamentals.BookValue,
          format: 'currency'
        },
        { 
          label: 'Dividend per Share', 
          value: fundamentals.dividend_per_share || fundamentals.DividendPerShare,
          format: 'currency'
        },
      ]
    },
    {
      title: 'Financial Ratios',
      items: [
        { 
          label: 'Current Ratio', 
          value: fundamentals.CurrentRatio,
          format: 'ratio'
        },
        { 
          label: 'Quick Ratio', 
          value: fundamentals.QuickRatio,
          format: 'ratio'
        },
        { 
          label: 'Debt to Equity', 
          value: fundamentals.DebtToEquity,
          format: 'ratio'
        },
        { 
          label: 'Interest Coverage', 
          value: fundamentals.InterestCoverage,
          format: 'ratio'
        },
      ]
    },
    {
      title: 'Company Information',
      items: [
        { 
          label: 'Fiscal Year End', 
          value: fundamentals.fiscal_year_end || fundamentals.FiscalYearEnd,
          format: 'text'
        },
        { 
          label: 'Latest Quarter', 
          value: fundamentals.latest_quarter || fundamentals.LatestQuarter,
          format: 'text'
        },
        { 
          label: 'Country', 
          value: fundamentals.country || fundamentals.Country,
          format: 'text'
        },
        { 
          label: 'Currency', 
          value: fundamentals.currency || fundamentals.Currency,
          format: 'text'
        },
      ]
    }
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {financialData.map((section, index) => (
        <View key={index} style={styles.section}>
          <GradientText style={styles.sectionTitle}>{section.title}</GradientText>
          <View style={styles.card}>
            {section.items.map((item, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.row,
                  idx === section.items.length - 1 && styles.lastRow
                ]}
              >
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value}>
                  {formatFinancialValue(item.value, item.format)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Analyst Ratings if available */}
      {hasAnalystRatings(fundamentals) && (
        <View style={styles.section}>
          <GradientText style={styles.sectionTitle}>Analyst Ratings</GradientText>
          <View style={styles.card}>
            <View style={styles.ratingsGrid}>
              <RatingItem 
                label="Strong Buy" 
                value={fundamentals.AnalystRatingStrongBuy} 
                theme={theme}
              />
              <RatingItem 
                label="Buy" 
                value={fundamentals.AnalystRatingBuy} 
                theme={theme}
              />
              <RatingItem 
                label="Hold" 
                value={fundamentals.AnalystRatingHold} 
                theme={theme}
              />
              <RatingItem 
                label="Sell" 
                value={fundamentals.AnalystRatingSell} 
                theme={theme}
              />
              <RatingItem 
                label="Strong Sell" 
                value={fundamentals.AnalystRatingStrongSell} 
                theme={theme}
              />
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const RatingItem: React.FC<{ label: string; value: any; theme: Theme }> = ({ label, value, theme }) => {
  const styles = getStyles(theme);
  
  return (
    <View style={styles.ratingItem}>
      <Text style={styles.ratingValue}>{value || '0'}</Text>
      <Text style={styles.ratingLabel}>{label}</Text>
    </View>
  );
};

const formatFinancialValue = (value: any, format: string): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  
  switch (format) {
    case 'currency':
      const num = parseFloat(value);
      if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
      if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
      if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
      return formatCurrency(num);
    case 'ratio':
      return parseFloat(value).toFixed(2);
    case 'text':
      return value.toString();
    default:
      return value.toString();
  }
};

const hasAnalystRatings = (data: any): boolean => {
  return data.AnalystRatingStrongBuy || 
         data.AnalystRatingBuy || 
         data.AnalystRatingHold || 
         data.AnalystRatingSell || 
         data.AnalystRatingStrongSell;
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 14,
    color: theme.colors.secondaryText,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primaryText,
    textAlign: 'right',
  },
  ratingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  ratingItem: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primaryText,
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 11,
    color: theme.colors.secondaryText,
    textAlign: 'center',
  },
});

export default FinancialsTab;