import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ShieldCheck, Loader2, AlertCircle, Check, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { bootstrapAdmin, getBuildAuthDomain, getSetupStatus } from '../services/userAdminService';

const MIN_LENGTH = 6;

/**
 * Layar setup sekali-jalan.
 *
 * Muncul hanya selama instance belum punya admin sama sekali. Setelah admin
 * pertama dibuat, halaman ini mengalihkan ke /login dan server akan menolak
 * percobaan bootstrap berikutnya.
 */
export const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsAdmin } = useAuth();

  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [checkError, setCheckError] = useState('');

  // Email admin yang benar-benar dipakai server, plus peringatan bila domain
  // di server berbeda dengan yang tertanam di frontend.
  const [adminEmail, setAdminEmail] = useState(
    (import.meta.env?.VITE_ADMIN_EMAIL as string) || 'admin@siajar.local'
  );
  const [domainMismatch, setDomainMismatch] = useState<string | null>(null);

  const [sandi, setSandi] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSetupStatus()
      .then((res) => {
        if (!mounted) return;
        setHasAdmin(res.hasAdmin);
        if (res.adminEmail) setAdminEmail(res.adminEmail);
        if (res.authDomain && res.authDomain !== getBuildAuthDomain()) {
          setDomainMismatch(res.authDomain);
        }
      })
      .catch((err: Error) => {
        if (mounted) setCheckError(err.message);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Sudah ada admin → tidak ada yang perlu di-setup.
  useEffect(() => {
    if (!checking && hasAdmin) navigate('/login', { replace: true });
  }, [checking, hasAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (sandi.length < MIN_LENGTH) {
      setErrorMsg(`Sandi minimal ${MIN_LENGTH} karakter.`);
      return;
    }
    if (sandi !== ulangi) {
      setErrorMsg('Ulangi sandi belum sama.');
      return;
    }

    setIsSaving(true);
    try {
      await bootstrapAdmin(sandi);

      // Langsung masuk supaya tidak perlu mengetik ulang.
      const res = await loginAsAdmin(sandi);
      if (!res.success) {
        navigate('/login', { replace: true });
        return;
      }
      navigate('/admin/overview', { replace: true });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Memeriksa status instalasi...</p>
        </div>
      </div>
    );
  }

  if (checkError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-start gap-3 text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="text-xs font-medium leading-relaxed">{checkError}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full py-3 text-sm font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
          >
            Ke halaman masuk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Siapkan Admin Pertama
            </h1>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Instance ini belum punya admin. Buat satu akun admin untuk mulai
              mengelola guru dan data sekolah.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Akun admin</span>
              <span className="font-semibold text-slate-800 break-all">{adminEmail}</span>
            </div>
            <p className="text-xs text-slate-500 pt-1 border-t border-slate-200">
              Email ini sudah tetap. Anda hanya memilih sandinya.
            </p>
          </div>

          {domainMismatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Domain di server (<strong>{domainMismatch}</strong>) berbeda dengan
                yang tertanam di frontend (<strong>{getBuildAuthDomain()}</strong>).
                Login guru akan gagal sampai keduanya disamakan — set{' '}
                <code className="bg-amber-100 px-1 rounded">AUTH_DOMAIN</code> pada
                Edge Function atau{' '}
                <code className="bg-amber-100 px-1 rounded">VITE_AUTH_DOMAIN</code> di{' '}
                <code className="bg-amber-100 px-1 rounded">.env</code>.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="setup-sandi"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Sandi Admin
              </label>
              <div className="relative">
                <input
                  id="setup-sandi"
                  type="password"
                  required
                  autoFocus
                  placeholder={`Minimal ${MIN_LENGTH} karakter`}
                  value={sandi}
                  onChange={(e) => setSandi(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label
                htmlFor="setup-ulangi"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Ulangi Sandi
              </label>
              <div className="relative">
                <input
                  id="setup-ulangi"
                  type="password"
                  required
                  placeholder="Ketik ulang sandi yang sama"
                  value={ulangi}
                  onChange={(e) => setUlangi(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat akun admin...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Buat Admin &amp; Masuk</span>
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center leading-relaxed pt-2 border-t border-slate-100">
            Layar ini mati sendiri setelah admin pertama dibuat. Sandi bisa
            diganti nanti dari menu Pengaturan.
          </p>
        </div>
      </div>
    </div>
  );
};
