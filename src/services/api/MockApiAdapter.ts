// src/services/api/MockApiAdapter.ts
/**
 * MockApiAdapter — Fully seeded local implementation of IApiAdapter.
 *
 * Pre-loaded with 3 student profiles, realistic memberships, and visit history.
 * All "network" calls have a simulated 400–900ms latency for realistic UX testing.
 *
 * Student ID format: STD... (e.g. STD23141035)
 */
import type { IApiAdapter } from './IApiAdapter';
import type { AuthChallenge, LoginCredentials, AuthResponse, TokenPair, UserProfile } from '../../types/auth';
import type { Membership } from '../../types/membership';
import type { AttendancePage, AttendanceRecord } from '../../types/attendance';
import type {
  ReceiptData,
  ReceiptValidationContext,
  ReceiptValidationResult,
} from '../../types/api';
import { PAGE_SIZE } from '../../core/constants';
import { mockServerState, LedgerUnavailableError } from './mockServerState';

// ── Seeded Data ──────────────────────────────────────────────────────────────

const MOCK_USERS: Record<string, UserProfile & { passportHash: string }> = {
  'STD23141035': {
    id: 'user-001',
    studentId: 'STD23141035',
    passportHash: 'mock_hash_ayana',
    fullName: 'Ayana Bekova',
    faculty: 'Computer Science',
    enrollmentYear: 2023,
  },
  'STD22130920': {
    id: 'user-002',
    studentId: 'STD22130920',
    passportHash: 'mock_hash_dmitri',
    fullName: 'Dmitri Volkov',
    faculty: 'Engineering',
    enrollmentYear: 2022,
  },
  'STD24150712': {
    id: 'user-003',
    studentId: 'STD24150712',
    passportHash: 'mock_hash_elif',
    fullName: 'Elif Şahin',
    faculty: 'Business Administration',
    enrollmentYear: 2024,
  },
};

// Seeded membership fixtures were removed: membership standing now comes from
// mockServerState, which is the only writer of the authoritative record.

function generateHistory(userId: string): AttendanceRecord[] {
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

// ── Adapter Implementation ────────────────────────────────────────────────────

export class MockApiAdapter implements IApiAdapter {
  private _salt = 'mock_server_salt_2026';
  private _sessions: Map<string, string> = new Map();

  async getAuthChallenge(): Promise<AuthChallenge> {
    await randomDelay();
    return { salt: this._salt, nonce: `nonce_${Date.now()}` };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await randomDelay();

    const userEntry = Object.values(MOCK_USERS).find(
      (u) => u.studentId === credentials.studentId
    );

    if (!userEntry) {
      throw { code: 'AUTH_INVALID', message: 'Invalid credentials', statusCode: 401 };
    }

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

  async getMembership(userId: string): Promise<Membership | null> {
    await randomDelay();
    // Standing comes from the simulated server's own record, not from the
    // seeded fixtures, so that redemptions performed in-app are reflected here.
    return mockServerState.readMembership(userId);
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

  /**
   * Delegates entirely to the simulated server state, which owns the ledger,
   * the ownership rules and the entitlement maths. Nothing is decided here.
   */
  async validateReceipt(
    receipt: ReceiptData,
    context: ReceiptValidationContext
  ): Promise<ReceiptValidationResult> {
    await delay(800);

    try {
      return await mockServerState.redeemReceipt(receipt, context);
    } catch (error) {
      if (error instanceof LedgerUnavailableError) {
        return { success: false, receipt, error: 'LEDGER_UNAVAILABLE' };
      }
      // A failed write must not read as a grant.
      return { success: false, receipt, error: 'GENERIC' };
    }
  }
}
