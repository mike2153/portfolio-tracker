import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native'; // View removed as unused
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../theme/theme';

interface GradientTextProps extends TextProps {
  children: React.ReactNode;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  variant?: 'primary' | 'secondary' | 'hero' | 'accent';
  animated?: boolean;
}

const GradientText: React.FC<GradientTextProps> = ({
  children,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  variant = 'primary',
  animated = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  // Get gradient colors based on variant and theme
  const getGradientColors = (): string[] => {
    if (colors) return colors;
    
    switch (variant) {
      case 'hero':
        return [
          theme.colors.gradientStart,  // Lavender #b2a5ff
          theme.colors.gradientMid,    // Pink #c5a7e4  
          theme.colors.gradientEnd,    // Peach #ffba8b
        ];
      case 'secondary':
        return [
          theme.colors.accentPurple,   // Fey purple
          theme.colors.accentOrange,   // Fey orange
        ];
      case 'accent':
        return [
          theme.colors.accentPink,     // Fey pink
          theme.colors.accentOrange,   // Fey orange
        ];
      default: // primary
        return [
          theme.colors.primaryText,    // White/Dark
          theme.colors.secondaryText,  // Gray
        ];
    }
  };

  const gradientColors = getGradientColors();
  
  // For simple single-color variants, use regular Text
  if (variant === 'primary' && !colors) {
    return (
      <Text 
        style={[
          styles.baseText,
          { color: theme.colors.primaryText },
          style
        ]} 
        {...props}
      >
        {children}
      </Text>
    );
  }

  // For gradient variants, use MaskedView with LinearGradient
  return (
    <MaskedView
      style={[styles.container, style]}
      maskElement={
        <Text 
          style={[
            styles.baseText,
            styles.maskText,
            style
          ]} 
          {...props}
        >
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        start={start}
        end={end}
        style={styles.gradient}
      >
        <Text 
          style={[
            styles.baseText,
            styles.gradientText,
            style
          ]} 
          {...props}
        >
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
};

const getStyles = (_theme: Theme) => StyleSheet.create({ // theme parameter unused
  container: {
    // Container for MaskedView
  },
  
  baseText: {
    // Base text styling - will be inherited by style prop
  },
  
  maskText: {
    // Text used as mask - should be opaque
    backgroundColor: 'transparent',
    color: 'black', // This color doesn't matter, it's just a mask
  },
  
  gradient: {
    flex: 1,
    justifyContent: 'center',
  },
  
  gradientText: {
    // Text inside the gradient - should be transparent so gradient shows through
    opacity: 0,
  },
});

export default GradientText;