import { checkScheduleConflict } from '../src/utils/scheduleValidation';
import type { ScheduleItem } from '../src/types/schedule';

const base = (p: Partial<ScheduleItem>): ScheduleItem =>
  ({
    id: 'x',
    academic_year_id: 'AY',
    day: 'MONDAY',
    period_number: 1,
    start_time: '07:00',
    end_time: '07:45',
    kelas: '1A',
    subject_name: 'Ummi',
    teacher_name: 'Ust. Ahmad',
    status: 'ACTIVE',
    ...p,
  }) as ScheduleItem;

let pass = 0;
let fail = 0;
const t = (name: string, got: boolean, want: boolean) => {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? 'OK   ' : 'GAGAL'} | harap ${want ? 'BENTROK' : 'AMAN   '} | dapat ${got ? 'BENTROK' : 'AMAN   '} | ${name}`,
  );
};

const rows: ScheduleItem[] = [
  base({ id: 'r1', halaqoh_id: 'HA', teacher_id: 'GA', teacher_name: 'Ust. Ahmad' }),
];

t(
  'halaqoh sama, jam tumpang',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:30', end_time: '08:15',
      kelas: '1A', teacher_name: 'Ust. Salim', teacher_id: 'GB', halaqoh_id: 'HA',
    },
    rows,
  ).hasConflict,
  true,
);

t(
  'kelas sama, halaqoh beda, guru beda (inti Ummi)',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:00', end_time: '07:45',
      kelas: '1A', teacher_name: 'Ust. Salim', teacher_id: 'GB', halaqoh_id: 'HB',
    },
    rows,
  ).hasConflict,
  false,
);

t(
  'guru sama (ID), halaqoh beda',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:00', end_time: '07:45',
      kelas: '1A', teacher_name: 'Ust. Ahmad', teacher_id: 'GA', halaqoh_id: 'HB',
    },
    rows,
  ).hasConflict,
  true,
);

t(
  'nama sama, ID beda -> bukan bentrok',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:00', end_time: '07:45',
      kelas: '1B', teacher_name: 'Ust. Ahmad', teacher_id: 'GZ', halaqoh_id: null,
    },
    rows,
  ).hasConflict,
  false,
);

t(
  'mapel biasa sekelas jam sama',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:00', end_time: '07:45',
      kelas: '1A', teacher_name: 'Ust. Budi', teacher_id: 'GC', halaqoh_id: null,
    },
    [base({ id: 'r2', kelas: '1A', halaqoh_id: null, teacher_id: 'GD', subject_name: 'Matematika' })],
  ).hasConflict,
  true,
);

t(
  'jam berdempet 07:45',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:45', end_time: '08:30',
      kelas: '1A', teacher_name: 'Ust. Ahmad', teacher_id: 'GA', halaqoh_id: 'HA',
    },
    rows,
  ).hasConflict,
  false,
);

t(
  'tahun ajaran beda',
  checkScheduleConflict(
    {
      academic_year_id: 'AY2', day: 'MONDAY', start_time: '07:00', end_time: '07:45',
      kelas: '1A', teacher_name: 'Ust. Ahmad', teacher_id: 'GA', halaqoh_id: 'HA',
    },
    rows,
  ).hasConflict,
  false,
);

t(
  'target ARCHIVED',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:00', end_time: '07:45',
      kelas: '1A', teacher_name: 'Ust. Ahmad', teacher_id: 'GA', halaqoh_id: 'HA',
      status: 'ARCHIVED',
    },
    rows,
  ).hasConflict,
  false,
);

t(
  'baris lama tanpa ID, nama sama -> bentrok',
  checkScheduleConflict(
    {
      academic_year_id: 'AY', day: 'MONDAY', start_time: '07:00', end_time: '07:45',
      kelas: '1A', teacher_name: 'Ust. Ahmad', teacher_id: null, halaqoh_id: null,
    },
    [base({ id: 'r3', teacher_id: null, halaqoh_id: null, teacher_name: 'Ust. Ahmad' })],
  ).hasConflict,
  true,
);

console.log(`\n${pass} lulus, ${fail} gagal`);
