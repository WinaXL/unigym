// src/services/tokenService.ts
/**
 * tokenService — credential and preference storage.
 *
 * Tokens go to `secureStorage`, which is the Android Keystore and the iOS
 * Keychain on device. Preferences go to plain storage.
 *
 * This file previously documented hardware-backed storage that it did not
 * actually use: every value went through unencrypted AsyncStorage. The routing
 * below now matches the description.
 *
 * Nothing in the app calls this yet — it exists for the authenticated flows that
 * arrive with the real university API.
 */
import { storage, secureStorage, clearKeys } from './storage';
import { STORAGE_KEYS } from '../core/constants';
import type { TokenPair } from '../types/auth';

export const tokenService = {
  async storeTokens(tokens: TokenPair & { totpSeed?: string }): Promise<void> {
    await Promise.all([
      secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
      secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
      secureStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(tokens.expiresAt)),
      ...(tokens.totpSeed
        ? [secureStorage.setItem(STORAGE_KEYS.TOTP_SEED, tokens.totpSeed)]
        : []),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async getTokenExpiresAt(): Promise<number | null> {
    const val = await secureStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    if (!val) return null;
    const parsed = Number.parseInt(val, 10);
    return Number.isFinite(parsed) ? parsed : null;
  },

  async getTotpSeed(): Promise<string | null> {
    return secureStorage.getItem(STORAGE_KEYS.TOTP_SEED);
  },

  async storeUserId(userId: string): Promise<void> {
    await secureStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  },

  async getUserId(): Promise<string | null> {
    return secureStorage.getItem(STORAGE_KEYS.USER_ID);
  },

  async isAccessTokenValid(): Promise<boolean> {
    const expiresAt = await tokenService.getTokenExpiresAt();
    if (!expiresAt) return false;
    // Treat as expired 60 seconds early to avoid races around the boundary.
    return Date.now() < expiresAt - 60_000;
  },

  /** Clears credentials and preferences. Leaves server-owned state untouched. */
  async clearAll(): Promise<void> {
    await clearKeys(Object.values(STORAGE_KEYS));
  },

  async storePreference(key: string, value: string): Promise<void> {
    await storage.setItem(key, value);
  },

  async getPreference(key: string): Promise<string | null> {
    return storage.getItem(key);
  },
};
