import React from 'react';
import { View, Text, StyleSheet } from 'react-native'; // Image removed as unused

interface CompanyLogoProps {
  symbol: string;
  size?: number;
  style?: any;
}

const CompanyLogo: React.FC<CompanyLogoProps> = ({
  symbol,
  size = 40,
  style,
}) => {
  // For now, we'll use the first letter of the symbol as a fallback
  // In the future, this could be enhanced to load actual company logos
  const firstLetter = symbol.charAt(0).toUpperCase();
  
  // Special styling for certain well-known tickers
  const getIconStyle = (ticker: string) => {
    const upperTicker = ticker.toUpperCase();
    switch (upperTicker) {
      case 'AAPL':
        return { backgroundColor: '#000000' };
      case 'MSFT':
        return { backgroundColor: '#00BCF2' };
      case 'GOOGL':
      case 'GOOG':
        return { backgroundColor: '#4285F4' };
      case 'TSLA':
        return { backgroundColor: '#CC0000' };
      case 'AMZN':
        return { backgroundColor: '#FF9900' };
      case 'NVDA':
        return { backgroundColor: '#76B900' };
      case 'META':
        return { backgroundColor: '#1877F2' };
      default:
        return { backgroundColor: '#333338' }; // Darker default for Fey theme
    }
  };
  
  const iconStyle = getIconStyle(symbol);
  const textColor = iconStyle.backgroundColor === '#333338' ? '#b6b6bd' : '#FFFFFF';
  
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.2, // 20% of size for rounded corners
          ...iconStyle,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: size * 0.4, // 40% of container size
            color: textColor,
          },
        ]}
      >
        {firstLetter}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  text: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default CompanyLogo;