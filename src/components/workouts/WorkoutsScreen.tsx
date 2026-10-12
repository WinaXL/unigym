import { useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeScreen } from '../ui/SafeScreen';
import { Button } from '../ui/Button';
import { StreakCard } from './StreakCard';
import { useThemeColors } from '../../hooks/useThemeColors';
import { WORKOUT_PLANS, getWorkoutPlan, type WorkoutExercise } from '../../data/workoutPlans';
import { shiftWorkoutDate, workoutOn, workoutWeekday } from '../../services/workoutRules';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useAuthStore } from '../../stores/authStore';

export function WorkoutsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { progress, today, userId, isLoading, choosePlan, toggleExercise, complete } = useWorkoutStore();
  const session = useSessionStore((state) => state.activeSession);
  const checkIn = useSessionStore((state) => state.checkIn);
  const sessionBusy = useSessionStore((state) => state.isMutating);
  const records = useHistoryStore((state) => state.records);
  const boundUserId = useAuthStore((state) => state.userId);
  const [editing, setEditing] = useState(false);
  const [draftPlan, setDraftPlan] = useState(WORKOUT_PLANS[0].id);
  const [days, setDays] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = progress.schedules.at(-1);
  const configuring = editing || !latest;
  const plan = getWorkoutPlan(draftPlan)!;
  const monday = shiftWorkoutDate(today, -((workoutWeekday(today) + 6) % 7));
  const week = Array.from({ length: 6 }, (_, index) => shiftWorkoutDate(monday, index));
  const date = selectedDate && week.includes(selectedDate) ? selectedDate : today;
  const workout = workoutOn(progress, date);
  const checked = progress.checked[date] ?? [];
  const done = progress.completed.includes(date);
  const attended = (session?.userId === userId && session.date === date) || records.some((record) =>
    record.userId === userId && record.date === date && !!record.timeOut && !record.id.startsWith('att-sample-'));
  const allChecked = !!workout && workout.exercises.every((exercise) => checked.includes(exercise.id));
  const dayLabel = (day: number) => t(`workouts.weekdays.${day}`);
  const prescription = (exercise: WorkoutExercise) => exercise.minutes
    ? t('workouts.minutes', { count: exercise.minutes })
    : t('workouts.setsReps', { sets: exercise.sets, reps: exercise.reps });
  const formattedDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day, 12));
  };
  async function act(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await operation(); } catch { setError(t('workouts.saveError')); }
    finally { setBusy(false); }
  }

  if (isLoading || userId !== boundUserId) return <SafeScreen><ActivityIndicator color={colors.primary} /></SafeScreen>;

  return (
    <SafeScreen noPadding>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>{t('workouts.title')}</Text>
        <StreakCard />
        {error ? <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text> : null}
        {configuring ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('workouts.choosePlan')}</Text>
            {WORKOUT_PLANS.map((item) => (
              <Pressable key={item.id} accessibilityRole="radio" aria-checked={draftPlan === item.id}
                onPress={() => { setDraftPlan(item.id); if (item.days.length !== plan.days.length) setDays([]); }}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: draftPlan === item.id ? colors.primary : colors.border }]}>
                <View style={styles.row}>
                  <Ionicons name={draftPlan === item.id ? 'radio-button-on' : 'radio-button-off'} size={24} color={colors.primary} />
                  <View style={styles.flex}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{t(`workouts.plans.${item.id}.name`)}</Text>
                    <Text style={{ color: colors.textSecondary }}>{t('workouts.daysPerWeek', { count: item.days.length })}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.textSecondary }}>{t(`workouts.plans.${item.id}.description`)}</Text>
              </Pressable>
            ))}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('workouts.chooseDays', { count: plan.days.length })}</Text>
            <View style={styles.wrap}>
              {[1, 2, 3, 4, 5, 6].map((day) => (
                <Pressable key={day} accessibilityRole="checkbox" aria-checked={days.includes(day)}
                  onPress={() => setDays(days.includes(day) ? days.filter((value) => value !== day) : [...days, day].sort((a, b) => a - b))}
                  style={[styles.dayChip, { backgroundColor: days.includes(day) ? colors.primaryLight : colors.surface, borderColor: days.includes(day) ? colors.primary : colors.border }]}>
                  <Text style={{ color: days.includes(day) ? colors.primary : colors.textPrimary }}>{dayLabel(day)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: colors.textSecondary }}>{t('workouts.sundayClosed')}</Text>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('workouts.planPreview')}</Text>
            {plan.days.map((day, index) => (
              <View key={day.focus} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.primary }]}>{days.length === plan.days.length ? dayLabel(days[index]) : t('workouts.dayNumber', { count: index + 1 })}</Text>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{t(`workouts.focus.${day.focus}`)}</Text>
                {day.exercises.map((exercise) => <Text key={exercise.id} style={{ color: colors.textSecondary }}>{t(`workouts.exercises.${exercise.id}`)} · {prescription(exercise)}</Text>)}
              </View>
            ))}
            {latest ? <Text style={{ color: colors.textSecondary }}>{t('workouts.changeTomorrow')}</Text> : null}
            <Button label={t('workouts.startPlan')} disabled={days.length !== plan.days.length || busy} loading={busy}
              onPress={() => void act(async () => { await choosePlan(draftPlan, days); setEditing(false); setSelectedDate(null); })} />
            {latest ? <Button variant="ghost" label={t('common.cancel')} disabled={busy} onPress={() => setEditing(false)} /> : null}
          </>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t(`workouts.plans.${latest.planId}.name`)}</Text>
                <Text style={{ color: colors.textSecondary }}>{t('workouts.daysPerWeek', { count: latest.weekdays.length })}</Text>
              </View>
              <Button size="sm" variant="ghost" label={t('workouts.changePlan')} onPress={() => { setDraftPlan(latest.planId); setDays(latest.weekdays); setEditing(true); }} />
            </View>
            {latest.effectiveFrom > today ? <Text style={{ color: colors.primary }}>{t('workouts.pendingPlan', { date: formattedDate(latest.effectiveFrom) })}</Text> : null}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('workouts.thisWeek')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
            {week.map((value) => {
              const item = workoutOn(progress, value);
              const completed = progress.completed.includes(value);
              const status = completed ? 'completed' : item && value < today ? 'missed' : value === today ? 'today' : item ? 'scheduled' : 'rest';
              return (
                <Pressable key={value} accessibilityRole="button" aria-selected={date === value} onPress={() => setSelectedDate(value)}
                  style={[styles.card, styles.weekCard, { backgroundColor: colors.surface, borderColor: date === value ? colors.primary : colors.border }]}>
                  <View style={styles.flex}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{dayLabel(workoutWeekday(value))} · {formattedDate(value)}</Text>
                    <Text style={{ color: colors.textSecondary }}>{item ? t(`workouts.focus.${item.focus}`) : t('workouts.restDay')}</Text>
                  </View>
                  <Text style={{ color: completed ? colors.success : colors.textSecondary }}>{t(`workouts.status.${status}`)}</Text>
                </Pressable>
              );
            })}
            </ScrollView>
            <Text style={{ color: colors.textSecondary }}>{t('workouts.sundayClosed')}</Text>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{formattedDate(date)} · {dayLabel(workoutWeekday(date))}</Text>
            {workout ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{t(`workouts.focus.${workout.focus}`)}</Text>
                <Text style={{ color: colors.textSecondary }}>{t('workouts.progress', { checked: checked.length, total: workout.exercises.length })}</Text>
                {workout.exercises.map((exercise) => (
                  <Pressable key={exercise.id} accessibilityRole="checkbox" aria-checked={checked.includes(exercise.id)} aria-disabled={date !== today || done || busy}
                    disabled={date !== today || done || busy} onPress={() => void act(() => toggleExercise(date, exercise.id))}
                    style={[styles.exercise, { borderColor: colors.border }]}>
                    <Ionicons name={checked.includes(exercise.id) ? 'checkbox' : 'square-outline'} size={26} color={checked.includes(exercise.id) ? colors.success : colors.textTertiary} />
                    <View style={styles.flex}>
                      <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{t(`workouts.exercises.${exercise.id}`)}</Text>
                      <Text style={{ color: colors.textSecondary }}>{prescription(exercise)}</Text>
                    </View>
                  </Pressable>
                ))}
                {date === today && !done ? (
                  <>
                    <Text style={{ color: colors.textSecondary }}>{t('workouts.completeHint')}</Text>
                    {!attended ? <Button variant="secondary" label={t('history.checkIn')} disabled={!!session || sessionBusy || busy} loading={sessionBusy}
                      onPress={() => void act(async () => { if (!userId || !await checkIn(userId)) throw new Error('Check-in failed'); })} /> : null}
                    <Button label={t('workouts.completeWorkout')} disabled={!attended || !allChecked || busy} loading={busy}
                      onPress={() => void act(async () => { if (!await complete(date)) throw new Error('Workout incomplete'); })} />
                  </>
                ) : <Text style={{ color: done ? colors.success : colors.textSecondary }}>{t(done ? 'workouts.status.completed' : 'workouts.readOnly')}</Text>}
              </View>
            ) : <Text style={{ color: colors.textSecondary }}>{t('workouts.restDay')}</Text>}
            <Text style={{ color: colors.textSecondary }}>{t('workouts.trainingHint')}</Text>
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 36 },
  heading: { fontSize: 28, fontWeight: '700' },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  weekStrip: { gap: 10 },
  weekCard: { width: 166 },
  card: { padding: 16, borderWidth: 1, borderRadius: 18, gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  exerciseName: { fontSize: 16 },
});
