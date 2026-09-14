import { getAcademicYears, getSchedules } from './scheduleService';
import { getRekapAgenda } from './agendaService';
import type { ScheduleItem, ScheduleDay } from '../types/schedule';
import type { FullAgenda } from '../types';
import { timeToMinutes } from '../utils/scheduleValidation';

/**
 * Maps a JavaScript Date object (or current time) to ScheduleDay enum
 */
export function getScheduleDayFromDate(d: Date): ScheduleDay | null {
  const dayIndex = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  switch (dayIndex) {
    case 1:
      return 'MONDAY';
    case 2:
      return 'TUESDAY';
    case 3:
      return 'WEDNESDAY';
    case 4:
      return 'THURSDAY';
    case 5:
      return 'FRIDAY';
    default:
      return null; // Weekend
  }
}

/**
 * Formats a Date object to HH:mm string (24h)
 */
export function formatCurrentTime(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export interface DetectScheduleResult {
  schedule: ScheduleItem | null;
  allTodaySchedules: ScheduleItem[];
  existingAgenda: FullAgenda | null;
  conflictDetected: boolean;
  conflictMessage?: string;
  reason?: 'WEEKEND' | 'NO_ACTIVE_ACADEMIC_YEAR' | 'NO_SCHEDULE_CURRENT_TIME' | 'OK';
}

/**
 * Detects the active schedule for the logged-in teacher based on current day and time.
 * Rules:
 * 1. Active Academic Year only
 * 2. Active schedule status only
 * 3. Exact matching: teacher_name = logged-in teacher
 * 4. Day = current day (Monday - Friday)
 * 5. Time range: start_time <= current_time < end_time
 *    (e.g., 08:05–08:40 -> valid from 08:05:00 to 08:39:59. At 08:40:00 next slot activates)
 * 6. Conflict detection: if >1 overlapping schedule found for same teacher, flags conflict!
 * 7. Checks if an agenda has already been created today for this schedule.
 */
export async function detectCurrentTeacherSchedule(
  teacherName: string,
  now: Date = new Date()
): Promise<DetectScheduleResult> {
  if (!teacherName) {
    return {
      schedule: null,
      allTodaySchedules: [],
      existingAgenda: null,
      conflictDetected: false,
      reason: 'NO_SCHEDULE_CURRENT_TIME',
    };
  }

  // 1. Check day
  const currentDay = getScheduleDayFromDate(now);
  if (!currentDay) {
    return {
      schedule: null,
      allTodaySchedules: [],
      existingAgenda: null,
      conflictDetected: false,
      reason: 'WEEKEND',
    };
  }

  // 2. Get active academic year
  const academicYears = await getAcademicYears();
  const activeAY = academicYears.find((ay) => ay.status === 'ACTIVE');
  if (!activeAY) {
    return {
      schedule: null,
      allTodaySchedules: [],
      existingAgenda: null,
      conflictDetected: false,
      reason: 'NO_ACTIVE_ACADEMIC_YEAR',
    };
  }

  // 3. Get all active schedules for teacher on this day
  const teacherSchedules = await getSchedules({
    academicYearId: activeAY.id,
    day: currentDay,
    teacherName: teacherName.trim(),
    status: 'ACTIVE',
  });

  const currentTimeStr = formatCurrentTime(now);
  const currentMinutes = timeToMinutes(currentTimeStr);

  // Filter overlapping slots: start_time <= current_time < end_time
  const matchingSchedules = teacherSchedules.filter((slot) => {
    const startMin = timeToMinutes(slot.start_time);
    const endMin = timeToMinutes(slot.end_time);
    return currentMinutes >= startMin && currentMinutes < endMin;
  });

  // Check conflict: multiple active overlapping schedules for same teacher
  if (matchingSchedules.length > 1) {
    const msg = `Terdeteksi ${matchingSchedules.length} jadwal bentrok aktif untuk Anda pada jam ini (${currentTimeStr}): ${matchingSchedules
      .map((s) => `${s.class_id} - ${s.subject_name} (${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})`)
      .join(', ')}.`;
    console.error('CRITICAL SCHEDULE CONFLICT:', msg);
    return {
      schedule: null,
      allTodaySchedules: teacherSchedules,
      existingAgenda: null,
      conflictDetected: true,
      conflictMessage: msg,
      reason: 'NO_SCHEDULE_CURRENT_TIME',
    };
  }

  const activeSlot = matchingSchedules[0] || null;

  // 4. Check if agenda already created for this schedule today
  let existingAgenda: FullAgenda | null = null;
  const todayDateStr = now.toISOString().split('T')[0];

  if (activeSlot) {
    try {
      const todayAgendas = await getRekapAgenda({
        kelas: activeSlot.class_id,
        tanggal: todayDateStr,
      });

      // Match by schedule_id or header
      const found = todayAgendas.find(
        (a) =>
          a.header.schedule_id === activeSlot.id ||
          (a.header.kelas === activeSlot.class_id &&
            a.header.tanggal === todayDateStr &&
            a.kbm.some(
              (k) =>
                k.nama_guru.trim().toLowerCase() === teacherName.trim().toLowerCase() &&
                k.mapel.trim().toLowerCase() === activeSlot.subject_name.trim().toLowerCase()
            ))
      );
      if (found) {
        existingAgenda = found;
      }
    } catch (err) {
      console.warn('Error checking existing agenda for schedule:', err);
    }
  }

  return {
    schedule: activeSlot,
    allTodaySchedules: teacherSchedules,
    existingAgenda,
    conflictDetected: false,
    reason: activeSlot ? 'OK' : 'NO_SCHEDULE_CURRENT_TIME',
  };
}
