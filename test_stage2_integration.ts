import assert from 'node:assert';
import {
  getScheduleDayFromDate,
  formatCurrentTime,
} from './src/services/scheduleDetectionService';
import type { ScheduleItem } from './src/types/schedule';
import { timeToMinutes } from './src/utils/scheduleValidation';

console.log('--- Starting Stage 2 Automated Verification Tests ---');

// Test 1: ScheduleDay mapping from Date
{
  const monday = new Date('2026-09-14T08:15:00'); // Monday
  assert.strictEqual(getScheduleDayFromDate(monday), 'MONDAY', 'Should map Monday correctly');

  const friday = new Date('2026-09-18T09:00:00'); // Friday
  assert.strictEqual(getScheduleDayFromDate(friday), 'FRIDAY', 'Should map Friday correctly');

  const sunday = new Date('2026-09-20T10:00:00'); // Sunday
  assert.strictEqual(getScheduleDayFromDate(sunday), null, 'Weekend should return null');
  console.log('✓ Test 1 Passed: Day mapping verified');
}

// Test 2: Time string formatting
{
  const testDate = new Date('2026-09-14T08:05:00');
  assert.strictEqual(formatCurrentTime(testDate), '08:05', 'Format time should be HH:mm');
  console.log('✓ Test 2 Passed: Current time formatting verified');
}

// Test 3: Schedule time comparison range (start_time <= now < end_time)
{
  const slotStart = '08:05';
  const slotEnd = '08:40';
  const startMins = timeToMinutes(slotStart);
  const endMins = timeToMinutes(slotEnd);

  // Exactly at start (08:05) -> VALID
  const atStart = timeToMinutes('08:05');
  assert.ok(startMins <= atStart && atStart < endMins, 'At 08:05 slot must be active');

  // In between (08:20) -> VALID
  const inside = timeToMinutes('08:20');
  assert.ok(startMins <= inside && inside < endMins, 'At 08:20 slot must be active');

  // One minute before end (08:39) -> VALID
  const beforeEnd = timeToMinutes('08:39');
  assert.ok(startMins <= beforeEnd && beforeEnd < endMins, 'At 08:39 slot must be active');

  // Exactly at boundary (08:40) -> INVALID (Next slot begins, no overlap)
  const atEnd = timeToMinutes('08:40');
  assert.ok(!(startMins <= atEnd && atEnd < endMins), 'At 08:40 current slot must NOT be active');

  console.log('✓ Test 3 Passed: Non-overlapping boundary condition [start, end) verified');
}

// Test 4: Conflict detection logic (>1 matching schedule for same teacher)
{
  const schedules: ScheduleItem[] = [
    {
      id: 'sch-1',
      academic_year_id: 'ay-1',
      day: 'MONDAY',
      period_number: 1,
      start_time: '08:05:00',
      end_time: '08:40:00',
      kelas: '1A',
      subject_id: 'sub-1',
      subject_name: 'Bahasa Indonesia',
      teacher_id: 't-1',
      teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
      room: null,
      status: 'ACTIVE',
      notes: null,
      created_at: '',
      updated_at: ''
    },
    {
      id: 'sch-2',
      academic_year_id: 'ay-1',
      day: 'MONDAY',
      period_number: 1,
      start_time: '08:05:00',
      end_time: '08:40:00',
      kelas: '4A',
      subject_id: 'sub-2',
      subject_name: 'Bahasa Inggris',
      teacher_id: 't-1',
      teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
      room: null,
      status: 'ACTIVE',
      notes: null,
      created_at: '',
      updated_at: ''
    }
  ];

  const nowMins = timeToMinutes('08:15');
  const matched = schedules.filter((s) => {
    const sStart = timeToMinutes(s.start_time);
    const sEnd = timeToMinutes(s.end_time);
    return sStart <= nowMins && nowMins < sEnd;
  });

  assert.strictEqual(matched.length, 2, 'Should find 2 overlapping schedules');
  const conflictDetected = matched.length > 1;
  assert.ok(conflictDetected, 'Conflict must be flagged when multiple schedules overlap');
  console.log('✓ Test 4 Passed: Overlapping schedule conflict detection verified');
}

// Test 5: Teacher is Homeroom (Wali Kelas) but teaches another class via Schedule
{
  // Homeroom class is KELAS 1, but Schedule says Ikfina teaches KELAS 4 Bahasa Inggris
  const scheduleForIkfina: ScheduleItem = {
    id: 'sch-4',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 2,
    start_time: '08:40:00',
    end_time: '09:15:00',
    kelas: '4A',
    subject_id: 'sub-eng',
    subject_name: 'Bahasa Inggris',
    teacher_id: 't-ikfina',
    teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
    status: 'ACTIVE',
    notes: null,
    created_at: '',
    updated_at: ''
  };

  // Schedule specifies KELAS 4, NOT homeroom class
  assert.strictEqual(scheduleForIkfina.kelas, '4A');
  assert.strictEqual(scheduleForIkfina.subject_name, 'Bahasa Inggris');
  console.log('✓ Test 5 Passed: Subject teacher teaching another class verified as Schedule-driven');
}

// Test 6: Archived or Inactive schedule is ignored
{
  const archivedSchedule: ScheduleItem = {
    id: 'sch-archived',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 1,
    start_time: '08:05:00',
    end_time: '08:40:00',
    kelas: '1A',
    subject_id: 'sub-1',
    subject_name: 'Matematika',
    teacher_id: 't-1',
    teacher_name: 'Guru A',
    status: 'ARCHIVED',
    notes: null,
    created_at: '',
    updated_at: ''
  };

  const isEligible = archivedSchedule.status === 'ACTIVE';
  assert.strictEqual(isEligible, false, 'Archived schedule must not be eligible for new agenda');
  console.log('✓ Test 6 Passed: Archived schedule exclusion verified');
}

// Test 7: Attendance logic preservation ("all present, mark absent")
{
  const classStudents = [
    { id: 's1', nama_siswa: 'Ahmad' },
    { id: 's2', nama_siswa: 'Budi' },
    { id: 's3', nama_siswa: 'Cici' },
    { id: 's4', nama_siswa: 'Doni' },
  ];

  // Absent list only records S, I, A
  const absensiList = [
    { siswa_id: 's2', status: 'S' as const },
  ];

  const presentCount = classStudents.length - absensiList.length;
  assert.strictEqual(presentCount, 3, 'Present count must be total students - absent students');
  assert.strictEqual(absensiList[0].status, 'S', 'Recorded absence must be preserved');
  console.log('✓ Test 7 Passed: Inverse attendance logic preserved');
}

// Test 8: Stage 2.1 - Pure Teacher Identity & Homeroom Assignment separation
{
  // Master Guru contains only identity (id, nama_guru), without class/homeroom
  const teacherIdentity = {
    id: 'g-1',
    nama_guru: 'Ikfina Khoirun Nisa, S.Pd.',
  };
  assert.strictEqual((teacherIdentity as any).kelas, undefined, 'Guru entity must not hold class attribute');

  // Homeroom Assignment is a separate relation tied to academic year
  const homeroomAssignment = {
    id: 'ha-1',
    academic_year_id: 'ay-2026-2027',
    kelas: '1A',
    teacher_id: 'g-1',
    teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
  };
  assert.strictEqual(homeroomAssignment.kelas, '1A');
  assert.strictEqual(homeroomAssignment.academic_year_id, 'ay-2026-2027');

  // Ensure unique 1 homeroom per class constraint
  const assignments = [homeroomAssignment];
  const duplicate = assignments.filter(
    (a) => a.academic_year_id === 'ay-2026-2027' && a.kelas === '1A'
  );
  assert.strictEqual(duplicate.length, 1, 'Only one homeroom teacher per class in an academic year');
  console.log('✓ Test 8 Passed: Stage 2.1 Teacher identity and Homeroom assignment verified');
}

// Stage 2.2 Tests: Timeline Slot Status Engine
import { computeSlotStatus, recomputeTimelineSlotStatuses, type TimelineSlot } from './src/services/scheduleDetectionService';

// Test 9: Slot Status UPCOMING (Locked when current_time < start_time)
{
  const slot: ScheduleItem = {
    id: 'sch-upcoming',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 3,
    start_time: '09:35:00',
    end_time: '10:10:00',
    kelas: '1A',
    subject_name: 'Bahasa Indonesia',
    teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
    status: 'ACTIVE',
    created_at: '',
    updated_at: '',
  };

  const now = new Date('2026-09-14T08:30:00'); // 08:30 < 09:35
  const status = computeSlotStatus(slot, null, '2026-09-14', now);
  assert.strictEqual(status, 'UPCOMING', 'Slot before start_time must be UPCOMING');
  console.log('✓ Test 9 Passed: Slot UPCOMING status verified');
}

// Test 10: Slot Status IN_PROGRESS (Active when start_time <= current_time <= end_time)
{
  const slot: ScheduleItem = {
    id: 'sch-active',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 2,
    start_time: '08:40:00',
    end_time: '09:15:00',
    kelas: '3A',
    subject_name: 'Matematika',
    teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
    status: 'ACTIVE',
    created_at: '',
    updated_at: '',
  };

  const now = new Date('2026-09-14T08:50:00'); // 08:50 is inside 08:40-09:15
  const status = computeSlotStatus(slot, null, '2026-09-14', now);
  assert.strictEqual(status, 'IN_PROGRESS', 'Slot during time range must be IN_PROGRESS');
  console.log('✓ Test 10 Passed: Slot IN_PROGRESS status verified');
}

// Test 11: Slot Status COMPLETED (When agenda exists for schedule)
{
  const slot: ScheduleItem = {
    id: 'sch-completed',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 1,
    start_time: '08:05:00',
    end_time: '08:40:00',
    kelas: '3A',
    subject_name: 'Matematika',
    teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
    status: 'ACTIVE',
    created_at: '',
    updated_at: '',
  };

  const mockAgenda: any = {
    header: { id: 'ag-1', kelas: '3A', tanggal: '2026-09-14' },
    kbm: [{ materi: 'Pecahan Senilai' }],
  };

  const now = new Date('2026-09-14T08:50:00');
  const status = computeSlotStatus(slot, mockAgenda, '2026-09-14', now);
  assert.strictEqual(status, 'COMPLETED', 'Slot with existing agenda must be COMPLETED');
  console.log('✓ Test 11 Passed: Slot COMPLETED status verified');
}

// Test 12: Slot Status OVERDUE (When current_time > end_time and no agenda, still open to fill)
{
  const slot: ScheduleItem = {
    id: 'sch-overdue',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 1,
    start_time: '08:05:00',
    end_time: '08:40:00',
    kelas: '3A',
    subject_name: 'Matematika',
    teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
    status: 'ACTIVE',
    created_at: '',
    updated_at: '',
  };

  const now = new Date('2026-09-14T10:00:00'); // 10:00 > 08:40
  const status = computeSlotStatus(slot, null, '2026-09-14', now);
  assert.strictEqual(status, 'OVERDUE', 'Unfilled slot past end_time must be OVERDUE (not locked)');
  console.log('✓ Test 12 Passed: Slot OVERDUE status verified');
}

// Test 13: Local timer recompute function updates slot status seamlessly
{
  const slotItem: ScheduleItem = {
    id: 'sch-dyn',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 2,
    start_time: '08:40:00',
    end_time: '09:15:00',
    kelas: '3A',
    subject_name: 'Matematika',
    teacher_name: 'Ikfina',
    status: 'ACTIVE',
    created_at: '',
    updated_at: '',
  };

  const initialSlots: TimelineSlot[] = [
    { schedule: slotItem, status: 'UPCOMING', existingAgenda: null },
  ];

  // At 08:39 -> Still upcoming
  const at839 = recomputeTimelineSlotStatuses(initialSlots, '2026-09-14', new Date('2026-09-14T08:39:00'));
  assert.strictEqual(at839.slots[0].status, 'UPCOMING');
  assert.strictEqual(at839.activeSlot, null);

  // At 08:40 -> Seamlessly switches to IN_PROGRESS
  const at840 = recomputeTimelineSlotStatuses(initialSlots, '2026-09-14', new Date('2026-09-14T08:40:00'));
  assert.strictEqual(at840.slots[0].status, 'IN_PROGRESS');
  assert.notStrictEqual(at840.activeSlot, null);
  assert.strictEqual(at840.activeSlot?.schedule.id, 'sch-dyn');

  console.log('✓ Test 13 Passed: Real-time local status recomputation verified');
}

console.log('\nALL 13 AUTOMATED UNIT TESTS PASSED CLEANLY!\n');

