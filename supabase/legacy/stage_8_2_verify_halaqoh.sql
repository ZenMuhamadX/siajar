-- =============================================================================
-- FASE 1 — PEMERIKSAAN SESUDAH schema.sql DIJALANKAN (READ-ONLY, SATU HASIL)
-- =============================================================================
-- Skrip ini HANYA MEMBACA. Tidak ada INSERT/UPDATE/DELETE/ALTER.
--
-- KENAPA DIPISAH DARI stage_8_0
-- stage_8_0 dijalankan SEBELUM schema.sql, jadi ia tidak boleh menyebut kolom
-- atau tabel yang baru dibuat Fase 1 (`halaqoh`, `siswa_halaqoh`, kolom
-- `halaqoh_id`). Kalau berkas ini digabung ke sana, seluruh query akan gagal
-- dan SEMUA hasil pemeriksaan ikut hilang.
--
-- Berkas ini kebalikannya: ia MEMBUTUHKAN Fase 1 sudah terpasang, dan
-- gunanya memastikan yang terpasang itu benar — bukan sekadar "tidak error".
--
-- CARA PAKAI
--   1. Jalankan `supabase/schema.sql` lebih dulu.
--   2. Buka Supabase -> SQL Editor -> New query.
--   3. Tempel SELURUH isi berkas ini, lalu Run. Muncul SATU tabel.
--   4. Salin seluruh isinya dan kirimkan kembali.
--
-- CARA MEMBACA
--   status = OK/AMAN  -> terpasang dan bekerja
--   status = PERIKSA  -> ada yang tidak sesuai, jangan lanjut ke Fase 2
--   status = CATATAN  -> bukan masalah, hanya keadaan yang perlu diketahui
-- =============================================================================

WITH
-- Apakah tabel Fase 1 benar-benar ada?
tabel AS (
    SELECT
        EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'agenda' AND table_name = 'halaqoh')     AS ada_halaqoh,
        EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'agenda' AND table_name = 'siswa_halaqoh') AS ada_siswa_halaqoh,
        EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'agenda' AND table_name = 'schedule'
                   AND column_name = 'halaqoh_id')                              AS ada_sch_halaqoh_id,
        EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'agenda' AND table_name = 'agenda_kbm'
                   AND column_name = 'halaqoh_id')                              AS ada_kbm_halaqoh_id
),
-- Extension btree_gist: tanpa ini exclusion constraint tidak mungkin ada.
ext AS (
    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS ada
),
-- Kedua exclusion constraint yang seharusnya terpasang.
cons AS (
    SELECT
        count(*) FILTER (WHERE conname = 'excl_schedule_halaqoh_overlap') AS n_halaqoh,
        count(*) FILTER (WHERE conname = 'excl_schedule_teacher_overlap') AS n_guru
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'agenda' AND t.relname = 'schedule'
),
-- Kebijakan RLS pada dua tabel baru.
rls AS (
    SELECT
        count(*) FILTER (WHERE tablename = 'halaqoh')       AS n_halaqoh,
        count(*) FILTER (WHERE tablename = 'siswa_halaqoh') AS n_siswa_halaqoh
    FROM pg_policies
    WHERE schemaname = 'agenda' AND tablename IN ('halaqoh', 'siswa_halaqoh')
),
-- Data jadwal yang sudah ada (hasil impor 2026/2027).
jadwal AS (
    SELECT
        count(*) AS total,
        count(*) FILTER (WHERE halaqoh_id IS NOT NULL) AS berhalaqoh
    FROM agenda.schedule
    WHERE status <> 'ARCHIVED'
),
-- Baris Ummi: inilah yang nanti dipecah per halaqoh.
ummi AS (
    SELECT count(*) AS n
    FROM agenda.schedule s
    JOIN agenda.mapel m ON m.id = s.subject_id
    WHERE s.status <> 'ARCHIVED'
      AND (lower(m.nama_mapel) LIKE '%ummi%' OR lower(m.nama_mapel) LIKE '%umi%')
)

SELECT 1 AS urut, 'A. Tabel baru Fase 1' AS pemeriksaan,
       CASE WHEN (SELECT ada_halaqoh AND ada_siswa_halaqoh FROM tabel)
            THEN 'OK' ELSE 'PERIKSA' END AS status,
       format('halaqoh: %s | siswa_halaqoh: %s',
              CASE WHEN (SELECT ada_halaqoh FROM tabel) THEN 'ADA' ELSE 'TIDAK ADA' END,
              CASE WHEN (SELECT ada_siswa_halaqoh FROM tabel) THEN 'ADA' ELSE 'TIDAK ADA' END)
       AS keterangan

UNION ALL
SELECT 2, 'B. Kolom halaqoh_id',
       CASE WHEN (SELECT ada_sch_halaqoh_id AND ada_kbm_halaqoh_id FROM tabel)
            THEN 'OK' ELSE 'PERIKSA' END,
       format('schedule.halaqoh_id: %s | agenda_kbm.halaqoh_id: %s',
              CASE WHEN (SELECT ada_sch_halaqoh_id FROM tabel) THEN 'ADA' ELSE 'TIDAK ADA' END,
              CASE WHEN (SELECT ada_kbm_halaqoh_id FROM tabel) THEN 'ADA' ELSE 'TIDAK ADA' END)

UNION ALL
SELECT 3, 'C. Extension btree_gist',
       CASE WHEN (SELECT ada FROM ext) THEN 'OK' ELSE 'PERIKSA' END,
       CASE WHEN (SELECT ada FROM ext)
            THEN 'Terpasang — exclusion constraint bisa dibuat.'
            ELSE 'BELUM terpasang. Jalankan CREATE EXTENSION btree_gist; dan cek hak akses.'
       END

UNION ALL
SELECT 4, 'D. Penjaga bentrok halaqoh',
       CASE WHEN (SELECT n_halaqoh FROM cons) = 1 THEN 'OK' ELSE 'PERIKSA' END,
       CASE WHEN (SELECT n_halaqoh FROM cons) = 1
            THEN 'excl_schedule_halaqoh_overlap terpasang. Dua halaqoh di kelas sama pada jam sama SAH; satu halaqoh tidak boleh tumpang-tindih.'
            ELSE format('Ditemukan %s constraint (seharusnya 1). Penjaga halaqoh TIDAK aktif.', (SELECT n_halaqoh FROM cons))
       END

UNION ALL
SELECT 5, 'E. Penjaga bentrok guru',
       CASE WHEN (SELECT n_guru FROM cons) = 1 THEN 'OK' ELSE 'PERIKSA' END,
       CASE WHEN (SELECT n_guru FROM cons) = 1
            THEN 'excl_schedule_teacher_overlap terpasang. Satu guru tidak bisa di dua tempat pada jam sama.'
            ELSE format('Ditemukan %s constraint (seharusnya 1). Penjaga guru TIDAK aktif.', (SELECT n_guru FROM cons))
       END

UNION ALL
SELECT 6, 'F. Kebijakan RLS tabel halaqoh',
       CASE WHEN (SELECT n_halaqoh FROM rls) = 2 AND (SELECT n_siswa_halaqoh FROM rls) = 2
            THEN 'OK' ELSE 'PERIKSA' END,
       format('halaqoh: %s kebijakan | siswa_halaqoh: %s kebijakan (masing-masing diharapkan 2: baca + tulis)',
              (SELECT n_halaqoh FROM rls), (SELECT n_siswa_halaqoh FROM rls))

UNION ALL
SELECT 7, 'G. Jadwal berjalan',
       'OK',
       format('%s baris jadwal aktif, %s di antaranya sudah berhalaqoh',
              (SELECT total FROM jadwal), (SELECT berhalaqoh FROM jadwal))

UNION ALL
SELECT 8, 'H. Baris Ummi menunggu Fase 3',
       CASE WHEN (SELECT n FROM ummi) = 0 THEN 'CATATAN' ELSE 'OK' END,
       CASE WHEN (SELECT n FROM ummi) = 0
            THEN 'Belum ada baris Ummi di jadwal.'
            ELSE format('%s baris Ummi kini masih satu guru per kelas (belum dipecah per halaqoh). '
                        'Ini pekerjaan Fase 3, bukan cacat Fase 1.', (SELECT n FROM ummi))
       END

ORDER BY urut;
