# Receipt review and UniGym branding (19 October 2026)

## Verified cause and native packaging audit

The text parser treated a clearly read date outside the seven-day payment window as an extraction failure. This also removed the date-prefixed İş Bankası reference. A receipt dated 7 October 2026 could therefore yield `NO_REFERENCE` on 19 October even when native recognition read the digits correctly. A regression reproduced this failure before the fix.

The current parser reads only the Açıklama cell's eight-digit student number
followed by a Latin name, and the İşlem Tarihi payment date. Customer numbers,
header labels, generic name labels and saved-profile hints cannot populate the
identity. Positioned blocks and raw text are both checked; conflicting readings
stay blank. Impossible date digits also stay blank instead of being repaired
against a recent-date window. These cases continue to manual review.

Reference extraction, reference UI/validation and the seven-day expiration rule
have been removed. Valid past dates of any age can activate. Future dates remain
invalid. See `workouts-and-receipts.md` for activation and repeat-verification rules.

The installed `expo-ocr-kit@0.1.4` Android Gradle file declares `com.google.mlkit:text-recognition:16.0.1`, Google's bundled Latin model, not its dynamically downloaded Play Services alternative. The native module is registered in `expo-module.config.json`; failed recognition rejects its promise rather than silently returning a fabricated reference.

The actual published preview APK for build `82ca20ea-304e-4d71-8aca-4162e9d6a4c5`, commit `4e665f910b4321849b3b0d483ae9a5f5d091ddba`, was downloaded and inspected as a ZIP/DEX archive. It contains:

- `ExpoOcrKitModule` in `classes4.dex`;
- 21 files under `assets/mlkit-google-ocr-models/`, including Latin recognition and detection models;
- `libmlkit_google_ocr_pipeline.so` for `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`.

Missing engine/model packaging is therefore not supported by that APK. There is no need to add another ML Kit library or require an initial network download. This archive inspection confirms packaging; it does not replace running ML Kit on an Android device with the two original photos.

Google's dependency documentation: https://developers.google.com/ml-kit/vision/text-recognition/v2/android

## Review behavior

After selecting a receipt image, the three-field verification form opens even
when automatic OCR is unavailable, fails, finds no text, or misses a required
detail. Confidently extracted fields are retained. A localized inline notice
explains manual entry. The adapter validates identity and payment date and owns
the resulting membership entitlement. The sheet has bottom-inset padding.

`[ReceiptOCR]` logs contain only engine availability, attempt/failure counts, recognized character count and the issue code. They never include receipt text, names, student numbers, references, or image URIs. These distinguish native failures from parsing failures in a standalone build.

## Branding

The launcher artwork is a white U/barbell mark on cobalt blue. New assets under `assets/unigym-*` replace the Expo starter references in `app.json`, including the regular icon, Android adaptive foreground, favicon and splash artwork. The adaptive layer is an opaque blue tile with the artwork padded down so the mark fits inside launcher masks. The starter monochrome and background-image overrides were removed. The original starter files are retained but no longer configured.

Artwork was produced using the built-in image generator, followed by deterministic resizing and padding for platform dimensions. The generated opaque master was selected; background-removal variants were discarded because their edges were unsuitable for launcher artwork. Final assets are `assets/unigym-icon.png`, `assets/unigym-adaptive-foreground.png` and `assets/unigym-favicon.png`.

Master artwork prompt:

> Use case: logo-brand. Asset type: production mobile launcher icon for UniGym, a university gym app. Create one polished square 1024x1024 app icon. Full-bleed deep cobalt blue background (#2563EB) with very subtle darker tonal depth. In the center, a bold white geometric U-shaped monogram integrated with a horizontal gym barbell: unmistakably a gym/strength-training mark, distinctive and extremely legible at 48 pixels. Flat graphic aesthetic, substantial clean shapes, restrained rounded corners on the glyph, no small details. The complete white mark must fit within the central 56% of the square so Android circle/squircle masks never clip it. Background fills every edge; no rounded-square container drawn into image, no outline frame, no mockup, no perspective, no text or lettering beyond the U-shaped symbol, no gradients on the white mark, no watermark. Deliver the actual icon artwork only.

## Verification and release

Run `npm test`, `npx tsc --noEmit`, and `npx expo lint`. Regression cases cover
strict Açıklama extraction, header/customer-number rejection, old/future dates,
native failures, partial review, reference-free activation, legacy migration,
repeat verification, workout day counts and translations. Native outcomes in
these tests are controlled fixtures, not device OCR accuracy measurements.

A new APK is required to test these changes on a phone because this app has no
OTA update setup. No EAS build is part of this code-only update. On the next
authorized build, test both original photos, manual entry and Android three-button
navigation on a device.

## Download filename

`app.json` already sets the installed label to UniGym. EAS's hosted application
archive URL/HTTP download name is separate from that label. Changing the app name
or `applicationArchivePath` does not configure its browser download filename.
Use a named GitHub release asset for the shared browser download:

```powershell
npm run preview:publish -- C:/path/to/finished.apk preview-<version> <full-source-commit-sha> --dry-run
# Remove --dry-run only when ready to publish that already-built APK.
```

The helper copies the existing archive to `UniGym.apk`, validates arguments, and
uses the authenticated `gh` CLI to create a prerelease at the supplied source
commit. It never builds, polls EAS, replaces an existing release or modifies the
APK contents/signature. Share the resulting GitHub `UniGym.apk` asset link;
direct EAS downloads may still have `application-...apk` names. No release is
published as part of this code-only task.

Configuration reference: https://docs.expo.dev/eas/json/#android-specific-options
GitHub release assets: https://docs.github.com/en/rest/releases/assets

If an earlier scan already bound the wrong identity (such as a customer number),
use Profile → Reset Device Profile and confirm the corrected details on a new
scan. Saved identities are not silently rewritten by OCR.
