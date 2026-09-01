import React from 'react';
import {
  BookOpen,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  LayoutDashboard,
  FileEdit,
  History,
  MessageSquarePlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type MainViewType = 'agenda' | 'riwayat' | 'absensi' | 'dev';

interface NavbarProps {
  currentView: MainViewType;
  onToggleView: (view: MainViewType) => void;
  onOpenKotakSaran: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onToggleView,
  onOpenKotakSaran,
}) => {
  const { activeTeacherName, isAdmin, signOut } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight text-sm sm:text-base">
                SDIT AS-SYIFA
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500">Agenda Kelas</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onToggleView('agenda')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === 'agenda'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Isi Agenda</span>
            </button>

            <button
              onClick={() => onToggleView('riwayat')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === 'riwayat'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Riwayat Saya</span>
            </button>

            <button
              onClick={() => onToggleView('absensi')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                currentView === 'absensi'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Rekap Absensi</span>
            </button>

            {/* Kotak Saran Button */}
            <button
              onClick={onOpenKotakSaran}
              title="Kotak Saran"
              className="px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 text-slate-600 hover:bg-slate-100 hover:text-emerald-700 transition"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Saran</span>
            </button>

            {/* Admin / Dev Switch Button */}
            {isAdmin && (
              <button
                onClick={() => onToggleView(currentView === 'dev' ? 'agenda' : 'dev')}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition border ${
                  currentView === 'dev'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">Panel Admin</span>
              </button>
            )}

            {/* Divider */}
            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* Teacher Info */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700 max-w-[130px] truncate">
                {activeTeacherName || 'Guru'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-purple-600" /> Superuser
                  </>
                ) : (
                  <>
                    <UserIcon className="w-3 h-3 text-emerald-600" /> Guru
                  </>
                )}
              </span>
            </div>

            {/* Logout / Ganti Guru */}
            <button
              onClick={signOut}
              title="Ganti Guru / Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
