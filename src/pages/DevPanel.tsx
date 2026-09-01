import React, { useState } from 'react';
import { DashboardOverview } from './admin/DashboardOverview';
import { RekapAgenda } from './RekapAgenda';
import { DataSiswa } from './DataSiswa';
import { DataGuru } from './DataGuru';
import { DataMapel } from './DataMapel';
import { KotakSaranList } from './admin/KotakSaranList';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
  MessageSquare,
} from 'lucide-react';

interface DevPanelProps {
  onBackToApp: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type DevSubTab = 'overview' | 'rekap' | 'siswa' | 'guru' | 'mapel' | 'saran';

export const DevPanel: React.FC<DevPanelProps> = ({ onBackToApp, showToast }) => {
  const [subTab, setSubTab] = useState<DevSubTab>('overview');

  return (
    <div className="space-y-3">
      {/* Dev Header & Sub Navigation */}
      <div className="bg-slate-900 text-white rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToApp}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition flex items-center gap-1 text-xs font-semibold"
            title="Kembali ke Form Agenda"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Form Agenda</span>
          </button>
          <div>
            <h2 className="text-xs sm:text-sm font-bold tracking-wide">
              Panel Admin
            </h2>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center bg-slate-800 p-0.5 rounded text-xs gap-0.5">
          <button
            onClick={() => setSubTab('overview')}
            className={`px-2.5 py-1.5 rounded font-medium transition flex items-center gap-1 ${
              subTab === 'overview'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Ringkasan</span>
          </button>

          <button
            onClick={() => setSubTab('rekap')}
            className={`px-2.5 py-1.5 rounded font-medium transition flex items-center gap-1 ${
              subTab === 'rekap'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Rekap</span>
          </button>

          <button
            onClick={() => setSubTab('siswa')}
            className={`px-2.5 py-1.5 rounded font-medium transition flex items-center gap-1 ${
              subTab === 'siswa'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Siswa</span>
          </button>

          <button
            onClick={() => setSubTab('guru')}
            className={`px-2.5 py-1.5 rounded font-medium transition flex items-center gap-1 ${
              subTab === 'guru'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Guru</span>
          </button>

          <button
            onClick={() => setSubTab('mapel')}
            className={`px-2.5 py-1.5 rounded font-medium transition flex items-center gap-1 ${
              subTab === 'mapel'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Mapel</span>
          </button>

          <button
            onClick={() => setSubTab('saran')}
            className={`px-2.5 py-1.5 rounded font-medium transition flex items-center gap-1 ${
              subTab === 'saran'
                ? 'bg-slate-700 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Saran</span>
          </button>
        </div>
      </div>

      {/* Sub Tab Contents */}
      <div>
        {subTab === 'overview' && (
          <DashboardOverview
            onNavigateTab={(tab) => setSubTab(tab)}
            showToast={showToast}
          />
        )}
        {subTab === 'rekap' && <RekapAgenda showToast={showToast} />}
        {subTab === 'siswa' && <DataSiswa showToast={showToast} />}
        {subTab === 'guru' && <DataGuru showToast={showToast} />}
        {subTab === 'mapel' && <DataMapel showToast={showToast} />}
        {subTab === 'saran' && <KotakSaranList showToast={showToast} />}
      </div>
    </div>
  );
};
