// src/stores/membershipStore.ts
import { create } from 'zustand';
import type { Membership } from '../types/membership';
import type { ReceiptData, ReceiptValidationResult } from '../types/api';
import type { UserProfile } from '../types/auth';
import { storage } from '../services/storage';
import { STORAGE_KEYS, MAX_RECEIPT_AGE_DAYS } from '../core/constants';

interface MembershipState {
  membership: Membership | null;
  usedReceiptIds: string[];
  isLoading: boolean;

  loadMembership: () => Promise<void>;
  activateOrExtend: (
    receipt: ReceiptData,
    currentProfile?: UserProfile | null
  ) => Promise<ReceiptValidationResult>;
  resetMembership: () => Promise<void>;
}

export const useMembershipStore = create<MembershipState>((set, get) => ({
  membership: null,
  usedReceiptIds: [],
  isLoading: true,

  loadMembership: async () => {
    try {
      const [memData, usedIdsData] = await Promise.all([
        storage.getItem(STORAGE_KEYS.MEMBERSHIP),
        storage.getItem(STORAGE_KEYS.USED_RECEIPT_IDS),
      ]);

      let membership: Membership | null = null;
      let usedReceiptIds: string[] = [];

      if (memData) {
        membership = JSON.parse(memData);
        // Recalculate remaining days on app load
        if (membership && membership.expiryDate) {
          const now = new Date();
          const exp = new Date(membership.expiryDate);
          const daysRemaining = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          membership.daysRemaining = daysRemaining;
          membership.status = daysRemaining > 0 ? 'active' : 'expired';
        }
      }

      if (usedIdsData) {
        usedReceiptIds = JSON.parse(usedIdsData);
      }

      set({ membership, usedReceiptIds, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  activateOrExtend: async (receipt: ReceiptData, currentProfile?: UserProfile | null) => {
    const { membership, usedReceiptIds } = get();

    const refId = receipt.referenceId?.trim().toUpperCase();
    if (!refId) {
      return { success: false, receipt, error: 'GENERIC' };
    }

    // 1. Anti-fraud duplicate prevention
    if (usedReceiptIds.includes(refId)) {
      return { success: false, receipt, error: 'ALREADY_USED' };
    }

    // 2. Ownership check if profile is already bound
    if (currentProfile) {
      const receiptName = receipt.studentName?.trim().toLowerCase() ?? '';
      const profileName = currentProfile.fullName.trim().toLowerCase();
      const receiptId = receipt.studentNumber?.trim().toUpperCase() ?? '';
      const profileId = currentProfile.studentId.trim().toUpperCase();

      const nameMatches =
        receiptName.includes(profileName) || profileName.includes(receiptName);
      const idMatches = receiptId ? receiptId === profileId : true;

      if (!nameMatches && !idMatches) {
        return { success: false, receipt, error: 'NAME_MISMATCH' };
      }
    } else {
      if (!receipt.studentName?.trim()) {
        return { success: false, receipt, error: 'NO_NAME' };
      }
    }

    // 3. Date validity check (within last 7 days)
    if (!receipt.paymentDate) {
      return { success: false, receipt, error: 'NO_DATE' };
    }

    const payDate = new Date(receipt.paymentDate);
    if (isNaN(payDate.getTime())) {
      return { success: false, receipt, error: 'NO_DATE' };
    }

    const now = new Date();
    // Milliseconds in a day
    const diffDays = Math.floor((now.getTime() - payDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > MAX_RECEIPT_AGE_DAYS || diffDays < -1) {
      return { success: false, receipt, error: 'DATE_EXPIRED' };
    }

    // 4. Calculate subscription expiry (30 days from payment date or extension from current expiry)
    let baseExpiry = new Date(payDate);
    if (
      membership &&
      membership.status === 'active' &&
      new Date(membership.expiryDate) > payDate
    ) {
      baseExpiry = new Date(membership.expiryDate);
    }
    const newExpiry = new Date(baseExpiry);
    newExpiry.setDate(newExpiry.getDate() + 30);

    const daysRemaining = Math.max(0, Math.ceil((newExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const updatedMembership: Membership = {
      id: membership?.id ?? `mem-${Date.now()}`,
      userId: currentProfile?.id ?? `user-${Date.now()}`,
      status: 'active',
      plan: receipt.planType || 'Monthly Unlimited',
      startDate: payDate.toISOString(),
      expiryDate: newExpiry.toISOString(),
      daysRemaining,
      quotaType: 'unlimited',
    };

    const newUsedIds = [refId, ...usedReceiptIds];

    try {
      await Promise.all([
        storage.setItem(STORAGE_KEYS.MEMBERSHIP, JSON.stringify(updatedMembership)),
        storage.setItem(STORAGE_KEYS.USED_RECEIPT_IDS, JSON.stringify(newUsedIds)),
      ]);
    } catch {
      // noop
    }

    set({
      membership: updatedMembership,
      usedReceiptIds: newUsedIds,
    });

    return {
      success: true,
      receipt,
      membershipExpiryDate: newExpiry.toISOString(),
    };
  },

  resetMembership: async () => {
    try {
      await Promise.all([
        storage.deleteItem(STORAGE_KEYS.MEMBERSHIP),
        storage.deleteItem(STORAGE_KEYS.USED_RECEIPT_IDS),
      ]);
    } catch {
      // noop
    }
    set({
      membership: null,
      usedReceiptIds: [],
    });
  },
}));
