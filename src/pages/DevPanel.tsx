import React from 'react';
import { DashboardOverview } from './admin/DashboardOverview';
import { RekapAgenda } from './RekapAgenda';
import { DataSiswa } from './DataSiswa';
import { DataGuru } from './DataGuru';
import { DataMapel } from './DataMapel';
import { KotakSaranList } from './admin/KotakSaranList';
import type { FullAgenda } from '../types';
import {
  LogOut,
  LayoutDashboard,
  Users,
  GraduationCap,
  FileSpreadsheet,
  BookOpen,
  FileEdit,
  MessageSquare,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface DevPanelProps {
  subTab: DevSubTab;
  onSubTabChange: (tab: DevSubTab) => void;
  onBackToApp: () => void;
  onStartEditAgenda?: (agenda: FullAgenda) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export type DevSubTab = 'overview' | 'agenda' | 'rekap' | 'siswa' | 'guru' | 'mapel' | 'saran';

export const DevPanel: React.FC<DevPanelProps> = ({
  subTab,
  onSubTabChange,
  onBackToApp,
  onStartEditAgenda,
  showToast,
}) => {
  const { signOut } = useAuth();

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Desktop Header & Sub Navigation */}
      <div className="hidden md:flex bg-slate-900 text-white rounded-xl p-3.5 items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToApp}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
            title="Keluar dari Panel Admin ke Tampilan Guru"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Mode Guru</span>
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold tracking-wide">
              Panel Administrator
            </h2>
          </div>
        </div>

        {/* Tab Selector Desktop */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-lg text-xs gap-1">
          <button
            onClick={() => onSubTabChange('overview')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              subTab === 'overview'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Ringkasan</span>
          </button>

          <button
            onClick={() => onSubTabChange('agenda')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              subTab === 'agenda'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Isi/Koreksi Agenda</span>
          </button>

          <button
            onClick={() => onSubTabChange('rekap')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              subTab === 'rekap'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Rekap</span>
          </button>

          <button
            onClick={() => onSubTabChange('siswa')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              subTab === 'siswa'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Siswa</span>
          </button>

          <button
            onClick={() => onSubTabChange('guru')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              subTab === 'guru'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Guru</span>
          </button>

          <button
            onClick={() => onSubTabChange('mapel')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              subTab === 'mapel'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Mapel</span>
          </button>

          <button
            onClick={() => onSubTabChange('saran')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              subTab === 'saran'
                ? 'bg-purple-600 text-white font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Saran</span>
          </button>
        </div>
      </div>

      {/* Mobile Top Mini Header (Clean & Space-Efficient) */}
      <div className="md:hidden flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-1 bg-purple-100 text-purple-700 rounded font-bold text-[10px] uppercase tracking-wider">
            Admin
          </span>
          <span className="text-xs font-bold text-slate-800 capitalize">
            {subTab === 'overview' && 'Ringkasan Dashboard'}
            {subTab === 'agenda' && 'Isi / Koreksi Agenda'}
            {subTab === 'rekap' && 'Rekapitulasi'}
            {subTab === 'siswa' && 'Data Siswa'}
            {subTab === 'guru' && 'Data Guru'}
            {subTab === 'mapel' && 'Data Mapel'}
            {subTab === 'saran' && 'Kotak Saran Guru'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onBackToApp}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition"
          >
            Mode Guru
          </button>
          <button
            onClick={signOut}
            title="Keluar"
            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub Tab Contents */}
      <div className="w-full">
        {subTab === 'overview' && (
          <DashboardOverview
            onNavigateTab={(tab) => onSubTabChange(tab)}
            showToast={showToast}
          />
        )}
        {subTab === 'agenda' && (
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5 shadow-xs">
            <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Form Agenda (Superuser / Admin)</h3>
                <p className="text-xs text-slate-500">Admin memiliki izin untuk mengisi atau mengoreksi agenda semua kelas.</p>
              </div>
            </div>
            {/* Lazy / direct load agenda form via onBackToApp or standalone */}
            <p className="text-xs text-slate-600 mb-3">
              Gunakan tombol di bawah untuk membuka form input agenda utama kelas:
            </p>
            <button
              onClick={onBackToApp}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <FileEdit className="w-4 h-4" />
              <span>Buka Form Isi Agenda</span>
            </button>
          </div>
        )}
        {subTab === 'rekap' && (
          <RekapAgenda
            showToast={showToast}
            onEditAgenda={onStartEditAgenda}
          />
        )}
        {subTab === 'siswa' && <DataSiswa showToast={showToast} />}
        {subTab === 'guru' && <DataGuru showToast={showToast} />}
        {subTab === 'mapel' && <DataMapel showToast={showToast} />}
        {subTab === 'saran' && <KotakSaranList showToast={showToast} />}
      </div>
    </div>
  );
};
