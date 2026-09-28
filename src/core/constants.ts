// src/core/constants.ts

export const APP_NAME = 'UniGym';
export const APP_VERSION = '1.0.0';

// API adapter mode: 'mock' | 'production'
export const API_MODE = (process.env.EXPO_PUBLIC_API_MODE ?? 'mock') as 'mock' | 'production';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

// Storage keys
export const STORAGE_KEYS = {
  // Offline zero-login keys
  USER_PROFILE: 'unigym_user_profile',
  MEMBERSHIP: 'unigym_membership',
  USED_RECEIPT_IDS: 'unigym_used_receipt_ids',
  ACTIVE_SESSION: 'unigym_active_session',
  ATTENDANCE_HISTORY: 'unigym_attendance_history',

  // Preferences
  THEME: 'unigym_theme',
  LANGUAGE: 'unigym_language',
  BIOMETRIC_ENABLED: 'unigym_biometric_enabled',

  // Legacy auth keys (for API adapters)
  ACCESS_TOKEN: 'unigym_access_token',
  REFRESH_TOKEN: 'unigym_refresh_token',
  TOKEN_EXPIRES_AT: 'unigym_token_expires_at',
  TOTP_SEED: 'unigym_totp_seed',
  USER_ID: 'unigym_user_id',
} as const;

// Pagination
export const PAGE_SIZE = 20;

// Maximum allowed receipt age (days)
export const MAX_RECEIPT_AGE_DAYS = 7;
