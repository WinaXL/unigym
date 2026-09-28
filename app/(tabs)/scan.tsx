// app/(tabs)/scan.tsx  — Receipt Scanner & Payment Verification Screen
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { ReceiptScannerFlow } from '../../src/components/scanner/ReceiptScannerFlow';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { Typography, Spacing } from '../../src/theme';

export default function ScanScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();

  function handleSuccess() {
    router.push('/(tabs)/');
  }

  return (
    <SafeScreen noPadding>
      <View style={[styles.container, { paddingHorizontal: Spacing[6] }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('scan.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('scan.subtitle')}
          </Text>
        </View>

        <View style={styles.scannerWrapper}>
          <ReceiptScannerFlow onSuccess={handleSuccess} />
        </View>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing[8],
    paddingBottom: Spacing[6],
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[6],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
    maxWidth: 300,
  },
  scannerWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
});
