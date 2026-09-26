import { createClient } from '@supabase/supabase-js';

const globalProcess = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || globalProcess?.env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || globalProcess?.env?.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

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
