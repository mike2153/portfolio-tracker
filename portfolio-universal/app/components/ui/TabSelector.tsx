import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../theme/theme';

interface Tab {
  key: string;
  label: string;
  icon?: string; // Optional icon for tabs
}

interface TabSelectorProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  variant?: 'default' | 'glass' | 'minimal';
}

const TabSelector: React.FC<TabSelectorProps> = ({ 
  tabs, 
  activeTab, 
  onTabChange,
  variant = 'default' 
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  
  // Animation values for each tab
  const animatedValues = React.useRef(
    tabs.reduce((acc, tab) => {
      acc[tab.key] = new Animated.Value(activeTab === tab.key ? 1 : 0);
      return acc;
    }, {} as { [key: string]: Animated.Value })
  ).current;

  // Animate tab changes
  React.useEffect(() => {
    tabs.forEach((tab) => {
      const isActive = activeTab === tab.key;
      Animated.timing(animatedValues[tab.key], {
        toValue: isActive ? 1 : 0,
        duration: theme.animations.timing.normal,
        useNativeDriver: false,
      }).start();
    });
  }, [activeTab, animatedValues, tabs, theme.animations.timing.normal]);

  const handleTabPress = (tabKey: string) => {
    // Add subtle haptic feedback
    onTabChange(tabKey);
  };

  const getContainerStyles = () => {
    switch (variant) {
      case 'glass':
        return [styles.container, styles.glassContainer];
      case 'minimal':
        return [styles.container, styles.minimalContainer];
      default:
        return styles.container;
    }
  };

  return (
    <View style={getContainerStyles()}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const animatedValue = animatedValues[tab.key];
          const isActive = activeTab === tab.key;
          
          return (
            <Animated.View key={tab.key}>
              <TouchableOpacity
                style={styles.tab}
                onPress={() => handleTabPress(tab.key)}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.tabBackground,
                    {
                      opacity: animatedValue,
                      transform: [
                        {
                          scale: animatedValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <Animated.Text
                  style={[
                    styles.tabText,
                    {
                      color: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [theme.colors.secondaryText, theme.colors.primaryText],
                      }),
                    },
                  ]}
                >
                  {tab.label}
                </Animated.Text>
                {/* Active indicator line */}
                <Animated.View
                  style={[
                    styles.activeIndicator,
                    {
                      opacity: animatedValue,
                      transform: [
                        {
                          scaleX: animatedValue,
                        },
                      ],
                    },
                  ]}
                />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  glassContainer: {
    backgroundColor: theme.colors.glassBackground,
    borderColor: theme.colors.glassBorder,
  },
  
  minimalContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  
  tab: {
    position: 'relative',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  tabBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.greenAccent,
    borderRadius: theme.borderRadius.sm,
    opacity: 0,
  },
  
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    zIndex: 1,
  },
  
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: theme.colors.greenAccent,
    borderRadius: 1,
  },
});

export default TabSelector;