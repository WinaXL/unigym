// src/stores/historyStore.ts
import { create } from 'zustand';
import type { AttendanceRecord } from '../types/attendance';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../core/constants';

interface HistoryState {
  records: AttendanceRecord[];
  isLoading: boolean;

  loadHistory: (userId?: string) => Promise<void>;
  addRecord: (record: AttendanceRecord) => Promise<void>;
  resetHistory: () => Promise<void>;
}

function generateInitialHistory(userId: string): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const now = new Date();

  for (let i = 1; i <= 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 2);
    const dateStr = d.toISOString().split('T')[0];

    const inHour = 8 + (i % 8);
    const timeIn = new Date(d);
    timeIn.setHours(inHour, 15, 0, 0);

    const duration = 45 + (i % 4) * 15;
    const timeOut = new Date(timeIn.getTime() + duration * 60 * 1000);

    records.push({
      id: `att-seed-${i}`,
      userId,
      date: dateStr,
      timeIn: timeIn.toISOString(),
      timeOut: timeOut.toISOString(),
      durationMinutes: duration,
    });
  }

  return records;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  isLoading: true,

  loadHistory: async (userId: string = 'user-001') => {
    try {
      const data = await storage.getItem(STORAGE_KEYS.ATTENDANCE_HISTORY);
      if (data) {
        const records: AttendanceRecord[] = JSON.parse(data);
        set({ records, isLoading: false });
        return;
      }
      // Seed with initial realistic records on first launch
      const seeded = generateInitialHistory(userId);
      await storage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(seeded));
      set({ records: seeded, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addRecord: async (record: AttendanceRecord) => {
    const { records } = get();
    const updated = [record, ...records];
    try {
      await storage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(updated));
    } catch {
      // noop
    }
    set({ records: updated });
  },

  resetHistory: async () => {
    try {
      await storage.deleteItem(STORAGE_KEYS.ATTENDANCE_HISTORY);
    } catch {
      // noop
    }
    set({ records: [] });
  },
}));
