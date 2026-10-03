import assert from 'node:assert';
import { statusSiswaPadaTahun } from './src/services/agendaService';
import type { StatusPenempatan } from './src/types';

/**
 * Verifikasi aturan status per tahun ajaran.
 *
 * Bug yang dikunci di sini: dulu status hanya punya SATU kolom global
 * (`siswa.status`), sehingga menjalankan kenaikan kelas membuat siswa tingkat 6
 * berstatus LULUS **berlaku surut** — membuka tahun ajaran lama menampilkan
 * mereka punya kelas sekaligus berstatus lulus, dan form absensinya jadi kosong.
 *
 * Sekarang status pada sebuah tahun dibaca dari penempatan tahun itu.
 */

console.log('--- Verifikasi status per tahun ajaran ---');

// Test 1: siswa yang punya penempatan memakai status PADA tahun itu, bukan
// status globalnya. Inilah inti perbaikannya.
{
  const ditampilkan = statusSiswaPadaTahun(
    { status: 'AKTIF' }, // penempatan tahun 2026/2027
    'LULUS', // status global setelah kenaikan kelas
  );
  assert.strictEqual(
    ditampilkan,
    'AKTIF',
    'Siswa yang lulus tetap AKTIF di tahun terakhirnya — LULUS tidak boleh berlaku surut',
  );
  console.log('✓ Test 1: LULUS tidak berlaku surut ke tahun penempatannya');
}

// Test 2: siswa tanpa penempatan di tahun yang dibuka memakai status global —
// itulah yang menjelaskan kenapa ia tidak punya kelas.
{
  const ditampilkan = statusSiswaPadaTahun(null, 'LULUS');
  assert.strictEqual(ditampilkan, 'LULUS', 'Tanpa penempatan, status global yang berlaku');
  console.log('✓ Test 2: tanpa penempatan, status global yang dipakai');
}

// Test 3: siswa yang pindah keluar ditandai pada tahun kejadiannya.
{
  const ditampilkan = statusSiswaPadaTahun({ status: 'PINDAH_KELUAR' }, 'PINDAH_KELUAR');
  assert.strictEqual(ditampilkan, 'PINDAH_KELUAR', 'Tahun keberangkatan menandai pindah keluar');
  console.log('✓ Test 3: pindah keluar ditandai pada tahun kejadiannya');
}

// Test 4: tahun-tahun SEBELUM keberangkatan tetap AKTIF. Siswa yang pindah tahun
// ini bukan berarti tidak pernah bersekolah di sini.
{
  const tahunLalu = statusSiswaPadaTahun({ status: 'AKTIF' }, 'PINDAH_KELUAR');
  assert.strictEqual(tahunLalu, 'AKTIF', 'Tahun sebelumnya tetap aktif');
  console.log('✓ Test 4: tahun sebelum keberangkatan tetap AKTIF');
}

// Test 5: penempatan tanpa status (baris lama sebelum kolomnya ada) dibaca AKTIF,
// bukan undefined yang akan merusak hitungan kehadiran.
{
  assert.strictEqual(statusSiswaPadaTahun({ status: null }, 'AKTIF'), 'AKTIF', 'status NULL → AKTIF');
  assert.strictEqual(statusSiswaPadaTahun({}, null), 'AKTIF', 'tanpa status sama sekali → AKTIF');
  assert.strictEqual(statusSiswaPadaTahun(null, undefined), 'AKTIF', 'tanpa apa pun → AKTIF');
  console.log('✓ Test 5: data lama tanpa status dibaca AKTIF, bukan undefined');
}

// Test 6: INVARIANT — siswa yang punya penempatan tidak pernah dilaporkan LULUS.
// Kalau ini gagal, "punya kelas tapi berstatus lulus" bisa muncul lagi.
{
  const semuaStatusPenempatan: StatusPenempatan[] = ['AKTIF', 'PINDAH_KELUAR', 'NONAKTIF'];
  for (const status of semuaStatusPenempatan) {
    const ditampilkan = statusSiswaPadaTahun({ status }, 'LULUS');
    assert.notStrictEqual(
      ditampilkan,
      'LULUS',
      `Penempatan berstatus ${status} tidak boleh pernah dilaporkan sebagai LULUS`,
    );
  }
  console.log('✓ Test 6: punya kelas dan berstatus LULUS mustahil terjadi');
}

console.log('\n🎉 SEMUA VERIFIKASI STATUS PER TAHUN LULUS!');
