import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolName } from '../contexts/SettingsContext';
import { getGuruDirectory } from '../services/agendaService';
import { getSetupStatus } from '../services/userAdminService';
import {
  LogIn,
  Lock,
  User,
  AlertCircle,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  ShieldAlert,
  BookOpen,
} from 'lucide-react';

type GuruOption = { id: string; nama_guru: string };

export const LoginPage: React.FC = () => {
  const { loginAsTeacher, loginAsStaff } = useAuth();
  // Nama sekolah dari Pengaturan. Render pertama tetap memakai nilai bawaan
  // supaya halaman login tidak menunggu jaringan.
  const schoolName = useSchoolName();
  const [mode, setMode] = useState<'teacher' | 'staff'>('teacher');
  const [daftarGuru, setDaftarGuru] = useState<GuruOption[]>([]);
  const [selectedGuru, setSelectedGuru] = useState('');
  const [kode, setKode] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoadingGuru, setIsLoadingGuru] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // null = belum diketahui / layanan tidak tersedia → jangan tampilkan apa pun.
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    async function loadTeachers() {
      setIsLoadingGuru(true);
      try {
        const teachers = await getGuruDirectory();
        setDaftarGuru(teachers);
        if (teachers.length > 0) {
          setSelectedGuru(teachers[0].id);
        }
      } catch (err) {
        console.error('Gagal mengambil daftar guru:', err);
      } finally {
        setIsLoadingGuru(false);
      }
    }
    loadTeachers();
  }, []);

  // Deteksi instance yang belum punya admin, supaya bisa menawarkan layar setup.
  useEffect(() => {
    let mounted = true;
    getSetupStatus()
      .then((res) => {
        if (mounted) setHasAdmin(res.hasAdmin);
      })
      .catch(() => {
        if (mounted) setHasAdmin(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'staff') {
        const res = await loginAsStaff(staffEmail, kode);
        if (!res.success) {
          setErrorMsg(res.message || 'Login staf gagal.');
        }
      } else {
        const res = await loginAsTeacher(selectedGuru, kode);
        if (!res.success) {
          setErrorMsg(res.message || 'Kode tidak cocok, atau akun Anda belum dibuatkan.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Tinggi dikunci ke viewport dan luberannya disembunyikan, supaya di HP
   * halaman ini tidak bisa digulir.
   *
   * Sebelumnya `min-h-screen` — yaitu `100vh`. Di peramban HP, `100vh`
   * mencakup bagian yang tertutup bilah alamat yang menyusut saat digulir,
   * jadi elemennya selalu sedikit LEBIH TINGGI daripada yang benar-benar
   * terlihat, dan halaman ikut tergulir sedikit tanpa isi yang perlu digulir.
   *
   * `dvh` (dynamic viewport height) mengikuti tinggi yang benar-benar
   * terlihat, sehingga tidak ada kelebihan itu. Bila peramban tidak
   * mengenalnya, tinggi tidak terpasang dan halaman kembali bergulir seperti
   * sebelumnya — jadi tidak ada yang rusak, hanya kembali ke perilaku lama.
   *
   * Pembungkus di dalamnya sengaja tetap `overflow-y-auto`: dalam keadaan
   * biasa isinya muat sehingga tidak ada yang bergulir sama sekali, tetapi
   * saat papan ketik terbuka ruang menyusut drastis — tanpa itu, kolom dan
   * tombol "Masuk" bisa terpotong tanpa cara menjangkaunya.
   */
  return (
    <div className="h-dvh overflow-hidden bg-slate-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-full overflow-y-auto overscroll-contain">
        {/* Brand Card */}
        <div
          data-entry-card
          className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-sm space-y-4 sm:space-y-6"
        >
          <div className="text-center space-y-2">
            <img
              src="/logo.png"
              alt="Logo Lembaga"
              className="w-12 h-12 sm:w-16 sm:h-16 mx-auto object-contain drop-shadow-sm"
            />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {schoolName}
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Sistem Manajemen Pembelajaran {schoolName}
            </p>
          </div>

          {/* Mode Tabs (Guru vs Staf).
              Tab "Staf" melayani DUA peran sekaligus — superadmin dan
              kurikulum — karena keduanya masuk dengan email + sandi dan peran
              ditentukan server. Memecahnya jadi tab terpisah akan memberi tahu
              pengunjung bahwa ada peran khusus, tanpa manfaat apa pun.
              Aksen warna tetap satu (`primary`), penanda hanya bobot + ikon. */}
          <div
            role="group"
            aria-label="Pilih jenis akun"
            className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold"
          >
            <button
              type="button"
              aria-pressed={mode === 'teacher'}
              onClick={() => {
                setMode('teacher');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'teacher'
                  ? 'bg-white text-primary-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" aria-hidden="true" />
              <span>Guru</span>
            </button>
            <button
              type="button"
              aria-pressed={mode === 'staff'}
              onClick={() => {
                setMode('staff');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'staff'
                  ? 'bg-white text-primary-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span>Staf</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {hasAdmin === false && (
            <Link
              to="/setup"
              className="block p-3.5 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition"
            >
              <span className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-900 leading-relaxed">
                  <span className="font-bold block mb-0.5">
                    Instance ini belum punya admin
                  </span>
                  Klik di sini untuk membuat akun admin pertama.
                </span>
              </span>
            </Link>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {mode === 'teacher' ? (
              <div>
                <label
                  htmlFor="login-guru"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Masuk sebagai
                </label>
                <div className="relative">
                  <select
                    id="login-guru"
                    required
                    disabled={isLoadingGuru || daftarGuru.length === 0}
                    value={selectedGuru}
                    onChange={(e) => setSelectedGuru(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition font-medium"
                  >
                    {daftarGuru.length === 0 ? (
                      <option value="">{isLoadingGuru ? 'Memuat guru...' : 'Belum ada data guru'}</option>
                    ) : (
                      daftarGuru.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nama_guru}
                        </option>
                      ))
                    )}
                  </select>
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="nama@sekolah.sch.id"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition"
                  />
                  <Shield className="w-4 h-4 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Akun staf kurikulum &amp; administrator.
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="login-sandi"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {mode === 'teacher' ? 'Kode Anda' : 'Sandi'}
              </label>
              <div className="relative">
                <input
                  id="login-sandi"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'teacher' ? 'current-password' : 'current-password'}
                  placeholder={mode === 'teacher' ? 'Kode pribadi dari admin' : 'Sandi akun Anda'}
                  value={kode}
                  onChange={(e) => setKode(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan kode akses' : 'Tampilkan kode akses'}
                  title={showPassword ? 'Sembunyikan' : 'Lihat'}
                  className="absolute right-2 top-1.5 p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition rounded-lg"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || (mode === 'teacher' && daftarGuru.length === 0)}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" aria-hidden="true" />
                  <span>{mode === 'staff' ? 'Masuk sebagai Staf' : 'Masuk sebagai Guru'}</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-100 space-y-2">
            <p className="text-xs text-slate-600">
              Akses khusus Guru & Pengembang {schoolName}
            </p>
            <Link
              to="/panduan"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline transition"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Panduan Penggunaan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
