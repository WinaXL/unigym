// src/components/scanner/ReceiptScannerFlow.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';
import { useMembershipStore } from '../../stores/membershipStore';
import { parseReceiptImage } from '../../services/receiptParser';
import { hapticService } from '../../services/hapticService';
import { Typography, Spacing, BorderRadius } from '../../theme';
import { formatDate } from '../../utils/dateUtils';
import type { ReceiptData } from '../../types/api';
import type { UserProfile } from '../../types/auth';

type Step = 'idle' | 'camera' | 'processing' | 'verify_modal';

interface ReceiptScannerFlowProps {
  isOnboarding?: boolean;
  onSuccess?: (expiryDate: string) => void;
  onCancel?: () => void;
}

export function ReceiptScannerFlow({
  isOnboarding = false,
  onSuccess,
  onCancel,
}: ReceiptScannerFlowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  // Editable parsed fields
  const [studentName, setStudentName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [amount, setAmount] = useState('15,000 KZT');

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  async function handleLaunchCamera() {
    if (Platform.OS === 'web') {
      await processImageUri('mock://web-camera');
      return;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(t('common.error'), t('scan.cameraPermission'));
        return;
      }
    }
    setStep('camera');
  }

  async function handleCapture() {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          await processImageUri(photo.uri);
          return;
        }
      } catch {
        // fallback
      }
    }
    await processImageUri('mock://camera-capture');
  }

  async function handlePickGallery() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await processImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t('common.error'), t('scan.galleryPermission'));
    }
  }

  async function processImageUri(uri: string) {
    setStep('processing');
    try {
      const parsed = await parseReceiptImage(
        uri,
        user?.fullName,
        user?.studentId
      );

      setStudentName(parsed.studentName || 'Ayana Bekova');
      setStudentNumber(parsed.studentNumber || 'STD23141035');
      setPaymentDate(parsed.paymentDate || new Date().toISOString().split('T')[0]);
      setReferenceId(parsed.referenceId || `RCP-${Math.floor(100000 + Math.random() * 900000)}`);
      setAmount(parsed.amount || '15,000 KZT');

      setStep('verify_modal');
    } catch {
      hapticService.error();
      Alert.alert(t('common.error'), t('scan.errorGeneric'));
      setStep('idle');
    }
  }

  async function handleConfirmAndActivate() {
    // Basic field validation
    if (!studentName.trim()) {
      Alert.alert(t('common.error'), t('scan.errorNoName'));
      return;
    }
    if (!studentNumber.trim()) {
      Alert.alert(t('common.error'), t('auth.studentIdRequired'));
      return;
    }
    if (!paymentDate.trim()) {
      Alert.alert(t('common.error'), t('scan.errorNoDate'));
      return;
    }
    if (!referenceId.trim()) {
      Alert.alert(t('common.error'), t('scan.errorGeneric'));
      return;
    }

    setLoading(true);

    const receiptPayload: ReceiptData = {
      studentName: studentName.trim(),
      studentNumber: studentNumber.trim().toUpperCase(),
      paymentDate: paymentDate.trim(),
      referenceId: referenceId.trim().toUpperCase(),
      amount: amount.trim(),
      planType: 'Monthly Gym Unlimited',
    };

    try {
      let activeProfile = user;

      // First-time onboarding: bind profile permanently
      if (!activeProfile || isOnboarding) {
        const boundProfile: UserProfile = {
          id: `user-${Date.now()}`,
          studentId: studentNumber.trim().toUpperCase(),
          fullName: studentName.trim(),
          faculty: 'University Member',
          enrollmentYear: new Date().getFullYear(),
        };
        await useAuthStore.getState().bindProfile(boundProfile);
        activeProfile = boundProfile;
      }

      // Validate & activate membership
      const result = await useMembershipStore
        .getState()
        .activateOrExtend(receiptPayload, activeProfile);

      if (result.success && result.membershipExpiryDate) {
        hapticService.success();
        setExpiryDate(result.membershipExpiryDate);
        setSuccessModal(true);
      } else {
        hapticService.error();
        let message = t('scan.errorGeneric');
        if (result.error === 'ALREADY_USED') {
          message = t('scan.errorAlreadyUsed');
        } else if (result.error === 'NAME_MISMATCH') {
          message = t('scan.errorAnotherStudent');
        } else if (result.error === 'DATE_EXPIRED') {
          message = t('scan.errorDateExpired');
        } else if (result.error === 'NO_DATE') {
          message = t('scan.errorNoDate');
        } else if (result.error === 'NO_NAME') {
          message = t('scan.errorNoName');
        }
        Alert.alert(t('common.error'), message);
      }
    } catch {
      hapticService.error();
      Alert.alert(t('common.error'), t('scan.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  function handleFinish() {
    setSuccessModal(false);
    setStep('idle');
    if (onSuccess) {
      onSuccess(expiryDate);
    }
  }

  // ── Camera Screen ─────────────────────────────────────────────────────────
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraOverlay} pointerEvents="box-none">
          <View style={[styles.cameraFrame, { borderColor: colors.primary }]}>
            <View style={styles.cameraCornerTL} />
            <View style={styles.cameraCornerTR} />
            <View style={styles.cameraCornerBL} />
            <View style={styles.cameraCornerBR} />
          </View>
          <Text style={styles.cameraHint}>Align receipt within the frame</Text>
        </View>
        <View style={[styles.cameraControls, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={styles.controlCancel}
            onPress={() => setStep('idle')}
          >
            <Text style={[styles.controlCancelText, { color: colors.textSecondary }]}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: colors.primary }]}
            onPress={handleCapture}
          >
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>
      </View>
    );
  }

  // ── Processing Screen ─────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.processingText, { color: colors.textPrimary }]}>
          {t('scan.processing')}
        </Text>
      </View>
    );
  }

  // ── Manual Confirmation Fallback Modal ────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Idle Actions */}
      <View style={styles.idleActions}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleLaunchCamera}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="camera" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
            {t('scan.takePhoto')}
          </Text>
          <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
            Scan paper receipt
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handlePickGallery}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="images" size={30} color={colors.accent} />
          </View>
          <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>
            {t('scan.uploadGallery')}
          </Text>
          <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
            Upload screenshot/photo
          </Text>
        </TouchableOpacity>
      </View>

      {/* Editable Verification Modal */}
      <Modal
        visible={step === 'verify_modal'}
        animationType="slide"
        transparent
        onRequestClose={() => setStep('idle')}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetScroll}>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetPill, { backgroundColor: colors.border }]} />
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  {t('scan.confirmationTitle')}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                  {t('scan.confirmationSubtitle')}
                </Text>
              </View>

              <Card style={{ gap: Spacing[3], marginBottom: Spacing[4] }}>
                {/* Student Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('scan.studentName')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={studentName}
                    onChangeText={setStudentName}
                    placeholder="e.g. Ayana Bekova"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Student Number */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('scan.studentNumber')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={studentNumber}
                    onChangeText={setStudentNumber}
                    placeholder="e.g. STD23141035"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Payment Date */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('scan.paymentDate')} (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={paymentDate}
                    onChangeText={setPaymentDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                {/* Reference ID */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('scan.referenceId')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={referenceId}
                    onChangeText={setReferenceId}
                    placeholder="e.g. RCP-819203"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Amount / Plan */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('scan.amount')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="15,000 KZT"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </Card>

              <Button
                label={t('scan.confirmAndActivate')}
                onPress={handleConfirmAndActivate}
                loading={loading}
                disabled={loading}
                size="lg"
                haptic="medium"
              />

              <Button
                label={t('scan.retake')}
                variant="ghost"
                onPress={() => setStep('idle')}
                size="md"
                style={{ marginTop: Spacing[2] }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Success Celebration Modal */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.celebrationOverlay}>
          <View style={[styles.celebrationCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
            <Text style={[styles.celebrationTitle, { color: colors.textPrimary }]}>
              {t('scan.successTitle')}
            </Text>
            <Text style={[styles.celebrationMessage, { color: colors.textSecondary }]}>
              {t('scan.successMessage', { date: expiryDate ? formatDate(expiryDate) : '' })}
            </Text>
            <Button
              label={t('common.ok')}
              onPress={handleFinish}
              size="lg"
              style={{ marginTop: Spacing[6], width: '100%' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  idleActions: {
    flexDirection: 'row',
    gap: Spacing[4],
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing[5],
    paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing[2],
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
  // Camera
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 110,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  cameraFrame: {
    width: 290,
    height: 220,
    borderWidth: 2,
    borderRadius: 16,
    position: 'relative',
  },
  cameraCornerTL: { position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#10B981' },
  cameraCornerTR: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#10B981' },
  cameraCornerBL: { position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#10B981' },
  cameraCornerBR: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#10B981' },
  cameraHint: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    marginTop: Spacing[5],
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[5],
    paddingBottom: Spacing[8],
  },
  controlCancel: {
    width: 60,
  },
  controlCancelText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: Spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
  },
  processingText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  // Sheet Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    maxHeight: '90%',
  },
  sheetScroll: {
    padding: Spacing[6],
    paddingBottom: Spacing[10],
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  sheetPill: {
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: Spacing[3],
  },
  sheetTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  // Celebration
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing[6],
  },
  celebrationCard: {
    width: '100%',
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[8],
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 56,
    marginBottom: Spacing[3],
  },
  celebrationTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing[2],
  },
  celebrationMessage: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
});
