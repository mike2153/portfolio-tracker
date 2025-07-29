import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';
import { formatCurrency, formatPercentage } from '@portfolio-tracker/shared';
import GradientText from '../GradientText';

interface MetricsTabProps {
  data: any;
}

const MetricsTab: React.FC<MetricsTabProps> = ({ data }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  if (!data) return null;

  const fundamentals = data.fundamentals || data;

  const metricsGroups = [
    {
      title: 'Valuation Metrics',
      metrics: [
        { label: 'P/E Ratio', value: fundamentals.pe_ratio || fundamentals.PERatio },
        { label: 'Forward P/E', value: fundamentals.ForwardPE },
        { label: 'PEG Ratio', value: fundamentals.peg_ratio || fundamentals.PEGRatio },
        { label: 'Price to Book', value: fundamentals.price_to_book || fundamentals.PriceToBookRatio },
        { label: 'Price to Sales', value: fundamentals.price_to_sales || fundamentals.PriceToSalesRatioTTM },
        { label: 'EV/EBITDA', value: fundamentals.enterprise_to_ebitda || fundamentals.EVToEBITDA },
      ]
    },
    {
      title: 'Profitability Metrics',
      metrics: [
        { label: 'Profit Margin', value: fundamentals.profit_margin || fundamentals.ProfitMargin, format: 'percent' },
        { label: 'Operating Margin', value: fundamentals.operating_margin || fundamentals.OperatingMarginTTM, format: 'percent' },
        { label: 'ROA', value: fundamentals.return_on_assets || fundamentals.ReturnOnAssetsTTM, format: 'percent' },
        { label: 'ROE', value: fundamentals.return_on_equity || fundamentals.ReturnOnEquityTTM, format: 'percent' },
        { label: 'Revenue per Share', value: fundamentals.revenue_per_share || fundamentals.RevenuePerShareTTM, format: 'currency' },
        { label: 'EPS', value: fundamentals.eps || fundamentals.EPS, format: 'currency' },
      ]
    },
    {
      title: 'Growth Metrics',
      metrics: [
        { label: 'Quarterly Revenue Growth', value: fundamentals.quarterly_revenue_growth || fundamentals.QuarterlyRevenueGrowthYOY, format: 'percent' },
        { label: 'Quarterly Earnings Growth', value: fundamentals.quarterly_earnings_growth || fundamentals.QuarterlyEarningsGrowthYOY, format: 'percent' },
        { label: 'Dividend Growth Rate', value: fundamentals.DividendGrowthRate, format: 'percent' },
      ]
    },
    {
      title: 'Dividend Information',
      metrics: [
        { label: 'Dividend per Share', value: fundamentals.dividend_per_share || fundamentals.DividendPerShare, format: 'currency' },
        { label: 'Dividend Yield', value: fundamentals.dividend_yield || fundamentals.DividendYield, format: 'percent' },
        { label: 'Ex-Dividend Date', value: fundamentals.ex_dividend_date || fundamentals.ExDividendDate },
        { label: 'Dividend Date', value: fundamentals.dividend_date || fundamentals.DividendDate },
      ]
    },
    {
      title: 'Market Data',
      metrics: [
        { label: 'Market Cap', value: fundamentals.market_cap || fundamentals.MarketCapitalization, format: 'marketcap' },
        { label: 'Enterprise Value', value: fundamentals.enterprise_value || fundamentals.EnterpriseValue, format: 'marketcap' },
        { label: 'Beta', value: fundamentals.beta || fundamentals.Beta },
        { label: 'Shares Outstanding', value: fundamentals.shares_outstanding || fundamentals.SharesOutstanding, format: 'shares' },
        { label: 'Shares Float', value: fundamentals.shares_float || fundamentals.SharesFloat, format: 'shares' },
      ]
    },
    {
      title: 'Trading Information',
      metrics: [
        { label: '50-Day MA', value: fundamentals['50_day_ma'] || fundamentals['50DayMovingAverage'], format: 'currency' },
        { label: '200-Day MA', value: fundamentals['200_day_ma'] || fundamentals['200DayMovingAverage'], format: 'currency' },
        { label: '52-Week Low', value: fundamentals['52_week_low'] || fundamentals['52WeekLow'], format: 'currency' },
        { label: '52-Week High', value: fundamentals['52_week_high'] || fundamentals['52WeekHigh'], format: 'currency' },
        { label: 'Analyst Target Price', value: fundamentals.AnalystTargetPrice, format: 'currency' },
      ]
    }
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {metricsGroups.map((group, index) => (
        <View key={index} style={styles.section}>
          <GradientText style={styles.sectionTitle}>{group.title}</GradientText>
          <View style={styles.metricsGrid}>
            {group.metrics.map((metric, idx) => (
              <MetricCard
                key={idx}
                label={metric.label}
                value={metric.value}
                format={metric.format}
                theme={theme}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const MetricCard: React.FC<{ 
  label: string; 
  value: any; 
  format?: string;
  theme: Theme;
}> = ({ label, value, format, theme }) => {
  const styles = getStyles(theme);
  
  const formatValue = (val: any, fmt?: string): string => {
    if (val === null || val === undefined || val === '') return 'N/A';
    
    switch (fmt) {
      case 'currency':
        return formatCurrency(parseFloat(val));
      case 'percent':
        return formatPercentage(parseFloat(val));
      case 'marketcap':
        const num = parseFloat(val);
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        return formatCurrency(num);
      case 'shares':
        const shares = parseFloat(val);
        if (shares >= 1e9) return `${(shares / 1e9).toFixed(2)}B`;
        if (shares >= 1e6) return `${(shares / 1e6).toFixed(2)}M`;
        return shares.toLocaleString();
      default:
        return typeof val === 'number' ? val.toFixed(2) : val.toString();
    }
  };
  
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{formatValue(value, format)}</Text>
    </View>
  );
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '48%',
    marginBottom: 12,
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginBottom: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryText,
    textAlign: 'center',
  },
});

export default MetricsTab;