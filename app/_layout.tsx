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
import { useMembershipStore } from '../src/stores/membershipStore';
import { useSessionStore } from '../src/stores/sessionStore';
import { useHistoryStore } from '../src/stores/historyStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useLocaleStore } from '../src/stores/localeStore';
import { storage } from '../src/services/storage';
import { STORAGE_KEYS } from '../src/core/constants';

// SplashScreen.preventAutoHideAsync() is native-only; guard it for web
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, loadProfile } = useAuthStore();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  // Bootstrap: restore session & all stores from local storage
  useEffect(() => {
    async function bootstrap() {
      try {
        // Restore saved preferences (theme, language)
        const [savedTheme, savedLang] = await Promise.all([
          storage.getItem(STORAGE_KEYS.THEME).catch(() => null),
          storage.getItem(STORAGE_KEYS.LANGUAGE).catch(() => null),
        ]);

        if (savedTheme) useThemeStore.getState().setPreference(savedTheme as any);
        if (savedLang) useLocaleStore.getState().setLanguage(savedLang as any);

        // Load all offline stores in parallel
        const profile = await loadProfile();
        await Promise.all([
          useMembershipStore.getState().loadMembership(),
          useSessionStore.getState().loadSession(),
          useHistoryStore.getState().loadHistory(profile?.id || 'user-001'),
        ]);
      } catch {
        // fallback
      } finally {
        if (Platform.OS !== 'web') {
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Route guard: redirect based on auth/onboarding state
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
