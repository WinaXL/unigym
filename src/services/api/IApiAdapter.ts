// src/services/api/IApiAdapter.ts
import type { AuthChallenge, LoginCredentials, AuthResponse, TokenPair, UserProfile } from '../../types/auth';
import type { Membership } from '../../types/membership';
import type { AttendancePage } from '../../types/attendance';
import type { ReceiptData, ReceiptValidationResult } from '../../types/api';

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

  getAuthChallenge(): Promise<AuthChallenge>;
  login(credentials: LoginCredentials): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  logout(refreshToken: string): Promise<void>;

  // ── Profile ──────────────────────────────────────────────────────────────────

  getProfile(userId: string): Promise<UserProfile>;

  // ── Membership ───────────────────────────────────────────────────────────────

  getMembership(userId: string): Promise<Membership>;

  // ── Attendance ───────────────────────────────────────────────────────────────

  getAttendanceHistory(userId: string, page: number): Promise<AttendancePage>;

  // ── Receipt / Payment Validation ─────────────────────────────────────────────

  /**
   * Validate a scanned receipt against the user profile.
   * On success, activates/extends the membership.
   */
  validateReceipt(userId: string, receipt: ReceiptData): Promise<ReceiptValidationResult>;
}
