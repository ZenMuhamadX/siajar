/**
 * Palet warna mata pelajaran — MURNI, tanpa React, tanpa ExcelJS, tanpa DOM.
 *
 * Dipakai dua tempat: halaman Data Mapel (pratinjau & pemilih warna) dan
 * penulis file Excel (fill latar sel). Semua keputusan "mapel ini warna apa"
 * ada di sini supaya bisa diuji tanpa membuka Excel sama sekali.
 *
 * Aturan yang dipegang:
 *   1. Warna pilihan pengguna SELALU menang atas palet otomatis.
 *   2. Mapel yang belum diwarnai dibagi sisa palet secara BERURUTAN dan
 *      deterministik — bukan di-hash satu per satu. Alasannya penting:
 *      dengan 12 mapel dan 12 warna, penugasan berbasis hash hampir pasti
 *      menghasilkan tabrakan (dua mapel berwarna sama), padahal permintaan
 *      pemilik produk adalah "warna unik untuk setiap mata pelajaran".
 *      Pembagian berurutan menjamin warna berbeda selama mapel <= jumlah palet.
 *   3. Warna teks dihitung otomatis dari luminance latar, sehingga warna
 *      gelap pilihan pengguna tetap terbaca (teks jadi putih).
 *
 * Kompromi yang disadari: urutan pembagian mengikuti nama mapel, jadi
 * menambah/mengganti nama mapel bisa menggeser warna mapel lain yang belum
 * diatur. Ini ditukar dengan jaminan "tidak ada warna kembar" — dan pengguna
 * yang ingin warna tetap tinggal mengaturnya manual.
 */

/** Bentuk minimum mapel yang dibutuhkan untuk penugasan warna. */
export interface SubjectLike {
  id?: string | null;
  nama_mapel?: string | null;
  warna?: string | null;
}

/**
 * Palet bawaan: 9 warna "terang-tegas" lebih dulu, lalu 9 versi lembutnya.
 *
 * Dua alasan urutannya begini:
 *   - Sembilan warna pertama adalah sembilan rumpun warna berbeda (merah,
 *     koral, kuning, hijau, toska, biru, ungu, merah muda, abu), jadi sekolah
 *     dengan <= 9 mapel mendapat warna yang benar-benar mudah dibedakan.
 *   - Sembilan berikutnya adalah versi lebih lembut dari rumpun yang sama,
 *     dipakai hanya kalau mapelnya lebih banyak — masih berbeda, walau
 *     se-rumpun dengan warna di atasnya.
 *
 * Semuanya sengaja terang supaya teks gelap tetap kontras, tidak bertabrakan
 * dengan header gelap (1F3864) dan band hari, dan hemat tinta saat dicetak.
 */
export const SUBJECT_PALETTE: readonly string[] = [
  // ── rumpun tegas (dipakai lebih dulu) ──
  'F7C1C1', // merah
  'F5C4B3', // koral
  'FAC775', // kuning tua
  'C0DD97', // hijau
  '9FE1CB', // toska
  'B5D4F4', // biru
  'CECBF6', // ungu
  'F4C0D1', // merah muda
  'D3D1C7', // abu
  // ── rumpun lembut (cadangan bila mapel > 9) ──
  'FCEBEB', // merah
  'FAECE7', // koral
  'FAEEDA', // kuning
  'EAF3DE', // hijau
  'E1F5EE', // toska
  'E6F1FB', // biru
  'EEEDFE', // ungu
  'FBEAF0', // merah muda
  'F1EFE8', // abu
];

const HEX6 = /^[0-9A-Fa-f]{6}$/;

/**
 * Bersihkan warna opsional: kembalikan 6 digit hex uppercase, atau string
 * kosong bila kosong/tidak valid.
 *
 * Berbeda dari `normalizeColor()` di appSettings yang jatuh ke nilai bawaan
 * saat data rusak, di sini "tidak valid" diperlakukan sama dengan "belum
 * diatur" (string kosong) — supaya warna rusak jatuh ke palet otomatis,
 * bukan ke warna default yang mungkin tidak nyambung dengan mapelnya.
 */
export function normalizeOptionalColor(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim().replace(/^#/, '').toUpperCase();
  return HEX6.test(cleaned) ? cleaned : '';
}

/**
 * Hash deterministik 32-bit (FNV-1a).
 *
 * Dipakai HANYA sebagai cadangan terakhir: untuk kegiatan yang tidak ada di
 * master mapel (mis. "UPACARA", "ISTIRAHAT") sehingga tidak punya identitas
 * stabil untuk dibagi berurutan. Tidak dipakai untuk mapel master.
 */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Warna palet dari hash sebuah nama. Case-insensitive supaya "PAI" = "pai". */
export function paletteColorFor(seed: string): string {
  const key = (seed ?? '').trim().toLowerCase();
  if (!key) return SUBJECT_PALETTE[0];
  return SUBJECT_PALETTE[hashSeed(key) % SUBJECT_PALETTE.length];
}

const nameKey = (value?: string | null) => (value ?? '').trim().toLowerCase();

/**
 * Warna untuk satu mapel secara mandiri (berbasis hash).
 *
 * Berguna untuk pratinjau cepat, tetapi TIDAK menjamin warna unik antar mapel.
 * Untuk pewarnaan yang sebenarnya (dan pratinjau yang cocok dengan hasil
 * export), pakai `buildSubjectFillResolver()`.
 */
export function resolveSubjectFill(input: {
  id?: string | null;
  name?: string | null;
  override?: string | null;
}): string {
  const chosen = normalizeOptionalColor(input.override);
  if (chosen) return chosen;
  const seed = (input.id ?? '').trim() || (input.name ?? '');
  return paletteColorFor(seed);
}

/**
 * Resolver warna untuk satu kumpulan master mapel.
 *
 * Mengembalikan fungsi `(id, name) => hex` yang dipakai BERSAMA oleh pratinjau
 * di Data Mapel dan oleh penulis Excel — sehingga apa yang dilihat pengguna di
 * tabel sama persis dengan yang muncul di file.
 *
 * Urutan keputusan:
 *   1. warna manual mapel (lewat `subject_id`, lalu lewat nama),
 *   2. warna hasil pembagian palet (mapel tanpa warna manual),
 *   3. hash nama — kegiatan di luar master mapel.
 *
 * Mapel berwarna manual "mengunci" warnanya lebih dulu, dan palet untuk yang
 * lain diambil dari warna yang belum terpakai, supaya mapel otomatis tidak
 * menabrak pilihan manual.
 */
export function buildSubjectFillResolver(
  subjects: SubjectLike[],
): (id?: string | null, name?: string | null) => string {
  const manualById = new Map<string, string>();
  const manualByName = new Map<string, string>();
  const takenColors = new Set<string>();

  for (const subject of subjects) {
    const warna = normalizeOptionalColor(subject.warna);
    if (!warna) continue;
    takenColors.add(warna);
    if (subject.id) manualById.set(subject.id, warna);
    const key = nameKey(subject.nama_mapel);
    if (key && !manualByName.has(key)) manualByName.set(key, warna);
  }

  // Mapel tanpa warna manual, diurutkan secara stabil (nama lalu id) supaya
  // pembagian palet dapat direproduksi persis di setiap export.
  const autoSubjects = subjects
    .filter((s) => !normalizeOptionalColor(s.warna))
    .sort(
      (a, b) =>
        nameKey(a.nama_mapel).localeCompare(nameKey(b.nama_mapel)) ||
        String(a.id ?? '').localeCompare(String(b.id ?? '')),
    );

  const freePool = SUBJECT_PALETTE.filter((c) => !takenColors.has(c));
  const autoById = new Map<string, string>();
  const autoByName = new Map<string, string>();

  autoSubjects.forEach((subject, index) => {
    // Bila mapel lebih banyak daripada sisa palet, mulai berputar dari awal.
    const color =
      freePool.length > 0
        ? freePool[index % freePool.length]
        : SUBJECT_PALETTE[index % SUBJECT_PALETTE.length];
    if (subject.id) autoById.set(subject.id, color);
    const key = nameKey(subject.nama_mapel);
    if (key && !autoByName.has(key)) autoByName.set(key, color);
  });

  return (id?: string | null, name?: string | null) => {
    const key = nameKey(name);
    const byId = id ? (manualById.get(id) ?? autoById.get(id)) : undefined;
    return (
      byId ??
      manualByName.get(key) ??
      autoByName.get(key) ??
      paletteColorFor(id || name || '')
    );
  };
}

/** Luminance relatif sesuai WCAG 2.1. */
function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(hex.slice(0, 2), 16));
  const g = channel(parseInt(hex.slice(2, 4), 16));
  const b = channel(parseInt(hex.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Warna teks yang kontras dengan latar: hitam untuk latar terang, putih untuk
 * latar gelap. Dipilih mana yang rasio kontrasnya lebih tinggi, bukan sekadar
 * ambang tetap — sehingga tetap benar di zona abu-abu.
 */
export function contrastTextColor(hex: string): string {
  const c = normalizeOptionalColor(hex);
  if (!c) return '000000';
  const luminance = relativeLuminance(c);
  const againstBlack = (luminance + 0.05) / 0.05;
  const againstWhite = 1.05 / (luminance + 0.05);
  return againstBlack >= againstWhite ? '000000' : 'FFFFFF';
}
