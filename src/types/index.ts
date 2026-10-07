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

/**
 * Halaqoh — pembagian siswa DI DALAM satu kelas untuk mapel berkelompok (Ummi).
 *
 * Kenapa bukan kelas tersendiri: halaqoh hanya berlaku untuk satu mapel dan
 * tidak mengubah apa pun tentang kenaikan kelas, wali kelas, atau riwayat.
 * Kelas tetap unit; halaqoh hanya cara membagi siswanya saat mapel itu mengajar.
 *
 * Guru TIDAK disimpan di sini, melainkan di baris jadwal. Alasannya: satu mata
 * pelajaran bisa diampu guru berbeda tiap tahun ajaran, dan guru tamu tidak perlu
 * masuk master guru hanya karena sekali mengajar halaqoh.
 *
 * Halaqoh selalu ada — kelas kecil cukup punya satu halaqoh berisi seluruh kelas.
 * Pembagiannya diulang tiap tahun ajaran (pola yang sama dengan `siswa_kelas`).
 */
export interface Halaqoh {
  id: string;
  /** Kelas pemilik halaqoh ini. */
  kelas_id: string;
  /** Nama kelompok, mis. 'Halaqoh 1'. Unik per kelas. */
  nama: string;
  /** Urutan tampil di dalam kelasnya. */
  urutan: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Halaqoh beserta label kelasnya — hasil join untuk tampilan.
 *
 * Sama seperti pola lain di berkas ini: label kelas adalah nilai turunan, bukan
 * disimpan ulang di sini.
 */
export interface HalaqohTerdaftar extends Halaqoh {
  /** Label kelas dari `agenda.kelas.label`. */
  kelas: string;
}

/**
 * Satu siswa di dalam sebuah halaqoh pada satu tahun ajaran.
 *
 * `academic_year_id` wajib: keanggotaan halaqoh TIDAK dibawa naik kelas, sama
 * seperti penempatan kelasnya. Anak yang tahun ini di Halaqoh 1 bisa berada di
 * Halaqoh 3 tahun depan.
 */
export interface SiswaHalaqoh {
  id: string;
  siswa_id: string;
  halaqoh_id: string;
  academic_year_id: string;
  created_at?: string;
}

/** Siswa anggota halaqoh, siap tampil (nama + NIS ikut dibaca). */
export interface AnggotaHalaqoh {
  /** `siswa_halaqoh.id` — dipakai untuk memindahkan / mengeluarkan. */
  id: string;
  siswa_id: string;
  halaqoh_id: string;
  nama_siswa: string;
  nis: string | null;
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
  /**
   * Mapel ini diajarkan secara berkelompok (halaqoh), mis. Ummi.
   *
   * Kalau true, baris jadwal untuk mapel ini WAJIB memilih salah satu halaqoh
   * kelas tersebut, dan tiap halaqoh diampu guru yang berbeda pada jam yang sama.
   *
   * Sengaja disimpan sebagai atribut mapel, bukan ditebak dari namanya: nama
   * mapel bisa diganti kapan saja, dan penebakan dari teks akan mematikan seluruh
   * mekanisme halaqoh tanpa satu pun error. Kolom eksplisit juga berarti guru
   * melihat sendiri mapel mana yang berkelompok, dan `is_halaqoh` masuk ke
   * pemeriksaan bentrok di UI jadwal.
   */
  is_halaqoh?: boolean;
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
  /**
   * Halaqoh yang diajar pada baris jurnal ini — hanya untuk mapel berkelompok.
   *
   * `null`/kosong berarti baris ini berlaku untuk SELURUH kelas (semua mapel
   * biasa). Terisi berarti baris ini hanya mencatat bagian satu kelompok, dan
   * kelompok lain punya barisnya sendiri.
   *
   * Kenapa ini penting sampai ke jurnal, bukan berhenti di jadwal: dua guru
   * Ummi mengajar kelas + mapel + tanggal yang sama. Tanpa `halaqoh_id`, tidak
   * ada cara membedakan bagian siapa yang sedang dibaca — guru kedua akan
   * melihat (dan menimpa) catatan guru pertama.
   */
  halaqoh_id?: string | null;
  /** Nama halaqoh untuk tampilan (diturunkan saat membaca, bukan disimpan). */
  halaqoh?: string;
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

