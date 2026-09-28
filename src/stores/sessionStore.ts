// src/stores/sessionStore.ts
/**
 * sessionStore — Tracks the current gym workout session (check-in / check-out).
 * Also stores locally-added attendance records for the current app session.
 */
import { create } from 'zustand';
import type { AttendanceRecord } from '../types/attendance';

interface SessionState {
  /** The active check-in record (null = not checked in) */
  activeSession: AttendanceRecord | null;
  /** Locally-added records (from manual check-in/out) */
  localRecords: AttendanceRecord[];

  checkIn: (userId: string) => void;
  checkOut: () => AttendanceRecord | null;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  localRecords: [],

  checkIn: (userId: string) => {
    const now = new Date();
    const record: AttendanceRecord = {
      id: `local-${Date.now()}`,
      userId,
      date: now.toISOString().split('T')[0],
      timeIn: now.toISOString(),
      // timeOut is undefined while session is active
    };
    set({ activeSession: record });
  },

  checkOut: () => {
    const { activeSession, localRecords } = get();
    if (!activeSession) return null;

    const now = new Date();
    const timeInMs = new Date(activeSession.timeIn).getTime();
    const durationMinutes = Math.round((now.getTime() - timeInMs) / 60000);

    const completed: AttendanceRecord = {
      ...activeSession,
      timeOut: now.toISOString(),
      durationMinutes,
    };

    set({
      activeSession: null,
      localRecords: [completed, ...localRecords],
    });

    return completed;
  },

  clearSession: () => set({ activeSession: null, localRecords: [] }),
}));
