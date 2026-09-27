# 🏋️ UniGym Mobile Application

> A production-grade, security-hardened cross-platform mobile application for University Gym & Fitness Centers. Built with React Native, Expo SDK, TypeScript, and modern security architecture.

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2057-black.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61dafb.svg)](https://reactnative.dev/)
[![Security](https://img.shields.io/badge/Security-Zero--Trust%20%7C%20FERPA%2FGDPR-green.svg)](#security--privacy-architecture)

---

## 📱 Features

- **Zero-Trust Client Security**: No raw PII (such as student passport numbers) is ever persisted on the device. Client uses SHA-256 salted hashing before transit and stores short-lived JWTs in hardware-backed secure storage (`expo-secure-store`).
- **Dynamic Turnstile QR Pass**: Rotating TOTP-based QR codes refreshed automatically every 30 seconds with visual countdown timers and haptic warnings to prevent screenshot sharing.
- **Pluggable API Architecture (`IApiAdapter`)**: Seamlessly switch between local mock data (`MockApiAdapter`) and real University Active Directory / LDAP / REST databases (`UniversityApiAdapter`) by changing an environment variable (`EXPO_PUBLIC_API_MODE`).
- **Comprehensive Membership & Quotas**: Real-time tracking of subscription status, countdown of remaining days, unlimited access models, or punch-card visit balances.
- **Attendance & Visit History**: Timeline of gym entries and exits categorized by fitness zone (Main Hall, Cardio, Weights, Pool, Yoga Studio) with infinite pagination.
- **Internationalization (i18n)**: Instant runtime language switching across **English (`en`)**, **Russian (`ru`)**, and **Turkish (`tr`)** via `i18next`.
- **Theme Engine**: System-responsive dynamic **Dark & Light Mode** with semantic design tokens.
- **Biometric Authentication**: Optional Face ID / Touch ID unlock via `expo-local-authentication`.

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Framework** | [React Native](https://reactnative.dev/) with [Expo SDK](https://expo.dev/) (TypeScript Strict) |
| **Routing** | [Expo Router](https://docs.expo.dev/router/introduction/) (File-based typed navigation) |
| **State & Cache** | [Zustand](https://github.com/pmndrs/zustand) (Client state) & [TanStack Query](https://tanstack.com/query) (Server state) |
| **Security** | `expo-secure-store` (Keychain / Keystore), WebCrypto / SHA-256 hashing |
| **Biometrics & Hardware** | `expo-local-authentication`, `expo-haptics` |
| **Localization** | `i18next`, `react-i18next` |
| **Graphics & QR** | `react-native-qrcode-svg`, `react-native-svg`, `expo-linear-gradient` |

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/<username>/<repo>.git
cd <repo>
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default mode is `mock`:
```env
EXPO_PUBLIC_API_MODE=mock
EXPO_PUBLIC_API_BASE_URL=
```

### 3. Run Development Server
```bash
# Start Metro bundler (interactive)
npm start

# Run on Web
npm run web

# Run on Android emulator / device
npm run android

# Run on iOS simulator / device
npm run ios
```

---

## 🔑 Demo Credentials (Mock Mode)

| Student ID | Full Name | Plan | Password / Passport |
|---|---|---|---|
| `STU001` | Ayana Bekova | Monthly Unlimited (All main zones) | Any 5+ chars (e.g. `12345`) |
| `STU002` | Dmitri Volkov | 10-Visit Pack (6 remaining) | Any 5+ chars (e.g. `12345`) |
| `STU003` | Elif Şahin | Semester Pass (Includes Pool) | Any 5+ chars (e.g. `12345`) |

---

## 🏛️ Architecture Overview

```
src/
├── core/             # i18n initialization, TanStack Query client, app constants
├── services/         # API adapters, authentication, hardware storage, haptics
│   └── api/
│       ├── IApiAdapter.ts          # Core interface: swap point for university backends
│       ├── MockApiAdapter.ts        # Pre-seeded mock service
│       └── UniversityApiAdapter.ts  # Production REST/LDAP adapter stub
├── stores/           # Zustand stores (Auth, Theme, Locale)
├── hooks/            # Custom hooks (useAuth, useMembership, useQrToken, etc.)
├── components/       # UI design system and domain-specific cards
├── theme/            # Color palettes, typography scales, spacing tokens
├── locales/          # English (en), Russian (ru), Turkish (tr) translation dictionaries
└── types/            # Fully-typed domain models (Auth, Membership, Attendance, API)
```

For in-depth details regarding FERPA/GDPR compliance, authentication handshakes, and turnstile hardware integration, refer to [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
