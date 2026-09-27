// src/types/api.ts
export interface QrTokenPayload {
  token: string;         // Compact JWT or TOTP-derived string
  expiresAt: number;     // Unix timestamp ms (token validity end)
  rotatesAt: number;     // Unix timestamp ms (next rotation)
}

export interface ValidationResult {
  valid: boolean;
  userId?: string;
  zone?: string;
  message?: string;
}

export type ApiError = {
  code: string;
  message: string;
  statusCode?: number;
};
