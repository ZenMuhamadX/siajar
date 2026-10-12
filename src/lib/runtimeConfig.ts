/**
 * Jembatan konfigurasi runtime untuk SIAJAR Desktop (Electron).
 *
 * Di web, semua nilai datang dari `import.meta.env.VITE_*` yang tertanam saat
 * build. Di desktop, proses utama boleh membaca `siajar-config.json` di luar
 * bundle sehingga satu installer bisa dipasang di sekolah dengan alamat
 * Supabase berbeda tanpa build ulang.
 *
 * Aturannya sederhana: **nilai runtime menang atas nilai build**. Kalau berkas
 * konfigurasi tidak ada (atau kolomnya kosong), perilakunya sama persis dengan
 * versi web.
 *
 * Akses `import.meta.env?.VITE_*` sengaja ditulis eksplisit (bukan lewat objek
 * perantara) supaya tetap diganti Vite saat build — pola yang sama dipakai
 * berkas lain di proyek ini.
 *
 * Lihat docs/DESKTOP-ELECTRON.md untuk format berkasnya.
 */

export interface DesktopConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  authDomain?: string;
  adminEmail?: string;
  /** Jalur berkas konfigurasi yang benar-benar dipakai (untuk diagnosa). */
  source?: string;
}

export interface DownloadDonePayload {
  state: 'completed' | 'cancelled' | 'interrupted';
  filename: string;
  path: string | null;
}

interface DesktopBridge {
  isDesktop?: boolean;
  platform?: string;
  appVersion?: string | null;
  electronVersion?: string | null;
  origin?: string | null;
  config?: DesktopConfig | null;
  onDownloadDone?: (handler: (payload: DownloadDonePayload) => void) => () => void;
  showInFolder?: (filePath: string) => Promise<boolean>;
  openExternal?: (url: string) => Promise<boolean>;
}

const bridge: DesktopBridge | null =
  typeof window !== 'undefined'
    ? ((window as unknown as { siajarDesktop?: DesktopBridge }).siajarDesktop ?? null)
    : null;

/**
 * Fallback untuk skrip uji yang dijalankan dengan `bun <berkas>.ts` di luar
 * Vite — di sana `import.meta.env` bisa kosong dan nilainya dibaca dari
 * `process.env`.
 */
const nodeEnv =
  typeof globalThis !== 'undefined'
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    : undefined;

const buildSupabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const buildSupabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
const buildAuthDomain = import.meta.env?.VITE_AUTH_DOMAIN;
const buildAdminEmail = import.meta.env?.VITE_ADMIN_EMAIL;

/** Ambil nilai pertama yang tidak kosong. */
function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export const desktop = {
  /** true hanya ketika berjalan di dalam SIAJAR Desktop. */
  isDesktop: bridge?.isDesktop === true,
  platform: bridge?.platform ?? null,
  appVersion: bridge?.appVersion ?? null,
  electronVersion: bridge?.electronVersion ?? null,
  /** Origin aplikasi, mis. `app://local`. Berguna saat mencocokkan CORS. */
  origin: bridge?.origin ?? null,
  onDownloadDone: bridge?.onDownloadDone ?? null,
  showInFolder: bridge?.showInFolder ?? null,
  openExternal: bridge?.openExternal ?? null,
};

export const runtimeConfig = {
  supabaseUrl:
    firstNonEmpty(bridge?.config?.supabaseUrl, buildSupabaseUrl, nodeEnv?.VITE_SUPABASE_URL) ?? '',
  supabaseAnonKey:
    firstNonEmpty(
      bridge?.config?.supabaseAnonKey,
      buildSupabaseAnonKey,
      nodeEnv?.VITE_SUPABASE_ANON_KEY
    ) ?? '',
  authDomain:
    firstNonEmpty(bridge?.config?.authDomain, buildAuthDomain, nodeEnv?.VITE_AUTH_DOMAIN) ??
    'siajar.local',
  adminEmail:
    firstNonEmpty(bridge?.config?.adminEmail, buildAdminEmail, nodeEnv?.VITE_ADMIN_EMAIL) ?? '',
  /** Terisi hanya kalau konfigurasi datang dari berkas, bukan dari build. */
  source: bridge?.config?.source ?? null,
};
