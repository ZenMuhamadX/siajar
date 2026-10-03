import { supabase } from '../lib/supabase';
import type { Kelas, SiswaTerdaftar } from '../types';
import { getDaftarSiswa } from './agendaService';

/**
 * Kenaikan kelas.
 *
 * Pratinjaunya dihitung di klien dari data yang sudah ada — halaman tidak perlu
 * memanggil server hanya untuk menampilkan "berapa siswa akan naik". Yang
 * dijalankan di server hanyalah EKSEKUSINYA, sebagai satu fungsi transaksional
 * (`agenda.kenaikan_kelas`), supaya tidak ada keadaan setengah jadi kalau
 * koneksi putus di tengah.
 *
 * Aturan yang dipakai, sama persis dengan yang ada di fungsi SQL:
 *   - hanya siswa yang AKTIF **pada tahun ajaran asal** yang dibuatkan penempatan
 *     di tahun ajaran baru;
 *   - siswa tingkat 6 ditandai LULUS, tanpa penempatan baru;
 *   - siswa NONAKTIF / PINDAH_KELUAR dilewati, tetapi tetap dicatat.
 *
 * Yang dibaca adalah `status` pada PENEMPATAN, bukan status global siswa —
 * pertanyaannya memang "apakah anak ini aktif di tahun itu".
 */

export interface PromotionPreviewRow {
  kelasFrom: Kelas;
  /** Kelas tujuan. `null` untuk tingkat 6, atau kalau belum ada di master data. */
  kelasTo: Kelas | null;
  naik: number;
  lulus: number;
  dilewati: number;
  /**
   * Siswa AKTIF yang seharusnya naik, tetapi kelas tujuan tingkat berikutnya
   * belum ada di master data. Bukan nol berarti kenaikan akan DITOLAK server.
   */
  tanpaTujuan: number;
}

export interface PromotionPreview {
  rows: PromotionPreviewRow[];
  totalNaik: number;
  totalLulus: number;
  totalDilewati: number;
  /** Label kelas tujuan yang belum ada (atau sudah tidak aktif) di master data. */
  kelasTujuanHilang: string[];
  /**
   * Siswa yang kelas asalnya tidak ada di daftar kelas sama sekali.
   *
   * Bukan nol berarti ada ketidakcocokan data: siswa itu akan dilewati tanpa
   * pernah muncul di pratinjau. Sengaja dihitung supaya bisa dilaporkan, bukan
   * hilang diam-diam.
   */
  siswaTanpaKelasSumber: number;
}

/**
 * Hitung pratinjau kenaikan kelas. Murni — tidak menyentuh jaringan, supaya
 * gampang diuji dan halaman tetap tipis.
 *
 * `classes` sebaiknya berisi SEMUA kelas termasuk yang nonaktif: kelas asal bisa
 * saja sudah ditutup sementara siswanya masih tercatat di sana. Yang dibatasi ke
 * kelas aktif hanyalah sisi TUJUAN — jangan menaikkan siswa ke rombel yang sudah
 * ditutup.
 */
export function buildPromotionPreview(
  siswa: SiswaTerdaftar[],
  classes: Kelas[],
): PromotionPreview {
  const byId = new Map(classes.map((k) => [k.id, k]));
  const byTingkatRombel = new Map(
    classes.filter((k) => k.is_active).map((k) => [`${k.tingkat}|${k.rombel}`, k]),
  );

  const perKelas = new Map<string, PromotionPreviewRow>();
  let siswaTanpaKelasSumber = 0;

  for (const s of siswa) {
    const kelasFrom = byId.get(s.kelas_id);
    if (!kelasFrom) {
      siswaTanpaKelasSumber += 1;
      continue;
    }

    const kelasTo =
      kelasFrom.tingkat >= 6
        ? null
        : (byTingkatRombel.get(`${kelasFrom.tingkat + 1}|${kelasFrom.rombel}`) ?? null);

    let row = perKelas.get(kelasFrom.id);
    if (!row) {
      row = { kelasFrom, kelasTo, naik: 0, lulus: 0, dilewati: 0, tanpaTujuan: 0 };
      perKelas.set(kelasFrom.id, row);
    }

    // `s.status` di sini adalah status pada tahun ajaran asal (lihat
    // `getDaftarSiswa`), jadi pertanyaannya tepat: aktif di tahun itu atau tidak.
    if (s.status !== 'AKTIF') row.dilewati += 1;
    else if (kelasFrom.tingkat >= 6) row.lulus += 1;
    else if (kelasTo) row.naik += 1;
    else row.tanpaTujuan += 1;
  }

  const rows = [...perKelas.values()].sort(
    (a, b) =>
      a.kelasFrom.tingkat - b.kelasFrom.tingkat ||
      a.kelasFrom.rombel.localeCompare(b.kelasFrom.rombel, 'id'),
  );

  return {
    rows,
    totalNaik: rows.reduce((n, r) => n + r.naik, 0),
    totalLulus: rows.reduce((n, r) => n + r.lulus, 0),
    totalDilewati: rows.reduce((n, r) => n + r.dilewati, 0),
    kelasTujuanHilang: rows
      .filter((r) => r.tanpaTujuan > 0)
      .map((r) => `${r.kelasFrom.tingkat + 1}${r.kelasFrom.rombel}`),
    siswaTanpaKelasSumber,
  };
}

export async function getPromotionPreview(
  fromAcademicYearId: string,
  classes: Kelas[],
): Promise<PromotionPreview> {
  const siswa = await getDaftarSiswa({ academicYearId: fromAcademicYearId });
  return buildPromotionPreview(siswa, classes);
}

/**
 * Apakah tahun ajaran tujuan masih bersih.
 *
 * Fungsi SQL menolak kalau tidak bersih; pemeriksaan di sini hanya supaya
 * tombolnya bisa dimatikan lebih awal dengan penjelasan, bukan supaya server
 * melewatkan pengecekan.
 */
export async function cekTahunAjaranTujuanBersih(
  toAcademicYearId: string,
): Promise<{ bersih: boolean; jumlah: number }> {
  const [penempatan, wali] = await Promise.all([
    supabase
      .from('siswa_kelas')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', toAcademicYearId),
    supabase
      .from('homeroom_assignment')
      .select('id', { count: 'exact', head: true })
      .eq('academic_year_id', toAcademicYearId),
  ]);

  if (penempatan.error) throw penempatan.error;
  if (wali.error) throw wali.error;

  const jumlah = (penempatan.count ?? 0) + (wali.count ?? 0);
  return { bersih: jumlah === 0, jumlah };
}

export interface PromotionResult {
  batch_id: string;
  naik: number;
  lulus: number;
  dilewati: number;
  wali_kelas: number;
}

export interface RollbackResult {
  penempatan_dihapus: number;
  status_dikembalikan: number;
  wali_dihapus: number;
}

/** Pesan dari `RAISE EXCEPTION` Postgres sudah berbahasa Indonesia — pakai apa adanya. */
function pesanGalat(error: { message: string; hint?: string | null }): string {
  return error.message || 'Terjadi kesalahan yang tidak dijelaskan server.';
}

export async function jalankanKenaikanKelas(
  fromAcademicYearId: string,
  toAcademicYearId: string,
): Promise<PromotionResult> {
  const { data, error } = await supabase.rpc('kenaikan_kelas', {
    p_from: fromAcademicYearId,
    p_to: toAcademicYearId,
  });
  if (error) throw new Error(pesanGalat(error));
  return data as PromotionResult;
}

export async function batalkanKenaikanKelas(batchId: string): Promise<RollbackResult> {
  const { data, error } = await supabase.rpc('batalkan_kenaikan_kelas', { p_batch: batchId });
  if (error) throw new Error(pesanGalat(error));
  return data as RollbackResult;
}

/**
 * Batch kenaikan kelas yang menyasar sebuah tahun ajaran, kalau ada.
 *
 * Dipakai supaya tombol pembatalan tetap muncul setelah halaman dimuat ulang —
 * tanpa ini, batch hanya diketahui selama halaman belum ditutup.
 */
export interface BatchRingkasan {
  naik: number;
  lulus: number;
  dilewati: number;
  tahunTujuan: string;
  statusTahunTujuan: string;
}

/**
 * Isi satu batch kenaikan kelas.
 *
 * Dipakai untuk menjelaskan APA yang akan dihapus sebelum pembatalan dijalankan —
 * sebuah tindakan merusak sebaiknya menyebutkan angkanya lebih dulu, bukan
 * melaporkannya setelah terlanjur berjalan.
 */
export async function getBatchRingkasan(batchId: string): Promise<BatchRingkasan | null> {
  const { data, error } = await supabase
    .from('promotion_log')
    .select('hasil, tahun:academic_year_to (name, status)')
    .eq('batch_id', batchId);
  if (error) throw error;
  if (!data || data.length === 0) return null;

  const hitung = (hasil: string) =>
    (data as any[]).filter((r) => r.hasil === hasil).length;
  const pertama = data[0] as any;

  return {
    naik: hitung('NAIK'),
    lulus: hitung('LULUS'),
    dilewati: hitung('DILEWATI'),
    tahunTujuan: pertama.tahun?.name ?? '—',
    statusTahunTujuan: pertama.tahun?.status ?? '—',
  };
}

export async function getBatchForTahunAjaran(toAcademicYearId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('promotion_log')
    .select('batch_id')
    .eq('academic_year_to', toAcademicYearId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.batch_id as string) ?? null;
}
