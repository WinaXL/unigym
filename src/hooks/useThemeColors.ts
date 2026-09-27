// src/hooks/useThemeColors.ts
import { useThemeStore } from '../stores/themeStore';
import { Colors } from '../theme/colors';
import type { ThemeColors } from '../theme/colors';

export function useThemeColors(): ThemeColors {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  return Colors[resolvedTheme];
}
