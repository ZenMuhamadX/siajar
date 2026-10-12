export type AcademicYearStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface AcademicYear {
  id: string;
  name: string; // e.g. '2026/2027'
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: AcademicYearStatus;
  created_at?: string;
  updated_at?: string;
}

export type ScheduleDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY';

export const SCHEDULE_DAYS: { key: ScheduleDay; label: string }[] = [
  { key: 'MONDAY', label: 'Senin' },
  { key: 'TUESDAY', label: 'Selasa' },
  { key: 'WEDNESDAY', label: 'Rabu' },
  { key: 'THURSDAY', label: 'Kamis' },
  { key: 'FRIDAY', label: 'Jumat' },
];

export const DAY_TRANSLATION_MAP: Record<ScheduleDay, string> = {
  MONDAY: 'Senin',
  TUESDAY: 'Selasa',
  WEDNESDAY: 'Rabu',
  THURSDAY: 'Kamis',
  FRIDAY: 'Jumat',
};

export type ScheduleStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type ActivityType = 'KBM' | 'EXTRACURRICULAR' | 'LIFESKILL' | 'SPECIAL';

export interface ScheduleItem {
  id: string;
  academic_year_id: string;
  day: ScheduleDay;
  period_number: number;
  start_time: string; // HH:mm or HH:mm:ss
  end_time: string;   // HH:mm or HH:mm:ss
  /**
   * Label kelas, mis. '1A' — BUKAN id.
   *
   * Database menyimpan `kelas_id` (referensi ke master kelas); label ini
   * diturunkan saat membaca dan diterjemahkan kembali saat menulis, di
   * `scheduleService`. Seluruh layar, validasi bentrok, dan export memakai
   * label supaya tidak perlu tahu soal id.
   */
  kelas: string;
  subject_id?: string | null;
  subject_name: string;
  teacher_id?: string | null;
  teacher_name: string;
  /**
   * Halaqoh yang diajar baris ini — hanya untuk mapel berkelompok (Ummi).
   *
   * `null` berarti baris berlaku untuk SELURUH kelas (semua mapel biasa).
   * Terisi berarti baris ini hanya untuk satu kelompok, dan kelompok lain
   * punya barisnya sendiri pada jam yang sama dengan guru berbeda.
   *
   * Inilah yang membuat dua baris di kelas yang sama pada jam yang sama menjadi
   * SAH: aturan bentrok membandingkan `halaqoh_id`, bukan `kelas_id`.
   */
  halaqoh_id?: string | null;
  /** Nama halaqoh untuk tampilan (diturunkan saat membaca, bukan disimpan). */
  halaqoh?: string;
  /**
   * SELURUH label kelas yang dicakup baris ini. Diturunkan saat membaca, bukan
   * disimpan.
   *
   * Kenapa perlu, padahal sudah ada `kelas`: baris halaqoh lintas kelas sengaja
   * tidak punya satu kelas (`kelas_id` NULL), sehingga `kelas`-nya KOSONG.
   * Kelasnya ada di `halaqoh_kelas` dan bisa lebih dari satu. Tanpa daftar ini,
   * setiap layar yang menyaring/menampilkan kelas akan membuang baris halaqoh —
   * itulah akar bug "jadwal halaqoh tidak muncul saat difilter kelas".
   *
   * Isinya: label kelas sumber untuk baris halaqoh, atau `[kelas]` untuk baris
   * biasa. `kelas` sengaja TIDAK diubah artinya supaya pencocokan data lama
   * (yang membandingkan label kelas) tetap bekerja.
   */
  kelasList?: string[];
  activity_type?: ActivityType;
  status: ScheduleStatus;
  period_template_id?: string | null; // Stage 2.3: soft reference to period_templates
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleConflictCheckResult {
  hasConflict: boolean;
  type?: 'TEACHER_CONFLICT' | 'CLASS_CONFLICT' | 'HALAQOH_CONFLICT';
  message?: string;
  conflictingItem?: ScheduleItem;
}

// ---------------------------------------------------------------------------
// Stage 2.3 — Master JP / Period Templates
// ---------------------------------------------------------------------------

export interface PeriodTemplate {
  id: string;
  academic_year_id: string;
  period_number: number;
  label: string;      // "JP 1"
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
