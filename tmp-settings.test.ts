/**
 * Stage 5.3 — Pengaturan sistem.
 *
 *  A. normalizeSettings tahan data rusak (Penjaga utama: Pengaturan rusak
 *     tidak boleh menjatuhkan aplikasi).
 *  B. Toggle baru (nama guru, DRAFT) benar-benar hardworking di model.
 *  C. Bukti bahwa DEFAULT_SETTINGS menghasilkan file Excel yang SAMA dengan
 *     hasil Stage 5.2 yang sudah disetujui user.
 *  D. Bukti bahwa Pengaturan yang diubah BENAR-BENAR mengubah file.
 */
import { expect, describe, it } from 'bun:test';
import {
  DEFAULT_SETTINGS,
  fromRow,
  normalizeSettings,
  toRow,
  withHash,
  stripHash,
} from './src/services/settings/appSettings';
import {
  buildScheduleExportModel,
  type ScheduleExportModel,
} from './src/services/export/scheduleExportModel';
import { buildScheduleWorkbook } from './src/services/export/scheduleExcelExport';
import type { ScheduleItem } from './src/types/schedule';
import type { ExcelSettings } from './src/services/settings/appSettings';

const results: string[] = [];
async function check(label: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push(`PASS  ${label}`);
  } catch (err) {
    results.push(`FAIL  ${label} :: ${(err as Error).message}`);
  }
}

// ── fixture jadwal ─────────────────────────────────────────────────────────
const teachers = [
  { id: 't-ikfina', nama_guru: 'Ikfina Khoirun Nisa, S.Pd.' },
  { id: 't-dian', nama_guru: 'Dian Kusumawati, S.Pd.' },
  { id: 't-abdulloh', nama_guru: 'Abdulloh, S.Pd.I' },
  { id: 't-nur', nama_guru: 'Nur Ajizah Romadi, S.Pd.' },
  { id: 't-ela', nama_guru: 'Ela Siti Nurlalela, S.Pd.' },
  { id: 't-siti', nama_guru: 'Siti Nur Arafah, S.Pd.' },
];
const idk = teachers.map((t) => t.id);

let seq = 0;
function sch(p: Partial<ScheduleItem>): ScheduleItem {
  seq += 1;
  return {
    id: `s${seq}`,
    academic_year_id: 'ay-2026',
    day: 'MONDAY',
    period_number: 1,
    start_time: '08:05',
    end_time: '08:40',
    kelas: '1A',
    subject_name: 'Matematika',
    teacher_id: 't-ikfina',
    teacher_name: 'Ikfina Khoirun Nisa, S.Pd.',
    status: 'ACTIVE',
    ...p,
  } as ScheduleItem;
}

function buildFixture(): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  const days: ScheduleItem['day'][] = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
  ];
  const periods: Array<[number, string, string]> = [
    [1, '07:15', '07:30'],
    [2, '07:30', '08:05'],
    [3, '08:05', '08:40'],
    [4, '08:40', '09:15'],
    [5, '09:35', '10:10'],
    [6, '10:10', '10:45'],
    [9, '13:05:00', '13:35:00'],
  ];
  days.forEach((day, di) => {
    out.push(sch({ day, period_number: 1, start_time: '07:15', end_time: '07:30', kelas: '1A', subject_name: di === 0 ? 'UPACARA' : 'DHUHA', teacher_id: null, teacher_name: '' }));
    periods.slice(1).forEach(([p, s, e], pi) => {
      for (let c = 0; c < 6; c += 1) {
        out.push(
          sch({
            day,
            period_number: p + 1,
            start_time: s,
            end_time: e,
            kelas: `${c + 1}A`,
            subject_name: c === 0 ? 'Matematika' : `Mapel ${di}${c}${pi}`,
            teacher_id: idk[(di + c) % teachers.length],
            teacher_name: teachers[(di + c) % teachers.length].nama_guru,
          }),
        );
      }
    });
    out.push(sch({ day, period_number: 8, start_time: '11:55', end_time: '12:30', kelas: '1A', subject_name: 'ISTIRAHAT', teacher_id: null, teacher_name: '' }));
    out.push(sch({ day, period_number: 8, start_time: '12:30', end_time: '13:05', kelas: '1A', subject_name: 'LAMA', teacher_id: idk[0], teacher_name: teachers[0].nama_guru, status: 'ARCHIVED' }));
  });
  out.push(sch({ day: 'FRIDAY', period_number: 10, start_time: '13:35', end_time: '14:10', kelas: '3A', subject_name: 'TKA', teacher_id: idk[1], teacher_name: teachers[1].nama_guru, status: 'DRAFT' }));
  return out;
}

const FIXTURE = buildFixture();

/** Label kelas pada fixture di atas, urut tingkat lalu rombel. */
const CLASS_OPTIONS = ['1A', '2A', '3A', '4A', '5A', '6A'];

function modelFor(overrides: Record<string, unknown> = {}): ScheduleExportModel {
  return buildScheduleExportModel({
    schedules: FIXTURE,
    academicYearName: '2026/2027',
    teachers,
    // Daftar kelas TIDAK lagi punya default hardcoded — pemanggil wajib
    // mengisinya, sama seperti `ScheduleManagement` mengisi dari ClassContext.
    classOptions: CLASS_OPTIONS,
    ...overrides,
  } as Parameters<typeof buildScheduleExportModel>[0]);
}

const ExcelJS = (await import('exceljs')).default;

async function writeAndRead(model: ScheduleExportModel, settings?: ExcelSettings) {
  const wb = await buildScheduleWorkbook(model, settings);
  const buf = await wb.xlsx.writeBuffer();
  const out = `${process.env.LOCALAPPDATA}\\Temp\\opencode\\settings-${Math.random().toString(36).slice(2)}.xlsx`;
  await Bun.write(out, buf as unknown as ArrayBuffer);
  const read = new ExcelJS.Workbook();
  await read.xlsx.readFile(out);
  return read;
}

// ══════════════════════════════════════════════════════════════════════════
describe('A. normalizeSettings tahan data rusak', () => {
  it(' assorted sampah tidak pernah menjatuhkan', () => {
    const junk: unknown[] = [
      null,
      undefined,
      'string',
      42,
      [],
      {},
      { excel: null },
      { excel: 'bukan objek' },
      { schoolName: '' },
      { schoolName: '   ' },
      { schoolName: 123 },
    ];
    for (const value of junk) {
      const s = normalizeSettings(value);
      expect(s.schoolName.length).toBeGreaterThan(0);
      expect(Number.isInteger(s.excel.baseFontSize)).toBe(true);
      expect(s.excel.headerColor).toMatch(/^[0-9A-F]{6}$/);
      expect(typeof s.excel.showBorders).toBe('boolean');
    }
  });

  it('enum di-whitelist', () => {
    expect(normalizeSettings({ excel: { orientation: 'diagonal' } }).excel.orientation).toBe(
      'landscape',
    );
    expect(
      normalizeSettings({ excel: { orientation: 'portrait' } }).excel.orientation,
    ).toBe('portrait');
    expect(
      normalizeSettings({ excel: { timeSeparator: 'slash' } }).excel.timeSeparator,
    ).toBe('en-dash');
  });

  it('angka di-clamp ke rentang CHECK database', () => {
    expect(normalizeSettings({ excel: { baseFontSize: 999 } }).excel.baseFontSize).toBe(24);
    expect(normalizeSettings({ excel: { baseFontSize: -5 } }).excel.baseFontSize).toBe(6);
    expect(normalizeSettings({ excel: { titleFontSize: 1 } }).excel.titleFontSize).toBe(10);
    expect(normalizeSettings({ excel: { baseFontSize: 'abc' } }).excel.baseFontSize).toBe(11);
  });

  it('warna cacat ditolak, # dan huruf kecil diterima', () => {
    const e = normalizeSettings({
      excel: {
        headerColor: '#ff0000',
        bandColor: 'ABCDEF',
        titleColor: 'xyz',
        borderColor: '12345',
      },
    }).excel;
    expect(e.headerColor).toBe('FF0000');
    expect(e.bandColor).toBe('ABCDEF');
    expect(e.titleColor).toBe(DEFAULT_SETTINGS.excel.titleColor); // ditolak
    expect(e.borderColor).toBe(DEFAULT_SETTINGS.excel.borderColor); // ditolak
  });

  it('nama sekolah dirapikan & dipotong 120 karakter', () => {
    expect(normalizeSettings({ schoolName: '  SDIT   AS-SYIFA  ' }).schoolName).toBe(
      'SDIT AS-SYIFA',
    );
    expect(normalizeSettings({ schoolName: 'x'.repeat(200) }).schoolName.length).toBe(120);
  });

  it('boolean longgar diterima (string dari form)', () => {
    const e = normalizeSettings({
      excel: { showBorders: 'false', showTeacherName: 'true' },
    }).excel;
    expect(e.showBorders).toBe(false);
    expect(e.showTeacherName).toBe(true);
  });

  it('round-trip snake_case -> camelCase tidak kehilangan field', () => {
    const custom = normalizeSettings({
      schoolName: 'MI AL-HIKAMAH',
      excel: { fontFamily: 'Arial', headerColor: 'AA0000', showBorders: false },
    });
    const back = fromRow(toRow(custom, 'Administrator'));
    expect(back).toEqual(custom);
  });

  it('fromRow dengan baris rusak tetap aman', () => {
    expect(fromRow(null).schoolName).toBe(DEFAULT_SETTINGS.schoolName);
    expect(fromRow({ excel_header_color: 'zz' }).excel.headerColor).toBe(
      DEFAULT_SETTINGS.excel.headerColor,
    );
  });

  it('withHash / stripHash bolak-balik', () => {
    expect(withHash('1F3864')).toBe('#1F3864');
    expect(stripHash('#1F3864')).toBe('1F3864');
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('B. toggle baru bekerja di model', () => {
  it('showTeacherName=false menghapus nama guru dari sheet & detail', () => {
    const withName = modelFor({ showTeacherName: true });
    const without = modelFor({ showTeacherName: false });
    expect(withName.weekly[0].rows[1].cells['1A']).toBe('Matematika\nIkfina');
    expect(without.weekly[0].rows[1].cells['1A']).toBe('Matematika');
    expect(without.detail[1].teacher).toBe('');
  });

  it('includeDraft=false mengecualikan DRAFT & melaporkannya', () => {
    const on = modelFor({ includeDraft: true });
    const off = modelFor({ includeDraft: false });
    expect(on.draftCount).toBe(1);
    expect(on.draftExcludedCount).toBe(0);
    expect(off.draftCount).toBe(0);
    expect(off.draftExcludedCount).toBe(1);
    expect(off.exportedCount).toBe(on.exportedCount - 1);
  });

  it('ARCHIVED tetap dikecualikan apa pun pengaturannya', () => {
    expect(modelFor({}).archivedCount).toBe(5);
    expect(modelFor({ includeDraft: false }).archivedCount).toBe(5);
  });

  it('schoolName masuk ke model', () => {
    expect(modelFor({ schoolName: 'MI AL-HIKAMAH' }).schoolName).toBe('MI AL-HIKAMAH');
    expect(modelFor({}).schoolName).toBe('SDIT AS-SYIFA');
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('C. default = file Stage 5.2 yang sudah disetujui', () => {
  it('struktur, isi, dan format tetap sama', async () => {
    const model = modelFor();
    const wb = await writeAndRead(model);
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    const val = (r: number, c: number) => {
      const v = ws.getCell(r, c).value;
      return v === null || v === undefined ? '' : String(v);
    };

    // nama sheet
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Jadwal Mingguan', 'Detail Jadwal']);
    // judul 3 baris
    expect(val(1, 1)).toBe('JADWAL PELAJARAN');
    expect(val(2, 1)).toBe('SDIT AS-SYIFA');
    expect(val(3, 1)).toBe('TAHUN PELAJARAN 2026/2027');
    // header
    expect([1, 2, 3, 4, 5, 6, 7].map((c) => val(6, c))).toEqual([
      'WAKTU',
      '1A',
      '2A',
      '3A',
      '4A',
      '5A',
      '6A',
    ]);
    // nama depan guru + wrap + vertical middle
    expect(val(9, 2)).toBe('Matematika\nIkfina');
    expect(ws.getCell(9, 2).alignment?.wrapText).toBe(true);
    expect(ws.getCell(9, 2).alignment?.vertical).toBe('middle');
    // cell kosong untuk kelas tanpa jadwal
    expect(val(8, 3)).toBe('');
    // TEST 4: slot 30 menit
    let found30 = false;
    ws.eachRow((row) => {
      const v = val(row.number, 1);
      if (v.includes('13:05')) {
        found30 = true;
        expect(v).toBe('13:05\u201313:35');
      }
    });
    expect(found30).toBe(true);
    // TEST 5: dua slot terpisah
    const times: number[] = [];
    ws.eachRow((row) => {
      const v = val(row.number, 1);
      if (v === '08:05\u201308:40' || v === '08:40\u201309:15') times.push(row.number);
    });
    expect(new Set(times).size).toBe(times.length);
    // merge hanya judul + band + footnote (10), tidak ada merge mapel
    const merges = Object.keys((ws as unknown as { _merges: Record<string, unknown> })._merges);
    expect(merges.length).toBe(10);
    expect(merges.every((m) => /^A\d+$/.test(m))).toBe(true);
    // font Bookman + ukuran sesuai default
    expect(ws.getCell(1, 1).font?.name).toBe('Bookman Old Style');
    expect(ws.getCell(1, 1).font?.size).toBe(20);
    expect(ws.getCell(9, 2).font?.size).toBe(11);
    // page setup
    expect(ws.pageSetup.orientation).toBe('landscape');
    expect(ws.pageSetup.fitToWidth).toBe(1);
    expect(String(ws.pageSetup.printTitlesRow)).toContain('1:6');
    // detail sheet
    const det = wb.getWorksheet('Detail Jadwal')!;
    const dh: string[] = [];
    for (let c = 1; c <= 8; c += 1) dh.push(String(det.getCell(1, c).value ?? ''));
    expect(dh).toEqual([
      'Hari',
      'Waktu Mulai',
      'Waktu Selesai',
      'JP',
      'Kelas',
      'Mata Pelajaran/Kegiatan',
      'Guru',
      'Tahun Ajaran',
    ]);
    expect(det.rowCount).toBe(model.exportedCount + 1);
    expect(String((det as unknown as { autoFilter: string }).autoFilter)).toBe(
      `A1:H${model.exportedCount + 1}`,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('D. Pengaturan yang diubah BENAR-BENAR mengubah file', () => {
  it('warna, font, orientasi, separator, nama sekolah', async () => {
    const custom: ExcelSettings = {
      ...DEFAULT_SETTINGS.excel,
      fontFamily: 'Arial',
      baseFontSize: 9,
      titleFontSize: 14,
      orientation: 'portrait',
      headerColor: 'AA0000',
      bandColor: '00AA00',
      titleColor: '0000AA',
      borderColor: 'FF00FF',
      timeSeparator: 'hyphen',
    };
    const model = modelFor({ schoolName: 'MI AL-HIKAMAH' });
    const wb = await writeAndRead(model, custom);
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    const val = (r: number, c: number) => {
      const v = ws.getCell(r, c).value;
      return v === null || v === undefined ? '' : String(v);
    };

    // nama sekolah masuk ke subjudul
    expect(val(2, 1)).toBe('MI AL-HIKAMAH');
    // font & ukuran
    expect(ws.getCell(1, 1).font?.name).toBe('Arial');
    expect(ws.getCell(1, 1).font?.size).toBe(14);
    expect(ws.getCell(9, 2).font?.size).toBe(9);
    // warna benar-benar terpakai (ARGB = FF + hex)
    const headerFill = ws.getCell(6, 1).fill as { fgColor?: { argb?: string } };
    expect(headerFill?.fgColor?.argb).toBe('FFAA0000');
    const bandFill = ws.getCell(7, 1).fill as { fgColor?: { argb?: string } };
    expect(bandFill?.fgColor?.argb).toBe('FF00AA00');
    const titleColor = ws.getCell(1, 1).font as { color?: { argb?: string } };
    expect(titleColor?.color?.argb).toBe('FF0000AA');
    const border = ws.getCell(9, 2).border as
      | { top?: { color?: { argb?: string } } }
      | undefined;
    expect(border?.top?.color?.argb).toBe('FFFF00FF');
    // orientasi
    expect(ws.pageSetup.orientation).toBe('portrait');
    // separator waktu
    let seen = false;
    ws.eachRow((row) => {
      if (val(row.number, 1).includes('13:05')) {
        seen = true;
        expect(val(row.number, 1)).toBe('13:05-13:35');
      }
    });
    expect(seen).toBe(true);
  });

  it('showBorders=false menghapus garis', async () => {
    const wb = await writeAndRead(modelFor(), {
      ...DEFAULT_SETTINGS.excel,
      showBorders: false,
    });
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    expect(ws.getCell(9, 2).border).toBeFalsy();
  });

  it('repeatHeader=false tidak写入 printTitlesRow & tidak beku', async () => {
    const wb = await writeAndRead(modelFor(), {
      ...DEFAULT_SETTINGS.excel,
      repeatHeader: false,
    });
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    expect(ws.pageSetup.printTitlesRow).toBeFalsy();
    const view = (ws.views as Array<{ state?: string }>)[0];
    expect(view.state).toBe('normal');
  });

  it('fitToWidth=false mematikan fit-to-width', async () => {
    const wb = await writeAndRead(modelFor(), {
      ...DEFAULT_SETTINGS.excel,
      fitToWidth: false,
    });
    expect(wb.getWorksheet('Jadwal Mingguan')!.pageSetup.fitToWidth).toBe(0);
  });

  it('showTeacherName=false benar-benar hilang di file', async () => {
    const wb = await writeAndRead(modelFor({ showTeacherName: false }));
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    const v = ws.getCell(9, 2).value;
    expect(String(v ?? '')).toBe('Matematika');
  });

  it('includeDraft=false mengurangi baris & menambah catatan kaki', async () => {
    const wb = await writeAndRead(modelFor({ includeDraft: false }));
    const ws = wb.getWorksheet('Jadwal Mingguan')!;
    let note = '';
    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string' && v.startsWith('Catatan:')) note += v + ' ';
    });
    expect(note).toContain('DRAFT dikecualikan');
  });
});

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
if (failed.length) process.exit(1);
