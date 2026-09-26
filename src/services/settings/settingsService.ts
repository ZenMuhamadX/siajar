import { supabase } from '../../lib/supabase';
import {
  DEFAULT_SETTINGS,
  fromRow,
  normalizeSettings,
  toRow,
  type AppSettings,
} from './appSettings';

/**
 * Akses Pengaturan dari database.
 *
 * Aplikasi ini memakai tabel singleton `agenda.app_settings` (id = 1) sehingga
 * semua komputer membaca baris yang sama — mengatur warna export di satu
 * komputer langsung berlaku di komputer lain. Tidak ada endpoint, tidak ada
 * RLS bypass, tidak ada kredensial baru: persis mekanisme yang dipakai
 * service lain di aplikasi ini.
 *
 * Di sini juga ada cache modul. Alasannya: beberapa consumer butuh nilai
 * SINKRON tanpa menunggu (mis. `simpanAgenda` yang menulis kolom `sekolah`, dan
 * handler export). Menunggu promise di dalam service yang tidak async akan
 * membuat bug halus, jadi lebih aman menyimpan hasil baca terakhir di modul dan
 * membacanya sinkron. `SettingsProvider` yang mengisi cache itu sekali di awal.
 *
 * Bila tabel belum dibuat (SQL Stage 5.3 belum dijalankan) atau jaringan mati,
 * aplikasi tetap berjalan dengan `DEFAULT_SETTINGS`.
 */

/** Nilai terakhir yang diketahui; `DEFAULT_SETTINGS` bila belum pernah dimuat. */
let cache: AppSettings = DEFAULT_SETTINGS;
let loaded = false;

type Listener = (settings: AppSettings) => void;
const listeners = new Set<Listener>();

/** Nilai Pengaturan saat ini, sinkron. Aman dipanggil dari mana pun. */
export function getSettingsSync(): AppSettings {
  return cache;
}

/** True kalau Pengaturan pernah berhasil dimuat dari database. */
export function isSettingsLoaded(): boolean {
  return loaded;
}

/** Daftar listener sederhana untuk bereaksi terhadap perubahan. */
export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(next: AppSettings) {
  cache = next;
  loaded = true;
  for (const listener of listeners) {
    try {
      listener(next);
    } catch (err) {
      console.error('[settings] listener gagal:', err);
    }
  }
}

/**
 * Muat Pengaturan sekali. Aman dipanggil berkali-kali; hanya pemanggilan
 * pertama yang menyentuh jaringan.
 */
export async function loadSettings(force = false): Promise<AppSettings> {
  if (loaded && !force) return cache;

  try {
    const { data, error } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();

    if (error) {
      // Kondisi wajar: tabel belum dibuat / offline. Nilai bawaan sudah cukup,
      // jadi tidak boleh memblokir aplikasi.
      console.warn(
        '[settings] gagal memuat app_settings, memakai bawaan:',
        error.message,
      );
      return cache;
    }
    if (!data) {
      console.warn('[settings] baris app_settings tidak ada, memakai bawaan.');
      return cache;
    }

    commit(fromRow(data));
    return cache;
  } catch (err) {
    console.warn('[settings] jaringan gagal saat memuat Pengaturan:', err);
    return cache;
  }
}

/**
 * Simpan Pengaturan.
 *
 * Selalu menormalkan dulu: collaborate dengan CHECK constraint di database
 * (warna 6-digit hex, enum, rentang angka) sehingga saat ini tidak mungkin
 * gagal karena validasi — dan kalau gagal, return pesan yang bisa ditampilkan.
 */
export async function saveSettings(
  next: AppSettings,
  updatedBy: string | null,
): Promise<{ ok: true; settings: AppSettings } | { ok: false; message: string }> {
  const clean = normalizeSettings(next);

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert(toRow(clean, updatedBy))
      .select()
      .single();

    if (error) {
      console.error('[settings] gagal menyimpan Pengaturan:', error.message);
      return { ok: false, message: `Gagal menyimpan pengaturan: ${error.message}` };
    }

    commit(fromRow(data ?? toRow(clean, updatedBy)));
    return { ok: true, settings: cache };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[settings] exception saat menyimpan Pengaturan:', err);
    return { ok: false, message: `Gagal menyimpan pengaturan: ${message}` };
  }
}

/** Kembalikan ke `DEFAULT_SETTINGS` (dan langsung simpan ke database). */
export async function resetSettings(
  updatedBy: string | null,
): Promise<{ ok: true; settings: AppSettings } | { ok: false; message: string }> {
  return saveSettings(DEFAULT_SETTINGS, updatedBy);
}

/** Hanya untuk pengujian: isi cache tanpa menyentuh database. */
export function __setSettingsCacheForTest(value: unknown): AppSettings {
  commit(normalizeSettings(value));
  return cache;
}
