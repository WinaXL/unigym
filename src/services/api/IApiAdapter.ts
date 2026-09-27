// src/services/api/IApiAdapter.ts
import type { AuthChallenge, LoginCredentials, AuthResponse, TokenPair, UserProfile } from '../../types/auth';
import type { Membership } from '../../types/membership';
import type { AttendancePage } from '../../types/attendance';
import type { QrTokenPayload, ValidationResult } from '../../types/api';

/**
 * IApiAdapter — The single swap point for backend integrations.
 *
 * Implement this interface to connect any backend:
 * - MockApiAdapter (development / demo)
 * - UniversityApiAdapter (production: LDAP/REST/OAuth2)
 *
 * Rules:
 * - All methods MUST reject with an { code, message } ApiError object on failure.
 * - Never put raw PII in method arguments — use hashed values only.
 */
export interface IApiAdapter {
  // ── Authentication ──────────────────────────────────────────────────────────

  /**
   * Fetch a one-time authentication challenge (salt + nonce).
   * The client hashes the passport with the salt before calling login().
   */
  getAuthChallenge(): Promise<AuthChallenge>;

  /**
   * Authenticate the student. Credentials contain hashed (never raw) passport.
   */
  login(credentials: LoginCredentials): Promise<AuthResponse>;

  /**
   * Exchange a valid refresh token for a new token pair.
   */
  refreshToken(refreshToken: string): Promise<TokenPair>;

  /**
   * Invalidate the refresh token on the server (logout).
   */
  logout(refreshToken: string): Promise<void>;

  // ── Profile ──────────────────────────────────────────────────────────────────

  getProfile(userId: string): Promise<UserProfile>;

  // ── Membership ───────────────────────────────────────────────────────────────

  getMembership(userId: string): Promise<Membership>;

  // ── Attendance ───────────────────────────────────────────────────────────────

  getAttendanceHistory(userId: string, page: number): Promise<AttendancePage>;

  // ── QR / Turnstile ───────────────────────────────────────────────────────────

  /**
   * Generate a new short-lived QR token for turnstile entry.
   * Returns a TOTP-derived compact JWT.
   */
  generateQrToken(userId: string): Promise<QrTokenPayload>;

  /**
   * (Used by the scanner / server) Validate a QR token.
   */
  validateQrToken(token: string): Promise<ValidationResult>;
}
