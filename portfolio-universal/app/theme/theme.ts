// Fey-Inspired Dark Theme - Premium dark interface with glass morphism
export const darkTheme = {
  colors: {
    // Core Fey backgrounds
    background: '#111113',        // Primary BG - Very dark charcoal
    surface: '#19191c',           // Surface/Panel - Dark panels
    surfaceElevated: '#222226',   // Card BG Alt - Subtle panel separation
    
    // Glass morphism variants - Fey frosted effects
    glassBackground: 'rgba(16,16,17,0.75)',      // Frost overlay
    glassBorder: 'rgba(34,34,39,0.6)',          // Subtle glass border
    glassHighlight: 'rgba(255, 255, 255, 0.08)', // Subtle glass highlight
    glassShadow: 'rgba(0, 0, 0, 0.4)',          // Deep glass shadow
    
    // Fey text hierarchy
    primaryText: '#e8e8ea',       // Text Main - High contrast
    secondaryText: '#b6b6bd',     // Text Muted - Hints, descriptions
    tertiaryText: '#595964',      // Text Disabled - Inactive text
    
    // Interactive elements with Fey styling
    buttonBackground: '#222227',  // Button/Glow base
    buttonGlow: '#383848',       // Button glow effect
    buttonText: '#e8e8ea',       // Main text on buttons
    buttonSecondary: '#19191c',  // Secondary button style
    
    // Fey borders and dividers
    border: '#24242c',           // Divider color
    borderLight: 'rgba(36,36,44,0.5)', // Semi-transparent dividers
    
    // Fey accent palette
    accentPurple: '#b2a5ff',     // Accent Purple - icons, links
    accentPink: '#c5a7e4',       // Accent Pink - gradient middle
    accentOrange: '#ffba8b',     // Accent Orange - gradient right, highlights
    
    // Legacy accent mapping for compatibility
    greenAccent: '#27e39a',      // Green Up - positive values
    blueAccent: '#b2a5ff',       // Maps to accent purple
    amberAccent: '#ffe475',      // Yellow/Gold - badges, notifications
    
    // Fey status colors
    positive: '#27e39a',         // Green Up - positive/gains
    negative: '#e34c56',         // Red Down - negative/losses
    neutral: '#b6b6bd',          // Muted text for neutral
    warning: '#ffe475',          // Yellow/Gold for warnings
    
    // Fey gradient colors for text effects
    gradientStart: '#b2a5ff',    // Accent Purple (lavender left)
    gradientMid: '#c5a7e4',      // Accent Pink (gradient middle)
    gradientEnd: '#ffba8b',      // Accent Orange (peach right)
  },
  
  // Animation and timing configuration
  animations: {
    timing: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: {
      ease: 'ease-in-out',
      bounce: 'spring',
    },
  },
  
  // Spacing and layout
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Fey border radius values - subtle rounding
  borderRadius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32,
  },
  
  // Typography scale
  typography: {
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 28, fontWeight: '600' },
    h3: { fontSize: 24, fontWeight: '600' },
    h4: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    caption: { fontSize: 14, fontWeight: '400' },
    small: { fontSize: 12, fontWeight: '400' },
  },
} as const;

export const lightTheme = {
  colors: {
    // Main backgrounds
    background: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceElevated: '#F3F4F6',  // Elevated surface for glass morphism
    
    // Glass morphism variants (adapted for light theme)
    glassBackground: 'rgba(255, 255, 255, 0.7)',     // Semi-transparent surface
    glassBorder: 'rgba(229, 231, 235, 0.6)',         // Glass border
    glassHighlight: 'rgba(255, 255, 255, 0.9)',      // Glass highlight
    glassShadow: 'rgba(0, 0, 0, 0.1)',               // Glass shadow
    
    // Text colors - enhanced hierarchy
    primaryText: '#1F2937',       // Dark gray
    secondaryText: '#6B7280',     // Medium gray
    tertiaryText: '#9CA3AF',      // Light gray
    
    // Interactive elements
    buttonBackground: '#10B981',  // Primary emerald
    buttonText: '#FFFFFF',        // Pure white
    buttonSecondary: '#1E3A8A',   // Dark blue accent
    
    // Borders and dividers
    border: '#E5E7EB',
    borderLight: 'rgba(229, 231, 235, 0.5)', // Semi-transparent border
    
    // Accent colors - matching web app palette
    greenAccent: '#10B981',       // Primary emerald
    greenDark: '#059669',         // Darker emerald
    blueAccent: '#1E3A8A',        // Dark blue
    blueLight: '#1D4ED8',         // Lighter blue
    amberAccent: '#F59E0B',       // Warning/amber
    
    // Status colors
    positive: '#059669',          // Darker emerald for light theme
    negative: '#DC2626',          // Red
    neutral: '#4B5563',           // Gray
    
    // Gradient colors for text and effects
    gradientStart: '#8A2BE2',     // Purple (from web app)
    gradientMid: '#4B3CFA',       // Blue
    gradientEnd: '#4FC3F7',       // Light blue
  },
  
  // Animation and timing configuration (same as dark theme)
  animations: {
    timing: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: {
      ease: 'ease-in-out',
      bounce: 'spring',
    },
  },
  
  // Spacing and layout (same as dark theme)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Border radius values (same as dark theme)
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  
  // Typography scale (same as dark theme)
  typography: {
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 28, fontWeight: '600' },
    h3: { fontSize: 24, fontWeight: '600' },
    h4: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    caption: { fontSize: 14, fontWeight: '400' },
    small: { fontSize: 12, fontWeight: '400' },
  },
} as const;

export type Theme = typeof darkTheme | typeof lightTheme;
export type ThemeColors = Theme['colors'];

// Default to dark theme
export const defaultTheme = darkTheme;