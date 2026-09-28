// app/(tabs)/index.tsx  — Dashboard / Home Screen
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { Card } from '../../src/components/ui/Card';
import { MembershipCard } from '../../src/components/membership/MembershipCard';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuthStore } from '../../src/stores/authStore';
import { useMembership } from '../../src/hooks/useMembership';
import { useAttendance } from '../../src/hooks/useAttendance';
import { hapticService } from '../../src/services/hapticService';
import { Typography, Spacing, BorderRadius } from '../../src/theme';
import { getGreetingTime } from '../../src/utils/dateUtils';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: membership, isLoading: membershipLoading } = useMembership();
  const { data: attendance } = useAttendance();

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const greeting = t('dashboard.greeting', {
    time: getGreetingTime(t),
    name: firstName,
  });

  const totalVisits =
    attendance?.pages?.flatMap((p) => p.records).length ?? 0;

  function handleScanPress() {
    hapticService.medium();
    router.push('/(tabs)/scan');
  }

  return (
    <SafeScreen noPadding>
      <View style={[styles.container, { paddingHorizontal: Spacing[6] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting}</Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('dashboard.title')}
            </Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0) ?? 'U'}
            </Text>
          </View>
        </View>

        {/* Membership Card */}
        <View style={styles.cardSection}>
          {membershipLoading ? (
            <View style={[styles.skeletonCard, { backgroundColor: colors.surfaceElevated }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : membership ? (
            <MembershipCard
              membership={membership}
              studentName={user?.fullName ?? ''}
              studentId={user?.studentId ?? ''}
            />
          ) : (
            <Card>
              <Text style={[styles.noMemberTitle, { color: colors.textPrimary }]}>
                {t('dashboard.noMembership')}
              </Text>
              <Text style={[styles.noMemberHint, { color: colors.textSecondary }]}>
                {t('dashboard.noMembershipHint')}
              </Text>
            </Card>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {membership?.daysRemaining ?? '—'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('dashboard.daysRemaining', { count: membership?.daysRemaining ?? 0 })}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.accent }]}>
              {totalVisits}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('dashboard.totalVisits')}
            </Text>
          </Card>
        </View>

        {/* Scan Receipt Button */}
        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: colors.primary }]}
          onPress={handleScanPress}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>{t('dashboard.scanReceipt')}</Text>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[4],
    justifyContent: 'flex-start',
    gap: Spacing[5],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  greeting: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  cardSection: {},
  skeletonCard: {
    height: 200,
    borderRadius: BorderRadius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMemberTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: Spacing[2],
  },
  noMemberHint: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[2],
  },
  statValue: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    textAlign: 'center',
    lineHeight: 16,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[5],
    borderRadius: BorderRadius.xl,
    marginTop: 'auto',
  },
  scanButtonText: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
