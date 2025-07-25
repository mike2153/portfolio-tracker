// Theme configuration for React Native app
export const darkTheme = {
  colors: {
    // Main backgrounds
    background: '#1a1f2e',  // Softer dark background
    surface: '#242837',     // Card/surface background
    
    // Text colors
    primaryText: '#E5E7EB',    // Grey-white primary text
    secondaryText: '#9CA3AF',  // Muted grey text
    
    // Interactive elements
    buttonBackground: '#4B5563',  // Grey button background
    buttonText: '#F9FAFB',       // Almost white button text
    
    // Borders and dividers
    border: '#374151',
    
    // Accent colors
    greenAccent: '#10b981',      // Success/positive
    redAccent: '#ef4444',        // Error/negative
    blueAccent: '#9CA3AF',       // Links/actions - changed to grey for dark mode
    
    // Status colors
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#6B7280',
  },
} as const;

export const lightTheme = {
  colors: {
    // Main backgrounds
    background: '#F9FAFB',
    surface: '#FFFFFF',
    
    // Text colors
    primaryText: '#1F2937',
    secondaryText: '#6B7280',
    
    // Interactive elements
    buttonBackground: '#1F2937',
    buttonText: '#F9FAFB',
    
    // Borders and dividers
    border: '#E5E7EB',
    
    // Accent colors
    greenAccent: '#059669',
    redAccent: '#dc2626',
    blueAccent: '#2563eb',
    
    // Status colors
    positive: '#059669',
    negative: '#dc2626',
    neutral: '#4B5563',
  },
} as const;

export type Theme = typeof darkTheme | typeof lightTheme;
export type ThemeColors = Theme['colors'];

// Default to dark theme
export const defaultTheme = darkTheme;