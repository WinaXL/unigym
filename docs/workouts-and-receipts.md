# Workout and receipt update

Workout templates are in `src/data/workoutPlans.ts`. Fat loss, cardio, and full-body strength have three sessions; the body split has four. Users choose exactly that many distinct Monday–Saturday days. Sessions map to weekdays in chronological order and repeat weekly. Sunday cannot be selected.

Once the required number is selected, unselected day chips are disabled; selected
chips remain available for deselection. The selector and Save button explain how
many days are still required. Switching between three- and four-day programs clears
the draft days. The store also refuses incorrect day counts.

The bottom tab bar adds the live safe-area bottom inset to its height and padding.
Receipt sheets, camera controls and other modals also account for system insets.

Exercise checklists and completed workouts are stored locally per student, survive app restarts, and are removed by Reset Device Profile. A workout can only be completed on its scheduled local calendar day, after all exercises are checked and a same-day check-in or completed visit exists. Development sample visits do not qualify. Completing a workout twice has no effect. Completed workouts are locked; previous and future days are read-only.

The streak counts completed scheduled workouts. One missed scheduled day preserves the count and greys the fire with a warning. A second consecutive missed scheduled day resets the count to zero. A completion clears the warning. Rest days and Sundays have no effect. Today is not missed until the local date changes. Misses are evaluated from schedule history even if the app was closed. Program changes start tomorrow; they do not rewrite today's checklist or previous misses.

Attendance is the app's existing self-reported check-in system. It does not verify entry against the university's card readers. Workout progress has no effect on membership entitlement.

Receipt verification uses only student name, student number and payment date.
Different students can verify the same receipt. Re-verification of the same
student/date pair returns the existing membership without adding another 30 days.
Two payments on the same date for one student cannot be distinguished with these
three fields and count as one verification. Past dates have no age limit; invalid
and future dates are still refused. New activations add 30 days from today or
current expiry, whichever is later, so an old receipt grants usable access.
The production adapter is a backend stub and must implement the same policy.

Existing bank-reference ledger entries migrate to their date prefix without
clearing memberships. Legacy references without a calendar date remain as
history; they cannot be matched to a payment date. The ledger is no longer capped
because old payments remain eligible indefinitely.

Receipt preprocessing chooses a connected pale paper region, including short
letterboxed bands. The parser supplements positional blocks with raw text but
accepts identity only beside Açıklama. No saved-profile, customer-number, generic
name or unlabelled fallback remains. Incomplete or conflicting readings stay
blank for manual review. Impossible date digits are not repaired against today's
date. Each OCR pass is parsed separately to avoid joining unrelated crop lines.

Routes were moved from `app/` to `src/app/` to follow the repository's AGENTS.md. Route URLs are unchanged.

## Verification

Run `npm test`, `npx tsc --noEmit`, and `npx expo lint`. The native-free regression checks cover OCR text layouts, connected-paper detection, shared receipts and repeat verification, schedule/streak rules, persistence failure, attendance gating, student isolation, and locale coverage.

See `ocr-and-branding.md` for the subsequent standalone APK audit, the date-extraction fix, editable manual review and custom icon update. Native ML Kit/Vision recognition must still be checked on Android/iOS with the original receipt images. No new native dependency was added. Installed APKs require a new build because this app has no OTA updates configured:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Use the preview APK when sharing with a friend.
