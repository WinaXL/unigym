// app/_layout.tsx
import '../src/core/i18n'; // Initialize i18n before everything else

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '../src/core/queryClient';
import { ApiProvider, useApiAdapter } from '../src/services/ApiProvider';
import { AppErrorBoundary } from '../src/components/ui/AppErrorBoundary';
import { BiometricGate } from '../src/components/security/BiometricGate';
import { useAuthStore } from '../src/stores/authStore';
import { useMembershipStore } from '../src/stores/membershipStore';
import { useSessionStore } from '../src/stores/sessionStore';
import { useHistoryStore } from '../src/stores/historyStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useLocaleStore } from '../src/stores/localeStore';
import { useSecurityStore } from '../src/stores/securityStore';
import { membershipService } from '../src/services/membershipService';
import { storage } from '../src/services/storage';
import { STORAGE_KEYS } from '../src/core/constants';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/core/i18n';

// SplashScreen.preventAutoHideAsync() is native-only; guard it for web
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;

function isThemePreference(value: string): value is (typeof THEME_PREFERENCES)[number] {
  return (THEME_PREFERENCES as readonly string[]).includes(value);
}

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const adapter = useApiAdapter();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  const [bootstrapped, setBootstrapped] = useState(false);

  // Bootstrap: restore preferences, the bound identity, and local caches.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [savedTheme, savedLang] = await Promise.all([
          storage.getItem(STORAGE_KEYS.THEME).catch(() => null),
          storage.getItem(STORAGE_KEYS.LANGUAGE).catch(() => null),
        ]);

        // Stored preferences are validated rather than cast, so an edited value
        // cannot push an unknown theme or locale into the stores.
        if (savedTheme && isThemePreference(savedTheme)) {
          useThemeStore.getState().setPreference(savedTheme);
        }
        if (savedLang && isSupportedLanguage(savedLang)) {
          useLocaleStore.getState().setLanguage(savedLang);
        }

        // The app lock must be resolved before any screen renders.
        await useSecurityStore.getState().initialize();

        const profile = await useAuthStore.getState().loadProfile();

        await Promise.all([
          useMembershipStore.getState().loadMembership(),
          useSessionStore.getState().loadSession(),
          useHistoryStore.getState().loadHistory(profile?.id ?? null),
        ]);

        // Ask the adapter for current standing so expiry is decided server-side
        // rather than recomputed from the device clock on every launch. The
        // cached value stays in place if this cannot be reached.
        if (profile) {
          await membershipService.refreshMembership(adapter, profile.id);
        }
      } finally {
        if (!cancelled) setBootstrapped(true);
        if (Platform.OS !== 'web') {
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  // Route guard: hold navigation until hydration finishes, so a redirect is
  // never issued from a half-restored auth state.
  useEffect(() => {
    if (!bootstrapped || isAuthLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/');
    }
  }, [isAuthenticated, isAuthLoading, bootstrapped, segments, router]);

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
        <AppErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ApiProvider>
              <BiometricGate>
                <RootLayoutNav />
              </BiometricGate>
            </ApiProvider>
          </QueryClientProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
