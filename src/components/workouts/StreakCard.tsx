import { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useWorkoutStore } from '../../stores/workoutStore';
import { workoutStreak } from '../../services/workoutRules';

export function StreakCard() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const progress = useWorkoutStore((state) => state.progress);
  const today = useWorkoutStore((state) => state.today);
  const { count, misses } = useMemo(() => workoutStreak(progress, today), [progress, today]);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="flame" size={32} color={misses || !count ? colors.textTertiary : colors.warning} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('workouts.streak', { count })}</Text>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
          {t(misses === 1 ? 'workouts.streakWarning' : misses === 2 ? 'workouts.streakReset' : 'workouts.streakHint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1 },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 18, fontWeight: '700' },
});
