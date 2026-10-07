// src/components/scanner/ReceiptScannerFlow.tsx
import React, { useState, useRef, useEffect } from 'react';
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
  Linking,
  KeyboardAvoidingView,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';
import { useApiAdapter } from '../../services/ApiProvider';
import { membershipService } from '../../services/membershipService';
import {
  parseReceiptImage,
  ReceiptScanError,
  type ReceiptScanErrorCode,
} from '../../services/receiptParser';
import { hapticService } from '../../services/hapticService';
import { Typography, Spacing, BorderRadius } from '../../theme';
import { formatDate, maskPaymentDateInput } from '../../utils/dateUtils';
import {
  digitsOnly,
  isStudentNumber,
  STUDENT_NUMBER_MAX_LENGTH,
} from '../../utils/studentNumber';
import type { ReceiptData, ReceiptRejectionCode } from '../../types/api';

type Step = 'idle' | 'camera' | 'processing' | 'verify_modal';

interface ReceiptScannerFlowProps {
  onSuccess?: (expiryDate: string) => void;
  onCancel?: () => void;
}

/** Maps a server rejection onto a user-facing message. */
const REJECTION_MESSAGE_KEYS: Record<ReceiptRejectionCode, string> = {
  NO_NAME: 'scan.errorNoName',
  NO_STUDENT_NUMBER: 'scan.errorNoStudentNumber',
  INVALID_STUDENT_NUMBER: 'scan.errorInvalidStudentNumber',
  NO_DATE: 'scan.errorNoDate',
  INVALID_DATE: 'scan.errorInvalidDate',
  INVALID_REFERENCE: 'scan.errorInvalidReference',
  ALREADY_USED: 'scan.errorAlreadyUsed',
  DATE_EXPIRED: 'scan.errorDateExpired',
  FUTURE_DATE: 'scan.errorFutureDate',
  NAME_MISMATCH: 'scan.errorNameMismatch',
  ID_MISMATCH: 'scan.errorAnotherStudent',
  LEDGER_UNAVAILABLE: 'scan.errorLedgerUnavailable',
  NOT_READY: 'scan.errorNotReady',
  IN_PROGRESS: 'scan.errorInProgress',
  GENERIC: 'scan.errorGeneric',
};

/** Maps a failed on-device scan onto a user-facing message. */
const SCAN_ERROR_MESSAGE_KEYS: Record<ReceiptScanErrorCode, string> = {
  OCR_UNAVAILABLE: 'scan.errorOcrUnavailable',
  UNREADABLE_IMAGE: 'scan.errorOcrUnreadable',
  NO_TEXT: 'scan.errorOcrNoText',
  NO_REFERENCE: 'scan.errorInvalidReference',
};

export function ReceiptScannerFlow({ onSuccess }: ReceiptScannerFlowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const adapter = useApiAdapter();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [referenceId, setReferenceId] = useState('');

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const sheetScrollRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Async work started before an unmount must not write state afterwards.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight <= 0 || step !== 'verify_modal') return;
    const timer = setTimeout(() => sheetScrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [keyboardHeight, step]);

  function failWith(messageKey: string) {
    if (!mountedRef.current) return;
    hapticService.error();
    Alert.alert(t('common.error'), t(messageKey));
  }

  async function processImageUri(uri: string) {
    if (!mountedRef.current) return;
    setStep('processing');

    try {
      const parsed = await parseReceiptImage(uri, {
        fullName: user?.fullName,
        studentNumber: user?.studentId,
      });
      // The parse takes a moment; the sheet may have been dismissed since.
      if (!mountedRef.current) return;

      setStudentName(parsed.studentName ?? '');
      setStudentNumber(digitsOnly(parsed.studentNumber ?? ''));
      setPaymentDate(parsed.paymentDate ?? '');
      setReferenceId(parsed.referenceId ?? '');
      setStep('verify_modal');
    } catch (error) {
      if (!mountedRef.current) return;
      setStep('idle');
      failWith(
        error instanceof ReceiptScanError
          ? SCAN_ERROR_MESSAGE_KEYS[error.code]
          : 'scan.errorGeneric'
      );
    }
  }

  async function handleLaunchCamera() {
    // There is no recogniser in the browser, and a placeholder image must never
    // stand in for a real one.
    if (Platform.OS === 'web') {
      failWith('scan.errorCameraUnsupported');
      return;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        // Once the OS stops asking, an in-app prompt is a dead end, so send the
        // user somewhere they can actually change the setting.
        if (!result.canAskAgain) {
          Alert.alert(t('common.error'), t('scan.cameraPermissionBlocked'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('scan.openSettings'), onPress: () => void Linking.openSettings() },
          ]);
        } else {
          failWith('scan.cameraPermission');
        }
        return;
      }
    }
    setStep('camera');
  }

  async function handleCapture() {
    // Rapid taps would otherwise queue concurrent captures, which iOS rejects.
    if (capturing) return;
    if (!cameraRef.current) {
      failWith('scan.errorCameraUnavailable');
      return;
    }

    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo?.uri) {
        failWith('scan.errorCameraUnavailable');
        return;
      }
      await processImageUri(photo.uri);
    } catch {
      // A camera failure is a failure. It used to fall through to a placeholder
      // URI, which the parser then turned into a valid receipt.
      if (mountedRef.current) setStep('idle');
      failWith('scan.errorCameraUnavailable');
    } finally {
      if (mountedRef.current) setCapturing(false);
    }
  }

  async function handlePickGallery() {
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Re-compression blurs small print; the recogniser downsamples itself.
        quality: 1,
      });
    } catch {
      failWith('scan.errorGalleryUnavailable');
      return;
    }

    if (result.canceled) return;

    const uri = result.assets?.[0]?.uri;
    if (!uri) {
      failWith('scan.errorGalleryUnavailable');
      return;
    }
    await processImageUri(uri);
  }

  async function handleConfirmAndActivate() {
    if (!studentName.trim()) {
      failWith('scan.errorNoName');
      return;
    }
    if (!studentNumber.trim()) {
      failWith('scan.errorNoStudentNumber');
      return;
    }
    if (!isStudentNumber(studentNumber)) {
      failWith('scan.errorInvalidStudentNumber');
      return;
    }
    const paymentDateValue = maskPaymentDateInput(paymentDate);
    if (!paymentDateValue.trim()) {
      failWith('scan.errorNoDate');
      return;
    }
    if (!referenceId.trim()) {
      failWith('scan.errorInvalidReference');
      return;
    }

    setLoading(true);
    try {
      const receipt: ReceiptData = {
        studentName: studentName.trim(),
        studentNumber: studentNumber.trim(),
        paymentDate: paymentDateValue,
        referenceId: referenceId.trim(),
      };

      // The adapter decides. Identity binding and cache writes happen inside the
      // service, only after this returns a pass.
      const result = await membershipService.redeemReceipt(adapter, receipt);
      if (!mountedRef.current) return;

      if (result.success && result.membershipExpiryDate) {
        hapticService.success();
        setExpiryDate(result.membershipExpiryDate);
        setSuccessModal(true);
        return;
      }

      failWith(REJECTION_MESSAGE_KEYS[result.error ?? 'GENERIC']);
    } catch {
      failWith('scan.errorGeneric');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function handleFinish() {
    setSuccessModal(false);
    setStep('idle');
    onSuccess?.(expiryDate);
  }

  // ── Camera Screen ─────────────────────────────────────────────────────────
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        {/* `active` stops the capture session when this screen is not showing;
            tab screens stay mounted, so without it the camera keeps running. */}
        <CameraView ref={cameraRef} style={styles.camera} facing="back" active />
        <View style={styles.cameraOverlay} pointerEvents="box-none">
          <View style={[styles.cameraFrame, { borderColor: colors.primary }]}>
            <View style={styles.cameraCornerTL} />
            <View style={styles.cameraCornerTR} />
            <View style={styles.cameraCornerBL} />
            <View style={styles.cameraCornerBR} />
          </View>
          <Text style={styles.cameraHint}>{t('scan.alignReceipt')}</Text>
        </View>
        <View style={[styles.cameraControls, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={styles.controlCancel}
            onPress={() => setStep('idle')}
            disabled={capturing}
          >
            <Text style={[styles.controlCancelText, { color: colors.textSecondary }]}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.captureButton,
              { backgroundColor: colors.primary },
              capturing && styles.captureButtonBusy,
            ]}
            onPress={handleCapture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.captureInner} />
            )}
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
            {t('scan.takePhotoHint')}
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
            {t('scan.uploadGalleryHint')}
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
          behavior="padding"
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                maxHeight:
                  keyboardHeight > 0
                    ? Math.max(280, Dimensions.get('screen').height - keyboardHeight - 24)
                    : '90%',
              },
            ]}
          >
            <ScrollView
              ref={sheetScrollRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.sheetScroll,
                keyboardHeight > 0 && { paddingBottom: Spacing[6] },
              ]}
            >
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
                    placeholder={t('scan.studentNamePlaceholder')}
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
                    onChangeText={(text) => setStudentNumber(digitsOnly(text))}
                    placeholder={t('scan.studentNumberPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={STUDENT_NUMBER_MAX_LENGTH}
                    autoCorrect={false}
                  />
                </View>

                {/* Payment Date */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('scan.paymentDate')}
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                    value={paymentDate}
                    onChangeText={(text) => setPaymentDate(maskPaymentDateInput(text))}
                    onFocus={() => {
                      setTimeout(() => sheetScrollRef.current?.scrollToEnd({ animated: true }), 50);
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={10}
                    autoCorrect={false}
                  />
                </View>

                {/* Reference ID — read-only.
                    This is the anti-replay key: if the user can retype it, the
                    same physical receipt can be redeemed indefinitely under a
                    fresh reference. It is shown for transparency only. */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('scan.referenceId')}
                  </Text>
                  <View
                    style={[
                      styles.readOnlyField,
                      { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.readOnlyValue, { color: colors.textPrimary }]}>
                      {referenceId || '—'}
                    </Text>
                    <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
                    {t('scan.referenceIdLocked')}
                  </Text>
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
                disabled={loading}
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
  captureButtonBusy: {
    opacity: 0.6,
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
  inputHint: {
    fontSize: Typography.fontSize.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[2],
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
  },
  readOnlyValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
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
