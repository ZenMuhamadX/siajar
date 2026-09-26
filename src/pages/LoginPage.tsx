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
} from 'lucide-react';

type GuruOption = { id: string; nama_guru: string };

export const LoginPage: React.FC = () => {
  const { loginAsTeacher, loginAsAdmin } = useAuth();
  // Nama sekolah dari Pengaturan. Render pertama tetap memakai nilai bawaan
  // supaya halaman login tidak menunggu jaringan.
  const schoolName = useSchoolName();
  const [mode, setMode] = useState<'teacher' | 'admin'>('teacher');
  const [daftarGuru, setDaftarGuru] = useState<GuruOption[]>([]);
  const [selectedGuru, setSelectedGuru] = useState('');
  const [kode, setKode] = useState('');
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
      if (mode === 'admin') {
        const res = await loginAsAdmin(kode);
        if (!res.success) {
          setErrorMsg(res.message || 'Login Admin gagal.');
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Card */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <img
              src="/logo.png"
              alt="Logo Lembaga"
              className="w-16 h-16 mx-auto object-contain drop-shadow-sm"
            />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {schoolName}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Sistem Manajemen Pembelajaran {schoolName}
            </p>
          </div>

          {/* Mode Tabs (Guru vs Admin Superuser) */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('teacher');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'teacher'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Guru</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
                mode === 'admin'
                  ? 'bg-white text-red-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
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

          <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition font-medium"
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
              <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl text-xs text-primary-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600 shrink-0" />
                <span>Login Admin untuk mengelola semua data </span>
              </div>
            )}

            <div>
              <label
                htmlFor="login-sandi"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Kode Anda
              </label>
              <div className="relative">
                <input
                  id="login-sandi"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Kode pribadi dari admin"
                  value={kode}
                  onChange={(e) => setKode(e.target.value)}
                  className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition ${
                    mode === 'admin' ? 'focus:ring-primary-500' : 'focus:ring-primary-500'
                  }`}
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-0.5 text-slate-600 hover:text-slate-600 transition rounded"
                  title={showPassword ? 'Sembunyikan' : 'Lihat'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || (mode === 'teacher' && daftarGuru.length === 0)}
              className={`w-full py-3 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2 ${
                mode === 'admin'
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{mode === 'admin' ? 'Masuk sebagai Admin' : 'Masuk sebagai Guru'}</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              Akses khusus Guru & Pengembang {schoolName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
