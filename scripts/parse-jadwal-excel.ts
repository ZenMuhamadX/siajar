/**
 * Pembaca "JADWAL PELAJARAN 2026-2027.xlsx" -> JSON siap dipakai build SQL.
 *
 * Versi berkas ini SUDAH BERSIH dari user: upacara, sholat dhuha, istirahat,
 * isoma, senam, pramuka sudah dihapus. Jadi semua yang tersisa = mata pelajaran.
 *
 * Struktur berkas (dipetakan dari mergeCell kolom A):
 *
 *   R1-R3   judul
 *   R5      header: WAKTU | KELAS 1..KELAS 6   (kolom B..H)
 *   R7-R16  SENIN     (A7:A16)
 *   R17     header ulang
 *   R18-R27 SELASA    (A18:A27)
 *   R28     header ulang
 *   R29-R38 RABU      (A29:A38)
 *   R39     header ulang
 *   R40-R49 KAMIS     (A40:A49)
 *   R50     header ulang
 *   R51-R54 JUMAT     (A51:A54)   <- lebih pendek
 *
 * Satu jam (35 menit) biasanya dipakai 2 baris. Kalau isinya beda, itu
 * benar-benar 2 pelajaran berbeda, jadi keduanya harus ikut masuk.
 *
 * Blok hari TIDAK di-hardcode per nomor baris: dibaca dari mergeCell kolom A
 * supaya tahan terhadap perubahan jumlah baris.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = process.argv[2] ?? '.tmp-jadwal';
const OUT = process.argv[3] ?? 'jadwal-parsed.json';

// Berkas .xlsx sudah diekstrak lebih dulu (arsip ZIP) ke DIR:
//   python -c "import zipfile; zipfile.ZipFile(src).extractall('.tmp-jadwal')"
// Dibaca langsung dari XML karena pustaka `xlsx` salah membaca berkas ini.
const read = (p: string) => readFileSync(join(DIR, p), 'utf8');

// ---- shared strings ----
const ssXml = read('xl/sharedStrings.xml');
const strings: string[] = [];
for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  let txt = '';
  for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) txt += t[1];
  strings.push(
    txt
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function colToNum(c: string): number {
  let n = 0;
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

const sheetXml = read('xl/worksheets/sheet1.xml');

const grid: Record<number, Record<number, string>> = {};
for (const rowM of sheetXml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const r = +rowM[1];
  grid[r] = {};
  // Sel kosong (<c .../>) dan sel berisi (<c ...>isi</c>) dicocokkan
  // terpisah — pola gabungan membuat sel kosong "memakan" sel berikutnya
  // sehingga seluruh kolom bergeser satu.
  for (const cM of rowM[2].matchAll(
    /<c r="([A-Z]+)\d+"[^>]*\/>|<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g,
  )) {
    if (cM[1]) continue; // sel kosong
    const col = colToNum(cM[2]);
    const attrs = cM[3] ?? '';
    const inner = cM[4] ?? '';
    const v = (inner.match(/<v>([\s\S]*?)<\/v>/) ?? [])[1];
    if (v === undefined) continue;
    const t = (attrs.match(/t="([^"]+)"/) ?? [])[1];
    grid[r][col] = t === 's' ? (strings[+v] ?? '') : v;
  }
}

// ---- blok hari dari mergeCell kolom A ----
const blocks: { from: number; to: number }[] = [];
for (const m of sheetXml.matchAll(/<mergeCell ref="A(\d+):A(\d+)"/g)) {
  blocks.push({ from: +m[1], to: +m[2] });
}
blocks.sort((a, b) => a.from - b.from);

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
if (blocks.length !== DAYS.length) {
  throw new Error(
    `Harap ${DAYS.length} blok hari, ketemu ${blocks.length}. ` +
      `Struktur berkas berubah — periksa parser. Blok: ${JSON.stringify(blocks)}`,
  );
}

const CLASS_COLS = [
  { col: 3, tingkat: 1 },
  { col: 4, tingkat: 2 },
  { col: 5, tingkat: 3 },
  { col: 6, tingkat: 4 },
  { col: 7, tingkat: 5 },
  { col: 8, tingkat: 6 },
];

function clean(s: string): string {
  return s.replace(/\u000b/g, '').replace(/\s+/g, ' ').trim();
}

/** "08.05-08.40" -> { start:'08:05:00', end:'08:40:00' } ; null kalau bukan jam */
function parseJam(s: string): { start: string; end: string } | null {
  const m = /^(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})$/.exec(clean(s));
  if (!m) return null;
  const p = (h: string, mi: string) => `${h.padStart(2, '0')}:${mi}:00`;
  return { start: p(m[1], m[2]), end: p(m[3], m[4]) };
}

const entries: {
  day: string;
  tingkat: number;
  jamKe: number;
  start: string;
  end: string;
  mapel: string;
}[] = [];

/** jam -> {start,end}; nomor jam = urutan kemunculan slot, bukan nomor baris */
const jamDef = new Map<number, { start: string; end: string }>();

for (let bi = 0; bi < blocks.length; bi++) {
  const day = DAYS[bi];
  const b = blocks[bi];

  /** jamKe -> (kolom -> daftar mapel pada jam itu) */
  const perJam = new Map<number, Map<number, string[]>>();

  for (let r = b.from; r <= b.to; r++) {
    const row = grid[r];
    if (!row) continue;
    const jamLabel = clean(row[2] ?? '');
    if (!jamLabel) continue;

    const jam = parseJam(jamLabel);
    if (!jam) {
      throw new Error(
        `${day} baris ${r}: kolom B berisi "${jamLabel}" yang bukan label jam. ` +
          `Struktur berkas berubah — periksa parser.`,
      );
    }

    // nomor jam ditentukan slot waktunya, bukan nomor baris Excel
    let jamKe: number | undefined;
    for (const [k, v] of jamDef) {
      if (v.start === jam.start && v.end === jam.end) {
        jamKe = k;
        break;
      }
    }
    if (jamKe === undefined) {
      jamKe = jamDef.size + 1;
      jamDef.set(jamKe, jam);
    }

    if (!perJam.has(jamKe)) perJam.set(jamKe, new Map());
    const slot = perJam.get(jamKe)!;

    for (const { col, tingkat } of CLASS_COLS) {
      const raw = clean(row[col] ?? '').toUpperCase();
      if (!raw) continue;
      if (!slot.has(col)) slot.set(col, []);
      slot.get(col)!.push(raw);
    }
  }

  for (const [jamKe, slot] of [...perJam.entries()].sort((a, b) => a[0] - b[0])) {
    const jam = jamDef.get(jamKe)!;
    for (const { col, tingkat } of CLASS_COLS) {
      const list = slot.get(col);
      if (!list) continue;
      // buang duplikat berurutan (baris ke-2 jam yang sama mengulang mapel sama)
      for (const mapel of [...new Set(list)]) {
        entries.push({ day, tingkat, jamKe, start: jam.start, end: jam.end, mapel });
      }
    }
  }
}

// ---- normalisasi nama mapel ke bentuk kanonik ----
const MAPEL_ALIASES: Record<string, string> = {
  'B. INDO': 'B. INDONESIA',
  'B.INDO': 'B. INDONESIA',
  'B. SUNDA': 'B. SUNDA',
  'B.SUNDA': 'B. SUNDA',
  'B. INGGRIS': 'B. INGGRIS',
  'B.INGGRIS': 'B. INGGRIS',
  'B. ARAB': 'B. ARAB',
  'B.ARAB': 'B. ARAB',
  MTK: 'MATEMATIKA',
};
for (const e of entries) e.mapel = MAPEL_ALIASES[e.mapel] ?? e.mapel;

entries.sort(
  (a, b) =>
    DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
    a.jamKe - b.jamKe ||
    a.tingkat - b.tingkat ||
    a.mapel.localeCompare(b.mapel),
);

// ---- ringkasan ----
const mapelSet = [...new Set(entries.map((e) => e.mapel))].sort();
const perTingkat = new Map<number, Set<number>>();
for (const e of entries) {
  if (!perTingkat.has(e.tingkat)) perTingkat.set(e.tingkat, new Set());
  perTingkat.get(e.tingkat)!.add(e.jamKe);
}
const totalPerKelas = new Map<number, number>();
for (const e of entries) totalPerKelas.set(e.tingkat, (totalPerKelas.get(e.tingkat) ?? 0) + 1);
const totalPerHari = new Map<string, number>();
for (const e of entries) totalPerHari.set(e.day, (totalPerHari.get(e.day) ?? 0) + 1);

console.log('=========================================');
console.log('  HASIL PARSE (berkas versi bersih)');
console.log('=========================================');
console.log(`Total pelajaran  : ${entries.length}`);
console.log(`Jumlah mapel     : ${mapelSet.length}`);
console.log(`  ${mapelSet.join(', ')}`);
console.log('');
console.log('Definisi jam / JP:');
for (const [k, v] of [...jamDef.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  JP ${String(k).padStart(2)} = ${v.start.slice(0, 5)}-${v.end.slice(0, 5)}`);
}
console.log('');
console.log('Jumlah pelajaran per kelas:');
for (const [t, jam] of [...perTingkat.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  Kelas ${t}A : ${totalPerKelas.get(t)} pelajaran / ${jam.size} jam`);
}
console.log('');
console.log('Jumlah per hari:');
for (const d of DAYS) console.log(`  ${d.padEnd(10)}: ${totalPerHari.get(d) ?? 0}`);

writeFileSync(
  OUT,
  JSON.stringify(
    {
      jamDef: [...jamDef.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([jamKe, v]) => ({ jamKe, ...v })),
      mapel: mapelSet,
      entries,
    },
    null,
    2,
  ),
);
console.log(`\nDitulis: ${OUT}`);
