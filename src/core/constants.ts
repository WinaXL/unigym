// src/core/constants.ts

export const APP_NAME = 'UniGym';
export const APP_VERSION = '1.0.0';

// API adapter mode: 'mock' | 'production'
export const API_MODE = (process.env.EXPO_PUBLIC_API_MODE ?? 'mock') as 'mock' | 'production';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

// Secure storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'unigym_access_token',
  REFRESH_TOKEN: 'unigym_refresh_token',
  TOKEN_EXPIRES_AT: 'unigym_token_expires_at',
  TOTP_SEED: 'unigym_totp_seed',
  USER_ID: 'unigym_user_id',
  BIOMETRIC_ENABLED: 'unigym_biometric_enabled',
  THEME: 'unigym_theme',
  LANGUAGE: 'unigym_language',
} as const;

// QR Token config
export const QR_ROTATION_INTERVAL_MS = 30_000; // 30 seconds
export const QR_WARNING_THRESHOLD_MS = 5_000;  // haptic at 5s remaining

// Pagination
export const PAGE_SIZE = 20;

// Token expiry
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;   // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
