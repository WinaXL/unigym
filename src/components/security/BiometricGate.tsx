// src/components/security/BiometricGate.tsx
/**
 * Blocks the app behind biometric authentication while the lock is engaged.
 *
 * The lock is an opaque full-screen layer drawn over the children rather than a
 * replacement for them, because the root layout has to keep rendering its
 * navigator — unmounting it would tear down Expo Router's navigation state. The
 * tradeoff is that protected screens stay mounted behind the lock; they are not
 * visible or touchable, but this is a UI lock, not an encryption boundary. What
 * actually protects the data at rest is secureStorage.
 *
 * The lock re-engages whenever the app returns from the background, which is the
 * only place in the app that observes AppState.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../ui/Button';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useSecurityStore } from '../../stores/securityStore';
import { Typography, Spacing } from '../../theme';

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const isLocked = useSecurityStore((s) => s.isLocked);
  const isReady = useSecurityStore((s) => s.isReady);
  const unlock = useSecurityStore((s) => s.unlock);
  const lock = useSecurityStore((s) => s.lock);

  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  // Guards against overlapping prompts, which some platforms reject outright.
  const promptInFlight = useRef(false);

  const authenticate = useCallback(async () => {
    if (promptInFlight.current) return;
    promptInFlight.current = true;
    setAuthenticating(true);
    setFailed(false);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('auth.biometricPrompt'),
        cancelLabel: t('common.cancel'),
      });
      if (result.success) {
        unlock();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      promptInFlight.current = false;
      setAuthenticating(false);
    }
  }, [t, unlock]);

  // Prompt as soon as the lock engages, deferred by a tick so the system dialog
  // is not raised synchronously during the commit that rendered the lock.
  useEffect(() => {
    if (!isReady || !isLocked) return;
    const timer = setTimeout(() => void authenticate(), 0);
    return () => clearTimeout(timer);
  }, [isReady, isLocked, authenticate]);

  // Re-lock on return from the background. Without this the lock would only ever
  // apply to a cold start, and a backgrounded app would stay open indefinitely.
  useEffect(() => {
    const previous = { current: AppState.currentState as AppStateStatus };

    const subscription = AppState.addEventListener('change', (next) => {
      if (previous.current.match(/inactive|background/) && next === 'active') {
        lock();
      }
      previous.current = next;
    });

    return () => subscription.remove();
  }, [lock]);

  return (
    <View style={styles.root}>
      {children}
      {isLocked && (
        <View style={[styles.lockLayer, { backgroundColor: colors.background }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="lock-closed" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('security.lockedTitle')}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {failed ? t('security.lockedRetry') : t('security.lockedMessage')}
          </Text>
          <Button
            label={t('security.unlock')}
            onPress={authenticate}
            loading={authenticating}
            disabled={authenticating}
            size="lg"
            style={styles.button}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  lockLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[8],
    gap: Spacing[3],
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: Spacing[5],
    width: '100%',
    maxWidth: 320,
  },
});
