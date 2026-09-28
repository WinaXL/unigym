// app/(tabs)/index.tsx  — Dashboard / Home Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { MembershipCard } from '../../src/components/membership/MembershipCard';
import { EntryVerifiedBanner } from '../../src/components/ui/EntryVerifiedBanner';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuthStore } from '../../src/stores/authStore';
import { useMembershipStore } from '../../src/stores/membershipStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { useHistoryStore } from '../../src/stores/historyStore';
import { hapticService } from '../../src/services/hapticService';
import { Typography, Spacing, BorderRadius } from '../../src/theme';
import { getGreetingTime, formatTime } from '../../src/utils/dateUtils';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.userId);

  const { membership, isLoading: membershipLoading } = useMembershipStore();
  const { activeSession, checkIn, checkOut } = useSessionStore();
  const { records } = useHistoryStore();

  const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);
  const [checkInTimestamp, setCheckInTimestamp] = useState('');

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const greeting = t('dashboard.greeting', {
    time: getGreetingTime(t),
    name: firstName,
  });

  const totalVisits = records.length;

  async function handleCheckIn() {
    if (!userId) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setCheckInTimestamp(nowTime);
    hapticService.success();
    setShowVerifiedBanner(true);
    await checkIn(userId);
  }

  async function handleCheckOut() {
    hapticService.medium();
    await checkOut();
  }

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

        {/* Check-In / Check-Out Quick Action Bar */}
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
                  {t('history.checkedInAt', { time: formatTime(activeSession.timeIn) })}
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
              style={[styles.checkInButton, { backgroundColor: colors.surfaceSubtle }]}
              onPress={handleCheckIn}
              activeOpacity={0.8}
            >
              <Ionicons name="enter-outline" size={20} color={colors.primary} />
              <Text style={[styles.checkInText, { color: colors.textPrimary }]}>
                {t('history.checkIn')}
              </Text>
            </TouchableOpacity>
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

      {/* Staff Visual Verification Banner */}
      <EntryVerifiedBanner
        visible={showVerifiedBanner}
        onDismiss={() => setShowVerifiedBanner(false)}
        studentName={user?.fullName}
        studentNumber={user?.studentId}
        time={checkInTimestamp}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[4],
    justifyContent: 'space-between',
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
    height: 180,
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
  sessionBar: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activeSessionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing[3],
    gap: Spacing[3],
  },
  activeSessionInfo: { flex: 1, gap: 2 },
  activeSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeSessionLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  checkedInTime: {
    fontSize: Typography.fontSize.xs,
    marginLeft: 16,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
  },
  checkInText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
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
