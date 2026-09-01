import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getDaftarGuru } from '../services/agendaService';
import type { Guru } from '../types';
import { LogIn, Lock, User, AlertCircle, Loader2, Shield } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginAsTeacher, loginAsAdmin } = useAuth();
  const [mode, setMode] = useState<'teacher' | 'admin'>('teacher');
  const [daftarGuru, setDaftarGuru] = useState<Guru[]>([]);
  const [selectedGuru, setSelectedGuru] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoadingGuru, setIsLoadingGuru] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadTeachers() {
      setIsLoadingGuru(true);
      try {
        const teachers = await getDaftarGuru();
        setDaftarGuru(teachers);
        if (teachers.length > 0) {
          setSelectedGuru(teachers[0].nama_guru);
        }
      } catch (err) {
        console.error('Gagal mengambil daftar guru:', err);
      } finally {
        setIsLoadingGuru(false);
      }
    }
    loadTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'admin') {
        const res = await loginAsAdmin(pin);
        if (!res.success) {
          setErrorMsg(res.message || 'Login Admin gagal.');
        }
      } else {
        const res = await loginAsTeacher(selectedGuru, pin);
        if (!res.success) {
          setErrorMsg(res.message || 'PIN atau Guru tidak valid.');
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
              SDIT AS-SYIFA
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Sistem Agenda & Jurnal Kelas Harian
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
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin / Superuser</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'teacher' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Masuk sebagai
                </label>
                <div className="relative">
                  <select
                    required
                    disabled={isLoadingGuru || daftarGuru.length === 0}
                    value={selectedGuru}
                    onChange={(e) => setSelectedGuru(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition font-medium"
                  >
                    {daftarGuru.length === 0 ? (
                      <option value="">{isLoadingGuru ? 'Memuat guru...' : 'Belum ada data guru'}</option>
                    ) : (
                      daftarGuru.map((g) => (
                        <option key={g.id} value={g.nama_guru}>
                          {g.nama_guru}
                        </option>
                      ))
                    )}
                  </select>
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Login Superuser untuk mengelola semua data & rekap.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sandi
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Masukan Sandi"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition ${
                    mode === 'admin' ? 'focus:ring-purple-500' : 'focus:ring-emerald-500'
                  }`}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || (mode === 'teacher' && daftarGuru.length === 0)}
              className={`w-full py-3 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2 ${
                mode === 'admin'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
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
                  <span>{mode === 'admin' ? 'Masuk sebagai Admin' : 'Masuk ke Sistem'}</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-100">
            <p className="text-[11px] text-slate-400">
              Akses khusus Guru & Pengembang SDIT AS-SYIFA
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
