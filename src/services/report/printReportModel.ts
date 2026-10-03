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
 *      `Date` yang diformat di dalam dokumen cetak.
 *   2. TIDAK ADA field gambar. `PrintReportRow` hanya boleh memuat boolean
 *      `hasDocumentation`. Signed URL / `storage_path` dilarang masuk tipe ini
 *      (lihat `assertNoImages` untuk penjaga runtimenya).
 *   3. Model sadar-halaman: judul, periode, kolom, baris, total, ringkasan,
 *      pesan kosong.
 *   4. Orientasi dan LEBAR KOLOM ditentukan di sini, bukan di CSS halaman —
 *      supaya tabel 10 kolom (mingguan/bulanan) memakai landscape dan tidak
 *      terpotong.
 *
 * Model yang sama menyuplai SATU penulis dokumen
 * (`services/export/reportPdfExport.ts`) untuk keempat jenis laporan: harian,
 * mingguan, bulanan, dan jurnal. Karena itu keempatnya tidak mungkin menyimpang
 * satu dari yang lain.
 */

/** Orientasi lembar dokumen. */
export type PrintOrientation = 'portrait' | 'landscape';

/**
 * Jenis dokumen. Menentukan awalan nama berkas PDF sekaligus memberi penulis
 * dokumen konteks bila kelak butuh perlakuan khusus per jenis.
 */
export type ReportDocumentKind = 'harian' | 'mingguan' | 'bulanan' | 'jurnal';

export interface PrintColumn {
  key: string;
  header: string;
  /** Perataan isi kolom. */
  align?: 'left' | 'center' | 'right';
  /**
   * Lebar kolom dalam **poin** (satuan cetak), dipakai penulis PDF.
   *
   * Bila kosong, kolom ini menyerap sisa lebar halaman — inilah yang dipakai
   * kolom teks panjang (Nama Guru, Materi, Mata Pelajaran) agar teksnya
   * membungkus penuh, bukan terpotong.
   */
  ptWidth?: number;
}

/** Satu indikator pada strip ringkasan (mis. "Total Jadwal" → "32 JP"). */
export interface PrintSummaryItem {
  label: string;
  value: string;
}

/** Satu baris dokumen: nilai sudah berupa string siap cetak. */
export type PrintReportRow = Record<string, string>;

export interface PrintReportModel {
  /** Jenis laporan — menentukan awalan nama berkas. */
  documentKind: ReportDocumentKind;
  /** Dokumen berorientasi halaman. */
  orientation: PrintOrientation;
  title: string;
  /** Konteks cakupan (opsional), mis. "Kelas: XI RPL 1 • Guru: Semua Guru". */
  subtitle?: string;
  /**
   * Nilai periode TANPA awalan "Periode:" — penulis dokumen yang menambahkan
   * labelnya. Ini mencegah keluaran seperti "Periode: Periode: …" yang dulu
   * terjadi karena tiap halaman mengirim teks yang sudah berlabel.
   */
  periodInfo: string;
  academicYearName?: string;
  columns: PrintColumn[];
  rows: PrintReportRow[];
  /** Baris total (opsional); nilainya juga string siap tampil. */
  totalsRow?: PrintReportRow;
  /**
   * Strip ringkasan di bawah judul (opsional). Dipakai harian (4 indikator)
   * dan mingguan/bulanan (5 indikator) supaya dokumen punya "kepala" yang
   * sama, bukan langsung masuk ke tabel.
   */
  summary?: PrintSummaryItem[];
  /**
   * Token periode untuk nama berkas, sudah ramah-slug:
   *   harian   → "2026-10-01"
   *   mingguan → "2026-09-28_sd_2026-10-04"
   *   bulanan  → "2026-10"
   *   jurnal   → "2026-10-01"
   * Sengaja dipisah dari `periodInfo` karena `periodInfo` untuk manusia
   * ("1 Oktober 2026") sedangkan ini untuk nama berkas.
   */
  fileLabel: string;
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
  // Strip ringkasan juga bagian dokumen — periksa dengan aturan yang sama.
  model.summary?.forEach((item, i) => {
    inspect({ label: item.label, value: item.value }, `summary[${i}]`);
  });
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
