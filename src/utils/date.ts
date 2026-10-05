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

/* ── Format tampilan (bahasa Indonesia) ─────────────────────────────────────
 * Sebelumnya keempat format ini disalin ulang di beberapa berkas dengan nama
 * yang sama tetapi opsi berbeda-beda, sehingga satu perbaikan harus dilakukan
 * berkali-kali dan hasilnya mudah menyimpang antar halaman. Sekarang hanya ada
 * satu definisi per format; halaman memilih fungsi yang sesuai, bukan menulis
 * ulang opsinya.
 *
 * Semua fungsi menerima tanggal `YYYY-MM-DD` (untuk yang berakhiran `Date`) atau
 * string ISO lengkap (untuk yang berakhiran `DateTime`), dan mengembalikan
 * masukannya apa adanya bila gagal diurai — supaya layar tidak pernah kosong.
 */

/** "Senin, 14 September 2026" — untuk judul dan konteks yang dibaca tenang. */
export function formatDateLong(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * "Sen, 14 Sep 2026" — versi pendek untuk layar sempit.
 *
 * `formatDateLong` menghasilkan 25 karakter yang di layar 360px memaksa
 * barisnya membungkus; nama hari dan bulan tetap dikenali, hanya disingkat.
 */
export function formatDateCompact(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * "14 September 2026" — tanpa nama hari.
 *
 * Dipakai baris "Periode:" pada dokumen PDF rekap. Nama hari sengaja tidak ikut:
 * baris periode menyatakan *rentang data*, bukan hari apa dokumen itu dicetak,
 * dan pada laporan mingguan/bulanan nama hari akan salah atau menyesatkan.
 */
export function formatDateMedium(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** "14 Sep 2026" — tanggal ringkas tanpa nama hari, untuk kolom tabel padat. */
export function formatDateShort(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** "14 Sep 2026, 09.30" — untuk jejak waktu unggah/ambil bukti foto. */
export function formatDateTimeShort(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

/** "September 2026" — untuk judul kelompok bulanan. */
export function formatMonthYear(key: string): string {
  try {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return key;
  }
}

/**
 * "Senin, 14" — hari dan tanggal saja, tanpa bulan dan tahun.
 *
 * Dipakai di dalam kelompok bulanan, tempat judul kelompoknya sudah menyatakan
 * bulan dan tahun. Mengulanginya di setiap baris berarti menuliskan
 * "September 2026" dua puluh kali per layar tanpa menambah informasi apa pun —
 * dan justru mengubur bagian yang berbeda antar-baris, yaitu tanggalnya.
 */
export function formatDayDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Rentang tanggal satu bulan (`YYYY-MM` → `{ start, end }`), dipakai untuk
 * menyaring di sisi server. Batas akhir dihitung dari hari terakhir bulan itu
 * (`new Date(y, m, 0)`), jadi Februari dan tahun kabisat ikut benar.
 */
export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * `count` kunci bulan terakhir, terbaru lebih dulu (`['2026-09', '2026-08', …]`).
 *
 * Dipakai pengisi daftar bulan. Sejak daftar riwayat diambil per halaman, bulan
 * yang punya data tidak lagi bisa diketahui seluruhnya dari data yang termuat —
 * jadi daftarnya dibangun dari rentang yang pasti masuk akal, bukan dari isi
 * yang kebetulan sudah terunduh.
 */
export function recentMonthKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * Rentang `days` hari terakhir sampai hari ini, inklusif di kedua ujung
 * (`days = 7` → hari ini dan enam hari sebelumnya, bukan tujuh hari ke belakang).
 *
 * Inklusif dipilih karena begitulah orang menghitung: "7 hari terakhir" yang
 * dimaksud guru adalah pekan ini termasuk hari ini, bukan rentang yang gagal
 * memuat agenda pagi tadi. Selisih satu hari di ujung akhir justru yang paling
 * terasa — agenda hari ini adalah yang paling sering dicari.
 *
 * Batasnya dihitung dari tengah malam lokal (`new Date(y, m - 1, d)`), tidak
 * lewat `toISOString()`, supaya pergeseran zona tidak memotong satu hari di
 * subuh WIB (lihat catatan di kepala berkas ini).
 */
export function lastNDaysRange(days: number, from: Date = new Date()): { start: string; end: string } {
  const end = localDateString(from);
  return { start: addDays(end, -(days - 1)), end };
}

/**
 * Rentang bulan berjalan: dari tanggal 1 sampai hari ini.
 *
 * Sengaja TIDAK memakai `monthRange()` yang berakhir di hari terakhir bulan.
 * Untuk "bulan ini" hari-hari setelah hari ini tidak mungkin punya agenda, dan
 * mencantumkannya di rentang membuat label kutipannya berbohong — misalnya
 * "1 Sep – 30 Sep" saat ini baru tanggal 10. Yang benar adalah apa yang benar-
 * benar diminta: dari awal bulan sampai sekarang.
 */
export function currentMonthRange(from: Date = new Date()): { start: string; end: string } {
  const end = localDateString(from);
  return { start: `${end.slice(0, 7)}-01`, end };
}

/**
 * "1 Sep 2026 – 10 Sep 2026", atau tanggal tunggal bila rentangnya satu hari.
 *
 * Dipakai kutipan penyaring aktif. Rentang satu hari kerap muncul dari chip
 * "Hari ini", dan menuliskannya sebagai "10 Sep 2026 – 10 Sep 2026" menyiratkan
 * rentang yang lebih lebar daripada kenyataannya.
 */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDateShort(start);
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

/**
 * "09.30" — jam saja, tanpa tanggal.
 *
 * Untuk cap waktu yang maknanya "kapan barusan", bukan "tanggal berapa":
 * draf yang baru tersimpan otomatis, atau waktu sebuah draf dipulihkan.
 * Tanggalnya justru mengganggu di konteks itu — yang ingin diketahui guru
 * adalah apakah isiannya baru saja aman, bukan tanggalnya.
 */
export function formatTimeShort(value: number | string | Date): string {
  try {
    return new Date(value).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}
