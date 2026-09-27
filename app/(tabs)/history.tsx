// app/(tabs)/history.tsx  — Visit History Screen
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { AttendanceItem } from '../../src/components/history/AttendanceItem';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAttendance } from '../../src/hooks/useAttendance';
import { Typography, Spacing } from '../../src/theme';
import { formatDateGroup } from '../../src/utils/dateUtils';
import type { AttendanceRecord } from '../../src/types/attendance';

type Section = { date: string; records: AttendanceRecord[] };

function groupByDate(records: AttendanceRecord[], t: (k: string) => string): Section[] {
  const map = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const existing = map.get(r.date) ?? [];
    existing.push(r);
    map.set(r.date, existing);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, recs]) => ({ date: formatDateGroup(date, t), records: recs }));
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAttendance();

  const sections = useMemo(() => {
    const allRecords = data?.pages?.flatMap((p) => p.records) ?? [];
    return groupByDate(allRecords, t);
  }, [data, t]);

  function renderSection({ item }: { item: Section }) {
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          {item.date}
        </Text>
        {item.records.map((record) => (
          <AttendanceItem key={record.id} record={record} />
        ))}
      </View>
    );
  }

  if (isLoading) {
    return (
      <SafeScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeScreen>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeScreen>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('history.title')}
          </Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🏃</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t('history.noVisits')}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {t('history.noVisitsDesc')}
          </Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen noPadding>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.date}
        renderItem={renderSection}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={[styles.header, { paddingHorizontal: Spacing[6] }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('history.title')}
            </Text>
          </View>
        }
        ListFooterComponent={
          hasNextPage ? (
            <TouchableOpacity
              style={[styles.loadMore, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                  Load more
                </Text>
              )}
            </TouchableOpacity>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: Spacing[10],
    paddingTop: Spacing[6],
  },
  header: {
    marginBottom: Spacing[4],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.5,
  },
  section: {
    paddingHorizontal: Spacing[6],
    marginBottom: Spacing[4],
  },
  sectionHeader: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing[2],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyDesc: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
  loadMore: {
    margin: Spacing[6],
    padding: Spacing[4],
    borderRadius: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
});
