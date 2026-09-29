import { supabase } from '../../lib/supabase';

/**
 * Lapisan query khusus daftar jurnal (bukan detail).
 *
 * Latar belakang: halaman Log Jurnal sebelumnya memanggil `getRekapAgenda()`,
 * yang menarik `*` beserta seluruh anak agenda - termasuk `agenda_absensi` yang
 * me-join tabel siswa, `agenda_kejadian`, materi/PR, dan bukti foto. Untuk satu
 * bulan itu ratusan agenda yang isinya tidak dipakai tabel.
 *
 * Modul ini menyediakan:
 *   - `JOURNAL_LIST_SELECT`: kolom ringkas yang benar-benar dirender tabel,
 *   - filter yang didorong ke SQL (kelas, guru, rentang tanggal, pencarian),
 *   - paginasi server lewat `range` + `count: 'exact'`,
 *   - agregat S/I/A untuk seluruh hasil filter (bukan hanya halaman aktif).
 *
 * Detail agenda lengkap (materi, PR, absensi + nama siswa, kejadian, foto
 * bertanda tangan) diambil terpisah saat baris dibuka - lihat
 * `components/report/AgendaDetailDrawer.tsx`.
 *
 * Batasan PostgREST yang membentuk desain di sini
 * -----------------------------------------------
 * Dua hal ditemukan saat pengujian langsung terhadap project ini:
 *   1. `or=(...)` hanya bisa dipakai pada kolom top-level satu tabel. Menyebutkan
 *      kolom embedded di dalamnya (mis. `agenda_kbm.mapel`) selalu gagal dengan
 *      PGRST100. Karena itu pencarian isi KBM/kejadian dijalankan sebagai query
 *      terpisah lalu digabung lewat `id=in.(...)`.
 *   2. Di dalam `or`, koma adalah pemisah kondisi, sehingga nilai yang memuat
 *      koma harus dibuang lebih dulu. Nama guru di sekolah ini mengandung koma
 *      ("...,S.Pd.,Gr."), dan kebetulan itu justru aman pada filter tunggal.
 */

/** Bentuk baris jurnal di daftar - bukan `FullAgenda`. */
export interface JournalRow {
  id: string;
  sekolah: string | null;
  kelas: string;
  tanggal: string;
  scheduleId: string | null;
  actualTeacherName: string | null;
  createdAt: string | null;
  kbm: {
    id?: string;
    jam_ke: string;
    nama_guru: string;
    mapel: string;
    /**
     * Materi ajar. Dipakai dokumen cetak/PDF jurnal (kolom "Materi") — bukan
     * kolom tabel layar. Wajib ikut di-select, kalau tidak kolomnya selalu "-".
     */
    materi?: string | null;
    is_badal?: boolean;
  }[];
  absensi: { id?: string; siswa_id: string; status: 'S' | 'I' | 'A' }[];
  evidence: {
    id?: string;
    storage_path: string;
    captured_at?: string | null;
    uploaded_at?: string | null;
    actual_teacher_name?: string | null;
  } | null;
}

/** Baris tanpa `*`: hanya kolom yang benar-benar dipakai tabel & ringkasan. */
export const JOURNAL_LIST_SELECT = `
  id,
  sekolah,
  kelas,
  tanggal,
  schedule_id,
  actual_teacher_name,
  created_at,
  agenda_kbm (id, jam_ke, nama_guru, mapel, materi, is_badal),
  agenda_absensi (id, siswa_id, status),
  agenda_evidence (id, storage_path, captured_at, uploaded_at, actual_teacher_name)
`;

/** Batas jumlah id yang dikirim lewat `in.(...)` agar URL tidak membengkak. */
const MAX_SEARCH_IDS = 500;

/** UUID nihil: dipakai agar pencarian tanpa hasil tetap menghasilkan 0 baris. */
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

export interface JournalQueryParams {
  startDate: string; // YYYY-MM-DD inklusif
  endDate: string; // YYYY-MM-DD inklusif
  classId?: string; // 'SEMUA' = semua
  /**
   * Nama guru. Disaring lewat `agenda_header.actual_teacher_name`, yaitu siapa
   * yang benar-benar mengajar.
   *
   * Ini sekaligus memperbaiki bug lama: filter versi lama membandingkan
   * `kbm.nama_guru` secara case-sensitive, sehingga agenda yang diisi guru
   * pengganti tidak pernah muncul saat difilter ke nama pengganti. Kolom ini
   * selalu diisi saat menyimpan agenda (termasuk saat badal), dan `ilike`
   * mengabaikan huruf besar-kecil.
   */
  teacherName?: string;
  /** Pencarian bebas: kelas, guru, mapel, materi, tugas/PR, kejadian. */
  search?: string;
  page?: number; // 1-based; kosong = tanpa paginasi
  pageSize?: number;
}

const isAll = (v?: string) => !v || v === 'SEMUA';

/**
 * Sanitasi untuk filter tunggal (`ilike`).
 *
 * Diuji terhadap project ini: koma, titik, kurung, dan tanda kutip semuanya
 * aman pada filter tunggal - yang tidak boleh lolos hanya wildcard `*` dan
 * karakter escape `\`. Koma sengaja TIDAK dibuang di sini karena nama guru di
 * sekolah ini memang memakai koma ("...,S.Pd.,Gr.").
 */
const escapeSingle = (s: string) => s.replace(/[*\\]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Sanitasi untuk nilai di dalam `or=(...)`.
 *
 * Di `or`, koma adalah pemisah kondisi - memuatnya membuat PostgREST gagal parse
 * (PGRST100). Titik justru aman dan tidak perlu disentuh.
 */
const escapeOr = (s: string) => s.replace(/[,*\\]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Cari id agenda yang cocok dengan kata kunci bebas.
 *
 * Dijalankan sebagai tiga query terpisah (dalam paralel) karena `or=` tidak boleh
 * mencampur kolom header dengan kolom anak:
 *   - `agenda_header`: kelas + guru,
 *   - `agenda_kbm`: mapel, materi, tugas/PR, nama guru,
 *   - `agenda_kejadian`: uraian kejadian.
 *
 * Mengembalikan `null` bila tidak ada kata kunci (tanpa pembatasan).
 */
async function resolveSearchIds(
  search: string
): Promise<{ ids: string[] | null; truncated: boolean }> {
  const term = (search || '').trim();
  if (!term) return { ids: null, truncated: false };

  const s = escapeOr(term);
  if (!s) return { ids: null, truncated: false };
  const like = `%${s}%`;

  const [headers, kbm, kejadian] = await Promise.all([
    supabase
      .from('agenda_header')
      .select('id')
      .or(`kelas.ilike.${like},actual_teacher_name.ilike.${like}`),
    supabase
      .from('agenda_kbm')
      .select('agenda_id')
      .or(`mapel.ilike.${like},materi.ilike.${like},tugas_pr.ilike.${like},nama_guru.ilike.${like}`),
    supabase.from('agenda_kejadian').select('agenda_id').ilike('uraian_kejadian', like),
  ]);

  for (const r of [headers, kbm, kejadian]) {
    if (r.error) throw r.error;
  }

  const ids = new Set<string>();
  for (const r of [headers.data, kbm.data, kejadian.data]) {
    for (const row of r || []) {
      const id = (row as any).id ?? (row as any).agenda_id;
      if (id) ids.add(id);
    }
  }

  return { ids: [...ids], truncated: ids.size > MAX_SEARCH_IDS };
}

/** Query dasar daftar jurnal: rentang tanggal + kelas + guru + id hasil pencarian. */
function buildJournalQuery(params: JournalQueryParams, searchIds: string[] | null) {
  const { startDate, endDate } = params;
  let q = supabase
    .from('agenda_header')
    .select(JOURNAL_LIST_SELECT, { count: 'exact' })
    .gte('tanggal', startDate)
    .lte('tanggal', endDate);

  if (!isAll(params.classId)) {
    q = q.eq('kelas', params.classId);
  }

  if (!isAll(params.teacherName)) {
    // Filter tunggal (bukan or=) supaya nama dengan titik/koma tetap aman.
    q = q.ilike('actual_teacher_name', `%${escapeSingle(params.teacherName!)}%`);
  }

  if (searchIds) {
    q = searchIds.length > 0 ? q.in('id', searchIds) : q.eq('id', NO_MATCH_ID);
  }

  q = q.order('tanggal', { ascending: false }).order('created_at', { ascending: false });

  if (params.page && params.pageSize && params.pageSize > 0) {
    const from = (params.page - 1) * params.pageSize;
    q = q.range(from, from + params.pageSize - 1);
  }

  return q;
}

/** Ubah satu baris `agenda_header` (ringkas) menjadi bentuk `JournalRow`. */
export function mapJournalRow(item: any): JournalRow {
  const rawEvidence = Array.isArray(item.agenda_evidence)
    ? item.agenda_evidence[0]
    : item.agenda_evidence;

  return {
    id: item.id,
    sekolah: item.sekolah ?? null,
    kelas: item.kelas,
    tanggal: item.tanggal,
    scheduleId: item.schedule_id ?? null,
    actualTeacherName: item.actual_teacher_name ?? null,
    createdAt: item.created_at ?? null,
    kbm: item.agenda_kbm || [],
    absensi: item.agenda_absensi || [],
    evidence: rawEvidence
      ? {
          id: rawEvidence.id,
          storage_path: rawEvidence.storage_path,
          captured_at: rawEvidence.captured_at ?? null,
          uploaded_at: rawEvidence.uploaded_at ?? null,
          actual_teacher_name: rawEvidence.actual_teacher_name ?? null,
        }
      : null,
  };
}

export interface JournalRowsResult {
  rows: JournalRow[];
  /** Total baris yang cocok filter (untuk paginasi server). */
  total: number;
  /** Hasil pencarian melebihi batas - pemanggil bisa memberi tahu pengguna. */
  searchTruncated: boolean;
}

/** Ambil satu halaman baris jurnal (payload ringan). */
export async function queryJournalRows(params: JournalQueryParams): Promise<JournalRowsResult> {
  const { ids, truncated } = await resolveSearchIds(params.search || '');
  const { data, error, count } = await buildJournalQuery(params, truncated ? null : ids);
  if (error) throw error;
  return { rows: (data || []).map(mapJournalRow), total: count ?? 0, searchTruncated: truncated };
}

/**
 * Batas aman jumlah baris yang boleh diunduh untuk CETAK (K-05).
 *
 * Cetak berbeda dengan menampilkan: dokumen wajib memuat SELURUH hasil filter,
 * bukan hanya halaman aktif. Tapi menarik ribuan baris sekaligus juga tidak
 * sehat, jadi ada plafon. Bila hasil filter melebihi plafon, pemanggil diberi
 * tahu lewat `truncated` supaya bisa memperingatkan pengguna (bukan diam-diam
 * mencetak sebagian — itu bug aslinya).
 */
export const JOURNAL_PRINT_MAX_ROWS = 2000;

/** Ukuran blok saat mengunduh seluruh baris cetak (menghindari satu query raksasa). */
const PRINT_CHUNK_SIZE = 500;

export interface JournalPrintRowsResult {
  rows: JournalRow[];
  /** Total hasil filter. */
  total: number;
  /** True bila `total` melebihi plafon — `rows` hanya berisi plafon pertama. */
  truncated: boolean;
}

/**
 * Ambil SELURUH baris hasil filter untuk keperluan cetak (K-05).
 *
 * Mengapa tidak memakai `rows` halaman aktif: sebelumnya tombol cetak memakai
 * himpunan baris halaman berjalan, sehingga mencetak dari halaman 1 hanya
 * menghasilkan 25 baris pertama — sisanya hilang tanpa peringatan. Fungsi ini
 * mengunduh semua baris (dalam blok) agar dokumen lengkap.
 */
export async function queryAllJournalRowsForPrint(
  params: JournalQueryParams
): Promise<JournalPrintRowsResult> {
  const { ids, truncated: searchTruncated } = await resolveSearchIds(params.search || '');
  const effectiveIds = searchTruncated ? null : ids;

  const all: JournalRow[] = [];
  let offset = 0;

  // Selama masih ada baris yang kembali dan belum menyentuh plafon, terus ambil.
  while (all.length < JOURNAL_PRINT_MAX_ROWS) {
    const chunkLimit = Math.min(PRINT_CHUNK_SIZE, JOURNAL_PRINT_MAX_ROWS - all.length);
    const { data, error, count } = await buildJournalQuery(
      { ...params, page: undefined, pageSize: undefined },
      effectiveIds
    )
      // `buildJournalQuery` tidak menerima rentang kustom, jadi batasi di sini.
      .range(offset, offset + chunkLimit - 1);

    if (error) throw error;

    const batch = (data || []).map(mapJournalRow);
    all.push(...batch);

    const total = count ?? all.length;
    if (batch.length < chunkLimit || all.length >= total) {
      return { rows: all, total, truncated: total > JOURNAL_PRINT_MAX_ROWS };
    }
    offset += batch.length;
  }

  return { rows: all, total: all.length, truncated: true };
}

/**
 * Agregat ketidakhadiran (S/I/A) untuk rentang + filter yang sama dengan tabel.
 *
 * Dipisah dari query halaman aktif karena pada paginasi server, kartu ringkasan
 * harus mewakili seluruh hasil filter - bukan hanya baris yang sedang tampil.
 * Query ini hanya mengambil status absensi, jadi tetap ringan.
 */
export async function queryJournalAbsenceStats(
  params: JournalQueryParams
): Promise<{ S: number; I: number; A: number; total: number }> {
  const { ids } = await resolveSearchIds(params.search || '');

  let q = supabase
    .from('agenda_header')
    .select('agenda_absensi!inner(status)')
    .gte('tanggal', params.startDate)
    .lte('tanggal', params.endDate);

  if (!isAll(params.classId)) q = q.eq('kelas', params.classId);
  if (!isAll(params.teacherName)) {
    q = q.ilike('actual_teacher_name', `%${escapeSingle(params.teacherName!)}%`);
  }
  if (ids) {
    q = ids.length > 0 ? q.in('id', ids) : q.eq('id', NO_MATCH_ID);
  }

  const { data, error } = await q;
  if (error) throw error;

  const totals = { S: 0, I: 0, A: 0, total: 0 };
  for (const row of data || []) {
    for (const a of (row as any).agenda_absensi || []) {
      const status = a.status as 'S' | 'I' | 'A';
      if (status === 'S' || status === 'I' || status === 'A') totals[status] += 1;
      totals.total += 1;
    }
  }
  return totals;
}
