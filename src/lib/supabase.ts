import { createClient } from '@supabase/supabase-js';
import { runtimeConfig } from './runtimeConfig';

/**
 * Alamat dan anon key dibaca lewat `runtimeConfig`, yang urutannya:
 *   1. `siajar-config.json` di luar bundle (hanya SIAJAR Desktop),
 *   2. `VITE_*` yang tertanam saat build,
 *   3. `process.env` (untuk skrip uji yang dijalankan dengan `bun`).
 *
 * Versi desktop memakai jalur (1) supaya satu installer bisa dipasang di
 * sekolah dengan server berbeda tanpa build ulang. Versi web tetap memakai
 * jalur (2) seperti sebelumnya.
 */
const supabaseUrl = runtimeConfig.supabaseUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = runtimeConfig.supabaseAnonKey || 'placeholder-anon-key';

/**
 * Klien Supabase dengan sesi persisten.
 *
 * Anon key memang publik (ia ada di bundle) — itu normal. Yang membuatnya aman
 * adalah RLS di server: tanpa sesi login yang sah, anon hanya boleh membaca
 * kolom id + nama_guru untuk halaman login. Lihat supabase/stage_7_rls_auth.sql.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'agenda' },
  auth: {
    // Sesi disimpan di perangkat dan diperbarui otomatis, sehingga guru cukup
    // masuk sekali (masa sesi diatur di dashboard Supabase, mis. 30 hari).
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'siajar.auth',
  },
});
