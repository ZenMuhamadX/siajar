/**
 * Stage 8 — Warna mata pelajaran pada export Excel.
 *
 *  A. Palet murni: normalisasi, determinisme, keunikan, dan warna teks kontras.
 *  B. Model: warna benar-benar menempel pada sel yang tepat, termasuk
 *     kegiatan non-mapel dan data lama tanpa subject_id.
 *  C. File Excel sungguhan: fill benar-benar tertulis, dan sel kosong
 *     tetap tanpa latar.
 */
import { expect, describe, it } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SUBJECT_PALETTE,
  buildSubjectFillResolver,
  contrastTextColor,
  hashSeed,
  normalizeOptionalColor,
  paletteColorFor,
  resolveSubjectFill,
} from './src/services/export/subjectPalette';
import { buildScheduleExportModel } from './src/services/export/scheduleExportModel';
import { buildScheduleWorkbook } from './src/services/export/scheduleExcelExport';
import type { ScheduleItem } from './src/types/schedule';
import type { MataPelajaran } from './src/types';

// ── fixture ────────────────────────────────────────────────────────────────

const subjects: MataPelajaran[] = [
  { id: 'm-mat', nama_mapel: 'Matematika', warna: 'FBDDDD' },
  { id: 'm-ipa', nama_mapel: 'IPA' }, // tanpa warna -> palet otomatis
  { id: 'm-dark', nama_mapel: 'Bina Bicara', warna: '1F3864' }, // gelap -> teks putih
];

function sch(p: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 's-1',
    academic_year_id: 'ay-1',
    day: 'MONDAY',
    period_number: 1,
    start_time: '07:00',
    end_time: '07:35',
    class_id: 'KELAS 1',
    subject_id: null,
    subject_name: 'Matematika',
    teacher_id: null,
    teacher_name: '',
    status: 'ACTIVE',
    ...p,
  } as ScheduleItem;
}

// Semua slot memakai jam yang sama, jadi runtuh menjadi SATU baris berisi
// empat sel kelas — enak untuk memeriksa per-sel.
const FIXTURE: ScheduleItem[] = [
  sch({ id: 's-1', class_id: 'KELAS 1', subject_id: 'm-mat', subject_name: 'Matematika' }),
  sch({ id: 's-2', class_id: 'KELAS 2', subject_id: 'm-ipa', subject_name: 'IPA' }),
  sch({ id: 's-3', class_id: 'KELAS 3', subject_id: null, subject_name: 'UPACARA' }),
  // Data lama: subject_id null, tetapi namanya cocok dengan master.
  sch({ id: 's-4', class_id: 'KELAS 4', subject_id: null, subject_name: 'Matematika' }),
];

function model() {
  return buildScheduleExportModel({
    schedules: FIXTURE,
    academicYearName: '2026/2027',
    subjects,
  });
}

// ══════════════════════════════════════════════════════════════════════════
describe('A. palet warna mapel', () => {
  it('normalizeOptionalColor menerima hex valid & menolak sisanya', () => {
    expect(normalizeOptionalColor('#fbdddd')).toBe('FBDDDD');
    expect(normalizeOptionalColor(' 1F3864 ')).toBe('1F3864');
    expect(normalizeOptionalColor('')).toBe('');
    expect(normalizeOptionalColor(null)).toBe('');
    expect(normalizeOptionalColor(undefined)).toBe('');
    expect(normalizeOptionalColor('ZZZZZZ')).toBe('');
    expect(normalizeOptionalColor('ABC')).toBe('');
    expect(normalizeOptionalColor(123)).toBe('');
  });

  it('seluruh isi palet adalah 6 digit hex unik yang valid', () => {
    for (const c of SUBJECT_PALETTE) expect(normalizeOptionalColor(c)).toBe(c);
    expect(new Set(SUBJECT_PALETTE).size).toBe(SUBJECT_PALETTE.length);
    expect(SUBJECT_PALETTE.length).toBeGreaterThanOrEqual(12);
  });

  it('semua warna palet cukup terang untuk teks hitam (aman dicetak)', () => {
    for (const c of SUBJECT_PALETTE) {
      expect(contrastTextColor(c)).toBe('000000');
    }
  });

  it('hashSeed & paletteColorFor deterministik dan tidak peduli besar-kecil huruf', () => {
    expect(hashSeed('m-mat')).toBe(hashSeed('m-mat'));
    expect(paletteColorFor('Matematika')).toBe(paletteColorFor('matematika'));
    expect(paletteColorFor('Matematika')).toBe(paletteColorFor(' Matematika '));
  });

  it('resolveSubjectFill: warna pengguna selalu menang', () => {
    expect(resolveSubjectFill({ id: 'm-mat', override: 'ABCDEF' })).toBe('ABCDEF');
    // override rusak diabaikan -> jatuh ke palet, bukan ke warna default acak
    expect(resolveSubjectFill({ id: 'm-mat', override: 'rusak' })).toBe(paletteColorFor('m-mat'));
  });

  it('resolveSubjectFill tidak pernah mengembalikan warna kosong', () => {
    expect(resolveSubjectFill({ id: 'x' })).toBe(paletteColorFor('x'));
    expect(resolveSubjectFill({ name: 'UPACARA' })).toBe(paletteColorFor('UPACARA'));
    expect(resolveSubjectFill({})).toBe(SUBJECT_PALETTE[0]);
  });

  it('contrastTextColor: terang -> hitam, gelap -> putih', () => {
    expect(contrastTextColor('FBDDDD')).toBe('000000');
    expect(contrastTextColor('FFFFFF')).toBe('000000');
    expect(contrastTextColor('1F3864')).toBe('FFFFFF');
    expect(contrastTextColor('000000')).toBe('FFFFFF');
    // warna rusak tetap aman
    expect(contrastTextColor('bukan-hex')).toBe('000000');
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('B. penugasan warna otomatis', () => {
  const names = [
    'Matematika',
    'Bahasa Indonesia',
    'PAI',
    'IPA',
    'IPS',
    'PPKn',
    'Bahasa Inggris',
    'PJOK',
    'SBdP',
    'Bahasa Arab',
    'Pramuka',
    'Upacara',
  ];
  const many: MataPelajaran[] = names.map((n, i) => ({ id: `m-${i}`, nama_mapel: n }));

  it('12 mapel tanpa warna manual mendapat 12 warna BERBEDA (inti permintaan)', () => {
    const resolve = buildSubjectFillResolver(many);
    const colors = many.map((m) => resolve(m.id, m.nama_mapel));
    expect(new Set(colors).size).toBe(many.length);
    for (const c of colors) expect(SUBJECT_PALETTE).toContain(c);
  });

  it('hasilnya deterministik: urutan daftar tidak mengubah warna', () => {
    const a = buildSubjectFillResolver(many);
    const b = buildSubjectFillResolver([...many].reverse());
    for (const m of many) expect(a(m.id, m.nama_mapel)).toBe(b(m.id, m.nama_mapel));
  });

  it('palet otomatis menghindari warna yang sudah dipakai manual', () => {
    const list: MataPelajaran[] = [
      { id: 'a', nama_mapel: 'A', warna: 'F7C1C1' },
      { id: 'b', nama_mapel: 'B' },
    ];
    const resolve = buildSubjectFillResolver(list);
    expect(resolve('a', 'A')).toBe('F7C1C1');
    expect(resolve('b', 'B')).not.toBe('F7C1C1');
  });

  it('kegiatan di luar master mapel tetap dapat warna', () => {
    const resolve = buildSubjectFillResolver([]);
    expect(resolve(null, 'UPACARA')).toMatch(/^[0-9A-F]{6}$/);
    expect(resolve(null, 'ISTIRAHAT')).toMatch(/^[0-9A-F]{6}$/);
  });

  it('mapel lebih banyak daripada palet: tetap mengembalikan warna valid', () => {
    const overflow: MataPelajaran[] = Array.from({ length: 30 }, (_, i) => ({
      id: `x-${i}`,
      nama_mapel: `Mapel ${i}`,
    }));
    const resolve = buildSubjectFillResolver(overflow);
    for (const m of overflow) expect(SUBJECT_PALETTE).toContain(resolve(m.id, m.nama_mapel));
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('C. model menempelkan warna ke sel yang tepat', () => {
  const row = model().weekly[0].rows[0];

  it('satu baris memuat empat sel kelas', () => {
    expect(Object.keys(row.cells).sort()).toEqual(['KELAS 1', 'KELAS 2', 'KELAS 3', 'KELAS 4']);
  });

  it('mapel berwarna manual memakai warna itu', () => {
    expect(row.cellStyles['KELAS 1']).toEqual({ fill: 'FBDDDD', textColor: '000000' });
  });

  it('mapel tanpa warna dapat palet otomatis, bukan polos', () => {
    expect(SUBJECT_PALETTE).toContain(row.cellStyles['KELAS 2'].fill);
    expect(row.cellStyles['KELAS 2'].fill).not.toBe(row.cellStyles['KELAS 1'].fill);
  });

  it('kegiatan non-mapel tetap dapat warna', () => {
    expect(row.cellStyles['KELAS 3'].fill).toMatch(/^[0-9A-F]{6}$/);
  });

  it('data lama tanpa subject_id cocok lewat nama master', () => {
    expect(row.cellStyles['KELAS 4'].fill).toBe('FBDDDD');
  });

  it('sel tanpa jadwal tidak punya gaya', () => {
    expect(row.cellStyles['KELAS 5']).toBeUndefined();
  });

  it('warna master gelap menghasilkan teks putih', () => {
    const m = buildScheduleExportModel({
      schedules: [sch({ class_id: 'KELAS 1', subject_id: 'm-dark', subject_name: 'Bina Bicara' })],
      academicYearName: '2026/2027',
      subjects,
    });
    expect(m.weekly[0].rows[0].cellStyles['KELAS 1']).toEqual({
      fill: '1F3864',
      textColor: 'FFFFFF',
    });
  });

  it('tanpa master mapel pun tetap berwarna (palet bawaan)', () => {
    const m = buildScheduleExportModel({
      schedules: [sch({ class_id: 'KELAS 1', subject_name: 'Matematika' })],
      academicYearName: '2026/2027',
    });
    expect(m.weekly[0].rows[0].cellStyles['KELAS 1'].fill).toMatch(/^[0-9A-F]{6}$/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('D. file Excel sungguhan', () => {
  async function writeAndRead() {
    const ExcelJS = (await import('exceljs')).default;
    const wb = await buildScheduleWorkbook(model());
    const buf = await wb.xlsx.writeBuffer();
    const out = join(tmpdir(), `mapel-warna-${Math.random().toString(36).slice(2)}.xlsx`);
    await Bun.write(out, buf as unknown as ArrayBuffer);
    const read = new ExcelJS.Workbook();
    await read.xlsx.readFile(out);
    return read;
  }

  it('sel mapel berwarna manual benar-benar terisi warna', async () => {
    const wb = await writeAndRead();
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    // baris 8 = baris jadwal pertama (judul 1-3, spasi 4-5, header 6, band hari 7)
    expect(ws.getCell(8, 2).fill?.fgColor?.argb).toBe('FFFBDDDD');
    expect(ws.getCell(8, 2).value).toBe('Matematika');
  });

  it('sel mapel tanpa warna manual tetap terisi warna palet', async () => {
    const wb = await writeAndRead();
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    expect(ws.getCell(8, 3).fill?.fgColor?.argb).toMatch(/^FF[0-9A-F]{6}$/);
  });

  it('sel tanpa jadwal tetap kosong tanpa latar', async () => {
    const wb = await writeAndRead();
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    expect(ws.getCell(8, 6).value ?? '').toBe('');
    expect(ws.getCell(8, 6).fill?.fgColor?.argb).toBeUndefined();
  });
});
