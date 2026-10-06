// src/utils/studentNumber.ts
/**
 * Student numbers are purely numeric, e.g. "23141035".
 *
 * Earlier builds stored them with an "STD" prefix ("STD23141035"). The legacy
 * helpers below exist only to migrate data written by those builds; nothing new
 * should ever produce a prefixed value.
 */

/** 6–12 ASCII digits, nothing else. */
export const STUDENT_NUMBER_PATTERN = /^\d{6,12}$/;

export const STUDENT_NUMBER_MAX_LENGTH = 12;

export function isStudentNumber(value: unknown): value is string {
  return typeof value === 'string' && STUDENT_NUMBER_PATTERN.test(value);
}

/**
 * Reduce free-form input to ASCII digits, for use as a TextInput filter.
 *
 * NFKC first so full-width digits ("２３１") become ASCII before filtering;
 * every other character, including a typed or pasted "STD", is dropped.
 */
export function digitsOnly(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/\D/g, '')
    .slice(0, STUDENT_NUMBER_MAX_LENGTH);
}

const LEGACY_STUDENT_NUMBER = /^STD(\d+)$/i;
const LEGACY_USER_ID = /^user-STD(\d+)$/i;

/** "STD23141035" → "23141035". Any other value is returned unchanged. */
export function migrateLegacyStudentNumber(value: string): string {
  const match = LEGACY_STUDENT_NUMBER.exec(value.trim());
  return match ? match[1] : value;
}

/** "user-STD23141035" → "user-23141035". Any other value is returned unchanged. */
export function migrateLegacyUserId(value: string): string {
  const match = LEGACY_USER_ID.exec(value);
  return match ? `user-${match[1]}` : value;
}
