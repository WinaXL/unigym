# UniGym handoff

This is a record of the work done in Cursor on the UniGym Expo app, for the next agent. The repo is `https://github.com/WinaXL/unigym.git`, branch `main`. Latest commit at the time of writing: `be7d098`.

The app is a campus-gym membership client. A student scans an İş Bankası payment receipt (dekont), the app binds their name and student number to the device, and a 30-day membership is extended. There is no login. The real gym desk uses ACS card readers (Akselektronik) and AKS Manager on a PC. This app does not talk to that system. It only reads the same paper receipt the desk uses.

## Stack

- Expo SDK 57, React Native 0.86, Expo Router, Zustand, i18next.
- Routes live in `app/`, not `src/app/`.
- Receipt validation goes through `IApiAdapter.validateReceipt`. `MockApiAdapter` stands in for a future university backend. Do not put entitlement math back on the client.
- On-device OCR is `expo-ocr-kit` (ML Kit on Android, Vision on iOS). It is not available in Expo Go or on web. A preview APK is required to test scanning.
- EAS project: `@winnaxl/unigym`, project id `1e0e5690-cffb-46b1-8780-95e3abd15ff2`.
- Shareable Android builds use the `preview` profile in `eas.json`, which produces an APK (`android.buildType: "apk"`, `distribution: "internal"`). A `development` profile is a dev client and is useless to send to a friend.
- Windows PowerShell has no heredoc. Commit messages were written to `.git/COMMIT_MSG_TMP.txt` and committed with `git commit -F`.
- EAS builders run npm 10. This machine runs npm 11. After any `npm install`, regenerate the lockfile with `npx npm@10.9.8 install --package-lock-only` or the next EAS build dies in `npm ci`.

## Trust model (do not undo)

Commit `329bbc2` moved entitlement off the client.

- The client never decides that a receipt is valid. It calls the adapter. `MockApiAdapter` delegates to `mockServerState.redeemReceipt`.
- All ledger and membership writes go through one promise queue in `mockServerState.ts`. Two receipts submitted at once must not both pass the duplicate check.
- A receipt reference is the anti-replay key. The verify modal shows it read-only. If the student could retype it, one physical slip could be redeemed forever under new ids.
- Replay comparison uses `referenceReplayKey` in `receiptRules.ts`: dashes are dropped and OCR lookalikes are folded (`O/0`, `I/1`, `L/1`, `S/5`, `B/8`, `Z/2`).
- Profile, membership cache, and tokens live in `expo-secure-store` on native. Reads go through schema guards. Corrupt data is discarded, not trusted.
- Student numbers are digits only, 6–12 characters (`src/utils/studentNumber.ts`). An `STD` prefix is rejected by the server normalizer, not stripped, so `STD23141035` and `23141035` are never the same person. Old stored profiles (`STD…`, `user-STD…`) are migrated on read.
- Membership is a validity window only: status, start, expiry, days remaining. There is no plan, tariff, or visit quota. The gym is one access level.
- Receipt payment dates must be strict `YYYY-MM-DD`. Freshness is 7 days (`MAX_RECEIPT_AGE_DAYS`).
- Biometric lock is an overlay. Do not replace the navigator with only the lock screen or Expo Router unmounts.
- Web scan shortcuts are not allowed. A placeholder image must never become a valid receipt.

## Real receipt shape

The slip students scan is a Türkiye İş Bankası dekont for Kıbrıs Bilim Vakfı Lefke Avrupa Üniversitesi.

- Student identity is one cell: `Açıklama : 23141035 MAXAT KALIYEV`.
- Payment date is `İşlem Tarihi : 07.10.2026 09:29:55`. `Düzenleme Tarihi` is print time, not the payment.
- Reference is `Referans Numarası : 07.10.2026/5805/4/13` (date, then the bank sequence). An earlier photo of the same kind of slip was transcribed as `3835`; the user later said the sequence is `5805`. Treat the printed sequence as the source of truth. Do not guess a different sequence.
- Canonical stored form folds `.` and `/` to `-`, so that reference becomes `07-10-2026-5805-4-13`. The replay key drops dashes.
- `Müşteri No` (for example `47173963`) and the IBAN are not the student number.
- ML Kit reads Latin text. Cyrillic and Kazakh names often will not come through. Turkish labels on this dekont are Latin, so they do.

## Chronological problems and fixes

### 1. Security rewrite (`329bbc2`)

The old client granted membership itself, tracked used receipt ids locally, and could be bypassed. Validation, the spent-receipt ledger, and membership records moved behind the adapter. PII moved to SecureStore. Fail-open paths were closed. Biometric lock was enforced at launch and on resume. History list keys stopped using a translated string.

### 2. Product cleanup (`1d24f87`)

- Removed the Amount field from the verify modal, `ReceiptData`, and the simulated parser. The fee is fixed. `IApiAdapter` signatures stayed the same.
- Student numbers became digits only. The field uses the number pad and strips non-digits. Placeholders are `23141035`, not `STD23141035`.
- Existing installs with `STD…` profiles are migrated instead of being treated as corrupt, so the user does not have to onboard again. History and the active session migrate `user-STD…` ids the same way.
- Profile Account card shows only Student Number. Faculty, enrollment year, and an unused avatar field were removed from `UserProfile`.
- Kazakh (`kk` / Қазақша) was added as a fourth language. Welcome screen has a globe switcher. Profile uses a 2×2 language grid. `localeStore.setLanguage` persists the choice. Bootstrap uses `hydrateLanguage` so restoring a saved language does not write it again.

### 3. No tariff, real OCR (`5bab683`)

- Membership card no longer shows "Monthly Unlimited" / "Безлимитный". It shows name, student number, status, expiry, and the days-remaining bar. `plan` and quota fields were removed from the type, guards, and mock server. `parseMembership` drops those fields from records written by older builds.
- "Expires" got its own locale key (`membership.expiresLabel`). Rendering `expiresOn` with an empty date broke Turkish and Kazakh.
- Simulated receipt extraction was deleted. `receiptParser.ts` calls the native `ExpoOcrKit` module directly. Do not import the package entry `expo-ocr-kit` from app code: that entry also registers an unused native view and crashes when the view is missing.
- `receiptTextParser.ts` is pure and has no native imports. It rebuilds rows from block positions so a two-column slip still pairs a label with its value. It extracts name, digits-only student number, a strict date, and a reference. Unconfident fields are left blank. The bound profile is only used to recognize a value that is already in the text, never to fill a field the image does not show.
- A scan with no reference throws `ReceiptScanError` code `NO_REFERENCE` and never opens the verify modal. Other codes: `OCR_UNAVAILABLE`, `UNREADABLE_IMAGE`, `NO_TEXT`.
- `android.blockedPermissions` removes `RECORD_AUDIO`. The OCR config plugin reuses the camera permission string.

### 4. EAS install failure (`38eb06e`)

The user ran `eas build --profile development`. It failed in Install dependencies:

`npm ci` can only install packages when package.json and package-lock.json are in sync. Missing: `react-native-worklets@0.10.4` from lock file.

Cause: the lockfile was written by npm 11. EAS uses npm 10.9.8. `expo-dev-client` pulled an optional peer that npm 11 recorded differently. Regenerating the lockfile with npm 10.9.8 fixed `npm ci`. `eas-build-post-install` deletes `node_modules/expo-ocr-kit/android/build` because that package ships another machine's Gradle outputs.

`expo-dev-client` was installed only because the development profile asked for it. Friend installs must use `preview`, not `development`.

### 5. First real dekont was rejected (`49da876`)

Uploading the İş Bankası slip showed "The receipt reference number could not be read clearly." OCR had returned text. The parser only accepted letter-prefixed ids such as `RCP-482913`. The bank reference `07.10.2026/3835/4/13` did not match, and `withoutDates` stripped the date off the front of it before the reference check.

Fix: detect `DD.MM.YYYY/seq/n/n` before date stripping. Read `Açıklama` as `digits + name`. Do not treat `işlem` or `dekont` as reference labels. They sit on "İşlem Tarihi" and the title and steal the wrong line.

### 6. Date left blank, reference scrambled (`d700532`)

On a later scan the modal showed name `MAXAT KALIYEV` and number `23141035`, an empty payment date, and reference `97-19-2826-5333-4-13`. The printed value was `07.10.2026/5805/4/13`. ML Kit read `0` as `9` or `8` (`07` → `97`, `10` → `19`, `2026` → `2826`) and the sequence `5805` as `5333`. Typing `20261007` then failed with "Payment date must be in YYYY-MM-DD format" because the field required dashes, and on Android the keyboard covered the field (`KeyboardAvoidingView` was iOS-only).

Fixes:

- Digit confusion repair in `receiptTextParser.ts`. An 8-digit day-month-year that is not a real date is searched for a real date inside the 7-day window, changing as few digits as possible, and only to known confusions. `97192826` uniquely becomes `2026-10-07` on 7 Oct 2026. The date prefix of the reference is snapped to `İşlem Tarihi` when the distance is at most 4. The sequence after the slashes is not guessed. Inventing `5805` from `5333` would create a different receipt id.
- If two OCR passes disagree, the pass whose date prefix needed fewer corrections wins.
- The right-hand column is cropped and scanned again so those digits are larger.
- `maskPaymentDateInput` in `dateUtils.ts` turns `20261007` into `2026-10-07` as the user types, and turns a pasted `07.10.2026` around. The verify sheet uses the keyboard height to stay above the keyboard.

### 7. Same receipt failed on a friend's Nothing Phone and on an emulator (`be7d098`)

The APK `42b88e73` worked on the owner's phone and failed for a friend. Videos showed both devices uploading a photo of the receipt displayed on a screen: a short white band with a large black area above and below. Error text was again "The receipt reference number could not be read clearly." The owner's successful scans are photos where the paper fills the frame, so the digits stay large. ML Kit downsamples the whole image to about 2000px, which makes a letterboxed slip unreadable. The right-column crop of that full frame also misses the paper, because the paper is not on the right edge of the black image.

Fix: `paperFrame.ts` finds the pale rectangle in a downscaled preview (`jpeg-js`). `focusOnPaper` in `receiptParser.ts` crops the original to that rectangle and enlarges it before OCR. If the paper already covers more than about 90% of the photo, the original file is used and is not recompressed. The reference-column crop then runs on that focused image, not on the letterboxed original.

The friend must install a build that contains `be7d098`. The previous APK does not.

## APK builds

| Build id | What it contains | Result |
|---|---|---|
| `7c82e7b7-64f3-4c4c-8d4f-0a5f3803c12d` | development profile | Failed. npm 10 lockfile mismatch. |
| `1c6852e2-fa02-4052-b2e0-0184cbd52a40` | preview, after the lockfile fix | Superseded. |
| `015e40d5-79b7-46f1-8a83-9bb287fb3a40` | preview, İş Bankası reference parsing | Installed by the owner. Scanned a full-frame paper photo successfully, with a scrambled date until the next build. |
| `42b88e73-f649-4309-9e2b-b672b02965eb` | preview, date repair and date-field mask | Works on the owner's phone. Fails on letterboxed screen photos. This is the file the friend installed from Downloads. |
| `91549ba9-aab7-4796-a1c5-5a7a058ab9f8` | preview, paper crop (`be7d098`) | The build to send. Finished successfully. |

Install page for the paper-crop APK: `https://expo.dev/accounts/winnaxl/projects/unigym/builds/91549ba9-aab7-4796-a1c5-5a7a058ab9f8`

There is no `expo-updates` setup, so a JS fix does not reach an installed APK until a new EAS build. `expo-image-manipulator` is native and also requires a new build.

Build command:

```bash
npx eas-cli@24.11.0 build --platform android --profile preview --non-interactive --wait
```

## Files that matter

- `src/services/receiptParser.ts` — native OCR, paper crop, reference-column crop, error codes.
- `src/services/receiptTextParser.ts` — pure field extraction, İş Bankası reference, digit repair.
- `src/services/paperFrame.ts` — pale-rectangle detection. No native imports.
- `src/services/api/mockServerState.ts` — serialized ledger and membership.
- `src/services/api/receiptRules.ts` — server-side normalization. Client code must not use it to grant access.
- `src/utils/referenceId.ts` — canonical reference spelling, shared by parser and server.
- `src/utils/studentNumber.ts` — digit rules and `STD` migration.
- `src/utils/dateUtils.ts` — `maskPaymentDateInput`.
- `src/components/scanner/ReceiptScannerFlow.tsx` — camera, gallery, verify modal.
- `eas.json` — `preview` is the shareable APK profile.

## Checks that were run

There is no committed test runner. Parser behavior was checked with short-lived Node scripts that import the TypeScript directly, then deleted. Cases that passed include İş Bankası label layouts, two-column blocks, garbled `97.19.2826` repairing to `2026-10-07`, a clearer second reading of the sequence winning over `5333`, a letterboxed paper rectangle being found, and a full-frame white image being left uncropped. `npx tsc --noEmit` and `npx expo lint` were clean apart from the existing i18next warning in `src/core/i18n.ts`.

## Still true, and easy to get wrong

- Do not unlock the reference field. A student who can type a new reference can redeem one slip many times. If OCR cannot see a reference, the scan fails on purpose.
- Do not "correct" the bank sequence by brute force. Only the date prefix is repaired, and only inside the 7-day window with known digit confusions.
- Cyrillic names still will not OCR reliably.
- A doctored image with an unused reference still gets through this client. Only a backend that checks references against bank records can stop that.
- The mock ledger is still stored on the device. Resetting the profile does not wipe it, on purpose.
- Dates in the UI are still formatted in English in every language.
- EAS queue times have been long, sometimes hours. A failed build log is brotli-compressed. Download it with `curl` and decompress with `zlib.brotliDecompressSync`. PowerShell `Invoke-WebRequest` corrupts that body.
- Do not run `npx expo install --fix` unless the user asked. It moves dependency versions. `expo-ocr-kit` was installed with `npx expo install` because it had to match SDK 57.
