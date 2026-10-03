import { checkScheduleConflict, isTimeOverlapping } from './src/utils/scheduleValidation.ts';
import type { ScheduleItem } from './src/types/schedule.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
}

console.log('--- Testing isTimeOverlapping ---');
// Back-to-back: 08:00 - 08:35 vs 08:35 - 09:10
assert(!isTimeOverlapping('08:00', '08:35', '08:35', '09:10'), 'Back-to-back periods do NOT overlap');
// Direct overlap: 08:00 - 08:40 vs 08:20 - 08:55
assert(isTimeOverlapping('08:00', '08:40', '08:20', '08:55'), 'Overlapping periods DO overlap');
// Enclosed: 08:00 - 09:00 vs 08:15 - 08:45
assert(isTimeOverlapping('08:00', '09:00', '08:15', '08:45'), 'Enclosed periods DO overlap');

console.log('\n--- Testing checkScheduleConflict ---');
const mockExisting: ScheduleItem[] = [
  {
    id: '1',
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    period_number: 1,
    start_time: '08:00',
    end_time: '08:35',
    kelas: '1A',
    subject_name: 'Matematika',
    teacher_name: 'Guru A',
    status: 'ACTIVE',
  },
  {
    id: '2',
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    period_number: 2,
    start_time: '08:35',
    end_time: '09:10',
    kelas: '1A',
    subject_name: 'Bahasa Indonesia',
    teacher_name: 'Guru B',
    status: 'ACTIVE',
  },
  {
    id: '3',
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    period_number: 1,
    start_time: '08:00',
    end_time: '08:35',
    kelas: '2A',
    subject_name: 'Tematik',
    teacher_name: 'Guru C',
    status: 'ACTIVE',
  },
  {
    id: '4',
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    period_number: 1,
    start_time: '08:00',
    end_time: '08:35',
    kelas: '3A',
    subject_name: 'PAI',
    teacher_name: 'Guru D',
    status: 'ARCHIVED', // Archived should not cause conflict!
  },
];

// Test 1: Teacher Overlap -> FAIL
const teacherConflict = checkScheduleConflict(
  {
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    start_time: '08:20',
    end_time: '08:55',
    kelas: '4A',
    teacher_name: 'Guru A', // Guru A already at KELAS 1 08:00-08:35
  },
  mockExisting
);
assert(teacherConflict.hasConflict && teacherConflict.type === 'TEACHER_CONFLICT', 'Teacher overlap detected and rejected');

// Test 2: Class Overlap -> FAIL
const classConflict = checkScheduleConflict(
  {
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    start_time: '08:20',
    end_time: '08:55',
    kelas: '1A', // KELAS 1 already has Guru A 08:00-08:35 and Guru B 08:35-09:10
    teacher_name: 'Guru Z',
  },
  mockExisting
);
assert(classConflict.hasConflict && classConflict.type === 'CLASS_CONFLICT', 'Class overlap detected and rejected');

// Test 3: Different teacher same time in different class -> OK
const validSimultaneous = checkScheduleConflict(
  {
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    start_time: '08:00',
    end_time: '08:35',
    kelas: '5A',
    teacher_name: 'Guru E',
  },
  mockExisting
);
assert(!validSimultaneous.hasConflict, 'Different teacher same time in different class is valid');

// Test 4: Back-to-back periods for same teacher in different class -> OK
const validBackToBack = checkScheduleConflict(
  {
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    start_time: '08:35',
    end_time: '09:10',
    kelas: '2A',
    teacher_name: 'Guru A', // Guru A finishes in KELAS 1 at 08:35, then teaches KELAS 2 at 08:35
  },
  mockExisting
);
assert(!validBackToBack.hasConflict, 'Back-to-back periods for same teacher are valid');

// Test 5: Overlap with ARCHIVED schedule -> OK
const archiveIgnore = checkScheduleConflict(
  {
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    start_time: '08:00',
    end_time: '08:35',
    kelas: '3A',
    teacher_name: 'Guru F', // KELAS 3 has Guru D at 08:00-08:35 but status is ARCHIVED
  },
  mockExisting
);
assert(!archiveIgnore.hasConflict, 'Archived schedules do NOT cause conflict');

// Test 6: Self-update -> OK
const selfUpdate = checkScheduleConflict(
  {
    id: '1',
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    start_time: '08:00',
    end_time: '08:35',
    kelas: '1A',
    teacher_name: 'Guru A',
  },
  mockExisting
);
assert(!selfUpdate.hasConflict, 'Self-update does NOT conflict with itself');

// Test 7: Invalid time range -> FAIL
const invalidTime = checkScheduleConflict(
  {
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    start_time: '09:00',
    end_time: '08:00',
    kelas: '1A',
    teacher_name: 'Guru A',
  },
  mockExisting
);
assert(invalidTime.hasConflict, 'Start time >= End time rejected');

console.log('\n🎉 ALL CONFLICT ENGINE TESTS PASSED!');
