// src/services/api/MockApiAdapter.ts
/**
 * MockApiAdapter — Fully seeded local implementation of IApiAdapter.
 *
 * Pre-loaded with 3 student profiles, realistic memberships, and visit history.
 * All "network" calls have a simulated 400–900ms latency for realistic UX testing.
 *
 * SWAP THIS OUT: Replace with UniversityApiAdapter for production.
 */
import type { IApiAdapter } from './IApiAdapter';
import type { AuthChallenge, LoginCredentials, AuthResponse, TokenPair, UserProfile } from '../../types/auth';
import type { Membership } from '../../types/membership';
import type { AttendancePage, AttendanceRecord } from '../../types/attendance';
import type { QrTokenPayload, ValidationResult } from '../../types/api';
import { PAGE_SIZE, QR_ROTATION_INTERVAL_MS } from '../../core/constants';

// ── Seeded Data ──────────────────────────────────────────────────────────────

const MOCK_USERS: Record<string, UserProfile & { passportHash: string }> = {
  'STU001': {
    id: 'user-001',
    studentId: 'STU001',
    passportHash: 'mock_hash_ayana', // In prod: SHA-256(passport + salt)
    fullName: 'Ayana Bekova',
    email: 'a.bekova@university.edu',
    avatarUrl: undefined,
    faculty: 'Computer Science',
    enrollmentYear: 2023,
  },
  'STU002': {
    id: 'user-002',
    studentId: 'STU002',
    passportHash: 'mock_hash_dmitri',
    fullName: 'Dmitri Volkov',
    email: 'd.volkov@university.edu',
    faculty: 'Engineering',
    enrollmentYear: 2022,
  },
  'STU003': {
    id: 'user-003',
    studentId: 'STU003',
    passportHash: 'mock_hash_elif',
    fullName: 'Elif Şahin',
    email: 'e.sahin@university.edu',
    faculty: 'Business Administration',
    enrollmentYear: 2024,
  },
};

const MOCK_MEMBERSHIPS: Record<string, Membership> = {
  'user-001': {
    id: 'mem-001',
    userId: 'user-001',
    status: 'active',
    plan: 'Monthly Unlimited',
    startDate: '2026-09-01T00:00:00Z',
    expiryDate: '2026-10-31T23:59:59Z',
    daysRemaining: 35,
    quotaType: 'unlimited',
    allowedZones: ['main_hall', 'cardio', 'weights', 'yoga_studio'],
  },
  'user-002': {
    id: 'mem-002',
    userId: 'user-002',
    status: 'active',
    plan: '10-Visit Pack',
    startDate: '2026-09-10T00:00:00Z',
    expiryDate: '2026-12-10T23:59:59Z',
    daysRemaining: 75,
    quotaType: 'punch_card',
    quotaTotal: 10,
    quotaUsed: 4,
    quotaRemaining: 6,
    allowedZones: ['main_hall', 'cardio', 'weights'],
  },
  'user-003': {
    id: 'mem-003',
    userId: 'user-003',
    status: 'active',
    plan: 'Semester Pass',
    startDate: '2026-09-01T00:00:00Z',
    expiryDate: '2027-01-31T23:59:59Z',
    daysRemaining: 127,
    quotaType: 'unlimited',
    allowedZones: ['main_hall', 'cardio', 'weights', 'yoga_studio', 'pool'],
  },
};

function generateHistory(userId: string): AttendanceRecord[] {
  const zones = ['main_hall', 'cardio', 'weights', 'yoga_studio'];
  const records: AttendanceRecord[] = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 2 - Math.floor(Math.random() * 2));
    const dateStr = date.toISOString().split('T')[0];

    const inHour = 7 + Math.floor(Math.random() * 12);
    const inMin = Math.floor(Math.random() * 60);
    const duration = 30 + Math.floor(Math.random() * 90);

    const timeIn = new Date(date);
    timeIn.setHours(inHour, inMin, 0, 0);
    const timeOut = new Date(timeIn.getTime() + duration * 60 * 1000);

    records.push({
      id: `att-${userId}-${i}`,
      userId,
      date: dateStr,
      timeIn: timeIn.toISOString(),
      timeOut: timeOut.toISOString(),
      zone: zones[Math.floor(Math.random() * zones.length)],
      durationMinutes: duration,
    });
  }

  return records.sort((a, b) => new Date(b.timeIn).getTime() - new Date(a.timeIn).getTime());
}

const MOCK_HISTORY: Record<string, AttendanceRecord[]> = {
  'user-001': generateHistory('user-001'),
  'user-002': generateHistory('user-002'),
  'user-003': generateHistory('user-003'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return delay(400 + Math.random() * 500);
}

function makeAccessToken(userId: string): string {
  const payload = { sub: userId, exp: Date.now() + 15 * 60 * 1000 };
  return `mock_access.${btoa(JSON.stringify(payload))}.sig`;
}

function makeRefreshToken(userId: string): string {
  return `mock_refresh_${userId}_${Date.now()}`;
}

function makeTotpSeed(userId: string): string {
  return `MOCK_SEED_${userId.toUpperCase()}`;
}

function generateQrTokenValue(userId: string, seed: string): string {
  const window = Math.floor(Date.now() / QR_ROTATION_INTERVAL_MS);
  const payload = { sub: userId, w: window, seed: seed.slice(0, 8) };
  return `mock_qr.${btoa(JSON.stringify(payload))}.hmac`;
}

// ── Adapter Implementation ────────────────────────────────────────────────────

export class MockApiAdapter implements IApiAdapter {
  private _salt = 'mock_server_salt_2026';
  private _sessions: Map<string, string> = new Map(); // refreshToken -> userId

  async getAuthChallenge(): Promise<AuthChallenge> {
    await randomDelay();
    return { salt: this._salt, nonce: `nonce_${Date.now()}` };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await randomDelay();

    // Find user by studentId
    const userEntry = Object.values(MOCK_USERS).find(
      (u) => u.studentId === credentials.studentId
    );

    if (!userEntry) {
      throw { code: 'AUTH_INVALID', message: 'Invalid credentials', statusCode: 401 };
    }

    // In mock mode, accept any non-empty passport hash
    if (!credentials.passportHash || credentials.passportHash.length < 4) {
      throw { code: 'AUTH_INVALID', message: 'Invalid credentials', statusCode: 401 };
    }

    const { passportHash: _, ...profile } = userEntry;
    const accessToken = makeAccessToken(profile.id);
    const refreshToken = makeRefreshToken(profile.id);
    const totpSeed = makeTotpSeed(profile.id);

    this._sessions.set(refreshToken, profile.id);

    return {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 15 * 60 * 1000,
      totpSeed,
      profile,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    await randomDelay();
    const userId = this._sessions.get(refreshToken);
    if (!userId) {
      throw { code: 'TOKEN_INVALID', message: 'Invalid or expired refresh token', statusCode: 401 };
    }

    const newAccessToken = makeAccessToken(userId);
    const newRefreshToken = makeRefreshToken(userId);
    this._sessions.delete(refreshToken);
    this._sessions.set(newRefreshToken, userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await randomDelay();
    this._sessions.delete(refreshToken);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    await randomDelay();
    const entry = Object.values(MOCK_USERS).find((u) => u.id === userId);
    if (!entry) throw { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 };
    const { passportHash: _, ...profile } = entry;
    return profile;
  }

  async getMembership(userId: string): Promise<Membership> {
    await randomDelay();
    const membership = MOCK_MEMBERSHIPS[userId];
    if (!membership) throw { code: 'NOT_FOUND', message: 'Membership not found', statusCode: 404 };
    return membership;
  }

  async getAttendanceHistory(userId: string, page: number): Promise<AttendancePage> {
    await randomDelay();
    const allRecords = MOCK_HISTORY[userId] ?? [];
    const start = (page - 1) * PAGE_SIZE;
    const records = allRecords.slice(start, start + PAGE_SIZE);

    return {
      records,
      total: allRecords.length,
      page,
      pageSize: PAGE_SIZE,
      hasMore: start + PAGE_SIZE < allRecords.length,
    };
  }

  async generateQrToken(userId: string): Promise<QrTokenPayload> {
    await delay(200); // QR generation should be fast
    const seed = makeTotpSeed(userId);
    const token = generateQrTokenValue(userId, seed);
    const now = Date.now();
    const windowStart = Math.floor(now / QR_ROTATION_INTERVAL_MS) * QR_ROTATION_INTERVAL_MS;
    const rotatesAt = windowStart + QR_ROTATION_INTERVAL_MS;

    return {
      token,
      expiresAt: rotatesAt,
      rotatesAt,
    };
  }

  async validateQrToken(token: string): Promise<ValidationResult> {
    await randomDelay();
    if (token.startsWith('mock_qr.')) {
      return { valid: true, userId: 'user-001', zone: 'main_hall' };
    }
    return { valid: false, message: 'Invalid or expired token' };
  }
}
