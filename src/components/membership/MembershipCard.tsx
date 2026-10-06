// src/components/membership/MembershipCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge';
import { Typography, Spacing, BorderRadius } from '../../theme';
import type { Membership } from '../../types/membership';
import { formatDate } from '../../utils/dateUtils';
import { useThemeStore } from '../../stores/themeStore';
import { Colors } from '../../theme/colors';

interface MembershipCardProps {
  membership: Membership;
  studentName: string;
  studentId: string;
}

export function MembershipCard({ membership, studentName, studentId }: MembershipCardProps) {
  const { t } = useTranslation();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const gradientColors = [
    Colors[resolvedTheme].cardGradientStart,
    Colors[resolvedTheme].cardGradientEnd,
  ] as [string, string];

  const statusVariant =
    membership.status === 'active' ? 'success' :
    membership.status === 'expired' ? 'error' :
    membership.status === 'suspended' ? 'warning' : 'neutral';

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Member & status */}
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={2}>{studentName}</Text>
          <Text style={styles.studentId}>{studentId}</Text>
        </View>
        <Badge
          label={t(`membership.status${membership.status.charAt(0).toUpperCase() + membership.status.slice(1)}` as any)}
          variant={statusVariant}
        />
      </View>

      {/* Expiry */}
      <View style={styles.expirySection}>
        <Text style={styles.metaLabel}>{t('membership.expiresLabel')}</Text>
        <Text style={styles.metaValue}>{formatDate(membership.expiryDate)}</Text>
      </View>

      {/* Days remaining bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(0, Math.min(100, (membership.daysRemaining / 30) * 100))}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.daysText}>
          {t('dashboard.daysRemaining', { count: membership.daysRemaining })}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[6],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing[3],
    marginBottom: Spacing[6],
  },
  identity: {
    flex: 1,
  },
  name: {
    fontSize: Typography.fontSize.xl,
    color: '#FFFFFF',
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.3,
  },
  studentId: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
    fontWeight: Typography.fontWeight.medium,
    letterSpacing: 1,
  },
  expirySection: {
    marginBottom: Spacing[4],
  },
  metaLabel: {
    fontSize: Typography.fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: Typography.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: Typography.fontSize.sm,
    color: '#FFFFFF',
    fontWeight: Typography.fontWeight.semibold,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.full,
  },
  daysText: {
    fontSize: Typography.fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: Typography.fontWeight.medium,
    minWidth: 80,
    textAlign: 'right',
  },
});
