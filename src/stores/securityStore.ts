// src/stores/securityStore.ts
/**
 * App-lock state for biometric unlock.
 *
 * The biometric toggle previously only persisted a preference that nothing ever
 * read, so enabling "Biometric Unlock" changed no behaviour at all while telling
 * the user their profile was protected. This store holds the preference *and*
 * the lock state that BiometricGate enforces.
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../core/constants';

interface SecurityState {
  /** User preference: should the app require biometric unlock? */
  biometricEnabled: boolean;
  /** Device can actually perform biometric auth (hardware present + enrolled). */
  biometricAvailable: boolean;
  /** Content is hidden until the user authenticates. */
  isLocked: boolean;
  isReady: boolean;

  initialize: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  lock: () => void;
  unlock: () => void;
}

/**
 * Hardware alone is not enough: a device with a fingerprint sensor but no
 * enrolled fingerprint cannot authenticate, and offering the toggle there
 * produces a lock the user can never open.
 */
async function detectBiometricSupport(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  biometricEnabled: false,
  biometricAvailable: false,
  isLocked: false,
  isReady: false,

  initialize: async () => {
    const [available, stored] = await Promise.all([
      detectBiometricSupport(),
      storage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED).catch(() => null),
    ]);

    // Only lock when the preference is on *and* the device can satisfy it,
    // otherwise a user who removed their fingerprints would be locked out.
    const enabled = stored === 'true' && available;

    set({
      biometricAvailable: available,
      biometricEnabled: enabled,
      isLocked: enabled,
      isReady: true,
    });
  },

  setBiometricEnabled: async (enabled: boolean) => {
    if (enabled && !get().biometricAvailable) return;
    await storage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
    set({ biometricEnabled: enabled, isLocked: false });
  },

  lock: () => {
    if (get().biometricEnabled) set({ isLocked: true });
  },

  unlock: () => set({ isLocked: false }),
}));
