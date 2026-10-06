// src/components/ui/LanguageOptions.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { useThemeColors } from '../../hooks/useThemeColors';
import { useLocaleStore } from '../../stores/localeStore';
import { hapticService } from '../../services/hapticService';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../core/i18n';
import type { SupportedLanguage } from '../../core/i18n';
import { Typography, Spacing, BorderRadius } from '../../theme';

interface LanguageOptionsProps {
  /** Called after a language is chosen, e.g. to dismiss a containing sheet. */
  onSelect?: (lang: SupportedLanguage) => void;
}

/**
 * Two-column grid of language pills. Selecting one switches the UI immediately
 * and persists the choice (see localeStore.setLanguage).
 */
export function LanguageOptions({ onSelect }: LanguageOptionsProps) {
  const colors = useThemeColors();
  const language = useLocaleStore((s) => s.language);
  const setLanguage = useLocaleStore((s) => s.setLanguage);

  function handleSelect(lang: SupportedLanguage) {
    if (lang !== language) {
      hapticService.light();
      setLanguage(lang);
    }
    onSelect?.(lang);
  }

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = language === lang;
        return (
          <TouchableOpacity
            key={lang}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.primary : colors.surfaceSubtle,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => handleSelect(lang)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={LANGUAGE_LABELS[lang]}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.label, { color: selected ? '#FFFFFF' : colors.textSecondary }]}
              numberOfLines={1}
            >
              {LANGUAGE_LABELS[lang]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  option: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
});
