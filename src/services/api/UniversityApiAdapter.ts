// src/services/api/UniversityApiAdapter.ts
/**
 * UniversityApiAdapter — Production adapter stub.
 *
 * When the university IT department provides their REST / LDAP / OAuth2 API:
 * 1. Fill in the endpoints below.
 * 2. Set EXPO_PUBLIC_API_MODE=production in .env
 * 3. That's it — zero other code changes needed.
 */
import type { IApiAdapter } from './IApiAdapter';
import type { AuthChallenge, LoginCredentials, AuthResponse, TokenPair, UserProfile } from '../../types/auth';
import type { Membership } from '../../types/membership';
import type { AttendancePage } from '../../types/attendance';
import type { ReceiptData, ReceiptValidationResult } from '../../types/api';
import { API_BASE_URL } from '../../core/constants';

export class UniversityApiAdapter implements IApiAdapter {
  private _baseUrl = API_BASE_URL;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this._baseUrl = baseUrl;
    }
  }

  private async _fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this._baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { code: err.code ?? 'API_ERROR', message: err.message ?? res.statusText, statusCode: res.status };
    }
    return res.json();
  }

  async getAuthChallenge(): Promise<AuthChallenge> {
    return this._fetch('/auth/challenge');
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this._fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this._fetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this._fetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    return this._fetch(`/users/${userId}`);
  }

  async getMembership(userId: string): Promise<Membership> {
    return this._fetch(`/users/${userId}/membership`);
  }

  async getAttendanceHistory(userId: string, page: number): Promise<AttendancePage> {
    return this._fetch(`/users/${userId}/attendance?page=${page}`);
  }

  async validateReceipt(userId: string, receipt: ReceiptData): Promise<ReceiptValidationResult> {
    return this._fetch(`/users/${userId}/receipt/validate`, {
      method: 'POST',
      body: JSON.stringify(receipt),
    });
  }
}
