import { getAcademicYears, getSchedules } from './scheduleService';
import { localDateString } from '../utils/date';
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

export type SlotStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface DetectScheduleResult {
  schedule: ScheduleItem | null;
  allTodaySchedules: ScheduleItem[];
  existingAgenda: FullAgenda | null;
  conflictDetected: boolean;
  conflictMessage?: string;
  reason?: 'WEEKEND' | 'NO_ACTIVE_ACADEMIC_YEAR' | 'NO_SCHEDULE_CURRENT_TIME' | 'OK';
}

export interface TimelineSlot {
  schedule: ScheduleItem;
  status: SlotStatus;
  existingAgenda: FullAgenda | null;
  hasConflict?: boolean;
}

export interface TeacherDailyTimelineResult {
  date: string; // YYYY-MM-DD
  dayName: string;
  dayKey: ScheduleDay | null;
  academicYear: any | null;
  slots: TimelineSlot[];
  activeSlot: TimelineSlot | null;
  conflictDetected: boolean;
  conflictMessage?: string;
  reason?: 'WEEKEND' | 'NO_ACTIVE_ACADEMIC_YEAR' | 'NO_SCHEDULES' | 'OK';
}

/**
 * Computes slot status based on time, date, and existing agenda.
 */
export function computeSlotStatus(
  slot: ScheduleItem,
  existingAgenda: FullAgenda | null,
  targetDateStr: string,
  now: Date = new Date()
): SlotStatus {
  if (existingAgenda) {
    return 'COMPLETED';
  }

  const todayStr = localDateString(now);

  // Future date
  if (targetDateStr > todayStr) {
    return 'UPCOMING';
  }

  // Past date
  if (targetDateStr < todayStr) {
    return 'OVERDUE';
  }

  // Today
  const currentTimeStr = formatCurrentTime(now);
  const currentMin = timeToMinutes(currentTimeStr);
  const startMin = timeToMinutes(slot.start_time);
  const endMin = timeToMinutes(slot.end_time);

  if (currentMin < startMin) {
    return 'UPCOMING';
  }
  if (currentMin >= startMin && currentMin <= endMin) {
    return 'IN_PROGRESS';
  }
  return 'OVERDUE';
}

/**
 * Recomputes slot statuses locally using current time (no DB refetch needed).
 */
export function recomputeTimelineSlotStatuses(
  slots: TimelineSlot[],
  targetDateStr: string,
  now: Date = new Date()
): { slots: TimelineSlot[]; activeSlot: TimelineSlot | null } {
  const updatedSlots = slots.map((item) => ({
    ...item,
    status: computeSlotStatus(item.schedule, item.existingAgenda, targetDateStr, now),
  }));

  const activeSlot = updatedSlots.find((s) => s.status === 'IN_PROGRESS') || null;

  return {
    slots: updatedSlots,
    activeSlot,
  };
}

/**
 * Loads the complete daily schedule timeline for a teacher on a given date.
 */
export async function getTeacherDailyTimeline(
  teacherName: string,
  targetDate: Date | string,
  now: Date = new Date()
): Promise<TeacherDailyTimelineResult> {
  const targetDateObj = typeof targetDate === 'string' ? new Date(targetDate + 'T00:00:00') : targetDate;
  const targetDateStr =
    typeof targetDate === 'string' ? targetDate : localDateString(targetDate);

  const dayKey = getScheduleDayFromDate(targetDateObj);
  const dayNameMap: Record<string, string> = {
    MONDAY: 'Senin',
    TUESDAY: 'Selasa',
    WEDNESDAY: 'Rabu',
    THURSDAY: 'Kamis',
    FRIDAY: 'Jumat',
  };
  const dayName = dayKey ? dayNameMap[dayKey] : 'Akhir Pekan';

  if (!teacherName) {
    return {
      date: targetDateStr,
      dayName,
      dayKey,
      academicYear: null,
      slots: [],
      activeSlot: null,
      conflictDetected: false,
      reason: 'NO_SCHEDULES',
    };
  }

  if (!dayKey) {
    return {
      date: targetDateStr,
      dayName,
      dayKey: null,
      academicYear: null,
      slots: [],
      activeSlot: null,
      conflictDetected: false,
      reason: 'WEEKEND',
    };
  }

  const academicYears = await getAcademicYears();
  const activeAY = academicYears.find((ay) => ay.status === 'ACTIVE') || academicYears[0];
  if (!activeAY) {
    return {
      date: targetDateStr,
      dayName,
      dayKey,
      academicYear: null,
      slots: [],
      activeSlot: null,
      conflictDetected: false,
      reason: 'NO_ACTIVE_ACADEMIC_YEAR',
    };
  }

  // Fetch teacher schedules for this day
  const teacherSchedules = await getSchedules({
    academicYearId: activeAY.id,
    day: dayKey,
    teacherName: teacherName.trim(),
    status: 'ACTIVE',
  });

  if (teacherSchedules.length === 0) {
    return {
      date: targetDateStr,
      dayName,
      dayKey,
      academicYear: activeAY,
      slots: [],
      activeSlot: null,
      conflictDetected: false,
      reason: 'NO_SCHEDULES',
    };
  }

  // Fetch existing agendas for this date
  let agendasOnDate: FullAgenda[] = [];
  try {
    agendasOnDate = await getRekapAgenda({
      tanggal: targetDateStr,
      nama_guru: teacherName.trim(),
    });
  } catch (err) {
    console.warn('Gagal memuat rekap agenda tanggal:', targetDateStr, err);
  }

  // Check schedule conflicts (overlaps on same day for this teacher)
  let conflictDetected = false;
  let conflictMessage: string | undefined;

  for (let i = 0; i < teacherSchedules.length; i++) {
    for (let j = i + 1; j < teacherSchedules.length; j++) {
      const s1 = teacherSchedules[i];
      const s2 = teacherSchedules[j];
      const start1 = timeToMinutes(s1.start_time);
      const end1 = timeToMinutes(s1.end_time);
      const start2 = timeToMinutes(s2.start_time);
      const end2 = timeToMinutes(s2.end_time);

      if (Math.max(start1, start2) < Math.min(end1, end2)) {
        conflictDetected = true;
        conflictMessage = `Terdapat jadwal yang bertabrakan pada waktu ini (${s1.kelas} ${s1.subject_name} & ${s2.kelas} ${s2.subject_name}). Hubungi administrator.`;
        break;
      }
    }
    if (conflictDetected) break;
  }

  // Map each schedule to TimelineSlot
  const rawSlots: TimelineSlot[] = teacherSchedules.map((sch) => {
    // Find matching agenda.
    //
    // 1. Kunci utama: `schedule_id` persis. Ini satu-satunya kunci yang benar
    //    untuk mapel berkelompok, karena dua guru Ummi punya kelas + mapel +
    //    tanggal yang SAMA dan hanya `schedule_id` yang membedakan.
    //
    // 2. Cadangan (hanya agenda lama tanpa `schedule_id`): kelas + tanggal +
    //    guru + mapel + halaqoh. Cadangan ini WAJIB membandingkan halaqoh,
    //    kalau tidak dua halaqoh pada jam yang sama akan saling mengklaim
    //    agenda yang sama — guru kedua melihat (lalu menimpa) catatan guru
    //    pertama.
    //
    // Urutannya penting: kunci utama DIPERIKSA LEBIH DULU lewat pencarian
    // terpisah. Kalau keduanya digabung dalam satu `find`, agenda lama bisa
    // muncul lebih dulu di array dan menang — guru disodorkan catatan usang
    // padahal catatan barunya ada.
    const byId = agendasOnDate.find((a) => a.header.schedule_id === sch.id);

    const foundAgenda =
      byId ??
      agendasOnDate.find(
        (a) =>
          !a.header.schedule_id &&
          a.header.kelas === sch.kelas &&
          a.header.tanggal === targetDateStr &&
          a.kbm.some(
            (k) =>
              k.nama_guru.trim().toLowerCase() === teacherName.trim().toLowerCase() &&
              k.mapel.trim().toLowerCase() === sch.subject_name.trim().toLowerCase() &&
              (k.halaqoh_id ?? null) === (sch.halaqoh_id ?? null)
          )
      ) ??
      null;

    const status = computeSlotStatus(sch, foundAgenda, targetDateStr, now);

    return {
      schedule: sch,
      status,
      existingAgenda: foundAgenda,
    };
  });

  const activeSlot = rawSlots.find((s) => s.status === 'IN_PROGRESS') || null;

  return {
    date: targetDateStr,
    dayName,
    dayKey,
    academicYear: activeAY,
    slots: rawSlots,
    activeSlot,
    conflictDetected,
    conflictMessage,
    reason: 'OK',
  };
}

/**
 * Detects the active schedule for the logged-in teacher based on current day and time.
 * Rules:
 * 1. Active Academic Year only
 * 2. Active schedule status only
 * 3. Exact matching: teacher_name = logged-in teacher
 * 4. Day = current day (Monday - Friday)
 * 5. Time range: start_time <= current_time <= end_time
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

  const todayStr = localDateString(now);
  const timeline = await getTeacherDailyTimeline(teacherName, todayStr, now);

  if (timeline.conflictDetected) {
    return {
      schedule: null,
      allTodaySchedules: timeline.slots.map((s) => s.schedule),
      existingAgenda: null,
      conflictDetected: true,
      conflictMessage: timeline.conflictMessage,
      reason: 'NO_SCHEDULE_CURRENT_TIME',
    };
  }

  if (timeline.reason === 'WEEKEND') {
    return {
      schedule: null,
      allTodaySchedules: [],
      existingAgenda: null,
      conflictDetected: false,
      reason: 'WEEKEND',
    };
  }

  if (timeline.reason === 'NO_ACTIVE_ACADEMIC_YEAR') {
    return {
      schedule: null,
      allTodaySchedules: [],
      existingAgenda: null,
      conflictDetected: false,
      reason: 'NO_ACTIVE_ACADEMIC_YEAR',
    };
  }

  const activeSlot = timeline.activeSlot;

  return {
    schedule: activeSlot ? activeSlot.schedule : null,
    allTodaySchedules: timeline.slots.map((s) => s.schedule),
    existingAgenda: activeSlot ? activeSlot.existingAgenda : null,
    conflictDetected: false,
    reason: activeSlot ? 'OK' : 'NO_SCHEDULE_CURRENT_TIME',
  };
}

/**
 * Returns all ACTIVE schedules for a given date (across ALL teachers/classes),
 * paired with their existing agendas. Used for the substitute teacher flow.
 *
 * Excludes schedules belonging to `excludeTeacherName` (the logged-in teacher's
 * own schedules are already handled by their normal timeline).
 */
export async function getAllClassesTimelineForDate(
  date: string,
  excludeTeacherName: string,
  now: Date = new Date()
): Promise<TimelineSlot[]> {
  const dayKey = getScheduleDayFromDate(new Date(date + 'T00:00:00'));
  if (!dayKey) return [];

  const academicYears = await getAcademicYears();
  const activeAY = academicYears.find((ay) => ay.status === 'ACTIVE') || academicYears[0];
  if (!activeAY) return [];

  // All ACTIVE schedules for this day
  const allSchedules = await getSchedules({
    academicYearId: activeAY.id,
    day: dayKey,
    status: 'ACTIVE',
  });

  // Exclude logged-in teacher's own schedules
  const otherSchedules = allSchedules.filter(
    (s) => s.teacher_name.trim().toLowerCase() !== excludeTeacherName.trim().toLowerCase()
  );

  if (otherSchedules.length === 0) return [];

  // Fetch all agendas for this date (all classes)
  let agendasOnDate: FullAgenda[] = [];
  try {
    agendasOnDate = await getRekapAgenda({ tanggal: date });
  } catch {
    // non-fatal
  }

  return otherSchedules.map((sch) => {
    const foundAgenda =
      agendasOnDate.find(
        (a) =>
          a.header.schedule_id === sch.id ||
          (!a.header.schedule_id &&
            a.header.kelas === sch.kelas &&
            a.header.tanggal === date)
      ) || null;

    const status = computeSlotStatus(sch, foundAgenda, date, now);
    return { schedule: sch, status, existingAgenda: foundAgenda };
  });
}

/**
 * All ACTIVE schedules for a date across every class/teacher.
 * Used by the admin agenda desk (not the teacher "jadwal saya" flow).
 */
export async function getSchoolDailyTimelineForDate(
  date: string,
  now: Date = new Date()
): Promise<TeacherDailyTimelineResult> {
  const dateObj = new Date(date + 'T00:00:00');
  const dayKey = getScheduleDayFromDate(dateObj);
  const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });

  if (!dayKey) {
    return {
      date,
      dayName,
      dayKey: null,
      academicYear: null,
      slots: [],
      activeSlot: null,
      conflictDetected: false,
      reason: 'WEEKEND',
    };
  }

  const academicYears = await getAcademicYears();
  const activeAY = academicYears.find((ay) => ay.status === 'ACTIVE') || academicYears[0];
  if (!activeAY) {
    return {
      date,
      dayName,
      dayKey,
      academicYear: null,
      slots: [],
      activeSlot: null,
      conflictDetected: false,
      reason: 'NO_ACTIVE_ACADEMIC_YEAR',
    };
  }

  const allSchedules = await getSchedules({
    academicYearId: activeAY.id,
    day: dayKey,
    status: 'ACTIVE',
  });

  let agendasOnDate: FullAgenda[] = [];
  try {
    agendasOnDate = await getRekapAgenda({ tanggal: date });
  } catch {
    // non-fatal
  }

  const slots: TimelineSlot[] = allSchedules
    .map((sch) => {
      const foundAgenda =
        agendasOnDate.find(
          (a) =>
            a.header.schedule_id === sch.id ||
            (!a.header.schedule_id &&
              a.header.kelas === sch.kelas &&
              a.header.tanggal === date)
        ) || null;

      return {
        schedule: sch,
        status: computeSlotStatus(sch, foundAgenda, date, now),
        existingAgenda: foundAgenda,
      };
    })
    .sort((a, b) => {
      const classCmp = a.schedule.kelas.localeCompare(b.schedule.kelas, 'id');
      if (classCmp !== 0) return classCmp;
      return a.schedule.start_time.localeCompare(b.schedule.start_time);
    });

  const { activeSlot } = recomputeTimelineSlotStatuses(slots, date, now);

  return {
    date,
    dayName,
    dayKey,
    academicYear: activeAY,
    slots,
    activeSlot,
    conflictDetected: false,
    reason: slots.length === 0 ? 'NO_SCHEDULES' : 'OK',
  };
}
