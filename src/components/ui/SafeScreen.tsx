// src/components/ui/SafeScreen.tsx
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../hooks/useThemeColors';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  noPadding?: boolean;
}

export function SafeScreen({
  children,
  style,
  edges = ['top', 'left', 'right'],
  noPadding = false,
}: SafeScreenProps) {
  const colors = useThemeColors();

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: colors.background }]}
      edges={edges}
    >
      <View
        style={[
          styles.flex,
          !noPadding && styles.padding,
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padding: { paddingHorizontal: 16 },
});
