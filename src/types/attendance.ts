// src/types/attendance.ts
export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;       // ISO 8601 date (YYYY-MM-DD)
  timeIn: string;     // ISO 8601 datetime
  timeOut?: string;   // ISO 8601 datetime, undefined if still checked in
  zone: string;       // e.g. 'main_hall', 'pool', 'yoga_studio'
  durationMinutes?: number;
}

export interface AttendancePage {
  records: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
