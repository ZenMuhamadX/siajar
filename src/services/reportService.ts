import { supabase } from '../lib/supabase';
import { localDateString } from '../utils/date';
import type { FullAgenda, Guru, Substitution } from '../types';
import type { AcademicYear, ScheduleItem } from '../types/schedule';
import { getAcademicYears, getSchedules } from './scheduleService';
import { getRekapAgenda } from './agendaService';
import { getKelasSumberMap } from './halaqohService';
import { getSubstitutionsForDate, getSubstitutionHistory } from './substitutionService';
import { getEvidenceSignedUrls } from './evidenceService';
import { getScheduleDayFromDate } from './scheduleDetectionService';
import {
  buildSlotRows,
  calculateSlotDurationMinutes,
  formatMinutesToHourMin,
  type SlotRow,
} from './report/reportViewModel';
import {
  isFilledStatus,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_BADGE,
  REPORT_STATUS_PRINT_LABEL,
  type ReportStatus,
} from './report/reportStatus';

/**
 * Lapisan ambil-data untuk laporan.
 *
 * File ini HANYA mengurus: ambil data dari DB, lalu mendelegasikan aturan hitung
 * ke `report/reportViewModel.ts`, baru merangkai agregasi.
 * Semua aturan "slot ↔ agenda" dan "siapa yang mengajar" berada di
 * view-model supaya Rekap Harian, Mingguan, dan Bulanan tidak lagi punya
 * versi masing-masing.
 */

// Helper durasi kini tinggal di view-model; diekspor ulang supaya pemanggil
// lama (halaman Mingguan/Bulanan) tidak perlu mengubah import.
export { calculateSlotDurationMinutes, formatMinutesToHourMin };

// ---------------------------------------------------------------------------
// TIPE DATA LAPORAN
// ---------------------------------------------------------------------------

/** Alias lama; diteruskan ke sumber tunggal di `report/reportStatus.ts`. */
export type ReportItemStatus = ReportStatus;

export { REPORT_STATUS_PRINT_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_BADGE, isFilledStatus };
export type { SlotRow };

/**
 * Satu baris rekap harian untuk KONSUMSI DASHBOARD.
 *
 * Foto (K-13): `evidenceUrl` HANYA boleh dipakai komponen dashboard/modal
 * detail + lightbox. Field ini TIDAK boleh masuk ke model cetak — model cetak
 * hanya memakai `hasDocumentation` (boolean). Lihat
 * `services/report/printReportModel.ts` (`assertNoImages` menegakkan aturan ini
 * secara runtime).
 */
export interface DailyReportItem {
  id: string; // schedule_id atau agenda_id
  scheduleId?: string | null;
  agendaId?: string | null;
  date: string; // YYYY-MM-DD
  /** null bila agenda dibuat tanpa slot jadwal (waktu tidak diketahui). */
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  classId: string;
  /**
   * Kelas-kelas yang dicakup baris ini (lihat `SlotRow.classIds`). Sesi halaqoh
   * lintas kelas berisi lebih dari satu kelas, sehingga penyaringan rekap per
   * kelas memakai daftar ini — bukan satu label.
   */
  classIds: string[];
  subjectName: string;
  /**
   * Nama halaqoh (kelompok) untuk mapel berkelompok; `null` = seluruh kelas.
   * Diteruskan dari `SlotRow.kelompok` supaya rekap harian & cetaknya bisa
   * membedakan dua guru Ummi pada kelas + jam yang sama.
   */
  kelompok: string | null;
  scheduledTeacherName: string;
  scheduledTeacherId?: string | null;
  actualTeacherName: string;
  actualTeacherId?: string | null;
  isBadal: boolean;
  status: ReportStatus;
  /** Status keberadaan dokumentasi — dipakai cetak (bukan gambarnya). */
  hasDocumentation: boolean;
  /** HANYA untuk dashboard: signed URL foto untuk lightbox. */
  evidenceUrl?: string | null;
  agenda?: FullAgenda | null;
  substitution?: Substitution | null;
  isUnscheduledAgenda?: boolean;
}

/**
 * Bentuk baris yang boleh masuk dokumen CETAK/EXPORT (K-13).
 *
 * Perbedaan penting dari `DailyReportItem`: tidak ada `evidenceUrl`, `agenda`,
 * atau `substitution` — hanya boolean `hasDocumentation`. Ini menjadikan
 * "foto tidak pernah tercetak" sebagai kontrak tipe, bukan kebetulan.
 */
export type PrintReportItem = Omit<
  DailyReportItem,
  'evidenceUrl' | 'agenda' | 'substitution'
>;

export interface TeacherSummaryStats {
  teacherName: string;
  teacherId?: string | null;
  jpScheduled: number;
  jpRealized: number;
  durationScheduledMin: number;
  durationRealizedMin: number;
  badalIn: number;
  badalOut: number;
  notRealized: number;
  realizationRate: number; // 0 - 100
}

export interface WeeklyReportResult {
  startDate: string; // Senin
  endDate: string; // Minggu
  academicYear: AcademicYear | null;
  teacherSummaries: TeacherSummaryStats[];
  totals: {
    totalJpScheduled: number;
    totalJpRealized: number;
    totalDurationScheduledMin: number;
    totalDurationRealizedMin: number;
    totalBadalIn: number;
    totalBadalOut: number;
    totalNotRealized: number;
    overallRealizationRate: number;
  };
}

export interface MonthlyReportResult {
  year: number;
  month: number; // 1 - 12
  monthName: string;
  academicYear: AcademicYear | null;
  teacherSummaries: TeacherSummaryStats[];
  totals: {
    totalJpScheduled: number;
    totalJpRealized: number;
    totalDurationScheduledMin: number;
    totalDurationRealizedMin: number;
    /** Guru pengganti yang masuk mengajar. */
    totalBadalIn: number;
    /** Guru terjadwal yang digantikan. */
    totalBadalOut: number;
    totalNotRealized: number;
    overallRealizationRate: number;
  };
}

// ---------------------------------------------------------------------------
// HELPER
// ---------------------------------------------------------------------------

/** Pilih tahun ajaran: dari pilihan → ACTIVE → mencakup tanggal → pertama. */
async function resolveAcademicYear(
  academicYearId: string | undefined,
  anchorDate: string
): Promise<AcademicYear | null> {
  const all = await getAcademicYears();
  const byId = academicYearId ? all.find((ay) => ay.id === academicYearId) : undefined;
  if (byId) return byId;
  return (
    all.find((ay) => ay.status === 'ACTIVE') ||
    all.find((ay) => anchorDate >= ay.start_date && anchorDate <= ay.end_date) ||
    all[0] ||
    null
  );
}

/**
 * Lengkapi agenda dengan signed URL foto untuk DASHBOARD admin (K-09, K-13).
 *
 * PENTING — pemisahan jalur:
 *   - Fungsi ini HANYA dipakai untuk tampilan dashboard (tabel + modal detail
 *     yang membuka lightbox foto). Foto tidak pernah masuk dokumen cetak.
 *   - Memakai `getEvidenceSignedUrls` (batch) alih-alih satu permintaan per
 *     berkas, sehingga memuat satu halaman penuh tidak lagi memicu N+1 request.
 *
 * Model cetak (`services/report/printReportModel.ts`) sengaja tidak menerima
 * field ini — hanya boolean `hasDocumentation`.
 */
async function attachSignedUrls(agendas: FullAgenda[]): Promise<FullAgenda[]> {
  const paths = agendas
    .map((a) => a.evidence?.storage_path)
    .filter((p): p is string => Boolean(p));

  if (paths.length === 0) return agendas;

  // Satu permintaan untuk semua foto, bukan satu per foto.
  const urlMap = await getEvidenceSignedUrls(paths);

  return agendas.map((agenda) => {
    const path = agenda.evidence?.storage_path;
    if (!path || !agenda.evidence) return agenda;
    const signedUrl = urlMap.get(path);
    if (!signedUrl) return agenda;
    return {
      ...agenda,
      evidence: { ...agenda.evidence, signedUrl },
    };
  });
}

/** Daftar tanggal berurutan (YYYY-MM-DD) dari start sampai end, inklusif. */
function listDates(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    out.push(localDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. REKAP HARIAN (DAILY REPORT)
// ---------------------------------------------------------------------------

export async function getDailyReport(options: {
  date: string; // YYYY-MM-DD
  academicYearId?: string;
  teacherName?: string;
  classId?: string;
  subjectName?: string;
  statusFilter?: string; // 'ALL' | ReportStatus
}): Promise<DailyReportItem[]> {
  const { date, academicYearId, teacherName, classId, subjectName, statusFilter } = options;
  const now = new Date();

  const selectedAY = await resolveAcademicYear(academicYearId, date);
  const dayKey = getScheduleDayFromDate(new Date(date + 'T00:00:00'));

  // 1. Jadwal yang berlaku pada hari tersebut
  let schedules: ScheduleItem[] = [];
  if (dayKey && selectedAY) {
    schedules = await getSchedules({
      academicYearId: selectedAY.id,
      day: dayKey,
      status: 'ACTIVE',
    });
  }

  // 2. Badal pada tanggal tersebut
  const substitutions = await getSubstitutionsForDate(date);

  // 3. Agenda pada tanggal tersebut
  const agendas = await attachSignedUrls(await getRekapAgenda({ tanggal: date }));

  // 4. Aturan hitung: SATU view-model untuk semua halaman.
  //    Peta kelas sumber halaqoh ikut diteruskan supaya sesi Ummi lintas kelas
  //    dikenali kelas mana saja yang menerima rekapnya.
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const halaqohKelas = await getKelasSumberMap();
  const rows = buildSlotRows({
    dates: [date],
    schedules,
    agendas,
    substitutions,
    halaqohKelas,
    now,
  });

  const items: DailyReportItem[] = rows.map((row) => {
    const schedule = row.scheduleId ? scheduleById.get(row.scheduleId) : undefined;
    return {
      id: row.scheduleId ?? row.agendaId ?? row.key,
      scheduleId: row.scheduleId,
      agendaId: row.agendaId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      durationMinutes: row.durationMinutes,
      classId: row.classId,
      classIds: row.classIds,
      subjectName: row.subjectName,
      kelompok: row.kelompok,
      scheduledTeacherName: row.scheduledTeacherName,
      scheduledTeacherId: schedule?.teacher_id ?? null,
      actualTeacherName: row.actualTeacherName,
      actualTeacherId: row.isBadal && row.substitution ? row.substitution.substitute_teacher_id : (schedule?.teacher_id ?? null),
      isBadal: row.isBadal,
      status: row.status,
      hasDocumentation: row.hasDocumentation,
      evidenceUrl: row.evidenceUrl,
      agenda: row.agenda,
      substitution: row.substitution,
      isUnscheduledAgenda: row.isUnscheduled,
    };
  });

  // 5. Terapkan filter (satu-satunya tempat filter harian berada)
  return items.filter((item) => {
    if (teacherName && teacherName !== 'SEMUA') {
      const matchScheduled = item.scheduledTeacherName.trim().toLowerCase() === teacherName.trim().toLowerCase();
      const matchActual = item.actualTeacherName.trim().toLowerCase() === teacherName.trim().toLowerCase();
      if (!matchScheduled && !matchActual) return false;
    }
    // Sesi halaqoh lintas kelas muncul di tiap kelas sumbernya: pencocokan
    // memakai daftar kelas, bukan satu label.
    if (classId && classId !== 'SEMUA' && !item.classIds.includes(classId)) return false;
    if (subjectName && subjectName !== 'SEMUA' && item.subjectName.trim().toLowerCase() !== subjectName.trim().toLowerCase())
      return false;
    if (statusFilter && statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// 2. REKAP MINGGUAN (WEEKLY REPORT)
// ---------------------------------------------------------------------------

/** Menghitung tanggal Senin s.d. Minggu dari tanggal tertentu. */
export function getMondayToSundayRange(d: Date): { monday: string; sunday: string; days: string[] } {
  const day = d.getDay(); // 0=Minggu … 6=Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const days: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    days.push(localDateString(cur));
  }
  return { monday: localDateString(monday), sunday: localDateString(sunday), days };
}

// ---------------------------------------------------------------------------
// CACHE RINGAN (K-10) + BATAS UNDUHAN (K-08)
// ---------------------------------------------------------------------------

/**
 * Plafon jumlah agenda yang diunduh untuk satu rentang laporan (K-08).
 *
 * Sebelumnya rekap mingguan/bulanan menarik SELURUH agenda dalam rentang tanpa
 * batas — satu bulan bisa ribuan baris dan membuat halaman tersendat/timeout.
 * Nilai ini menahan unduhan pada batas wajar; bila terlampaui, hasil ditandai
 * `truncated` supaya UI bisa memperingatkan alih-alih diam-diam memotong.
 */
export const REPORT_AGENDA_FETCH_LIMIT = 5000;

/** Masa hidup cache hasil laporan (K-10), dalam milidetik. */
const REPORT_CACHE_TTL_MS = 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const weeklyCache = new Map<string, CacheEntry<WeeklyReportResult>>();

/** Buang seluruh cache laporan — dipanggil saat data berubah (mis. setelah koreksi). */
export function invalidateReportCache(): void {
  weeklyCache.clear();
}

function weeklyCacheKey(o: {
  startDate: string;
  endDate: string;
  academicYearId?: string;
  teacherFilter?: string;
}): string {
  return `${o.startDate}|${o.endDate}|${o.academicYearId ?? ''}|${o.teacherFilter ?? 'SEMUA'}`;
}

export async function getWeeklyReport(options: {
  startDate: string; // YYYY-MM-DD (Senin)
  endDate: string; // YYYY-MM-DD (Minggu)
  academicYearId?: string;
  teacherFilter?: string;
}): Promise<WeeklyReportResult> {
  const { startDate, endDate, academicYearId, teacherFilter } = options;

  // K-10: navigasi bolak-balik antar periode tidak lagi mengunduh ulang.
  const key = weeklyCacheKey(options);
  const cached = weeklyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const selectedAY = await resolveAcademicYear(academicYearId, startDate);

  // Semua guru terdaftar tetap muncul sebagai baris (meski 0 JP).
  const { data: guruData } = await supabase
    .from('guru')
    .select('id, nama_guru, created_at')
    .order('nama_guru');
  const allTeachers: Guru[] = guruData || [];

  const statsMap = new Map<string, TeacherSummaryStats>();
  for (const g of allTeachers) {
    const name = g.nama_guru.trim();
    statsMap.set(name, {
      teacherName: name,
      teacherId: g.id,
      jpScheduled: 0,
      jpRealized: 0,
      durationScheduledMin: 0,
      durationRealizedMin: 0,
      badalIn: 0,
      badalOut: 0,
      notRealized: 0,
      realizationRate: 0,
    });
  }
  const ensureStat = (name: string, teacherId?: string | null): TeacherSummaryStats => {
    const key = name.trim();
    let stat = statsMap.get(key);
    if (!stat) {
      stat = {
        teacherName: key,
        teacherId: teacherId ?? null,
        jpScheduled: 0,
        jpRealized: 0,
        durationScheduledMin: 0,
        durationRealizedMin: 0,
        badalIn: 0,
        badalOut: 0,
        notRealized: 0,
        realizationRate: 0,
      };
      statsMap.set(key, stat);
    }
    return stat;
  };

  // Jadwal aktif (seluruh hari) + agenda & badal dalam rentang.
  //
  // K-08/K-13: agenda dibatasi (bukan tarik-semua) DAN tidak lagi melewati
  // `attachSignedUrls`. Rekap mingguan/bulanan adalah jalur AGREGASI yang juga
  // menyuplai dokumen cetak; foto tidak dibutuhkan di sini — yang dipakai hanya
  // boolean `hasDocumentation`, yang sudah tersedia dari `storage_path` tanpa
  // perlu signed URL. Ini menghapus N+1 sekaligus memastikan URL foto tidak
  // pernah menyentuh jalur cetak/export.
  const aySchedules: ScheduleItem[] = selectedAY
    ? await getSchedules({ academicYearId: selectedAY.id, status: 'ACTIVE' })
    : [];
  const agendas = await getRekapAgenda({
    startDate,
    endDate,
    limit: REPORT_AGENDA_FETCH_LIMIT,
  });
  const substitutions = await getSubstitutionHistory({ startDate, endDate });

  // Aturan hitung: view-model yang sama dengan Rekap Harian
  const halaqohKelas = await getKelasSumberMap();
  const rows = buildSlotRows({
    dates: listDates(startDate, endDate),
    schedules: aySchedules,
    agendas,
    substitutions,
    halaqohKelas,
  });

  const scheduleById = new Map(aySchedules.map((s) => [s.id, s]));

  for (const row of rows) {
    // Agenda di luar jadwal tidak punya slot, jadi tidak dihitung sebagai JP.
    if (row.scheduleId === null) continue;
    const schedule = scheduleById.get(row.scheduleId);
    if (!schedule) continue;

    const stat = ensureStat(schedule.teacher_name, schedule.teacher_id);
    const durMin = row.durationMinutes ?? 0;
    stat.jpScheduled += 1;
    stat.durationScheduledMin += durMin;

    if (isFilledStatus(row.status)) {
      if (row.isBadal) {
        // Guru terjadwal kehilangan JP (badal keluar), guru pengganti mendapat
        // JP terealisasi + badal masuk.
        stat.badalOut += 1;
        const subStat = ensureStat(
          row.actualTeacherName,
          row.substitution?.substitute_teacher_id ?? schedule.teacher_id
        );
        subStat.jpRealized += 1;
        subStat.durationRealizedMin += durMin;
        subStat.badalIn += 1;
      } else {
        stat.jpRealized += 1;
        stat.durationRealizedMin += durMin;
      }
    } else {
      stat.notRealized += 1;
    }
  }

  // Persentase + filter guru
  const summaries: TeacherSummaryStats[] = [];
  let totSched = 0;
  let totReal = 0;
  let totDurSched = 0;
  let totDurReal = 0;
  let totBadalIn = 0;
  let totBadalOut = 0;
  let totNotReal = 0;

  for (const s of statsMap.values()) {
    s.realizationRate =
      s.jpScheduled > 0
        ? Number(((s.jpRealized / s.jpScheduled) * 100).toFixed(1))
        : s.jpRealized > 0
          ? 100
          : 0;

    if (
      !teacherFilter ||
      teacherFilter === 'SEMUA' ||
      s.teacherName.trim().toLowerCase() === teacherFilter.trim().toLowerCase()
    ) {
      summaries.push(s);
      totSched += s.jpScheduled;
      totReal += s.jpRealized;
      totDurSched += s.durationScheduledMin;
      totDurReal += s.durationRealizedMin;
      totBadalIn += s.badalIn;
      totBadalOut += s.badalOut;
      totNotReal += s.notRealized;
    }
  }

  summaries.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  const result: WeeklyReportResult = {
    startDate,
    endDate,
    academicYear: selectedAY,
    teacherSummaries: summaries,
    totals: {
      totalJpScheduled: totSched,
      totalJpRealized: totReal,
      totalDurationScheduledMin: totDurSched,
      totalDurationRealizedMin: totDurReal,
      totalBadalIn: totBadalIn,
      totalBadalOut: totBadalOut,
      totalNotRealized: totNotReal,
      overallRealizationRate: totSched > 0 ? Number(((totReal / totSched) * 100).toFixed(1)) : 0,
    },
  };

  // K-10: simpan untuk navigasi bolak-balik periode dalam waktu singkat.
  weeklyCache.set(key, { value: result, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });

  return result;
}

// ---------------------------------------------------------------------------
// 3. REKAP BULANAN (MONTHLY REPORT)
// ---------------------------------------------------------------------------

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export async function getMonthlyReport(options: {
  year: number;
  month: number; // 1 - 12
  academicYearId?: string;
  teacherFilter?: string;
}): Promise<MonthlyReportResult> {
  const { year, month, academicYearId, teacherFilter } = options;
  const monthName = NAMA_BULAN[month - 1] || `Bulan ${month}`;

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Memakai perhitungan rentang yang sama dengan mingguan.
  const weeklyRes = await getWeeklyReport({ startDate, endDate, academicYearId, teacherFilter });

  return {
    year,
    month,
    monthName,
    academicYear: weeklyRes.academicYear,
    teacherSummaries: weeklyRes.teacherSummaries,
    totals: {
      totalJpScheduled: weeklyRes.totals.totalJpScheduled,
      totalJpRealized: weeklyRes.totals.totalJpRealized,
      totalDurationScheduledMin: weeklyRes.totals.totalDurationScheduledMin,
      totalDurationRealizedMin: weeklyRes.totals.totalDurationRealizedMin,
      // Bulanan sebelumnya hanya menampilkan badal yang "masuk" di kedua kolom
      // (+ dan −), sehingga angkanya tidak bisa dipercaya.
      totalBadalIn: weeklyRes.totals.totalBadalIn,
      totalBadalOut: weeklyRes.totals.totalBadalOut,
      totalNotRealized: weeklyRes.totals.totalNotRealized,
      overallRealizationRate: weeklyRes.totals.overallRealizationRate,
    },
  };
}
