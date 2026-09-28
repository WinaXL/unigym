// src/types/api.ts
import type { Membership } from './membership';

export interface ReceiptData {
  studentName?: string;
  studentNumber?: string;
  paymentDate?: string;   // YYYY-MM-DD
  referenceId?: string;
  amount?: string;
  planType?: string;
}

/**
 * Why a receipt was refused. Every value is decided by the adapter (the
 * server), never by the UI — the client only maps these onto a message.
 */
export type ReceiptRejectionCode =
  // Field-level problems with the receipt itself
  | 'NO_NAME'
  | 'NO_STUDENT_NUMBER'
  | 'NO_DATE'
  | 'INVALID_DATE'
  | 'INVALID_REFERENCE'
  // Policy violations
  | 'ALREADY_USED'
  | 'DATE_EXPIRED'
  | 'FUTURE_DATE'
  | 'NAME_MISMATCH'
  | 'ID_MISMATCH'
  // The request could not be adjudicated safely, so it was refused
  | 'LEDGER_UNAVAILABLE'
  | 'NOT_READY'
  | 'IN_PROGRESS'
  | 'GENERIC';

/**
 * The identity the receipt is being redeemed against.
 *
 * `boundStudentNumber` is null during first-time onboarding, in which case the
 * server takes the identity from the receipt. When it is set, the server must
 * refuse any receipt belonging to a different student.
 */
export interface ReceiptValidationContext {
  boundStudentNumber: string | null;
  boundFullName: string | null;
}

/**
 * The server's verdict. On success `membership` is the authoritative record and
 * the client's only job is to cache it — it must not recompute entitlement.
 */
export interface ReceiptValidationResult {
  success: boolean;
  receipt?: ReceiptData;
  /** Identity the server matched the receipt to, used for first-time binding. */
  identity?: {
    studentNumber: string;
    fullName: string;
  };
  membership?: Membership;
  membershipExpiryDate?: string; // ISO 8601
  error?: ReceiptRejectionCode;
}

export type ApiError = {
  code: string;
  message: string;
  statusCode?: number;
};
