/**
 * Master kelas.
 *
 * Kelas adalah entitas ber-`id`, bukan teks. `tingkat` + `rombel` adalah kunci
 * bisnis; `label` ('1A', '1B', '2A', …) hanya tampilan, sehingga boleh diubah
 * tanpa memutus relasi apa pun.
 *
 * Daftar kelas TIDAK lagi di-hardcode di sini. Sumbernya tabel `agenda.kelas`,
 * dibaca sekali saat aplikasi start lewat `ClassProvider` — lihat
 * `src/contexts/ClassContext.tsx`. Menambah rombel baru cukup dari halaman
 * Data Kelas, tanpa mengubah kode.
 */
export interface Kelas {
  id: string;
  tingkat: number;
  rombel: string;
  label: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Slot Jam Senin - Kamis (Total 14 Jam dengan 2x Istirahat di Jam 5 & Jam 10)
export const SLOTS_SENIN_KAMIS = [
  { jam_ke: '1-2', is_break: false, label: 'Jam 1-2' },
  { jam_ke: '3-4', is_break: false, label: 'Jam 3-4' },
  { jam_ke: '5', is_break: true, label: 'Jam 5 (Istirahat)' },
  { jam_ke: '6-7', is_break: false, label: 'Jam 6-7' },
  { jam_ke: '8-9', is_break: false, label: 'Jam 8-9' },
  { jam_ke: '10', is_break: true, label: 'Jam 10 (Istirahat / Isoma)' },
  { jam_ke: '11-12', is_break: false, label: 'Jam 11-12' },
  { jam_ke: '13-14', is_break: false, label: 'Jam 13-14' },
];

// Slot Jam Jumat (Total 10 Jam dengan Istirahat Jam 5 & Jam 8 Sholat Jumat, lalu Jam 9-10 Pramuka)
export const SLOTS_JUMAT = [
  { jam_ke: '1-2', is_break: false, label: 'Jam 1-2' },
  { jam_ke: '3-4', is_break: false, label: 'Jam 3-4' },
  { jam_ke: '5', is_break: true, label: 'Jam 5 (Istirahat)' },
  { jam_ke: '6-7', is_break: false, label: 'Jam 6-7' },
  { jam_ke: '8', is_break: true, label: 'Jam 8 (Istirahat Sholat Jumat)' },
  { jam_ke: '9-10', is_break: false, label: 'Jam 9-10 (Pramuka / KBM)' },
];

export function getScheduleSlotsForDate(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 5 = Friday
    return day === 5 ? SLOTS_JUMAT : SLOTS_SENIN_KAMIS;
  } catch {
    return SLOTS_SENIN_KAMIS;
  }
}

export const DAFTAR_JAM_PELAJARAN: string[] = [
  '1-2',
  '3-4',
  '5',
  '6-7',
  '8-9',
  '8',
  '9-10',
  '10',
  '11-12',
  '13-14',
  'Istirahat',
];

/** Status keanggotaan siswa sepanjang waktu — bukan penempatan kelasnya. */
export type SiswaStatus = 'AKTIF' | 'LULUS' | 'PINDAH_KELUAR' | 'NONAKTIF';

export const LABEL_STATUS_SISWA: Record<SiswaStatus, string> = {
  AKTIF: 'Aktif',
  LULUS: 'Lulus',
  PINDAH_KELUAR: 'Pindah Keluar',
  NONAKTIF: 'Nonaktif',
};

/** Urutan tampil di dropdown — yang paling sering dipakai lebih dulu. */
export const DAFTAR_STATUS_SISWA: SiswaStatus[] = [
  'AKTIF',
  'LULUS',
  'PINDAH_KELUAR',
  'NONAKTIF',
];

/**
 * Status siswa PADA satu tahun ajaran — disimpan di `siswa_kelas.status`.
 *
 * Berbeda dari `SiswaStatus` yang global. `LULUS` sengaja tidak ada di sini:
 * lulus berarti tahun itu sudah selesai dan tidak ada kelas lagi, jadi
 * "punya kelas berstatus lulus" memang tidak mungkin.
 *
 * Kenapa dipisah: status itu sifatnya per tahun. Anak yang lulus tahun ini tetap
 * AKTIF di tahun-tahun sebelumnya. Kalau hanya ada satu kolom global, "Lulus"
 * akan berlaku surut dan membuka tahun ajaran lama jadi menyesatkan.
 */
export type StatusPenempatan = 'AKTIF' | 'PINDAH_KELUAR' | 'NONAKTIF';

export const DAFTAR_STATUS_PENEMPATAN: StatusPenempatan[] = [
  'AKTIF',
  'PINDAH_KELUAR',
  'NONAKTIF',
];

/**
 * Identitas siswa. Kelas TIDAK ada di sini.
 *
 * Penempatan kelas disimpan per tahun ajaran di `agenda.siswa_kelas`, karena
 * siswa naik kelas sementara kelasnya sendiri tetap. Untuk daftar yang sudah
 * disertai kelasnya, pakai `SiswaTerdaftar`.
 */
export interface Siswa {
  id: string;
  nama_siswa: string;
  /** Opsional — boleh kosong, tetapi unik bila diisi. */
  nis?: string | null;
  status: SiswaStatus;
  created_at?: string;
}

/** Siswa beserta penempatan kelasnya pada satu tahun ajaran. */
export interface SiswaTerdaftar extends Siswa {
  /** Label kelas, mis. '1A'. Kosong berarti belum/tidak ditempatkan tahun itu. */
  kelas: string;
  kelas_id: string;
  academic_year_id: string;
  /**
   * Status siswa PADA tahun ajaran itu.
   *
   * Untuk siswa yang punya penempatan, nilainya selalu `StatusPenempatan` —
   * `LULUS` tidak akan pernah muncul, karena yang lulus memang tidak lagi punya
   * kelas. Untuk siswa tanpa penempatan (dipakai `sertakanTanpaKelas`), nilainya
   * status global dari `siswa.status`, yang bisa berisi `LULUS`.
   */
  status: SiswaStatus;
}

export interface Guru {
  id: string;
  nama_guru: string;
  created_at?: string;
}

export interface MataPelajaran {
  id: string;
  nama_mapel: string;
  /**
   * Warna latar sel mapel pada export Excel — 6 digit hex tanpa '#'.
   * `null` / kosong berarti "otomatis": aplikasi memakai palet bawaan
   * secara deterministik dari id mapel (lihat `subjectPalette.ts`).
   */
  warna?: string | null;
  created_at?: string;
}

export interface HomeroomAssignment {
  id: string;
  academic_year_id: string;
  /** Label kelas, mis. '1A' — BUKAN id. Lihat catatan di `ScheduleItem`. */
  kelas: string;
  teacher_id?: string | null;
  teacher_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgendaHeader {
  id: string;
  sekolah: string;
  kelas: string;
  tanggal: string; // YYYY-MM-DD
  schedule_id?: string | null;
  actual_teacher_name?: string | null;
  created_at?: string;
}

export interface AgendaKBM {
  id?: string;
  agenda_id?: string;
  jam_ke: string;
  nama_guru: string;
  mapel: string;
  materi: string;
  tugas_pr?: string;
  is_badal?: boolean;
  is_saved_db?: boolean;
}

export interface AgendaAbsensi {
  id?: string;
  agenda_id?: string;
  siswa_id: string;
  status: 'S' | 'I' | 'A';
  nama_siswa?: string;
  siswa?: Siswa;
}

export interface AgendaKejadian {
  id?: string;
  agenda_id?: string;
  uraian_kejadian: string;
}

export interface AgendaEvidence {
  id?: string;
  agenda_id?: string;
  storage_path: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  captured_at?: string;
  uploaded_at?: string;
  actual_teacher_name?: string;
  actual_teacher_id?: string;
  created_at?: string;
  signedUrl?: string;
}

export interface FullAgenda {
  header: AgendaHeader;
  kbm: AgendaKBM[];
  absensi: (AgendaAbsensi & { siswa?: Siswa })[];
  kejadian: AgendaKejadian[];
  evidence?: AgendaEvidence | null;
}

export type KotakSaranKategori = 'Fasilitas' | 'Kurikulum' | 'Aplikasi' | 'Lainnya';

export interface KotakSaran {
  id?: string;
  nama_guru: string;
  kategori: KotakSaranKategori;
  isi_saran: string;
  is_anonim: boolean;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Stage 3 — Badal / Guru Pengganti
// ---------------------------------------------------------------------------

export type SubstitutionReason = 'Guru berhalangan' | 'Izin' | 'Sakit' | 'Tugas' | 'Lainnya';

export const SUBSTITUTION_REASONS: SubstitutionReason[] = [
  'Guru berhalangan',
  'Izin',
  'Sakit',
  'Tugas',
  'Lainnya',
];

export interface Substitution {
  id: string;
  schedule_id: string;
  substitution_date: string; // YYYY-MM-DD
  original_teacher_name: string;
  original_teacher_id?: string | null;
  substitute_teacher_name: string;
  substitute_teacher_id?: string | null;
  reason: string;
  reason_detail?: string | null;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  cancelled_at?: string | null;
}

export * from './schedule';

