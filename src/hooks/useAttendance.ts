// src/hooks/useAttendance.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { useApiAdapter } from '../services/ApiProvider';
import { useAuthStore } from '../stores/authStore';
import type { AttendancePage } from '../types/attendance';

export function useAttendance() {
  const adapter = useApiAdapter();
  const userId = useAuthStore((s) => s.userId);

  return useInfiniteQuery<AttendancePage>({
    queryKey: ['attendance', userId],
    queryFn: ({ pageParam = 1 }) =>
      adapter.getAttendanceHistory(userId!, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!userId,
  });
}
