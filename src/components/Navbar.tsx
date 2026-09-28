import { LogOut, FileEdit, History, MessageSquarePlus, CalendarDays } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolName } from '../contexts/SettingsContext';
import { isAgendaFormOpen } from '../routes/useAgendaQuery';
import { FloatingSuggestionButton } from './FloatingSuggestionButton';

interface NavbarProps {
  onOpenKotakSaran: () => void;
  onOpenSchedule?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenKotakSaran, onOpenSchedule }) => {
  const { activeTeacherName, signOut } = useAuth();
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
   * Dipakai untuk menyembunyikan dua hal yang tidak boleh ada saat guru
   * mengisi: tombol saran mengambang (posisinya bebas, bisa berakhir tepat di
   * atas kolom isian) dan bar navigasi bawah — yang memakan 61px ruang
   * vertikal di layar paling membutuhkannya, untuk navigasi yang justru tidak
   * boleh ditinggalkan di tengah pengisian.
   *
   * Predikatnya dipakai bersama `TeacherShell` lewat `isAgendaFormOpen()` di
   * `routes/useAgendaQuery`, supaya penyembunyian bar dan penyusutan ruang
   * bawah `<main>` tidak pernah berbeda pendapat — kalau masing-masing
   * menghitung sendiri, cepat atau lambat muncul celah kosong atau konten
   * tertutup bar.
   */
  const agendaFormOpen = isAgendaFormOpen(pathname, search);

  return (
    <>
      {/* Header atas.
          Di HP dipadatkan: tinggi 48px, logo 28px, subjudul "Agenda
          Pembelajaran" disembunyikan. Semuanya kembali penuh mulai `sm`.

          Navigasi baru pindah ke sini mulai `lg`, bukan `md`. Alasannya
          terukur, bukan selera: dengan brand, empat item nav, dan identitas
          guru, header ini butuh 933px agar tidak berdesakan — sedangkan `md`
          hanya 768px. Akibatnya di rentang 768–933px tiga dari empat item
          terbelah dua baris dan nama sekolah terpotong jadi "SDIT A…".
          Rentang itu (tablet lanskap, laptop kecil, jendela split-screen)
          justru lebih nyaman memakai bar bawah yang memang dirancang untuk
          sentuh — jadi bar bawah kini bertahan sampai `lg`.

          Baris peran ("Guru"/"Superuser") dihapus seluruhnya. `TeacherShell`
          hanya dirender di balik `RequireNonAdmin`, jadi `isAdmin` selalu
          false di sini dan baris itu tidak pernah bisa berbunyi selain
          "Guru" — satu baris tinggi untuk nol informasi. */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between gap-2 h-12 sm:h-16">
            {/* Logo / Brand.
                Nama sekolah sengaja BUKAN heading. Sebelumnya ia `<h1>`, dan
                karena header ini ada di setiap halaman guru, judul halaman
                yang sebenarnya (mis. "Isi Agenda") ikut menjadi `<h1>` kedua —
                dua h1 per halaman, sementara Riwayat memakai `<h2>` untuk hal
                yang sama. Sekarang nama sekolah sekadar teks merek, dan judul
                halaman menjadi satu-satunya `<h1>` di tiap halaman. */}
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/logo.png"
                alt={`Logo ${schoolName}`}
                className="w-7 h-7 sm:w-9 sm:h-9 object-contain rounded-lg shadow-xs shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 leading-tight text-xs sm:text-base truncate">
                  {schoolName}
                </div>
                <p className="hidden sm:block text-xs text-slate-600">Agenda Pembelajaran</p>
              </div>
            </div>

            {/* Navigasi desktop (mulai `lg`).
                Penanda aktif = latar `primary` penuh + huruf tebal. Karena itu
                "Jadwal Saya" — yang membuka modal, bukan berpindah halaman —
                sengaja TIDAK memakai latar: sebelumnya ia memakai
                `bg-primary-50` yang identik dengan keadaan aktif, sehingga saat
                guru berada di Riwayat ada dua elemen yang sama-sama terlihat
                aktif dan penanda halaman berhenti bermakna. Sekarang ia
                dibedakan lewat garis tepi, bukan latar.

                Tiga item pertama adalah tujuan halaman; "Saran" adalah
                utilitas. Pemisah tipis di antaranya menyatakan hierarki itu
                tanpa perlu memindahkan Saran ke tempat lain. */}
            <div className="hidden lg:flex items-center gap-2">
              <NavLink
                to="/"
                end
                className={`tap px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
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
                className={`tap px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
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
                  className="px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-primary-700 border border-primary-300 hover:bg-primary-50 transition"
                  title="Lihat jadwal mengajar saya"
                >
                  <CalendarDays className="w-4 h-4 text-primary-600" aria-hidden="true" />
                  <span>Jadwal Saya</span>
                </button>
              )}

              <span className="w-px h-5 bg-slate-200 shrink-0" aria-hidden="true" />

              <button
                type="button"
                onClick={onOpenKotakSaran}
                className="px-3 py-2 min-h-10 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-600 hover:bg-slate-100 border border-transparent transition"
              >
                <MessageSquarePlus className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>Saran</span>
              </button>
            </div>

            {/* Identitas guru + keluar.
                Nama guru dipertahankan karena satu perangkat kelas bisa dipakai
                bergantian oleh beberapa guru — dengan begitu "sedang masuk
                sebagai siapa" selalu terlihat tanpa perlu membuka apa pun. */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-800 max-w-24 sm:max-w-44 truncate">
                {activeTeacherName || 'Guru'}
              </span>

              {/* Target sentuh 44px (`min-w-11 min-h-11`) di SEMUA ukuran.
                  Sebelumnya 40px di HP — satu-satunya kontrol di aplikasi yang
                  di bawah standar 44px yang dipakai konsisten di tempat lain,
                  dan kebetulan yang paling berkonsekuensi: menekannya
                  mengakhiri sesi. */}
              <button
                type="button"
                aria-label={`Keluar dari sesi ${activeTeacherName || 'guru'}`}
                onClick={signOut}
                title="Keluar / ganti guru"
                className="p-2.5 min-w-11 min-h-11 inline-flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bar navigasi bawah — HP dan tablet, sampai `lg`.
          Tinggi minimumnya mengikuti `--bottom-nav-h` supaya apa pun yang harus
          duduk di atasnya — notifikasi, tombol saran mengambang — memakai angka
          yang sama, bukan tebakan.

          Dua tujuan, bukan empat. Tombol "Jadwal" dilebur ke "Isi Agenda":
          halaman agenda sudah menampilkan jadwal hari itu, dan jadwal mingguan
          ("Jadwal Saya") dibuka dari tombol ringkas di header halaman agenda
          maupun Riwayat. Dengan begitu setiap tombol dapat lebih banyak lebar,
          labelnya bisa lebih besar, dan bar-nya justru lebih pendek — tanpa
          kehilangan satu pun fungsi.

          Disembunyikan saat formulir agenda terbuka: bar ini memakan 61px
          ruang vertikal, dan di layar pengisian itulah ruang paling mahal.
          Navigasinya juga tidak boleh dipakai di tengah pengisian — guru
          keluar lewat tombol "Kembali ke Jadwal" di dalam formulir. */}
      {!agendaFormOpen && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200 shadow-lg px-1.5 pt-1 safe-bottom flex items-stretch justify-around no-print min-h-[var(--bottom-nav-h)]">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `tap flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg min-h-11 ${
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
              `tap flex-1 flex flex-col items-center justify-center gap-0.5 py-1 rounded-lg min-h-11 ${
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
      )}

      {/* Tombol saran mengambang. Sebelumnya tab keempat di bar bawah —
          tab statis memakan lebar sepanjang waktu padahal kotak saran dipakai
          sesekali. Kini bulat, bisa digeser, dan posisinya diingat.
          Disembunyikan saat formulir agenda terbuka supaya tidak pernah
          menghalangi pengisian. */}
      {!agendaFormOpen && <FloatingSuggestionButton onClick={onOpenKotakSaran} />}
    </>
  );
};
