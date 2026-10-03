import assert from 'node:assert';
import {
  createPrintModel,
  assertNoImages,
  cellText,
  type PrintReportModel,
} from './src/services/report/printReportModel';
import {
  buildReportDocDefinition,
  PAGE_CONTENT_WIDTH,
  reportPdfFileName,
  resolveColumnWidths,
} from './src/services/export/reportPdfExport';
import { formatDateMedium } from './src/utils/date';

/**
 * Verifikasi model cetak & penulis PDF rekap (harian, mingguan, bulanan, jurnal).
 *
 * Fokusnya BUKAN "apakah PDF-nya rapi" (itu diperiksa dengan mata pada dokumen),
 * melainkan tiga hal yang mudah rusak diam-diam:
 *   1. lebar kolom benar-benar mengisi area cetak sesuai orientasi,
 *   2. nama berkas konsisten antar jenis laporan,
 *   3. tidak ada nilai mirip URL/gambar yang bisa lolos ke dokumen.
 *
 * Jalankan: bun test_report_pdf_model.ts
 */

console.log('--- Verifikasi model cetak & penulis PDF rekap ---');

// Lebar area cetak diambil dari modul produksi, bukan dihitung ulang di sini —
// supaya uji ini tidak bisa "setuju" dengan angka yang salah.
const A4_PORTRAIT_CONTENT = PAGE_CONTENT_WIDTH.portrait;
const A4_LANDSCAPE_CONTENT = PAGE_CONTENT_WIDTH.landscape;

// Test 1: formatDateMedium — periode dokumen tanpa nama hari.
{
  assert.strictEqual(
    formatDateMedium('2026-10-01'),
    '1 Oktober 2026',
    'Periode harian harus "1 Oktober 2026" (tanpa nama hari)',
  );
  console.log('✓ Test 1: formatDateMedium');
}

// Test 2: lebar kolom harian (portrait, 7 kolom) mengisi penuh area cetak.
{
  const model: PrintReportModel = {
    documentKind: 'harian',
    orientation: 'portrait',
    title: 'Laporan Rekap Pembelajaran Harian',
    periodInfo: '1 Oktober 2026',
    fileLabel: '2026-10-01',
    columns: [
      { key: 'no', header: 'No', ptWidth: 20 },
      { key: 'waktu', header: 'Waktu', ptWidth: 60 },
      { key: 'kelas', header: 'Kelas', ptWidth: 40 },
      { key: 'mapel', header: 'Mata Pelajaran' },
      { key: 'guruTerjadwal', header: 'Guru Terjadwal', ptWidth: 86 },
      { key: 'guruAktual', header: 'Guru Aktual', ptWidth: 86 },
      { key: 'status', header: 'Status', ptWidth: 52 },
    ],
    rows: [],
    emptyMessage: '-',
  };

  const widths = resolveColumnWidths(model);
  assert.strictEqual(widths.length, 7, 'Harian harus 7 kolom (tanpa kolom Dokumentasi)');
  assert.ok(
    !model.columns.some((c) => c.key === 'dokumentasi'),
    'Dokumen harian tidak boleh memuat kolom Dokumentasi',
  );
  assert.strictEqual(widths[3], '*', 'Kolom Mata Pelajaran menyerap sisa lebar');

  const fixedSum = widths.reduce<number>((s, w) => s + (typeof w === 'number' ? w : 0), 0);
  const growCount = widths.filter((w) => w === '*').length;
  assert.ok(
    fixedSum + growCount * 48 <= A4_PORTRAIT_CONTENT,
    `Lebar harian (${fixedSum}) harus menyisakan ruang untuk kolom fleksibel`,
  );
  console.log(`✓ Test 2: lebar harian portrait (tetap ${fixedSum}pt + 1 kolom fleksibel)`);
}

// Test 3: lebar kolom mingguan & bulanan (landscape, 10 kolom) identik.
{
  const columns = (kind: 'mingguan' | 'bulanan'): PrintReportModel => ({
    documentKind: kind,
    orientation: 'landscape',
    title: `Laporan ${kind}`,
    periodInfo: '-',
    fileLabel: '-',
    columns: [
      { key: 'no', header: 'No', ptWidth: 22 },
      { key: 'guru', header: 'Nama Guru' },
      { key: 'jpTerjadwal', header: 'JP Terjadwal', ptWidth: 54 },
      { key: 'jpRealisasi', header: 'JP Realisasi', ptWidth: 54 },
      { key: 'durasiTerjadwal', header: 'Durasi Terjadwal', ptWidth: 68 },
      { key: 'durasiRealisasi', header: 'Durasi Realisasi', ptWidth: 68 },
      { key: 'badalMasuk', header: 'Badal Masuk', ptWidth: 50 },
      { key: 'badalKeluar', header: 'Badal Keluar', ptWidth: 50 },
      { key: 'belumRealisasi', header: 'Belum Realisasi', ptWidth: 58 },
      { key: 'capaian', header: 'Capaian %', ptWidth: 52 },
    ],
    rows: [],
    emptyMessage: '-',
  });

  const mingguan = resolveColumnWidths(columns('mingguan'));
  const bulanan = resolveColumnWidths(columns('bulanan'));

  assert.strictEqual(mingguan.length, 10, 'Mingguan harus 10 kolom');
  assert.deepStrictEqual(
    mingguan,
    bulanan,
    'Tata letak mingguan & bulanan wajib identik (persyaratan keseragaman)',
  );
  assert.strictEqual(mingguan[1], '*', 'Nama Guru menyerap sisa lebar');

  const fixedSum = mingguan.reduce<number>((s, w) => s + (typeof w === 'number' ? w : 0), 0);
  assert.ok(
    fixedSum + 48 <= A4_LANDSCAPE_CONTENT,
    `Lebar mingguan (${fixedSum}) harus muat di A4 landscape`,
  );
  console.log(`✓ Test 3: lebar mingguan = bulanan (tetap ${fixedSum}pt + 1 kolom fleksibel)`);
}

// Test 4: lebar yang kelewat besar diskalakan, tidak meluber keluar halaman.
{
  const model: PrintReportModel = {
    documentKind: 'jurnal',
    orientation: 'portrait',
    title: '-',
    periodInfo: '-',
    fileLabel: '-',
    columns: [
      { key: 'a', header: 'A', ptWidth: 500 },
      { key: 'b', header: 'B', ptWidth: 500 },
      { key: 'c', header: 'C', ptWidth: 500 },
    ],
    rows: [],
    emptyMessage: '-',
  };

  const widths = resolveColumnWidths(model).map((w) => (typeof w === 'number' ? w : 0));
  const total = widths.reduce((s, w) => s + w, 0);
  assert.ok(
    total <= A4_PORTRAIT_CONTENT,
    `Lebar total ${total} harus diskalakan agar tidak melebihi ${A4_PORTRAIT_CONTENT}pt`,
  );
  console.log(`✓ Test 4: lebar berlebih diskalakan (total ${total}pt)`);
}

// Test 5: nama berkas konsisten antar jenis laporan.
{
  const name = (documentKind: PrintReportModel['documentKind'], fileLabel: string) =>
    reportPdfFileName({
      documentKind,
      orientation: 'portrait',
      title: '-',
      periodInfo: '-',
      fileLabel,
      columns: [],
      rows: [],
      emptyMessage: '-',
    });

  assert.strictEqual(name('harian', '2026-10-01'), 'Rekap_Harian_2026-10-01.pdf');
  assert.strictEqual(
    name('mingguan', '2026-09-28_sd_2026-10-04'),
    'Rekap_Mingguan_2026-09-28-sd-2026-10-04.pdf',
  );
  assert.strictEqual(name('bulanan', '2026-10'), 'Rekap_Bulanan_2026-10.pdf');
  assert.strictEqual(name('jurnal', '2026-10-01'), 'Jurnal_Agenda_2026-10-01.pdf');
  console.log('✓ Test 5: penamaan berkas keempat jenis laporan');
}

// Test 6: penjaga foto — kebocoran lewat baris, total, DAN strip ringkasan.
{
  const base: PrintReportModel = {
    documentKind: 'harian',
    orientation: 'portrait',
    title: '-',
    periodInfo: '-',
    fileLabel: '-',
    columns: [{ key: 'a', header: 'A' }],
    rows: [],
    emptyMessage: '-',
  };

  assert.throws(
    () => assertNoImages({ ...base, rows: [{ a: 'https://x/y.jpg' }] }),
    /terlarang/,
    'URL pada baris harus ditolak',
  );
  assert.throws(
    () => assertNoImages({ ...base, totalsRow: { a: 'storage_path: x' } }),
    /terlarang/,
    'storage_path pada baris total harus ditolak',
  );
  assert.throws(
    () => assertNoImages({ ...base, summary: [{ label: 'Foto', value: 'signed-url' }] }),
    /terlarang/,
    'nilai bertanda tangan pada strip ringkasan harus ditolak',
  );
  console.log('✓ Test 6: penjaga foto mencakup baris, total, dan ringkasan');
}

// Test 7: dokumen sah diterima, dan sel kosong tidak pernah mencetak "null".
{
  const model = createPrintModel({
    documentKind: 'mingguan',
    orientation: 'landscape',
    title: 'Laporan Rekapitulasi Pembelajaran Mingguan',
    periodInfo: '28 September 2026 s.d. 4 Oktober 2026',
    academicYearName: '2026/2027',
    fileLabel: '2026-09-28_sd_2026-10-04',
    columns: [{ key: 'guru', header: 'Nama Guru' }],
    rows: [{ guru: 'Abdulloh, S.Pd., Gr.' }],
    summary: [{ label: 'Capaian', value: '90%' }],
    emptyMessage: 'Tidak ada data pembelajaran pada periode minggu ini.',
  });

  assert.strictEqual(model.rows.length, 1);
  assert.strictEqual(cellText(null), '-', 'null harus menjadi "-"');
  assert.strictEqual(cellText('  '), '-', 'string kosong harus menjadi "-"');
  assert.strictEqual(cellText(0), '0', 'angka 0 harus tetap tercetak sebagai 0');
  console.log('✓ Test 7: dokumen sah & format sel aman');
}

// Test 8: garis kop harus sepanjang area cetak — di KEDUA orientasi.
//
// Regresi yang dijaga: nilai `x2` pernah di-hardcode 515pt (warisan penulis PDF
// Log Jurnal yang dulu hanya landscape), sehingga garis kop terpotong ~32pt pada
// portrait dan ~278pt pada landscape.
{
  const withOrientation = (orientation: 'portrait' | 'landscape'): PrintReportModel => ({
    documentKind: 'harian',
    orientation,
    title: '-',
    periodInfo: '-',
    fileLabel: '-',
    columns: [{ key: 'a', header: 'A' }],
    rows: [],
    emptyMessage: '-',
  });

  const ruleWidth = (orientation: 'portrait' | 'landscape'): number => {
    const doc = buildReportDocDefinition(withOrientation(orientation), {
      schoolName: 'Sekolah Uji',
      dateLabel: '1 Oktober 2026',
    }) as { content: Array<{ canvas?: Array<{ type: string; x2: number }> }> };

    const rule = doc.content.find((node) => Array.isArray(node.canvas));
    assert.ok(rule, 'Kop harus punya garis pemisah berbentuk kanvas');
    return rule.canvas![0].x2;
  };

  // Toleransi 1pt: garis kotak tabel menempati 0,5pt di tepinya, jadi garis kop
  // boleh sedikit lebih pendek — yang penting tidak lagi berhenti jauh di tengah.
  const withinContentArea = (actual: number, expected: number, label: string) => {
    assert.ok(
      actual >= expected - 1 && actual <= expected,
      `${label}: garis kop ${actual.toFixed(2)}pt harus mengisi area cetak ${expected.toFixed(2)}pt`,
    );
  };

  withinContentArea(ruleWidth('portrait'), A4_PORTRAIT_CONTENT, 'Portrait');
  withinContentArea(ruleWidth('landscape'), A4_LANDSCAPE_CONTENT, 'Landscape');
  console.log('✓ Test 8: garis kop mengisi area cetak di portrait & landscape');
}

console.log('--- Semua verifikasi lulus ---');
