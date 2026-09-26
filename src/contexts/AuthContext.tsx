import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * Autentikasi berbasis Supabase Auth.
 *
 * Yang berubah dibanding model PIN lama:
 *   - Verifikasi kode sekolah dilakukan SERVER (Supabase Auth), bukan di bundle.
 *   - Tidak ada lagi PIN yang tertanam di berkas JavaScript.
 *   - Peran admin/guru dibaca dari app_metadata JWT, yang hanya bisa ditulis
 *     lewat service_role (scripts/provision-auth-accounts.ts) sehingga tidak
 *     bisa dipalsukan dari browser.
 *   - Sesi disimpan di perangkat dan diperbarui otomatis → guru masuk sekali.
 *
 * UX untuk guru tetap sama: pilih nama, ketik kode sekolah, masuk.
 */

const AUTH_DOMAIN = (import.meta.env?.VITE_AUTH_DOMAIN as string) || 'siajar.local';
const ADMIN_EMAIL = (import.meta.env?.VITE_ADMIN_EMAIL as string) || `admin@${AUTH_DOMAIN}`;

/** Email sintetis per guru. Bukan rahasia — hanya identitas akun. */
const emailForGuru = (guruId: string) => `guru-${guruId}@${AUTH_DOMAIN}`;

interface AuthContextType {
  activeTeacherName: string | null;
  isAdmin: boolean;
  isDev: boolean;
  loading: boolean;
  loginAsTeacher: (guruId: string, kode: string) => Promise<{ success: boolean; message?: string }>;
  loginAsAdmin: (kode: string) => Promise<{ success: boolean; message?: string }>;
  changePassword: (
    sandiLama: string,
    sandiBaru: string
  ) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function roleOf(user: User | null): string {
  const meta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  return typeof meta.role === 'string' ? meta.role : '';
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
  const isValidMember = role === 'guru' || role === 'admin';

  // Akun yang tidak punya klaim peran yang sah tidak dianggap login.
  useEffect(() => {
    if (session && !isValidMember) {
      void supabase.auth.signOut();
    }
  }, [session, isValidMember]);

  const activeTeacherName = isValidMember ? nameOf(user) : null;
  const isAdmin = role === 'admin';

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
      email: ADMIN_EMAIL,
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
        isAdmin,
        isDev: isAdmin, // Dev mode is accessible when admin
        loading,
        loginAsTeacher,
        loginAsAdmin,
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
