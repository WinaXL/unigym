// app/(auth)/login.tsx  — Zero-Login Onboarding & Welcome Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../src/hooks/useThemeColors';
import { Card } from '../../src/components/ui/Card';
import { ReceiptScannerFlow } from '../../src/components/scanner/ReceiptScannerFlow';
import { LanguageSwitcher } from '../../src/components/ui/LanguageSwitcher';
import { hapticService } from '../../src/services/hapticService';
import { Typography, Spacing, BorderRadius } from '../../src/theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();

  const [scannerModal, setScannerModal] = useState(false);

  function handleOpenScanner() {
    hapticService.medium();
    setScannerModal(true);
  }

  function handleActivationSuccess() {
    setScannerModal(false);
    router.replace('/(tabs)/');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Language can be chosen before onboarding starts */}
        <View style={styles.topBar}>
          <LanguageSwitcher />
        </View>

        {/* Branding Hero */}
        <View style={styles.brandHero}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="barbell" size={44} color="#FFFFFF" />
          </View>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>
            {t('common.appName')}
          </Text>
          <Text style={[styles.tagline, { color: colors.primary }]}>
            {t('welcome.subtitle')}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('welcome.description')}
          </Text>
        </View>

        {/* Value Proposition Cards */}
        <View style={styles.features}>
          <Card style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="flash-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
                {t('welcome.featureZeroLoginTitle')}
              </Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                {t('welcome.featureZeroLoginDesc')}
              </Text>
            </View>
          </Card>

          <Card style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="receipt-outline" size={24} color={colors.accent} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
                {t('welcome.featureReceiptTitle')}
              </Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                {t('welcome.featureReceiptDesc')}
              </Text>
            </View>
          </Card>

          <Card style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.success} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
                {t('welcome.featureOfflineTitle')}
              </Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                {t('welcome.featureOfflineDesc')}
              </Text>
            </View>
          </Card>
        </View>

        {/* Primary CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleOpenScanner}
            activeOpacity={0.8}
          >
            <Ionicons name="scan-outline" size={26} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {t('welcome.activateViaReceipt')}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.hintText, { color: colors.textTertiary }]}>
            {t('welcome.noCredentials')}
          </Text>
        </View>
      </ScrollView>

      {/* Embedded Scanner Modal */}
      <Modal
        visible={scannerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setScannerModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('scan.title')}
            </Text>
            <TouchableOpacity
              onPress={() => setScannerModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, padding: Spacing[6] }}>
            <ReceiptScannerFlow
              onSuccess={handleActivationSuccess}
              onCancel={() => setScannerModal(false)}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing[6],
    justifyContent: 'space-between',
    gap: Spacing[6],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: -Spacing[4],
  },
  brandHero: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing[4],
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: Spacing[3],
  },
  description: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  features: {
    gap: Spacing[3],
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    padding: Spacing[4],
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
  },
  featureDesc: {
    fontSize: Typography.fontSize.xs,
    lineHeight: 16,
  },
  ctaSection: {
    gap: Spacing[3],
    alignItems: 'center',
    paddingBottom: Spacing[4],
  },
  primaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[5],
    borderRadius: BorderRadius.xl,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  hintText: {
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
});
