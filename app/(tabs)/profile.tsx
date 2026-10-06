// app/(tabs)/profile.tsx  — Profile & Settings Screen
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as LocalAuthentication from 'expo-local-authentication';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuthStore } from '../../src/stores/authStore';
import { useMembershipStore } from '../../src/stores/membershipStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { useHistoryStore } from '../../src/stores/historyStore';
import { useSecurityStore } from '../../src/stores/securityStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { LanguageOptions } from '../../src/components/ui/LanguageOptions';
import { hapticService } from '../../src/services/hapticService';
import { storage } from '../../src/services/storage';
import { Typography, Spacing, BorderRadius } from '../../src/theme';
import { STORAGE_KEYS, APP_VERSION } from '../../src/core/constants';
import { Ionicons } from '@expo/vector-icons';

type ThemeOption = 'light' | 'dark' | 'system';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const user = useAuthStore((s) => s.user);
  const themePreference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const biometricEnabled = useSecurityStore((s) => s.biometricEnabled);
  const biometricAvailable = useSecurityStore((s) => s.biometricAvailable);
  const setBiometricEnabled = useSecurityStore((s) => s.setBiometricEnabled);

  async function handleThemeChange(theme: ThemeOption) {
    hapticService.light();
    setPreference(theme);
    await storage.setItem(STORAGE_KEYS.THEME, theme).catch(() => {});
  }

  async function handleBiometricToggle(val: boolean) {
    // Prove the user can satisfy the lock before enabling it, so the toggle
    // cannot leave them shut out of their own app.
    if (val) {
      if (!biometricAvailable || Platform.OS === 'web') return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('auth.biometricPrompt'),
        cancelLabel: t('common.cancel'),
        fallbackLabel: t('auth.biometricFallback'),
      }).catch(() => ({ success: false }));
      if (!result.success) return;
    }
    hapticService.medium();
    await setBiometricEnabled(val);
  }

  function handleResetDeviceProfile() {
    Alert.alert(
      t('profile.resetConfirmTitle'),
      t('profile.resetConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.resetConfirmYes'),
          style: 'destructive',
          onPress: async () => {
            hapticService.heavy();
            // Clears client-side state only. The spent-receipt ledger is server
            // state and is deliberately left intact: resetting the device must
            // not hand back receipts that have already been redeemed.
            await useAuthStore.getState().clearAuth();
            await useMembershipStore.getState().resetMembership();
            await useSessionStore.getState().clearSession();
            await useHistoryStore.getState().resetHistory();
          },
        },
      ]
    );
  }

  const themeOptions: { value: ThemeOption; label: string; icon: string }[] = [
    { value: 'light', label: t('profile.themeLight'), icon: '☀️' },
    { value: 'dark', label: t('profile.themeDark'), icon: '🌙' },
    { value: 'system', label: t('profile.themeSystem'), icon: '⚙️' },
  ];

  return (
    <SafeScreen noPadding>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Header */}
        <View style={[styles.userHeader, { paddingHorizontal: Spacing[6] }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {user?.fullName?.charAt(0) ?? 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>
              {user?.fullName}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {user?.studentId}
            </Text>
          </View>
        </View>

        <View style={[styles.sections, { paddingHorizontal: Spacing[6] }]}>
          {/* Account Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('profile.account').toUpperCase()}
            </Text>
            <Card noPadding>
              <SettingRow
                label={t('profile.studentNumber')}
                value={user?.studentId}
                colors={colors}
                last
              />
            </Card>
          </View>

          {/* Appearance */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('profile.appearance').toUpperCase()}
            </Text>
            <Card>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                {t('profile.theme')}
              </Text>
              <View style={styles.themeOptions}>
                {themeOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.themeButton,
                      {
                        backgroundColor:
                          themePreference === opt.value
                            ? colors.primary
                            : colors.surfaceSubtle,
                        borderColor:
                          themePreference === opt.value ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleThemeChange(opt.value)}
                  >
                    <Text style={styles.themeIcon}>{opt.icon}</Text>
                    <Text
                      style={[
                        styles.themeLabel,
                        {
                          color:
                            themePreference === opt.value ? '#FFFFFF' : colors.textSecondary,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {/* Language */}
            <Card>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                {t('profile.language')}
              </Text>
              <LanguageOptions />
            </Card>
          </View>

          {/* Security */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('profile.security').toUpperCase()}
            </Text>
            <Card noPadding>
              <View style={[styles.settingRow, styles.settingRowFull]}>
                <View style={styles.settingContent}>
                  <Ionicons
                    name="finger-print"
                    size={20}
                    color={biometricAvailable ? colors.primary : colors.textTertiary}
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                      {t('profile.biometric')}
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                      {biometricAvailable
                        ? t('profile.biometricDesc')
                        : t('profile.biometricNotAvailable')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  disabled={!biometricAvailable}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </Card>
          </View>

          {/* Reset Device Profile */}
          <Button
            label={t('profile.resetProfile')}
            onPress={handleResetDeviceProfile}
            variant="danger"
            size="lg"
            style={styles.logoutButton}
            haptic="heavy"
          />

          {/* Version */}
          <Text style={[styles.version, { color: colors.textTertiary }]}>
            {t('profile.version', { version: APP_VERSION })}
          </Text>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

function SettingRow({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value?: string;
  colors: any;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.settingRow,
        { borderBottomColor: colors.border },
        !last && styles.settingRowBorder,
      ]}
    >
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textPrimary }]}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: Spacing[6],
    paddingBottom: Spacing[12],
    gap: Spacing[6],
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    marginBottom: Spacing[2],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  sections: {
    gap: Spacing[4],
  },
  section: {
    gap: Spacing[2],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[5],
  },
  settingRowFull: {
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[5],
  },
  settingRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    flex: 1,
  },
  settingText: { flex: 1 },
  rowLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
  },
  rowValue: {
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  settingLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    marginBottom: Spacing[3],
  },
  themeOptions: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  themeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  themeIcon: {
    fontSize: 20,
  },
  themeLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  logoutButton: {
    marginTop: Spacing[2],
  },
  version: {
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
    marginTop: Spacing[2],
  },
});
