/**
 * Model dokumen cetak — MURNI, tanpa React, tanpa DOM, tanpa Supabase.
 *
 * Mengapa file ini ada (K-13, K-14)
 * ----------------------------------
 * Sebelumnya tiap halaman memanggil `window.print()` mentah dan tabel cetaknya
 * membaca langsung dari state UI yang bentuknya berorientasi layar. Akibatnya:
 *   - keputusan "apa yang tercetak" tersebar di 4 berkas,
 *   - mustahil diuji tanpa browser,
 *   - dan — yang paling berbahaya — signed URL foto ikut berada di objek yang
 *     sama dengan data cetak, sehingga satu perubahan kecil bisa membuat foto
 *     bocor ke dokumen (K-13).
 *
 * Aturan yang ditegakkan di sini:
 *   1. Semua baris adalah STRING SIAP TAMPIL. Tidak ada komponen, tidak ada
 *      `Date` yang diformat di dalam JSX cetak.
 *   2. TIDAK ADA field gambar. `PrintReportRow` hanya boleh memuat boolean
 *      `hasDocumentation`. Signed URL / `storage_path` dilarang masuk tipe ini
 *      (lihat `assertNoImages` untuk penjaga runtimenya).
 *   3. Model sadar-halaman: judul, periode, kolom, baris, total, pesan kosong.
 *   4. Orientasi ditentukan di sini, bukan di CSS halaman — supaya tabel 10
 *      kolom (mingguan/bulanan) memakai landscape dan tidak terpotong.
 */

/** Orientasi lembar. Dipakai `useReportPrint` untuk menyisipkan `@page`. */
export type PrintOrientation = 'portrait' | 'landscape';

export interface PrintColumn {
  key: string;
  header: string;
  /** Perataan isi kolom. */
  align?: 'left' | 'center' | 'right';
  /** Lebar kolom (kelas Tailwind, mis. "w-16"). Opsional. */
  width?: string;
}

/** Satu baris dokumen: nilai sudah berupa string siap cetak. */
export type PrintReportRow = Record<string, string>;

export interface PrintReportModel {
  /** Dokumen beroritentasi halaman. */
  orientation: PrintOrientation;
  title: string;
  subtitle?: string;
  /** Label periode yang selalu ikut tercetak di kop judul. */
  periodInfo: string;
  academicYearName?: string;
  columns: PrintColumn[];
  rows: PrintReportRow[];
  /** Baris total (opsional); nilainya juga string siap tampil. */
  totalsRow?: PrintReportRow;
  /** Teks yang dicetak saat `rows` kosong — dokumen kosong tidak boleh ambigu. */
  emptyMessage: string;
}

/**
 * Helper aman: ubah nilai apa pun menjadi string tampil.
 * `null`/`undefined`/string kosong → `fallback` (default '-'), supaya tabel
 * cetak tidak pernah menampilkan "null" atau "undefined".
 */
export function cellText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.length > 0 ? s : fallback;
}

/** Angka dengan pemisah ribuan gaya Indonesia (mis. 1.250). */
export function cellNumber(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n.toLocaleString('id-ID');
}

/** Boolean dokumentasi → teks. Foto TIDAK pernah dirender, hanya statusnya. */
export function cellDocumentation(hasDocumentation: boolean): string {
  return hasDocumentation ? 'Ada' : '-';
}

/**
 * Penjaga runtime (K-13): memastikan tidak ada nilai yang mirip URL/gambar
 * yang lolos ke model cetak. Dipanggil di `createPrintModel` supaya kebocoran
 * foto terdeteksi saat pengembangan, bukan saat dokumen sudah ditandatangani.
 *
 * Ini sengaja longgar untuk teks biasa dan ketat untuk pola yang menandakan
 * aset: http(s), data-URI, "signed", atau "storage_path".
 */
const FORBIDDEN_VALUE = /(https?:\/\/|data:image|signed|storage_path)/i;

export function assertNoImages(model: PrintReportModel): void {
  const inspect = (row: PrintReportRow, where: string) => {
    for (const [key, value] of Object.entries(row)) {
      if (FORBIDDEN_VALUE.test(key) || FORBIDDEN_VALUE.test(value)) {
        throw new Error(
          `Model cetak memuat nilai terlarang pada ${where}.${key}. ` +
            `Foto/signed URL hanya boleh tampil di dashboard admin, bukan di dokumen cetak.`,
        );
      }
    }
  };
  model.rows.forEach((r, i) => inspect(r, `rows[${i}]`));
  if (model.totalsRow) inspect(model.totalsRow, 'totalsRow');
}

/**
 * Bangun model cetak dari bagian-bagian, sekaligus menjalankan penjaga foto.
 * Semua pemanggil (harian, mingguan, bulanan, jurnal) memakai ini agar
 * kontraknya seragam dan tidak bisa dilewati.
 */
export function createPrintModel(model: PrintReportModel): PrintReportModel {
  assertNoImages(model);
  return model;
}
