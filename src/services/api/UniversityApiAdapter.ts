// src/services/api/UniversityApiAdapter.ts
/**
 * UniversityApiAdapter — Production implementation stub.
 *
 * Fill in this class when the university IT team provides their API endpoints.
 * No other file in the app needs to change — just this adapter + the env var.
 *
 * To activate: set EXPO_PUBLIC_API_MODE=production in your .env file.
 *
 * Suggested integration points:
 * - University SSO / OAuth2 → login()
 * - LDAP-backed REST API → getProfile()
 * - Gym management system REST API → getMembership(), getAttendanceHistory()
 * - Turnstile TOTP service → generateQrToken(), validateQrToken()
 */
import type { IApiAdapter } from './IApiAdapter';
import type { AuthChallenge, LoginCredentials, AuthResponse, TokenPair, UserProfile } from '../../types/auth';
import type { Membership } from '../../types/membership';
import type { AttendancePage } from '../../types/attendance';
import type { QrTokenPayload, ValidationResult } from '../../types/api';
import type { ApiError } from '../../types/api';

export class UniversityApiAdapter implements IApiAdapter {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    };

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });

    if (!res.ok) {
      const err: ApiError = await res.json().catch(() => ({
        code: 'HTTP_ERROR',
        message: `HTTP ${res.status}`,
        statusCode: res.status,
      }));
      throw err;
    }

    return res.json() as Promise<T>;
  }

  async getAuthChallenge(): Promise<AuthChallenge> {
    return this.request<AuthChallenge>('/auth/challenge');
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    return this.request<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    return this.request<UserProfile>(`/users/${userId}/profile`);
  }

  async getMembership(userId: string): Promise<Membership> {
    return this.request<Membership>(`/users/${userId}/membership`);
  }

  async getAttendanceHistory(userId: string, page: number): Promise<AttendancePage> {
    return this.request<AttendancePage>(
      `/users/${userId}/attendance?page=${page}`
    );
  }

  async generateQrToken(userId: string): Promise<QrTokenPayload> {
    return this.request<QrTokenPayload>(`/users/${userId}/qr-token`, {
      method: 'POST',
    });
  }

  async validateQrToken(token: string): Promise<ValidationResult> {
    return this.request<ValidationResult>('/turnstile/validate', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }
}
