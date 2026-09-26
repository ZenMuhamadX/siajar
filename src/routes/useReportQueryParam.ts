import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Activity, CalendarDays, CalendarRange, FileSpreadsheet } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Keempat tampilan di dalam Pusat Rekap, disimpan di query `?view=`.
 *
 * Kenapa di URL dan bukan state lokal? Supaya:
 *   - tautan bisa dibagikan ("lihat rekap bulanan Libya" → cukup kirim URL),
 *   - tombol Back/Forward berpindah tampilan seperti navigasi biasa,
 *   - konsisten dengan `?edit=`, `?slot=`, `?date=` yang sudah dipakai halaman agenda.
 *
 * Nilai yang tidak dikenal diabaikan (fallback ke `harian`) lalu dibuang dari
 * URL supaya tidak membingungkan saat dibagikan.
 */
export const REPORT_VIEWS = ['harian', 'mingguan', 'bulanan', 'jurnal'] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

export interface ReportViewMeta {
  /** Label pada tab. */
  label: string;
  /** Judul halaman (dipakai breadcrumb & header). */
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

export const REPORT_VIEW_META: Record<ReportView, ReportViewMeta> = {
  harian: {
    label: 'Harian',
    title: 'Rekap Harian',
    description:
      'Monitoring pelaksanaan jadwal pembelajaran harian, kehadiran guru, status agenda, dan dokumentasi foto.',
    icon: CalendarDays,
  },
  mingguan: {
    label: 'Mingguan',
    title: 'Rekap Mingguan',
    description:
      'Rekap mingguan per guru: JP terjadwal vs terlaksana, durasi, dan Guru Pengganti.',
    icon: FileSpreadsheet,
  },
  bulanan: {
    label: 'Bulanan',
    title: 'Rekap Bulanan',
    description: 'Rekap bulanan per guru untuk laporan dan kebutuhan kepala sekolah.',
    icon: CalendarRange,
  },
  jurnal: {
    label: 'Log Jurnal',
    title: 'Log Jurnal Agenda',
    description: 'Arsip jurnal pembelajaran & KBM seluruh kelas — telusuri, saring, dan cetak laporan.',
    icon: Activity,
  },
};

export const DEFAULT_REPORT_VIEW: ReportView = 'harian';

const isReportView = (v: string | null): v is ReportView =>
  !!v && (REPORT_VIEWS as readonly string[]).includes(v);

/** Tab aktif + penukar tampilan lewat `?view=`. */
export function useReportViewParam(defaultView: ReportView = DEFAULT_REPORT_VIEW) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view');
  const view: ReportView = isReportView(raw) ? raw : defaultView;

  const setView = useCallback(
    (next: ReportView) => {
      if (next === view) return;
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('view', next);
          return params;
        }
        // Push: berpindah tampilan adalah navigasi, jadi Back kembali ke
        // tampilan sebelumnya (bukan seperti mengganti filter, yang replace).
      );
    },
    [view, setSearchParams]
  );

  // `?view=` ngawur → buang agar URL selalu jujur (idempotent).
  useEffect(() => {
    if (raw === null || isReportView(raw)) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('view');
        return params;
      },
      { replace: true }
    );
  }, [raw, setSearchParams]);

  return { view, setView, meta: REPORT_VIEW_META[view] };
}
