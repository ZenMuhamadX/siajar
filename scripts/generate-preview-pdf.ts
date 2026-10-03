/**
 * Pembuat CONTOH PDF rekap — harian, mingguan, bulanan.
 *
 * Gunanya: memeriksa tata letak dokumen secara nyata (bukan pratinjau HTML),
 * dengan memakai **kode produksi yang sama persis** — `buildReportDocDefinition`
 * dari `src/services/export/reportPdfExport.ts`. Jadi berkas yang dihasilkan di
 * sini tidak mungkin berbeda dari yang diunduh pengguna lewat tombol "Unduh PDF".
 *
 * Jalankan:  bun scripts/generate-preview-pdf.ts
 * Hasil   :  docs/contoh-pdf/*.pdf
 *
 * Catatan: pdfmake di sini memakai varian Node (`js/index.js`) beserta berkas
 * font asli dari disk, sedangkan di aplikasi memakai varian browser + virtual
 * file system. Definisi dokumennya identik — hanya mesin penulisnya berbeda.
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildReportDocDefinition, reportPdfFileName } from '../src/services/export/reportPdfExport';
import {
  createPrintModel,
  type PrintReportModel,
  type PrintReportRow,
} from '../src/services/report/printReportModel';

const OUT_DIR = path.resolve('docs/contoh-pdf');

/** Permukaan pdfmake varian Node yang dipakai skrip ini. */
interface NodePdfMake {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setLocalAccessPolicy(callback: (filePath: string) => boolean): void;
  createPdf(docDefinition: unknown): { write(filename: string): Promise<void> };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake') as NodePdfMake;

const FONT_DIR = path.resolve('node_modules/pdfmake/fonts/Roboto');

pdfmake.setFonts({
  Roboto: {
    normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(FONT_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
  },
});
// Izinkan hanya berkas font di folder pdfmake dibaca dari disk.
pdfmake.setLocalAccessPolicy((filePath) => filePath.startsWith(FONT_DIR));

const SCHOOL = 'SMA Negeri 1 Cikarang Utara';
const DATE_LABEL = '1 Oktober 2026';

const row = (
  no: string,
  guru: string,
  jpTerjadwal: string,
  jpRealisasi: string,
  durasiTerjadwal: string,
  durasiRealisasi: string,
  badalMasuk: string,
  badalKeluar: string,
  belumRealisasi: string,
  capaian: string,
): PrintReportRow => ({
  no,
  guru,
  jpTerjadwal,
  jpRealisasi,
  durasiTerjadwal,
  durasiRealisasi,
  badalMasuk,
  badalKeluar,
  belumRealisasi,
  capaian,
});

const GURU_NAMA = [
  'Abdulloh, S.Pd., Gr.',
  'Fitri Nurhasanah, S.Pd., Gr.',
  'Rudi Hartono, S.Kom.',
  'Siti Aminah, S.Pd.',
  'Budi Santoso, S.Pd.',
  'Dewi Lestari, S.Pd.',
  'Ahmad Fauzi, S.Ag.',
  'Nurul Hidayah, S.Pd.',
  'Hendra Wijaya, S.Or.',
  'Maya Puspita, S.Pd.',
  'Iwan Setiawan, S.Kom.',
  'Rina Marlina, S.E.',
];

// ---- 1. HARIAN (A4 portrait, 8 kolom) -------------------------------------

const harianRows: PrintReportRow[] = [
  ['07:00–07:35', 'XI RPL 1', 'Pemrograman Web', 'Abdulloh, S.Pd.', 'Abdulloh, S.Pd.', 'Selesai'],
  ['07:35–08:10', 'XI RPL 2', 'Basis Data', 'Fitri Nurhasanah, S.Pd.', 'Fitri Nurhasanah, S.Pd.', 'Selesai'],
  ['08:10–08:45', 'X TKJ 1', 'Jaringan Dasar', 'Rudi Hartono, S.Kom.', 'Siti Aminah, S.Pd.', 'Badal'],
  ['08:45–09:20', 'X TKJ 2', 'Jaringan Dasar', 'Rudi Hartono, S.Kom.', 'Rudi Hartono, S.Kom.', 'Selesai'],
  ['09:35–10:10', 'XII RPL 1', 'Pemrograman Web', 'Abdulloh, S.Pd.', 'Abdulloh, S.Pd.', 'Selesai'],
  ['10:10–10:45', 'XII RPL 2', 'Basis Data', 'Fitri Nurhasanah, S.Pd.', 'Fitri Nurhasanah, S.Pd.', 'Selesai'],
  ['10:45–11:20', 'XI TKJ 1', 'Sistem Operasi', 'Budi Santoso, S.Pd.', '-', 'Belum Diisi'],
  ['11:20–11:55', 'XI TKJ 2', 'Sistem Operasi', 'Budi Santoso, S.Pd.', '-', 'Belum Diisi'],
  ['13:00–13:35', 'X RPL 1', 'Matematika', 'Siti Aminah, S.Pd.', 'Siti Aminah, S.Pd.', 'Selesai'],
  ['13:35–14:10', 'X RPL 2', 'Matematika', 'Siti Aminah, S.Pd.', '-', 'Belum Diisi'],
].map((r, i) => ({
  no: String(i + 1),
  waktu: r[0],
  kelas: r[1],
  mapel: r[2],
  guruTerjadwal: r[3],
  guruAktual: r[4],
  status: r[5],
}));

const harianModel: PrintReportModel = createPrintModel({
  documentKind: 'harian',
  orientation: 'portrait',
  title: 'Laporan Rekap Pembelajaran Harian',
  subtitle: 'Hari, Tanggal: Kamis, 1 Oktober 2026',
  periodInfo: '1 Oktober 2026',
  fileLabel: '2026-10-01',
  academicYearName: '2026/2027',
  columns: [
    { key: 'no', header: 'No', align: 'center', ptWidth: 20 },
    { key: 'waktu', header: 'Waktu', align: 'center', ptWidth: 60 },
    { key: 'kelas', header: 'Kelas', align: 'center', ptWidth: 40 },
    { key: 'mapel', header: 'Mata Pelajaran', align: 'left' },
    { key: 'guruTerjadwal', header: 'Guru Terjadwal', align: 'left', ptWidth: 86 },
    { key: 'guruAktual', header: 'Guru Aktual', align: 'left', ptWidth: 86 },
    { key: 'status', header: 'Status', align: 'center', ptWidth: 52 },
  ],
  summary: [
    { label: 'Total Jadwal', value: '32 JP' },
    { label: 'Terealisasi', value: '28 JP' },
    { label: 'Badal', value: '3 JP' },
    { label: 'Belum Terealisasi', value: '4 JP' },
  ],
  rows: harianRows,
  emptyMessage: 'Tidak ada jadwal atau agenda pada tanggal ini untuk filter yang dipilih.',
});

// ---- 2. MINGGUAN (A4 landscape, 10 kolom) ---------------------------------

const mingguanRows: PrintReportRow[] = [
  row('1', GURU_NAMA[0], '24', '23', '14j 0m', '13j 25m', '+1', '0', '1', '96%'),
  row('2', GURU_NAMA[1], '22', '20', '12j 50m', '11j 40m', '0', '-1', '2', '91%'),
  row('3', GURU_NAMA[2], '20', '18', '11j 40m', '10j 30m', '+2', '0', '2', '90%'),
  row('4', GURU_NAMA[3], '24', '22', '14j 0m', '12j 50m', '+1', '0', '2', '92%'),
  row('5', GURU_NAMA[4], '18', '14', '10j 30m', '8j 10m', '0', '-2', '4', '78%'),
  row('6', GURU_NAMA[5], '20', '19', '11j 40m', '11j 5m', '+1', '0', '1', '95%'),
  row('7', GURU_NAMA[6], '16', '16', '9j 20m', '9j 20m', '0', '0', '0', '100%'),
  row('8', GURU_NAMA[7], '22', '19', '12j 50m', '11j 5m', '+1', '-1', '3', '86%'),
  row('9', GURU_NAMA[8], '18', '16', '10j 30m', '9j 20m', '0', '-1', '2', '89%'),
  row('10', GURU_NAMA[9], '20', '17', '11j 40m', '9j 55m', '0', '0', '3', '85%'),
  row('11', GURU_NAMA[10], '16', '13', '9j 20m', '7j 35m', '0', '-1', '3', '81%'),
  row('12', GURU_NAMA[11], '14', '14', '8j 10m', '8j 10m', '+1', '0', '0', '100%'),
];

const mingguanModel: PrintReportModel = createPrintModel({
  documentKind: 'mingguan',
  orientation: 'landscape',
  title: 'Laporan Rekapitulasi Pembelajaran Mingguan',
  periodInfo: '28 September 2026 s.d. 4 Oktober 2026',
  fileLabel: '2026-09-28_sd_2026-10-04',
  academicYearName: '2026/2027',
  columns: [
    { key: 'no', header: 'No', align: 'center', ptWidth: 22 },
    { key: 'guru', header: 'Nama Guru', align: 'left' },
    { key: 'jpTerjadwal', header: 'JP Terjadwal', align: 'center', ptWidth: 54 },
    { key: 'jpRealisasi', header: 'JP Realisasi', align: 'center', ptWidth: 54 },
    { key: 'durasiTerjadwal', header: 'Durasi Terjadwal', align: 'center', ptWidth: 68 },
    { key: 'durasiRealisasi', header: 'Durasi Realisasi', align: 'center', ptWidth: 68 },
    { key: 'badalMasuk', header: 'Badal Masuk', align: 'center', ptWidth: 50 },
    { key: 'badalKeluar', header: 'Badal Keluar', align: 'center', ptWidth: 50 },
    { key: 'belumRealisasi', header: 'Belum Realisasi', align: 'center', ptWidth: 58 },
    { key: 'capaian', header: 'Capaian %', align: 'center', ptWidth: 52 },
  ],
  summary: [
    { label: 'JP Terjadwal', value: '234 JP' },
    { label: 'JP Terealisasi', value: '211 JP' },
    { label: 'Badal', value: '+7 / \u22126' },
    { label: 'Belum Realisasi', value: '23 JP' },
    { label: 'Capaian', value: '90%' },
  ],
  rows: mingguanRows,
  totalsRow: row('', 'TOTAL KESELURUHAN', '234', '211', '136j 30m', '123j 5m', '+7', '-6', '23', '90%'),
  emptyMessage: 'Tidak ada data pembelajaran pada periode minggu ini.',
});

// ---- 3. BULANAN (A4 landscape, kolom identik mingguan) ---------------------

const bulananRows: PrintReportRow[] = [
  row('1', GURU_NAMA[0], '96', '92', '56j 0m', '53j 40m', '+4', '0', '4', '96%'),
  row('2', GURU_NAMA[1], '88', '82', '51j 20m', '47j 50m', '0', '-3', '6', '93%'),
  row('3', GURU_NAMA[2], '80', '73', '46j 40m', '42j 35m', '+5', '0', '7', '91%'),
  row('4', GURU_NAMA[3], '96', '89', '56j 0m', '51j 55m', '+3', '-1', '7', '93%'),
  row('5', GURU_NAMA[4], '72', '57', '42j 0m', '33j 15m', '0', '-6', '15', '79%'),
  row('6', GURU_NAMA[5], '80', '76', '46j 40m', '44j 20m', '+2', '0', '4', '95%'),
  row('7', GURU_NAMA[6], '64', '64', '37j 20m', '37j 20m', '0', '0', '0', '100%'),
  row('8', GURU_NAMA[7], '88', '78', '51j 20m', '45j 30m', '+3', '-2', '10', '89%'),
  row('9', GURU_NAMA[8], '72', '64', '42j 0m', '37j 20m', '0', '-2', '8', '89%'),
  row('10', GURU_NAMA[9], '80', '70', '46j 40m', '40j 50m', '+1', '0', '10', '88%'),
  row('11', GURU_NAMA[10], '64', '54', '37j 20m', '31j 30m', '0', '-3', '10', '84%'),
  row('12', GURU_NAMA[11], '56', '55', '32j 40m', '32j 5m', '+2', '0', '1', '98%'),
];

const bulananModel: PrintReportModel = createPrintModel({
  ...mingguanModel,
  documentKind: 'bulanan',
  title: 'Laporan Rekapitulasi Pembelajaran Bulanan',
  periodInfo: 'Oktober 2026',
  fileLabel: '2026-10',
  summary: [
    { label: 'JP Terjadwal', value: '936 JP' },
    { label: 'JP Terealisasi', value: '854 JP' },
    { label: 'Badal', value: '+20 / \u221217' },
    { label: 'Belum Realisasi', value: '82 JP' },
    { label: 'Capaian', value: '91%' },
  ],
  rows: bulananRows,
  totalsRow: row('', 'TOTAL KESELURUHAN', '936', '854', '546j 0m', '497j 40m', '+20', '-17', '82', '91%'),
  emptyMessage: 'Tidak ada data pembelajaran pada bulan ini.',
});

// ---- Tulis berkas ---------------------------------------------------------

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const models = [harianModel, mingguanModel, bulananModel];

  for (const model of models) {
    const fileName = reportPdfFileName(model);
    const outPath = path.join(OUT_DIR, fileName);
    const docDefinition = buildReportDocDefinition(model, {
      schoolName: SCHOOL,
      dateLabel: DATE_LABEL,
    });
    await pdfmake.createPdf(docDefinition).write(outPath);
    const size = fs.statSync(outPath).size;
    console.log(`✓ ${fileName}  (${model.orientation}, ${model.columns.length} kolom, ${(size / 1024).toFixed(1)} kB)`);
  }

  console.log(`\nSelesai. Berkas ada di ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main().catch((err) => {
  console.error('Gagal membuat contoh PDF:', err);
  process.exit(1);
});
