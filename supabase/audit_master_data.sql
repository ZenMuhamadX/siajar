-- =============================================================================
-- AUDIT MASTER DATA — HANYA MEMBACA. Tidak mengubah apa pun.
-- =============================================================================
-- Jalankan seluruh berkas ini di Supabase SQL Editor, lalu SALIN SELURUH HASIL
-- tabelnya (bagian | isi) dan kirimkan kembali.
--
-- Tujuannya: menyusun jadwal dengan MERUJUK master data yang sudah ada
-- (guru, mapel, kelas, jam pelajaran) — bukan membuat ulang. Sebelum tahu isi
-- sebenarnya, jadwal apa pun hanya menebak nama mapel dan nomor JP.
-- =============================================================================

SET search_path TO agenda, public;

SELECT urut, bagian, isi
FROM (

    -- 1. Tahun ajaran ---------------------------------------------------------
    SELECT 1 AS urut, '1. TAHUN AJARAN' AS bagian,
           coalesce(
               string_agg(
                   name
                   || '  [' || status || ']  '
                   || to_char(start_date, 'DD Mon YYYY') || ' s/d '
                   || to_char(end_date, 'DD Mon YYYY'),
                   E'\n' ORDER BY start_date
               ),
               '(kosong — belum ada tahun ajaran)'
           ) AS isi
    FROM agenda.academic_year

    UNION ALL

    -- 2. Jam pelajaran (JP) ---------------------------------------------------
    -- Paling penting. Nomor JP di jadwal HARUS memakai nomor yang sudah
    -- didefinisikan di sini, bukan nomor baru.
    SELECT 2, '2. JAM PELAJARAN (JP) per tahun ajaran',
           coalesce(
               string_agg(
                   rpad(ay.name, 12)
                   || ' JP ' || lpad(pt.period_number::text, 2, '0')
                   || '  ' || to_char(pt.start_time, 'HH24:MI')
                   || '-' || to_char(pt.end_time, 'HH24:MI')
                   || '  "' || pt.label || '"'
                   || CASE WHEN pt.is_active THEN '' ELSE '  [nonaktif]' END,
                   E'\n' ORDER BY ay.name, pt.period_number
               ),
               '(kosong — jam pelajaran belum didefinisikan)'
           )
    FROM agenda.period_templates pt
    JOIN agenda.academic_year ay ON ay.id = pt.academic_year_id

    UNION ALL

    -- 3. Mata pelajaran -------------------------------------------------------
    -- Nama di sini yang jadi acuan. Excel memakai singkatan (B.INDO, MTK),
    -- jadi pencocokannya harus tahu nama resmi yang dipakai aplikasi.
    SELECT 3, '3. MATA PELAJARAN',
           coalesce(
               string_agg(
                   rpad(nama_mapel, 22)
                   || coalesce('warna=' || warna, 'warna=(otomatis)'),
                   E'\n' ORDER BY nama_mapel
               ),
               '(kosong — mata pelajaran belum didefinisikan)'
           )
    FROM agenda.mapel

    UNION ALL

    -- 4. Kelas ----------------------------------------------------------------
    SELECT 4, '4. KELAS',
           coalesce(
               string_agg(
                   'tingkat=' || tingkat
                   || '  rombel=' || rombel
                   || '  label="' || label || '"'
                   || CASE WHEN is_active THEN '' ELSE '  [nonaktif]' END,
                   E'\n' ORDER BY tingkat, rombel
               ),
               '(kosong — kelas belum didefinisikan)'
           )
    FROM agenda.kelas

    UNION ALL

    -- 5. Guru -----------------------------------------------------------------
    SELECT 5, '5. GURU (' || count(*)::text || ' orang)',
           coalesce(
               string_agg(nama_guru, E'\n' ORDER BY nama_guru),
               '(kosong)'
           )
    FROM agenda.guru

    UNION ALL

    -- 6. Wali kelas -----------------------------------------------------------
    SELECT 6, '6. WALI KELAS per tahun ajaran',
           coalesce(
               string_agg(
                   rpad(ay.name, 12) || rpad(k.label, 5) || ' -> ' || ha.teacher_name,
                   E'\n' ORDER BY ay.name, k.label
               ),
               '(kosong — wali kelas belum ditetapkan)'
           )
    FROM agenda.homeroom_assignment ha
    JOIN agenda.academic_year ay ON ay.id = ha.academic_year_id
    JOIN agenda.kelas k ON k.id = ha.kelas_id

    UNION ALL

    -- 7. Siswa ----------------------------------------------------------------
    SELECT 7, '7. SISWA (' || count(*)::text || ' orang)',
           coalesce(
               string_agg(
                   rpad(s.nama_siswa, 30)
                   || ' [' || s.status || ']'
                   || coalesce('  nis=' || s.nis, '  nis=-'),
                   E'\n' ORDER BY s.nama_siswa
               ),
               '(kosong — data siswa belum diisi)'
           )
    FROM agenda.siswa s

    UNION ALL

    -- 8. Penempatan siswa per tahun ajaran ------------------------------------
    SELECT 8, '8. PENEMPATAN SISWA per tahun ajaran',
           coalesce(
               string_agg(
                   rpad(ay.name, 12) || rpad(k.label, 5)
                   || ' : ' || cnt::text || ' siswa',
                   E'\n' ORDER BY ay.name, k.label
               ),
               '(kosong — belum ada penempatan)'
           )
    FROM (
        SELECT sk.academic_year_id, sk.kelas_id, count(*) AS cnt
        FROM agenda.siswa_kelas sk
        GROUP BY sk.academic_year_id, sk.kelas_id
    ) x
    JOIN agenda.academic_year ay ON ay.id = x.academic_year_id
    JOIN agenda.kelas k ON k.id = x.kelas_id

    UNION ALL

    -- 9. Jadwal yang sudah ada ------------------------------------------------
    SELECT 9, '9. JADWAL yang sudah ada',
           coalesce(
               string_agg(
                   rpad(ay.name, 12)
                   || ' : ' || cnt::text || ' baris jadwal',
                   E'\n' ORDER BY ay.name
               ),
               '(kosong — belum ada jadwal)'
           )
    FROM (
        SELECT academic_year_id, count(*) AS cnt
        FROM agenda.schedule
        WHERE status <> 'ARCHIVED'
        GROUP BY academic_year_id
    ) y
    JOIN agenda.academic_year ay ON ay.id = y.academic_year_id

) t
ORDER BY urut;
