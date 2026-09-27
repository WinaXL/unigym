// src/services/tokenService.ts
/**
 * tokenService — Manages JWT storage via the platform-aware `storage` layer.
 *
 * On native: hardware-backed expo-secure-store (iOS Keychain / Android Keystore).
 * On web:    sessionStorage for tokens (tab-scoped), localStorage for preferences.
 *
 * NEVER stores raw PII. Only short-lived access/refresh tokens + preferences.
 */
import { storage } from './storage';
import { STORAGE_KEYS } from '../core/constants';
import type { TokenPair } from '../types/auth';

export const tokenService = {
  async storeTokens(tokens: TokenPair & { totpSeed?: string }): Promise<void> {
    await Promise.all([
      storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken),
      storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
      storage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(tokens.expiresAt)),
      ...(tokens.totpSeed
        ? [storage.setItem(STORAGE_KEYS.TOTP_SEED, tokens.totpSeed)]
        : []),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return storage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async getTokenExpiresAt(): Promise<number | null> {
    const val = await storage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    return val ? parseInt(val, 10) : null;
  },

  async getTotpSeed(): Promise<string | null> {
    return storage.getItem(STORAGE_KEYS.TOTP_SEED);
  },

  async storeUserId(userId: string): Promise<void> {
    await storage.setItem(STORAGE_KEYS.USER_ID, userId);
  },

  async getUserId(): Promise<string | null> {
    return storage.getItem(STORAGE_KEYS.USER_ID);
  },

  async isAccessTokenValid(): Promise<boolean> {
    const expiresAt = await tokenService.getTokenExpiresAt();
    if (!expiresAt) return false;
    // Treat as expired 60 seconds early to avoid race conditions
    return Date.now() < expiresAt - 60_000;
  },

  async clearAll(): Promise<void> {
    await Promise.all(
      Object.values(STORAGE_KEYS).map((key) => storage.deleteItem(key))
    );
  },

  async storePreference(key: string, value: string): Promise<void> {
    await storage.setItem(key, value);
  },

  async getPreference(key: string): Promise<string | null> {
    return storage.getItem(key);
  },
};
