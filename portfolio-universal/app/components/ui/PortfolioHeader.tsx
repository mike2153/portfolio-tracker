import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';

interface PortfolioHeaderProps {
  title?: string;
  showDropdown?: boolean;
  onDropdownPress?: () => void;
  onSearchPress?: () => void;
  onStarPress?: () => void;
  onAddPress?: () => void;
}

const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  title = "My portfolio",
  showDropdown = true,
  onDropdownPress,
  onSearchPress,
  onStarPress,
  onAddPress,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        <Text style={styles.briefcaseIcon}>💼</Text>
        <TouchableOpacity 
          style={styles.titleContainer}
          onPress={onDropdownPress}
          disabled={!showDropdown}
        >
          <Text style={styles.title}>{title}</Text>
          {showDropdown && <Text style={styles.dropdownIcon}>▼</Text>}
        </TouchableOpacity>
      </View>
      
      <View style={styles.rightSection}>
        <TouchableOpacity style={styles.iconButton} onPress={onSearchPress}>
          <Text style={styles.icon}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onStarPress}>
          <Text style={styles.icon}>⭐</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onAddPress}>
          <Text style={styles.icon}>➕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (theme: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface, // Fey glass panel
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    shadowColor: theme.colors.glassShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  briefcaseIcon: {
    fontSize: 20,
    marginRight: 8,
    color: theme.colors.secondaryText,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.primaryText,
    marginRight: 4,
  },
  dropdownIcon: {
    fontSize: 12,
    color: theme.colors.secondaryText,
    marginLeft: 4,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderRadius: theme.borderRadius.sm,
  },
  icon: {
    fontSize: 18,
    color: theme.colors.primaryText,
  },
});

export default PortfolioHeader;