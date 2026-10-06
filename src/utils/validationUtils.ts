// src/utils/validationUtils.ts
import { isStudentNumber } from './studentNumber';

export function validateStudentId(id: string): string | null {
  if (!id.trim()) return 'auth.studentIdRequired';
  if (!isStudentNumber(id.trim())) return 'auth.studentIdInvalid';
  return null;
}

export function validatePassport(passport: string): string | null {
  if (!passport.trim()) return 'auth.passportRequired';
  if (passport.trim().length < 5) return 'auth.passportInvalid';
  return null;
}

export function maskPassport(passport: string): string {
  if (passport.length <= 4) return passport;
  return passport.slice(0, 2) + '\u2022'.repeat(passport.length - 4) + passport.slice(-2);
}
