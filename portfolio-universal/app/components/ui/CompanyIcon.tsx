import React from 'react';
import { View, Text, StyleSheet } from 'react-native'; // Image removed as unused
import { useTheme } from '../../contexts/ThemeContext';

interface CompanyIconProps {
  symbol: string;
  size?: number;
  fallback?: 'initials' | 'generic';
  style?: any;
}

export default function CompanyIcon({ 
  symbol, 
  size = 40, 
  fallback = 'initials',
  style 
}: CompanyIconProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme, size);
  
  // For now, we'll always use the fallback since we don't have company logos
  // In a real app, you could integrate with a logo API service
  const showFallback = true;

  if (showFallback && fallback === 'initials') {
    // Get first letter of symbol for the icon
    const initial = symbol.charAt(0).toUpperCase();
    
    // Generate a color based on the symbol
    const colors = [
      theme.colors.blueAccent,
      theme.colors.greenAccent,
      '#9333ea', // purple
      '#f59e0b', // amber
      '#06b6d4', // cyan
      '#ec4899', // pink
    ];
    const colorIndex = symbol.charCodeAt(0) % colors.length;
    const backgroundColor = colors[colorIndex];

    return (
      <View style={[styles.container, { backgroundColor }, style]}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
    );
  }

  // Generic fallback icon
  return (
    <View style={[styles.container, styles.genericContainer, style]}>
      <Text style={styles.genericIcon}>📊</Text>
    </View>
  );
}

const getStyles = (theme: any, size: number) => StyleSheet.create({
  container: {
    width: size,
    height: size,
    borderRadius: size / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: '#FFFFFF',
    fontSize: size * 0.4,
    fontWeight: 'bold',
  },
  genericContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  genericIcon: {
    fontSize: size * 0.5,
  },
});