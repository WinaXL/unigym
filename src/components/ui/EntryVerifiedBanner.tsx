// src/components/ui/EntryVerifiedBanner.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius } from '../../theme';

interface EntryVerifiedBannerProps {
  visible: boolean;
  onDismiss: () => void;
  studentName?: string;
  studentNumber?: string;
  time?: string;
}

export function EntryVerifiedBanner({
  visible,
  onDismiss,
  studentName,
  studentNumber,
  time,
}: EntryVerifiedBannerProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  if (!visible) return null;

  const displayTime = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <View style={styles.card}>
          {/* Top Checkmark Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-sharp" size={40} color="#064E3B" />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>ENTRY VERIFIED</Text>
              <Text style={styles.badge}>ACCESS GRANTED</Text>
            </View>
          </View>

          {/* Time Display for Front Desk Staff */}
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>CHECK-IN TIMESTAMP</Text>
            <Text style={styles.timeValue}>{displayTime}</Text>
          </View>

          {/* Student Info */}
          <View style={styles.footer}>
            <Text style={styles.studentName}>{studentName || 'Student Member'}</Text>
            <Text style={styles.studentNumber}>{studentNumber || 'STD23141035'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing[5],
  },
  card: {
    width: '100%',
    backgroundColor: '#10B981', // Vibrant emerald green
    borderRadius: BorderRadius['2xl'],
    padding: Spacing[6],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#34D399',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    marginBottom: Spacing[5],
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: '#064E3B',
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.extrabold,
    color: '#064E3B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  timeBox: {
    backgroundColor: '#064E3B',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    marginBottom: Spacing[5],
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeight.bold,
    color: '#34D399',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 34,
    fontWeight: Typography.fontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(6, 78, 59, 0.25)',
    paddingTop: Spacing[4],
    gap: 2,
  },
  studentName: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    color: '#064E3B',
  },
  studentNumber: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: '#065F46',
    letterSpacing: 1,
  },
});
