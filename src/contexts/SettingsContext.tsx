import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../services/settings/appSettings';
import {
  getSettingsSync,
  isSettingsLoaded,
  loadSettings,
  resetSettings,
  saveSettings,
  subscribeSettings,
} from '../services/settings/settingsService';
import { useAuth } from './AuthContext';

/**
 * Provider Pengaturan.
 *
 * Satu-satunya tempat yang memuat Pengaturan dari database, dan itu terjadi
 * SEKALI saat aplikasi start. Semua halaman cukup baca lewat `useSettings()`,
 * dan yang butuh nilai sinkron (export, service) memakai `getSettingsSync()`.
 *
 * `loading` sengaja tidak jadi blocker: halaman Login/Navbar harus langsung
 * merender dengan nama sekolah bawaan, lalu berubah sendiri setelah Pengaturan
 * tiba. Menunggu di sini akan bikin brand berkedip atau layout bergeser.
 */

interface SettingsContextValue {
  settings: AppSettings;
  /** True selama Pengaturan pertama kali dimuat. */
  loading: boolean;
  /** True kalau Pengaturan pernah gagal dimuat (tabel belum ada / offline). */
  offline: boolean;
  /** Simpan; selalu menormalkan dulu sebelum dikirim. */
  save: (next: AppSettings) => Promise<{ ok: boolean; message?: string }>;
  /** Kembalikan ke bawaan dan simpan. */
  reset: () => Promise<{ ok: boolean; message?: string }>;
  /** Muat ulang dari database. */
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTeacherName } = useAuth();
  // Mulai dari cache/bawaan supaya render pertama tidak pernah menunggu.
  const [settings, setSettings] = useState<AppSettings>(getSettingsSync());
  const [loading, setLoading] = useState(!isSettingsLoaded());
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await loadSettings();
      if (cancelled) return;
      setSettings(result);
      setOffline(!isSettingsLoaded());
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // // Kalau Pengaturan berubah dari luar (mis. tab lain), ikuti.
  useEffect(() => subscribeSettings(setSettings), []);

  const save = useCallback(
    async (next: AppSettings) => {
      const result = await saveSettings(next, activeTeacherName);
      if (result.ok) {
        setOffline(false);
        return { ok: true };
      }
      return { ok: false, message: result.message };
    },
    [activeTeacherName],
  );

  const reset = useCallback(async () => {
    const result = await resetSettings(activeTeacherName);
    if (result.ok) setOffline(false);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  }, [activeTeacherName]);

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loadSettings(true);
    setSettings(result);
    setOffline(!isSettingsLoaded());
    setLoading(false);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, loading, offline, save, reset, reload }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};

/** Nama sekolah saja — untuk navbar, login, kop, tanda tangan. */
export const useSchoolName = (): string => useSettings().settings.schoolName;

export { DEFAULT_SETTINGS };
