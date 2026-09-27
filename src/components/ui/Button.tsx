// src/components/ui/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { hapticService } from '../../services/hapticService';
import { Typography, BorderRadius, Spacing } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: 'light' | 'medium' | 'heavy';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  haptic = 'light',
}: ButtonProps) {
  const colors = useThemeColors();

  const handlePress = () => {
    if (disabled || loading) return;
    hapticService[haptic]();
    onPress();
  };

  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles[size],
    ...(variant === 'primary' && {
      backgroundColor: colors.primary,
    }),
    ...(variant === 'secondary' && {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    }),
    ...(variant === 'ghost' && {
      backgroundColor: 'transparent',
    }),
    ...(variant === 'danger' && {
      backgroundColor: colors.error,
    }),
    ...((disabled || loading) && styles.disabled),
  };

  const labelStyle: TextStyle = {
    ...styles.label,
    ...sizeLabelStyles[size],
    ...(variant === 'primary' && { color: colors.textOnPrimary }),
    ...(variant === 'secondary' && { color: colors.textPrimary }),
    ...(variant === 'ghost' && { color: colors.primary }),
    ...(variant === 'danger' && { color: '#FFFFFF' }),
  };

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary}
          size="small"
        />
      ) : (
        <Text style={[labelStyle, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: Typography.fontWeight.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { height: 36, paddingHorizontal: Spacing[4] },
  md: { height: 48, paddingHorizontal: Spacing[6] },
  lg: { height: 56, paddingHorizontal: Spacing[8] },
};

const sizeLabelStyles: Record<Size, TextStyle> = {
  sm: { fontSize: Typography.fontSize.sm },
  md: { fontSize: Typography.fontSize.base },
  lg: { fontSize: Typography.fontSize.md },
};
