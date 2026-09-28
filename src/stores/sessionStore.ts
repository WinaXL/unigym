// src/stores/sessionStore.ts
import { create } from 'zustand';
import type { AttendanceRecord } from '../types/attendance';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../core/constants';
import { useHistoryStore } from './historyStore';

interface SessionState {
  activeSession: AttendanceRecord | null;
  isLoading: boolean;

  loadSession: () => Promise<void>;
  checkIn: (userId: string) => Promise<AttendanceRecord>;
  checkOut: () => Promise<AttendanceRecord | null>;
  clearSession: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  isLoading: true,

  loadSession: async () => {
    try {
      const data = await storage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
      if (data) {
        const record: AttendanceRecord = JSON.parse(data);
        set({ activeSession: record, isLoading: false });
        return;
      }
    } catch {
      // noop
    }
    set({ activeSession: null, isLoading: false });
  },

  checkIn: async (userId: string) => {
    const now = new Date();
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      userId,
      date: now.toISOString().split('T')[0],
      timeIn: now.toISOString(),
    };

    try {
      await storage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(record));
    } catch {
      // noop
    }

    set({ activeSession: record });
    return record;
  },

  checkOut: async () => {
    const { activeSession } = get();
    if (!activeSession) return null;

    const now = new Date();
    const timeInMs = new Date(activeSession.timeIn).getTime();
    const durationMinutes = Math.max(1, Math.round((now.getTime() - timeInMs) / 60000));

    const completed: AttendanceRecord = {
      ...activeSession,
      timeOut: now.toISOString(),
      durationMinutes,
    };

    try {
      await storage.deleteItem(STORAGE_KEYS.ACTIVE_SESSION);
    } catch {
      // noop
    }

    // Persist to history store
    await useHistoryStore.getState().addRecord(completed);

    set({ activeSession: null });
    return completed;
  },

  clearSession: async () => {
    try {
      await storage.deleteItem(STORAGE_KEYS.ACTIVE_SESSION);
    } catch {
      // noop
    }
    set({ activeSession: null });
  },
}));
