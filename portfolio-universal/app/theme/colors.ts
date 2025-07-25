// Re-export from the new theme file for backward compatibility
import { defaultTheme } from './theme';

export const darkTheme = defaultTheme;
export type Theme = typeof darkTheme;
export const colors = darkTheme.colors;