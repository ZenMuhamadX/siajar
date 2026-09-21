import {
  LogOut,
  ShieldCheck,
  User as UserIcon,
  FileEdit,
  History,
  MessageSquarePlus,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type MainViewType = 'agenda' | 'riwayat' | 'dev';

interface NavbarProps {
  currentView: MainViewType;
  onToggleView: (view: MainViewType) => void;
  onOpenKotakSaran: () => void;
  onOpenSchedule?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onToggleView,
  onOpenKotakSaran,
  onOpenSchedule,
}) => {
  const { activeTeacherName, isAdmin, signOut } = useAuth();

  return (
    <>
      {/* Top Header (Clean Minimal Mobile & Desktop) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-13 sm:h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="Logo SDIT AS-SYIFA"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-lg shadow-xs"
              />
              <div>
                <h1 className="font-bold text-slate-900 leading-tight text-xs sm:text-base">
                  SDIT AS-SYIFA
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500">Agenda Pembelajaran</p>
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

              {onOpenSchedule && (
                <button
                  onClick={onOpenSchedule}
                  className="px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition"
                  title="Lihat Jadwal Mengajar Saya"
                >
                  <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
                  <span>Jadwal Saya</span>
                </button>
              )}

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
              {/* Teacher Info */}
              <div className="flex flex-col items-end">
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 max-w-30 sm:max-w-37.5 truncate">
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

      {/* Bottom Navigation Bar for Mobile (Thumb-Friendly, Fixed Bottom with iOS safe-area support) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200 shadow-lg px-2 pt-1.5 safe-bottom flex items-center justify-around no-print">
        <button
          onClick={() => onToggleView('agenda')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition min-h-[44px] ${
            currentView === 'agenda'
              ? 'text-emerald-700 font-bold bg-emerald-50/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileEdit className={`w-5 h-5 mb-0.5 ${currentView === 'agenda' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Isi Agenda</span>
        </button>

        <button
          onClick={() => onToggleView('riwayat')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition min-h-[44px] ${
            currentView === 'riwayat'
              ? 'text-emerald-700 font-bold bg-emerald-50/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className={`w-5 h-5 mb-0.5 ${currentView === 'riwayat' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px]">Riwayat</span>
        </button>

        {onOpenSchedule && (
          <button
            onClick={onOpenSchedule}
            className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg text-purple-700 hover:text-purple-900 transition min-h-[44px]"
          >
            <CalendarDays className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Jadwal</span>
          </button>
        )}

        <button
          onClick={onOpenKotakSaran}
          className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition min-h-[44px]"
        >
          <MessageSquarePlus className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Saran</span>
        </button>
      </nav>
    </>
  );
};
