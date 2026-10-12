import { getWorkoutPlan, type WorkoutDay } from '../data/workoutPlans';
import { isCalendarDate } from './schemas';
import { localCalendarDate } from '../utils/dateUtils';

export interface WorkoutSchedule {
  effectiveFrom: string;
  planId: string;
  weekdays: number[];
}

export interface WorkoutProgress {
  schedules: WorkoutSchedule[];
  checked: Record<string, string[]>;
  completed: string[];
}

export const emptyWorkoutProgress = (): WorkoutProgress => ({ schedules: [], checked: {}, completed: [] });

export function shiftWorkoutDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  // Noon avoids DST transitions at midnight. These are local calendar days.
  return localCalendarDate(new Date(year, month - 1, day + days, 12));
}

export function workoutWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12).getDay();
}

export function scheduleOn(progress: WorkoutProgress, date: string): WorkoutSchedule | undefined {
  return progress.schedules.findLast((schedule) => schedule.effectiveFrom <= date);
}

export function workoutOn(progress: WorkoutProgress, date: string): WorkoutDay | undefined {
  const schedule = scheduleOn(progress, date);
  if (!schedule) return undefined;
  const index = schedule.weekdays.indexOf(workoutWeekday(date));
  return index < 0 ? undefined : getWorkoutPlan(schedule.planId)?.days[index];
}

/** One missed scheduled day is grace; a second consecutive miss resets. */
export function workoutStreak(progress: WorkoutProgress, today: string) {
  let count = 0;
  let misses = 0;
  const completed = new Set(progress.completed);
  const start = progress.schedules[0]?.effectiveFrom;
  if (!start) return { count, misses };
  let scheduleIndex = 0;
  for (let date = start; date <= today; date = shiftWorkoutDate(date, 1)) {
    while (progress.schedules[scheduleIndex + 1]?.effectiveFrom <= date) scheduleIndex++;
    if (!progress.schedules[scheduleIndex].weekdays.includes(workoutWeekday(date))) continue;
    if (completed.has(date)) {
      count++;
      misses = 0;
    } else if (date < today) {
      misses = Math.min(2, misses + 1);
      if (misses === 2) count = 0;
    }
  }
  return { count, misses };
}

export function isWorkoutProgress(value: unknown): value is WorkoutProgress {
  if (!value || typeof value !== 'object') return false;
  const data = value as WorkoutProgress;
  if (!Array.isArray(data.schedules) || !Array.isArray(data.completed) ||
      !data.checked || typeof data.checked !== 'object' || Array.isArray(data.checked)) return false;
  const dates = data.schedules.map((schedule) => schedule?.effectiveFrom);
  const earliest = localCalendarDate(new Date(2020, 0, 1));
  return data.schedules.every((schedule, index) => {
    const plan = getWorkoutPlan(schedule?.planId);
    return !!plan && isCalendarDate(schedule.effectiveFrom) && schedule.effectiveFrom >= earliest &&
      (index === 0 || schedule.effectiveFrom > dates[index - 1]) &&
      Array.isArray(schedule.weekdays) && schedule.weekdays.length === plan.days.length &&
      schedule.weekdays.every((day, i) => Number.isInteger(day) && day >= 1 && day <= 6 &&
        (i === 0 || day > schedule.weekdays[i - 1]));
  }) && data.completed.every((date) => isCalendarDate(date) && !!workoutOn(data, date)) &&
    Object.entries(data.checked).every(([date, ids]) => {
      const workout = isCalendarDate(date) ? workoutOn(data, date) : undefined;
      return !!workout && Array.isArray(ids) && ids.every((id) =>
        workout.exercises.some((exercise) => exercise.id === id));
    });
}
