// src/services/schemas.ts
/**
 * Runtime shape guards for everything read back out of device storage.
 *
 * Stored JSON is attacker-controlled on any device the user owns, so a bare
 * `JSON.parse(...) as T` is a trust boundary violation: editing one field could
 * otherwise mint a membership that never expires. Every read goes through a
 * guard here and anything that fails is treated as absent.
 */
import type { Membership, MembershipStatus, QuotaType } from '../types/membership';
import type { UserProfile } from '../types/auth';
import type { AttendanceRecord } from '../types/attendance';

const MEMBERSHIP_STATUSES: readonly MembershipStatus[] = [
  'active',
  'expired',
  'suspended',
  'pending',
];
const QUOTA_TYPES: readonly QuotaType[] = ['unlimited', 'punch_card'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptional<T>(value: unknown, guard: (v: unknown) => v is T): boolean {
  return value === undefined || guard(value);
}

/** An ISO 8601 timestamp that `Date` can actually parse. */
function isIsoTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/** A calendar date in strict YYYY-MM-DD form. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Reject impossible days such as 2026-02-31.
  const asDate = new Date(Date.UTC(year, month - 1, day));
  return (
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day
  );
}

export function isMembership(value: unknown): value is Membership {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.userId) &&
    typeof value.status === 'string' &&
    MEMBERSHIP_STATUSES.includes(value.status as MembershipStatus) &&
    isNonEmptyString(value.plan) &&
    isIsoTimestamp(value.startDate) &&
    isIsoTimestamp(value.expiryDate) &&
    isFiniteNumber(value.daysRemaining) &&
    typeof value.quotaType === 'string' &&
    QUOTA_TYPES.includes(value.quotaType as QuotaType) &&
    isOptional(value.quotaTotal, isFiniteNumber) &&
    isOptional(value.quotaUsed, isFiniteNumber) &&
    isOptional(value.quotaRemaining, isFiniteNumber)
  );
}

export function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.studentId) &&
    isNonEmptyString(value.fullName) &&
    isOptional(value.avatarUrl, isNonEmptyString) &&
    isOptional(value.faculty, isNonEmptyString) &&
    isOptional(value.enrollmentYear, isFiniteNumber)
  );
}

export function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.userId) &&
    isCalendarDate(value.date) &&
    isIsoTimestamp(value.timeIn) &&
    isOptional(value.timeOut, isIsoTimestamp) &&
    isOptional(value.durationMinutes, isFiniteNumber)
  );
}

/**
 * Attendance history is filtered rather than rejected wholesale: one bad row
 * should not erase a user's entire visit log.
 */
export function isAttendanceRecordArray(value: unknown): value is AttendanceRecord[] {
  return Array.isArray(value) && value.every(isAttendanceRecord);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
