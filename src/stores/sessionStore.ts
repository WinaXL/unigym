// src/stores/sessionStore.ts
import { create } from 'zustand';
import type { AttendanceRecord } from '../types/attendance';
import { readJson, writeJson, removeKey } from '../services/persistence';
import { isAttendanceRecord } from '../services/schemas';
import { STORAGE_KEYS } from '../core/constants';
import { useHistoryStore } from './historyStore';
import { localCalendarDate } from '../utils/dateUtils';

interface SessionState {
  activeSession: AttendanceRecord | null;
  isLoading: boolean;
  /** True while a check-in or check-out is being written. */
  isMutating: boolean;

  loadSession: () => Promise<void>;
  checkIn: (userId: string) => Promise<AttendanceRecord | null>;
  checkOut: () => Promise<AttendanceRecord | null>;
  clearSession: () => Promise<void>;
}

function newSessionId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  isLoading: true,
  isMutating: false,

  loadSession: async () => {
    const outcome = await readJson(STORAGE_KEYS.ACTIVE_SESSION, isAttendanceRecord);
    if (outcome.status === 'corrupt') {
      await removeKey(STORAGE_KEYS.ACTIVE_SESSION).catch(() => {});
    }
    set({
      activeSession: outcome.status === 'ok' ? outcome.value : null,
      isLoading: false,
    });
  },

  checkIn: async (userId: string) => {
    const { activeSession, isMutating, isLoading } = get();

    // Refuse rather than overwrite. A second check-in used to replace the first
    // session outright, so the original visit was never recorded. A double tap
    // reaches here before React has re-rendered the button, so the guard has to
    // live in the store.
    if (isMutating || isLoading || activeSession) return activeSession;

    set({ isMutating: true });
    try {
      const now = new Date();
      const record: AttendanceRecord = {
        id: newSessionId(),
        userId,
        // Local calendar date: toISOString() would file an early-morning
        // check-in under the previous day for any timezone ahead of UTC.
        date: localCalendarDate(now),
        timeIn: now.toISOString(),
      };

      await writeJson(STORAGE_KEYS.ACTIVE_SESSION, record);
      set({ activeSession: record });
      return record;
    } catch {
      return null;
    } finally {
      set({ isMutating: false });
    }
  },

  checkOut: async () => {
    const { activeSession, isMutating } = get();
    if (isMutating || !activeSession) return null;

    set({ isMutating: true });
    try {
      const now = new Date();
      const timeInMs = new Date(activeSession.timeIn).getTime();
      const durationMinutes = Math.max(
        1,
        Math.round((now.getTime() - timeInMs) / 60000)
      );

      const completed: AttendanceRecord = {
        ...activeSession,
        timeOut: now.toISOString(),
        durationMinutes,
      };

      // Record the completed visit before dropping the active session, so a
      // failure here cannot lose the visit entirely.
      await useHistoryStore.getState().addRecord(completed);
      await removeKey(STORAGE_KEYS.ACTIVE_SESSION).catch(() => {});

      set({ activeSession: null });
      return completed;
    } catch {
      return null;
    } finally {
      set({ isMutating: false });
    }
  },

  clearSession: async () => {
    await removeKey(STORAGE_KEYS.ACTIVE_SESSION).catch(() => {});
    set({ activeSession: null, isMutating: false });
  },
}));
