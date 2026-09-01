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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type MainViewType = 'agenda' | 'riwayat' | 'dev';

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
    <>
      {/* Top Header (Clean Minimal Mobile & Desktop) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-13 sm:h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-emerald-700 flex items-center justify-center text-white font-bold">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 leading-tight text-xs sm:text-base">
                  SDIT AS-SYIFA
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500">Agenda Kelas</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => onToggleView('agenda')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  currentView === 'agenda'
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Isi Agenda</span>
              </button>

              <button
                onClick={() => onToggleView('riwayat')}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
                  currentView === 'riwayat'
                    ? 'bg-slate-100 text-slate-900 border border-slate-300 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat Agenda</span>
              </button>

              <button
                onClick={onOpenKotakSaran}
                className="px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1 text-slate-600 hover:bg-slate-50 transition"
              >
                <MessageSquarePlus className="w-3.5 h-3.5 text-slate-500" />
                <span>Saran</span>
              </button>
            </div>

            {/* Right User Info & Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isAdmin && (
                <button
                  onClick={() => onToggleView(currentView === 'dev' ? 'agenda' : 'dev')}
                  className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition border ${
                    currentView === 'dev'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200'
                  }`}
                >
                  <LayoutDashboard className="w-3 h-3 text-purple-600" />
                  <span className="hidden sm:inline">Panel Admin</span>
                  <span className="sm:hidden">Admin</span>
                </button>
              )}

              {/* Teacher Info */}
              <div className="flex flex-col items-end">
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 max-w-[120px] sm:max-w-[150px] truncate">
                  {activeTeacherName || 'Guru'}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="w-2.5 h-2.5 text-purple-600" /> Superuser
                    </>
                  ) : (
                    <>
                      <UserIcon className="w-2.5 h-2.5 text-slate-500" /> Guru
                    </>
                  )}
                </span>
              </div>

              {/* Logout Button */}
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

      {/* Bottom Navigation Bar for Mobile (Thumb-Friendly, Fixed Bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-2 py-1.5 flex items-center justify-around no-print">
        <button
          onClick={() => onToggleView('agenda')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-lg transition ${
            currentView === 'agenda'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileEdit className={`w-5 h-5 mb-0.5 ${currentView === 'agenda' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Isi Agenda</span>
        </button>

        <button
          onClick={() => onToggleView('riwayat')}
          className={`flex-1 flex flex-col items-center justify-center py-1 rounded-lg transition ${
            currentView === 'riwayat'
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className={`w-5 h-5 mb-0.5 ${currentView === 'riwayat' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Riwayat</span>
        </button>

        <button
          onClick={onOpenKotakSaran}
          className="flex-1 flex flex-col items-center justify-center py-1 rounded-lg text-slate-500 hover:text-slate-800 transition"
        >
          <MessageSquarePlus className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Saran</span>
        </button>
      </nav>
    </>
  );
};
