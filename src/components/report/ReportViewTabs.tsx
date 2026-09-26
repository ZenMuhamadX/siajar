import React from 'react';
import { useReportViewParam, REPORT_VIEWS, REPORT_VIEW_META, type ReportView } from '../../routes/useReportQueryParam';

/**
 * Tab berpindah tampilan di dalam Pusat Rekap.
 *
 * Menggantikan 4 item menu terpisah (`/admin/rekap_harian`, dst.): sekarang
 * satu pintu dengan 4 tampilan, dan pilihan tersimpan di `?view=` sehingga
 * bisa dibagikan dan Back/Forward bekerja.
 */
export const ReportViewTabs: React.FC = () => {
  const { view, setView } = useReportViewParam();

  return (
    <div
      role="tablist"
      aria-label="Tampilan rekap"
      className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full"
    >
      {REPORT_VIEWS.map((v: ReportView) => {
        const { label, icon: Icon, title } = REPORT_VIEW_META[v];
        const isActive = view === v;
        return (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={isActive}
            title={title}
            onClick={() => setView(v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              isActive
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};
