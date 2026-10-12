# Workout and receipt update

Workout templates are in `src/data/workoutPlans.ts`. Fat loss, cardio, and full-body strength have three sessions; the body split has four. Users choose exactly that many distinct Monday–Saturday days. Sessions map to weekdays in chronological order and repeat weekly. Sunday cannot be selected.

Exercise checklists and completed workouts are stored locally per student, survive app restarts, and are removed by Reset Device Profile. A workout can only be completed on its scheduled local calendar day, after all exercises are checked and a same-day check-in or completed visit exists. Development sample visits do not qualify. Completing a workout twice has no effect. Completed workouts are locked; previous and future days are read-only.

The streak counts completed scheduled workouts. One missed scheduled day preserves the count and greys the fire with a warning. A second consecutive missed scheduled day resets the count to zero. A completion clears the warning. Rest days and Sundays have no effect. Today is not missed until the local date changes. Misses are evaluated from schedule history even if the app was closed. Program changes start tomorrow; they do not rewrite today's checklist or previous misses.

Attendance is the app's existing self-reported check-in system. It does not verify entry against the university's card readers. Workout progress has no effect on membership entitlement.

The mock adapter now allows the same receipt reference for different students. The original reference ledger is compatible: its student number is included in the comparison. Re-verification by the same student returns the existing membership successfully, without adding another 30 days. Identity, receipt-date, and reference validation still apply. The production adapter is a backend stub; an eventual backend must implement this same per-student idempotency policy.

Receipt preprocessing now chooses a connected pale paper region, including short letterboxed bands, rather than joining every bright row/column in a screen capture. The OCR preview's long edge is bounded. The parser supplements positional blocks with raw text, handles references wrapped across lines and alternate separators, and folds unambiguous O/0 and I/1 shapes within numeric references. It does not guess a different bank sequence.

Routes were moved from `app/` to `src/app/` to follow the repository's AGENTS.md. Route URLs are unchanged.

## Verification

Run `npm test`, `npx tsc --noEmit`, and `npx expo lint`. The native-free regression checks cover OCR text layouts, connected-paper detection, shared receipts and repeat verification, schedule/streak rules, persistence failure, attendance gating, student isolation, and locale coverage.

Native ML Kit/Vision recognition must still be checked on Android/iOS with the original receipt images, particularly the affected phone's gallery image. The provided failure-dialog screenshot is not a receipt image and cannot verify OCR accuracy. No new native dependency was added. Installed APKs require a new build because this app has no OTA updates configured:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Use the preview APK when sharing with a friend.
