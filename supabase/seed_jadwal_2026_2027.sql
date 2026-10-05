-- =============================================================================
-- SEED JADWAL PELAJARAN 2026/2027 — SDIT AS-SYIFA
-- =============================================================================
-- Dihasilkan otomatis dari "JADWAL PELAJARAN 2026/2027.xlsx".
-- Jangan diedit tangan: ubah Excel-nya, lalu jalankan ulang generator.
--
-- BERKAS INI TIDAK MEMBUAT MASTER DATA APA PUN.
-- Guru, mata pelajaran, kelas, dan jam pelajaran sudah Anda definisikan di
-- panel admin. Skrip ini hanya MERUJUK baris yang sudah ada. Kalau ada yang
-- kurang, ia berhenti dengan pesan yang menyebut apa yang kurang — bukan
-- membuat data duplikat.
--
-- Nomor JP diambil dari tabel "Jam Pelajaran" milik Anda, dicocokkan lewat
-- jam (start_time/end_time). Jadi jadwal selalu ikut penomoran JP Anda.
--
-- Isi: 248 baris jadwal pelajaran
--   13 mapel, 6 kelas, 10 jam (JP).
--
-- GURU PENGAMPU = WALI KELAS MASING-MASING (sementara).
-- Excel hanya memuat kelas -> mapel -> jam, tanpa nama guru. Supaya jadwal
-- bisa dipakai lebih dulu, tiap mapel diisi wali kelasnya. Ini MEMANG PERLU
-- DIEDIT: mapel seperti TIK, Bahasa Inggris, Bahasa Arab, dan PJOK biasanya
-- diampu guru bidang, bukan wali kelas. Ubah lewat panel Jadwal Pelajaran.
--
-- Aman dijalankan berulang kali: baris jadwal hanya disisipkan kalau
-- (tahun ajaran + hari + jam mulai + kelas) belum ada, sehingga hasil editan
-- manual tidak tertimpa.
-- =============================================================================

SET search_path TO agenda, public;

DO $$
DECLARE
    v_ay_id         UUID;
    v_kelas_id      UUID;
    v_kurang        TEXT;
    v_baris         INTEGER := 0;
    v_total         INTEGER := 0;
    v_total_jadwal  INTEGER := 0;
BEGIN
    -- ---------------------------------------------------------------------
    -- 0. Tahun ajaran harus ada.
    -- ---------------------------------------------------------------------
    SELECT id INTO v_ay_id
    FROM agenda.academic_year
    WHERE name = '2026/2027'
    ORDER BY created_at
    LIMIT 1;

    IF v_ay_id IS NULL THEN
        RAISE EXCEPTION
            'Tahun ajaran 2026/2027 belum ada. Buat dulu di halaman Tahun Ajaran, baru jalankan skrip ini.';
    END IF;

    -- ---------------------------------------------------------------------
    -- 1. Periksa JAM PELAJARAN (JP).
    --    Setiap jam di Excel harus punya barisnya di panel Jam Pelajaran.
    --    Nomor JP nanti diambil dari situ, bukan dihitung ulang di sini.
    -- ---------------------------------------------------------------------
    SELECT string_agg(jam, ', ' ORDER BY jam) INTO v_kurang
    FROM (
        -- Sengaja tidak memakai to_char(): PostgreSQL tidak punya to_char(time).
        -- time::text selalu berbentuk HH:MM:SS, jadi 5 huruf pertama sudah cukup.
        SELECT left(x.mulai::text, 5) || '-' || left(x.selesai::text, 5) AS jam
        FROM (VALUES
            ('08:05:00'::time, '08:40:00'::time),
            ('08:40:00'::time, '09:15:00'::time),
            ('09:35:00'::time, '10:10:00'::time),
            ('10:10:00'::time, '10:45:00'::time),
            ('10:45:00'::time, '11:20:00'::time),
            ('11:20:00'::time, '11:55:00'::time),
            ('12:30:00'::time, '13:05:00'::time),
            ('13:05:00'::time, '13:35:00'::time),
            ('13:35:00'::time, '14:10:00'::time),
            ('14:10:00'::time, '14:40:00'::time)
        ) AS x(mulai, selesai)
        WHERE NOT EXISTS (
            SELECT 1 FROM agenda.period_templates pt
            WHERE pt.academic_year_id = v_ay_id
              AND pt.start_time = x.mulai
              AND pt.end_time   = x.selesai
        )
    ) q;

    IF v_kurang IS NOT NULL THEN
        RAISE EXCEPTION
            'Jam pelajaran berikut belum ada di panel Jam Pelajaran: %. Tambahkan dulu di sana, baru jalankan skrip ini.', v_kurang;
    END IF;

    -- ---------------------------------------------------------------------
    -- 2. Periksa MATA PELAJARAN.
    --    Nama di bawah ini sudah disesuaikan dengan master data Anda.
    -- ---------------------------------------------------------------------
    SELECT string_agg(nama, ', ' ORDER BY nama) INTO v_kurang
    FROM (
        SELECT m.nama FROM (VALUES
            ('Bahasa Arab'),
            ('Bahasa Indonesia'),
            ('Bahasa Inggris'),
            ('Bahasa Sunda'),
            ('FIKIH'),
            ('IPAS'),
            ('Matematika'),
            ('PAI'),
            ('PJOK'),
            ('PKN'),
            ('SBDP'),
            ('TIK'),
            ('Ummi')
        ) AS m(nama)
        WHERE NOT EXISTS (
            SELECT 1 FROM agenda.mapel
            WHERE lower(btrim(nama_mapel)) = lower(btrim(m.nama))
        )
    ) q;

    IF v_kurang IS NOT NULL THEN
        RAISE EXCEPTION
            'Mata pelajaran berikut belum ada di master data: %. Tambahkan dulu di halaman Data Mapel, baru jalankan skrip ini.', v_kurang;
    END IF;

    -- ---------------------------------------------------------------------
    -- 3. Periksa KELAS dan GURU (wali kelas).
    -- ---------------------------------------------------------------------
    SELECT string_agg(kelas, ', ' ORDER BY kelas) INTO v_kurang
    FROM (
        SELECT t.tingkat || 'A' AS kelas
        FROM (VALUES (1),(2),(3),(4),(5),(6)) AS t(tingkat)
        WHERE NOT EXISTS (
            SELECT 1 FROM agenda.kelas k
            WHERE k.tingkat = t.tingkat AND k.rombel = 'A'
        )
    ) q;

    IF v_kurang IS NOT NULL THEN
        RAISE EXCEPTION
            'Kelas berikut belum ada di master data: %. Tambahkan dulu di halaman Data Kelas.', v_kurang;
    END IF;

    -- Guru pengampu sementara = wali kelas, jadi tiap nama di bawah harus ada
    -- di master guru. Dibandingkan tanpa peduli huruf besar/kecil dan spasi.
    SELECT string_agg(nama, ', ' ORDER BY nama) INTO v_kurang
    FROM (
        SELECT g.nama FROM (VALUES
            ('Ikfina Khoirun Nisa.,S.Pd,Gr.'),
            ('Dian Kusumawati.,S.Pd,Gr.'),
            ('Eva Tresnawati.,S.Pd,Gr.'),
            ('Siti Nur Arafah.,S.Pd,Gr.'),
            ('Nurazizah Romadi.,S.Pd,Gr.'),
            ('Ela Nurlaela.,S.Pd.Gr')
        ) AS g(nama)
        WHERE NOT EXISTS (
            SELECT 1 FROM agenda.guru
            WHERE lower(btrim(nama_guru)) = lower(btrim(g.nama))
        )
    ) q;

    IF v_kurang IS NOT NULL THEN
        RAISE EXCEPTION
            'Guru berikut belum ada di master data: %. Tambahkan dulu di halaman Data Guru, baru jalankan skrip ini.', v_kurang;
    END IF;

    -- ---------------------------------------------------------------------
    -- 4. Sisipkan jadwal per kelas.
    -- ---------------------------------------------------------------------
    -- Nomor JP TIDAK ditulis di sini: diambil dari period_templates lewat
    -- CROSS JOIN LATERAL yang mencocokkan jam. Kalau pengguna mengubah jam
    -- atau penomoran JP, jadwal ikut menyesuaikan tanpa mengubah skrip ini.
    -- ---------------------------------------------------------------------
    -- Kelas 1A — 36 jam, pengampu sementara: Ikfina Khoirun Nisa.,S.Pd,Gr.
    v_kelas_id := (SELECT id FROM agenda.kelas WHERE tingkat = 1 AND rombel = 'A');

    INSERT INTO agenda.schedule (
        academic_year_id, day, period_number, start_time, end_time,
        kelas_id, subject_id, subject_name, teacher_id, teacher_name,
        period_template_id, activity_type, status
    )
    SELECT
        v_ay_id,
        v.day,
        pt.period_number,          -- nomor JP dari master data, bukan karangan
        v.start_time,
        v.end_time,
        v_kelas_id,
        (SELECT id FROM agenda.mapel
          WHERE lower(btrim(nama_mapel)) = lower(btrim(v.subject_name)) LIMIT 1),
        v.subject_name,
        (SELECT id FROM agenda.guru
          WHERE lower(btrim(nama_guru)) = lower(btrim(v.teacher_name)) LIMIT 1),
        v.teacher_name,
        pt.id,
        'KBM',
        'ACTIVE'
    FROM (VALUES
        ('MONDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Indonesia'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Indonesia'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:45:00'::time, '11:20:00'::time, 'IPAS'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '11:20:00'::time, '11:55:00'::time, 'IPAS'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '12:30:00'::time, '13:05:00'::time, 'PKN'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:05:00'::time, '13:35:00'::time, 'PKN'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Matematika'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Matematika'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'IPAS'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'IPAS'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Sunda'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Sunda'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Matematika'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Matematika'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'PAI'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'PAI'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'FIKIH'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'FIKIH'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PJOK'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PJOK'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Inggris'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Inggris'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Bahasa Indonesia'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Bahasa Indonesia'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '12:30:00'::time, '13:05:00'::time, 'SBDP'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:05:00'::time, '13:35:00'::time, 'SBDP'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Arab'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Arab'::text, 'Ikfina Khoirun Nisa.,S.Pd,Gr.'::text)
    ) AS v(day, start_time, end_time, subject_name, teacher_name)
    -- Ambil JP yang jamnya persis sama. Dijamin ketemu karena sudah
    -- diperiksa di langkah 1.
    CROSS JOIN LATERAL (
        SELECT t.id, t.period_number
        FROM agenda.period_templates t
        WHERE t.academic_year_id = v_ay_id
          AND t.start_time = v.start_time
          AND t.end_time   = v.end_time
    ) pt
    WHERE NOT EXISTS (
        SELECT 1 FROM agenda.schedule s
        WHERE s.academic_year_id = v_ay_id
          AND s.day             = v.day
          AND s.start_time      = v.start_time
          AND s.kelas_id        = v_kelas_id
          AND s.status <> 'ARCHIVED'
    );

    GET DIAGNOSTICS v_baris = ROW_COUNT;
    v_total := v_total + v_baris;

    -- Kelas 2A — 36 jam, pengampu sementara: Dian Kusumawati.,S.Pd,Gr.
    v_kelas_id := (SELECT id FROM agenda.kelas WHERE tingkat = 2 AND rombel = 'A');

    INSERT INTO agenda.schedule (
        academic_year_id, day, period_number, start_time, end_time,
        kelas_id, subject_id, subject_name, teacher_id, teacher_name,
        period_template_id, activity_type, status
    )
    SELECT
        v_ay_id,
        v.day,
        pt.period_number,          -- nomor JP dari master data, bukan karangan
        v.start_time,
        v.end_time,
        v_kelas_id,
        (SELECT id FROM agenda.mapel
          WHERE lower(btrim(nama_mapel)) = lower(btrim(v.subject_name)) LIMIT 1),
        v.subject_name,
        (SELECT id FROM agenda.guru
          WHERE lower(btrim(nama_guru)) = lower(btrim(v.teacher_name)) LIMIT 1),
        v.teacher_name,
        pt.id,
        'KBM',
        'ACTIVE'
    FROM (VALUES
        ('MONDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '09:35:00'::time, '10:10:00'::time, 'SBDP'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:10:00'::time, '10:45:00'::time, 'SBDP'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Bahasa Indonesia'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Bahasa Indonesia'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '12:30:00'::time, '13:05:00'::time, 'PKN'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:05:00'::time, '13:35:00'::time, 'PKN'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Matematika'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Matematika'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Bahasa Sunda'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Bahasa Sunda'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'IPAS'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'IPAS'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Matematika'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Matematika'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'PAI'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'PAI'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'FIKIH'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'FIKIH'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PJOK'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PJOK'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Inggris'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Inggris'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Bahasa Indonesia'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Bahasa Indonesia'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Arab'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Arab'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Ummi'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '09:35:00'::time, '10:10:00'::time, 'SBDP'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '10:10:00'::time, '10:45:00'::time, 'SBDP'::text, 'Dian Kusumawati.,S.Pd,Gr.'::text)
    ) AS v(day, start_time, end_time, subject_name, teacher_name)
    -- Ambil JP yang jamnya persis sama. Dijamin ketemu karena sudah
    -- diperiksa di langkah 1.
    CROSS JOIN LATERAL (
        SELECT t.id, t.period_number
        FROM agenda.period_templates t
        WHERE t.academic_year_id = v_ay_id
          AND t.start_time = v.start_time
          AND t.end_time   = v.end_time
    ) pt
    WHERE NOT EXISTS (
        SELECT 1 FROM agenda.schedule s
        WHERE s.academic_year_id = v_ay_id
          AND s.day             = v.day
          AND s.start_time      = v.start_time
          AND s.kelas_id        = v_kelas_id
          AND s.status <> 'ARCHIVED'
    );

    GET DIAGNOSTICS v_baris = ROW_COUNT;
    v_total := v_total + v_baris;

    -- Kelas 3A — 44 jam, pengampu sementara: Eva Tresnawati.,S.Pd,Gr.
    v_kelas_id := (SELECT id FROM agenda.kelas WHERE tingkat = 3 AND rombel = 'A');

    INSERT INTO agenda.schedule (
        academic_year_id, day, period_number, start_time, end_time,
        kelas_id, subject_id, subject_name, teacher_id, teacher_name,
        period_template_id, activity_type, status
    )
    SELECT
        v_ay_id,
        v.day,
        pt.period_number,          -- nomor JP dari master data, bukan karangan
        v.start_time,
        v.end_time,
        v_kelas_id,
        (SELECT id FROM agenda.mapel
          WHERE lower(btrim(nama_mapel)) = lower(btrim(v.subject_name)) LIMIT 1),
        v.subject_name,
        (SELECT id FROM agenda.guru
          WHERE lower(btrim(nama_guru)) = lower(btrim(v.teacher_name)) LIMIT 1),
        v.teacher_name,
        pt.id,
        'KBM',
        'ACTIVE'
    FROM (VALUES
        ('MONDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PAI'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PAI'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:45:00'::time, '11:20:00'::time, 'FIKIH'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '11:20:00'::time, '11:55:00'::time, 'FIKIH'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '12:30:00'::time, '13:05:00'::time, 'PKN'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:05:00'::time, '13:35:00'::time, 'PKN'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:35:00'::time, '14:10:00'::time, 'IPAS'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '14:10:00'::time, '14:40:00'::time, 'IPAS'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Matematika'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Matematika'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Bahasa Indonesia'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Bahasa Indonesia'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Inggris'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Inggris'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'TIK'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'TIK'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PJOK'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PJOK'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'SBDP'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'SBDP'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Arab'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Arab'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'Matematika'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'Matematika'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:05:00'::time, '08:40:00'::time, 'IPAS'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:40:00'::time, '09:15:00'::time, 'IPAS'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Matematika'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Matematika'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '12:30:00'::time, '13:05:00'::time, 'IPAS'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:05:00'::time, '13:35:00'::time, 'IPAS'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:35:00'::time, '14:10:00'::time, 'Bahasa Indonesia'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '14:10:00'::time, '14:40:00'::time, 'Bahasa Indonesia'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Bahasa Sunda'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Bahasa Sunda'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Indonesia'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Indonesia'::text, 'Eva Tresnawati.,S.Pd,Gr.'::text)
    ) AS v(day, start_time, end_time, subject_name, teacher_name)
    -- Ambil JP yang jamnya persis sama. Dijamin ketemu karena sudah
    -- diperiksa di langkah 1.
    CROSS JOIN LATERAL (
        SELECT t.id, t.period_number
        FROM agenda.period_templates t
        WHERE t.academic_year_id = v_ay_id
          AND t.start_time = v.start_time
          AND t.end_time   = v.end_time
    ) pt
    WHERE NOT EXISTS (
        SELECT 1 FROM agenda.schedule s
        WHERE s.academic_year_id = v_ay_id
          AND s.day             = v.day
          AND s.start_time      = v.start_time
          AND s.kelas_id        = v_kelas_id
          AND s.status <> 'ARCHIVED'
    );

    GET DIAGNOSTICS v_baris = ROW_COUNT;
    v_total := v_total + v_baris;

    -- Kelas 4A — 44 jam, pengampu sementara: Siti Nur Arafah.,S.Pd,Gr.
    v_kelas_id := (SELECT id FROM agenda.kelas WHERE tingkat = 4 AND rombel = 'A');

    INSERT INTO agenda.schedule (
        academic_year_id, day, period_number, start_time, end_time,
        kelas_id, subject_id, subject_name, teacher_id, teacher_name,
        period_template_id, activity_type, status
    )
    SELECT
        v_ay_id,
        v.day,
        pt.period_number,          -- nomor JP dari master data, bukan karangan
        v.start_time,
        v.end_time,
        v_kelas_id,
        (SELECT id FROM agenda.mapel
          WHERE lower(btrim(nama_mapel)) = lower(btrim(v.subject_name)) LIMIT 1),
        v.subject_name,
        (SELECT id FROM agenda.guru
          WHERE lower(btrim(nama_guru)) = lower(btrim(v.teacher_name)) LIMIT 1),
        v.teacher_name,
        pt.id,
        'KBM',
        'ACTIVE'
    FROM (VALUES
        ('MONDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PAI'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PAI'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:45:00'::time, '11:20:00'::time, 'FIKIH'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '11:20:00'::time, '11:55:00'::time, 'FIKIH'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '12:30:00'::time, '13:05:00'::time, 'PKN'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:05:00'::time, '13:35:00'::time, 'PKN'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:35:00'::time, '14:10:00'::time, 'IPAS'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '14:10:00'::time, '14:40:00'::time, 'IPAS'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Matematika'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Matematika'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Bahasa Indonesia'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Bahasa Indonesia'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Inggris'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Inggris'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'Matematika'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'Matematika'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PJOK'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PJOK'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'SBDP'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'SBDP'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Arab'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Arab'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'TIK'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'TIK'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:05:00'::time, '08:40:00'::time, 'IPAS'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:40:00'::time, '09:15:00'::time, 'IPAS'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Ummi'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Matematika'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Matematika'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '12:30:00'::time, '13:05:00'::time, 'IPAS'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:05:00'::time, '13:35:00'::time, 'IPAS'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:35:00'::time, '14:10:00'::time, 'Bahasa Indonesia'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '14:10:00'::time, '14:40:00'::time, 'Bahasa Indonesia'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Bahasa Sunda'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Bahasa Sunda'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Indonesia'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Indonesia'::text, 'Siti Nur Arafah.,S.Pd,Gr.'::text)
    ) AS v(day, start_time, end_time, subject_name, teacher_name)
    -- Ambil JP yang jamnya persis sama. Dijamin ketemu karena sudah
    -- diperiksa di langkah 1.
    CROSS JOIN LATERAL (
        SELECT t.id, t.period_number
        FROM agenda.period_templates t
        WHERE t.academic_year_id = v_ay_id
          AND t.start_time = v.start_time
          AND t.end_time   = v.end_time
    ) pt
    WHERE NOT EXISTS (
        SELECT 1 FROM agenda.schedule s
        WHERE s.academic_year_id = v_ay_id
          AND s.day             = v.day
          AND s.start_time      = v.start_time
          AND s.kelas_id        = v_kelas_id
          AND s.status <> 'ARCHIVED'
    );

    GET DIAGNOSTICS v_baris = ROW_COUNT;
    v_total := v_total + v_baris;

    -- Kelas 5A — 44 jam, pengampu sementara: Nurazizah Romadi.,S.Pd,Gr.
    v_kelas_id := (SELECT id FROM agenda.kelas WHERE tingkat = 5 AND rombel = 'A');

    INSERT INTO agenda.schedule (
        academic_year_id, day, period_number, start_time, end_time,
        kelas_id, subject_id, subject_name, teacher_id, teacher_name,
        period_template_id, activity_type, status
    )
    SELECT
        v_ay_id,
        v.day,
        pt.period_number,          -- nomor JP dari master data, bukan karangan
        v.start_time,
        v.end_time,
        v_kelas_id,
        (SELECT id FROM agenda.mapel
          WHERE lower(btrim(nama_mapel)) = lower(btrim(v.subject_name)) LIMIT 1),
        v.subject_name,
        (SELECT id FROM agenda.guru
          WHERE lower(btrim(nama_guru)) = lower(btrim(v.teacher_name)) LIMIT 1),
        v.teacher_name,
        pt.id,
        'KBM',
        'ACTIVE'
    FROM (VALUES
        ('MONDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PJOK'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PJOK'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '09:35:00'::time, '10:10:00'::time, 'FIKIH'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:10:00'::time, '10:45:00'::time, 'FIKIH'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Matematika'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Matematika'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '13:35:00'::time, '14:10:00'::time, 'IPAS'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('MONDAY'::text, '14:10:00'::time, '14:40:00'::time, 'IPAS'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'IPAS'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'IPAS'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Indonesia'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Indonesia'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'IPAS'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'IPAS'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'TIK'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('TUESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'TIK'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PAI'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PAI'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'SBDP'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'SBDP'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Inggris'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Inggris'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'Bahasa Arab'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('WEDNESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'Bahasa Arab'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Bahasa Indonesia'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Bahasa Indonesia'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Matematika'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Matematika'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Matematika'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Matematika'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '13:35:00'::time, '14:10:00'::time, 'PKN'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('THURSDAY'::text, '14:10:00'::time, '14:40:00'::time, 'PKN'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Bahasa Indonesia'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Bahasa Indonesia'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Sunda'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text),
        ('FRIDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Sunda'::text, 'Nurazizah Romadi.,S.Pd,Gr.'::text)
    ) AS v(day, start_time, end_time, subject_name, teacher_name)
    -- Ambil JP yang jamnya persis sama. Dijamin ketemu karena sudah
    -- diperiksa di langkah 1.
    CROSS JOIN LATERAL (
        SELECT t.id, t.period_number
        FROM agenda.period_templates t
        WHERE t.academic_year_id = v_ay_id
          AND t.start_time = v.start_time
          AND t.end_time   = v.end_time
    ) pt
    WHERE NOT EXISTS (
        SELECT 1 FROM agenda.schedule s
        WHERE s.academic_year_id = v_ay_id
          AND s.day             = v.day
          AND s.start_time      = v.start_time
          AND s.kelas_id        = v_kelas_id
          AND s.status <> 'ARCHIVED'
    );

    GET DIAGNOSTICS v_baris = ROW_COUNT;
    v_total := v_total + v_baris;

    -- Kelas 6A — 44 jam, pengampu sementara: Ela Nurlaela.,S.Pd.Gr
    v_kelas_id := (SELECT id FROM agenda.kelas WHERE tingkat = 6 AND rombel = 'A');

    INSERT INTO agenda.schedule (
        academic_year_id, day, period_number, start_time, end_time,
        kelas_id, subject_id, subject_name, teacher_id, teacher_name,
        period_template_id, activity_type, status
    )
    SELECT
        v_ay_id,
        v.day,
        pt.period_number,          -- nomor JP dari master data, bukan karangan
        v.start_time,
        v.end_time,
        v_kelas_id,
        (SELECT id FROM agenda.mapel
          WHERE lower(btrim(nama_mapel)) = lower(btrim(v.subject_name)) LIMIT 1),
        v.subject_name,
        (SELECT id FROM agenda.guru
          WHERE lower(btrim(nama_guru)) = lower(btrim(v.teacher_name)) LIMIT 1),
        v.teacher_name,
        pt.id,
        'KBM',
        'ACTIVE'
    FROM (VALUES
        ('MONDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PJOK'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PJOK'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '09:35:00'::time, '10:10:00'::time, 'IPAS'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '10:10:00'::time, '10:45:00'::time, 'IPAS'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Matematika'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Matematika'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '13:35:00'::time, '14:10:00'::time, 'FIKIH'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('MONDAY'::text, '14:10:00'::time, '14:40:00'::time, 'FIKIH'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'IPAS'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'IPAS'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Indonesia'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Indonesia'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'IPAS'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'IPAS'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'PKN'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('TUESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'PKN'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '08:05:00'::time, '08:40:00'::time, 'PAI'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '08:40:00'::time, '09:15:00'::time, 'PAI'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '09:35:00'::time, '10:10:00'::time, 'SBDP'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '10:10:00'::time, '10:45:00'::time, 'SBDP'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Sunda'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Sunda'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '13:35:00'::time, '14:10:00'::time, 'Matematika'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('WEDNESDAY'::text, '14:10:00'::time, '14:40:00'::time, 'Matematika'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Bahasa Indonesia'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Bahasa Indonesia'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Matematika'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Matematika'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '10:45:00'::time, '11:20:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '11:20:00'::time, '11:55:00'::time, 'Ummi'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '12:30:00'::time, '13:05:00'::time, 'Bahasa Arab'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '13:05:00'::time, '13:35:00'::time, 'Bahasa Arab'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '13:35:00'::time, '14:10:00'::time, 'TIK'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('THURSDAY'::text, '14:10:00'::time, '14:40:00'::time, 'TIK'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('FRIDAY'::text, '08:05:00'::time, '08:40:00'::time, 'Bahasa Indonesia'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('FRIDAY'::text, '08:40:00'::time, '09:15:00'::time, 'Bahasa Indonesia'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('FRIDAY'::text, '09:35:00'::time, '10:10:00'::time, 'Bahasa Inggris'::text, 'Ela Nurlaela.,S.Pd.Gr'::text),
        ('FRIDAY'::text, '10:10:00'::time, '10:45:00'::time, 'Bahasa Inggris'::text, 'Ela Nurlaela.,S.Pd.Gr'::text)
    ) AS v(day, start_time, end_time, subject_name, teacher_name)
    -- Ambil JP yang jamnya persis sama. Dijamin ketemu karena sudah
    -- diperiksa di langkah 1.
    CROSS JOIN LATERAL (
        SELECT t.id, t.period_number
        FROM agenda.period_templates t
        WHERE t.academic_year_id = v_ay_id
          AND t.start_time = v.start_time
          AND t.end_time   = v.end_time
    ) pt
    WHERE NOT EXISTS (
        SELECT 1 FROM agenda.schedule s
        WHERE s.academic_year_id = v_ay_id
          AND s.day             = v.day
          AND s.start_time      = v.start_time
          AND s.kelas_id        = v_kelas_id
          AND s.status <> 'ARCHIVED'
    );

    GET DIAGNOSTICS v_baris = ROW_COUNT;
    v_total := v_total + v_baris;

    -- ---------------------------------------------------------------------
    -- 5. Ringkasan
    -- ---------------------------------------------------------------------
    SELECT count(*) INTO v_total_jadwal
    FROM agenda.schedule
    WHERE academic_year_id = v_ay_id AND status <> 'ARCHIVED';

    RAISE NOTICE '';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '  SEED JADWAL 2026/2027 SELESAI';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '  Tahun ajaran      : 2026/2027 (id %)', v_ay_id;
    RAISE NOTICE '  Baris baru masuk  : %', v_total;
    RAISE NOTICE '  Total jadwal      : %', v_total_jadwal;
    RAISE NOTICE '';
    RAISE NOTICE '  Master data TIDAK diubah oleh skrip ini.';
    RAISE NOTICE '  Pengampu masih wali kelas (sementara) — edit di Jadwal Pelajaran.';
    RAISE NOTICE '=============================================================';
END $$;

-- -----------------------------------------------------------------------------
-- VERIFIKASI — jalankan setelah seed untuk memeriksa hasilnya.
-- -----------------------------------------------------------------------------
-- Jumlah jam pelajaran per kelas (1A-2A harus 36, 3A-6A harus 44).
SELECT
    k.label AS kelas,
    count(*) AS jam_pelajaran,
    count(DISTINCT s.subject_name) AS mapel_unik,
    min(s.period_number) AS jp_pertama,
    max(s.period_number) AS jp_terakhir
FROM agenda.schedule s
JOIN agenda.kelas k ON k.id = s.kelas_id
JOIN agenda.academic_year ay ON ay.id = s.academic_year_id
WHERE ay.name = '2026/2027' AND s.status <> 'ARCHIVED'
GROUP BY k.label
ORDER BY k.label;

-- Nomor JP harus cocok dengan jam pada master data Jam Pelajaran.
-- Kalau ada baris di sini, berarti ada JP yang tidak sinkron.
SELECT
    s.period_number,
    left(s.start_time::text, 5) AS jam_di_jadwal,
    left(pt.start_time::text, 5) AS jam_di_master,
    count(*) AS jumlah
FROM agenda.schedule s
JOIN agenda.academic_year ay ON ay.id = s.academic_year_id
LEFT JOIN agenda.period_templates pt ON pt.id = s.period_template_id
WHERE ay.name = '2026/2027'
  AND s.status <> 'ARCHIVED'
  AND (pt.id IS NULL OR pt.start_time <> s.start_time OR pt.period_number <> s.period_number)
GROUP BY s.period_number, s.start_time, pt.start_time
ORDER BY s.period_number;

-- Jadwal yang masih memakai wali kelas sebagai pengampu (perlu diedit).
SELECT
    s.teacher_name AS pengampu_sementara,
    count(*) AS jumlah_jam,
    string_agg(DISTINCT s.subject_name, ', ' ORDER BY s.subject_name) AS mapel
FROM agenda.schedule s
JOIN agenda.academic_year ay ON ay.id = s.academic_year_id
WHERE ay.name = '2026/2027'
  AND s.status <> 'ARCHIVED'
GROUP BY s.teacher_name
ORDER BY jumlah_jam DESC;
