// src/hooks/useMembership.ts
import { useQuery } from '@tanstack/react-query';
import { useApiAdapter } from '../services/ApiProvider';
import { useAuthStore } from '../stores/authStore';
import type { Membership } from '../types/membership';

export function useMembership() {
  const adapter = useApiAdapter();
  const userId = useAuthStore((s) => s.userId);

  return useQuery<Membership>({
    queryKey: ['membership', userId],
    queryFn: () => adapter.getMembership(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
