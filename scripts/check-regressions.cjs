/* Native-free behavioral checks: node scripts/check-regressions.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { test } = require('node:test');

// Exercise the actual TypeScript modules without adding a runtime dependency.
Module._extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }, fileName: filename }).outputText, filename);
};
const memory = new Map();
let failWrites = false;
const area = {
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => { if (failWrites) throw new Error('Disk full'); memory.set(key, value); },
  deleteItem: async (key) => { memory.delete(key); },
};
const storagePath = path.resolve(__dirname, '../src/services/storage.ts');
require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true,
  exports: { storage: area, secureStorage: area } };
global.__DEV__ = false;
const { extractReceiptFields } = require('../src/services/receiptTextParser.ts');
const { findPaperFrame } = require('../src/services/paperFrame.ts');
const rules = require('../src/services/workoutRules.ts');
const { WORKOUT_PLANS } = require('../src/data/workoutPlans.ts');
const { mockServerState } = require('../src/services/api/mockServerState.ts');
const { SERVER_STATE_KEYS } = require('../src/core/constants.ts');
const { useAuthStore } = require('../src/stores/authStore.ts');
const { useWorkoutStore } = require('../src/stores/workoutStore.ts');
const { useSessionStore } = require('../src/stores/sessionStore.ts');
const { useHistoryStore } = require('../src/stores/historyStore.ts');
const { localCalendarDate } = require('../src/utils/dateUtils.ts');

test('Receipt references survive OCR separators, wrapping and incomplete blocks', () => {
  const now = new Date(2026, 9, 7, 12);
  const variants = [
    '07.10.2026/5805/4/13', '07.10.2026 / 5805 / 4 / 13',
    '07-10-2026-5805-4-13', '07.10.2026\\5805\\4\\13',
    '07.10.2026/\n5805/4/13', '07.10.2026/5805/\n4/13',
    'O7.1O.2O26/58O5/4/I3', '07.10.2026∕5805∕4∕13',
    'o7.1o.2o26/58o5/4/l3', '07.10.2026\n5805/4/13',
  ];
  for (const reference of variants) {
    const text = `Açıklama : 23141035 MAXAT KALIYEV\nİşlem Tarihi : 07.10.2026\nReferans Numarası : ${reference}`;
    const result = extractReceiptFields({ text, blocks: [{ text: 'İŞ BANKASI', boundingBox: { x: 0, y: 0, width: 80, height: 20 } }] }, {}, now);
    assert.equal(result.referenceId, '07-10-2026-5805-4-13', reference);
    assert.equal(result.studentNumber, '23141035');
    assert.equal(result.paymentDate, '2026-10-07');
  }
  const absent = extractReceiptFields({ text: 'İşlem Tarihi: 07.10.2026\nMüşteri No: 47173963\nAçıklama: 23141035 MAXAT KALIYEV', blocks: [] }, {}, now);
  assert.equal(absent.referenceId, undefined);
  const repaired = extractReceiptFields({ text: 'Referans Numarası: 97.19.2826/5333/4/13\nİşlem Tarihi: 07.10.2026', blocks: [] }, {}, now);
  assert.equal(repaired.referenceId, '07-10-2026-5333-4-13'); // Bank sequence is never guessed.
});

test('OCR extraction preserves old and future receipt dates for server validation', () => {
  const now = new Date(2026, 9, 19, 12);
  for (const [printed, iso] of [['07.10.2026', '2026-10-07'], ['20.10.2026', '2026-10-20']]) {
    const result = extractReceiptFields({
      text: `İşlem Tarihi: ${printed} 09:29:55\nReferans Numarası: ${printed}/6306/4/13\nAçıklama: 23141035 MAXAT KALIYEV`, blocks: [],
    }, {}, now);
    assert.equal(result.paymentDate, iso);
    assert.equal(result.referenceId, `${printed.replaceAll('.', '-')}-6306-4-13`);
  }
});

test('Native scan failures return an editable review with partial fields and distinct diagnostics', async () => {
  const originalLoad = Module._load;
  let native = null;
  Module._load = function (request, parent, isMain) {
    if (request === 'expo') return { requireOptionalNativeModule: () => native };
    if (request === 'expo-image-manipulator') return {
      ImageManipulator: { manipulate: () => { throw new Error('No native image preprocessing in this test'); } },
      SaveFormat: { JPEG: 'jpeg' },
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  const parserPath = require.resolve('../src/services/receiptParser.ts');
  const scan = async (value) => {
    native = value === null ? null : { recognizeText: async () => {
      if (value instanceof Error) throw value;
      return value;
    } };
    delete require.cache[parserPath];
    return require(parserPath).parseReceiptImage('file:///user-selected-receipt.jpg');
  };
  try {
    const missing = await scan(null);
    assert.equal(missing.issue, 'OCR_UNAVAILABLE');
    assert.deepEqual(missing.receipt, {});
    assert.equal(missing.diagnostics.nativeAvailable, false);
    const failed = await scan(new Error('Native recognition failed'));
    assert.equal(failed.issue, 'UNREADABLE_IMAGE');
    assert.equal(failed.diagnostics.failedPasses, 1);
    const empty = await scan({ text: '', blocks: [] });
    assert.equal(empty.issue, 'NO_TEXT');
    const partial = await scan({ text: 'Açıklama: 23141035 MAXAT KALIYEV\nİşlem Tarihi: 07.10.2026', blocks: [] });
    assert.equal(partial.issue, 'NO_REFERENCE');
    assert.equal(partial.receipt.studentNumber, '23141035');
    assert.equal(partial.receipt.paymentDate, '2026-10-07');
    assert.ok(partial.diagnostics.recognizedCharacters > 0);
    const complete = await scan({ text: 'Referans Numarası: 07.10.2026/6306/4/13', blocks: [] });
    assert.equal(complete.issue, null);
    assert.equal(complete.receipt.referenceId, '07-10-2026-6306-4-13');
  } finally {
    Module._load = originalLoad;
    delete require.cache[parserPath];
  }
});

test('Paper crop ignores screen controls and detects very short receipt bands', () => {
  const width = 480, height = 1000;
  const rgba = new Uint8Array(width * height * 4);
  const paint = (x, y, w, h, shade = 240) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const i = (row * width + col) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = shade; rgba[i + 3] = 255;
    }
  };
  paint(40, 20, 60, 18); paint(340, 940, 70, 18); // status/navigation chrome
  paint(20, 470, 440, 40, 160); // only 4% of the screenshot's height
  const frame = findPaperFrame(rgba, width, height);
  assert.ok(frame);
  assert.ok(frame.y > 450 && frame.y < 470);
  assert.ok(frame.height < 70 && frame.width >= 440);
  rgba.fill(255);
  assert.equal(findPaperFrame(rgba, width, height), null);
  rgba.fill(0);
  assert.equal(findPaperFrame(rgba, width, height), null);
  assert.equal(findPaperFrame(new Uint8Array(2), width, height), null);
});

test('Programs map chronologically, exclude Sundays, and apply grace/reset/recovery', () => {
  assert.deepEqual(WORKOUT_PLANS.map((plan) => plan.days.length), [3, 3, 4, 3]);
  const progress = { schedules: [{ effectiveFrom: '2026-10-05', planId: 'fullBody', weekdays: [1, 3, 6] }], checked: {}, completed: ['2026-10-05'] };
  assert.equal(rules.workoutOn(progress, '2026-10-05').focus, 'fullBodyA');
  assert.equal(rules.workoutOn(progress, '2026-10-07').focus, 'fullBodyB');
  assert.equal(rules.workoutOn(progress, '2026-10-10').focus, 'fullBodyC');
  assert.equal(rules.workoutOn(progress, '2026-10-11'), undefined);
  assert.deepEqual(rules.workoutStreak(progress, '2026-10-07'), { count: 1, misses: 0 }); // Today is not missed yet.
  assert.deepEqual(rules.workoutStreak(progress, '2026-10-08'), { count: 1, misses: 1 });
  assert.deepEqual(rules.workoutStreak(progress, '2026-10-11'), { count: 0, misses: 2 });
  progress.completed.push('2026-10-12');
  assert.deepEqual(rules.workoutStreak(progress, '2026-10-12'), { count: 1, misses: 0 });
  progress.completed = ['2026-10-05', '2026-10-10'];
  assert.deepEqual(rules.workoutStreak(progress, '2026-10-11'), { count: 2, misses: 0 });
  assert.ok(rules.isWorkoutProgress(progress));
  assert.equal(rules.isWorkoutProgress({ ...progress, schedules: [{ ...progress.schedules[0], weekdays: [0, 1, 3] }] }), false);
  assert.equal(rules.isWorkoutProgress({ ...progress, checked: { '2026-10-05': ['fake'] } }), false);
  progress.schedules.push({ effectiveFrom: '2026-10-13', planId: 'cardio', weekdays: [2, 4, 6] });
  assert.equal(rules.workoutOn(progress, '2026-10-12').focus, 'fullBodyA');
  assert.equal(rules.workoutOn(progress, '2026-10-13').focus, 'steadyState');
});

test('Shared references work for two students; same-student verification is idempotent', async () => {
  memory.clear();
  const paymentDate = new Date().toISOString().slice(0, 10);
  const receipt = { referenceId: 'RCP-482913', studentNumber: '23141035', studentName: 'MAXAT KALIYEV', paymentDate };
  const context = { boundStudentNumber: null, boundFullName: null };
  const results = await Promise.all([
    mockServerState.redeemReceipt(receipt, context),
    mockServerState.redeemReceipt({ ...receipt, studentNumber: '23141036', studentName: 'OTHER STUDENT' }, context),
    mockServerState.redeemReceipt(receipt, context),
  ]);
  assert.ok(results.every((result) => result.success));
  assert.equal(results[0].membership.expiryDate, results[2].membership.expiryDate);
  assert.equal(JSON.parse(memory.get(SERVER_STATE_KEYS.RECEIPT_LEDGER)).length, 2);
  const mismatch = await mockServerState.redeemReceipt(receipt, { boundStudentNumber: '23141036', boundFullName: 'OTHER STUDENT' });
  assert.equal(mismatch.error, 'ID_MISMATCH');
  const future = await mockServerState.redeemReceipt({ ...receipt, paymentDate: '2099-01-01' }, context);
  assert.equal(future.error, 'FUTURE_DATE');
  memory.set(SERVER_STATE_KEYS.RECEIPT_LEDGER, '{}');
  await assert.rejects(mockServerState.redeemReceipt(receipt, context));
});

test('Workout completion needs attendance + exercises, persists, and isolates students', async () => {
  memory.clear();
  const today = localCalendarDate(new Date());
  const day = rules.workoutWeekday(today);
  // Use the previous Monday if this check runs on a Sunday.
  const start = day === 0 ? rules.shiftWorkoutDate(today, -6) : today;
  const selected = day === 0 ? [1, 3, 5] : [...new Set([day, ...[1, 2, 3, 4, 5, 6].filter((value) => value !== day).slice(0, 2)])].sort((a, b) => a - b);
  useAuthStore.getState().setAuthenticated({ id: 'user-23141035', studentId: '23141035', fullName: 'MAXAT KALIYEV' });
  await useWorkoutStore.getState().load('user-23141035');
  await assert.rejects(useWorkoutStore.getState().choosePlan('fullBody', [0, 1, 2]));
  const progress = { schedules: [{ effectiveFrom: start, planId: 'fullBody', weekdays: selected }], checked: {}, completed: [] };
  useWorkoutStore.setState({ progress });
  assert.equal(await useWorkoutStore.getState().complete(today), false);
  if (day !== 0) {
    const workout = rules.workoutOn(progress, today);
    await Promise.all(workout.exercises.map((exercise) => useWorkoutStore.getState().toggleExercise(today, exercise.id)));
    assert.equal(await useWorkoutStore.getState().complete(today), false);
    useHistoryStore.setState({ records: [{ id: 'att-sample-fake', userId: 'user-23141035', date: today, timeIn: new Date().toISOString(), timeOut: new Date().toISOString() }] });
    assert.equal(await useWorkoutStore.getState().complete(today), false);
    useSessionStore.setState({ activeSession: { id: 'att-real', userId: 'user-23141035', date: today, timeIn: new Date().toISOString() } });
    assert.equal(await useWorkoutStore.getState().complete(today), true);
    assert.equal(await useWorkoutStore.getState().complete(today), true);
    await useWorkoutStore.getState().load('user-23141035');
    assert.deepEqual(useWorkoutStore.getState().progress.completed, [today]);
    await useWorkoutStore.getState().choosePlan('cardio', selected);
    assert.equal(rules.scheduleOn(useWorkoutStore.getState().progress, today).planId, 'fullBody');
    assert.equal(rules.scheduleOn(useWorkoutStore.getState().progress, rules.shiftWorkoutDate(today, 1)).planId, 'cardio');
    failWrites = true;
    await assert.rejects(useWorkoutStore.getState().choosePlan('fatLoss', selected));
    failWrites = false;
    assert.equal(useWorkoutStore.getState().progress.schedules.at(-1).planId, 'cardio');
  }
  useAuthStore.getState().setAuthenticated({ id: 'user-23141036', studentId: '23141036', fullName: 'OTHER STUDENT' });
  await useWorkoutStore.getState().load('user-23141036');
  assert.equal(useWorkoutStore.getState().progress.schedules.length, 0);
});

test('Workout translations cover every template, exercise and UI key', () => {
  const english = require('../src/locales/en.json');
  function keys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, item]) => typeof item === 'object' ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`]);
  }
  for (const lang of ['ru', 'tr', 'kk']) {
    const locale = require(`../src/locales/${lang}.json`);
    assert.deepEqual(keys(locale.workouts).sort(), keys(english.workouts).sort());
  }
  for (const plan of WORKOUT_PLANS) {
    assert.ok(english.workouts.plans[plan.id]);
    for (const day of plan.days) {
      assert.ok(english.workouts.focus[day.focus]);
      assert.equal(new Set(day.exercises.map((exercise) => exercise.id)).size, day.exercises.length);
      day.exercises.forEach((exercise) => assert.ok(english.workouts.exercises[exercise.id]));
    }
  }
});
