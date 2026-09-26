import { supabase } from '../lib/supabase';
import { localDateString } from '../utils/date';
import type { FullAgenda, Guru, Substitution } from '../types';
import type { AcademicYear, ScheduleItem } from '../types/schedule';
import { getAcademicYears, getSchedules } from './scheduleService';
import { getRekapAgenda } from './agendaService';
import { getSubstitutionsForDate, getSubstitutionHistory } from './substitutionService';
import { getEvidenceSignedUrl } from './evidenceService';
import { getScheduleDayFromDate, computeSlotStatus } from './scheduleDetectionService';
import { timeToMinutes } from '../utils/scheduleValidation';

// ---------------------------------------------------------------------------
// HELPER DURATION & TIME UTILS
// ---------------------------------------------------------------------------

/**
 * Menghitung selisih waktu start_time dan end_time dalam menit.
 * Contoh: 08:05 dan 08:40 -> 35 menit.
 */
export function calculateSlotDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  return Math.max(0, endMin - startMin);
}

/**
 * Format menit ke string terbaca: e.g. 100 menit -> "1j 40m", 35 menit -> "35m"
 */
export function formatMinutesToHourMin(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}j ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}j`;
  }
  return `${mins}m`;
}

// ---------------------------------------------------------------------------
// TIPE DATA LAPORAN
// ---------------------------------------------------------------------------

export type ReportItemStatus =
  | 'SELESAI'
  | 'BADAL'
  | 'SEDANG_BERLANGSUNG'
  | 'BELUM_TEREALISASI'
  | 'BELUM_DIMULAI';

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
  subjectName: string;
  scheduledTeacherName: string;
  scheduledTeacherId?: string | null;
  actualTeacherName: string;
  actualTeacherId?: string | null;
  isBadal: boolean;
  status: ReportItemStatus;
  hasDocumentation: boolean;
  evidenceUrl?: string | null;
  agenda?: FullAgenda | null;
  substitution?: Substitution | null;
  isUnscheduledAgenda?: boolean; // Jika agenda dibuat manual tanpa schedule
}

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
    totalBadal: number;
    totalNotRealized: number;
    overallRealizationRate: number;
  };
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
  statusFilter?: string; // 'ALL' | ReportItemStatus
}): Promise<DailyReportItem[]> {
  const { date, academicYearId, teacherName, classId, subjectName, statusFilter } = options;
  const targetDateObj = new Date(date + 'T00:00:00');
  const dayKey = getScheduleDayFromDate(targetDateObj);

  // Ambil Academic Year (berdasarkan ID atau aktif pada rentang tanggal)
  const allAYs = await getAcademicYears();
  let selectedAY = allAYs.find((ay) => ay.id === academicYearId);
  if (!selectedAY) {
    // Cari yang aktif atau yang mencakup tanggal
    selectedAY =
      allAYs.find((ay) => ay.status === 'ACTIVE') ||
      allAYs.find((ay) => date >= ay.start_date && date <= ay.end_date) ||
      allAYs[0];
  }

  // 1. Ambil Schedules yang berlaku pada hari & AY tersebut
  let schedules: ScheduleItem[] = [];
  if (dayKey && selectedAY) {
    schedules = await getSchedules({
      academicYearId: selectedAY.id,
      day: dayKey,
      status: 'ACTIVE',
    });
  }

  // 2. Ambil Substitutions pada tanggal tersebut
  const substitutions = await getSubstitutionsForDate(date);
  const subMap = new Map<string, Substitution>();
  for (const s of substitutions) {
    subMap.set(s.schedule_id, s);
  }

  // 3. Ambil seluruh Agenda pada tanggal tersebut
  const agendasOnDate = await getRekapAgenda({ tanggal: date });

  // Siapkan signed URL untuk agenda berfoto secara paralel
  const agendasWithUrl = await Promise.all(
    agendasOnDate.map(async (agenda) => {
      if (agenda.evidence?.storage_path) {
        const signedUrl = await getEvidenceSignedUrl(agenda.evidence.storage_path);
        return {
          ...agenda,
          evidence: {
            ...agenda.evidence,
            signedUrl: signedUrl || undefined,
          },
        };
      }
      return agenda;
    })
  );

  const matchedAgendaIds = new Set<string>();
  const now = new Date();
  const items: DailyReportItem[] = [];

  // 4. Proses Left Join: Schedule -> Agenda & Badal
  for (const sch of schedules) {
    // Hitung durasi slot
    const durMin = calculateSlotDurationMinutes(sch.start_time, sch.end_time);

    // Cari agenda yang cocok: primary by schedule_id, fallback legacy
    const foundAgenda =
      agendasWithUrl.find(
        (a) =>
          a.header.schedule_id === sch.id ||
          (!a.header.schedule_id &&
            a.header.kelas === sch.class_id &&
            a.header.tanggal === date &&
            a.kbm.some(
              (k) =>
                k.nama_guru.trim().toLowerCase() === sch.teacher_name.trim().toLowerCase() &&
                k.mapel.trim().toLowerCase() === sch.subject_name.trim().toLowerCase()
            ))
      ) || null;

    if (foundAgenda?.header.id) {
      matchedAgendaIds.add(foundAgenda.header.id);
    }

    const sub = subMap.get(sch.id) || null;

    // Tentukan Guru Terjadwal vs Aktual
    const scheduledTeacher = sch.teacher_name;
    let actualTeacher = scheduledTeacher;
    let isBadal = false;

    if (sub) {
      actualTeacher = sub.substitute_teacher_name;
      isBadal = true;
    } else if (foundAgenda?.header.actual_teacher_name) {
      actualTeacher = foundAgenda.header.actual_teacher_name;
      if (
        actualTeacher.trim().toLowerCase() !== scheduledTeacher.trim().toLowerCase()
      ) {
        isBadal = true;
      }
    } else if (
      foundAgenda?.kbm.some(
        (k) =>
          k.is_badal ||
          (k.nama_guru &&
            k.nama_guru.trim().toLowerCase() !== scheduledTeacher.trim().toLowerCase())
      )
    ) {
      const badalKbm = foundAgenda.kbm.find(
        (k) =>
          k.nama_guru.trim().toLowerCase() !== scheduledTeacher.trim().toLowerCase()
      );
      if (badalKbm) {
        actualTeacher = badalKbm.nama_guru;
        isBadal = true;
      }
    }

    // Tentukan status
    let status: ReportItemStatus = 'BELUM_TEREALISASI';
    if (foundAgenda) {
      status = isBadal ? 'BADAL' : 'SELESAI';
    } else {
      const slotTimeStatus = computeSlotStatus(sch, null, date, now);
      if (slotTimeStatus === 'IN_PROGRESS') {
        status = 'SEDANG_BERLANGSUNG';
      } else if (slotTimeStatus === 'UPCOMING') {
        status = 'BELUM_DIMULAI';
      } else {
        status = 'BELUM_TEREALISASI';
      }
    }

    const hasDoc = Boolean(foundAgenda?.evidence?.storage_path);
    const docUrl = foundAgenda?.evidence?.signedUrl || null;

    items.push({
      id: sch.id,
      scheduleId: sch.id,
      agendaId: foundAgenda?.header.id || null,
      date,
      startTime: sch.start_time.slice(0, 5),
      endTime: sch.end_time.slice(0, 5),
      durationMinutes: durMin,
      classId: sch.class_id,
      subjectName: sch.subject_name,
      scheduledTeacherName: scheduledTeacher,
      scheduledTeacherId: sch.teacher_id,
      actualTeacherName: actualTeacher,
      actualTeacherId: isBadal && sub ? sub.substitute_teacher_id : sch.teacher_id,
      isBadal,
      status,
      hasDocumentation: hasDoc,
      evidenceUrl: docUrl,
      agenda: foundAgenda,
      substitution: sub,
      isUnscheduledAgenda: false,
    });
  }

  // 5. Tangani Agenda Historis / Manual yang tidak terikat Schedule (Agenda Tanpa Jadwal)
  for (const ag of agendasWithUrl) {
    if (!matchedAgendaIds.has(ag.header.id)) {
      const kbmFirst = ag.kbm[0];
      const actualTeacher = ag.header.actual_teacher_name || kbmFirst?.nama_guru || 'Guru';
      const mapelName = kbmFirst?.mapel || 'Pembelajaran';
      const isBadal = Boolean(kbmFirst?.is_badal);

      items.push({
        id: ag.header.id,
        scheduleId: null,
        agendaId: ag.header.id,
        date: ag.header.tanggal,
        // Agenda di luar jadwal tidak punya slot, jadi jam & durasi tidak
        // boleh dikarang — angka fake ikut tercetak di laporan.
        startTime: null,
        endTime: null,
        durationMinutes: null,
        classId: ag.header.kelas,
        subjectName: mapelName,
        scheduledTeacherName: actualTeacher,
        actualTeacherName: actualTeacher,
        isBadal,
        status: isBadal ? 'BADAL' : 'SELESAI',
        hasDocumentation: Boolean(ag.evidence?.storage_path),
        evidenceUrl: ag.evidence?.signedUrl || null,
        agenda: ag,
        substitution: null,
        isUnscheduledAgenda: true,
      });
    }
  }

  // 6. Urutkan berdasarkan waktu mulai lalu kelas
  //    (baris "di luar jadwal" tanpa jam selalu di akhir)
  items.sort((a, b) => {
    if (!a.startTime || !b.startTime) {
      if (a.startTime && !b.startTime) return -1;
      if (!a.startTime && b.startTime) return 1;
      return a.classId.localeCompare(b.classId);
    }
    const timeCmp = a.startTime.localeCompare(b.startTime);
    if (timeCmp !== 0) return timeCmp;
    return a.classId.localeCompare(b.classId);
  });

  // 7. Terapkan Filter
  return items.filter((item) => {
    if (teacherName && teacherName !== 'SEMUA') {
      const matchScheduled =
        item.scheduledTeacherName.trim().toLowerCase() === teacherName.trim().toLowerCase();
      const matchActual =
        item.actualTeacherName.trim().toLowerCase() === teacherName.trim().toLowerCase();
      if (!matchScheduled && !matchActual) return false;
    }

    if (classId && classId !== 'SEMUA') {
      if (item.classId !== classId) return false;
    }

    if (subjectName && subjectName !== 'SEMUA') {
      if (item.subjectName.trim().toLowerCase() !== subjectName.trim().toLowerCase()) return false;
    }

    if (statusFilter && statusFilter !== 'ALL') {
      if (item.status !== statusFilter) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// 2. REKAP MINGGUAN (WEEKLY REPORT)
// ---------------------------------------------------------------------------

/**
 * Menghitung tanggal Senin s.d. Minggu dari tanggal tertentu.
 */
export function getMondayToSundayRange(d: Date): { monday: string; sunday: string; days: string[] } {
  const current = new Date(d);
  const day = current.getDay(); // 0 = Minggu, 1 = Senin, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const mondayDate = new Date(current);
  mondayDate.setDate(current.getDate() + diffToMonday);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(mondayDate);
    nextDate.setDate(mondayDate.getDate() + i);
    days.push(localDateString(nextDate));
  }

  return {
    monday: days[0],
    sunday: days[6],
    days,
  };
}

export async function getWeeklyReport(options: {
  startDate: string; // YYYY-MM-DD (Senin)
  endDate: string; // YYYY-MM-DD (Minggu)
  academicYearId?: string;
  teacherFilter?: string;
}): Promise<WeeklyReportResult> {
  const { startDate, endDate, academicYearId, teacherFilter } = options;

  // 1. Ambil Academic Year
  const allAYs = await getAcademicYears();
  let selectedAY = allAYs.find((ay) => ay.id === academicYearId);
  if (!selectedAY) {
    selectedAY =
      allAYs.find((ay) => ay.status === 'ACTIVE') ||
      allAYs.find((ay) => startDate >= ay.start_date && startDate <= ay.end_date) ||
      allAYs[0];
  }

  // 2. Ambil semua guru terdaftar untuk inisialisasi baris
  const { data: guruData } = await supabase
    .from('guru')
    .select('id, nama_guru, created_at')
    .order('nama_guru');
  const allTeachers: Guru[] = guruData || [];

  // Inisialisasi Map statistik per guru
  const statsMap = new Map<string, TeacherSummaryStats>();
  for (const g of allTeachers) {
    statsMap.set(g.nama_guru.trim(), {
      teacherName: g.nama_guru.trim(),
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

  // 3. Ambil seluruh schedules aktif untuk AY ini
  let aySchedules: ScheduleItem[] = [];
  if (selectedAY) {
    aySchedules = await getSchedules({
      academicYearId: selectedAY.id,
      status: 'ACTIVE',
    });
  }

  // 4. Ambil semua agenda dalam rentang tanggal
  const weeklyAgendas = await getRekapAgenda({
    startDate,
    endDate,
  });

  // 5. Ambil semua badal dalam rentang tanggal
  const weeklySubs = await getSubstitutionHistory({
    startDate,
    endDate,
  });
  const subMap = new Map<string, Substitution>();
  for (const sub of weeklySubs) {
    if (!sub.cancelled_at) {
      subMap.set(`${sub.schedule_id}_${sub.substitution_date}`, sub);
    }
  }

  // 6. Iterasi setiap hari dalam rentang (Senin - Minggu)
  // Catatan: Jadwal sekolah aktif pada hari kerja (Senin–Jumat)
  const startObj = new Date(startDate + 'T00:00:00');
  const endObj = new Date(endDate + 'T00:00:00');

  const curDate = new Date(startObj);
  while (curDate <= endObj) {
    const curDateStr = localDateString(curDate);
    const dayKey = getScheduleDayFromDate(curDate);

    if (dayKey) {
      // Dapatkan schedule yang cocok dengan hari ini
      const daySchedules = aySchedules.filter((s) => s.day === dayKey);

      for (const sch of daySchedules) {
        const teacherName = sch.teacher_name.trim();
        let stat = statsMap.get(teacherName);
        if (!stat) {
          stat = {
            teacherName,
            teacherId: sch.teacher_id,
            jpScheduled: 0,
            jpRealized: 0,
            durationScheduledMin: 0,
            durationRealizedMin: 0,
            badalIn: 0,
            badalOut: 0,
            notRealized: 0,
            realizationRate: 0,
          };
          statsMap.set(teacherName, stat);
        }

        const durMin = calculateSlotDurationMinutes(sch.start_time, sch.end_time);

        // JP Terjadwal SELALU bertambah untuk Guru Terjadwal
        stat.jpScheduled += 1;
        stat.durationScheduledMin += durMin;

        // Cek apakah ada agenda yang merealisasikan jadwal ini pada tanggal tersebut
        const matchingAgenda = weeklyAgendas.find(
          (a) =>
            a.header.schedule_id === sch.id && a.header.tanggal === curDateStr
        ) ||
        weeklyAgendas.find(
          (a) =>
            !a.header.schedule_id &&
            a.header.kelas === sch.class_id &&
            a.header.tanggal === curDateStr &&
            a.kbm.some(
              (k) =>
                k.nama_guru.trim().toLowerCase() === teacherName.toLowerCase() &&
                k.mapel.trim().toLowerCase() === sch.subject_name.trim().toLowerCase()
            )
        );

        // Cek badal aktif
        const sub = subMap.get(`${sch.id}_${curDateStr}`);

        if (matchingAgenda) {
          // Agenda ADA -> Terlaksana
          // Cek apakah diajarkan oleh guru pengganti
          let actualTeacher = teacherName;
          let isBadal = false;

          if (sub) {
            actualTeacher = sub.substitute_teacher_name.trim();
            isBadal = true;
          } else if (
            matchingAgenda.header.actual_teacher_name &&
            matchingAgenda.header.actual_teacher_name.trim().toLowerCase() !==
              teacherName.toLowerCase()
          ) {
            actualTeacher = matchingAgenda.header.actual_teacher_name.trim();
            isBadal = true;
          }

          if (isBadal) {
            // Guru Terjadwal dapat Badal Keluar
            stat.badalOut += 1;

            // Guru Pengganti dapat JP Terealisasi, Durasi Terealisasi, & Badal Masuk
            let subStat = statsMap.get(actualTeacher);
            if (!subStat) {
              subStat = {
                teacherName: actualTeacher,
                jpScheduled: 0,
                jpRealized: 0,
                durationScheduledMin: 0,
                durationRealizedMin: 0,
                badalIn: 0,
                badalOut: 0,
                notRealized: 0,
                realizationRate: 0,
              };
              statsMap.set(actualTeacher, subStat);
            }
            subStat.jpRealized += 1;
            subStat.durationRealizedMin += durMin;
            subStat.badalIn += 1;
          } else {
            // Normal: JP Terealisasi masuk ke guru terjadwal
            stat.jpRealized += 1;
            stat.durationRealizedMin += durMin;
          }
        } else {
          // Agenda TIDAK ADA -> Belum Terealisasi
          stat.notRealized += 1;
        }
      }
    }

    curDate.setDate(curDate.getDate() + 1);
  }

  // 7. Hitung persentase realisasi & kumpulkan daftar
  const summaries: TeacherSummaryStats[] = [];
  let totSched = 0;
  let totReal = 0;
  let totDurSched = 0;
  let totDurReal = 0;
  let totBadalIn = 0;
  let totBadalOut = 0;
  let totNotReal = 0;

  for (const s of statsMap.values()) {
    // Tangani pembagian nol
    if (s.jpScheduled > 0) {
      s.realizationRate = Number(((s.jpRealized / s.jpScheduled) * 100).toFixed(1));
    } else {
      s.realizationRate = s.jpRealized > 0 ? 100 : 0;
    }

    // Filter teacher jika dipilih
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

  // Sort berdasarkan nama guru
  summaries.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  const overallRate =
    totSched > 0 ? Number(((totReal / totSched) * 100).toFixed(1)) : 0;

  return {
    startDate,
    endDate,
    academicYear: selectedAY || null,
    teacherSummaries: summaries,
    totals: {
      totalJpScheduled: totSched,
      totalJpRealized: totReal,
      totalDurationScheduledMin: totDurSched,
      totalDurationRealizedMin: totDurReal,
      totalBadalIn: totBadalIn,
      totalBadalOut: totBadalOut,
      totalNotRealized: totNotReal,
      overallRealizationRate: overallRate,
    },
  };
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

  // Tentukan start_date dan end_date bulan tersebut
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Menggunakan kalkulasi mingguan/rentang yang sudah tervalidasi
  const weeklyRes = await getWeeklyReport({
    startDate,
    endDate,
    academicYearId,
    teacherFilter,
  });

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
      totalBadal: weeklyRes.totals.totalBadalIn,
      totalNotRealized: weeklyRes.totals.totalNotRealized,
      overallRealizationRate: weeklyRes.totals.overallRealizationRate,
    },
  };
}
