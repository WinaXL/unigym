// src/services/storage.ts
/**
 * Platform-aware storage, split into two areas with different guarantees.
 *
 * `storage` — AsyncStorage on native, localStorage on web. Unencrypted. Use it
 *   for preferences and non-sensitive local data only.
 *
 * `secureStorage` — expo-secure-store on native, which means the Android
 *   Keystore and the iOS Keychain. Use it for personal data (name, student
 *   number) and credentials.
 *
 * Both areas propagate write failures. Callers must not commit in-memory state
 * until the corresponding write has resolved, otherwise the UI can show data
 * that silently vanishes on the next launch.
 *
 * Web caveat: SecureStore has no web implementation, so on web `secureStorage`
 * degrades to localStorage and offers no protection at all. The web target is
 * development-preview only — see the __DEV__ guards in ReceiptScannerFlow.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

/**
 * SecureStore keys may only contain alphanumerics, '.', '-' and '_'. Our keys
 * already comply; this asserts it rather than letting a future key fail at
 * runtime on device only.
 */
const SECURE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

function assertSecureKey(key: string): void {
  if (!SECURE_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid secure storage key: ${key}`);
  }
}

function webSet(key: string, value: string): void {
  // Throws on quota exhaustion, which is what we want the caller to see.
  localStorage.setItem(key, value);
}

function webGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webDelete(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Deleting a key that cannot be reached is not an error worth surfacing.
  }
}

export interface KeyValueArea {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  deleteItem(key: string): Promise<void>;
}

/** Unencrypted local storage. Never put personal data or credentials here. */
export const storage: KeyValueArea = {
  async setItem(key, value) {
    if (isWeb) {
      webSet(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  async getItem(key) {
    if (isWeb) return webGet(key);
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async deleteItem(key) {
    if (isWeb) {
      webDelete(key);
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Same rationale as webDelete.
    }
  },
};

/** Hardware-backed storage on native. Use for PII and credentials. */
export const secureStorage: KeyValueArea = {
  async setItem(key, value) {
    assertSecureKey(key);
    if (isWeb) {
      webSet(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async getItem(key) {
    assertSecureKey(key);
    if (isWeb) return webGet(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // A rejected read means the entry is unreadable (for example the key was
      // invalidated). Treat it as absent; callers fail closed from there.
      return null;
    }
  },

  async deleteItem(key) {
    assertSecureKey(key);
    if (isWeb) {
      webDelete(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Same rationale as webDelete.
    }
  },
};

/**
 * Remove the given keys across both areas.
 *
 * Callers pass an explicit key list rather than wiping storage wholesale, so
 * that server-owned state (the spent-receipt ledger) survives a client reset.
 */
export async function clearKeys(keys: readonly string[]): Promise<void> {
  await Promise.all(
    keys.flatMap((key) => [
      storage.deleteItem(key),
      secureStorage.deleteItem(key).catch(() => {}),
    ])
  );
}
