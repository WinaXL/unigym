import { create } from 'zustand';
import { getWorkoutPlan } from '../data/workoutPlans';
import { readJson, writeJson, removeKey } from '../services/persistence';
import { emptyWorkoutProgress, isWorkoutProgress, shiftWorkoutDate, workoutOn, type WorkoutProgress } from '../services/workoutRules';
import { localCalendarDate } from '../utils/dateUtils';
import { useAuthStore } from './authStore';
import { useSessionStore } from './sessionStore';
import { useHistoryStore } from './historyStore';

const storageKey = (userId: string) => `unigym_workouts_${userId}`;
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(operation, operation);
  queue = run.catch(() => undefined);
  return run;
}

interface WorkoutState {
  userId: string | null;
  progress: WorkoutProgress;
  today: string;
  isLoading: boolean;
  load: (userId: string | null) => Promise<void>;
  refreshDate: () => void;
  choosePlan: (planId: string, weekdays: number[]) => Promise<void>;
  toggleExercise: (date: string, exerciseId: string) => Promise<void>;
  complete: (date: string) => Promise<boolean>;
  reset: () => Promise<void>;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  function forOwner<T>(operation: () => Promise<T>): Promise<T> {
    const owner = get().userId;
    return serialize(async () => {
      if (!owner || owner !== get().userId || owner !== useAuthStore.getState().userId) throw new Error('Workout profile changed');
      return operation();
    });
  }
  async function save(progress: WorkoutProgress) {
    const owner = get().userId;
    if (!owner || owner !== useAuthStore.getState().userId || get().isLoading) throw new Error('Workout profile unavailable');
    await writeJson(storageKey(owner), progress);
    if (get().userId === owner) set({ progress });
  }
  return {
    userId: null,
    progress: emptyWorkoutProgress(),
    today: localCalendarDate(new Date()),
    isLoading: true,
    load: (userId) => serialize(async () => {
      set({ userId, isLoading: true, progress: emptyWorkoutProgress() });
      const outcome = userId ? await readJson(storageKey(userId), isWorkoutProgress) : null;
      if (outcome?.status === 'corrupt' && userId) await removeKey(storageKey(userId));
      if (useAuthStore.getState().userId !== userId) return;
      set({ progress: outcome?.status === 'ok' ? outcome.value : emptyWorkoutProgress(), isLoading: false });
    }),
    refreshDate: () => set({ today: localCalendarDate(new Date()) }),
    choosePlan: (planId, weekdays) => forOwner(async () => {
      const plan = getWorkoutPlan(planId);
      const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
      if (!plan || sorted.length !== plan.days.length || sorted.some((day) => !Number.isInteger(day) || day < 1 || day > 6)) throw new Error('Invalid training days');
      const progress = get().progress;
      const today = localCalendarDate(new Date());
      // Changes start tomorrow so today's exercises and historical misses stay intact.
      const effectiveFrom = progress.schedules.length ? shiftWorkoutDate(today, 1) : today;
      await save({ ...progress, schedules: [
        ...progress.schedules.filter((schedule) => schedule.effectiveFrom < effectiveFrom),
        { planId, weekdays: sorted, effectiveFrom },
      ] });
    }),
    toggleExercise: (date, exerciseId) => forOwner(async () => {
      const progress = get().progress;
      const workout = workoutOn(progress, date);
      if (date !== localCalendarDate(new Date()) || progress.completed.includes(date) ||
          !workout?.exercises.some((exercise) => exercise.id === exerciseId)) return;
      const current = progress.checked[date] ?? [];
      const checked = current.includes(exerciseId) ? current.filter((id) => id !== exerciseId) : [...current, exerciseId];
      await save({ ...progress, checked: { ...progress.checked, [date]: checked } });
    }),
    complete: (date) => forOwner(async () => {
      const { progress, userId } = get();
      const workout = workoutOn(progress, date);
      if (!workout || date !== localCalendarDate(new Date())) return false;
      if (progress.completed.includes(date)) return true;
      const checked = progress.checked[date] ?? [];
      const session = useSessionStore.getState().activeSession;
      const attended = (session?.userId === userId && session.date === date) ||
        useHistoryStore.getState().records.some((record) => record.userId === userId &&
          record.date === date && !!record.timeOut && !record.id.startsWith('att-sample-'));
      if (!attended || !workout.exercises.every((exercise) => checked.includes(exercise.id))) return false;
      await save({ ...progress, completed: [...progress.completed, date] });
      return true;
    }),
    reset: () => serialize(async () => {
      if (get().userId) await removeKey(storageKey(get().userId!));
      set({ userId: null, progress: emptyWorkoutProgress(), isLoading: false });
    }),
  };
});
