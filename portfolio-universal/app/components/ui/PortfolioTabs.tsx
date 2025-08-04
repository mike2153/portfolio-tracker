import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'; // View removed as unused
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';

interface PortfolioTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs?: Array<{ key: string; label: string }>;
}

const PortfolioTabs: React.FC<PortfolioTabsProps> = ({
  activeTab,
  onTabChange,
  tabs = [
    { key: 'holdings', label: 'Holdings' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'corporate-actions', label: 'Corporate actions' },
  ],
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && styles.activeTab,
          ]}
          onPress={() => onTabChange(tab.key)}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === tab.key && styles.activeTabText,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    height: 'auto',
    maxHeight: 60,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: theme.colors.accentPurple, // Fey purple
    shadowColor: theme.colors.accentPurple,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.secondaryText,
    textAlign: 'center',
  },
  activeTabText: {
    color: theme.colors.primaryText,
    fontWeight: '600',
  },
});

export default PortfolioTabs;