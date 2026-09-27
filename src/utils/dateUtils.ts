// src/utils/dateUtils.ts
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export function formatDate(isoString: string): string {
  try {
    return format(new Date(isoString), 'MMM d, yyyy');
  } catch {
    return isoString;
  }
}

export function formatTime(isoString: string): string {
  try {
    return format(new Date(isoString), 'HH:mm');
  } catch {
    return isoString;
  }
}

export function formatDateGroup(isoDateString: string, t: (key: string) => string): string {
  try {
    const date = new Date(isoDateString);
    if (isToday(date)) return t('history.today');
    if (isYesterday(date)) return t('history.yesterday');
    return format(date, 'EEEE, MMM d');
  } catch {
    return isoDateString;
  }
}

export function getGreetingTime(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('dashboard.morning');
  if (hour < 17) return t('dashboard.afternoon');
  return t('dashboard.evening');
}

export function secondsUntil(timestamp: number): number {
  return Math.max(0, Math.floor((timestamp - Date.now()) / 1000));
}
