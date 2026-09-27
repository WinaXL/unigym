// src/theme/colors.ts

export const Colors = {
  light: {
    // Backgrounds
    background: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSubtle: '#F0F0F5',

    // Brand / Primary
    primary: '#2563EB',
    primaryLight: '#DBEAFE',
    primaryDark: '#1E40AF',

    // Accent
    accent: '#10B981',
    accentLight: '#D1FAE5',

    // Status
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Text
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',
    textOnPrimary: '#FFFFFF',

    // Border
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',

    // QR Pass card gradient start/end
    cardGradientStart: '#2563EB',
    cardGradientEnd: '#7C3AED',

    // Tab bar
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#E5E7EB',
    tabBarActive: '#2563EB',
    tabBarInactive: '#9CA3AF',

    // Skeleton shimmer
    skeletonBase: '#E5E7EB',
    skeletonHighlight: '#F9FAFB',

    // Overlay
    overlay: 'rgba(0,0,0,0.4)',
  },
  dark: {
    // Backgrounds
    background: '#09090B',
    surface: '#18181B',
    surfaceElevated: '#27272A',
    surfaceSubtle: '#1C1C1F',

    // Brand / Primary
    primary: '#60A5FA',
    primaryLight: '#1E3A5F',
    primaryDark: '#93C5FD',

    // Accent
    accent: '#34D399',
    accentLight: '#064E3B',

    // Status
    success: '#34D399',
    warning: '#FCD34D',
    error: '#F87171',
    info: '#60A5FA',

    // Text
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
    textInverse: '#111827',
    textOnPrimary: '#FFFFFF',

    // Border
    border: '#3F3F46',
    borderStrong: '#52525B',

    // QR Pass card gradient
    cardGradientStart: '#1D4ED8',
    cardGradientEnd: '#6D28D9',

    // Tab bar
    tabBarBackground: '#18181B',
    tabBarBorder: '#3F3F46',
    tabBarActive: '#60A5FA',
    tabBarInactive: '#6B7280',

    // Skeleton shimmer
    skeletonBase: '#27272A',
    skeletonHighlight: '#3F3F46',

    // Overlay
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = {
  [K in keyof typeof Colors.light]: string;
};
