import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/** Layar tunggu saat sesi masih dibaca dari localStorage. */
export const AuthLoading: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center space-y-2">
      <Loader2 className="w-6 h-6 text-slate-600 animate-spin mx-auto" />
      <p className="text-xs text-slate-500">Memeriksa sesi...</p>
    </div>
  </div>
);

/**
 * Wajib login. Bila belum, lempar ke `/login` sambil menyimpan tujuan awal di
 * `state.from` supaya setelah login user kembali ke halaman yang diminta.
 */
export function RequireAuth() {
  const { activeTeacherName, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;

  if (!activeTeacherName) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

/** Wajib admin — guru biasa yang membuka `/admin/*` dialihkan ke beranda guru. */
export function RequireAdmin() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
