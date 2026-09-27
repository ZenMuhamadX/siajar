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
import { FloatingSuggestionButton } from './FloatingSuggestionButton';

interface NavbarProps {
  onOpenKotakSaran: () => void;
  onOpenSchedule?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenKotakSaran, onOpenSchedule }) => {
  const { activeTeacherName, isAdmin, signOut } = useAuth();
  const { pathname, search } = useLocation();
  const schoolName = useSchoolName();

  // View aktif diturunkan dari URL (/ vs /riwayat), bukan state terpisah,
  // supaya refresh & tombol Back tetap berada di halaman yang sama.
  const currentView: 'agenda' | 'riwayat' = pathname.startsWith('/riwayat')
    ? 'riwayat'
    : 'agenda';

  /**
   * Formulir agenda sedang terbuka (`?slot=` atau `?edit=`).
   *
   * Dipakai untuk MENYEMBUNYIKAN tombol saran mengambang: saat guru mengisi
   * agenda, satu-satunya hal yang boleh ada di layar adalah isian itu. Tombol
   * mengambang memang tidak menempel di tengah, tetapi posisinya bebas —
   * tanpa aturan ini ia bisa berakhir tepat di atas kolom atau tombol simpan.
   */
  const agendaParams = new URLSearchParams(search);
  const isAgendaFormOpen =
    !pathname.startsWith('/riwayat') &&
    (agendaParams.has('slot') || agendaParams.has('edit'));

  return (
    <>
      {/* Top Header (Clean Minimal Mobile & Desktop).
          Di HP header ini dipadatkan: tinggi 48px (dari 52px), logo 28px,
          subjudul "Agenda Pembelajaran" disembunyikan, dan baris peran
          (Guru/Superuser) ikut disembunyikan karena shell ini memang hanya
          untuk guru — selalu berbunyi "Guru", jadi hanya memakan satu baris
          tanpa menambah informasi. Semuanya kembali penuh mulai `sm`. */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between gap-2 h-12 sm:h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/logo.png"
                alt={`Logo ${schoolName}`}
                className="w-7 h-7 sm:w-9 sm:h-9 object-contain rounded-lg shadow-xs shrink-0"
              />
              <div className="min-w-0">
                <h1 className="font-bold text-slate-900 leading-tight text-xs sm:text-base truncate">
                  {schoolName}
                </h1>
                <p className="hidden sm:block text-xs text-slate-600">Agenda Pembelajaran</p>
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
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Teacher Info.
                  Ikon peran sebelumnya 10px (`w-2.5 h-2.5`) — praktis tidak
                  terbaca. Nama guru tetap dipotong dengan `truncate`, tetapi
                  batasnya kini sedikit lebih longgar di layar kecil.
                  Baris peran disembunyikan di HP: `TeacherShell` berada di
                  balik `RequireNonAdmin`, jadi isinya selalu "Guru" — satu
                  baris terbuang tanpa menambah apa pun. */}
              <div className="flex flex-col items-end min-w-0">
                <span className="text-xs font-bold text-slate-800 max-w-24 sm:max-w-44 truncate">
                  {activeTeacherName || 'Guru'}
                </span>
                <span className="hidden sm:flex text-xs text-slate-600 font-medium items-center gap-1">
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
                className="p-2 min-w-10 min-h-10 sm:p-2.5 sm:min-w-11 sm:min-h-11 inline-flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Navigation Bar for Mobile (Thumb-Friendly, Fixed Bottom with iOS safe-area support).
          Tinggi minimumnya mengikuti `--bottom-nav-h` supaya apa pun yang harus
          duduk di atasnya — saat ini notifikasi — memakai angka yang sama,
          bukan tebakan.

          Tiga tujuan, bukan empat. Tombol "Jadwal" dilebur ke "Isi Agenda":
          halaman agenda sudah menampilkan jadwal hari itu, dan jadwal mingguan
          ("Jadwal Saya") kini dibuka dari tombol ringkas di header halaman
          agenda. Dengan begitu setiap tombol dapat lebih banyak lebar, labelnya
          bisa lebih besar, dan bar-nya justru lebih pendek — tanpa kehilangan
          satu pun fungsi. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200 shadow-lg px-1.5 pt-1 safe-bottom flex items-stretch justify-around no-print min-h-[var(--bottom-nav-h)]">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg transition min-h-11 ${
              isActive
                ? 'text-primary-700 font-bold bg-primary-50/70'
                : 'text-slate-600 hover:text-slate-900'
            }`
          }
        >
          <FileEdit
            className={`w-5 h-5 ${currentView === 'agenda' ? 'stroke-[2.5]' : ''}`}
            aria-hidden="true"
          />
          <span className="text-2xs leading-none">Agenda</span>
        </NavLink>

        <NavLink
          to="/riwayat"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg transition min-h-11 ${
              isActive
                ? 'text-primary-700 font-bold bg-primary-50/70'
                : 'text-slate-600 hover:text-slate-900'
            }`
          }
        >
          <History
            className={`w-5 h-5 ${currentView === 'riwayat' ? 'stroke-[2.5]' : ''}`}
            aria-hidden="true"
          />
          <span className="text-2xs leading-none">Riwayat</span>
        </NavLink>
      </nav>

      {/* Tombol saran mengambang. Sebelumnya tab keempat di bar bawah —
          tab statis memakan lebar sepanjang waktu padahal kotak saran dipakai
          sesekali. Kini bulat, bisa digeser, dan posisinya diingat.
          Disembunyikan saat formulir agenda terbuka supaya tidak pernah
          menghalangi pengisian. */}
      {!isAgendaFormOpen && <FloatingSuggestionButton onClick={onOpenKotakSaran} />}
    </>
  );
};
