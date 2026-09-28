// src/services/api/IApiAdapter.ts
import type { AuthChallenge, LoginCredentials, AuthResponse, TokenPair, UserProfile } from '../../types/auth';
import type { Membership } from '../../types/membership';
import type { AttendancePage } from '../../types/attendance';
import type {
  ReceiptData,
  ReceiptValidationContext,
  ReceiptValidationResult,
} from '../../types/api';

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

  /** Current standing. Returns null when the user has no membership on record. */
  getMembership(userId: string): Promise<Membership | null>;

  // ── Attendance ───────────────────────────────────────────────────────────────

  getAttendanceHistory(userId: string, page: number): Promise<AttendancePage>;

  // ── Receipt / Payment Validation ─────────────────────────────────────────────

  /**
   * Adjudicate a scanned receipt and, if it passes, redeem it.
   *
   * This is the single authority on whether a receipt grants access. The
   * implementation owns the spent-receipt ledger, the ownership check, the
   * freshness window and the resulting expiry date; callers must treat the
   * returned membership as fact and must not recompute any of it.
   *
   * `context.boundStudentNumber` is null during first-time onboarding, in which
   * case the identity is taken from the receipt. When it is set, a receipt
   * belonging to a different student must be refused.
   *
   * Policy refusals come back as `{ success: false, error }`. Implementations
   * must reject the promise only when no verdict could be reached, and callers
   * must treat that as a refusal rather than a pass.
   */
  validateReceipt(
    receipt: ReceiptData,
    context: ReceiptValidationContext
  ): Promise<ReceiptValidationResult>;
}
