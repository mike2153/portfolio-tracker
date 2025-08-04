import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSortPress?: () => void;
  onMenuPress?: () => void;
  editable?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search...",
  value,
  onChangeText,
  onSortPress,
  onMenuPress,
  editable = true,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.secondaryText}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
        />
      </View>
      
      <TouchableOpacity style={styles.iconButton} onPress={onSortPress}>
        <Text style={styles.sortIcon}>↕️</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
        <Text style={styles.menuIcon}>⋯</Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 0,
  },
  searchInput: {
    fontSize: 16,
    color: theme.colors.primaryText,
    padding: 0,
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
  },
  sortIcon: {
    fontSize: 16,
    color: theme.colors.secondaryText,
  },
  menuIcon: {
    fontSize: 20,
    color: theme.colors.secondaryText,
    fontWeight: 'bold',
  },
});

export default SearchBar;