import React from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { EmptyState } from '../../components/common';
import { Activity, Sparkles } from 'lucide-react';

export const EkskulPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ekstrakurikuler"
        description="Manajemen program ekstrakurikuler sekolah dan pembina kegiatan."
      />

      {/* Placeholder modul memakai EmptyState standar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
        <EmptyState
          icon={<Activity className="w-5 h-5" />}
          title="Modul Kegiatan Ekstrakurikuler"
          description="Struktur navigasi dan relasi database telah disiapkan, fitur pengelolaan pembina dan jadwal ekstrakurikuler sedang dalam tahap pengembangan"
          action={
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Dalam tahap Pengembangan</span>
            </span>
          }
        />
      </div>
    </div>
  );
};
