/**
 * Ubah hasil `parse-jadwal-excel.ts` menjadi skrip SQL siap tempel.
 *
 * PRINSIP UTAMA — skrip ini TIDAK MEMBUAT MASTER DATA.
 *
 * Guru, mata pelajaran, kelas, dan jam pelajaran (JP) sudah didefinisikan
 * pengguna lewat panel admin. Skrip ini hanya MERUJUK baris yang sudah ada:
 *
 *   - mapel  -> dicari lewat `nama_mapel`
 *   - kelas  -> dicari lewat `tingkat` + `rombel`
 *   - guru   -> dicari lewat `nama_guru`
 *   - JP     -> dicari lewat JAM (`start_time`/`end_time`) pada period_templates
 *
 * Kalau ada yang kurang, skrip BERHENTI dengan pesan Bahasa Indonesia yang
 * menyebut apa yang kurang — bukan diam-diam membuat baris baru.
 *
 * Nomor JP TIDAK dihitung di sini. Nomornya diambil dari `period_templates`
 * milik pengguna saat skrip dijalankan, lewat pencocokan jam. Jadi kalau
 * pengguna mengubah jam atau penomoran JP, jadwal ikut menyesuaikan.
 *
 * Aman dijalankan berulang kali: baris jadwal hanya disisipkan kalau
 * (tahun ajaran + hari + jam mulai + kelas) belum ada.
 */
import { readFileSync, writeFileSync } from 'fs';

const SRC = process.argv[2] ?? 'jadwal-parsed.json';
const OUT = process.argv[3] ?? 'supabase/seed_jadwal_2026_2027.sql';
const AY_NAME = process.argv[4] ?? '2026/2027';

const data = JSON.parse(readFileSync(SRC, 'utf8')) as {
  jamDef: { jamKe: number; start: string; end: string }[];
  mapel: string[];
  entries: {
    day: string;
    tingkat: number;
    jamKe: number;
    start: string;
    end: string;
    mapel: string;
  }[];
};

/**
 * Terjemahan nama mapel dari Excel ke nama yang dipakai di master data.
 *
 * Ini perlu karena Excel memakai singkatan ('MTK', 'PENJAS', 'UMMI') sedangkan
 * master data memakai nama lengkap ('Matematika', 'PJOK', 'Ummi'). Hasil audit
 * master data menunjukkan 7 dari 13 mapel berbeda ejaannya.
 *
 * Kalau nanti pengguna mengubah nama mapel di panel Data Mapel, ubah di sini
 * lalu jalankan ulang generator — jangan mengedit SQL hasilnya.
 */
const MAPEL_DB: Record<string, string> = {
  'B. ARAB': 'Bahasa Arab',
  'B. INDONESIA': 'Bahasa Indonesia',
  'B. INGGRIS': 'Bahasa Inggris',
  'B. SUNDA': 'Bahasa Sunda',
  FIQIH: 'FIKIH',
  IPAS: 'IPAS',
  MATEMATIKA: 'Matematika',
  PAI: 'PAI',
  PENJAS: 'PJOK',
  PKN: 'PKN',
  SBDP: 'SBDP',
  TIK: 'TIK',
  UMMI: 'Ummi',
};

/** Wali kelas per tingkat — dipakai sebagai guru pengampu SEMENTARA. */
const WALI_KELAS: Record<number, string> = {
  1: 'Ikfina Khoirun Nisa.,S.Pd,Gr.',
  2: 'Dian Kusumawati.,S.Pd,Gr.',
  3: 'Eva Tresnawati.,S.Pd,Gr.',
  4: 'Siti Nur Arafah.,S.Pd,Gr.',
  5: 'Nurazizah Romadi.,S.Pd,Gr.',
  6: 'Ela Nurlaela.,S.Pd.Gr',
};

const escape = (s: string) => s.replace(/'/g, "''");

// ---- Validasi terjemahan mapel ---------------------------------------------
// Gagal di sini (saat generate) jauh lebih murah daripada gagal saat SQL
// dijalankan setengah jalan di SQL Editor.
const mapelExcel = [...new Set(data.entries.map((e) => e.mapel))].sort();
const belumDiterjemahkan = mapelExcel.filter((m) => !MAPEL_DB[m]);
if (belumDiterjemahkan.length > 0) {
  throw new Error(
    `Mapel Excel berikut belum punya padanan di master data: ${belumDiterjemahkan.join(', ')}. ` +
      `Tambahkan ke MAPEL_DB di scripts/build-seed-jadwal-sql.ts.`,
  );
}
const mapelDb = [...new Set(mapelExcel.map((m) => MAPEL_DB[m]))].sort();

// ---- Jam yang dipakai (untuk pre-flight check di SQL) ----------------------
const slotList = [...data.jamDef].sort(
  (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
);

const kelasList = [1, 2, 3, 4, 5, 6].map((tingkat) => ({
  tingkat,
  rombel: 'A',
  label: `${tingkat}A`,
  wali: WALI_KELAS[tingkat],
}));

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

const lines: string[] = [];
const P = (s = '') => lines.push(s);

P(`-- =============================================================================`);
P(`-- SEED JADWAL PELAJARAN ${AY_NAME} — SDIT AS-SYIFA`);
P(`-- =============================================================================`);
P(`-- Dihasilkan otomatis dari "JADWAL PELAJARAN ${AY_NAME}.xlsx".`);
P(`-- Jangan diedit tangan: ubah Excel-nya, lalu jalankan ulang generator.`);
P(`--`);
P(`-- BERKAS INI TIDAK MEMBUAT MASTER DATA APA PUN.`);
P(`-- Guru, mata pelajaran, kelas, dan jam pelajaran sudah Anda definisikan di`);
P(`-- panel admin. Skrip ini hanya MERUJUK baris yang sudah ada. Kalau ada yang`);
P(`-- kurang, ia berhenti dengan pesan yang menyebut apa yang kurang — bukan`);
P(`-- membuat data duplikat.`);
P(`--`);
P(`-- Nomor JP diambil dari tabel "Jam Pelajaran" milik Anda, dicocokkan lewat`);
P(`-- jam (start_time/end_time). Jadi jadwal selalu ikut penomoran JP Anda.`);
P(`--`);
P(`-- Isi: ${data.entries.length} baris jadwal pelajaran`);
P(`--   ${mapelDb.length} mapel, ${kelasList.length} kelas, ${slotList.length} jam (JP).`);
P(`--`);
P(`-- GURU PENGAMPU = WALI KELAS MASING-MASING (sementara).`);
P(`-- Excel hanya memuat kelas -> mapel -> jam, tanpa nama guru. Supaya jadwal`);
P(`-- bisa dipakai lebih dulu, tiap mapel diisi wali kelasnya. Ini MEMANG PERLU`);
P(`-- DIEDIT: mapel seperti TIK, Bahasa Inggris, Bahasa Arab, dan PJOK biasanya`);
P(`-- diampu guru bidang, bukan wali kelas. Ubah lewat panel Jadwal Pelajaran.`);
P(`--`);
P(`-- Aman dijalankan berulang kali: baris jadwal hanya disisipkan kalau`);
P(`-- (tahun ajaran + hari + jam mulai + kelas) belum ada, sehingga hasil editan`);
P(`-- manual tidak tertimpa.`);
P(`-- =============================================================================`);
P();
P(`SET search_path TO agenda, public;`);
P();
P(`DO $$`);
P(`DECLARE`);
P(`    v_ay_id         UUID;`);
P(`    v_kelas_id      UUID;`);
P(`    v_kurang        TEXT;`);
P(`    v_baris         INTEGER := 0;`);
P(`    v_total         INTEGER := 0;`);
P(`    v_total_jadwal  INTEGER := 0;`);
P(`BEGIN`);
P(`    -- ---------------------------------------------------------------------`);
P(`    -- 0. Tahun ajaran harus ada.`);
P(`    -- ---------------------------------------------------------------------`);
P(`    SELECT id INTO v_ay_id`);
P(`    FROM agenda.academic_year`);
P(`    WHERE name = '${escape(AY_NAME)}'`);
P(`    ORDER BY created_at`);
P(`    LIMIT 1;`);
P();
P(`    IF v_ay_id IS NULL THEN`);
P(`        RAISE EXCEPTION`);
P(`            'Tahun ajaran ${escape(AY_NAME)} belum ada. Buat dulu di halaman Tahun Ajaran, baru jalankan skrip ini.';`);
P(`    END IF;`);
P();
P(`    -- ---------------------------------------------------------------------`);
P(`    -- 1. Periksa JAM PELAJARAN (JP).`);
P(`    --    Setiap jam di Excel harus punya barisnya di panel Jam Pelajaran.`);
P(`    --    Nomor JP nanti diambil dari situ, bukan dihitung ulang di sini.`);
P(`    -- ---------------------------------------------------------------------`);
P(`    SELECT string_agg(jam, ', ' ORDER BY jam) INTO v_kurang`);
P(`    FROM (`);
P(`        -- Sengaja tidak memakai to_char(): PostgreSQL tidak punya to_char(time).`);
P(`        -- time::text selalu berbentuk HH:MM:SS, jadi 5 huruf pertama sudah cukup.`);
P(`        SELECT left(x.mulai::text, 5) || '-' || left(x.selesai::text, 5) AS jam`);
P(`        FROM (VALUES`);
for (const [i, s] of slotList.entries()) {
  P(`            ('${s.start}'::time, '${s.end}'::time)${i === slotList.length - 1 ? '' : ','}`);
}
P(`        ) AS x(mulai, selesai)`);
P(`        WHERE NOT EXISTS (`);
P(`            SELECT 1 FROM agenda.period_templates pt`);
P(`            WHERE pt.academic_year_id = v_ay_id`);
P(`              AND pt.start_time = x.mulai`);
P(`              AND pt.end_time   = x.selesai`);
P(`        )`);
P(`    ) q;`);
P();
P(`    IF v_kurang IS NOT NULL THEN`);
P(`        RAISE EXCEPTION`);
P(`            'Jam pelajaran berikut belum ada di panel Jam Pelajaran: %. Tambahkan dulu di sana, baru jalankan skrip ini.', v_kurang;`);
P(`    END IF;`);
P();
P(`    -- ---------------------------------------------------------------------`);
P(`    -- 2. Periksa MATA PELAJARAN.`);
P(`    --    Nama di bawah ini sudah disesuaikan dengan master data Anda.`);
P(`    -- ---------------------------------------------------------------------`);
P(`    SELECT string_agg(nama, ', ' ORDER BY nama) INTO v_kurang`);
P(`    FROM (`);
P(`        SELECT m.nama FROM (VALUES`);
for (const [i, m] of mapelDb.entries()) {
  P(`            ('${escape(m)}')${i === mapelDb.length - 1 ? '' : ','}`);
}
P(`        ) AS m(nama)`);
P(`        WHERE NOT EXISTS (`);
P(`            SELECT 1 FROM agenda.mapel`);
P(`            WHERE lower(btrim(nama_mapel)) = lower(btrim(m.nama))`);
P(`        )`);
P(`    ) q;`);
P();
P(`    IF v_kurang IS NOT NULL THEN`);
P(`        RAISE EXCEPTION`);
P(`            'Mata pelajaran berikut belum ada di master data: %. Tambahkan dulu di halaman Data Mapel, baru jalankan skrip ini.', v_kurang;`);
P(`    END IF;`);
P();
P(`    -- ---------------------------------------------------------------------`);
P(`    -- 3. Periksa KELAS dan GURU (wali kelas).`);
P(`    -- ---------------------------------------------------------------------`);
P(`    SELECT string_agg(kelas, ', ' ORDER BY kelas) INTO v_kurang`);
P(`    FROM (`);
P(`        SELECT t.tingkat || 'A' AS kelas`);
P(`        FROM (VALUES (1),(2),(3),(4),(5),(6)) AS t(tingkat)`);
P(`        WHERE NOT EXISTS (`);
P(`            SELECT 1 FROM agenda.kelas k`);
P(`            WHERE k.tingkat = t.tingkat AND k.rombel = 'A'`);
P(`        )`);
P(`    ) q;`);
P();
P(`    IF v_kurang IS NOT NULL THEN`);
P(`        RAISE EXCEPTION`);
P(`            'Kelas berikut belum ada di master data: %. Tambahkan dulu di halaman Data Kelas.', v_kurang;`);
P(`    END IF;`);
P();
P(`    -- Guru pengampu sementara = wali kelas, jadi tiap nama di bawah harus ada`);
P(`    -- di master guru. Dibandingkan tanpa peduli huruf besar/kecil dan spasi.`);
P(`    SELECT string_agg(nama, ', ' ORDER BY nama) INTO v_kurang`);
P(`    FROM (`);
P(`        SELECT g.nama FROM (VALUES`);
for (const [i, k] of kelasList.entries()) {
  P(`            ('${escape(k.wali)}')${i === kelasList.length - 1 ? '' : ','}`);
}
P(`        ) AS g(nama)`);
P(`        WHERE NOT EXISTS (`);
P(`            SELECT 1 FROM agenda.guru`);
P(`            WHERE lower(btrim(nama_guru)) = lower(btrim(g.nama))`);
P(`        )`);
P(`    ) q;`);
P();
P(`    IF v_kurang IS NOT NULL THEN`);
P(`        RAISE EXCEPTION`);
P(`            'Guru berikut belum ada di master data: %. Tambahkan dulu di halaman Data Guru, baru jalankan skrip ini.', v_kurang;`);
P(`    END IF;`);
P();
P(`    -- ---------------------------------------------------------------------`);
P(`    -- 4. Sisipkan jadwal per kelas.`);
P(`    -- ---------------------------------------------------------------------`);
P(`    -- Nomor JP TIDAK ditulis di sini: diambil dari period_templates lewat`);
P(`    -- CROSS JOIN LATERAL yang mencocokkan jam. Kalau pengguna mengubah jam`);
P(`    -- atau penomoran JP, jadwal ikut menyesuaikan tanpa mengubah skrip ini.`);
P(`    -- ---------------------------------------------------------------------`);
const byKelas = new Map<number, typeof data.entries>();
for (const e of data.entries) {
  if (!byKelas.has(e.tingkat)) byKelas.set(e.tingkat, []);
  byKelas.get(e.tingkat)!.push(e);
}
for (const k of kelasList) {
  const rows = (byKelas.get(k.tingkat) ?? []).slice().sort(
    (a, b) =>
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
      a.start.localeCompare(b.start) ||
      MAPEL_DB[a.mapel].localeCompare(MAPEL_DB[b.mapel]),
  );
  if (rows.length === 0) continue;

  P(`    -- Kelas ${k.label} — ${rows.length} jam, pengampu sementara: ${escape(k.wali)}`);
  P(`    v_kelas_id := (SELECT id FROM agenda.kelas WHERE tingkat = ${k.tingkat} AND rombel = '${k.rombel}');`);
  P();
  P(`    INSERT INTO agenda.schedule (`);
  P(`        academic_year_id, day, period_number, start_time, end_time,`);
  P(`        kelas_id, subject_id, subject_name, teacher_id, teacher_name,`);
  P(`        period_template_id, activity_type, status`);
  P(`    )`);
  P(`    SELECT`);
  P(`        v_ay_id,`);
  P(`        v.day,`);
  P(`        pt.period_number,          -- nomor JP dari master data, bukan karangan`);
  P(`        v.start_time,`);
  P(`        v.end_time,`);
  P(`        v_kelas_id,`);
  P(`        (SELECT id FROM agenda.mapel`);
  P(`          WHERE lower(btrim(nama_mapel)) = lower(btrim(v.subject_name)) LIMIT 1),`);
  P(`        v.subject_name,`);
  P(`        (SELECT id FROM agenda.guru`);
  P(`          WHERE lower(btrim(nama_guru)) = lower(btrim(v.teacher_name)) LIMIT 1),`);
  P(`        v.teacher_name,`);
  P(`        pt.id,`);
  P(`        'KBM',`);
  P(`        'ACTIVE'`);
  P(`    FROM (VALUES`);
  for (const [i, r] of rows.entries()) {
    P(
      `        ('${r.day}'::text, '${r.start}'::time, '${r.end}'::time, '${escape(MAPEL_DB[r.mapel])}'::text, '${escape(k.wali)}'::text)${i === rows.length - 1 ? '' : ','}`,
    );
  }
  P(`    ) AS v(day, start_time, end_time, subject_name, teacher_name)`);
  P(`    -- Ambil JP yang jamnya persis sama. Dijamin ketemu karena sudah`);
  P(`    -- diperiksa di langkah 1.`);
  P(`    CROSS JOIN LATERAL (`);
  P(`        SELECT t.id, t.period_number`);
  P(`        FROM agenda.period_templates t`);
  P(`        WHERE t.academic_year_id = v_ay_id`);
  P(`          AND t.start_time = v.start_time`);
  P(`          AND t.end_time   = v.end_time`);
  P(`    ) pt`);
  P(`    WHERE NOT EXISTS (`);
  P(`        SELECT 1 FROM agenda.schedule s`);
  P(`        WHERE s.academic_year_id = v_ay_id`);
  P(`          AND s.day             = v.day`);
  P(`          AND s.start_time      = v.start_time`);
  P(`          AND s.kelas_id        = v_kelas_id`);
  P(`          AND s.status <> 'ARCHIVED'`);
  P(`    );`);
  P();
  P(`    GET DIAGNOSTICS v_baris = ROW_COUNT;`);
  P(`    v_total := v_total + v_baris;`);
  P();
}

P(`    -- ---------------------------------------------------------------------`);
P(`    -- 5. Ringkasan`);
P(`    -- ---------------------------------------------------------------------`);
P(`    SELECT count(*) INTO v_total_jadwal`);
P(`    FROM agenda.schedule`);
P(`    WHERE academic_year_id = v_ay_id AND status <> 'ARCHIVED';`);
P();
P(`    RAISE NOTICE '';`);
P(`    RAISE NOTICE '=============================================================';`);
P(`    RAISE NOTICE '  SEED JADWAL ${escape(AY_NAME)} SELESAI';`);
P(`    RAISE NOTICE '=============================================================';`);
P(`    RAISE NOTICE '  Tahun ajaran      : ${escape(AY_NAME)} (id %)', v_ay_id;`);
P(`    RAISE NOTICE '  Baris baru masuk  : %', v_total;`);
P(`    RAISE NOTICE '  Total jadwal      : %', v_total_jadwal;`);
P(`    RAISE NOTICE '';`);
P(`    RAISE NOTICE '  Master data TIDAK diubah oleh skrip ini.';`);
P(`    RAISE NOTICE '  Pengampu masih wali kelas (sementara) — edit di Jadwal Pelajaran.';`);
P(`    RAISE NOTICE '=============================================================';`);
P(`END $$;`);
P();
P(`-- -----------------------------------------------------------------------------`);
P(`-- VERIFIKASI — jalankan setelah seed untuk memeriksa hasilnya.`);
P(`-- -----------------------------------------------------------------------------`);
P(`-- Jumlah jam pelajaran per kelas (1A-2A harus 36, 3A-6A harus 44).`);
P(`SELECT`);
P(`    k.label AS kelas,`);
P(`    count(*) AS jam_pelajaran,`);
P(`    count(DISTINCT s.subject_name) AS mapel_unik,`);
P(`    min(s.period_number) AS jp_pertama,`);
P(`    max(s.period_number) AS jp_terakhir`);
P(`FROM agenda.schedule s`);
P(`JOIN agenda.kelas k ON k.id = s.kelas_id`);
P(`JOIN agenda.academic_year ay ON ay.id = s.academic_year_id`);
P(`WHERE ay.name = '${escape(AY_NAME)}' AND s.status <> 'ARCHIVED'`);
P(`GROUP BY k.label`);
P(`ORDER BY k.label;`);
P();
P(`-- Nomor JP harus cocok dengan jam pada master data Jam Pelajaran.`);
P(`-- Kalau ada baris di sini, berarti ada JP yang tidak sinkron.`);
P(`SELECT`);
P(`    s.period_number,`);
P(`    left(s.start_time::text, 5) AS jam_di_jadwal,`);
P(`    left(pt.start_time::text, 5) AS jam_di_master,`);
P(`    count(*) AS jumlah`);
P(`FROM agenda.schedule s`);
P(`JOIN agenda.academic_year ay ON ay.id = s.academic_year_id`);
P(`LEFT JOIN agenda.period_templates pt ON pt.id = s.period_template_id`);
P(`WHERE ay.name = '${escape(AY_NAME)}'`);
P(`  AND s.status <> 'ARCHIVED'`);
P(`  AND (pt.id IS NULL OR pt.start_time <> s.start_time OR pt.period_number <> s.period_number)`);
P(`GROUP BY s.period_number, s.start_time, pt.start_time`);
P(`ORDER BY s.period_number;`);
P();
P(`-- Jadwal yang masih memakai wali kelas sebagai pengampu (perlu diedit).`);
P(`SELECT`);
P(`    s.teacher_name AS pengampu_sementara,`);
P(`    count(*) AS jumlah_jam,`);
P(`    string_agg(DISTINCT s.subject_name, ', ' ORDER BY s.subject_name) AS mapel`);
P(`FROM agenda.schedule s`);
P(`JOIN agenda.academic_year ay ON ay.id = s.academic_year_id`);
P(`WHERE ay.name = '${escape(AY_NAME)}'`);
P(`  AND s.status <> 'ARCHIVED'`);
P(`GROUP BY s.teacher_name`);
P(`ORDER BY jumlah_jam DESC;`);
P();

writeFileSync(OUT, lines.join('\n'), 'utf8');

const byTingkat = new Map<number, number>();
for (const e of data.entries) byTingkat.set(e.tingkat, (byTingkat.get(e.tingkat) ?? 0) + 1);

console.log(`Ditulis: ${OUT}`);
console.log(`  TIDAK ada INSERT ke master data (mapel/kelas/guru/period_templates).`);
console.log(`  mapel dirujuk  : ${mapelDb.length} (${mapelDb.join(', ')})`);
console.log(`  kelas dirujuk  : ${kelasList.length} (${kelasList.map((k) => k.label).join(', ')})`);
console.log(`  jam dirujuk    : ${slotList.length} (${slotList[0].start.slice(0, 5)} s/d ${slotList.at(-1)!.end.slice(0, 5)})`);
console.log(`  TOTAL baris    : ${data.entries.length}`);
for (const k of kelasList) {
  console.log(`    ${k.label} : ${byTingkat.get(k.tingkat) ?? 0} jam`);
}
