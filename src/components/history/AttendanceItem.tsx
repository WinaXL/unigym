// src/components/history/AttendanceItem.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Typography, Spacing, BorderRadius } from '../../theme';
import type { AttendanceRecord } from '../../types/attendance';
import { formatTime } from '../../utils/dateUtils';

interface AttendanceItemProps {
  record: AttendanceRecord;
}

export function AttendanceItem({ record }: AttendanceItemProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const isActive = !record.timeOut;

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      {/* Gym icon */}
      <View style={[styles.iconContainer, { backgroundColor: isActive ? colors.primary : colors.primaryLight }]}>
        <Text style={styles.icon}>{isActive ? '🏃' : '🏋️'}</Text>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('history.gymVisit')}
        </Text>
        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
            {t('history.timeIn')}:{' '}
          </Text>
          <Text style={[styles.timeValue, { color: colors.textSecondary }]}>
            {formatTime(record.timeIn)}
          </Text>
          {record.timeOut && (
            <>
              <Text style={[styles.timeLabel, { color: colors.textTertiary }]}> → </Text>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                {t('history.timeOut')}:{' '}
              </Text>
              <Text style={[styles.timeValue, { color: colors.textSecondary }]}>
                {formatTime(record.timeOut)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Duration or Active indicator */}
      {record.durationMinutes ? (
        <Text style={[styles.duration, { color: colors.primary }]}>
          {t('history.duration', { minutes: record.durationMinutes })}
        </Text>
      ) : isActive ? (
        <View style={[styles.activeDot, { backgroundColor: colors.success }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing[3],
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  details: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: Typography.fontSize.sm,
  },
  timeValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  duration: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
