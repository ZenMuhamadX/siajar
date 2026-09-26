import { supabase } from '../lib/supabase';

/**
 * Klien untuk Edge Function `manage-users`.
 *
 * Semua aksi yang mengubah akun (buat akun, ganti kode, nonaktifkan) dijalankan
 * di server. Browser tidak pernah memegang service_role key, dan tidak bisa
 * menulis app_metadata sendiri.
 */

const FUNCTION_NAME = 'manage-users';

export interface TeacherAccount {
  guru_id: string;
  nama_guru: string;
  has_account: boolean;
  active: boolean;
  last_sign_in_at: string | null;
}

/** Ubah galat FunctionsHttpError jadi kalimat yang bisa dibaca pengguna. */
async function friendlyError(error: unknown): Promise<string> {
  const anyErr = error as { context?: Response; message?: string; name?: string };

  try {
    const res = anyErr?.context;
    if (res && typeof res.clone === 'function') {
      const body = (await res.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    }
  } catch {
    /* lanjut ke fallback */
  }

  const msg = anyErr?.message ?? '';
  if (/failed to send|404|not found/i.test(msg)) {
    return 'Layanan akun belum tersedia. Pastikan Edge Function "manage-users" sudah di-deploy.';
  }
  if (/failed to fetch|network/i.test(msg)) {
    return 'Tidak dapat menghubungi server. Periksa koneksi internet.';
  }
  return msg || 'Terjadi kesalahan pada layanan akun.';
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body });
  if (error) throw new Error(await friendlyError(error));

  const payload = data as { error?: string } | null;
  if (payload?.error) throw new Error(payload.error);

  return data as T;
}

/** Apakah instance ini sudah punya admin? Dipakai untuk memutuskan layar setup. */
export async function getSetupStatus(): Promise<{ hasAdmin: boolean }> {
  return invoke<{ hasAdmin: boolean }>({ action: 'status' });
}

/** Buat akun admin pertama. Hanya berhasil selama belum ada admin. */
export async function bootstrapAdmin(password: string): Promise<{ email: string }> {
  return invoke<{ ok: true; email: string }>({ action: 'bootstrap-admin', password });
}

/** Status akun seluruh guru (untuk kolom Status di panel Data Guru). */
export async function listTeacherAccounts(): Promise<TeacherAccount[]> {
  const res = await invoke<{ accounts: TeacherAccount[] }>({ action: 'list-accounts' });
  return res.accounts ?? [];
}

/** Buatkan akun guru baru + kodenya. */
export async function createTeacherAccount(guruId: string, code: string): Promise<void> {
  await invoke({ action: 'create-teacher', guruId, code });
}

/** Ganti kode guru yang akunnya sudah ada. */
export async function setTeacherCode(guruId: string, code: string): Promise<void> {
  await invoke({ action: 'set-teacher-code', guruId, code });
}

/** Aktifkan / nonaktifkan akun guru. */
export async function setTeacherActive(guruId: string, active: boolean): Promise<void> {
  await invoke({ action: 'set-teacher-active', guruId, active });
}
