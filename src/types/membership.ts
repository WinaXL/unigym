// src/types/membership.ts
export type MembershipStatus = 'active' | 'expired' | 'suspended' | 'pending';

/** The gym has a single access level, so a membership is just a validity window. */
export interface Membership {
  id: string;
  userId: string;
  status: MembershipStatus;
  startDate: string;      // ISO 8601
  expiryDate: string;     // ISO 8601
  daysRemaining: number;
}
