// src/hooks/useAttendance.ts
import { useHistoryStore } from '../stores/historyStore';

export function useAttendance() {
  const records = useHistoryStore((s) => s.records);
  const isLoading = useHistoryStore((s) => s.isLoading);

  return {
    data: {
      pages: [
        {
          records,
          total: records.length,
          page: 1,
          pageSize: records.length,
          hasMore: false,
        },
      ],
    },
    records,
    isLoading,
    fetchNextPage: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
  };
}
