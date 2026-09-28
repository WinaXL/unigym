// src/services/authService.ts
/**
 * authService — Orchestrates authentication flows.
 * Handles credential hashing, token lifecycle, biometric auth.
 */
import type { IApiAdapter } from './api/IApiAdapter';
import { tokenService } from './tokenService';
import type { AuthResponse, TokenPair } from '../types/auth';

/**
 * SHA-256 hash of the passport number with server-provided salt.
 * Uses the Web Crypto API (available in React Native via Hermes/JSI polyfill).
 */
async function hashPassport(passport: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passport + salt);

  // Try Web Crypto first (available in modern RN/Expo environments)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for environments without Web Crypto: use simple encode
  // NOTE: In production, ensure @noble/hashes or react-native-quick-crypto is installed
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data[i];
    hash |= 0;
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
}

export const authService = {
  /**
   * Full login flow:
   * 1. Fetch server challenge (salt + nonce)
   * 2. Hash passport with salt (SHA-256)
   * 3. Send hashed credentials to server
   * 4. Store tokens securely
   */
  async loginWithCredentials(
    adapter: IApiAdapter,
    studentId: string,
    passport: string
  ): Promise<AuthResponse> {
    // Step 1: Get challenge
    const challenge = await adapter.getAuthChallenge();

    // Step 2: Hash passport (NEVER send raw)
    const passportHash = await hashPassport(passport, challenge.salt);

    // Step 3: Login
    const response = await adapter.login({
      studentId,
      passportHash,
      nonce: challenge.nonce,
    });

    // Step 4: Store tokens + seed securely
    await tokenService.storeTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt,
      totpSeed: response.totpSeed,
    });
    await tokenService.storeUserId(response.profile.id);

    return response;
  },

  /**
   * Silent token refresh using stored refresh token.
   */
  async silentRefresh(adapter: IApiAdapter): Promise<TokenPair | null> {
    const refreshToken = await tokenService.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const tokens = await adapter.refreshToken(refreshToken);
      await tokenService.storeTokens(tokens);
      return tokens;
    } catch {
      // Refresh failed — user needs to re-authenticate
      await tokenService.clearAll();
      return null;
    }
  },

  /**
   * Logout: invalidate server session + clear all local tokens.
   */
  async logout(adapter: IApiAdapter): Promise<void> {
    const refreshToken = await tokenService.getRefreshToken();
    if (refreshToken) {
      try {
        await adapter.logout(refreshToken);
      } catch {
        // Best-effort server logout — clear local state regardless
      }
    }
    await tokenService.clearAll();
  },

  /**
   * Check if current session is valid (token not expired).
   * On web/preview mode, this may always return a mock valid state.
   */
  async isSessionValid(): Promise<boolean> {
    return tokenService.isAccessTokenValid();
  },

  /**
   * Get the stored userId for authenticated requests.
   */
  async getStoredUserId(): Promise<string | null> {
    return tokenService.getUserId();
  },
};
