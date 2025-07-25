import React from 'react';
import { Text, TextProps, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

interface GradientTextProps extends TextProps {
  children: React.ReactNode;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

const GradientText: React.FC<GradientTextProps> = ({
  children,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  style,
  ...props
}) => {
  const { isDark } = useTheme();
  
  // Use grey/white colors in dark mode, purple/blue in light mode
  const defaultColors = isDark 
    ? ['#E5E7EB', '#D1D5DB', '#9CA3AF'] // Light grey -> Medium grey -> Darker grey
    : ['#8A2BE2', '#4B3CFA', '#4FC3F7']; // Electric Purple -> Indigo Blue -> Sky Blue
  
  const textColor = isDark ? '#E5E7EB' : '#4B3CFA';
  const shadowColor = isDark ? '#9CA3AF' : '#8A2BE2';
  
  return (
    <Text 
      style={[
        style, 
        { 
          color: textColor,
          textShadowColor: shadowColor,
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2
        }
      ]} 
      {...props}
    >
      {children}
    </Text>
  );
};

export default GradientText;