import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getAdminEmail, getAuthDomain } from '../services/userAdminService';

/**
 * Autentikasi berbasis Supabase Auth.
 *
 * Yang berubah dibanding model PIN lama:
 *   - Verifikasi kode sekolah dilakukan SERVER (Supabase Auth), bukan di bundle.
 *   - Tidak ada lagi PIN yang tertanam di berkas JavaScript.
 *   - Peran dibaca dari app_metadata JWT, yang hanya bisa ditulis lewat
 *     service_role (scripts/provision-auth-accounts.ts, Edge Function
 *     `manage-users`) sehingga tidak bisa dipalsukan dari browser.
 *   - Sesi disimpan di perangkat dan diperbarui otomatis → guru masuk sekali.
 *
 * TIGA PERAN (lihat `ROLES` di bawah):
 *   - `guru`       — beranda guru + riwayat agenda.
 *   - `kurikulum`  — area admin TERBATAS: MASTER DATA + PENUGASAN.
 *   - `admin`      — superadmin: seluruh menu, pengaturan sekolah, akun guru.
 *
 * Peran ini hanya menentukan APA YANG TERLIHAT. Batas sebenarnya ditegakkan
 * RLS di database (`agenda.is_staff()` vs `agenda.is_admin()`); menyembunyikan
 * menu tidak pernah dianggap sebagai pengamanan.
 *
 * UX untuk guru tetap sama: pilih nama, ketik kode sekolah, masuk.
 */

/**
 * Email sintetis per guru. Bukan rahasia — hanya identitas akun.
 *
 * Domain diambil dari server (lewat aksi `status` Edge Function) bila sudah
 * terbaca, dengan fallback ke nilai build. Ini mencegah login gagal karena
 * AUTH_DOMAIN di server berbeda dengan VITE_AUTH_DOMAIN di frontend.
 */
const emailForGuru = (guruId: string) => `guru-${guruId}@${getAuthDomain()}`;

/** Peran yang sah. Di luar daftar ini, sesi langsung diputus. */
export type UserRole = 'guru' | 'kurikulum' | 'admin';
const ROLES: readonly string[] = ['guru', 'kurikulum', 'admin'];

interface AuthContextType {
  activeTeacherName: string | null;
  /** Nama akun staf (admin/kurikulum) untuk ditampilkan di header. */
  activeStaffName: string | null;
  /** Peran mentah dari JWT; `null` bila belum login / tidak dikenal. */
  role: UserRole | null;
  /** Superadmin: seluruh menu + pengaturan + kelola akun. */
  isAdmin: boolean;
  /** Kurikulum: area MASTER DATA + PENUGASAN saja. */
  isKurikulum: boolean;
  /** Admin ATAU kurikulum — boleh masuk area `/admin`. */
  isStaff: boolean;
  isDev: boolean;
  loading: boolean;
  loginAsTeacher: (guruId: string, kode: string) => Promise<{ success: boolean; message?: string }>;
  loginAsAdmin: (kode: string) => Promise<{ success: boolean; message?: string }>;
  loginAsStaff: (
    email: string,
    kode: string
  ) => Promise<{ success: boolean; message?: string }>;
  changePassword: (
    sandiLama: string,
    sandiBaru: string
  ) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function roleOf(user: User | null): UserRole | null {
  const meta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const raw = typeof meta.role === 'string' ? meta.role : '';
  return ROLES.includes(raw) ? (raw as UserRole) : null;
}

function nameOf(user: User | null): string | null {
  const meta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  return typeof meta.guru_name === 'string' ? meta.guru_name : null;
}

/** Terjemahkan pesan galat Supabase jadi kalimat yang ramah guru. */
function pesanError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Kode tidak cocok, atau akun Anda belum dibuatkan. Hubungi admin sekolah.';
  }
  if (m.includes('email not confirmed')) return 'Akun ini belum diaktifkan. Hubungi admin sekolah.';
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return 'Terlalu banyak percobaan masuk. Coba lagi beberapa saat lagi.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Tidak dapat menghubungi server. Periksa koneksi internet.';
  }
  return message;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const role = roleOf(user);
  const isValidMember = role !== null;
  // Nama akun staf: `guru_name` di app_metadata juga dipakai admin/kurikulum
  // (diisi saat akun dibuat), jadi tidak perlu sumber kedua.
  const displayName = role !== null && role !== 'guru' ? nameOf(user) : null;
  const activeTeacherName = role === 'guru' ? nameOf(user) : null;

  if (import.meta.env.DEV && session && !isValidMember) {
    // Membantu diagnosis saat mengembangkan: JWT tanpa klaim role yang dikenal.
    console.warn(
      '[auth] Peran tidak dikenal di app_metadata; sesi akan diputus. role =',
      (session.user?.app_metadata as Record<string, unknown>)?.role,
    );
  }

  // Akun yang tidak punya klaim peran yang sah tidak dianggap login.
  useEffect(() => {
    if (session && !isValidMember) {
      void supabase.auth.signOut();
    }
  }, [session, isValidMember]);

  const isAdmin = role === 'admin';
  const isKurikulum = role === 'kurikulum';
  const isStaff = isAdmin || isKurikulum;

  const loginAsTeacher = async (
    guruId: string,
    kode: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!guruId) return { success: false, message: 'Pilih nama guru terlebih dahulu.' };
    if (!kode || !kode.trim()) return { success: false, message: 'Kode sekolah belum diisi.' };

    const { error } = await supabase.auth.signInWithPassword({
      email: emailForGuru(guruId),
      password: kode.trim(),
    });

    if (error) return { success: false, message: pesanError(error.message) };
    return { success: true };
  };

  const loginAsAdmin = async (kode: string): Promise<{ success: boolean; message?: string }> => {
    if (!kode || !kode.trim()) return { success: false, message: 'Kode admin belum diisi.' };

    const { error } = await supabase.auth.signInWithPassword({
      email: getAdminEmail(),
      password: kode.trim(),
    });

    if (error) return { success: false, message: pesanError(error.message) };
    return { success: true };
  };

  /**
   * Login staf (admin ATAU kurikulum) dengan email + sandi.
   *
   * Peran tidak dipilih di layar — server yang menentukannya dari
   * `app_metadata`. Satu pintu untuk dua peran, supaya pemilik akun kurikulum
   * tidak perlu tahu ia "bukan admin", dan supaya tidak ada petunjuk peran
   * yang bocor ke halaman login.
   */
  const loginAsStaff = async (
    email: string,
    kode: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!email || !email.trim()) return { success: false, message: 'Email belum diisi.' };
    if (!kode || !kode.trim()) return { success: false, message: 'Sandi belum diisi.' };

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: kode.trim(),
    });

    if (error) return { success: false, message: pesanError(error.message) };
    return { success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  /**
   * Ganti sandi akun yang sedang login. Sandi lama diverifikasi dulu lewat
   * sign-in ulang, supaya sesi yang tertinggal di laptop terbuka tidak bisa
   * dipakai orang lain untuk mengambil alih akun.
   */
  const changePassword = async (
    sandiLama: string,
    sandiBaru: string
  ): Promise<{ success: boolean; message?: string }> => {
    const email = session?.user?.email;
    if (!email) return { success: false, message: 'Sesi tidak ditemukan. Masuk ulang.' };
    if (!sandiLama.trim()) return { success: false, message: 'Sandi lama belum diisi.' };
    if (sandiBaru.trim().length < 6) {
      return { success: false, message: 'Sandi baru minimal 6 karakter.' };
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: sandiLama.trim(),
    });
    if (reauthError) return { success: false, message: 'Sandi lama tidak cocok.' };

    const { error } = await supabase.auth.updateUser({ password: sandiBaru.trim() });
    if (error) return { success: false, message: pesanError(error.message) };

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        activeTeacherName,
        activeStaffName: displayName,
        role,
        isAdmin,
        isKurikulum,
        isStaff,
        // Dev mode hanya untuk superadmin — kurikulum tidak boleh menyentuh
        // peralatan pengembangan.
        isDev: isAdmin,
        loading,
        loginAsTeacher,
        loginAsAdmin,
        loginAsStaff,
        changePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
