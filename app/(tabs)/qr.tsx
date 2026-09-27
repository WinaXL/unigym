// app/(tabs)/qr.tsx  — Rotating QR Entry Pass Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useQrToken } from '../../src/hooks/useQrToken';
import { useMembership } from '../../src/hooks/useMembership';
import { hapticService } from '../../src/services/hapticService';
import { Typography, Spacing, BorderRadius, Colors } from '../../src/theme';
import { secondsUntil } from '../../src/utils/dateUtils';
import { useThemeStore } from '../../src/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

export default function QrScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const { data: qrToken, isLoading, isError, refetch, isFetching } = useQrToken();
  const { data: membership } = useMembership();

  // Countdown timer
  useEffect(() => {
    if (!qrToken) return;
    const update = () => {
      const s = secondsUntil(qrToken.rotatesAt);
      setSecondsLeft(s);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [qrToken]);

  const isWarning = secondsLeft <= 5;
  const progressPercent = (secondsLeft / 30) * 100;

  const isActiveMembership = membership?.status === 'active';

  if (!isActiveMembership && membership) {
    return (
      <SafeScreen>
        <View style={styles.centered}>
          <Text style={styles.noMemberIcon}>🚫</Text>
          <Text style={[styles.noMemberTitle, { color: colors.textPrimary }]}>
            {t('qr.noMembership')}
          </Text>
          <Text style={[styles.noMemberDesc, { color: colors.textSecondary }]}>
            {t('qr.noMembershipDesc')}
          </Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen noPadding>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Title */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('qr.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('qr.subtitle')}</Text>
        </View>

        {/* QR Container */}
        <View style={[styles.qrContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {isLoading || isFetching ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : isError ? (
            <TouchableOpacity style={styles.loadingBox} onPress={() => refetch()}>
              <Ionicons name="refresh-circle" size={48} color={colors.primary} />
              <Text style={[styles.tapRefresh, { color: colors.textSecondary }]}>
                {t('qr.tapToRefresh')}
              </Text>
            </TouchableOpacity>
          ) : qrToken ? (
            <QRCode
              value={qrToken.token}
              size={220}
              color={resolvedTheme === 'dark' ? '#FFFFFF' : '#000000'}
              backgroundColor={resolvedTheme === 'dark' ? Colors.dark.surface : Colors.light.surface}
              quietZone={12}
            />
          ) : null}
        </View>

        {/* Countdown Bar */}
        {qrToken && !isLoading && (
          <View style={styles.countdownSection}>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSubtle }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: isWarning ? colors.warning : colors.primary,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.countdownText,
                { color: isWarning ? colors.warning : colors.textSecondary },
              ]}
            >
              {t('qr.rotatesIn', { seconds: secondsLeft })}
            </Text>
          </View>
        )}

        {/* Security note */}
        <View style={[styles.secureNote, { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
          <Text style={[styles.secureText, { color: colors.textSecondary }]}>
            {t('qr.secureNote')}
          </Text>
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
    gap: Spacing[8],
  },
  header: {
    alignItems: 'center',
    gap: Spacing[2],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
  },
  qrContainer: {
    padding: Spacing[6],
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
  },
  tapRefresh: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  countdownSection: {
    width: '100%',
    gap: Spacing[2],
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  countdownText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4],
  },
  secureText: {
    fontSize: Typography.fontSize.xs,
    flex: 1,
    lineHeight: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
  },
  noMemberIcon: {
    fontSize: 56,
  },
  noMemberTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  noMemberDesc: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
});
