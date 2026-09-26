import type { ScheduleItem, ScheduleConflictCheckResult } from '../types/schedule';

/**
 * Converts a time string (HH:mm or HH:mm:ss) to minutes from start of day.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Checks if two time ranges [startA, endA) and [startB, endB) overlap.
 * Note: Back-to-back periods (e.g. 08:00 - 08:35 and 08:35 - 09:10) do NOT overlap.
 */
export function isTimeOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  // Strict interval overlap: max(aStart, bStart) < min(aEnd, bEnd)
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/**
 * Validates a target schedule against a list of existing schedules.
 * Checks for:
 * 1. Invalid time range (start >= end)
 * 2. Teacher conflict (same day, same teacher, overlapping time)
 * 3. Class conflict (same day, same class, overlapping time)
 *
 * Rules:
 * - Only checks items in same academic year
 * - Ignores ARCHIVED items (archived schedules do not cause conflicts)
 * - Ignores self (by id) when updating an existing schedule
 */
export function checkScheduleConflict(
  target: {
    id?: string;
    academic_year_id: string;
    day: string;
    start_time: string;
    end_time: string;
    class_id: string;
    teacher_name: string;
    status?: string;
  },
  existingSchedules: ScheduleItem[]
): ScheduleConflictCheckResult {
  const startMin = timeToMinutes(target.start_time);
  const endMin = timeToMinutes(target.end_time);

  if (startMin >= endMin) {
    return {
      hasConflict: true,
      message: `Jam mulai (${target.start_time}) harus lebih awal dari jam selesai (${target.end_time}).`,
    };
  }

  // Target being archived never creates conflict
  if (target.status === 'ARCHIVED') {
    return { hasConflict: false };
  }

  const normalizedTeacher = target.teacher_name.trim().toLowerCase();
  const normalizedClass = target.class_id.trim().toUpperCase();

  for (const item of existingSchedules) {
    // Skip self
    if (target.id && item.id === target.id) continue;
    // Skip different academic year
    if (item.academic_year_id !== target.academic_year_id) continue;
    // Skip archived schedules
    if (item.status === 'ARCHIVED') continue;
    // Skip different day
    if (item.day !== target.day) continue;

    // Check time overlap
    const overlaps = isTimeOverlapping(
      target.start_time,
      target.end_time,
      item.start_time,
      item.end_time
    );

    if (!overlaps) continue;

    // 1. Teacher conflict: same teacher, overlapping time
    if (item.teacher_name.trim().toLowerCase() === normalizedTeacher) {
      return {
        hasConflict: true,
        type: 'TEACHER_CONFLICT',
        conflictingItem: item,
        message: `Bentrok Guru: ${item.teacher_name} sudah memiliki jadwal di ${item.class_id} (${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}) pada hari yang sama.`,
      };
    }

    // 2. Class conflict: same class, overlapping time
    if (item.class_id.trim().toUpperCase() === normalizedClass) {
      return {
        hasConflict: true,
        type: 'CLASS_CONFLICT',
        conflictingItem: item,
        message: `Bentrok Kelas: ${item.class_id} sudah memiliki jadwal mata pelajaran "${item.subject_name}" dengan ${item.teacher_name} (${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}).`,
      };
    }
  }

  return { hasConflict: false };
}
