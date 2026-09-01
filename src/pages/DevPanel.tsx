import React, { useState } from 'react';
import { RekapAgenda } from './RekapAgenda';
import { DataSiswa } from './DataSiswa';
import { DataGuru } from './DataGuru';
import { DataMapel } from './DataMapel';
import {
  ArrowLeft,
  Database,
  Users,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
} from 'lucide-react';

interface DevPanelProps {
  onBackToApp: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type DevSubTab = 'rekap' | 'siswa' | 'guru' | 'mapel';

export const DevPanel: React.FC<DevPanelProps> = ({ onBackToApp, showToast }) => {
  const [subTab, setSubTab] = useState<DevSubTab>('rekap');

  return (
    <div className="space-y-4">
      {/* Dev Header & Sub Navigation */}
      <div className="bg-slate-900 text-white rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToApp}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition flex items-center gap-1.5 text-xs font-semibold"
            title="Kembali ke Form Agenda"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Form Agenda</span>
          </button>
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Panel Pengembang / Admin
            </h2>
            <p className="text-[11px] text-slate-400">
              Kelola data master dan rekapitulasi database
            </p>
          </div>
        </div>

        {/* Basic Tab Selector */}
        <div className="flex flex-wrap items-center bg-slate-800 p-1 rounded border border-slate-700 text-xs">
          <button
            onClick={() => setSubTab('rekap')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              subTab === 'rekap'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Rekap
          </button>

          <button
            onClick={() => setSubTab('siswa')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              subTab === 'siswa'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Siswa
          </button>

          <button
            onClick={() => setSubTab('guru')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              subTab === 'guru'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Guru
          </button>

          <button
            onClick={() => setSubTab('mapel')}
            className={`px-3 py-1.5 rounded font-medium transition flex items-center gap-1.5 ${
              subTab === 'mapel'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Mata Pelajaran
          </button>
        </div>
      </div>

      {/* Sub Tab Contents */}
      <div>
        {subTab === 'rekap' && <RekapAgenda showToast={showToast} />}
        {subTab === 'siswa' && <DataSiswa showToast={showToast} />}
        {subTab === 'guru' && <DataGuru showToast={showToast} />}
        {subTab === 'mapel' && <DataMapel showToast={showToast} />}
      </div>
    </div>
  );
};
