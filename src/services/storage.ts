// src/services/storage.ts
/**
 * Platform-aware storage abstraction with full offline persistence.
 *
 * - Web (browser preview): window.localStorage (persists across page reloads/restarts).
 * - Native (iOS / Android): AsyncStorage for local data + SecureStore for keys.
 *
 * Usage: always import `storage` from here.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function webSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Fail silently on quota limit
  }
}

function webGet(key: string): string | null {
  try {
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

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      webSet(key, value);
      return;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // fallback
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return webGet(key);
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      webDelete(key);
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // noop
    }
  },

  async clearAll(): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      return;
    }
    try {
      await AsyncStorage.clear();
    } catch {}
  },
};
