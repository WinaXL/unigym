// src/hooks/useMembership.ts
import { useMembershipStore } from '../stores/membershipStore';

export function useMembership() {
  const membership = useMembershipStore((s) => s.membership);
  const isLoading = useMembershipStore((s) => s.isLoading);

  return {
    data: membership,
    isLoading,
  };
}
