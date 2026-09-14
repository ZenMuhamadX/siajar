export type AcademicYearStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface AcademicYear {
  id: string;
  name: string; // e.g. '2026/2027'
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: AcademicYearStatus;
  created_at?: string;
  updated_at?: string;
}

export type ScheduleDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';

export const SCHEDULE_DAYS: { key: ScheduleDay; label: string }[] = [
  { key: 'MONDAY', label: 'Senin' },
  { key: 'TUESDAY', label: 'Selasa' },
  { key: 'WEDNESDAY', label: 'Rabu' },
  { key: 'THURSDAY', label: 'Kamis' },
  { key: 'FRIDAY', label: 'Jumat' },
];

export const DAY_TRANSLATION_MAP: Record<ScheduleDay, string> = {
  MONDAY: 'Senin',
  TUESDAY: 'Selasa',
  WEDNESDAY: 'Rabu',
  THURSDAY: 'Kamis',
  FRIDAY: 'Jumat',
};

export type ScheduleStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type ActivityType = 'KBM' | 'EXTRACURRICULAR' | 'LIFESKILL' | 'SPECIAL';

export interface ScheduleItem {
  id: string;
  academic_year_id: string;
  day: ScheduleDay;
  period_number: number;
  start_time: string; // HH:mm or HH:mm:ss
  end_time: string;   // HH:mm or HH:mm:ss
  class_id: string;   // e.g. 'KELAS 1'
  subject_id?: string | null;
  subject_name: string;
  teacher_id?: string | null;
  teacher_name: string;
  activity_type?: ActivityType;
  status: ScheduleStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleConflictCheckResult {
  hasConflict: boolean;
  type?: 'TEACHER_CONFLICT' | 'CLASS_CONFLICT';
  message?: string;
  conflictingItem?: ScheduleItem;
}
