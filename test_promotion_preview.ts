import assert from 'node:assert';
import { buildPromotionPreview } from './src/services/promotionService';
import type { Kelas, SiswaStatus, SiswaTerdaftar } from './src/types';

/**
 * Verifikasi aturan kenaikan kelas yang dihitung di klien.
 *
 * `buildPromotionPreview` adalah fungsi murni — seluruh aturan "siapa naik, siapa
 * lulus, siapa dilewati" ada di sini, dan aturan yang sama diulang di fungsi SQL
 * `agenda.kenaikan_kelas`. Kalau keduanya berbeda, pratinjau akan berbohong
 * tentang apa yang akan terjadi. Karena itu aturannya dikunci di sini.
 */

console.log('--- Verifikasi aturan pratinjau kenaikan kelas ---');

const kelas = (tingkat: number, rombel: string): Kelas => ({
  id: `k-${tingkat}${rombel}`,
  tingkat,
  rombel,
  label: `${tingkat}${rombel}`,
  is_active: true,
});

const siswa = (id: string, k: Kelas, status: SiswaStatus): SiswaTerdaftar => ({
  id,
  nama_siswa: `Siswa ${id}`,
  status,
  kelas: k.label,
  kelas_id: k.id,
  academic_year_id: 'ay-2026',
});

// Master kelas lengkap: 1A..6A.
const SEMUA_KELAS: Kelas[] = [1, 2, 3, 4, 5, 6].map((t) => kelas(t, 'A'));

// Test 1: siswa aktif naik satu tingkat, rombel tetap.
{
  const satuA = kelas(1, 'A');
  const p = buildPromotionPreview([siswa('s1', satuA, 'AKTIF')], SEMUA_KELAS);

  assert.strictEqual(p.totalNaik, 1, 'Siswa aktif harus naik');
  assert.strictEqual(p.totalLulus, 0, 'Belum ada yang lulus');
  assert.strictEqual(p.totalDilewati, 0, 'Tidak ada yang dilewati');
  assert.strictEqual(p.rows[0].kelasTo?.label, '2A', 'Kelas tujuan harus tingkat berikutnya');
  console.log('✓ Test 1: siswa aktif naik satu tingkat, rombel tetap');
}

// Test 2: tingkat 6 lulus — tanpa kelas tujuan, tanpa penempatan baru.
{
  const enamA = kelas(6, 'A');
  const p = buildPromotionPreview([siswa('s1', enamA, 'AKTIF')], SEMUA_KELAS);

  assert.strictEqual(p.totalNaik, 0, 'Tingkat 6 tidak naik');
  assert.strictEqual(p.totalLulus, 1, 'Tingkat 6 harus lulus');
  assert.strictEqual(p.rows[0].kelasTo, null, 'Tingkat 6 tidak punya kelas tujuan');
  console.log('✓ Test 2: tingkat 6 lulus, tanpa kelas tujuan');
}

// Test 3: siswa nonaktif / pindah dilewati, bukan dinaikkan.
{
  const duaA = kelas(2, 'A');
  const p = buildPromotionPreview(
    [
      siswa('s1', duaA, 'AKTIF'),
      siswa('s2', duaA, 'NONAKTIF'),
      siswa('s3', duaA, 'PINDAH_KELUAR'),
      siswa('s4', duaA, 'LULUS'),
    ],
    SEMUA_KELAS,
  );

  assert.strictEqual(p.totalNaik, 1, 'Hanya siswa aktif yang naik');
  assert.strictEqual(p.totalDilewati, 3, 'Tiga siswa bukan aktif harus dilewati');
  assert.strictEqual(p.rows[0].dilewati, 3, 'Rincian per kelas ikut benar');
  console.log('✓ Test 3: nonaktif, pindah, dan lulus lama sama-sama dilewati');
}

// Test 4: kelas tujuan belum ada di master → terdeteksi, bukan diam-diam gagal.
{
  const limaA = kelas(5, 'A');
  // Master hanya sampai tingkat 5 — tingkat 6 belum dibuat.
  const masterKurang = [1, 2, 3, 4, 5].map((t) => kelas(t, 'A'));
  const p = buildPromotionPreview([siswa('s1', limaA, 'AKTIF')], masterKurang);

  assert.strictEqual(p.totalNaik, 0, 'Tidak dihitung naik kalau kelas tujuannya tidak ada');
  assert.strictEqual(p.rows[0].tanpaTujuan, 1, 'Harus masuk hitungan tanpaTujuan');
  assert.deepStrictEqual(p.kelasTujuanHilang, ['6A'], 'Kelas tujuan yang hilang dilaporkan');
  console.log('✓ Test 4: kelas tujuan yang belum ada terdeteksi');
}

// Test 5: rombel paralel dipetakan ke rombel yang sama, bukan digabung.
{
  const satuB = kelas(1, 'B');
  const master = [1, 2, 3, 4, 5, 6].flatMap((t) => [kelas(t, 'A'), kelas(t, 'B')]);
  const p = buildPromotionPreview([siswa('s1', satuB, 'AKTIF')], master);

  assert.strictEqual(p.rows[0].kelasTo?.label, '2B', '1B harus ke 2B, bukan 2A');
  console.log('✓ Test 5: rombel paralel tetap sejajar');
}

// Test 6: kelas asal yang tidak dikenali DILAPORKAN, bukan dibuang diam-diam.
{
  const hantu = kelas(9, 'Z');
  const p = buildPromotionPreview([siswa('s1', hantu, 'AKTIF')], SEMUA_KELAS);

  assert.strictEqual(p.rows.length, 0, 'Kelas yang tidak ada di master tidak bisa ditampilkan');
  assert.strictEqual(p.totalNaik, 0, 'Tidak dihitung naik');
  assert.strictEqual(
    p.siswaTanpaKelasSumber,
    1,
    'Siswa yang kelasnya tidak dikenali harus terhitung, supaya bisa diperingatkan',
  );
  console.log('✓ Test 6: kelas asal tak dikenal dilaporkan, bukan hilang diam-diam');
}

// Test 7: kelas tujuan yang sudah NONAKTIF tidak dipakai.
{
  const limaA = kelas(5, 'A');
  const enamA_nonaktif: Kelas = { ...kelas(6, 'A'), is_active: false };
  const master = [...SEMUA_KELAS.filter((k) => k.label !== '6A'), enamA_nonaktif];
  const p = buildPromotionPreview([siswa('s1', limaA, 'AKTIF')], master);

  assert.strictEqual(p.totalNaik, 0, 'Tidak boleh naik ke rombel yang sudah ditutup');
  assert.strictEqual(p.rows[0].tanpaTujuan, 1, 'Harus terhitung tanpa tujuan');
  assert.deepStrictEqual(p.kelasTujuanHilang, ['6A'], 'Kelas tujuan nonaktif dilaporkan hilang');
  console.log('✓ Test 7: kelas tujuan nonaktif tidak dipakai');
}

// Test 8: kelas asal yang sudah nonaktif tetap bisa jadi sumber.
{
  const duaA_nonaktif: Kelas = { ...kelas(2, 'A'), is_active: false };
  const master = [kelas(1, 'A'), duaA_nonaktif, kelas(3, 'A')];
  const p = buildPromotionPreview([siswa('s1', duaA_nonaktif, 'AKTIF')], master);

  assert.strictEqual(p.rows.length, 1, 'Kelas asal nonaktif tetap muncul di pratinjau');
  assert.strictEqual(p.rows[0].kelasTo?.label, '3A', 'Siswanya tetap naik ke kelas aktif berikutnya');
  console.log('✓ Test 8: kelas asal nonaktif tetap bisa dinaikkan');
}

console.log('\n🎉 SEMUA VERIFIKASI PRATINJAU KENAIKAN KELAS LULUS!');
