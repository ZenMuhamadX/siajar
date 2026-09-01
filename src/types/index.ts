export type KelasOption = 'KELAS 1' | 'KELAS 2' | 'KELAS 3' | 'KELAS 4' | 'KELAS 5' | 'KELAS 6';

export const DAFTAR_KELAS: KelasOption[] = [
  'KELAS 1',
  'KELAS 2',
  'KELAS 3',
  'KELAS 4',
  'KELAS 5',
  'KELAS 6',
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

export interface GuruKelas {
  id: string;
  nama_guru: string;
  kelas: string;
  created_at?: string;
}

export interface AgendaHeader {
  id: string;
  sekolah: string;
  kelas: string;
  tanggal: string; // YYYY-MM-DD
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

export interface FullAgenda {
  header: AgendaHeader;
  kbm: AgendaKBM[];
  absensi: (AgendaAbsensi & { siswa?: Siswa })[];
  kejadian: AgendaKejadian[];
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
