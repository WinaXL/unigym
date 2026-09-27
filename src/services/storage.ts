// src/services/storage.ts
/**
 * Platform-aware secure storage abstraction.
 *
 * - Native (iOS / Android): expo-secure-store → hardware-backed AES-256
 *   (iOS Keychain, Android Keystore). Zero-trust, no plain-text on disk.
 *
 * - Web (browser preview / Expo Web): sessionStorage for tokens
 *   (clears on tab close) + localStorage for persistent preferences.
 *   NOTE: Web storage is NOT hardware-backed. The web target is for
 *   development preview ONLY. Production deployments must use native builds.
 *
 * Usage: always import `storage` from here — never import expo-secure-store
 * directly in application code.
 */
import { Platform } from 'react-native';

// Keys that should persist across sessions (preferences, not credentials)
const PERSISTENT_KEYS = new Set([
  'unigym_theme',
  'unigym_language',
  'unigym_biometric_enabled',
]);

/** Tokens are session-scoped on web (cleared when tab closes). */
function webSet(key: string, value: string): void {
  try {
    if (PERSISTENT_KEYS.has(key)) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // Storage quota exceeded or private-browsing restriction — fail silently
  }
}

function webGet(key: string): string | null {
  try {
    // Check both storages; persistent keys live in localStorage
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function webDelete(key: string): void {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    // noop
  }
}

// Lazy-import expo-secure-store only on native to avoid loading it on web
// (the web bundle of expo-secure-store triggers the file:// security error).
let _SecureStore: typeof import('expo-secure-store') | null = null;

async function getSecureStore() {
  if (!_SecureStore) {
    _SecureStore = await import('expo-secure-store');
  }
  return _SecureStore;
}

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      webSet(key, value);
      return;
    }
    const SecureStore = await getSecureStore();
    await SecureStore.setItemAsync(key, value);
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return webGet(key);
    }
    const SecureStore = await getSecureStore();
    return SecureStore.getItemAsync(key);
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      webDelete(key);
      return;
    }
    const SecureStore = await getSecureStore();
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};
