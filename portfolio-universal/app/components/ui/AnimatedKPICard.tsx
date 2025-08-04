import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  Pressable,
} from 'react-native'; // TouchableOpacity removed as unused
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';
import GradientText from '../GradientText';
import GlassCard from './GlassCard';

interface AnimatedKPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  isPositive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'default' | 'glass' | 'minimal';
  size?: 'small' | 'medium' | 'large';
}

export default function AnimatedKPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  isPositive,
  onPress,
  style,
  variant = 'default',
  size = 'medium',
}: AnimatedKPICardProps): React.JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  // Animation values
  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const shadowValue = React.useRef(new Animated.Value(0)).current;
  const highlightValue = React.useRef(new Animated.Value(0)).current;

  // Press animation handlers
  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0.98,
        duration: theme.animations.timing.fast,
        useNativeDriver: true,
      }),
      Animated.timing(shadowValue, {
        toValue: 1,
        duration: theme.animations.timing.fast,
        useNativeDriver: false,
      }),
      Animated.timing(highlightValue, {
        toValue: 1,
        duration: theme.animations.timing.fast,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: theme.animations.timing.fast,
        useNativeDriver: true,
      }),
      Animated.timing(shadowValue, {
        toValue: 0,
        duration: theme.animations.timing.normal,
        useNativeDriver: false,
      }),
      Animated.timing(highlightValue, {
        toValue: 0,
        duration: theme.animations.timing.normal,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Get trend color
  const getTrendColor = () => {
    if (isPositive !== undefined) {
      return isPositive ? theme.colors.positive : theme.colors.negative;
    }
    switch (trend) {
      case 'up':
        return theme.colors.positive;
      case 'down':
        return theme.colors.negative;
      default:
        return theme.colors.neutral;
    }
  };

  // Get size styles
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return styles.sizeSmall;
      case 'large':
        return styles.sizeLarge;
      default:
        return styles.sizeMedium;
    }
  };

  const animatedStyle = {
    transform: [{ scale: scaleValue }],
    shadowOpacity: shadowValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.1, 0.3],
    }),
    shadowRadius: shadowValue.interpolate({
      inputRange: [0, 1],
      outputRange: [4, 12],
    }),
  };

  const highlightStyle = {
    opacity: highlightValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.1],
    }),
  };

  const CardContent = () => (
    <View style={[styles.content, getSizeStyles()]}>
      {/* Header with title and icon */}
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {icon && <Text style={styles.icon}>{icon}</Text>}
      </View>

      {/* Main value */}
      <View style={styles.valueContainer}>
        <GradientText
          variant="hero"
          style={[
            styles.value,
            size === 'large' && styles.valueLarge,
            size === 'small' && styles.valueSmall,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </GradientText>
      </View>

      {/* Subtitle with trend indicator */}
      {subtitle && (
        <View style={styles.subtitleContainer}>
          <Text style={[styles.subtitle, { color: getTrendColor() }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      )}

      {/* Animated highlight overlay */}
      <Animated.View style={[styles.highlight, highlightStyle]} />
    </View>
  );

  if (variant === 'glass') {
    return (
      <Animated.View style={[animatedStyle, style]}>
        <Pressable
          onPressIn={onPress ? handlePressIn : undefined}
          onPressOut={onPress ? handlePressOut : undefined}
          onPress={onPress}
          disabled={!onPress}
        >
          <GlassCard variant="default" style={styles.glassCard}>
            <CardContent />
          </GlassCard>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      <Pressable
        style={[
          styles.card,
          variant === 'minimal' && styles.minimalCard,
        ]}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        onPress={onPress}
        disabled={!onPress}
      >
        <CardContent />
      </Pressable>
    </Animated.View>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.glassShadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  minimalCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  glassCard: {
    margin: 0,
  },
  
  content: {
    position: 'relative',
    overflow: 'hidden',
  },
  
  // Size variants
  sizeMedium: {
    padding: theme.spacing.md,
    minHeight: 100,
  },
  
  sizeSmall: {
    padding: theme.spacing.sm,
    minHeight: 80,
  },
  
  sizeLarge: {
    padding: theme.spacing.lg,
    minHeight: 120,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.secondaryText,
    flex: 1,
  },
  
  icon: {
    fontSize: 16,
    marginLeft: theme.spacing.sm,
  },
  
  valueContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.primaryText,
  },
  
  valueLarge: {
    fontSize: 28,
  },
  
  valueSmall: {
    fontSize: 20,
  },
  
  subtitleContainer: {
    marginTop: theme.spacing.xs,
  },
  
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.glassHighlight,
    borderRadius: theme.borderRadius.md,
  },
});