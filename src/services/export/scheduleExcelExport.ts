import type { ExcelSettings } from '../settings/appSettings';
import { DEFAULT_SETTINGS } from '../settings/appSettings';
import type { ScheduleExportModel, WeeklyRow } from './scheduleExportModel';
import { exportFileName } from './scheduleExportModel';

/**
 * Penulis file .xlsx untuk export jadwal.
 *
 * Sengaja dipisah dari `scheduleExportModel.ts`: semua keputusan "apa yang
 * dicetak" ada di model (murni, teruji), file ini hanya berperan pada
 * bagaimana konstanta itu terlihat di Excel.
 *
 * ExcelJS di-import dinamis: ~900 kB hanya diambil saat tombol ditekan, bukan
 * saat app dimuat. Vite meng-code-split-nya jadi chunk sendiri (sudah
 * diverifikasi lewat `vite build`).
 *
 * Tampilan kerangka (font, orientasi, warna judul/header/band/border) diambil
 * dari Pengaturan (`ExcelSettings`) — tidak ada nilai yang tertanam di sini.
 * Satu pengecualian yang disengaja: WARNA LATAR SEL MAPEL. Itu bukan gaya
 * dokumen, melainkan atribut mapelnya sendiri, jadi sudah diputuskan di model
 * (`cellStyles`) dan di sini hanya ditempelkan. Nilai bawaannya meniru hasil
 * Stage 5.2 yang sudah disetujui, termasuk gaya file referensi
 * "JADWAL PELAJARAN 2026-2027.xlsx": font Bookman Old Style, border tipis
 * tanpa frame tebal, center/center + wrapText, lebar kolom WAKTU 16.3 & kelas
 * 14.7, tinggi baris 18/20.1/6.75, judul 3 baris di-merge, header tabel
 * diulang per hari.
 *
 * Yang SENGAJA deviasi dari file referensi (sudah disepakati):
 *   - Sheet bernama "Jadwal Mingguan" / "Detail Jadwal", bukan Sheet1/Sheet2
 *   - Band hari horizontal (merge A:G), bukan kolom A teks putar 90 derajat
 *   - Tidak ada merge sel mapel, sehingga 2 slot = 2 baris
 *   - Satu warna utama + tint-nya, bukan kuning/sian
 *   - Stage 8: sel mapel diberi warna latar sendiri (per mata pelajaran),
 *     bukan seragam seperti file referensi
 */

/** Lebar kolom & tinggi baris tetap (bukan bagian kustomisasi). */
const COL_TIME_WIDTH = 16.3;
const COL_CLASS_WIDTH = 14.7;

const ROW_HEADER_HEIGHT = 18;
const ROW_BODY_HEIGHT = 20.1;
const ROW_SPACER_HEIGHT = 6.75;
const ROW_BAND_HEIGHT = 20;
const ROW_FOOTNOTE_HEIGHT = 14;

const SHEET_WEEKLY = 'Jadwal Mingguan';
const SHEET_DETAIL = 'Detail Jadwal';

export class ScheduleExportError extends Error {}

/** Warna dari Pengaturan selalu 6 digit hex tanpa '#'; ExcelJS minta format ARGB. */
const argb = (hex: string) => `FF${hex.replace(/^#/, '').toUpperCase()}`;

/** Pemisah waktu sesuai pengaturan: en dash (08:05-08:40) atau hyphen biasa. */
function timeSeparatorChar(settings: ExcelSettings): string {
  return settings.timeSeparator === 'en-dash' ? '\u2013' : '-';
}

/**
 * Bentuk minimum dari worksheet ExcelJS yang dipakai helper di file ini.
 * Sengaja struktural (bukan `typeof Worksheet`) supaya helper tetap bisa
 * diuji tanpa menarik seluruh tipe ExcelJS ke dalam setiap call site.
 */
interface SheetCell {
  value: unknown;
  font?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  border?: Record<string, unknown>;
}
interface SheetRow {
  height: number;
}
interface SheetLike {
  mergeCells(range: string): void;
  getCell(row: number, col: number): SheetCell;
  getRow(row: number): SheetRow;
}

type ExcelJsWorkbook = {
  addWorksheet(name: string, options?: Record<string, unknown>): SheetLike & {
    getColumn(n: number): { width: number };
    pageSetup: Record<string, unknown>;
    autoFilter?: unknown;
    views?: unknown;
  };
  creator?: string;
  lastModifiedBy?: string;
  created?: Date;
  modified?: Date;
  xlsx: { writeBuffer(): Promise<ArrayBuffer> };
};

type WorkbookCtor = new () => ExcelJsWorkbook;

/**
 * ExcelJS adalah paket CJS dengan `export =`, jadi hasil `import()` dinamis
 * bisa berupa namespace atau objek `default` tergantung interop bundler.
 * Ambil konstruktor Workbook secara defensif dari keduanya.
 */
async function loadWorkbookCtor(): Promise<WorkbookCtor> {
  const mod = (await import('exceljs')) as unknown as { default?: unknown } &
    Record<string, unknown>;
  const source = (mod.default ?? mod) as { Workbook?: WorkbookCtor };
  if (typeof source?.Workbook !== 'function') {
    throw new ScheduleExportError('Gagal mengekspor jadwal.');
  }
  return source.Workbook;
}

/** Border tipis 4 sisi, atau undefined kalau border dimatikan di Pengaturan. */
function borderFor(settings: ExcelSettings) {
  if (!settings.showBorders) return undefined;
  const side = { style: 'thin' as const, color: { argb: argb(settings.borderColor) } };
  return { top: side, left: side, bottom: side, right: side };
}

const solid = (argbValue: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: argbValue },
});

/** Rentang waktu, pemisah dari Pengaturan. */
function timeRange(row: Pick<WeeklyRow, 'start' | 'end'>, settings: ExcelSettings): string {
  return `${row.start}${timeSeparatorChar(settings)}${row.end}`;
}

/** Judul 3 tingkat: JADWAL PELAJARAN / nama sekolah / tahun pelajaran. */
function writeTitleBlock(
  ws: SheetLike,
  lastColumn: string,
  model: ScheduleExportModel,
  style: ExcelSettings,
) {
  const rows: Array<[string, number]> = [
    ['JADWAL PELAJARAN', style.titleFontSize],
    [model.schoolName, Math.max(12, style.titleFontSize - 4)],
    [`TAHUN PELAJARAN ${model.academicYearName}`, Math.max(10, style.titleFontSize - 8)],
  ];
  const border = borderFor(style);

  rows.forEach(([text, size], i) => {
    const rowNo = i + 1;
    ws.mergeCells(`A${rowNo}:${lastColumn}${rowNo}`);
    const cell = ws.getCell(rowNo, 1);
    cell.value = text;
    cell.font = {
      name: style.fontFamily,
      size,
      bold: true,
      color: { argb: argb(style.titleColor) },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (border) cell.border = border;
    ws.getRow(rowNo).height = size + 6;
  });

  // Dua baris spasi tipis, sama seperti file referensi.
  ws.getRow(4).height = ROW_SPACER_HEIGHT;
  ws.getRow(5).height = ROW_SPACER_HEIGHT;
}

/** Baris header WAKTU + KELAS 1..6, diulang di setiap blok hari. */
function writeHeaderRow(
  ws: SheetLike,
  rowNo: number,
  model: ScheduleExportModel,
  style: ExcelSettings,
) {
  const headers = ['WAKTU', ...model.classOptions];
  const border = borderFor(style);
  headers.forEach((text, i) => {
    const cell = ws.getCell(rowNo, i + 1);
    cell.value = text;
    cell.font = {
      name: style.fontFamily,
      size: Math.max(9, style.baseFontSize),
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = solid(argb(style.headerColor));
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    if (border) cell.border = border;
  });
  ws.getRow(rowNo).height = ROW_HEADER_HEIGHT;
}

/** Baris pemisah hari: merge seluruh lebar tabel. */
function writeDayBand(
  ws: SheetLike,
  rowNo: number,
  label: string,
  lastColumn: string,
  style: ExcelSettings,
) {
  ws.mergeCells(`A${rowNo}:${lastColumn}${rowNo}`);
  const cell = ws.getCell(rowNo, 1);
  const border = borderFor(style);
  cell.value = label;
  cell.font = {
    name: style.fontFamily,
    size: Math.max(9, style.baseFontSize),
    bold: true,
    color: { argb: argb(style.titleColor) },
  };
  cell.fill = solid(argb(style.bandColor));
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (border) cell.border = border;
  ws.getRow(rowNo).height = ROW_BAND_HEIGHT;
}

/** Baris jadwal: kolom WAKTU + satu cell per kelas. */
function writeScheduleRow(
  ws: SheetLike,
  rowNo: number,
  row: WeeklyRow,
  classOptions: string[],
  style: ExcelSettings,
) {
  const border = borderFor(style);
  const timeCell = ws.getCell(rowNo, 1);
  timeCell.value = timeRange(row, style);
  timeCell.font = { name: style.fontFamily, size: style.baseFontSize };
  timeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  if (border) timeCell.border = border;

  classOptions.forEach((classId, i) => {
    const cell = ws.getCell(rowNo, i + 2);
    // Kelas tanpa jadwal pada slot ini dibiarkan kosong, bukan "N/A"/"-".
    const value = row.cells[classId];
    const cellStyle = row.cellStyles?.[classId];
    if (value) cell.value = value;

    const font: Record<string, unknown> = {
      name: style.fontFamily,
      size: style.baseFontSize,
    };
    // Warna teks ikut latar supaya mapel berwarna gelap tetap terbaca.
    if (value && cellStyle) font.color = { argb: argb(cellStyle.textColor) };
    cell.font = font;

    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    if (border) cell.border = border;
    // Sel kosong sengaja TIDAK diberi latar: grid yang kosong harus tetap
    // terbaca sebagai "tidak ada jadwal", bukan sebagai sebuah mapel.
    if (value && cellStyle?.fill) cell.fill = solid(argb(cellStyle.fill));
  });

  ws.getRow(rowNo).height = ROW_BODY_HEIGHT;
}

/** Catatan kaki (ada DRAFT yang ikut / yang dikecualikan). */
function writeFootnote(
  ws: SheetLike,
  rowNo: number,
  lines: string[],
  lastColumn: string,
  style: ExcelSettings,
) {
  lines.forEach((text, i) => {
    const r = rowNo + i;
    ws.mergeCells(`A${r}:${lastColumn}${r}`);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = {
      name: style.fontFamily,
      size: 9,
      italic: true,
      color: { argb: 'FF4B5563' },
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(r).height = ROW_FOOTNOTE_HEIGHT;
  });
}

/** Sheet 1: format jadwal sekolah. */
function buildWeeklySheet(
  wb: ExcelJsWorkbook,
  model: ScheduleExportModel,
  style: ExcelSettings,
) {
  const lastColumnLetter =
    model.classOptions.length > 0
      ? String.fromCharCode(65 + model.classOptions.length) // A=65, 6 kelas -> "G"
      : 'A';

  const ws = wb.addWorksheet(SHEET_WEEKLY, {
    views: style.repeatHeader
      ? [{ state: 'frozen', ySplit: 6 }]
      : [{ state: 'normal' }],
  });

  ws.getColumn(1).width = COL_TIME_WIDTH;
  model.classOptions.forEach((_, i) => {
    ws.getColumn(i + 2).width = COL_CLASS_WIDTH;
  });

  writeTitleBlock(ws, lastColumnLetter, model, style);
  writeHeaderRow(ws, 6, model, style);

  let rowNo = 7;
  for (const day of model.weekly) {
    if (day.rows.length === 0) continue; // hari tanpa jadwal -> tidak ada band
    writeDayBand(ws, rowNo, day.label, lastColumnLetter, style);
    rowNo += 1;
    for (const row of day.rows) {
      writeScheduleRow(ws, rowNo, row, model.classOptions, style);
      rowNo += 1;
    }
  }

  const footnotes: string[] = [];
  if (model.draftCount > 0) {
    footnotes.push(
      `Catatan: ${model.draftCount} slot berstatus DRAFT ikut dicetak. ` +
        `Pastikan sudah disetujui sebelum jadwal dipakai.`,
    );
  }
  if (model.draftExcludedCount > 0) {
    footnotes.push(
      `Catatan: ${model.draftExcludedCount} slot berstatus DRAFT dikecualikan ` +
        `karena pengaturan export.`,
    );
  }
  if (model.archivedCount > 0) {
    footnotes.push(
      `Catatan: ${model.archivedCount} slot berstatus ARSIP dikecualikan dari export ini.`,
    );
  }
  if (footnotes.length > 0) {
    rowNo += 1;
    writeFootnote(ws, rowNo, footnotes, lastColumnLetter, style);
    rowNo += footnotes.length;
  }

  const lastRow = Math.max(rowNo - 1, 6);
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: style.orientation,
    fitToPage: style.fitToWidth,
    fitToWidth: style.fitToWidth ? 1 : 0,
    fitToHeight: 0,
    printArea: `A1:${lastColumnLetter}${lastRow}`,
    // Judul + header mengulang di tiap halaman cetak.
    ...(style.repeatHeader ? { printTitlesRow: '1:6' } : {}),
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  return ws;
}

/** Sheet 2: normalized, untuk pemeriksaan data & filtering. */
function buildDetailSheet(
  wb: ExcelJsWorkbook,
  model: ScheduleExportModel,
  style: ExcelSettings,
) {
  const headers = [
    'Hari',
    'Waktu Mulai',
    'Waktu Selesai',
    'JP',
    'Kelas',
    'Mata Pelajaran/Kegiatan',
    'Guru',
    'Tahun Ajaran',
  ];
  const widths = [11, 12, 12, 6, 12, 26, 14, 13];
  const border = borderFor(style);

  const ws = wb.addWorksheet(SHEET_DETAIL, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  headers.forEach((text, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = text;
    cell.font = {
      name: style.fontFamily,
      size: style.baseFontSize,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = solid(argb(style.headerColor));
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    if (border) cell.border = border;
  });
  ws.getRow(1).height = ROW_HEADER_HEIGHT;

  model.detail.forEach((row, i) => {
    const rowNo = i + 2;
    const values = [
      row.day,
      row.start,
      row.end,
      row.periodNumber,
      row.classId,
      row.subject,
      row.teacher,
      row.academicYear,
    ];
    values.forEach((value, col) => {
      const cell = ws.getCell(rowNo, col + 1);
      if (value !== '') cell.value = value as string | number;
      cell.font = { name: style.fontFamily, size: style.baseFontSize };
      cell.alignment = {
        horizontal: col === 5 || col === 6 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
      if (border) cell.border = border;
    });
    ws.getRow(rowNo).height = ROW_BODY_HEIGHT;
  });

  const lastRow = model.detail.length + 1;
  ws.autoFilter = { from: 'A1', to: `H${Math.max(lastRow, 1)}` };
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: style.fitToWidth,
    fitToWidth: style.fitToWidth ? 1 : 0,
    fitToHeight: 0,
    ...(style.repeatHeader ? { printTitlesRow: '1:1' } : {}),
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  return ws;
}

/**
 * Bangun workbook dari model. Terpisah dari unduhan supaya bisa diuji
 * (bisa dipastikan benar-benar menghasilkan .xlsx yang valid di disk).
 *
 * `settings` opsional; kalau tidak diisi dipakai DEFAULT_SETTINGS yang identik
 * dengan hasil Stage 5.2.
 */
export async function buildScheduleWorkbook(
  model: ScheduleExportModel,
  settings: ExcelSettings = DEFAULT_SETTINGS.excel,
) {
  const Workbook = await loadWorkbookCtor();
  const wb = new Workbook();
  wb.creator = 'SIAJAR';
  wb.lastModifiedBy = 'SIAJAR';
  wb.created = new Date();
  wb.modified = new Date();

  buildWeeklySheet(wb, model, settings);
  buildDetailSheet(wb, model, settings);

  return wb;
}

/** Nama file sesuai tahun ajaran dari data. */
export function scheduleExportFileName(model: ScheduleExportModel): string {
  return exportFileName(model.academicYearName);
}

/**
 * Bangun + unduh file .xlsx. Dipanggil dari handler tombol.
 * Error dilempar sebagai `ScheduleExportError` supaya UI bisa menampilkan
 * pesan yang jelas, bukan crash diam-diam.
 */
export async function downloadScheduleWorkbook(
  model: ScheduleExportModel,
  settings: ExcelSettings = DEFAULT_SETTINGS.excel,
): Promise<string> {
  const fileName = scheduleExportFileName(model);

  if (model.exportedCount === 0) {
    throw new ScheduleExportError('Belum ada jadwal untuk tahun ajaran ini.');
  }

  let buffer: ArrayBuffer;
  try {
    const wb = await buildScheduleWorkbook(model, settings);
    const buf = await wb.xlsx.writeBuffer();
    buffer = buf as ArrayBuffer;
  } catch (err) {
    console.error('[export jadwal] gagal menulis workbook:', err);
    throw new ScheduleExportError('Gagal mengekspor jadwal.');
  }

  try {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
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
    console.error('[export jadwal] gagal memicu unduhan:', err);
    throw new ScheduleExportError('Gagal mengekspor jadwal.');
  }

  return fileName;
}
