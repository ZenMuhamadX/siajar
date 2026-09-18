export type KelasOption = 'KELAS 1' | 'KELAS 2' | 'KELAS 3' | 'KELAS 4' | 'KELAS 5' | 'KELAS 6';

export const DAFTAR_KELAS: KelasOption[] = [
  'KELAS 1',
  'KELAS 2',
  'KELAS 3',
  'KELAS 4',
  'KELAS 5',
  'KELAS 6',
];

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

export interface Siswa {
  id: string;
  nama_siswa: string;
  kelas: string;
  created_at?: string;
}

export interface Guru {
  id: string;
  nama_guru: string;
  created_at?: string;
}

export interface MataPelajaran {
  id: string;
  nama_mapel: string;
  created_at?: string;
}

export interface GuruKelas {
  id: string;
  nama_guru: string;
  kelas: string;
  created_at?: string;
}

export interface HomeroomAssignment {
  id: string;
  academic_year_id: string;
  class_id: string;
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

