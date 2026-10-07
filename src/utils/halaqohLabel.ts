/**
 * Util label kelas + kelompok (halaqoh) untuk SEMUA layar rekap/riwayat.
 *
 * Masalah yang dipecahkan: mapel berkelompok (Ummi) dipecah menjadi beberapa
 * halaqoh yang belajar pada jam yang sama. Di rekap, dua baris itu tampil
 * dengan kelas + mapel + jam yang identik — pembaca tidak bisa tahu siapa
 * mengajar kelompok mana. Karena itu nama kelompok WAJIB ikut ditampilkan.
 *
 * Dua fungsi ini murni (tanpa React/DOM) supaya mudah diuji dan supaya layar
 * serta dokumen cetak memakai aturan yang sama persis — bukan masing-masing
 * menulis sendiri lalu menyimpang.
 */

/**
 * Nama kelompok yang layak ditampilkan, atau `null` bila tidak ada.
 *
 * `null`/kosong/spasi-saja semuanya dianggap "tanpa kelompok" — mapel seluruh
 * kelas tidak boleh mendapat akhiran kosong yang mengotori tabel.
 */
export function kelompokRingkas(nama?: string | null): string | null {
  const trimmed = (nama || '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Apakah nama kelompok hanya mengulang nama kelasnya?
 *
 * Kelas kecil punya satu halaqoh yang biasanya dinamai sama dengan kelasnya
 * ("1A"). Menampilkan "1A · 1A" hanya menambah kebisingan tanpa menambah
 * informasi, jadi pengulangan itu dibuang.
 */
export function kelompokMengulangKelas(namaKelompok: string, kelas: string): boolean {
  return namaKelompok.trim().toLowerCase() === kelas.trim().toLowerCase();
}

/** Label gabungan untuk layar: `"1A · Kelompok A"`, atau `"1A"` bila tanpa kelompok. */
export function labelKelasKelompok(kelas: string, namaKelompok?: string | null): string {
  const kelompok = kelompokRingkas(namaKelompok);
  if (!kelompok) return kelas;
  if (kelompokMengulangKelas(kelompok, kelas)) return kelas;
  return `${kelas} · ${kelompok}`;
}
