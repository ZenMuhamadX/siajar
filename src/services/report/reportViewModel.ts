import type { FullAgenda, Substitution } from '../../types';
import type { ScheduleItem } from '../../types/schedule';
import { computeSlotStatus, getScheduleDayFromDate } from '../scheduleDetectionService';
import { timeToMinutes } from '../../utils/scheduleValidation';
import type { ReportStatus } from './reportStatus';

/**
 * View-model laporan: SATU tempat aturan "slot jadwal ↔ agenda terisi" hidup.
 *
 * Kenapa perlu: aturan ini sebelumnya ditulis dua kali —
 *   - `getDailyReport` (mendeteksi badal lewat 3 sumber: record `substitutions`,
 *     `header.actual_teacher_name`, lalu `kbm.is_badal`/nama guru berbeda), dan
 *   - `getWeeklyReport` (hanya 2 sumber, tanpa `kbm`).
 * Akibatnya Rekap Harian dan Rekap Mingguan bisa menghitung badal &
 * ketercapaian yang berbeda untuk slot yang sama.
 *
 * `buildSlotRows()` di sini dipakai keduanya, sehingga angka antar halaman
 * dijamin berasal dari aturan yang sama.
 *
 * Fungsinya **murni**: tidak menyentuh jaringan/DB. Semua data (jadwal, agenda,
 * substitusi) sudah diambil pemanggil, jadi hasilnya mudah diuji.
 */

/** Baris laporan = satu slot jadwal (terisi atau tidak), atau satu agenda di luar jadwal. */
export interface SlotRow {
  /** Unik & stabil: `tanggal|scheduleId` atau `tanggal|manual|agendaId`. */
  key: string;
  date: string; // YYYY-MM-DD
  scheduleId: string | null;
  agendaId: string | null;
  classId: string;
  subjectName: string;
  /**
   * Nama halaqoh (kelompok) bila baris ini bagian dari mapel berkelompok.
   * `null` = seluruh kelas. Ikut sejak Fase 4b: tanpa ini, dua guru Ummi pada
   * kelas & jam yang sama menghasilkan dua baris rekap yang identik.
   */
  kelompok: string | null;
  scheduledTeacherName: string;
  actualTeacherName: string;
  isBadal: boolean;
  /** null bila agenda dibuat tanpa slot jadwal (waktu tidak diketahui). */
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  status: ReportStatus;
  hasDocumentation: boolean;
  /** true bila agenda dibuat tanpa schedule_id. */
  isUnscheduled: boolean;
  evidenceUrl: string | null;
  agenda: FullAgenda | null;
  substitution: Substitution | null;
}

export interface BuildSlotRowsInput {
  /** Tanggal yang dibuat barisnya (YYYY-MM-DD). Akhir pekan dilewati. */
  dates: string[];
  /** Jadwal aktif pada rentang tersebut. */
  schedules: ScheduleItem[];
  /** Agenda dalam rentang (sudah terisi `evidence.signedUrl` bila ada). */
  agendas: FullAgenda[];
  /** Substitusi dalam rentang; yang `cancelled_at` terisi diabaikan pemanggil. */
  substitutions: Substitution[];
  /** "Sekarang" untuk menentukan status slot yang belum Terisi. */
  now?: Date;
}

/** Hitung selisih waktu dalam menit. Contoh: 08:05–08:40 → 35. */
export function calculateSlotDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  return Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
}

/** Format menit jadi "1j 40m" / "35m". */
export function formatMinutesToHourMin(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}j ${mins}m`;
  if (hours > 0) return `${hours}j`;
  return `${mins}m`;
}

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();
const slotKey = (scheduleId: string, date: string) => `${scheduleId}|${date}`;

/**
 * Cari agenda yang mengisi sebuah slot.
 *
 * 1. Modern: `agenda_header.schedule_id` cocok.
 * 2. Legacy: agenda lama tanpa `schedule_id` dicocokkan lewat kelas + tanggal +
 *    nama guru + mapel (data sebelum kolom `schedule_id` ada).
 */
function findAgenda(
  schedule: ScheduleItem,
  date: string,
  bySlot: Map<string, FullAgenda>,
  legacyCandidates: FullAgenda[]
): FullAgenda | null {
  const direct = bySlot.get(slotKey(schedule.id, date));
  if (direct) return direct;

  const legacy = legacyCandidates.find(
    (a) =>
      a.header.kelas === schedule.kelas &&
      a.header.tanggal === date &&
      (a.kbm || []).some(
        (k) =>
          norm(k.nama_guru) === norm(schedule.teacher_name) &&
          norm(k.mapel) === norm(schedule.subject_name) &&
          // WAJIB: dua halaqoh pada kelas & jam yang sama akan saling mengklaim
          // agenda yang sama tanpa perbandingan ini — satu agenda tampil dua
          // kali di rekap dan gurunya tertukar.
          (k.halaqoh_id ?? null) === (schedule.halaqoh_id ?? null)
      )
  );
  return legacy || null;
}

/**
 * Nama halaqoh dari baris KBM agenda — cadangan untuk agenda lama yang dibuat
 * sebelum `halaqoh_id` dipakai (baris jadwal saat itu belum berkelompok).
 *
 * Mencari baris yang benar-benar punya nama; satu agenda bisa punya beberapa
 * baris KBM dan hanya sebagiannya berkelompok.
 */
function findKbmHalaqoh(agenda: FullAgenda | null): string | null {
  const baris = (agenda?.kbm || []).find((k) => (k.halaqoh || '').trim().length > 0);
  return baris?.halaqoh ?? null;
}

/**
 * Tentukan siapa yang benar-benar mengajar & apakah itu badal.
 *
 * Tiga sumber, berurutan dari yang paling tepercaya:
 *   1. record `substitutions` (punya alasan & Dibuat Oleh),
 *   2. `agenda_header.actual_teacher_name` bila beda dari guru terjadwal,
 *   3. `kbm.is_badal` atau `kbm.nama_guru` yang beda (data yang hanya menyimpan
 *      digantikan oleh guru lain).
 *
 * Meliput case (3) inilah yang sebelumnya hanya ada di Rekap Harian, sementara
 * Rekap Mingguan melewatkannya sehingga hitungannya berbeda.
 */
function resolveTeacher(
  schedule: ScheduleItem,
  agenda: FullAgenda | null,
  substitution: Substitution | null
): { actualTeacherName: string; isBadal: boolean } {
  const scheduled = schedule.teacher_name;

  if (substitution) {
    return { actualTeacherName: substitution.substitute_teacher_name.trim(), isBadal: true };
  }

  if (agenda?.header.actual_teacher_name) {
    const actual = agenda.header.actual_teacher_name;
    return { actualTeacherName: actual, isBadal: norm(actual) !== norm(scheduled) };
  }

  const badalKbm = (agenda?.kbm || []).find(
    (k) => k.is_badal || (k.nama_guru && norm(k.nama_guru) !== norm(scheduled))
  );
  if (badalKbm) {
    return { actualTeacherName: badalKbm.nama_guru, isBadal: true };
  }

  return { actualTeacherName: scheduled, isBadal: false };
}

/** Bangun baris laporan untuk daftar tanggal + jadwal + agenda + substitusi. */
export function buildSlotRows(input: BuildSlotRowsInput): SlotRow[] {
  const { dates, schedules, agendas, substitutions } = input;
  const now = input.now ?? new Date();

  // Indeks agar pencocokan O(1), bukan `find` di dalam loop.
  const bySlot = new Map<string, FullAgenda>();
  const legacyCandidates: FullAgenda[] = [];
  for (const a of agendas) {
    if (a.header.schedule_id) bySlot.set(slotKey(a.header.schedule_id, a.header.tanggal), a);
    else legacyCandidates.push(a);
  }

  const subBySlot = new Map<string, Substitution>();
  for (const s of substitutions) {
    if (s.cancelled_at) continue;
    subBySlot.set(slotKey(s.schedule_id, s.substitution_date), s);
  }

  const dateSet = new Set(dates);
  const matchedAgendaIds = new Set<string>();
  const rows: SlotRow[] = [];

  const sortedDates = [...dates].sort();

  for (const date of sortedDates) {
    const dayKey = getScheduleDayFromDate(new Date(date + 'T00:00:00'));
    if (!dayKey) continue; // akhir pekan: tidak ada jadwal

    for (const schedule of schedules) {
      if (schedule.day !== dayKey) continue;

      const agenda = findAgenda(schedule, date, bySlot, legacyCandidates);
      if (agenda) matchedAgendaIds.add(agenda.header.id);

      const substitution = subBySlot.get(slotKey(schedule.id, date)) || null;
      const { actualTeacherName, isBadal } = resolveTeacher(schedule, agenda, substitution);

      let status: ReportStatus;
      if (agenda) {
        status = isBadal ? 'BADAL' : 'SELESAI';
      } else {
        const slotStatus = computeSlotStatus(schedule, null, date, now);
        status =
          slotStatus === 'IN_PROGRESS'
            ? 'SEDANG_BERLANGSUNG'
            : slotStatus === 'UPCOMING'
              ? 'BELUM_DIMULAI'
              : 'BELUM_TEREALISASI';
      }

      rows.push({
        key: slotKey(schedule.id, date),
        date,
        scheduleId: schedule.id,
        agendaId: agenda?.header.id || null,
        classId: schedule.kelas,
        subjectName: schedule.subject_name,
        // Baris jadwal adalah sumber utama: guru ditentukan di baris ini, jadi
        // halaqoh-nya pun pasti. Cadangan ke KBM hanya untuk agenda lama yang
        // dibuat sebelum kolom `halaqoh_id` dipakai.
        kelompok: schedule.halaqoh || findKbmHalaqoh(agenda) || null,
        scheduledTeacherName: schedule.teacher_name,
        actualTeacherName,
        isBadal,
        startTime: schedule.start_time.slice(0, 5),
        endTime: schedule.end_time.slice(0, 5),
        durationMinutes: calculateSlotDurationMinutes(schedule.start_time, schedule.end_time),
        status,
        hasDocumentation: Boolean(agenda?.evidence?.storage_path),
        isUnscheduled: false,
        evidenceUrl: agenda?.evidence?.signedUrl || null,
        agenda,
        substitution,
      });
    }
  }

  // Agenda yang tidak terikat slot jadwal tetap dilaporkan, tapi TANPA jam
  // karangan — dan ditandai agar tidak tercampur dengan slot terjadwal.
  for (const agenda of agendas) {
    if (matchedAgendaIds.has(agenda.header.id)) continue;
    if (!dateSet.has(agenda.header.tanggal)) continue;

    const kbmFirst = agenda.kbm?.[0];
    const isBadal = Boolean(kbmFirst?.is_badal);
    rows.push({
      key: `${agenda.header.tanggal}|manual|${agenda.header.id}`,
      date: agenda.header.tanggal,
      scheduleId: null,
      agendaId: agenda.header.id,
      classId: agenda.header.kelas,
      subjectName: kbmFirst?.mapel || 'Pembelajaran',
      // Agenda tanpa slot: satu-satunya sumber halaqoh adalah baris KBM-nya.
      kelompok: kbmFirst?.halaqoh || null,
      scheduledTeacherName:
        agenda.header.actual_teacher_name || kbmFirst?.nama_guru || 'Guru',
      actualTeacherName: agenda.header.actual_teacher_name || kbmFirst?.nama_guru || 'Guru',
      isBadal,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      status: isBadal ? 'BADAL' : 'SELESAI',
      hasDocumentation: Boolean(agenda.evidence?.storage_path),
      isUnscheduled: true,
      evidenceUrl: agenda.evidence?.signedUrl || null,
      agenda,
      substitution: null,
    });
  }

  // Urut: tanggal → jam mulai (baris tanpa jam selalu di akhir) → kelas.
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (!a.startTime || !b.startTime) {
      if (a.startTime && !b.startTime) return -1;
      if (!a.startTime && b.startTime) return 1;
      return a.classId.localeCompare(b.classId);
    }
    const timeCmp = a.startTime.localeCompare(b.startTime);
    if (timeCmp !== 0) return timeCmp;
    return a.classId.localeCompare(b.classId);
  });

  return rows;
}
