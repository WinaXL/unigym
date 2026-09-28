// app/(tabs)/scan.tsx  — Receipt Scanner & Payment Verification Screen
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { SafeScreen } from '../../src/components/ui/SafeScreen';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAuthStore } from '../../src/stores/authStore';
import { useApiAdapter } from '../../src/services/ApiProvider';
import { parseReceiptImage } from '../../src/services/receiptParser';
import { hapticService } from '../../src/services/hapticService';
import { Typography, Spacing, BorderRadius } from '../../src/theme';
import { queryClient } from '../../src/core/queryClient';
import { formatDate } from '../../src/utils/dateUtils';
import { Ionicons } from '@expo/vector-icons';
import type { ReceiptData } from '../../src/types/api';

type ScanState = 'idle' | 'camera' | 'processing' | 'review';

export default function ScanScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.userId);
  const adapter = useApiAdapter();

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [validating, setValidating] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Take photo with camera
  async function handleTakePhoto() {
    if (Platform.OS === 'web') {
      // On web, skip camera and use mock directly
      await processImage('mock://web-camera');
      return;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('', t('scan.cameraPermission'));
        return;
      }
    }
    setScanState('camera');
  }

  // Capture from camera
  async function handleCapture() {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          await processImage(photo.uri);
        }
      } catch {
        await processImage('mock://camera-fallback');
      }
    } else {
      await processImage('mock://camera-fallback');
    }
  }

  // Upload from gallery
  async function handleUploadGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      await processImage(result.assets[0].uri);
    }
  }

  // Process image → OCR → show review
  async function processImage(imageUri: string) {
    setScanState('processing');
    try {
      const data = await parseReceiptImage(
        imageUri,
        user?.fullName ?? '',
        user?.studentId ?? ''
      );
      setReceiptData(data);
      setScanState('review');
    } catch {
      Alert.alert('', t('scan.errorGeneric'));
      setScanState('idle');
    }
  }

  // Validate receipt and activate membership
  async function handleVerify() {
    if (!receiptData || !userId) return;
    setValidating(true);
    try {
      const result = await adapter.validateReceipt(userId, receiptData);
      if (result.success) {
        hapticService.success();
        setExpiryDate(result.membershipExpiryDate ?? '');
        // Invalidate membership query so dashboard refreshes
        queryClient.invalidateQueries({ queryKey: ['membership'] });
        setSuccessModal(true);
      } else {
        hapticService.error();
        const errorKey = `scan.error${
          result.error === 'NAME_MISMATCH' ? 'NameMismatch' :
          result.error === 'DATE_EXPIRED' ? 'DateExpired' :
          result.error === 'NO_DATE' ? 'NoDate' :
          result.error === 'NO_NAME' ? 'NoName' : 'Generic'
        }` as any;
        Alert.alert('', t(errorKey));
      }
    } catch {
      hapticService.error();
      Alert.alert('', t('scan.errorGeneric'));
    } finally {
      setValidating(false);
    }
  }

  function handleReset() {
    setScanState('idle');
    setReceiptData(null);
    setSuccessModal(false);
  }

  // ── Camera View ─────────────────────────────────────────────────────────────
  if (scanState === 'camera') {
    return (
      <SafeScreen noPadding>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          >
            <View style={styles.cameraOverlay}>
              <View style={[styles.cameraFrame, { borderColor: colors.primary }]} />
            </View>
          </CameraView>
          <View style={[styles.cameraControls, { backgroundColor: colors.background }]}>
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setScanState('idle')}
            />
            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: colors.primary }]}
              onPress={handleCapture}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <View style={{ width: 80 }} />
          </View>
        </View>
      </SafeScreen>
    );
  }

  // ── Processing State ────────────────────────────────────────────────────────
  if (scanState === 'processing') {
    return (
      <SafeScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.processingText, { color: colors.textSecondary }]}>
            {t('scan.processing')}
          </Text>
        </View>
      </SafeScreen>
    );
  }

  // ── Review State ────────────────────────────────────────────────────────────
  if (scanState === 'review' && receiptData) {
    return (
      <SafeScreen noPadding>
        <ScrollView
          contentContainerStyle={[styles.reviewContent, { paddingHorizontal: Spacing[6] }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('scan.detectedFields')}
          </Text>

          <Card>
            <FieldRow label={t('scan.studentName')} value={receiptData.studentName} colors={colors} />
            <FieldRow label={t('scan.studentNumber')} value={receiptData.studentNumber} colors={colors} />
            <FieldRow label={t('scan.paymentDate')} value={receiptData.paymentDate} colors={colors} />
            <FieldRow label={t('scan.referenceId')} value={receiptData.referenceId} colors={colors} />
            <FieldRow label={t('scan.amount')} value={receiptData.amount} colors={colors} last />
          </Card>

          <Button
            label={t('scan.verifyReceipt')}
            onPress={handleVerify}
            loading={validating}
            disabled={validating}
            size="lg"
            haptic="medium"
          />
          <Button
            label={t('scan.retake')}
            variant="ghost"
            onPress={handleReset}
            size="lg"
          />
        </ScrollView>

        {/* Success Modal */}
        <Modal visible={successModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={styles.modalEmoji}>🎉</Text>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {t('scan.successTitle')}
              </Text>
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                {t('scan.successMessage', { date: expiryDate ? formatDate(expiryDate) : '' })}
              </Text>
              <Button
                label={t('common.ok')}
                onPress={handleReset}
                size="lg"
                style={{ marginTop: Spacing[4] }}
              />
            </View>
          </View>
        </Modal>
      </SafeScreen>
    );
  }

  // ── Idle State (default) ────────────────────────────────────────────────────
  return (
    <SafeScreen noPadding>
      <View style={[styles.idleContainer, { paddingHorizontal: Spacing[6] }]}>
        <View style={styles.idleHeader}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('scan.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('scan.subtitle')}
          </Text>
        </View>

        {/* Illustration */}
        <View style={[styles.illustration, { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="receipt-outline" size={64} color={colors.primary} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleTakePhoto}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={32} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              {t('scan.takePhoto')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleUploadGallery}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={32} color={colors.accent} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              {t('scan.uploadGallery')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeScreen>
  );
}

function FieldRow({
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
        fieldStyles.row,
        { borderBottomColor: colors.border },
        !last && fieldStyles.rowBorder,
      ]}
    >
      <Text style={[fieldStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[fieldStyles.value, { color: colors.textPrimary }]}>{value ?? '—'}</Text>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[3],
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  value: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing[4],
  },
});

const styles = StyleSheet.create({
  // Idle
  idleContainer: {
    flex: 1,
    paddingTop: Spacing[8],
    paddingBottom: Spacing[6],
    justifyContent: 'space-between',
  },
  idleHeader: {
    alignItems: 'center',
    gap: Spacing[2],
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
  },
  illustration: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing[4],
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[6],
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    textAlign: 'center',
  },
  // Camera
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cameraFrame: {
    width: 280,
    height: 200,
    borderWidth: 2,
    borderRadius: 12,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[4],
    paddingBottom: Spacing[8],
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  // Processing
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
  },
  processingText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  // Review
  reviewContent: {
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
    gap: Spacing[4],
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
  },
  modalContent: {
    width: '100%',
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[8],
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 56,
    marginBottom: Spacing[4],
  },
  modalTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing[2],
  },
  modalMessage: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
});
