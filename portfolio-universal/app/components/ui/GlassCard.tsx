import React from 'react';
import {
  View,
  ViewStyle,
  StyleSheet,
  Platform,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  blurType?: 'light' | 'dark' | 'xlight' | 'prominent' | 'regular';
  blurAmount?: number;
  variant?: 'default' | 'elevated' | 'subtle';
  bordered?: boolean;
  shadow?: boolean;
}

export default function GlassCard({
  children,
  style,
  blurType = 'dark',
  blurAmount = 20,
  variant = 'default',
  bordered = true,
  shadow = true,
}: GlassCardProps): React.JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  // Determine glass styles based on variant
  const getGlassStyles = () => {
    switch (variant) {
      case 'elevated':
        return styles.glassElevated;
      case 'subtle':
        return styles.glassSubtle;
      default:
        return styles.glassDefault;
    }
  };

  const cardStyle = [
    styles.container,
    getGlassStyles(),
    bordered && styles.bordered,
    shadow && styles.shadow,
    style,
  ];

  // On iOS, use BlurView for native blur effect
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        style={[cardStyle, styles.blurContainer]}
        blurType={blurType}
        blurAmount={blurAmount}
        reducedTransparencyFallbackColor={theme.colors.surface}
      >
        <View style={styles.content}>
          {children}
        </View>
      </BlurView>
    );
  }

  // On Android, use semi-transparent background as fallback
  return (
    <View style={cardStyle}>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  
  blurContainer: {
    backgroundColor: 'transparent',
  },
  
  content: {
    padding: theme.spacing.md,
  },
  
  // Glass morphism variants
  glassDefault: {
    backgroundColor: theme.colors.glassBackground,
    ...Platform.select({
      android: {
        // Fallback for Android without blur
        backgroundColor: theme.colors.glassBackground,
      },
    }),
  },
  
  glassElevated: {
    backgroundColor: `rgba(30, 41, 59, 0.4)`, // More opaque
    ...Platform.select({
      android: {
        backgroundColor: `rgba(30, 41, 59, 0.4)`,
      },
    }),
  },
  
  glassSubtle: {
    backgroundColor: `rgba(30, 41, 59, 0.2)`, // More transparent
    ...Platform.select({
      android: {
        backgroundColor: `rgba(30, 41, 59, 0.2)`,
      },
    }),
  },
  
  // Border and shadow effects
  bordered: {
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.glassShadow,
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});