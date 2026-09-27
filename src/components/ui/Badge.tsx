// src/components/ui/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Typography, BorderRadius, Spacing } from '../../theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const colors = useThemeColors();

  const colorMap: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: colors.accentLight, text: colors.success },
    warning: { bg: '#FEF3C7', text: colors.warning },
    error: { bg: '#FEE2E2', text: colors.error },
    info: { bg: colors.primaryLight, text: colors.primary },
    neutral: { bg: colors.surfaceSubtle, text: colors.textSecondary },
  };

  const { bg, text } = colorMap[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[3],
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
