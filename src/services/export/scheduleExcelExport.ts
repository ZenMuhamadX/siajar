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
 * Gaya mengikuti file referensi "JADWAL PELAJARAN 2026-2027.xlsx":
 *   - font Bookman Old Style (judul 20pt bold, subjudul 16pt, header 12pt, isi 11pt)
 *   - border tipis semua sisi, tanpa frame tebal
 *   - alignment center/center + wrapText
 *   - lebar kolom WAKTU 16.3, kolom kelas 14.7
 *   - tinggi baris: header 18, isi 20.1, spasi 6.75
 *   - judul 3 baris di-merge, header tabel diulang per hari
 *
 * Yang SENGAJA deviasi dari file referensi (sudah disepakati):
 *   - Sheet bernama "Jadwal Mingguan" / "Detail Jadwal", bukan Sheet1/Sheet2
 *   - Band hari horizontal (merge A:G), bukan kolom A teks putar 90°
 *   - Tidak ada merge sel mapel (§10/§19), sehingga 2 slot = 2 baris
 *   - Landscape + fit-to-width, bukan portrait scale 65%
 *   - Satu warna utama (navy) + tintnya, bukan kuning/sian
 */

/** Font dokumen sekolah — sama dengan file referensi. */
const FONT = 'Bookman Old Style';

/** Satu keluarga warna: navy untuk header, tint terang untuk band hari. */
const NAVY = 'FF1F3864';
const NAVY_LIGHT = 'FFD9E2F3';
const TITLE_TEXT = 'FF1F3864';
const BORDER = 'FF9CA3AF';

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: BORDER } },
  left: { style: 'thin' as const, color: { argb: BORDER } },
  bottom: { style: 'thin' as const, color: { argb: BORDER } },
  right: { style: 'thin' as const, color: { argb: BORDER } },
};

const solid = (argb: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb },
});

/** Lebar kolom mengikuti file referensi. */
const COL_TIME_WIDTH = 16.3;
const COL_CLASS_WIDTH = 14.7;

const ROW_HEADER_HEIGHT = 18;
const ROW_BODY_HEIGHT = 20.1;
const ROW_SPACER_HEIGHT = 6.75;
const ROW_BAND_HEIGHT = 20;

const SHEET_WEEKLY = 'Jadwal Mingguan';
const SHEET_DETAIL = 'Detail Jadwal';

export class ScheduleExportError extends Error {}

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
  const mod = (await import('exceljs')) as unknown as { default?: unknown } & Record<string, unknown>;
  const source = (mod.default ?? mod) as { Workbook?: WorkbookCtor };
  if (typeof source?.Workbook !== 'function') {
    throw new ScheduleExportError('Gagal mengekspor jadwal.');
  }
  return source.Workbook;
}

/** "08:05–08:40" — en dash, sesuai §16. */
function timeRange(row: Pick<WeeklyRow, 'start' | 'end'>): string {
  return `${row.start}–${row.end}`;
}

/** Baris judul 3 tingkat: JADWAL PELAJARAN / nama sekolah / tahun pelajaran. */
function writeTitleBlock(ws: SheetLike, lastColumn: string, model: ScheduleExportModel) {
  const rows: Array<[string, number]> = [
    ['JADWAL PELAJARAN', 20],
    ['SDIT AS-SYIFA', 16],
    [`TAHUN PELAJARAN ${model.academicYearName}`, 12],
  ];

  rows.forEach(([text, size], i) => {
    const rowNo = i + 1;
    ws.mergeCells(`A${rowNo}:${lastColumn}${rowNo}`);
    const cell = ws.getCell(rowNo, 1);
    cell.value = text;
    cell.font = { name: FONT, size, bold: true, color: { argb: TITLE_TEXT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(rowNo).height = size + 6;
  });

  // Dua baris spasi tipis, sama seperti file referensi.
  ws.getRow(4).height = ROW_SPACER_HEIGHT;
  ws.getRow(5).height = ROW_SPACER_HEIGHT;
}

/** Baris header WAKTU + KELAS 1..6, diulang di setiap blok hari. */
function writeHeaderRow(ws: SheetLike, rowNo: number, model: ScheduleExportModel) {
  const headers = ['WAKTU', ...model.classOptions];
  headers.forEach((text, i) => {
    const cell = ws.getCell(rowNo, i + 1);
    cell.value = text;
    cell.font = { name: FONT, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = solid(NAVY);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });
  ws.getRow(rowNo).height = ROW_HEADER_HEIGHT;
}

/** Baris pemisah hari: merge seluruh lebar tabel, navy muda + bold. */
function writeDayBand(ws: SheetLike, rowNo: number, label: string, lastColumn: string) {
  ws.mergeCells(`A${rowNo}:${lastColumn}${rowNo}`);
  const cell = ws.getCell(rowNo, 1);
  cell.value = label;
  cell.font = { name: FONT, size: 12, bold: true, color: { argb: TITLE_TEXT } };
  cell.fill = solid(NAVY_LIGHT);
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = THIN_BORDER;
  ws.getRow(rowNo).height = ROW_BAND_HEIGHT;
}

/** Baris jadwal: kolom WAKTU + satu cell per kelas. */
function writeScheduleRow(
  ws: SheetLike,
  rowNo: number,
  row: WeeklyRow,
  classOptions: string[],
) {
  const timeCell = ws.getCell(rowNo, 1);
  timeCell.value = timeRange(row);
  timeCell.font = { name: FONT, size: 11 };
  timeCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  timeCell.border = THIN_BORDER;

  classOptions.forEach((classId, i) => {
    const cell = ws.getCell(rowNo, i + 2);
    // §13: kelas tanpa jadwal pada slot ini → cell kosong, bukan "N/A"/"-".
    const value = row.cells[classId];
    if (value) cell.value = value;
    cell.font = { name: FONT, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
  });

  ws.getRow(rowNo).height = ROW_BODY_HEIGHT;
}
function writeFootnote(ws: SheetLike, rowNo: number, lines: string[], lastColumn: string) {
  lines.forEach((text, i) => {
    const r = rowNo + i;
    ws.mergeCells(`A${r}:${lastColumn}${r}`);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF4B5563' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(r).height = 14;
  });
}

/** Sheet 1 — format jadwal sekolah (§5). */
function buildWeeklySheet(wb: ExcelJsWorkbook, model: ScheduleExportModel) {
  const lastColumnLetter =
    model.classOptions.length > 0
      ? String.fromCharCode(65 + model.classOptions.length) // A=65 → 6 kelas → "G"
      : 'A';

  const ws = wb.addWorksheet(SHEET_WEEKLY, {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  ws.getColumn(1).width = COL_TIME_WIDTH;
  model.classOptions.forEach((_, i) => {
    ws.getColumn(i + 2).width = COL_CLASS_WIDTH;
  });

  writeTitleBlock(ws, lastColumnLetter, model);
  writeHeaderRow(ws, 6, model);

  let rowNo = 7;
  for (const day of model.weekly) {
    if (day.rows.length === 0) continue; // hari tanpa jadwal → tidak ada band
    writeDayBand(ws, rowNo, day.label, lastColumnLetter);
    rowNo += 1;
    for (const row of day.rows) {
      writeScheduleRow(ws, rowNo, row, model.classOptions);
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
  if (model.archivedCount > 0) {
    footnotes.push(
      `Catatan: ${model.archivedCount} slot berstatus ARSIP dikecualikan dari export ini.`,
    );
  }
  if (footnotes.length > 0) {
    rowNo += 1;
    writeFootnote(ws, rowNo, footnotes, lastColumnLetter);
    rowNo += footnotes.length;
  }

  const lastRow = Math.max(rowNo - 1, 6);
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printArea: `A1:${lastColumnLetter}${lastRow}`,
    printTitlesRow: '1:6', // judul + header mengulang di tiap halaman cetak
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

/** Sheet 2 — normalized, untuk pemeriksaan data & filtering (§14). */
function buildDetailSheet(wb: any, model: ScheduleExportModel) {
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

  const ws = wb.addWorksheet(SHEET_DETAIL, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  headers.forEach((text, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = text;
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = solid(NAVY);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = THIN_BORDER;
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
      cell.font = { name: FONT, size: 11 };
      cell.alignment = {
        horizontal: col === 5 || col === 6 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = THIN_BORDER;
    });
    ws.getRow(rowNo).height = ROW_BODY_HEIGHT;
  });

  const lastRow = model.detail.length + 1;
  ws.autoFilter = { from: 'A1', to: `H${Math.max(lastRow, 1)}` };
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  return ws;
}

/**
 * Bangun workbook dari model. Terpisah dari unduhan supaya bisa diuji
 * (sulisnya benar-benar menghasilkan .xlsx yang valid di disk).
 */
export async function buildScheduleWorkbook(model: ScheduleExportModel) {
  const Workbook = await loadWorkbookCtor();
  const wb = new Workbook();
  wb.creator = 'SIAJAR';
  wb.lastModifiedBy = 'SIAJAR';
  wb.created = new Date();
  wb.modified = new Date();

  buildWeeklySheet(wb, model);
  buildDetailSheet(wb, model);

  return wb;
}

/** Nama file sesuai tahun ajaran dari data (§20). */
export function scheduleExportFileName(model: ScheduleExportModel): string {
  return exportFileName(model.academicYearName);
}

/**
 * Bangun + unduh file .xlsx. Dipanggil dari handler tombol.
 * Error dilempar sebagai `ScheduleExportError` supaya UI bisa menampilkan
 * pesan yang jelas (§25), bukan crash diam-diam.
 */
export async function downloadScheduleWorkbook(model: ScheduleExportModel): Promise<string> {
  const fileName = scheduleExportFileName(model);

  if (model.exportedCount === 0) {
    throw new ScheduleExportError('Belum ada jadwal untuk tahun ajaran ini.');
  }

  let buffer: ArrayBuffer;
  try {
    const wb = await buildScheduleWorkbook(model);
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
