/**
 * Util urutan kelas untuk penyusunan baris rekap (murni, tanpa DB/jaringan).
 *
 * Masalah yang dipecahkan: label kelas dibandingkan sebagai string mentah
 * (`"10A".localeCompare("2A")` → "10A" lebih dulu), dan label gabungan milik
 * sesi halaqoh lintas kelas (`"1A, 2A"`) bisa menjadi string kosong saat peta
 * kelas-sumber belum terisi — sehingga sesi halaqoh "loncat" ke urutan paling
 * atas. Dua helper di sini mengubah perbandingan menjadi perbandingan ANGKA
 * berdasarkan urutan master kelas (tingkat → rombel) sehingga hasilnya stabil.
 *
 * Sengaja murni (tanpa React/DOM) supaya bisa dipakai `buildSlotRows()` yang
 * view-model-nya juga murni.
 */

/**
 * Peta label kelas → indeksnya pada daftar master yang SUDAH terurut
 * tingkat → rombel (dari `ClassContext`).
 *
 * Kenapa perlu: membandingkan indeks angka meniadakan perbandingan string
 * yang rapuh (mis. "10A" vs "2A") dan membuat baris halaqoh bisa duduk di
 * posisi kelas sumbernya yang paling kecil.
 */
export function buildClassRank(order: string[]): Map<string, number> {
  const rank = new Map<string, number>();
  order.forEach((label, index) => {
    // Label pertama yang menang: daftar master tidak boleh berisi duplikat,
    // tapi bila ada, indeks pertama dipakai agar hasil deterministik.
    if (!rank.has(label)) rank.set(label, index);
  });
  return rank;
}

/**
 * Peringkat sebuah baris laporan di antara daftar kelasnya: SMALLEST rank.
 *
 * Sesi halaqah lintas kelas memuat beberapa label kelas; posisi barisnya di
 * rekap harus mengikuti kelas sumbernya yang PALING kecil supaya tidak
 * "meloncat" ke atas kelas 1A hanya karena labelnya digabung.
 *
 * Bila tidak ada satu pun label yang dikenal, kembalikan sentinel FINITE
 * `Number.MAX_SAFE_INTEGER` (di belakang semua kelas) — angka penting supaya
 * perbandingan subtraction tidak pernah menghasilkan `NaN` yang merusak sort.
 */
export function sessionClassRank(classIds: string[], rank: Map<string, number>): number {
  let smallest = Number.MAX_SAFE_INTEGER;
  for (const id of classIds) {
    const r = rank.get(id);
    if (r !== undefined && r < smallest) smallest = r;
  }
  return smallest;
}
