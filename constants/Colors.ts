// constants/Colors.ts

/**
 * Color palette for the app
 */
export const Colors = {
  // Primary colors (matching tab bar)
  primary: '#2563eb',        // Blue
  primaryLight: '#3b82f6',
  primaryDark: '#1e40af',
  
  // Neutral colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Alert severity colors
  alert: {
    info: {
      bg: '#dbeafe',        // Light blue
      border: '#3b82f6',
      text: '#1e40af',
      icon: '#2563eb',
    },
    warning: {
      bg: '#fef3c7',        // Light yellow
      border: '#f59e0b',
      text: '#92400e',
      icon: '#f59e0b',
    },
    critical: {
      bg: '#fee2e2',        // Light red
      border: '#ef4444',
      text: '#991b1b',
      icon: '#dc2626',
    },
  },
  
  // Semantic colors
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  
  // Background colors
  background: '#ffffff',
  backgroundSecondary: '#f9fafb',
  
  // Text colors
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
  },
  
  // Border colors
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  
  // Badge/notification colors
  badge: {
    bg: '#dc2626',
    text: '#ffffff',
  },
};

export default Colors;