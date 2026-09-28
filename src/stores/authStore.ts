// src/stores/authStore.ts
import { create } from 'zustand';
import type { UserProfile } from '../types/auth';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../core/constants';

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  userId: string | null;
  isLoading: boolean;

  setLoading: (loading: boolean) => void;
  setAuthenticated: (user: UserProfile) => void;
  loadProfile: () => Promise<UserProfile | null>;
  bindProfile: (profile: UserProfile) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  userId: null,
  isLoading: true,

  setLoading: (loading) => set({ isLoading: loading }),

  setAuthenticated: (user: UserProfile) =>
    set({ isAuthenticated: true, user, userId: user.id, isLoading: false }),

  loadProfile: async () => {
    try {
      const data = await storage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (data) {
        const profile: UserProfile = JSON.parse(data);
        set({
          isAuthenticated: true,
          user: profile,
          userId: profile.id,
          isLoading: false,
        });
        return profile;
      }
    } catch {
      // noop
    }
    set({
      isAuthenticated: false,
      user: null,
      userId: null,
      isLoading: false,
    });
    return null;
  },

  bindProfile: async (profile: UserProfile) => {
    try {
      await storage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch {
      // noop
    }
    set({
      isAuthenticated: true,
      user: profile,
      userId: profile.id,
      isLoading: false,
    });
  },

  clearAuth: async () => {
    try {
      await storage.deleteItem(STORAGE_KEYS.USER_PROFILE);
    } catch {
      // noop
    }
    set({
      isAuthenticated: false,
      user: null,
      userId: null,
      isLoading: false,
    });
  },
}));
