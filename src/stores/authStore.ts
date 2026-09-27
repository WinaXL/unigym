// src/stores/authStore.ts
import { create } from 'zustand';
import type { UserProfile } from '../types/auth';

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  userId: string | null;
  isLoading: boolean;

  setAuthenticated: (user: UserProfile) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  userId: null,
  isLoading: true,

  setAuthenticated: (user) =>
    set({ isAuthenticated: true, user, userId: user.id, isLoading: false }),

  setLoading: (loading) => set({ isLoading: loading }),

  clearAuth: () =>
    set({ isAuthenticated: false, user: null, userId: null, isLoading: false }),
}));
