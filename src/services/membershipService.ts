// src/services/membershipService.ts
/**
 * Orchestrates receipt redemption between the UI and the adapter.
 *
 * Three ordering rules are enforced here because the UI is the wrong place for
 * them:
 *
 *  1. Validate before binding. The previous flow persisted a student identity
 *     built from typed-in fields *before* the receipt was checked, so a failed
 *     scan still permanently bound whatever name and number were entered.
 *  2. One redemption at a time. Two overlapping calls could both pass the
 *     duplicate check.
 *  3. Nothing runs until the bound identity has been read from storage, since a
 *     scan that starts mid-hydration would look unbound and skip the ownership
 *     check.
 */
import type { IApiAdapter } from './api/IApiAdapter';
import type {
  ReceiptData,
  ReceiptValidationContext,
  ReceiptValidationResult,
} from '../types/api';
import type { UserProfile } from '../types/auth';
import { useAuthStore, ProfileAlreadyBoundError } from '../stores/authStore';
import { useMembershipStore } from '../stores/membershipStore';

let redemptionInFlight = false;

export const membershipService = {
  async redeemReceipt(
    adapter: IApiAdapter,
    receipt: ReceiptData
  ): Promise<ReceiptValidationResult> {
    const auth = useAuthStore.getState();

    if (!auth.isHydrated) {
      return { success: false, receipt, error: 'NOT_READY' };
    }
    if (redemptionInFlight) {
      return { success: false, receipt, error: 'IN_PROGRESS' };
    }

    redemptionInFlight = true;
    try {
      const boundProfile = auth.user;
      const context: ReceiptValidationContext = {
        boundStudentNumber: boundProfile?.studentId ?? null,
        boundFullName: boundProfile?.fullName ?? null,
      };

      let result: ReceiptValidationResult;
      try {
        result = await adapter.validateReceipt(receipt, context);
      } catch {
        // No verdict means no grant.
        return { success: false, receipt, error: 'GENERIC' };
      }

      if (!result.success || !result.membership) {
        return result.success ? { ...result, success: false, error: 'GENERIC' } : result;
      }

      // The receipt passed, so it is now safe to bind the identity the server
      // matched it to. Only ever on first activation — rebinding requires an
      // explicit device reset.
      if (!boundProfile && result.identity) {
        const profile: UserProfile = {
          id: result.membership.userId,
          studentId: result.identity.studentNumber,
          fullName: result.identity.fullName,
        };
        try {
          await useAuthStore.getState().bindProfile(profile);
        } catch (error) {
          if (error instanceof ProfileAlreadyBoundError) {
            return { success: false, receipt, error: 'ID_MISMATCH' };
          }
          return { success: false, receipt, error: 'GENERIC' };
        }
      }

      try {
        await useMembershipStore.getState().cacheMembership(result.membership);
      } catch {
        // The server has already recorded the grant, so the redemption stands.
        // Only the local cache failed to write; refreshMembership on the next
        // launch restores it from the authoritative record.
      }

      return result;
    } finally {
      redemptionInFlight = false;
    }
  },

  /**
   * Re-read the membership from the adapter and cache it.
   *
   * This is what keeps expiry honest: standing is recomputed by the adapter
   * against its own clock rather than derived from the device clock on every
   * app load. When the call fails the cached value is left in place so the app
   * still works offline.
   */
  async refreshMembership(adapter: IApiAdapter, userId: string): Promise<void> {
    try {
      const membership = await adapter.getMembership(userId);
      await useMembershipStore.getState().cacheMembership(membership);
    } catch {
      // Offline or unreachable: keep showing the last known standing.
    }
  },
};
