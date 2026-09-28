// src/types/membership.ts
export type MembershipStatus = 'active' | 'expired' | 'suspended' | 'pending';
export type QuotaType = 'unlimited' | 'punch_card';

export interface Membership {
  id: string;
  userId: string;
  status: MembershipStatus;
  plan: string;           // e.g. "Monthly Unlimited", "10-Visit Pack"
  startDate: string;      // ISO 8601
  expiryDate: string;     // ISO 8601
  daysRemaining: number;
  quotaType: QuotaType;
  quotaTotal?: number;    // undefined for unlimited
  quotaUsed?: number;
  quotaRemaining?: number;
}
