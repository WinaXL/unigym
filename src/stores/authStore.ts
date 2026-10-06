// src/stores/authStore.ts
import { create } from 'zustand';
import type { UserProfile } from '../types/auth';
import { readJsonWith, writeJson, removeKey } from '../services/persistence';
import { isUserProfile, parseStoredUserProfile } from '../services/schemas';
import { STORAGE_KEYS } from '../core/constants';

/** Raised when a bind would silently replace an already-bound identity. */
export class ProfileAlreadyBoundError extends Error {
  constructor() {
    super('A student profile is already bound to this device');
    this.name = 'ProfileAlreadyBoundError';
  }
}

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  userId: string | null;
  isLoading: boolean;
  /** True once a load attempt has completed. Guards depend on this. */
  isHydrated: boolean;

  setLoading: (loading: boolean) => void;
  setAuthenticated: (user: UserProfile) => void;
  loadProfile: () => Promise<UserProfile | null>;
  /**
   * Bind a student identity to this device.
   *
   * Binding is write-once: it throws if a different student is already bound.
   * The caller must clear the profile explicitly (via the Reset Device Profile
   * flow) to rebind, so a scan can never quietly overwrite the bound name and
   * student number.
   */
  bindProfile: (profile: UserProfile) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  userId: null,
  isLoading: true,
  isHydrated: false,

  setLoading: (loading) => set({ isLoading: loading }),

  setAuthenticated: (user: UserProfile) =>
    set({ isAuthenticated: true, user, userId: user.id, isLoading: false, isHydrated: true }),

  loadProfile: async () => {
    const outcome = await readJsonWith(STORAGE_KEYS.USER_PROFILE, parseStoredUserProfile);

    if (outcome.status === 'ok') {
      const { profile, migrated } = outcome.value;
      if (migrated) {
        // Best effort: if this write fails the migration simply reruns next launch.
        await writeJson(STORAGE_KEYS.USER_PROFILE, profile).catch(() => {});
      }
      set({
        isAuthenticated: true,
        user: profile,
        userId: profile.id,
        isLoading: false,
        isHydrated: true,
      });
      return profile;
    }

    // Unreadable profile data is removed so onboarding can start cleanly rather
    // than the app looping on a half-restored identity.
    if (outcome.status === 'corrupt') {
      await removeKey(STORAGE_KEYS.USER_PROFILE).catch(() => {});
    }

    set({
      isAuthenticated: false,
      user: null,
      userId: null,
      isLoading: false,
      isHydrated: true,
    });
    return null;
  },

  bindProfile: async (profile: UserProfile) => {
    if (!isUserProfile(profile)) {
      throw new Error('Refusing to bind a profile with an invalid student number');
    }

    const existing = get().user;
    if (existing && existing.studentId !== profile.studentId) {
      throw new ProfileAlreadyBoundError();
    }

    // Persist first: an identity the UI treats as bound must have survived the
    // write, otherwise the app forgets who it trusted on the next launch.
    await writeJson(STORAGE_KEYS.USER_PROFILE, profile);

    set({
      isAuthenticated: true,
      user: profile,
      userId: profile.id,
      isLoading: false,
      isHydrated: true,
    });
  },

  clearAuth: async () => {
    await removeKey(STORAGE_KEYS.USER_PROFILE).catch(() => {});
    set({
      isAuthenticated: false,
      user: null,
      userId: null,
      isLoading: false,
      isHydrated: true,
    });
  },
}));
