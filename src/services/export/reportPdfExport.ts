import type {
  PrintOrientation,
  PrintReportModel,
  PrintReportRow,
  PrintSummaryItem,
  ReportDocumentKind,
} from '../report/printReportModel';

/**
 * Penulis dokumen PDF untuk SELURUH laporan rekap — memakai pdfmake.
 *
 * Mengapa file ini ada (dan mengapa BUKAN `window.print()`)
 * ---------------------------------------------------------
 * Pendekatan cetak sebelumnya mengandalkan CSS `@media print`: seluruh UI
 * aplikasi dirender di DOM lalu "disembunyikan" satu per satu lewat `no-print`.
 * Cara itu bocor — terbukti pada halaman Log Jurnal, di mana tabel layar,
 * dropdown "Menampilkan 1-25 dari 112 data", paginasi, dan kolom AKSI ikut
 * tercetak ke kertas. Pada rekap mingguan/bulanan, hasilnya juga bergantung
 * pada dialog printer browser: nomor halaman salah, orientasi kertas tidak
 * pasti, dan kolom ke-10 rawan terpotong.
 *
 * Di sini pendekatannya dibalik: dokumen dibangun dari NOL sebagai struktur
 * data (`docDefinition`), bukan dari DOM. Tidak ada satu pun elemen UI yang
 * bisa "lolos" ke PDF karena UI tidak pernah dilihat sama sekali. Ini meniru
 * pola `scheduleExcelExport.ts` — model murni menentukan APA yang dicetak,
 * file ini hanya menentukan BAGAIMANA tampilannya.
 *
 * Pembagian tanggung jawab:
 *   - `printReportModel.ts`  → peta struktur dokumen (murni, tanpa DOM)
 *   - `reportPdfExport.ts`   → penulis PDF (file ini)
 *
 * SATU mesin, EMPAT jenis laporan
 * -------------------------------
 * Harian, mingguan, bulanan, dan jurnal semuanya lewat fungsi yang sama di
 * sini. Perbedaan antar jenis hanya berasal dari model (judul, periode,
 * orientasi, kolom, baris, ringkasan) — bukan dari kode yang berbeda. Itulah
 * yang membuat format, tata letak, dan strukturnya dijamin seragam.
 *
 * pdfmake di-import dinamis (~1 MB termasuk font) supaya hanya diambil saat
 * tombol benar-benar ditekan, bukan saat app dimuat — sama seperti ExcelJS di
 * export jadwal.
 */

/** Error domain supaya UI bisa menampilkan pesan jelas, bukan crash diam. */
export class ReportPdfExportError extends Error {}

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
 * bukan warna UI aplikasi.
 */
const INK = '#000000';
const RULE = '#2C2C2A';
const HEADER_BG = '#5F5E5A';
const ZEBRA_BG = '#F1EFE8';
const MUTED = '#5F5E5A';
const TOTAL_BG = '#D3D1C7';

/** Tinggi & font dasar dokumen. */
const FONT_SIZE_TABLE = 8;
const FONT_SIZE_HEAD = 8;
const FONT_SIZE_SUMMARY_LABEL = 7;
const FONT_SIZE_SUMMARY_VALUE = 11;
const FONT_SIZE_META = 8;
const FONT_SIZE_TITLE = 10;
const FONT_SIZE_LETTERHEAD = 12;
const FONT_SIZE_FOOTER = 7;
const HEADER_ROWS = 1;

/**
 * Margin halaman (pt). PERHATIAN URUTAN: pdfmake memakai
 * `[kiri, atas, kanan, bawah]` — BUKAN `[atas, kanan, bawah, kiri]` seperti CSS.
 * Salah membaca urutan ini pernah membuat lebar area cetak dihitung dari margin
 * vertikal, sehingga garis kop dan tabel menjadi ~10pt lebih pendek dari
 * seharusnya.
 */
const PAGE_MARGINS: [number, number, number, number] = [24, 24, 24, 34];

/** Ukuran A4 dalam poin (satuan yang dipakai pdfmake). */
const A4_WIDTH_PORTRAIT = 595.28;
const A4_WIDTH_LANDSCAPE = 841.89;

/**
 * Lebar area cetak (pt) per orientasi — SATU sumber kebenaran.
 *
 * Dipakai garis kop, strip ringkasan, dan perhitungan lebar kolom. Karena
 * ketiganya membaca nilai yang sama, tepi kanan dokumen selalu rata: garis kop
 * tidak bisa lagi berhenti sebelum tepi tabel.
 */
export const PAGE_CONTENT_WIDTH: Record<PrintOrientation, number> = {
  portrait: A4_WIDTH_PORTRAIT - PAGE_MARGINS[0] - PAGE_MARGINS[2],
  landscape: A4_WIDTH_LANDSCAPE - PAGE_MARGINS[0] - PAGE_MARGINS[2],
};

/**
 * Lebar minimum yang layak untuk kolom yang menyerap sisa ruang. Dipakai
 * `resolveColumnWidths` untuk memutuskan kapan lebar tetap perlu diskalakan.
 */
const MIN_GROW_WIDTH = 48;

/**
 * Nama penandatangan bawaan dokumen resmi sekolah.
 *
 * Dikumpulkan di satu tempat (bukan diulang di tiap halaman) supaya keempat
 * dokumen tidak mungkin menampilkan penandatangan yang berbeda. Bila kelak
 * nama diambil dari halaman Pengaturan, cukup diubah di sini.
 */
export const DEFAULT_LEFT_SIGNER = 'Abdulloh, S.Pd., Gr.';
export const DEFAULT_RIGHT_SIGNER = 'Fitri Nurhasanah, S.Pd., Gr.';

/**
 * Bentuk minimum permukaan pdfmake yang dipakai file ini. Sengaja struktural
 * (bukan tipe `TDocumentDefinitions` penuh) supaya helper di bawah tetap bisa
 * dibaca tanpa menyeret seluruh tipe pdfmake ke setiap call site.
 */
interface PdfCell {
  text?: string;
  stack?: unknown[];
  alignment?: 'left' | 'center' | 'right';
  color?: string;
  fillColor?: string;
  bold?: boolean;
  fontSize?: number;
  italics?: boolean;
  margin?: [number, number, number, number];
  characterSpacing?: number;
}

interface PdfTableNode {
  table: {
    headerRows: number;
    widths: (number | string)[];
    body: PdfCell[][];
  };
  layout: Record<string, unknown>;
  margin?: [number, number, number, number];
}

/**
 * Layout tabel: garis kotak penuh 0.5pt dengan warna tinta.
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

/**
 * Total lebar garis tepi tabel (0,5pt per sisi — lihat `SOLID_TABLE_LAYOUT`).
 *
 * pdfmake menggambar garis kotak tabel tepat di batas tabel, sehingga sisi luar
 * tabel yang terlihat menjadi 0,5pt lebih sempit dari area cetak. Sudah diukur
 * pada PDF hasil: tabel 793,39pt sementara area cetak 793,89pt. Garis kop
 * dikurangi nilai ini supaya tepi kanannya **persis rata** dengan tepi tabel,
 * bukan menonjol setengah poin.
 */
const TABLE_BORDER_WIDTH = 0.5;

/** Lebar area cetak sesuai orientasi dokumen. */
function contentWidth(model: PrintReportModel): number {
  return PAGE_CONTENT_WIDTH[model.orientation];
}

/**
 * Terjemahkan `column.ptWidth` menjadi `widths` pdfmake.
 *
 * Aturan:
 *   - kolom tanpa `ptWidth` → `'*'` (menyerap sisa lebar);
 *   - bila total lebar tetap melebihi area cetak, semua lebar tetap diskalakan
 *     proporsional supaya tabel tidak pernah meluber ke luar halaman.
 *
 * Fungsi ini murni dan dipisah supaya bisa diuji tanpa menghasilkan PDF.
 */
export function resolveColumnWidths(model: PrintReportModel): (number | string)[] {
  const available = contentWidth(model);
  const columns = model.columns;
  if (columns.length === 0) return [];

  const growCount = columns.filter((c) => c.ptWidth === undefined).length;
  const fixedSum = columns.reduce((sum, c) => sum + (c.ptWidth ?? 0), 0);

  // Kasus normal: ada kolom fleksibel dan lebar tetap masih menyisakan ruang.
  if (growCount > 0 && fixedSum + growCount * MIN_GROW_WIDTH <= available) {
    return columns.map((c) => c.ptWidth ?? '*');
  }

  // Semua kolom tetap: bagi habis sisa ruang ke kolom terakhir, atau skala turun.
  if (growCount === 0) {
    if (fixedSum <= available) {
      const widths = columns.map((c) => c.ptWidth ?? 0);
      widths[widths.length - 1] += available - fixedSum;
      return widths;
    }
    const scale = available / fixedSum;
    return columns.map((c) => Math.floor((c.ptWidth ?? 0) * scale));
  }

  // Ada kolom fleksibel tapi ruangnya tidak cukup: sisakan lebar minimum untuk
  // kolom fleksibel, lalu skala kolom tetap.
  const scale = (available - growCount * MIN_GROW_WIDTH) / fixedSum;
  return columns.map((c) =>
    c.ptWidth === undefined ? '*' : Math.max(12, Math.floor(c.ptWidth * scale)),
  );
}

/** Sel header tabel: latar abu gelap, huruf putih, tebal. */
function headerCell(text: string, align: 'left' | 'center' | 'right' = 'left'): PdfCell {
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
  return model.columns.map((col) => headerCell(col.header, col.align ?? 'left'));
}

/** Satu baris data; zebra stripe agar baris panjang tetap mudah ditelusuri. */
function buildDataRow(
  model: PrintReportModel,
  row: PrintReportRow,
  index: number,
): PdfCell[] {
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
  const totals = model.totalsRow;
  return model.columns.map((col) => ({
    text: totals[col.key] ?? '',
    alignment: col.align ?? 'left',
    fontSize: FONT_SIZE_TABLE,
    bold: true,
    fillColor: TOTAL_BG,
  }));
}

/**
 * Blok tabel utama: header berulang otomatis di setiap halaman via `headerRows`.
 *
 * Lebar kolom berasal dari model (`resolveColumnWidths`), sehingga tabel 7
 * kolom (jurnal, portrait) dan 10 kolom (mingguan/bulanan, landscape) memakai
 * fungsi yang sama tanpa satu pun lebar yang di-hardcode di sini.
 */
function buildTable(model: PrintReportModel): PdfTableNode {
  const body: PdfCell[][] = [buildHeaderRow(model)];
  model.rows.forEach((row, i) => body.push(buildDataRow(model, row, i)));

  const totals = buildTotalsRow(model);
  if (totals) body.push(totals);

  return {
    table: {
      headerRows: HEADER_ROWS,
      widths: resolveColumnWidths(model),
      body,
    },
    layout: SOLID_TABLE_LAYOUT,
    margin: [0, 0, 0, 0],
  };
}

/**
 * Strip ringkasan: satu baris kotak berisi 4–5 indikator kunci.
 *
 * Ada supaya dokumen tidak langsung "menabrak" tabel — pembaca melihat angka
 * pokok lebih dulu (total JP, ketercapaian, badal, belum terealisasi). Bentuknya
 * sama untuk harian, mingguan, dan bulanan; yang berbeda hanya isinya.
 */
function buildSummaryStrip(items: PrintSummaryItem[]): PdfTableNode {
  const cells: PdfCell[] = items.map((item) => ({
    stack: [
      {
        text: item.label.toUpperCase(),
        fontSize: FONT_SIZE_SUMMARY_LABEL,
        color: MUTED,
        characterSpacing: 0.3,
      },
      {
        text: item.value,
        fontSize: FONT_SIZE_SUMMARY_VALUE,
        bold: true,
        margin: [0, 2, 0, 0] as [number, number, number, number],
      },
    ],
  }));

  return {
    table: {
      headerRows: 0,
      widths: items.map(() => '*'),
      body: [cells],
    },
    layout: SOLID_TABLE_LAYOUT,
    margin: [0, 0, 0, 10],
  };
}

/** Dokumen kosong tidak boleh ambigu antara "tidak ada data" dan "gagal". */
function buildEmptyNotice(message: string): PdfTableNode {
  return {
    table: {
      headerRows: 0,
      widths: ['*'],
      body: [[{ text: message, alignment: 'center', italics: true, fontSize: FONT_SIZE_TABLE }]],
    },
    layout: SOLID_TABLE_LAYOUT,
  };
}

/**
 * Kop resmi sekolah — tiga baris teks + garis pemisah.
 *
 * Garis pemisah WAJIB memakai lebar area cetak (`contentWidth`), bukan angka
 * tetap. Sebelumnya nilainya di-hardcode 515pt — warisan dari penulis PDF Log
 * Jurnal yang dulu hanya melayani landscape. Akibatnya garis kop terpotong di
 * SEMUA dokumen: kurang ~32pt pada portrait (A4 harian) dan ~278pt pada
 * landscape (mingguan/bulanan/jurnal), sehingga garisnya berhenti jauh sebelum
 * tepi tabel di bawahnya.
 */
function buildLetterhead(schoolName: string, ruleWidth: number): unknown[] {
  return [
    {
      text: schoolName.toUpperCase(),
      bold: true,
      fontSize: FONT_SIZE_LETTERHEAD,
      alignment: 'center',
      characterSpacing: 0.4,
    },
    {
      text: 'SISTEM INFORMASI AGENDA DAN JURNAL MENGAJAR (SIAJAR)',
      fontSize: FONT_SIZE_META,
      alignment: 'center',
      color: MUTED,
      margin: [0, 1, 0, 0],
    },
    {
      text: 'Jl. H. Saadi No. 02, Cikarang Kota, Kec. Cikarang Utara, Kab. Bekasi, Jawa Barat, 17530',
      fontSize: FONT_SIZE_META,
      alignment: 'center',
      color: MUTED,
      margin: [0, 1, 0, 0],
    },
    // Garis pemisah kop: bentuk kanvas, bukan border teks (lebih presisi).
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: ruleWidth,
          y2: 0,
          lineWidth: 1.2,
          lineColor: RULE,
        },
      ],
      margin: [0, 6, 0, 10],
    },
  ];
}

/**
 * Judul laporan + baris periode/tahun ajaran.
 *
 * `model.periodInfo` sengaja TIDAK boleh memuat awalan "Periode:" — labelnya
 * ditambahkan di sini satu kali, sehingga tidak ada lagi keluaran ganda
 * "Periode: Periode: …" yang dulu muncul pada Log Jurnal.
 */
function buildTitleBlock(model: PrintReportModel): unknown[] {
  const meta: string[] = [`Periode: ${model.periodInfo}`];
  if (model.academicYearName) meta.push(`Tahun Ajaran: ${model.academicYearName}`);

  return [
    {
      text: model.title.toUpperCase(),
      bold: true,
      fontSize: FONT_SIZE_TITLE,
      alignment: 'center',
      decoration: 'underline',
    },
    ...(model.subtitle
      ? [
          {
            text: model.subtitle,
            fontSize: FONT_SIZE_META,
            alignment: 'center' as const,
            color: MUTED,
            margin: [0, 2, 0, 0] as [number, number, number, number],
          },
        ]
      : []),
    {
      text: meta.join('   •   '),
      fontSize: FONT_SIZE_META,
      alignment: 'center',
      color: MUTED,
      margin: [0, 2, 0, 10],
    },
  ];
}

/**
 * Blok tanda tangan: dua kolom di kiri-kanan bawah dokumen.
 *
 * Bentuknya sama untuk keempat jenis laporan (Waka Kurikulum + Kepala Sekolah).
 * Sebelumnya dokumen HTML Log Jurnal memakai blok bertanda titik-titik yang
 * berbeda dari PDF-nya — sekarang keduanya memakai satu definisi ini.
 */
function buildSignatureBlock(dateLabel: string, leftSigner: string, rightSigner: string): unknown[] {
  const column = (header: string[], name: string) => ({
    width: '50%' as const,
    stack: [
      { text: header[0], fontSize: FONT_SIZE_TABLE, alignment: 'center' as const },
      { text: header[1], fontSize: FONT_SIZE_TABLE, alignment: 'center' as const },
      // Ruang kosong untuk tanda tangan basah.
      {
        text: ' ',
        fontSize: FONT_SIZE_TABLE,
        margin: [0, 0, 0, 28] as [number, number, number, number],
      },
      {
        text: name,
        fontSize: FONT_SIZE_TABLE,
        bold: true,
        alignment: 'center' as const,
        decoration: 'underline' as const,
      },
    ],
  });

  return [
    { text: '', margin: [0, 14, 0, 0] },
    {
      columns: [
        column(['Mengetahui,', 'Waka Kurikulum'], leftSigner),
        column([`Cikarang, ${dateLabel}`, 'Kepala Sekolah'], rightSigner),
      ],
    },
  ];
}

export interface ReportPdfOptions {
  /** Nama sekolah dari Pengaturan. */
  schoolName: string;
  /** Tanggal dokumen (teks siap tampil, mis. "1 Oktober 2026"). */
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
export function buildReportDocDefinition(model: PrintReportModel, options: ReportPdfOptions) {
  const {
    schoolName,
    dateLabel,
    leftSigner = DEFAULT_LEFT_SIGNER,
    rightSigner = DEFAULT_RIGHT_SIGNER,
  } = options;

  const content: unknown[] = [
    ...buildLetterhead(schoolName, contentWidth(model) - TABLE_BORDER_WIDTH),
    ...buildTitleBlock(model),
  ];

  if (model.summary && model.summary.length > 0) {
    content.push(buildSummaryStrip(model.summary));
  }

  // Dokumen kosong tetap dihasilkan (bukan dilempar sebagai error) supaya
  // permintaan "tidak ada data pada periode ini" punya dokumen arsipnya.
  content.push(
    model.rows.length > 0 ? buildTable(model) : buildEmptyNotice(model.emptyMessage),
  );

  content.push(...buildSignatureBlock(dateLabel, leftSigner, rightSigner));

  return {
    pageSize: 'A4',
    pageOrientation: model.orientation === 'landscape' ? 'landscape' : 'portrait',
    pageMargins: PAGE_MARGINS,
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
          fontSize: FONT_SIZE_FOOTER,
          color: MUTED,
        },
        {
          text: `Halaman ${currentPage} dari ${pageCount}`,
          fontSize: FONT_SIZE_FOOTER,
          color: MUTED,
          alignment: 'right' as const,
        },
      ],
    }),
  };
}

/** Awalan nama berkas per jenis laporan. */
const FILE_PREFIX: Record<ReportDocumentKind, string> = {
  harian: 'Rekap_Harian',
  mingguan: 'Rekap_Mingguan',
  bulanan: 'Rekap_Bulanan',
  jurnal: 'Jurnal_Agenda',
};

/**
 * `Rekap_Harian_2026-10-01.pdf`, `Rekap_Mingguan_2026-09-28_sd_2026-10-04.pdf`,
 * `Rekap_Bulanan_2026-10.pdf` — dari `model.fileLabel`, bukan timestamp acak.
 */
export function reportPdfFileName(model: PrintReportModel): string {
  const slug = (model.fileLabel || model.periodInfo || 'tanpa-periode')
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${FILE_PREFIX[model.documentKind]}_${slug || 'tanpa-periode'}.pdf`;
}

/**
 * Pasang mesin pdfmake + font Roboto.
 *
 * Dipisah karena bagian ini paling rawan: bentuk modul `vfs_fonts` TIDAK STABIL
 * antar versi/bundler (sudah terbukti berbeda antara Node dan hasil bundel
 * Vite), dan pemasangan font yang salah membuat dokumen GAGAL TOTAL dengan
 * "File 'Roboto-Medium.ttf' not found in virtual file system" — bukan kasus
 * tepi, karena kop, judul, header tabel, dan nama penandatangan semuanya bold.
 */
async function loadPdfMake(): Promise<PdfMakeInstance> {
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

  // Periksa semua kandidat bentuk modul vfs, bukan hanya satu, lalu validasi
  // bahwa objeknya benar-benar berisi berkas font (bukan objek kosong).
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
  // sendiri, sehingga `vfs` yang ditempel diam-diam diabaikan.
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

  if (typeof pdfMake.createPdf !== 'function') {
    throw new Error('pdfmake tidak menyediakan createPdf');
  }

  return pdfMake;
}

/**
 * Bangun + unduh PDF dari model cetak. Dipanggil dari handler tombol; melempar
 * `ReportPdfExportError` supaya UI menampilkan pesan yang bisa dimengerti.
 *
 * Mengembalikan nama berkas supaya pemanggil bisa menampilkan konfirmasi.
 */
export async function downloadReportPdf(
  model: PrintReportModel,
  options: ReportPdfOptions,
): Promise<string> {
  const fileName = reportPdfFileName(model);
  const docDefinition = buildReportDocDefinition(model, options);

  let blob: Blob;
  try {
    const pdfMake = await loadPdfMake();
    // `getBlob()` pada varian browser mengembalikan Promise (lihat catatan di
    // `PdfDocumentHandle`) — harus di-await, bukan diberi callback.
    blob = await pdfMake.createPdf(docDefinition).getBlob();
  } catch (err) {
    console.error('[export PDF] gagal membangun PDF:', err);
    throw new ReportPdfExportError('Gagal membuat dokumen PDF.');
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
    console.error('[export PDF] gagal memicu unduhan:', err);
    throw new ReportPdfExportError('Gagal mengunduh dokumen PDF.');
  }

  return fileName;
}
