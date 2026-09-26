import type { Guru } from '../../types';
import { DAFTAR_KELAS } from '../../types';
import type { ScheduleDay, ScheduleItem } from '../../types/schedule';
import { SCHEDULE_DAYS } from '../../types/schedule';

/**
 * Model export jadwal — MURNI, tanpa library Excel dan tanpa menyentuh DOM.
 *
 * Semua aturan "apa yang masuk file" ada di sini supaya bisa diuji tanpa
 * membuka Excel sama sekali:
 *   - ASCII §7  nama guru = nama depan saja
 *   - §9/§16   waktu dicetak apa adanya dari schedule, TIDAK PERNAH dihitung
 *              (durations 30/35/40 menit tetap seperti tersimpan)
 *   - §10/§19 slot tidak pernah digabung: kunci baris =
 *              `${period_number}|${start}|${end}`
 *   - §13      kelas tanpa jadwal pada suatu slot => cell kosong (bukan "N/A")
 *   - §15      urutan Senin→Jumat, di dalamnya urut waktu mulai
 *
 * Kolom kelas & urutan hari TIDAK di-hardcode: diambil dari `DAFTAR_KELAS` dan
 * `SCHEDULE_DAYS` supaya export selalu mengikuti master data yang sama dengan UI.
 */

/** Kelas yang tidak lagi berlaku — tidak ikut dicetak (§5 "jadwal yang berlaku"). */
const EXCLUDED_STATUS = 'ARCHIVED';

export interface ScheduleExportInput {
  /** Jadwal mentah untuk satu tahun ajaran (hasil `getSchedules({ academicYearId })`). */
  schedules: ScheduleItem[];
  /** Tahun ajaran, mis. "2026/2027". */
  academicYearName: string;
  /** Master guru, dipakai untuk resolve `schedule.teacher_id` → nama. */
  teachers?: Guru[];
  /** Override kolom kelas, default `DAFTAR_KELAS`. */
  classOptions?: string[];
}

export interface WeeklyRow {
  /** HH:mm — sudah dinormalisasi dari "HH:mm:ss" bila perlu. */
  start: string;
  end: string;
  periodNumber: number;
  /** map classId → "Mata Pelajaran\nNama Guru" (atau tanpa nama guru). */
  cells: Record<string, string>;
}

export interface WeeklyDay {
  day: ScheduleDay;
  /** "SENIN" — untuk band pemisah hari. */
  label: string;
  rows: WeeklyRow[];
}

export interface DetailRow {
  day: string;
  start: string;
  end: string;
  periodNumber: number;
  classId: string;
  subject: string;
  teacher: string;
  academicYear: string;
}

export interface ScheduleExportModel {
  academicYearName: string;
  classOptions: string[];
  weekly: WeeklyDay[];
  detail: DetailRow[];
  /** Jumlah slot yang benar-benar dicetak (setelah ARCHIVED dibuang). */
  exportedCount: number;
  /** Jumlah slot ARCHIVED yang sengaja tidak ikut. */
  archivedCount: number;
  /** Jumlah slot DRAFT yang ikut — dipakai untuk footnote di sheet mingguan. */
  draftCount: number;
}

/** Ambil jam-menyit dari "HH:mm" / "HH:mm:ss" / "HH:mm:ss.sss+00". */
export function toHHmm(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).slice(0, 5);
}

/**
 * Nama depan saja (§7).
 *
 * "Ikfina Khoirun Nisa, S.Pd." → "Ikfina"
 * "Dian Kusumawati, S.Pd."     → "Dian"
 * "Abdulloh, S.Pd.I"           → "Abdulloh"
 * "Nur Ajizah Romadi, S.Pd."   → "Nur"
 *
 * Aturannya: buang gelar/setiap setelah koma, lalu ambil token pertama.
 */
export function firstName(fullName: string | null | undefined): string {
  const raw = (fullName ?? '').split(',')[0].trim();
  if (!raw) return '';
  return raw.split(/\s+/)[0] ?? '';
}

/** Label hari dari master (`SCHEDULE_DAYS`), uppercase untuk sheet mingguan. */
export function dayLabel(day: ScheduleDay): string {
  return SCHEDULE_DAYS.find((d) => d.key === day)?.label.toUpperCase() ?? String(day);
}

function buildTeacherResolver(teachers: Guru[]) {
  const byId = new Map<string, Guru>();
  for (const t of teachers) byId.set(t.id, t);

  return (item: ScheduleItem): string => {
    // §3: guru diambil dari schedule.teacher_id, bukan dari tebakan mata pelajaran.
    const fromMaster = item.teacher_id ? byId.get(item.teacher_id)?.nama_guru : undefined;
    const raw = fromMaster ?? item.teacher_name;
    if (!raw) return '';
    if (!fromMaster && item.teacher_id) {
      // Relasi rusak tidak boleh menjatuhkan seluruh export (§25).
      console.warn(
        `[export jadwal] teacher_id ${item.teacher_id} tidak ditemukan di master data; ` +
          `memakai teacher_name "${item.teacher_name}".`,
      );
    }
    return firstName(raw);
  };
}

/** Isi satu cell jadwal: mata pelajaran + nama guru (±7/§8). Tanpa guru → teks saja. */
function cellText(subject: string, teacher: string): string {
  const mapel = subject.trim();
  if (!teacher) return mapel;
  return `${mapel}\n${teacher}`;
}

/**
 * Sheet utama: grid per hari. Baris = slot waktu, kolom = kelas.
 * Tidak ada merge — dua slot berurutan dengan mapel sama tetap dua baris (§10).
 *
 * Catatan: `classOptions` tidak dipakai di sini. Kolom kelas ditentukan saat
 * menulis sheet (menekan kolom yang kosong di grid), jadi grid storing hanya
 * mapel yang benar-benar ada. Kelas tanpa jadwal otomatis menjadi cell kosong.
 */
export function buildWeeklyGrid(
  schedules: ScheduleItem[],
  teacherName: (item: ScheduleItem) => string,
): WeeklyDay[] {
  return SCHEDULE_DAYS.map(({ key, label }) => {
    const dayItems = schedules.filter((s) => s.day === key);

    // Kunci baris = period + waktu. Jika slot identik muncul dua kali (mis.
    // data legacy tanpa period_number), keduanya tetap terpisah — tidak pernah
    // digabung.
    const rowMap = new Map<string, WeeklyRow>();
    for (const item of dayItems) {
      const start = toHHmm(item.start_time);
      const end = toHHmm(item.end_time);
      const key = `${item.period_number}|${start}|${end}`;
      let row = rowMap.get(key);
      if (!row) {
        row = { start, end, periodNumber: item.period_number, cells: {} };
        rowMap.set(key, row);
      }
      row.cells[item.class_id] = cellText(item.subject_name, teacherName(item));
    }

    const rows = [...rowMap.values()].sort((a, b) =>
      a.start === b.start ? a.periodNumber - b.periodNumber : a.start.localeCompare(b.start),
    );

    return { day: key, label: label.toUpperCase(), rows };
  });
}

/** Sheet kedua: normalized, satu baris per slot (§14). */
export function buildDetailRows(
  schedules: ScheduleItem[],
  academicYearName: string,
  teacherName: (item: ScheduleItem) => string,
): DetailRow[] {
  const dayOrder = new Map(SCHEDULE_DAYS.map((d, i) => [d.key as string, i]));

  return schedules
    .map((item) => ({
      day: dayLabel(item.day),
      start: toHHmm(item.start_time),
      end: toHHmm(item.end_time),
      periodNumber: item.period_number,
      classId: item.class_id,
      subject: item.subject_name,
      teacher: teacherName(item),
      academicYear: academicYearName,
      _day: dayOrder.get(item.day) ?? 99,
    }))
    .sort(
      (a, b) =>
        a._day - b._day ||
        a.start.localeCompare(b.start) ||
        a.periodNumber - b.periodNumber ||
        a.classId.localeCompare(b.classId),
    )
    .map(({ _day, ...rest }) => rest);
}

/** `Jadwal_Pelajaran_2026-2027.xlsx` — tahun ajaran dari data, bukan hardcode (§20). */
export function exportFileName(academicYearName: string): string {
  const slug = (academicYearName || 'Tanpa-Tahun').replace(/[^0-9A-Za-z]+/g, '-');
  return `Jadwal_Pelajaran_${slug}.xlsx`;
}

/**
 * Satu-satunya pintu masuk: dari page → model → writer Excel.
 * ARCHIVED dibuang di sini (satu sumber kebenaran), DRAFT tetap ikut
 * kecatatannya supaya sheet bisa memberi catatan kaki.
 */
export function buildScheduleExportModel(input: ScheduleExportInput): ScheduleExportModel {
  const { schedules, academicYearName, teachers = [], classOptions = DAFTAR_KELAS } = input;

  const included = schedules.filter((s) => s.status !== EXCLUDED_STATUS);
  const archivedCount = schedules.length - included.length;
  const draftCount = included.filter((s) => s.status === 'DRAFT').length;

  const teacherName = buildTeacherResolver(teachers);

  return {
    academicYearName,
    classOptions: [...classOptions],
    weekly: buildWeeklyGrid(included, teacherName),
    detail: buildDetailRows(included, academicYearName, teacherName),
    exportedCount: included.length,
    archivedCount,
    draftCount,
  };
}
