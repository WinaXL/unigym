// src/stores/membershipStore.ts
/**
 * Local cache of the membership the server last told us about.
 *
 * This store deliberately contains no validation and no entitlement maths. It
 * used to decide whether a receipt was fresh, unused and owned by the right
 * student, and then compute the expiry date — all on the client, from
 * client-owned storage. That made every membership self-granted. Those rules now
 * live behind IApiAdapter.validateReceipt; the only job left here is to remember
 * the answer so the dashboard still works offline.
 */
import { create } from 'zustand';
import type { Membership } from '../types/membership';
import { readJson, writeJson, removeKey } from '../services/persistence';
import { isMembership } from '../services/schemas';
import { STORAGE_KEYS } from '../core/constants';

interface MembershipState {
  membership: Membership | null;
  isLoading: boolean;
  /** True once a load attempt has completed, successfully or not. */
  isHydrated: boolean;

  loadMembership: () => Promise<void>;
  /** Persist a verdict received from the adapter. */
  cacheMembership: (membership: Membership | null) => Promise<void>;
  resetMembership: () => Promise<void>;
}

export const useMembershipStore = create<MembershipState>((set) => ({
  membership: null,
  isLoading: true,
  isHydrated: false,

  loadMembership: async () => {
    const outcome = await readJson(STORAGE_KEYS.MEMBERSHIP, isMembership);

    // A corrupt cache is discarded rather than trusted. Nothing is lost: the
    // server record is the real one, and the next adapter call restores this.
    if (outcome.status === 'corrupt') {
      await removeKey(STORAGE_KEYS.MEMBERSHIP).catch(() => {});
    }

    set({
      membership: outcome.status === 'ok' ? outcome.value : null,
      isLoading: false,
      isHydrated: true,
    });
  },

  cacheMembership: async (membership) => {
    // Persist before publishing, so the UI never shows a membership that failed
    // to save and would disappear on the next launch.
    if (membership === null) {
      await removeKey(STORAGE_KEYS.MEMBERSHIP);
    } else {
      await writeJson(STORAGE_KEYS.MEMBERSHIP, membership);
    }
    set({ membership, isLoading: false, isHydrated: true });
  },

  resetMembership: async () => {
    await removeKey(STORAGE_KEYS.MEMBERSHIP).catch(() => {});
    set({ membership: null, isHydrated: true });
  },
}));
