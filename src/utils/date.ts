/**
 * Util tanggal lokal — gunakan SEMUA kebutuhan tanggal `YYYY-MM-DD`.
 *
 * `new Date().toISOString()` menghasilkan tanggal dalam zona UTC. Di WIB (UTC+7)
 * itu berarti tanggal "hari ini" salah selama pukul 00.00–06.59 (tanggal yang
 * tercatat masih milik kemarin). Bug serupa pernah membuat dashboard menampilkan
 * "0 agenda hari ini" dan semua guru masuk kolom "Belum Mengisi" setiap subuh.
 */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Tambah/hitung hari pada string tanggal YYYY-MM-DD (tetap dalam zona lokal). */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}
