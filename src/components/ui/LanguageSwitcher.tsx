// src/components/ui/LanguageSwitcher.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocaleStore } from '../../stores/localeStore';
import { LANGUAGE_LABELS } from '../../core/i18n';
import { LanguageOptions } from './LanguageOptions';
import { Typography, Spacing, BorderRadius } from '../../theme';

/**
 * Compact header control showing the current language. Tapping it opens a
 * small sheet with every supported language.
 */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const language = useLocaleStore((s) => s.language);
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('profile.language')}: ${LANGUAGE_LABELS[language]}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.8}
      >
        <Ionicons name="globe-outline" size={16} color={colors.primary} />
        <Text style={[styles.triggerLabel, { color: colors.textPrimary }]}>
          {LANGUAGE_LABELS[language]}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          {/* A sibling, not a wrapper: an accessible parent would hide the
              sheet's options from VoiceOver. */}
          <Pressable
            style={styles.dismissArea}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <View
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {t('profile.language')}
              </Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <LanguageOptions onSelect={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1.5],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  triggerLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing[6],
  },
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[5],
    gap: Spacing[4],
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
});
