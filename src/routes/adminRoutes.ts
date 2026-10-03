import type { ComponentType } from 'react';
import {
  ArrowLeftRight,
  Award,
  BookOpen,
  Calendar,
  CalendarClock,
  Clock,
  FileEdit,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  School,
  Settings,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';

/**
 * Sumber tunggal untuk area `/admin`.
 *
 * Satu array ini melahirkan 3 hal sekaligus:
 *  1. segmen URL (`/admin/<path>`),
 *  2. sidebar + group (`ADMIN_NAV_GROUPS`),
 *  3. judul breadcrumb (`getAdminRouteByPath().title`).
 *
 * Jadi menambah halaman admin cukup: tambahkan entri di sini + satu `<Route>`
 * di `src/routes/index.tsx`.
 */
export type AdminTab =
  | 'overview'
  | 'agenda'
  | 'jadwal'
  | 'rekap'
  | 'siswa'
  | 'guru'
  | 'mapel'
  | 'kelas'
  | 'wali_kelas'
  | 'slot_waktu'
  | 'ekskul'
  | 'tahun_ajaran'
  | 'kenaikan_kelas'
  | 'pengaturan'
  | 'saran'
  | 'badal';

export interface AdminRouteDef {
  tab: AdminTab;
  /** Segmen URL: rute penuhnya `/admin/<path>`. */
  path: string;
  /** Nama group pada sidebar. */
  group: string;
  /** Label menu di sidebar. */
  label: string;
  /** Judul breadcrumb di header admin. */
  title: string;
  icon: ComponentType<{ className?: string }>;
}

export const ADMIN_ROUTES: AdminRouteDef[] = [
  // UTAMA
  {
    tab: 'overview',
    path: 'overview',
    group: 'UTAMA',
    label: 'Ringkasan',
    title: 'Ringkasan Dashboard',
    icon: LayoutDashboard,
  },
  {
    tab: 'agenda',
    path: 'agenda',
    group: 'UTAMA',
    label: 'Agenda',
    title: 'Agenda Pembelajaran',
    icon: FileEdit,
  },

  // REKAP & LAPORAN
  // Satu pintu untuk empat tampilan laporan (Harian, Mingguan, Bulanan, Log
  // Jurnal) lewat `/admin/rekap?view=…`. Sebelumnya ada 4 item menu dengan nama
  // yang mirip sehingga sering membingungkan.
  {
    tab: 'rekap',
    path: 'rekap',
    group: 'REKAP & LAPORAN',
    label: 'Pusat Rekap',
    title: 'Pusat Rekap',
    icon: FileSpreadsheet,
  },

  // MASTER DATA
  {
    tab: 'siswa',
    path: 'siswa',
    group: 'MASTER DATA',
    label: 'Siswa',
    title: 'Data Siswa',
    icon: Users,
  },
  {
    tab: 'guru',
    path: 'guru',
    group: 'MASTER DATA',
    label: 'Guru',
    title: 'Data Guru',
    icon: GraduationCap,
  },
  {
    tab: 'mapel',
    path: 'mapel',
    group: 'MASTER DATA',
    label: 'Mata Pelajaran',
    title: 'Mata Pelajaran',
    icon: BookOpen,
  },
  {
    tab: 'kelas',
    path: 'kelas',
    group: 'MASTER DATA',
    label: 'Kelas',
    title: 'Data Kelas',
    icon: School,
  },

  // PENUGASAN
  {
    tab: 'wali_kelas',
    path: 'wali_kelas',
    group: 'PENUGASAN',
    label: 'Wali Kelas',
    title: 'Penugasan Wali Kelas',
    icon: Award,
  },
  {
    tab: 'jadwal',
    path: 'jadwal',
    group: 'PENUGASAN',
    label: 'Jadwal',
    title: 'Jadwal Pembelajaran',
    icon: CalendarClock,
  },
  {
    tab: 'slot_waktu',
    path: 'slot_waktu',
    group: 'PENUGASAN',
    label: 'Slot Waktu (JP)',
    title: 'Slot Waktu (JP)',
    icon: Clock,
  },
  {
    tab: 'badal',
    path: 'badal',
    group: 'PENUGASAN',
    label: 'Guru Pengganti',
    title: 'Histori Badal / Guru Pengganti',
    icon: ArrowLeftRight,
  },

  // KEGIATAN
  {
    tab: 'ekskul',
    path: 'ekskul',
    group: 'KEGIATAN',
    label: 'Ekstrakurikuler',
    title: 'Ekstrakurikuler',
    icon: Trophy,
  },

  // PENGATURAN
  {
    tab: 'tahun_ajaran',
    path: 'tahun_ajaran',
    group: 'PENGATURAN',
    label: 'Tahun Ajaran',
    title: 'Tahun Ajaran',
    icon: Calendar,
  },
  {
    tab: 'kenaikan_kelas',
    path: 'kenaikan_kelas',
    group: 'PENGATURAN',
    label: 'Kenaikan Kelas',
    title: 'Kenaikan Kelas',
    icon: TrendingUp,
  },
  {
    tab: 'saran',
    path: 'saran',
    group: 'PENGATURAN',
    label: 'Kotak Saran',
    title: 'Kotak Saran & Masukan Guru',
    icon: MessageSquare,
  },
  {
    tab: 'pengaturan',
    path: 'pengaturan',
    group: 'PENGATURAN',
    label: 'Pengaturan',
    title: 'Pengaturan',
    icon: Settings,
  },
];

/** Semua id tab yang valid — dipakai untuk validasi & back-compat `?tab=...`. */
export const ADMIN_TAB_IDS: AdminTab[] = ADMIN_ROUTES.map((r) => r.tab);

/** URL lengkap untuk sebuah tab admin (`/admin/jadwal`). */
export const adminPath = (tab: AdminTab): string => `/admin/${tab}`;

/** Cari rute dari segmen URL (`jadwal` → def). */
export const getAdminRouteByPath = (pathSegment?: string): AdminRouteDef | undefined =>
  ADMIN_ROUTES.find((r) => r.path === pathSegment);

/** Group sidebar dalam urutan tampil. */
export const ADMIN_NAV_GROUPS: { group: string; items: AdminRouteDef[] }[] = ADMIN_ROUTES.reduce<
  { group: string; items: AdminRouteDef[] }[]
>((groups, route) => {
  const existing = groups.find((g) => g.group === route.group);
  if (existing) existing.items.push(route);
  else groups.push({ group: route.group, items: [route] });
  return groups;
}, []);
