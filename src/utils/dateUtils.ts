// src/utils/dateUtils.ts
import { format, isToday, isYesterday } from 'date-fns';

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
    // Parsed as local midnight so that "Today" and "Yesterday" are decided in
    // the user's timezone rather than against a UTC-midnight instant.
    const date = parseLocalCalendarDate(isoDateString);
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

/**
 * YYYY-MM-DD for the *local* calendar day.
 *
 * `toISOString().split('T')[0]` returns the UTC day, which files an 02:00
 * check-in in UTC+3 under the previous date and then groups it under the wrong
 * heading in the history list.
 */
export function localCalendarDate(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD calendar date as local midnight, for display grouping. */
export function parseLocalCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
