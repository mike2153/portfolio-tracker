// Dark theme configuration
export const darkTheme = {
  colors: {
    background: '#0D1117',
    primaryText: '#FFFFFF',
    secondaryText: '#8B949E',
    buttonBackground: '#FFFFFF',
    buttonText: '#0D1117',
    greenAccent: '#238636',
    border: '#30363D',
  },
} as const;

export type Theme = typeof darkTheme;