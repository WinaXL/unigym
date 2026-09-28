// app/(tabs)/history.tsx  — Visit History with Silent Manual Check-in/Out
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { Button } from '../../src/components/ui/Button';
import { AttendanceItem } from '../../src/components/history/AttendanceItem';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuthStore } from '../../src/stores/authStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { useHistoryStore } from '../../src/stores/historyStore';
import { hapticService } from '../../src/services/hapticService';
import { Typography, Spacing, BorderRadius } from '../../src/theme';
import { formatDateGroup, formatTime } from '../../src/utils/dateUtils';
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
  const userId = useAuthStore((s) => s.userId);

  const { records, isLoading } = useHistoryStore();
  const { activeSession, checkIn, checkOut } = useSessionStore();

  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Live timer for active workout
  useEffect(() => {
    if (!activeSession) return;
    const updateElapsed = () => {
      const now = new Date().getTime();
      const inTime = new Date(activeSession.timeIn).getTime();
      setElapsedMinutes(Math.max(1, Math.round((now - inTime) / 60000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Combine active session with past records, guaranteed duplicate-free
  const sections = useMemo(() => {
    const seen = new Set<string>();
    const uniqueRecords: AttendanceRecord[] = [];
    const sourceRecords = activeSession ? [activeSession, ...records] : records;

    for (const r of sourceRecords) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        uniqueRecords.push(r);
      }
    }

    return groupByDate(uniqueRecords, t);
  }, [records, activeSession, t]);

  async function handleCheckIn() {
    if (!userId) return;
    hapticService.success();
    await checkIn(userId);
  }

  async function handleCheckOut() {
    hapticService.medium();
    await checkOut();
  }

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

  return (
    <SafeScreen noPadding>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.date}
        renderItem={renderSection}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: Spacing[6] }}>
            {/* Title */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('history.title')}
            </Text>

            {/* Check-in / Check-out Action Card */}
            <View style={[styles.sessionBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {activeSession ? (
                <View style={styles.activeSessionContent}>
                  <View style={styles.activeSessionInfo}>
                    <View style={styles.activeSessionRow}>
                      <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.activeSessionLabel, { color: colors.textPrimary }]}>
                        {t('history.activeSession')}
                      </Text>
                    </View>
                    <Text style={[styles.checkedInTime, { color: colors.textSecondary }]}>
                      {t('history.checkedInAt', { time: formatTime(activeSession.timeIn) })} • {elapsedMinutes}m
                    </Text>
                  </View>
                  <Button
                    label={t('history.checkOut')}
                    variant="danger"
                    size="sm"
                    onPress={handleCheckOut}
                    haptic="medium"
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.checkInButton, { backgroundColor: colors.primary }]}
                  onPress={handleCheckIn}
                  activeOpacity={0.8}
                >
                  <Ionicons name="log-in-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.checkInText}>{t('history.checkIn')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>🏃</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t('history.noVisits')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {t('history.noVisitsDesc')}
            </Text>
          </View>
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
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: Spacing[4],
  },
  sessionBar: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing[5],
  },
  activeSessionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing[4],
    gap: Spacing[3],
  },
  activeSessionInfo: { flex: 1, gap: 4 },
  activeSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeSessionLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  checkedInTime: {
    fontSize: Typography.fontSize.sm,
    marginLeft: 18,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    padding: Spacing[4],
    borderRadius: BorderRadius.lg,
    margin: Spacing[3],
  },
  checkInText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    color: '#FFFFFF',
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
    paddingTop: Spacing[10],
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyDesc: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
});
