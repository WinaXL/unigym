// src/stores/themeStore.ts
import { create } from 'zustand';
import { Appearance } from 'react-native';
import type { ColorScheme } from '../theme/colors';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ColorScheme;
  setPreference: (pref: ThemePreference) => void;
  _resolveTheme: () => void;
}

function getSystemTheme(): ColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  resolvedTheme: getSystemTheme(),

  setPreference: (pref) => {
    const resolved = pref === 'system' ? getSystemTheme() : pref;
    set({ preference: pref, resolvedTheme: resolved });
  },

  _resolveTheme: () => {
    const { preference } = get();
    const resolved = preference === 'system' ? getSystemTheme() : preference;
    set({ resolvedTheme: resolved });
  },
}));

// Listen for system theme changes
Appearance.addChangeListener(() => {
  useThemeStore.getState()._resolveTheme();
});
