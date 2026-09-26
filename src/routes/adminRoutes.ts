import type { ComponentType } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Award,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock,
  FileEdit,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Settings,
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
  | 'rekap_harian'
  | 'rekap_mingguan'
  | 'rekap_bulanan'
  | 'siswa'
  | 'guru'
  | 'mapel'
  | 'wali_kelas'
  | 'slot_waktu'
  | 'ekskul'
  | 'tahun_ajaran'
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
  {
    tab: 'rekap_harian',
    path: 'rekap_harian',
    group: 'REKAP & LAPORAN',
    label: 'Rekap Harian',
    title: 'Rekap Harian',
    icon: CalendarDays,
  },
  {
    tab: 'rekap_mingguan',
    path: 'rekap_mingguan',
    group: 'REKAP & LAPORAN',
    label: 'Rekap Mingguan',
    title: 'Rekap Mingguan',
    icon: FileSpreadsheet,
  },
  {
    tab: 'rekap_bulanan',
    path: 'rekap_bulanan',
    group: 'REKAP & LAPORAN',
    label: 'Rekap Bulanan',
    title: 'Rekap Bulanan',
    icon: CalendarRange,
  },
  {
    tab: 'rekap',
    path: 'rekap',
    group: 'REKAP & LAPORAN',
    label: 'Log Jurnal Agenda',
    title: 'Log Jurnal Agenda',
    icon: Activity,
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
