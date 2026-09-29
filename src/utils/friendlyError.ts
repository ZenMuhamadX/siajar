/**
 * Pemetaan galat menjadi pesan Indonesia yang ramah pengguna (K-12).
 *
 * Sebelumnya halaman rekap menampilkan `err.message` mentah dari Supabase
 * (mis. "permission denied for table agenda_header", "JWT expired"), yang
 * membocorkan detail teknis dan tidak memberi tahu pengguna harus berbuat apa.
 *
 * Fungsi di sini MURNI dan selalu mengembalikan string — tidak pernah melempar.
 */

/** Kode/istilah yang menandakan masalah sesi/izin. */
const SESSION_PATTERNS = [/jwt/i, /token/i, /401/, /unauthor/i, /not\s*authenticated/i];

/** Kode/istilah yang menandakan masalah konektivitas. */
const NETWORK_PATTERNS = [/failed to fetch/i, /network/i, /timeout/i, /econn/i, /503/];

/** Kode/istilah yang menandakan masalah izin/kebijakan. */
const PERMISSION_PATTERNS = [/permission denied/i, /row-level security/i, /rls/i, /403/];

export interface FriendlyErrorContext {
  /** Kata benda aktivitas, mis. "rekap harian" untuk "Gagal memuat rekap harian." */
  subject: string;
}

/**
 * Ubah error apa pun menjadi pesan yang bisa ditindaklanjuti pengguna.
 *
 * Contoh:
 *   mapFriendlyError({ message: 'JWT expired' }, { subject: 'rekap harian' })
 *   → "Sesi Anda berakhir. Silakan masuk ulang, lalu coba lagi."
 */
export function mapFriendlyError(error: unknown, ctx: FriendlyErrorContext): string {
  const raw =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  if (SESSION_PATTERNS.some((p) => p.test(raw))) {
    return 'Sesi Anda berakhir. Silakan masuk ulang, lalu muat ulang halaman ini.';
  }
  if (NETWORK_PATTERNS.some((p) => p.test(raw))) {
    return `Koneksi ke server terputus saat memuat ${ctx.subject}. Periksa jaringan, lalu coba lagi.`;
  }
  if (PERMISSION_PATTERNS.some((p) => p.test(raw))) {
    return `Anda tidak memiliki akses untuk melihat ${ctx.subject}. Hubungi administrator.`;
  }
  return `Gagal memuat ${ctx.subject}. Coba segarkan halaman; bila terus berulang, hubungi administrator.`;
}
