import React from 'react';
import { PageHeader } from '../../components/admin/PageHeader';
import { ShieldCheck, Database, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const PengaturanPage: React.FC = () => {
  const { activeTeacherName } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi sistem SIAJAR dan parameter operasional sekolah."
      />

      <div className="space-y-4">
        {/* Info Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Sesi Administrator</h3>
              <p className="text-xs text-slate-500">
                Pengguna saat ini: <span className="font-semibold text-slate-800">{activeTeacherName || 'Administrator'}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                Basis Data
              </span>
              <p className="text-slate-500 text-[11px]">
                Supabase PostgreSQL (Schema: <code className="bg-slate-200/80 px-1 rounded">agenda</code>)
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                Metode Autentikasi
              </span>
              <p className="text-slate-500 text-[11px]">
                PIN Sekolah Universal & PIN Admin Terproteksi
              </p>
            </div>
          </div>
        </div>

        {/* System parameters summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm">Informasi Satuan Pendidikan</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-slate-400 text-[11px]">Nama Sekolah</dt>
              <dd className="font-semibold text-slate-800">SDIT AS-SYIFA</dd>
            </div>
            <div>
              <dt className="text-slate-400 text-[11px]">Aplikasi</dt>
              <dd className="font-semibold text-slate-800">SIAJAR (Sistem Agenda & Jadwal)</dd>
            </div>
            <div>
              <dt className="text-slate-400 text-[11px]">Model Jam Pelajaran (JP)</dt>
              <dd className="font-semibold text-slate-800">35 Menit / Jam Pelajaran</dd>
            </div>
            <div>
              <dt className="text-slate-400 text-[11px]">Versi Sistem</dt>
              <dd className="font-semibold text-slate-800">Stage 1.5 (Modern Admin UI)</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};
