/**
 * Seed data uji agenda — KHUSUS database pengembangan.
 *
 * Jalankan dari root repo:
 *   bun scripts/seed-demo-data.ts                 # isi data uji (10 hari kerja terakhir)
 *   bun scripts/seed-demo-data.ts --days=14       # rentang lebih panjang
 *   bun scripts/seed-demo-data.ts --reset         # hapus data uji (butuh --yes)
 *   bun scripts/seed-demo-data.ts --force         # tambahkan walau data sudah ada
 *
 * Isi data uji:
 *   - siswa dummy (prefix "Uji ") bila tabel siswa masih kosong
 *   - agenda untuk ±70–78% slot pada 10 hari kerja terakhir, sisanya sengaja
 *     kosong supaya status "Belum Diisi" ikut teruji
 *   - beberapa kasus badal (substitutions + actual_teacher_name + kbm.is_badal)
 *   - 2 agenda tanpa schedule_id ("di luar jadwal")
 *   - absensi dengan status S/I/A acak agar statistik Kehadiran teruji
 *
 * TIDAK membuat agenda_evidence: foto butuh upload ke bucket Supabase Storage,
 * sehingga kolom "Dokumentasi" sengaja dibiarkan kosong.
 *
 * Menghapus: agenda_evidence, agenda_absensi, agenda_kbm, agenda_kejadian,
 * agenda_header, substitutions, dan siswa berawalan "Uji ".
 * Master data (guru, mapel, schedule, academic_year) tidak pernah disentuh.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Env (bun sudah memuat .env, tapi tetap dibaca manual agar skrip bisa dijalankan
// dari direktori mana pun).
// ---------------------------------------------------------------------------
const ROOT = join(import.meta.dir, '..');
const envFile = join(ROOT, '.env');
const env: Record<string, string> = {};
if (existsSync(envFile)) {
  for (const line of (await Bun.file(envFile).text()).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
}
Object.assign(process.env, { ...env, ...process.env });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tidak ada');
const SCHEMA = 'agenda';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const num = (f: string, def: number) => {
  const a = args.find((x) => x.startsWith(`--${f}=`));
  return a ? Number(a.split('=')[1]) : def;
};
const DAYS = Math.max(1, Math.min(60, num('days', 10)));
const DO_RESET = has('--reset');
const FORCE = has('--force');
const ASSUME_YES = has('--yes');

const SISWA_PER_KELAS = 20;
const KELAS = ['KELAS 1', 'KELAS 2', 'KELAS 3', 'KELAS 4', 'KELAS 5', 'KELAS 6'];
const NAMA_DEPAN = ['Ahmad', 'Budi', 'Cahya', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hana', 'Indra', 'Joko', 'Kartika', 'Lina', 'Maya', 'Nanda', 'Oki', 'Putra', 'Rina', 'Sari', 'Tono', 'Umar'];
const MAPEL = ['Matematika', 'Bahasa Indonesia', 'IPA', 'IPS', 'Pendidikan Agama', 'Bahasa Inggris', 'Seni Budaya', 'PJOK', 'Prakarya', 'TIK'];
const MATERI = [
  'Pecahan bersusun',
  'Teks eksplanasi',
  'Sistem organ tubuh manusia',
  'Kerukunan dalam masyarakat',
  'Kisah inspiratif Nabi',
  'Simple past tense',
  'Kolase dan mozaik',
  'Pencak silat',
  'Membuat produk hilang',
  'Dasar-dasar spreadsheet',
];
const TUGAS = [
  'Lembar kerja 1–10',
  'Kerjakan latihan halaman 12',
  'Bikin mind map bab 3',
  'Tidak ada',
  'Kumpulkan laporan praktik',
  'Latihan soal cerita',
];
const KETERANGAN = [
  'Siswa hadir seluruhnya, pembelajaran berjalan lancar.',
  'Ada 3 siswa izin, materi sedikit tertinggal dan sudah dibahas ulang.',
  'Siswa ribut saat transisi jam istirahat, sudah dimenangkan.',
  'Proyektor mati sebagian, materi dilanjutkan secara lisan.',
  'Kelas kosong sebentar karena kedipan listrik.',
];
const JAM_LABEL: Record<number, string> = { 1: '1-2', 2: '3-4', 3: '5', 4: '6-7', 5: '8-9', 6: '10', 7: '11-12', 8: '13-14' };
const DAY_KEYS: Record<number, string> = { 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY' };
const BADAL_REASON = ['Guru berhalangan', 'Izin', 'Sakit', 'Tugas'];

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  // PostgREST: Accept-Profile untuk schema pada response (baca),
  // Content-Profile untuk schema pada body (tulis). Tanpa keduanya, query
  // diarahkan ke schema `public` dan gagal dengan PGRST205.
  'Accept-Profile': SCHEMA,
  'Content-Profile': SCHEMA,
  'Content-Type': 'application/json',
};

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) || {}) },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} :: ${await res.text()}`);
  return res;
}

async function selectAll<T = any>(table: string, query = ''): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await api(`${table}?${query}`, { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    const chunk = (await res.json()) as T[];
    rows.push(...chunk);
    if (chunk.length < 1000) return rows;
  }
}

const chunked = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Insert dan kembalikan baris yang tersimpan (butuh `Prefer: return=representation`). */
async function insertReturning<T = any>(table: string, rows: any[]): Promise<T[]> {
  const out: T[] = [];
  for (const c of chunked(rows, 500)) {
    const res = await api(table, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(c),
    });
    out.push(...((await res.json()) as T[]));
  }
  return out;
}

async function insertRows(table: string, rows: any[]): Promise<number> {
  let n = 0;
  for (const c of chunked(rows, 500)) {
    await api(table, { method: 'POST', body: JSON.stringify(c) });
    n += c.length;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const mulberry32 = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pad = (n: number) => String(n).padStart(2, '0');
const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Kunci pencocokan baris seed → baris DB (unik per slot+tanggal, dan unik untuk agenda manual). */
const rowKey = (tanggal: string, scheduleId: string | null, kelas: string) =>
  `${tanggal}|${scheduleId ?? 'manual'}|${kelas}`;

/** N hari kerja (Sen–Jum) terakhir, termasuk hari ini bila hari kerja. */
function listWorkdays(days: number, maxDate: Date): string[] {
  const out: string[] = [];
  const cur = new Date(maxDate);
  while (out.length < days) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) out.unshift(dstr(cur));
    cur.setDate(cur.getDate() - 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mode: reset
// ---------------------------------------------------------------------------
if (DO_RESET) {
  const tables = ['agenda_evidence', 'agenda_absensi', 'agenda_kbm', 'agenda_kejadian', 'agenda_header', 'substitutions'];
  const counts: Record<string, number> = {};
  for (const t of tables) counts[t] = (await selectAll<any>(t, 'select=id')).length;
  const siswaUji = await selectAll<any>('siswa', 'select=id&nama_siswa=like.Uji*');
  counts['siswa (Uji *)'] = siswaUji.length;

  console.log('\nAKAN MENGHAPUS:');
  for (const [t, c] of Object.entries(counts)) console.log(`  - ${t}: ${c} baris`);
  if (!ASSUME_YES) {
    console.log('\nBatalkan dengan Ctrl+C. Lanjut dengan: bun scripts/seed-demo-data.ts --reset --yes\n');
    process.exit(1);
  }
  for (const t of tables) await api(`${t}?id=not.is.null`, { method: 'DELETE' });
  if (siswaUji.length) await api('siswa?id=not.is.null&nama_siswa=like.Uji*', { method: 'DELETE' });
  console.log('✔ Data uji dihapus (master data tidak disentuh).\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Mode: seed
// ---------------------------------------------------------------------------
console.log('\n=== SEED DATA UJI AGENDA (dev only) ===\n');

const [ays, schedules, guruList] = await Promise.all([
  selectAll<any>('academic_year', 'select=*'),
  selectAll<any>('schedule', 'select=*'),
  selectAll<any>('guru', 'select=id,nama_guru'),
]);
const ay = ays.find((a) => a.status === 'ACTIVE') || ays[0];
if (!ay) throw new Error('Tidak ada academic_year — seed dibatalkan.');
const aySchedules = schedules.filter((s) => s.academic_year_id === ay.id && s.status === 'ACTIVE');
console.log(`Tahun ajaran     : ${ay.name} (${ay.status})`);
console.log(`Jadwal (ACTIVE)  : ${aySchedules.length}`);

const existingAgendas = await selectAll<any>('agenda_header', 'select=id');
const existingSubs = await selectAll<any>('substitutions', 'select=id');
if ((existingAgendas.length || existingSubs.length) && !FORCE) {
  console.log(
    `\n⚠ Sudah ada data (${existingAgendas.length} agenda, ${existingSubs.length} substitusi).\n` +
      `  Jalankan ulang dengan --force, atau --reset dulu bila ingin data bersih.\n`
  );
  process.exit(1);
}

// Siswa dummy
let siswa = await selectAll<any>('siswa', 'select=id,nama_siswa,kelas');
if (siswa.length === 0) {
  const rows: any[] = [];
  for (const kelas of KELAS)
    for (let i = 0; i < SISWA_PER_KELAS; i++)
      rows.push({ nama_siswa: `Uji ${NAMA_DEPAN[i % NAMA_DEPAN.length]} ${kelas.replace('KELAS ', '')}.${i + 1}`, kelas });
  const inserted = await insertRows('siswa', rows);
  siswa = await selectAll<any>('siswa', 'select=id,nama_siswa,kelas');
  console.log(`Siswa dummy      : ${inserted} baris (prefix "Uji ")`);
} else {
  console.log(`Siswa            : ${siswa.length} baris (pakai yang ada)`);
}
const siswaPerKelas = new Map<string, any[]>();
for (const k of KELAS) siswaPerKelas.set(k, siswa.filter((s) => s.kelas === k));

// Tanggal
const today = new Date();
const todayStr = dstr(today);
const workdays = listWorkdays(DAYS, today).filter((d) => d >= ay.start_date && d <= ay.end_date);
if (workdays.length === 0) throw new Error('Tidak ada hari kerja dalam rentang tahun ajaran untuk tanggal seed.');
console.log(`Rentang seed     : ${workdays[0]} → ${workdays[workdays.length - 1]} (${workdays.length} hari kerja)\n`);

// Susun agenda
const headerRows: any[] = [];
const kbmRows: any[] = [];
const absensiRows: any[] = [];
const kejadianRows: any[] = [];
const subRows: any[] = [];

let slotTotal = 0;
let filled = 0;
let badalCount = 0;

for (const date of workdays) {
  const dayKey = DAY_KEYS[new Date(date + 'T00:00:00').getDay()]!;
  const daySchedules = aySchedules.filter((s) => s.day === dayKey).sort((a, b) => a.period_number - b.period_number);

  daySchedules.forEach((sch, idx) => {
    slotTotal++;
    const rnd = mulberry32(hash(date + sch.id));
    const isLastWorkday = date === workdays[workdays.length - 1];
    // Hari kerja terakhir lebih banyak yang sengaja kosong supaya status
    // "Belum Diisi" terlihat saat demo.
    if (rnd() > (isLastWorkday ? 0.55 : 0.78)) return;

    filled++;
    // Badal: 1 slot (jp ke-2) pada 3 hari kerja terakhir
    const wantsBadal =
      workdays.slice(-3).includes(date) && idx === 1 && guruList.length > 1 && rnd() > 0.5;
    const substitute = wantsBadal
      ? guruList.find((g) => g.nama_guru.trim().toLowerCase() !== sch.teacher_name.trim().toLowerCase())
      : undefined;
    const actualTeacher = substitute?.nama_guru ?? sch.teacher_name;
    if (substitute) badalCount++;

    const key = rowKey(date, sch.id, sch.class_id);
    headerRows.push({
      sekolah: 'SDIT AS-SYIFA',
      kelas: sch.class_id,
      tanggal: date,
      schedule_id: sch.id,
      actual_teacher_name: actualTeacher,
      created_at: new Date(`${date}T${(sch.start_time || '07:00').slice(0, 5)}:00`).toISOString(),
      _key: key,
    });

    kbmRows.push({
      _key: key,
      jam_ke: JAM_LABEL[sch.period_number] ?? String(sch.period_number),
      nama_guru: actualTeacher,
      mapel: sch.subject_name,
      materi: MATERI[Math.floor(rnd() * MATERI.length)]!,
      tugas_pr: TUGAS[Math.floor(rnd() * TUGAS.length)]!,
      is_badal: Boolean(substitute),
    });
    if (rnd() > 0.45) {
      kbmRows.push({
        _key: key,
        jam_ke: String(Number(sch.period_number) + 1),
        nama_guru: actualTeacher,
        mapel: sch.subject_name,
        materi: MATERI[Math.floor(rnd() * MATERI.length)]!,
        tugas_pr: null,
        is_badal: Boolean(substitute),
      });
    }

    const kelasSiswa = siswaPerKelas.get(sch.class_id) ?? [];
    if (kelasSiswa.length > 0 && rnd() > 0.35) {
      const jumlah = Math.min(kelasSiswa.length, 6 + Math.floor(rnd() * 5));
      for (let i = 0; i < jumlah; i++) {
        const r = rnd();
        // Hanya ketidakhadiran yang disimpan — check constraint
        // agenda_absensi_status_check hanya menerima S/I/A. Siswa yang hadir
        // TIDAK punya baris; itulah cara aplikasi membedakan "hadir lengkap".
        if (r > 0.94) absensiRows.push({ _key: key, siswa_id: kelasSiswa[i]!.id, status: 'A' });
        else if (r > 0.86) absensiRows.push({ _key: key, siswa_id: kelasSiswa[i]!.id, status: 'I' });
        else if (r > 0.79) absensiRows.push({ _key: key, siswa_id: kelasSiswa[i]!.id, status: 'S' });
      }
    }

    if (rnd() > 0.72) {
      kejadianRows.push({ _key: key, uraian_kejadian: KETERANGAN[Math.floor(rnd() * KETERANGAN.length)]! });
    }

    if (substitute) {
      subRows.push({
        schedule_id: sch.id,
        substitution_date: date,
        original_teacher_name: sch.teacher_name,
        original_teacher_id: sch.teacher_id || null,
        substitute_teacher_name: substitute.nama_guru,
        substitute_teacher_id: substitute.id,
        reason: BADAL_REASON[Math.floor(rnd() * BADAL_REASON.length)]!,
        reason_detail: 'Digantikan oleh seed data uji.',
        created_by: substitute.nama_guru,
      });
    }
  });
}

// 2 agenda "di luar jadwal" (tanpa schedule_id)
for (let i = 0; i < 2; i++) {
  const date = workdays[workdays.length - 1 - i] ?? workdays[0]!;
  const kelas = KELAS[i % KELAS.length]!;
  const guru = guruList[i % guruList.length];
  const key = rowKey(date, null, kelas);
  headerRows.push({
    sekolah: 'SDIT AS-SYIFA',
    kelas,
    tanggal: date,
    schedule_id: null,
    actual_teacher_name: guru?.nama_guru ?? 'Guru Uji',
    created_at: new Date(`${date}T07:30:00`).toISOString(),
    _key: key,
  });
  kbmRows.push({
    _key: key,
    jam_ke: '1-2',
    nama_guru: guru?.nama_guru ?? 'Guru Uji',
    mapel: MAPEL[i % MAPEL.length]!,
    materi: 'Kegiatan ad-hoc tanpa slot jadwal (agenda manual).',
    tugas_pr: null,
    is_badal: false,
  });
}

// Tulis: header dulu (id dibuat DB), lalu anak-anak memakai id asli
console.log('Menulis data…');
const insertedHeaders = await insertReturning<any>('agenda_header', headerRows.map(({ _key, ...rest }) => rest));
const idByKey = new Map<string, string>(
  insertedHeaders.map((r) => [rowKey(r.tanggal, r.schedule_id ?? null, r.kelas), r.id])
);
const orphan = headerRows.filter((r) => !idByKey.has(r._key));
if (orphan.length) {
  console.log(`⚠ ${orphan.length} header gagal dipetakan ke id DB — anak-anaknya dilewati.`);
}
const withAgendaId = (rows: any[]) =>
  rows.filter((r) => idByKey.has(r._key)).map(({ _key, ...rest }) => ({ ...rest, agenda_id: idByKey.get(_key) }));

await insertRows('agenda_kbm', withAgendaId(kbmRows));
if (absensiRows.length) await insertRows('agenda_absensi', withAgendaId(absensiRows));
if (kejadianRows.length) await insertRows('agenda_kejadian', withAgendaId(kejadianRows));
if (subRows.length) await insertRows('substitutions', subRows);

const totalHeader = (await selectAll<any>('agenda_header', 'select=id')).length;
const totalKbm = (await selectAll<any>('agenda_kbm', 'select=id')).length;
const totalAbsensi = (await selectAll<any>('agenda_absensi', 'select=id')).length;
const totalKejadian = (await selectAll<any>('agenda_kejadian', 'select=id')).length;
const totalSub = (await selectAll<any>('substitutions', 'select=id')).length;

console.log('\n✔ Selesai.\n');
console.log(`  agenda_header   : ${totalHeader} baris (+${insertedHeaders.length} baru)`);
console.log(`  agenda_kbm      : ${totalKbm} baris`);
console.log(`  agenda_absensi  : ${totalAbsensi} baris (S/I/A diacak)`);
console.log(`  agenda_kejadian : ${totalKejadian} baris`);
console.log(`  substitutions   : ${totalSub} baris`);
console.log(`  agenda_evidence : 0 (butuh upload ke bucket Storage)`);
console.log(
  `\n  Cakupan: ${slotTotal} slot dijadwalkan pada ${workdays.length} hari kerja → ${filled} terisi (${Math.round(
    (filled / Math.max(1, slotTotal)) * 100
  )}%), ${slotTotal - filled} sengaja kosong`
);
console.log(`  Kasus badal     : ${badalCount} · agenda tanpa jadwal: 2`);
console.log(`  Hari ini        : ${todayStr} (${new Date().toLocaleDateString('id-ID', { weekday: 'long' })})\n`);
console.log('Saran tes cepat:');
console.log(`  - /admin/rekap_harian  → pilih tanggal kerja terakhir (${workdays[workdays.length - 1]})`);
console.log('  - /admin/agenda        → buat agenda pada slot kosong yang terlihat');
console.log('  - /admin/rekap         → Log Jurnal: 30 hari terakhir, cari "Uji", statistik S/I/A');
console.log('  - /admin/rekap_mingguan→ pastikan JP = jumlah slot harian\n');
