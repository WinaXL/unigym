// src/stores/historyStore.ts
import { create } from 'zustand';
import type { AttendanceRecord } from '../types/attendance';
import { readJson, writeJson, removeKey } from '../services/persistence';
import { isAttendanceRecordArray, isAttendanceRecord } from '../services/schemas';
import { STORAGE_KEYS } from '../core/constants';
import { localCalendarDate } from '../utils/dateUtils';

interface HistoryState {
  records: AttendanceRecord[];
  isLoading: boolean;

  loadHistory: (userId: string | null) => Promise<void>;
  addRecord: (record: AttendanceRecord) => Promise<void>;
  resetHistory: () => Promise<void>;
}

/**
 * Sample visits so the history screen is not empty during development.
 *
 * Development only: a release build must not present fabricated visits as the
 * user's own attendance record.
 */
function generateSampleHistory(userId: string): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();

  for (let i = 1; i <= 8; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i * 2);

    const timeIn = new Date(day);
    timeIn.setHours(8 + (i % 8), 15, 0, 0);

    const duration = 45 + (i % 4) * 15;
    const timeOut = new Date(timeIn.getTime() + duration * 60_000);

    records.push({
      id: `att-sample-${userId}-${i}`,
      userId,
      date: localCalendarDate(day),
      timeIn: timeIn.toISOString(),
      timeOut: timeOut.toISOString(),
      durationMinutes: duration,
    });
  }

  return records;
}

function dedupeById(records: AttendanceRecord[]): AttendanceRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  isLoading: true,

  loadHistory: async (userId: string | null) => {
    if (!userId) {
      set({ records: [], isLoading: false });
      return;
    }

    const outcome = await readJson(
      STORAGE_KEYS.ATTENDANCE_HISTORY,
      isAttendanceRecordArray
    );

    if (outcome.status === 'ok') {
      // Scoped to the bound student. Without this filter, re-binding the device
      // to a different student number showed the previous student's visits.
      const records = dedupeById(
        outcome.value.filter((record) => record.userId === userId)
      );
      set({ records, isLoading: false });
      return;
    }

    if (outcome.status === 'corrupt') {
      await removeKey(STORAGE_KEYS.ATTENDANCE_HISTORY).catch(() => {});
    }

    if (__DEV__) {
      const sample = generateSampleHistory(userId);
      try {
        await writeJson(STORAGE_KEYS.ATTENDANCE_HISTORY, sample);
      } catch {
        // Sample data is a convenience; failing to persist it is not an error.
      }
      set({ records: sample, isLoading: false });
      return;
    }

    set({ records: [], isLoading: false });
  },

  addRecord: async (record: AttendanceRecord) => {
    if (!isAttendanceRecord(record)) return;

    const updated = dedupeById([record, ...get().records]);

    // Persist before publishing so a visit shown in the UI is one that survived
    // the write.
    await writeJson(STORAGE_KEYS.ATTENDANCE_HISTORY, updated);
    set({ records: updated });
  },

  resetHistory: async () => {
    await removeKey(STORAGE_KEYS.ATTENDANCE_HISTORY).catch(() => {});
    set({ records: [] });
  },
}));
