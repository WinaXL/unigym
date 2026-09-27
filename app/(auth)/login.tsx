// app/(auth)/login.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../src/hooks/useAuth';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { Button } from '../../src/components/ui/Button';
import { hapticService } from '../../src/services/hapticService';
import { validateStudentId, validatePassport } from '../../src/utils/validationUtils';
import { Typography, Spacing, BorderRadius } from '../../src/theme';
import type { ApiError } from '../../src/types/api';

export default function LoginScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { login } = useAuth();

  const [studentId, setStudentId] = useState('');
  const [passport, setPassport] = useState('');
  const [showPassport, setShowPassport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ studentId?: string; passport?: string }>({});

  const passportRef = useRef<TextInput>(null);

  function validate(): boolean {
    const studentIdError = validateStudentId(studentId);
    const passportError = validatePassport(passport);
    const newErrors: typeof errors = {};
    if (studentIdError) newErrors.studentId = t(studentIdError as any);
    if (passportError) newErrors.passport = t(passportError as any);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      hapticService.error();
      return false;
    }
    return true;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(studentId.trim().toUpperCase(), passport.trim());
    } catch (err: unknown) {
      setLoading(false);
      hapticService.error();
      const apiErr = err as ApiError;
      const message =
        apiErr?.code === 'AUTH_INVALID'
          ? t('auth.errorInvalidCredentials')
          : apiErr?.code === 'NETWORK_ERROR'
          ? t('auth.errorNetwork')
          : t('auth.errorGeneric');
      Alert.alert('', message);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Branding */}
          <View style={styles.brandSection}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.logoText}>U</Text>
            </View>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>
              {t('common.appName')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('auth.subtitle')}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Student ID Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('auth.studentId')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: errors.studentId ? colors.error : colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder={t('auth.studentIdPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={studentId}
                onChangeText={(t) => {
                  setStudentId(t);
                  if (errors.studentId) setErrors((e) => ({ ...e, studentId: undefined }));
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passportRef.current?.focus()}
                editable={!loading}
              />
              {errors.studentId && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.studentId}
                </Text>
              )}
            </View>

            {/* Passport Field */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('auth.passportId')}
              </Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={passportRef}
                  style={[
                    styles.input,
                    styles.inputWithAction,
                    {
                      backgroundColor: colors.surface,
                      borderColor: errors.passport ? colors.error : colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder={t('auth.passportIdPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={passport}
                  onChangeText={(t) => {
                    setPassport(t);
                    if (errors.passport) setErrors((e) => ({ ...e, passport: undefined }));
                  }}
                  secureTextEntry={!showPassport}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.eyeButton, { backgroundColor: colors.surfaceSubtle }]}
                  onPress={() => {
                    hapticService.light();
                    setShowPassport((s) => !s);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.eyeIcon}>{showPassport ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {errors.passport && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.passport}
                </Text>
              )}
            </View>

            {/* Demo hint */}
            <View style={[styles.demoHint, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.demoText, { color: colors.primary }]}>
                {'Demo: Student ID → STU001, STU002 or STU003\nPassport → any 5+ chars'}
              </Text>
            </View>

            {/* Sign In Button */}
            <Button
              label={loading ? t('auth.signingIn') : t('auth.signIn')}
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              size="lg"
              style={styles.loginButton}
              haptic="medium"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing[6],
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: Spacing[10],
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
  },
  logoText: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  appName: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: -0.5,
    marginBottom: Spacing[2],
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
  },
  form: {
    gap: Spacing[5],
  },
  fieldGroup: {
    gap: Spacing[2],
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 2,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing[4],
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWithAction: {
    paddingRight: 56,
  },
  eyeButton: {
    position: 'absolute',
    right: 4,
    top: 4,
    bottom: 4,
    width: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: 2,
  },
  demoHint: {
    padding: Spacing[3],
    borderRadius: BorderRadius.md,
  },
  demoText: {
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
    fontWeight: Typography.fontWeight.medium,
  },
  loginButton: {
    marginTop: Spacing[2],
  },
});
