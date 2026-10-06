// src/types/auth.ts
export interface AuthChallenge {
  salt: string;
  nonce: string;
}

export interface LoginCredentials {
  studentId: string;
  passportHash: string;
  nonce: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
}

export interface AuthResponse extends TokenPair {
  totpSeed: string;
  profile: UserProfile;
}

export interface UserProfile {
  id: string;
  /** Purely numeric, e.g. "23141035". See utils/studentNumber. */
  studentId: string;
  fullName: string;
}
