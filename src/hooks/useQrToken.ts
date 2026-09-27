// src/hooks/useQrToken.ts
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useApiAdapter } from '../services/ApiProvider';
import { useAuthStore } from '../stores/authStore';
import { hapticService } from '../services/hapticService';
import { QR_ROTATION_INTERVAL_MS, QR_WARNING_THRESHOLD_MS } from '../core/constants';
import type { QrTokenPayload } from '../types/api';

export function useQrToken() {
  const adapter = useApiAdapter();
  const userId = useAuthStore((s) => s.userId);
  const warningFiredRef = useRef(false);

  const query = useQuery<QrTokenPayload>({
    queryKey: ['qrToken', userId],
    queryFn: () => adapter.generateQrToken(userId!),
    enabled: !!userId,
    refetchInterval: QR_ROTATION_INTERVAL_MS,
    staleTime: QR_ROTATION_INTERVAL_MS - 1000,
    gcTime: QR_ROTATION_INTERVAL_MS * 2,
  });

  // Fire haptic warning at T-5s before rotation
  useEffect(() => {
    if (!query.data) return;

    const { rotatesAt } = query.data;
    const timeUntilRotation = rotatesAt - Date.now();
    const warningIn = timeUntilRotation - QR_WARNING_THRESHOLD_MS;

    if (warningIn <= 0) return;

    warningFiredRef.current = false;
    const timer = setTimeout(() => {
      if (!warningFiredRef.current) {
        hapticService.warning();
        warningFiredRef.current = true;
      }
    }, warningIn);

    return () => clearTimeout(timer);
  }, [query.data]);

  return query;
}
