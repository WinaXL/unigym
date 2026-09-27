# UniGym — Task Tracker

> **Project:** University Gym Mobile App (React Native · Expo · TypeScript)  
> **Started:** 2026-09-26 · **Target:** Production-ready MVP

---

## Legend
- ✅ Done
- 🔄 In Progress
- ⏳ Pending
- 🚫 Blocked

---

## Phase 1 — Project Bootstrap & Architecture

| #   | Task                                           | Status | Notes                                      |
|-----|------------------------------------------------|--------|--------------------------------------------|
| 1.1 | Install Node.js LTS                            | ✅     | v24.19.0 installed via winget              |
| 1.2 | Initialize Expo project (TypeScript strict)    | ✅     | `create-expo-app` blank-typescript         |
| 1.3 | Install all core dependencies                  | ✅     | All packages installed                     |
| 1.4 | Configure TypeScript (strict mode)             | ✅     | `tsc --noEmit` passes with 0 errors        |
| 1.5 | Configure Expo Router (file-based navigation)  | ✅     | index.ts → expo-router/entry               |
| 1.6 | Generate ARCHITECTURE.md                       | ✅     | Complete                                   |
| 1.7 | Generate TASKS.md (this file)                  | ✅     | Complete                                   |
| 1.8 | Set up directory structure                     | ✅     | Full src/ tree created                     |

---

## Phase 2 — Core Infrastructure

| #   | Task                                           | Status | Notes                                      |
|-----|------------------------------------------------|--------|--------------------------------------------|
| 2.1 | Design token system (colors, typography, spacing) | ✅  | Light + Dark semantic tokens               |
| 2.2 | Theme store (Zustand) + useThemeColors hook    | ✅     |                                            |
| 2.3 | i18n setup (i18next) — EN, RU, TR             | ✅     |                                            |
| 2.4 | Locale store + language switching              | ✅     |                                            |
| 2.5 | TanStack Query client configuration            | ✅     |                                            |
| 2.6 | `IApiAdapter` interface definition             | ✅     | The core swap point                        |
| 2.7 | `MockApiAdapter` with seeded data              | ✅     | 3 student profiles, memberships, history   |
| 2.8 | `UniversityApiAdapter` stub (production ready) | ✅     |                                            |
| 2.9 | `ApiProvider` context                          | ✅     |                                            |
| 2.10| Token service (expo-secure-store)              | ✅     | Store/retrieve/clear JWT tokens            |
| 2.11| Auth service (login, refresh, logout)          | ✅     | SHA-256 passport hashing                  |
| 2.12| Auth store (Zustand)                           | ✅     |                                            |
| 2.13| Biometric service (expo-local-authentication)  | ✅     | In Profile screen toggle                   |
| 2.14| QR/TOTP service (rotating token generation)    | ✅     | 30s rotation window                        |
| 2.15| Haptic service                                 | ✅     |                                            |
| 2.16| Root layout with all providers                 | ✅     | + session restore + route guard            |

---

## Phase 3 — Shared UI Components

| #   | Task                                           | Status | Notes                                      |
|-----|------------------------------------------------|--------|--------------------------------------------|
| 3.1 | `SafeScreen` wrapper component                 | ✅     | Status bar, safe area, bg color            |
| 3.2 | `Button` component (primary/secondary/ghost)   | ✅     | With haptics + loading state               |
| 3.3 | `Card` component                               | ✅     | Elevated, themed                           |
| 3.4 | `Badge` component                              | ✅     | Status indicators                          |
| 3.5 | `Skeleton` loading placeholders                | ⏳     | Future polish iteration                    |
| 3.6 | `MembershipCard` (pass card UI)                | ✅     | Gradient, expiry, zone info                |
| 3.7 | `CountdownTimer` (days remaining)              | ✅     | Inline in QR screen                        |
| 3.8 | `QrPassDisplay` (fullscreen QR + countdown)    | ✅     | react-native-qrcode-svg                   |
| 3.9 | `AttendanceItem` (history row)                 | ✅     | Date, time in/out, zone                    |

---

## Phase 4 — Screens & Navigation

| #   | Task                                           | Status | Notes                                      |
|-----|------------------------------------------------|--------|--------------------------------------------|
| 4.1 | Auth group layout `(auth)/_layout.tsx`         | ✅     |                                            |
| 4.2 | **Login Screen** `(auth)/login.tsx`            | ✅     | Student ID + Passport, masking, validation |
| 4.3 | Tab navigator layout `(tabs)/_layout.tsx`      | ✅     | Custom tab bar with icons                  |
| 4.4 | **Dashboard Screen** `(tabs)/index.tsx`        | ✅     | Pass card, countdown, stats, quick QR btn  |
| 4.5 | **QR Pass Screen** `(tabs)/qr.tsx`             | ✅     | Fullscreen, auto-rotating, countdown bar   |
| 4.6 | **History Screen** `(tabs)/history.tsx`        | ✅     | FlatList timeline of visits                |
| 4.7 | **Profile Screen** `(tabs)/profile.tsx`        | ✅     | Theme, language, biometrics, logout        |
| 4.8 | 404 Not Found screen                           | ✅     |                                            |
| 4.9 | Route guard (redirect unauthenticated users)   | ✅     | Check auth state in root layout            |

---

## Phase 5 — Polish & Verification

| #   | Task                                           | Status | Notes                                      |
|-----|------------------------------------------------|--------|--------------------------------------------|
| 5.1 | Dark mode consistency audit                    | ✅     | All components use semantic color tokens   |
| 5.2 | i18n completeness check (all 3 languages)      | ✅     | EN / RU / TR complete                      |
| 5.3 | Haptic integration on all key interactions     | ✅     |                                            |
| 5.4 | Micro-animations (Reanimated)                  | ⏳     | Phase 2 enhancement                        |
| 5.5 | Expo Go / web preview validation               | 🔄     | Server starting...                         |
| 5.6 | TypeScript strict check (`tsc --noEmit`)       | ✅     | **0 errors**                               |
| 5.7 | Security review checklist                      | ✅     | No PII in storage, TOTP tokens, hashing    |

---

## Installed Dependency Manifest

```
Core:
  expo ~57.0.25
  expo-router ~57.0.23
  react 19.2.3
  react-native 0.86.3
  typescript ~6.0.3

UI & Styling:
  react-native-safe-area-context
  react-native-gesture-handler
  expo-linear-gradient
  @expo/vector-icons
  react-native-svg
  react-native-qrcode-svg
  react-dom (web)
  react-native-web (web)

State & Data:
  zustand ^5.0.15
  @tanstack/react-query ^5.104.0

Security:
  expo-secure-store ~57.0.4
  expo-local-authentication ~57.0.3

Localization:
  i18next ^26.4.2
  react-i18next ^17.0.15

Utilities:
  expo-haptics ~57.0.3
  expo-status-bar ~57.0.1
  expo-font ~57.0.4
  expo-splash-screen ~57.0.9
  expo-constants ~57.0.19
  expo-linking ~57.0.11
  expo-system-ui ~57.0.4
  date-fns ^4.4.0
```

---

## Mock Demo Accounts

| Student ID | Name           | Plan                | Quota        | Zones                           |
|------------|----------------|---------------------|--------------|-------------------------------|
| STU001     | Ayana Bekova   | Monthly Unlimited   | Unlimited    | Main Hall, Cardio, Weights, Yoga |
| STU002     | Dmitri Volkov  | 10-Visit Pack       | 6/10 left   | Main Hall, Cardio, Weights       |
| STU003     | Elif Şahin     | Semester Pass       | Unlimited    | All zones incl. Pool             |

**Password:** Any 5+ character string works in mock mode.
