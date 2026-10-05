import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_TAB_IDS, canAccessTab, type AdminTab } from './adminRoutes';

/** Layar tunggu saat sesi masih dibaca dari localStorage. */
export const AuthLoading: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center space-y-2">
      <Loader2 className="w-6 h-6 text-slate-600 animate-spin mx-auto" />
      <p className="text-xs text-slate-600">Memeriksa sesi...</p>
    </div>
  </div>
);

/**
 * Wajib login. Bila belum, lempar ke `/login` sambil menyimpan tujuan awal di
 * `state.from` supaya setelah login user kembali ke halaman yang diminta.
 */
export function RequireAuth() {
  const { activeTeacherName, isStaff, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;

  // Staf (admin/kurikulum) tidak punya `activeTeacherName` — beranda guru
  // bukan tujuan mereka, jadi arahkan ke panel admin.
  if (!activeTeacherName && !isStaff) {
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

/**
 * Wajib staf (superadmin ATAU kurikulum). Guru biasa yang membuka `/admin/*`
 * dialihkan ke beranda guru.
 *
 * CATATAN: ini BUKAN pengamanan — hanya kenyamanan navigasi. Batas wewenang
 * yang sesungguhnya ditegakkan RLS di database (`agenda.is_staff()` /
 * `agenda.is_admin()`), sehingga memanggil API langsung tetap ditolak.
 */
export function RequireAdmin() {
  const { isStaff } = useAuth();

  if (!isStaff) return <Navigate to="/" replace />;

  return <Outlet />;
}

/**
 * Batasi halaman admin tertentu ke peran yang berhak.
 *
 * Tanpa ini, akun kurikulum masih bisa membuka `/admin/pengaturan` dengan
 * mengetik URL-nya langsung — sidebar memang menyembunyikannya, tetapi URL
 * bukan UI. Halaman yang tidak dikenal dibiarkan lewat (ditangani 404), dan
 * segmen yang bukan tab sah tidak dianggap pelanggaran.
 */
export function RequireTabAccess() {
  const { role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;

  const segment = location.pathname.replace(/^\/admin\/?/, '').split('/')[0] ?? '';
  const isKnownTab = (ADMIN_TAB_IDS as string[]).includes(segment);

  if (isKnownTab && !canAccessTab(role, segment as AdminTab)) {
    // Kembalikan ke halaman pertama yang boleh dibuka peran ini.
    return <Navigate to={staffHomePath(role)} replace />;
  }

  return <Outlet />;
}

/**
 * Beranda yang tepat untuk staf saat mendarat di `/` (guru) atau setelah login.
 *
 * Kurikulum tidak punya akses ke `overview`, jadi mengarahkannya ke `siswa`
 * mencegah satu putaran redirect lewat `RequireTabAccess`.
 */
export function staffHomePath(role: string | null): string {
  return role === 'kurikulum' ? '/admin/siswa' : '/admin/overview';
}
