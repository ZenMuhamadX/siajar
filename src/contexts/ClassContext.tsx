import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Kelas } from '../types';
import { getKelas } from '../services/classService';
import { useAuth } from './AuthContext';

/**
 * Provider Master Kelas.
 *
 * Satu-satunya tempat yang memuat daftar kelas dari database, dan itu terjadi
 * SEKALI saat login. Semua halaman cukup membaca lewat `useClasses()`.
 *
 * Sebelumnya daftar kelas adalah konstanta hardcoded `DAFTAR_KELAS` di
 * `src/types/index.ts`. Konstanta itu dihapus karena setiap penambahan rombel
 * (mis. membuka 1B) menuntut perubahan kode dan deploy ulang. Sekarang sumbernya
 * tabel `agenda.kelas`, dan admin menambah rombel dari halaman Data Kelas.
 *
 * `labels` disediakan supaya pemakai lama yang masih membandingkan kelas sebagai
 * teks (jadwal, filter, export) tidak perlu diubah dulu. Saat kolom kelas
 * berpindah ke referensi `id`, pemakai itu dialihkan ke `classes`.
 *
 * `loading` sengaja bukan blocker: halaman tetap merender, dan daftar kelas
 * menyusul. Daftar kosong sementara berarti dropdown hanya menampilkan pilihan
 * "Semua" — tidak ada tebakan nilai yang salah.
 */

interface ClassContextValue {
  classes: Kelas[];
  /** Label kelas terurut tingkat lalu rombel — pengganti `DAFTAR_KELAS`. */
  labels: string[];
  /** True selama daftar kelas pertama kali dimuat. */
  loading: boolean;
  /** Pesan galat kalau pemuatan gagal (tabel belum ada / offline). */
  error: string | null;
  /** Muat ulang dari database. */
  reload: () => Promise<void>;
  byId: (id: string) => Kelas | undefined;
  byLabel: (label: string) => Kelas | undefined;
}

const ClassContext = createContext<ClassContextValue | undefined>(undefined);

/**
 * Referensi tetap untuk keadaan "belum ada kelas". Kalau ditulis `[]` langsung
 * di badan komponen, array-nya baru setiap render dan membuat `useMemo` di
 * bawah selalu dihitung ulang.
 */
const NO_CLASSES: Kelas[] = [];

export const ClassProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTeacherName, isAdmin } = useAuth();
  // Admin tidak punya nama guru, jadi kehadiran nama saja tidak cukup.
  const isLoggedIn = Boolean(activeTeacherName) || isAdmin;

  const [loadedClasses, setLoadedClasses] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getKelas();
      setLoadedClasses(list);
      setError(null);
    } catch (err: any) {
      // RLS menolak saat belum login — itu wajar, bukan kegagalan.
      console.warn('Gagal memuat master kelas:', err?.message);
      setLoadedClasses([]);
      setError(err?.message || 'Gagal memuat daftar kelas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    void reload();
  }, [isLoggedIn, reload]);

  // Diturunkan saat render, bukan lewat setState di dalam effect: setelah keluar
  // dari akun, sisa data sesi sebelumnya tidak boleh ikut tampil.
  const classes = isLoggedIn ? loadedClasses : NO_CLASSES;
  const visibleError = isLoggedIn ? error : null;

  const value = useMemo<ClassContextValue>(
    () => ({
      classes,
      labels: classes.map((k) => k.label),
      loading,
      error: visibleError,
      reload,
      byId: (id) => classes.find((k) => k.id === id),
      byLabel: (label) => classes.find((k) => k.label === label),
    }),
    [classes, loading, visibleError, reload],
  );

  return <ClassContext.Provider value={value}>{children}</ClassContext.Provider>;
};

export const useClasses = (): ClassContextValue => {
  const ctx = useContext(ClassContext);
  if (!ctx) throw new Error('useClasses must be used within a ClassProvider');
  return ctx;
};

/** Label kelas saja — untuk dropdown dan filter. */
export const useClassLabels = (): string[] => useClasses().labels;
