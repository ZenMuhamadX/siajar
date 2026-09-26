/**
 * Kosakata status laporan — SATU sumber kebenaran untuk seluruh halaman rekap.
 *
 * Sebelum file ini ada, tiap halaman mendefinisikan label sendiri dan label
 * cetaknya tidak sama dengan label di layar (mis. "Belum Dimulai" dicetak
 * menjadi "Belum Diisi"). Akibatnya angka/laporan antar halaman mudah berbeda
 * secara tak sengaja. Sekarang layar, ringkasan, dan cetakan memakai peta yang
 * sama.
 */

export type ReportStatus =
  | 'SELESAI'
  | 'BADAL'
  | 'SEDANG_BERLANGSUNG'
  | 'BELUM_DIMULAI'
  | 'BELUM_TEREALISASI';

/** Label untuk tampilan di layar. */
export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  SELESAI: 'Selesai',
  BADAL: 'Badal',
  SEDANG_BERLANGSUNG: 'Berlangsung',
  BELUM_DIMULAI: 'Belum Dimulai',
  BELUM_TEREALISASI: 'Belum Diisi',
};

/**
 * Label untuk laporan cetak. Sengaja dipisah dari label layar supaya cetakan
 * bisa lebih ringkas tanpa mengorbankan keterbacaan.
 */
export const REPORT_STATUS_PRINT_LABEL: Record<ReportStatus, string> = {
  SELESAI: 'Selesai',
  BADAL: 'Badal',
  SEDANG_BERLANGSUNG: 'Berlangsung',
  BELUM_DIMULAI: 'Belum Dimulai',
  BELUM_TEREALISASI: 'Belum Diisi',
};

/** Class badge di layar (mengikuti gaya badge yang sudah dipakai halaman lain). */
export const REPORT_STATUS_BADGE: Record<ReportStatus, string> = {
  SELESAI: 'inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200',
  BADAL: 'inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-bold bg-amber-50 text-amber-700 border border-amber-200',
  SEDANG_BERLANGSUNG:
    'inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse',
  BELUM_DIMULAI:
    'inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-bold bg-slate-100 text-slate-600 border border-slate-200',
  BELUM_TEREALISASI:
    'inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-bold bg-rose-50 text-rose-700 border border-rose-200',
};

/** Status yang berarti slot sudah tertangani (terlaksana, termasuk lewat badal). */
export const isFilledStatus = (status: ReportStatus): boolean =>
  status === 'SELESAI' || status === 'BADAL';

/** Slot yang masih berjalan atau belum dimulai. */
export const isPendingStatus = (status: ReportStatus): boolean =>
  status === 'SEDANG_BERLANGSUNG' || status === 'BELUM_DIMULAI';

/** Slot yang terlewat / tidak diisi sama sekali. */
export const isUnrealizedStatus = (status: ReportStatus): boolean =>
  status === 'BELUM_TEREALISASI';
