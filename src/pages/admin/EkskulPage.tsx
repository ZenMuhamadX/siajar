import React from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { Activity, Sparkles } from 'lucide-react';

export const EkskulPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Ekstrakurikuler"
        description="Manajemen program ekstrakurikuler sekolah dan pembina kegiatan."
      />

      <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-2xs">
        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <Activity className="w-6 h-6 text-slate-600" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="font-bold text-slate-900 text-base">
            Modul Kegiatan Ekstrakurikuler
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Struktur navigasi dan relasi database telah disiapkan pada Stage 1. Fitur pengelolaan pembina dan jadwal ekstrakurikuler akan aktif penuh pada Stage 5.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Tahap Pengembangan Stage 5</span>
        </div>
      </div>
    </div>
  );
};
