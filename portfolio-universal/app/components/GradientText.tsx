import React from 'react';
import { Text, TextProps, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientTextProps extends TextProps {
  children: React.ReactNode;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

const GradientText: React.FC<GradientTextProps> = ({
  children,
  colors = ['#8A2BE2', '#4B3CFA', '#4FC3F7'], // Electric Purple -> Indigo Blue -> Sky Blue
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  style,
  ...props
}) => {
  // For now, we'll use a styled text with the middle color as a fallback
  // since masked-view has installation issues
  return (
    <Text 
      style={[
        style, 
        { 
          color: '#4B3CFA', // Middle gradient color
          textShadowColor: '#8A2BE2',
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