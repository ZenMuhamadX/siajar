import {
  LogOut,
  ShieldCheck,
  User as UserIcon,
  FileEdit,
  History,
  MessageSquarePlus,
  CalendarDays,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolName } from '../contexts/SettingsContext';

interface NavbarProps {
  onOpenKotakSaran: () => void;
  onOpenSchedule?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenKotakSaran, onOpenSchedule }) => {
  const { activeTeacherName, isAdmin, signOut } = useAuth();
  const { pathname } = useLocation();
  const schoolName = useSchoolName();

  // View aktif diturunkan dari URL (/ vs /riwayat), bukan state terpisah,
  // supaya refresh & tombol Back tetap berada di halaman yang sama.
  const currentView: 'agenda' | 'riwayat' = pathname.startsWith('/riwayat')
    ? 'riwayat'
    : 'agenda';

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
                alt={`Logo ${schoolName}`}
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-lg shadow-xs"
              />
              <div>
                <h1 className="font-bold text-slate-900 leading-tight text-xs sm:text-base">
                  {schoolName}
                </h1>
                <p className="text-xs sm:text-xs text-slate-600">Agenda Pembelajaran</p>
              </div>
            </div>

            {/* Desktop Navigation Links.
                Sebelumnya menu aktif di desktop ditandai abu-abu (`bg-slate-100`
                + garis tepi) sementara di HP ditandai `primary` — padahal
                `index.css` sudah menetapkan primary sebagai warna navigasi
                aktif. Dua bahasa visual untuk keadaan yang sama membuat guru
                yang berpindah perangkat tidak mengenali penandanya. Sekarang
                keduanya memakai primary. */}
            <div className="hidden md:flex items-center gap-2">
              <NavLink
                to="/"
                end
                className={`px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                  currentView === 'agenda'
                    ? 'bg-primary-50 text-primary-700 border-primary-200 font-bold'
                    : 'text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                <FileEdit className="w-4 h-4" aria-hidden="true" />
                <span>Isi Agenda</span>
              </NavLink>

              <NavLink
                to="/riwayat"
                className={`px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                  currentView === 'riwayat'
                    ? 'bg-primary-50 text-primary-700 border-primary-200 font-bold'
                    : 'text-slate-600 border-transparent hover:bg-slate-100'
                }`}
              >
                <History className="w-4 h-4" aria-hidden="true" />
                <span>Riwayat Agenda</span>
              </NavLink>

              {onOpenSchedule && (
                <button
                  type="button"
                  onClick={onOpenSchedule}
                  className="px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition"
                  title="Lihat jadwal mengajar saya"
                >
                  <CalendarDays className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>Jadwal Saya</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenKotakSaran}
                className="px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-600 hover:bg-slate-100 border border-transparent transition"
              >
                <MessageSquarePlus className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>Saran</span>
              </button>
            </div>

            {/* Right User Info & Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Teacher Info.
                  Ikon peran sebelumnya 10px (`w-2.5 h-2.5`) — praktis tidak
                  terbaca. Nama guru tetap dipotong dengan `truncate`, tetapi
                  batasnya kini sedikit lebih longgar di layar kecil. */}
              <div className="flex flex-col items-end min-w-0">
                <span className="text-xs font-bold text-slate-800 max-w-32 sm:max-w-44 truncate">
                  {activeTeacherName || 'Guru'}
                </span>
                <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                  {isAdmin ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-primary-600 shrink-0" aria-hidden="true" />
                      Superuser
                    </>
                  ) : (
                    <>
                      <UserIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                      Guru
                    </>
                  )}
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                aria-label={`Keluar dari sesi ${activeTeacherName || 'guru'}`}
                onClick={signOut}
                title="Ganti Guru / Logout"
                className="p-2.5 min-w-11 min-h-11 inline-flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Navigation Bar for Mobile (Thumb-Friendly, Fixed Bottom with iOS safe-area support).
          Tinggi minimumnya mengikuti `--bottom-nav-h` supaya elemen lain yang
          harus duduk di atasnya (bilah simpan form, notifikasi) memakai angka
          yang sama — bukan tebakan. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200 shadow-lg px-2 pt-1.5 safe-bottom flex items-center justify-around no-print min-h-[var(--bottom-nav-h)]">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition min-h-11 ${
              isActive
                ? 'text-primary-700 font-bold bg-primary-50/60'
                : 'text-slate-600 hover:text-slate-900'
            }`
          }
        >
          <FileEdit
            className={`w-5 h-5 mb-0.5 ${currentView === 'agenda' ? 'stroke-[2.5]' : ''}`}
            aria-hidden="true"
          />
          <span className="text-xs">Isi Agenda</span>
        </NavLink>

        <NavLink
          to="/riwayat"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition min-h-11 ${
              isActive
                ? 'text-primary-700 font-bold bg-primary-50/60'
                : 'text-slate-600 hover:text-slate-900'
            }`
          }
        >
          <History
            className={`w-5 h-5 mb-0.5 ${currentView === 'riwayat' ? 'stroke-[2.5]' : ''}`}
            aria-hidden="true"
          />
          <span className="text-xs">Riwayat</span>
        </NavLink>

        {onOpenSchedule && (
          <button
            type="button"
            onClick={onOpenSchedule}
            className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg text-primary-700 hover:text-primary-900 hover:bg-primary-50/60 transition min-h-11"
          >
            <CalendarDays className="w-5 h-5 mb-0.5" aria-hidden="true" />
            <span className="text-xs">Jadwal</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenKotakSaran}
          className="flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition min-h-11"
        >
          <MessageSquarePlus className="w-5 h-5 mb-0.5" aria-hidden="true" />
          <span className="text-xs">Saran</span>
        </button>
      </nav>
    </>
  );
};
