import React, { Suspense, lazy } from 'react';
import { LoadingState } from '../../../components/common';
import { ReportScreen } from '../../../components/report/ReportScreen';
import { useReportViewParam } from '../../../routes/useReportQueryParam';
import type { FullAgenda } from '../../../types';

interface ReportCenterPageProps {
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  /** Dipakai tampilan Log Jurnal untuk handoff ke form koreksi. */
  onEditAgenda?: (agenda: FullAgenda) => void;
}

/**
 * Pusat Rekap — satu pintu untuk keempat tampilan laporan.
 *
 * Sebelumnya ada 4 item menu (`/admin/rekap_harian`, `/admin/rekap_mingguan`,
 * `/admin/rekap_bulanan`, `/admin/rekap`) yang namanya mirip sehingga sering
 * membingungkan. Sekarang semuanya hidup di `/admin/rekap?view=…`:
 *
 *   - `view=harian`    → monitoring slot harian (default)
 *   - `view=mingguan`  → agregat per guru, Senin–Minggu
 *   - `view=bulanan`   → agregat per guru, per bulan
 *   - `view=jurnal`    → arsip isi agenda (Log Jurnal)
 *
 * Tampilan tetap di-lazy-load satu per satu supaya bundle tidak membengkak,
 * dan URL lama `/admin/rekap_harian` dst. tetap dialihkan (lihat routes).
 */
const LazyDailyView = lazy(() =>
  import('./RekapHarianPage').then((m) => ({ default: m.RekapHarianPage }))
);
const LazyWeeklyView = lazy(() =>
  import('./RekapMingguanPage').then((m) => ({ default: m.RekapMingguanPage }))
);
const LazyMonthlyView = lazy(() =>
  import('./RekapBulananPage').then((m) => ({ default: m.RekapBulananPage }))
);
const LazyJournalView = lazy(() =>
  import('../../RekapAgenda').then((m) => ({ default: m.RekapAgenda }))
);

export const ReportCenterPage: React.FC<ReportCenterPageProps> = ({
  showToast,
  onEditAgenda,
}) => {
  const { view } = useReportViewParam();

  return (
    <ReportScreen>
      <Suspense fallback={<LoadingState message="Memuat tampilan rekap..." />}>
        {view === 'harian' && <LazyDailyView showToast={showToast} />}
        {view === 'mingguan' && <LazyWeeklyView showToast={showToast} />}
        {view === 'bulanan' && <LazyMonthlyView showToast={showToast} />}
        {view === 'jurnal' && <LazyJournalView showToast={showToast} onEditAgenda={onEditAgenda} />}
      </Suspense>
    </ReportScreen>
  );
};
