// app/_layout.tsx
import '../src/core/i18n'; // Initialize i18n before everything else

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../src/core/queryClient';
import { ApiProvider } from '../src/services/ApiProvider';
import { useAuthStore } from '../src/stores/authStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useLocaleStore } from '../src/stores/localeStore';
import { tokenService } from '../src/services/tokenService';
import { authService } from '../src/services/authService';
import { useApiAdapter } from '../src/services/ApiProvider';
import { STORAGE_KEYS } from '../src/core/constants';

// SplashScreen.preventAutoHideAsync() is native-only; guard it for web
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, setAuthenticated, clearAuth } = useAuthStore();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const adapter = useApiAdapter();

  // Bootstrap: restore session from secure / web storage
  useEffect(() => {
    async function bootstrap() {
      try {
        // Restore saved preferences (theme, language)
        const [savedTheme, savedLang] = await Promise.all([
          tokenService.getPreference(STORAGE_KEYS.THEME).catch(() => null),
          tokenService.getPreference(STORAGE_KEYS.LANGUAGE).catch(() => null),
        ]);

        if (savedTheme) useThemeStore.getState().setPreference(savedTheme as any);
        if (savedLang) useLocaleStore.getState().setLanguage(savedLang as any);

        // Try silent session restore
        const isValid = await authService.isSessionValid().catch(() => false);
        if (isValid) {
          const userId = await tokenService.getUserId().catch(() => null);
          if (userId) {
            const profile = await adapter.getProfile(userId).catch(() => null);
            profile ? setAuthenticated(profile) : clearAuth();
          } else {
            clearAuth();
          }
        } else {
          // Try silent token refresh using stored refresh token
          const tokens = await authService.silentRefresh(adapter).catch(() => null);
          if (tokens) {
            const userId = await tokenService.getUserId().catch(() => null);
            if (userId) {
              const profile = await adapter.getProfile(userId).catch(() => null);
              profile ? setAuthenticated(profile) : clearAuth();
            } else {
              clearAuth();
            }
          } else {
            clearAuth();
          }
        }
      } catch {
        clearAuth();
      } finally {
        // Hide splash only on native
        if (Platform.OS !== 'web') {
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Route guard: redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/');
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ApiProvider>
            <RootLayoutNav />
          </ApiProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
