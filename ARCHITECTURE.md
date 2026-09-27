# UniGym — Architecture Documentation

> **Version:** 1.0.0 · **Last Updated:** 2026-09-26  
> **Stack:** React Native · Expo SDK 52 · TypeScript (strict) · Expo Router · NativeWind v4 · Zustand · TanStack Query · i18next

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Directory Structure](#2-directory-structure)
3. [Security Model & Privacy Compliance](#3-security-model--privacy-compliance)
4. [Data Flow & API Abstraction Layer](#4-data-flow--api-abstraction-layer)
5. [Authentication Architecture](#5-authentication-architecture)
6. [QR / Dynamic Pass Architecture](#6-qr--dynamic-pass-architecture)
7. [State Management Strategy](#7-state-management-strategy)
8. [Theming & Internationalization](#8-theming--internationalization)
9. [Connecting the Real University Backend](#9-connecting-the-real-university-backend)
10. [Connecting the Real Gym Turnstile System](#10-connecting-the-real-gym-turnstile-system)
11. [GDPR / FERPA Compliance Notes](#11-gdpr--ferpa-compliance-notes)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native App (Expo)                  │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Auth Layer │  │  Feature UIs │  │  Global Providers │  │
│  │  (Expo      │  │  (Screens /  │  │  (Theme, i18n,    │  │
│  │  Router)    │  │  Components) │  │  Auth, Query)     │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                │                    │             │
│  ┌──────▼────────────────▼────────────────────▼──────────┐  │
│  │                  Service Layer (src/services/)         │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │           IApiAdapter (Interface)              │   │  │
│  │  └──────────────┬──────────────┬──────────────────┘   │  │
│  │                 │              │                       │  │
│  │  ┌──────────────▼──┐  ┌───────▼───────────────────┐  │  │
│  │  │  MockApiAdapter │  │  UniversityApiAdapter      │  │  │
│  │  │  (dev/preview)  │  │  (production — LDAP/REST)  │  │  │
│  │  └─────────────────┘  └────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Secure Device Layer                       │  │
│  │  expo-secure-store (hardware-backed, encrypted KV)     │  │
│  │  ONLY stores: { accessToken, refreshToken, expiresAt } │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                              │
   ┌────────▼─────────┐         ┌──────────▼──────────────┐
   │   Mock Backend   │         │  University Backend      │
   │  (local data /   │  →swap→ │  (LDAP · REST · OAuth2)  │
   │   Supabase)      │         │  Gym Turnstile API        │
   └──────────────────┘         └─────────────────────────┘
```

---

## 2. Directory Structure

```
c:\GYM\
├── app/                          # Expo Router file-based routes
│   ├── _layout.tsx               # Root layout: providers, fonts, theme
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx             # Student ID + Passport login
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tab navigator
│   │   ├── index.tsx             # Dashboard / Home
│   │   ├── qr.tsx                # Rotating QR Pass
│   │   ├── history.tsx           # Attendance History
│   │   └── profile.tsx           # Profile & Settings
│   └── +not-found.tsx
│
├── src/
│   ├── core/                     # App-wide singletons & bootstrap
│   │   ├── queryClient.ts        # TanStack Query client config
│   │   ├── i18n.ts               # i18next initialization
│   │   └── constants.ts          # App-level constants
│   │
│   ├── services/                 # API abstraction layer
│   │   ├── api/
│   │   │   ├── IApiAdapter.ts    # ← THE INTERFACE (swap point)
│   │   │   ├── MockApiAdapter.ts # Dev/demo implementation
│   │   │   └── UniversityApiAdapter.ts  # Prod stub (ready to fill)
│   │   ├── ApiProvider.tsx       # Injects adapter via React context
│   │   ├── authService.ts        # Auth orchestration
│   │   ├── tokenService.ts       # Secure token storage
│   │   ├── qrService.ts          # TOTP rotating token logic
│   │   └── hapticService.ts      # Centralized haptic triggers
│   │
│   ├── stores/                   # Zustand global stores
│   │   ├── authStore.ts
│   │   ├── themeStore.ts
│   │   └── localeStore.ts
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useMembership.ts
│   │   ├── useAttendance.ts
│   │   ├── useQrToken.ts
│   │   └── useThemeColors.ts
│   │
│   ├── components/               # Shared UI components
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── SafeScreen.tsx
│   │   ├── membership/
│   │   │   ├── MembershipCard.tsx
│   │   │   └── CountdownTimer.tsx
│   │   ├── qr/
│   │   │   └── QrPassDisplay.tsx
│   │   └── history/
│   │       └── AttendanceItem.tsx
│   │
│   ├── theme/                    # Design token system
│   │   ├── colors.ts             # Semantic color palette (light + dark)
│   │   ├── typography.ts         # Font scales & weights
│   │   ├── spacing.ts            # 4px-base spacing scale
│   │   └── index.ts              # Re-exports
│   │
│   ├── locales/                  # i18n translation files
│   │   ├── en.json
│   │   ├── ru.json
│   │   └── tr.json
│   │
│   ├── types/                    # Shared TypeScript types & interfaces
│   │   ├── auth.ts
│   │   ├── membership.ts
│   │   ├── attendance.ts
│   │   └── api.ts
│   │
│   └── utils/                    # Pure utility functions
│       ├── dateUtils.ts
│       ├── validationUtils.ts
│       └── formatUtils.ts
│
├── assets/                       # Static assets (fonts, images, icons)
├── ARCHITECTURE.md               ← this file
├── TASKS.md
├── app.json
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

---

## 3. Security Model & Privacy Compliance

### 3.1 Zero-Trust Device Storage Policy

| Data                          | Stored On Device? | Storage Mechanism             | TTL         |
|-------------------------------|:-----------------:|-------------------------------|-------------|
| Raw Passport Number           | **NEVER**         | —                             | —           |
| Raw Student ID                | **NEVER**         | —                             | —           |
| Access JWT                    | ✅ Yes             | `expo-secure-store` (AES-256) | 15 minutes  |
| Refresh JWT                   | ✅ Yes             | `expo-secure-store` (AES-256) | 7 days      |
| User Profile (name, photo)    | ✅ Yes (cache)     | TanStack Query in-memory      | Session     |
| TOTP Seed (for QR)            | ✅ Yes             | `expo-secure-store`           | Per session |
| Theme / Language preference   | ✅ Yes             | `expo-secure-store`           | Persistent  |

### 3.2 Authentication Handshake

```
Client                              Server (University API)
  │                                       │
  │──(1) POST /auth/login ──────────────►│
  │   { studentId: "hashed",             │
  │     passportHash: "SHA-256(passport+salt)" }
  │                                       │
  │◄─(2) 200 OK ──────────────────────── │
  │   { accessToken, refreshToken,        │
  │     totpSeed, profile }               │
  │                                       │
  │   [Device: stores tokens in          │
  │    expo-secure-store ONLY]            │
  │                                       │
  │──(3) All subsequent requests ───────►│
  │   Authorization: Bearer <accessToken> │
  │                                       │
  │──(4) Token refresh (silent) ────────►│
  │   { refreshToken }                    │
```

> **Critical:** The passport number is **never** transmitted in plaintext. The client hashes it with SHA-256 + a server-provided salt (fetched via a pre-auth `/auth/challenge` endpoint) before transmission. This means even if TLS is compromised, the raw passport is never exposed.

### 3.3 Biometric Authentication Flow

After initial login, users can enable biometric unlock. Subsequent sessions:
1. App launches → checks `expo-secure-store` for valid refresh token.
2. If present → triggers `expo-local-authentication` (Face ID / Fingerprint).
3. On success → silently refreshes the access token using the stored refresh token.
4. **Raw credentials are never re-entered or stored.**

### 3.4 QR Pass Security

- The QR code encodes a **short-lived TOTP-derived JWT** (not the user's ID).
- Token rotates every **30 seconds** (configurable).
- The turnstile scanner validates the token against the server; the server checks the TOTP window.
- Screenshots are useless after 30 seconds.
- Payload: `{ sub: <anonymized_user_ref>, exp: <30s_window>, gym: <zone>, sig: <HMAC> }`

---

## 4. Data Flow & API Abstraction Layer

### 4.1 The Adapter Interface (`IApiAdapter.ts`)

```typescript
// src/services/api/IApiAdapter.ts
export interface IApiAdapter {
  // Auth
  getAuthChallenge(): Promise<AuthChallenge>;
  login(credentials: LoginCredentials): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  logout(refreshToken: string): Promise<void>;

  // Membership
  getMembership(userId: string): Promise<Membership>;

  // Attendance
  getAttendanceHistory(userId: string, page: number): Promise<AttendancePage>;

  // QR Pass
  generateQrToken(userId: string): Promise<QrTokenPayload>;
  validateQrToken(token: string): Promise<ValidationResult>;

  // Profile
  getProfile(userId: string): Promise<UserProfile>;
}
```

### 4.2 Swapping Adapters

The adapter is injected at app startup via `ApiProvider.tsx`. To switch to production:

```typescript
// src/services/ApiProvider.tsx
const adapter = process.env.EXPO_PUBLIC_API_MODE === 'production'
  ? new UniversityApiAdapter(process.env.EXPO_PUBLIC_API_BASE_URL!)
  : new MockApiAdapter();
```

**No other file changes are needed.** All hooks consume the adapter through `useApiAdapter()`.

---

## 5. Authentication Architecture

```
app/(auth)/login.tsx
       │
       ▼
useAuth() hook
       │
       ├── authService.loginWithCredentials()
       │         ├── IApiAdapter.getAuthChallenge()   [get salt]
       │         ├── hashPassport(passport, salt)     [SHA-256]
       │         ├── IApiAdapter.login(hashed creds)
       │         └── tokenService.storeTokens(tokens)
       │
       ├── authStore.setUser(profile)    [Zustand - in-memory]
       └── router.replace('/(tabs)/')    [Navigate to app]
```

---

## 6. QR / Dynamic Pass Architecture

```
app/(tabs)/qr.tsx
       │
       ▼
useQrToken() hook (TanStack Query, refetchInterval: 30s)
       │
       ├── IApiAdapter.generateQrToken(userId)
       │         └── Server: TOTP(seed, T=floor(now/30)) → sign JWT
       │
       ├── Renders: <QrPassDisplay token={...} expiresAt={...} />
       │
       └── CountdownBar: visual 30s countdown with haptic at T-5s
```

The QR value itself is a compact JWT with the format:
`eyJ....<base64url-header>.<base64url-payload>.<signature>`

---

## 7. State Management Strategy

| Concern           | Tool            | Why                                              |
|-------------------|-----------------|--------------------------------------------------|
| Auth session      | Zustand         | Synchronous, reactive, persisted (secure store)  |
| Theme / Language  | Zustand         | Synchronous UI state                             |
| Server data       | TanStack Query  | Caching, background refetch, optimistic updates  |
| Form state        | Local `useState`| Simple, no over-engineering                      |

---

## 8. Theming & Internationalization

### Theming

Colors are defined as a **semantic token map** (not raw Tailwind utilities) to ensure dark/light consistency:

```typescript
// src/theme/colors.ts
export const Colors = {
  light: {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    primary: '#1A73E8',
    text: '#1C1C1E',
    ...
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    primary: '#4DA3FF',
    text: '#FFFFFF',
    ...
  },
}
```

Theme is read from `themeStore` → passed to `useThemeColors()` → consumed by components.

### i18n

- All user-facing strings are in `src/locales/{en|ru|tr}.json`
- Language selection is persisted in `expo-secure-store`
- `i18next` is initialized before React mounts (in `src/core/i18n.ts`)
- Language switches take effect immediately without app restart

---

## 9. Connecting the Real University Backend

When university IT provides an API, populate `UniversityApiAdapter.ts`:

```typescript
// src/services/api/UniversityApiAdapter.ts
export class UniversityApiAdapter implements IApiAdapter {
  constructor(private baseUrl: string, private apiKey: string) {}

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Call real university SSO / LDAP-backed REST endpoint
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return res.json();
  }
  // ... implement all IApiAdapter methods
}
```

Then set `EXPO_PUBLIC_API_MODE=production` in `.env`.

**Expected university API contract:** See `src/types/api.ts` for the exact request/response shapes the adapter must return. The university IT team can adapt any existing endpoint to match these shapes without touching the app.

---

## 10. Connecting the Real Gym Turnstile System

The gym's turnstile scanner must:
1. Read the QR code JWT.
2. `POST /turnstile/validate { token }` to the university backend.
3. Receive `{ valid: boolean, userId: string, zone: string }`.
4. Trigger mechanical gate open.

The app itself does **not** communicate with the turnstile directly — all validation is server-side.

For the mock, `MockApiAdapter.generateQrToken()` returns a locally generated TOTP-based token that the demo scanner can verify.

---

## 11. GDPR / FERPA Compliance Notes

| Requirement                              | Implementation                                               |
|------------------------------------------|--------------------------------------------------------------|
| Data minimization                        | Only name + photo in profile cache; no PII on device        |
| Right to erasure                         | Logout clears all `expo-secure-store` keys + query cache    |
| Consent for biometrics                   | Opt-in toggle in Profile > Settings, stored as preference   |
| Audit trail                              | Attendance logs maintained server-side only                  |
| Encryption at rest                       | `expo-secure-store` uses iOS Keychain / Android Keystore    |
| Secure transmission                      | TLS 1.3 required; certificate pinning stub in adapter       |
| No third-party analytics by default      | Analytics adapter is a no-op stub; can be activated later   |
