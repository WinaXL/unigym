// src/core/constants.ts

export const APP_NAME = 'UniGym';
export const APP_VERSION = '1.0.0';

// API adapter mode: 'mock' | 'production'
export const API_MODE = (process.env.EXPO_PUBLIC_API_MODE ?? 'mock') as 'mock' | 'production';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/**
 * Client-owned storage keys.
 *
 * Everything here is a local cache or a user preference. It may be cleared by
 * the user at any time (see "Reset Device Profile") without granting any
 * entitlement, because none of it is authoritative.
 */
export const STORAGE_KEYS = {
  // Bound identity + cached membership verdict (stored via secureStorage)
  USER_PROFILE: 'unigym_user_profile',
  MEMBERSHIP: 'unigym_membership',

  // Local attendance tracking (stored via plain storage)
  ACTIVE_SESSION: 'unigym_active_session',
  ATTENDANCE_HISTORY: 'unigym_attendance_history',

  // Preferences
  THEME: 'unigym_theme',
  LANGUAGE: 'unigym_language',
  BIOMETRIC_ENABLED: 'unigym_biometric_enabled',

  // Auth tokens, used once a real backend is wired up (stored via secureStorage)
  ACCESS_TOKEN: 'unigym_access_token',
  REFRESH_TOKEN: 'unigym_refresh_token',
  TOKEN_EXPIRES_AT: 'unigym_token_expires_at',
  TOTP_SEED: 'unigym_totp_seed',
  USER_ID: 'unigym_user_id',
} as const;

/**
 * Keys owned exclusively by the simulated backend (MockApiAdapter).
 *
 * These stand in for server-side database rows and hold the spent-receipt
 * ledger plus the authoritative membership record. Client code must never read
 * or write them directly, and `clearClientState()` deliberately leaves them
 * alone: resetting your device profile must not hand back already-redeemed
 * receipts.
 *
 * They disappear entirely once UniversityApiAdapter replaces the mock.
 */
export const SERVER_STATE_KEYS = {
  RECEIPT_LEDGER: 'unigym_srv_receipt_ledger',
  MEMBERSHIP_RECORD: 'unigym_srv_membership_record',
} as const;

/** Keys that hold personal data or credentials and belong in secure storage. */
export const SENSITIVE_KEYS: readonly string[] = [
  STORAGE_KEYS.USER_PROFILE,
  STORAGE_KEYS.MEMBERSHIP,
  STORAGE_KEYS.ACCESS_TOKEN,
  STORAGE_KEYS.REFRESH_TOKEN,
  STORAGE_KEYS.TOKEN_EXPIRES_AT,
  STORAGE_KEYS.TOTP_SEED,
  STORAGE_KEYS.USER_ID,
];

// Pagination
export const PAGE_SIZE = 20;

/** Maximum allowed receipt age, in whole days, enforced server-side. */
export const MAX_RECEIPT_AGE_DAYS = 7;

/** Days of access granted per redeemed receipt. */
export const MEMBERSHIP_DAYS_PER_RECEIPT = 30;

/**
 * Cap on the spent-receipt ledger. Old entries roll off so the ledger cannot
 * grow without bound; the window is far longer than MAX_RECEIPT_AGE_DAYS, so a
 * rolled-off entry can never be replayed (its payment date is long expired).
 */
export const RECEIPT_LEDGER_MAX_ENTRIES = 500;
