import type { PrintReportModel, PrintReportRow } from '../report/printReportModel';

/**
 * Penulis file .pdf untuk Log Jurnal Agenda — memakai pdfmake.
 *
 * Mengapa file ini ada (dan mengapa BUKAN `window.print()`)
 * ---------------------------------------------------------
 * Pendekatan cetak sebelumnya mengandalkan CSS `@media print`: seluruh UI
 * aplikasi dirender di DOM lalu "disembunyikan" satu per satu lewat `no-print`.
 * Cara itu bocor — terbukti pada halaman Log Jurnal, di mana tabel layar,
 * dropdown "Menampilkan 1-25 dari 112 data", paginasi, dan kolom AKSI ikut
 * tercetak ke kertas.
 *
 * Di sini pendekatannya dibalik: dokumen dibangun dari NOL sebagai struktur
 * data (`docDefinition`), bukan dari DOM. Tidak ada satu pun elemen UI yang
 * bisa "lolos" ke PDF karena UI tidak pernah dilihat sama sekali. Ini meniru
 * pola `scheduleExcelExport.ts` — model murni menentukan APA yang dicetak,
 * file ini hanya menentukan BAGAIMANA tampilannya.
 *
 * Pembagian tanggung jawab:
 *   - `printReportModel.ts`      → peta struktur dokumen (murni, tanpa DOM)
 *   - `journalPdfExport.ts`      → penulis PDF (file ini)
 *
 * pdfmake di-import dinamis (~500 kB) supaya hanya diambil saat tombol ditekan,
 * bukan saat app dimuat — sama seperti ExcelJS di export jadwal.
 */

/** Error domain supaya UI bisa menampilkan pesan jelas, bukan crash diam. */
export class JournalPdfExportError extends Error {}

/**
 * Permukaan pdfmake yang dipakai modul ini. Ditulis struktural (bukan memakai
 * tipe `@types/pdfmake` langsung) karena bundel `pdfmake/build/pdfmake` tidak
 * mengekspor tipe runtime-nya dengan andal — cara ini membuat pemanggilan tetap
 * type-safe tanpa `any`.
 *
 * CATATAN API: varian **browser** (`js/browser-extensions/OutputDocumentBrowser`)
 * membuat `getBlob()` sebagai `async` yang mengembalikan `Promise<Blob>` —
 * bukan callback seperti dokumen lama pdfmake. Memakai pola callback di sini
 * akan menggantung tanpa error.
 */
interface PdfDocumentHandle {
  getBlob(): Promise<Blob>;
}

interface PdfMakeInstance {
  vfs?: Record<string, string>;
  fonts?: Record<string, unknown>;
  createPdf(docDefinition: unknown): PdfDocumentHandle;
}

/**
 * Palet dokumen. Sengaja netral (abu/hitam) untuk hasil fotokopi yang tajam —
 * bukan warna UI aplikasi. Nilai Opsi A yang sudah disetujui pemilik produk.
 */
const INK = '#000000';
const RULE = '#2C2C2A';
const HEADER_BG = '#5F5E5A';
const ZEBRA_BG = '#F1EFE8';
const MUTED = '#5F5E5A';

/** Lebar kolom (pt) untuk halaman A4 landscape. Materi memakai '*' = sisa lebar. */
const COLUMN_WIDTHS: (number | string)[] = [24, 62, 48, 118, 88, 34, '*'];

/** Tinggi & font dasar dokumen. */
const FONT_SIZE_TABLE = 8;
const FONT_SIZE_HEAD = 8;
const HEADER_ROWS = 1;

/**
 * Bentuk minimum permukaan pdfmake yang dipakai file ini. Sengaja struktural
 * (bukan tipe `TDocumentDefinitions` penuh) supaya helper di bawah tetap bisa
 * dibaca tanpa menyeret seluruh tipe pdfmake ke setiap call site.
 */
interface PdfCell {
  text: string;
  alignment?: 'left' | 'center' | 'right';
  color?: string;
  fillColor?: string;
  bold?: boolean;
  fontSize?: number;
}

interface PdfTableNode {
  table: {
    headerRows: number;
    widths: (number | string)[];
    body: PdfCell[][];
  };
  layout: Record<string, unknown>;
  margin?: number[];
}

/**
 * Layout tabel: garis kotak penuh 0.5pt dengan warna tinta, persis Opsi A.
 * Default pdfmake menggambar semua garis tipis abu; di sini ditegaskan hitam
 * supaya tidak pudar saat difotokopi (pelajaran dari K-16 untuk versi cetak).
 */
const SOLID_TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

/** Sel header tabel: latar abu gelap, huruf putih, tebal. */
function headerCell(text: string, align: 'left' | 'center' = 'left'): PdfCell {
  return {
    text,
    alignment: align,
    bold: true,
    color: '#FFFFFF',
    fillColor: HEADER_BG,
    fontSize: FONT_SIZE_HEAD,
  };
}

/**
 * Susun baris header dari `model.columns`.
 *
 * Perataan mengikuti model (`column.align`), bukan ditebak dari nama kolom —
 * ini menutup bug K-19 (logika perataan yang berbeda antar halaman) sekaligus
 * memastikan PDF dan layar tidak bisa menyimpang.
 */
function buildHeaderRow(model: PrintReportModel): PdfCell[] {
  return model.columns.map((col) =>
    headerCell(col.header, col.align === 'center' ? 'center' : 'left'),
  );
}

/** Satu baris data; zebra stripe agar baris panjang tetap mudah ditelusuri. */
function buildDataRow(model: PrintReportModel, row: PrintReportRow, index: number): PdfCell[] {
  const striped = index % 2 === 1;
  return model.columns.map((col) => ({
    text: row[col.key] ?? '-',
    alignment: col.align ?? 'left',
    fontSize: FONT_SIZE_TABLE,
    fillColor: striped ? ZEBRA_BG : undefined,
  }));
}

/** Baris total (opsional). Dirender sebagai tfoot tebal bila model menyediakannya. */
function buildTotalsRow(model: PrintReportModel): PdfCell[] | null {
  if (!model.totalsRow) return null;
  return model.columns.map((col) => ({
    text: model.totalsRow?.[col.key] ?? '',
    alignment: col.align ?? 'left',
    fontSize: FONT_SIZE_TABLE,
    bold: true,
    fillColor: '#D3D1C7',
  }));
}

/** Blok tabel utama: header berulang otomatis di setiap halaman via `headerRows`. */
function buildTable(model: PrintReportModel): PdfTableNode {
  const body: PdfCell[][] = [buildHeaderRow(model)];
  model.rows.forEach((row, i) => body.push(buildDataRow(model, row, i)));

  const totals = buildTotalsRow(model);
  if (totals) body.push(totals);

  return {
    table: {
      headerRows: HEADER_ROWS,
      widths: COLUMN_WIDTHS,
      body,
    },
    layout: SOLID_TABLE_LAYOUT,
    margin: [0, 0, 0, 0],
  };
}

/** Kop resmi sekolah — tiga baris teks, sama seperti dokumen cetak HTML. */
function buildLetterhead(schoolName: string) {
  return [
    {
      text: schoolName.toUpperCase(),
      bold: true,
      fontSize: 12,
      alignment: 'center',
      characterSpacing: 0.4,
    },
    {
      text: 'SISTEM INFORMASI AGENDA DAN JURNAL MENGAJAR (SIAJAR)',
      fontSize: 8,
      alignment: 'center',
      color: MUTED,
      margin: [0, 1, 0, 0],
    },
    {
      text: 'Jl. H. Saadi No. 02, Cikarang Kota, Kec. Cikarang Utara, Kab. Bekasi, Jawa Barat, 17530',
      fontSize: 8,
      alignment: 'center',
      color: MUTED,
      margin: [0, 1, 0, 0],
    },
    // Garis pemisah kop: persegi panjang tipis, bukan border teks (lebih presisi).
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 1.2,
          lineColor: RULE,
        },
      ],
      margin: [0, 6, 0, 10],
    },
  ];
}

/** Judul laporan + baris periode/tahun ajaran. */
function buildTitleBlock(model: PrintReportModel) {
  const meta: string[] = [`Periode: ${model.periodInfo}`];
  if (model.academicYearName) meta.push(`Tahun Ajaran: ${model.academicYearName}`);

  return [
    {
      text: model.title.toUpperCase(),
      bold: true,
      fontSize: 10,
      alignment: 'center',
      decoration: 'underline',
    },
    ...(model.subtitle
      ? [
          {
            text: model.subtitle,
            fontSize: 8,
            alignment: 'center' as const,
            color: MUTED,
            margin: [0, 2, 0, 0],
          },
        ]
      : []),
    {
      text: meta.join('   •   '),
      fontSize: 8,
      alignment: 'center',
      color: MUTED,
      margin: [0, 2, 0, 10],
    },
  ];
}

/**
 * Blok tanda tangan: dua kolom di kiri-kanan bawah dokumen.
 * Nama penandatangan mengikuti `signatureName` yang diteruskan pemanggil,
 * karena tiap jenis laporan bisa punya pejabat berbeda.
 */
function buildSignatureBlock(dateLabel: string, leftSigner: string, rightSigner: string) {
  const column = (header: string[], name: string) => ({
    width: '50%' as const,
    stack: [
      { text: header[0], fontSize: 8, alignment: 'center' as const },
      { text: header[1], fontSize: 8, alignment: 'center' as const },
      // Ruang kosong untuk tanda tangan basah.
      { text: ' ', fontSize: 8, margin: [0, 0, 0, 28] as [number, number, number, number] },
      {
        text: name,
        fontSize: 8,
        bold: true,
        alignment: 'center' as const,
        decoration: 'underline' as const,
      },
    ],
  });

  return [
    { text: '', margin: [0, 14, 0, 0] },
    {
      columns: [column(['Mengetahui,', 'Waka Kurikulum'], leftSigner), column([`Cikarang, ${dateLabel}`, 'Kepala Sekolah'], rightSigner)],
    },
  ];
}

export interface JournalPdfOptions {
  /** Nama sekolah dari Pengaturan. */
  schoolName: string;
  /** Tanggal dokumen (teks siap tampil, mis. "29 September 2026"). */
  dateLabel: string;
  /** Nama penandatangan kiri (Waka Kurikulum). */
  leftSigner?: string;
  /** Nama penandatangan kanan (Kepala Sekolah). */
  rightSigner?: string;
}

/**
 * Build `docDefinition` pdfmake dari model cetak. Fungsi ini yang bisa diuji
 * tanpa menghasilkan file — semua keputusan tampilan berada di sini.
 */
export function buildJournalDocDefinition(
  model: PrintReportModel,
  options: JournalPdfOptions,
) {
  const {
    schoolName,
    dateLabel,
    leftSigner = 'Abdulloh, S.Pd., Gr.',
    rightSigner = 'Fitri Nurhasanah, S.Pd., Gr.',
  } = options;

  const content: unknown[] = [
    ...buildLetterhead(schoolName),
    ...buildTitleBlock(model),
  ];

  if (model.rows.length > 0) {
    content.push(buildTable(model));
  } else {
    // Dokumen kosong tidak boleh ambigu antara "tidak ada data" dan "gagal".
    content.push({
      table: {
        widths: ['*'],
        body: [[{ text: model.emptyMessage, alignment: 'center', italics: true, fontSize: 8 }]],
      },
      layout: SOLID_TABLE_LAYOUT,
    });
  }

  content.push(...buildSignatureBlock(dateLabel, leftSigner, rightSigner));

  return {
    pageSize: 'A4',
    pageOrientation: model.orientation === 'landscape' ? 'landscape' : 'portrait',
    pageMargins: [24, 24, 24, 34] as [number, number, number, number],
    defaultStyle: {
      font: 'Roboto',
      fontSize: FONT_SIZE_TABLE,
      color: INK,
    },
    content,
    /**
     * Footer: nomor halaman sebenarnya, dikerjakan pdfmake saat render.
     * Inilah pengganti jujur untuk "Halaman 1 / 1" yang di-hardcode dulu (K-01).
     */
    footer: (currentPage: number, pageCount: number) => ({
      margin: [24, 6, 24, 0],
      columns: [
        {
          text: `Dicetak otomatis melalui SIAJAR - ${schoolName}`,
          fontSize: 7,
          color: MUTED,
        },
        {
          text: `Halaman ${currentPage} dari ${pageCount}`,
          fontSize: 7,
          color: MUTED,
          alignment: 'right' as const,
        },
      ],
    }),
  };
}

/** `Jurnal_Agenda_2026-09-29.pdf` — tanggal dokumen, bukan timestamp acak. */
export function journalPdfFileName(dateLabel: string): string {
  const slug = (dateLabel || 'tanpa-tanggal').replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '');
  return `Jurnal_Agenda_${slug}.pdf`;
}

/**
 * Bangun + unduh PDF. Dipanggil dari handler tombol; melempar
 * `JournalPdfExportError` supaya UI menampilkan pesan yang bisa dimengerti.
 *
 * Mengembalikan nama file supaya pemanggil bisa menampilkan konfirmasi.
 */
export async function downloadJournalPdf(
  model: PrintReportModel,
  options: JournalPdfOptions,
): Promise<string> {
  if (model.rows.length === 0) {
    throw new JournalPdfExportError('Tidak ada data untuk diekspor pada periode ini.');
  }

  const fileName = journalPdfFileName(options.dateLabel);
  const docDefinition = buildJournalDocDefinition(model, options);

  let blob: Blob;
  try {
    // Import dinamis: ~1 MB (mesin + font Roboto) hanya diambil saat tombol
    // benar-benar ditekan, bukan saat app dimuat.
    //
    // Urutan import penting: `vfs_fonts` lebih dulu. Selain menyediakan objek
    // vfs, berkas itu juga mencoba mendaftarkan diri ke `window.pdfMake` bila
    // sudah ada (lihat `addVirtualFileSystem` di dalamnya).
    const vfsModule = (await import('pdfmake/build/vfs_fonts')) as unknown as
      | Record<string, unknown>
      | { default?: unknown };
    const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as unknown as {
      default?: PdfMakeInstance;
      createPdf?: PdfMakeInstance['createPdf'];
      vfs?: Record<string, string>;
      fonts?: Record<string, unknown>;
    };
    const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as PdfMakeInstance;

    // PENTING: font wajib dipasang di kedua tempat berikut, kalau tidak dokumen
    // GAGAL TOTAL dengan "File 'Roboto-Medium.ttf' not found in virtual file
    // system" — dan karena kop, judul, header tabel, serta nama penandatangan
    // semuanya `bold`, kegagalan ini pasti terjadi, bukan kasus tepi.
    //   1. `vfs`   = isi berkas font (Roboto-Regular/Medium/Italic/MediumItalic)
    //   2. `fonts` = pemetaan gaya → nama berkas, agar `bold: true` menunjuk
    //                ke Medium (pdfmake tidak menebak bold dari Regular)
    //
    // BENTUK MODUL vfs_fonts TIDAK STABIL antar versi/bundler — sudah terbukti
    // berbeda antara Node dan hasil bundel Vite. Karena itu kita periksa semua
    // kandidat bentuk, bukan hanya satu, lalu validasi bahwa objeknya benar-
    // benar berisi berkas font (bukan sekadar objek kosong).
    const candidates: unknown[] = [
      (vfsModule as { default?: unknown }).default,
      vfsModule,
      (vfsModule as { pdfMake?: { vfs?: unknown } }).pdfMake?.vfs,
      (vfsModule as { default?: { pdfMake?: { vfs?: unknown } } }).default?.pdfMake?.vfs,
      pdfMake.vfs,
      (globalThis as { pdfMake?: { vfs?: unknown } }).pdfMake?.vfs,
    ];

    let vfs: Record<string, string> | undefined;
    for (const candidate of candidates) {
      if (
        candidate &&
        typeof candidate === 'object' &&
        Object.keys(candidate as Record<string, unknown>).some((k) => k.endsWith('.ttf'))
      ) {
        vfs = candidate as Record<string, string>;
        break;
      }
    }

    if (!vfs) {
      throw new Error('vfs font pdfmake tidak termuat (tidak ada berkas .ttf yang ditemukan)');
    }

    // CARA MEMASANG FONT — sudah diverifikasi di browser sungguhan (headless
    // Chrome memuat chunk hasil build), karena men-set `pdfMake.vfs` SAJA TIDAK
    // CUKUP: bundel pdfmake memakai virtual-fs internal dengan penyimpanan
    // sendiri, sehingga `vfs` yang ditempel diam-diam diabaikan dan dokumen
    // gagal dengan "File 'Roboto-Medium.ttf' not found in virtual file system".
    //   - `addVirtualFileSystem(vfs)` = API resmi (menulis ke storage internal)
    //   - `pdfMake.fonts`             = pemetaan gaya → berkas, karena pdfmake
    //                                   TIDAK menebak bold dari Regular
    const withAddVfs = pdfMake as PdfMakeInstance & {
      addVirtualFileSystem?: (vfs: Record<string, string>) => void;
    };
    if (typeof withAddVfs.addVirtualFileSystem === 'function') {
      withAddVfs.addVirtualFileSystem(vfs);
    } else {
      pdfMake.vfs = vfs;
    }

    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };

    const createPdf = pdfMake.createPdf;
    if (typeof createPdf !== 'function') {
      throw new Error('pdfmake tidak menyediakan createPdf');
    }

    // `getBlob()` pada varian browser mengembalikan Promise (lihat catatan di
    // `PdfDocumentHandle`) — harus di-await, bukan diberi callback.
    blob = await createPdf.call(pdfMake, docDefinition).getBlob();
  } catch (err) {
    console.error('[export jurnal] gagal membangun PDF:', err);
    throw new JournalPdfExportError('Gagal membuat dokumen PDF.');
  }

  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Beri waktu browser memulai unduhan sebelum URL dicabut.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('[export jurnal] gagal memicu unduhan:', err);
    throw new JournalPdfExportError('Gagal mengunduh dokumen PDF.');
  }

  return fileName;
}
