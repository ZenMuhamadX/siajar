-- =============================================================================
-- FASE 0 — PEMERIKSAAN SEBELUM HALAQOH (READ-ONLY, SATU HASIL)
-- =============================================================================
-- Skrip ini HANYA MEMBACA. Tidak ada INSERT/UPDATE/DELETE/ALTER di dalamnya.
--
-- KENAPA DITULIS SEBAGAI SATU QUERY
-- Supabase SQL Editor hanya menampilkan TABEL HASIL TERAKHIR. Skrip yang berisi
-- beberapa SELECT membuat hasil-hasil sebelumnya hilang begitu query berikutnya
-- berjalan — terlihat seolah "hasilnya tidak muncul". Karena itu seluruh
-- pemeriksaan di sini disatukan menjadi SATU SELECT, sehingga apa pun yang
-- dikembalikan langsung terlihat semua sekaligus.
--
-- CARA PAKAI
--   1. Buka Supabase → SQL Editor → New query.
--   2. Tempel SELURUH isi berkas ini.
--   3. Klik Run. Akan muncul SATU tabel.
--   4. Klik kanan tabelnya → "Copy as Markdown" (atau Download CSV),
--      lalu kirimkan isinya ke saya.
--
-- CARA MEMBACA
--   Kolom `status`:
--     PERIKSA  — ada yang harus dibereskan sebelum Fase 1 dipasang.
--     AMAN/OK  — tidak ada masalah.
--     CATATAN  — bukan masalah, tetapi perlu diketahui.
--
-- Yang dicari: aturan baru (Fase 1) melarang satu guru punya dua jadwal pada
-- hari & jam yang sama. Kalau sudah ada data yang melanggar, constraint GAGAL
-- dipasang — jadi kita cari lebih dulu, baru pasang.
-- =============================================================================

WITH
-- Pasangan guru yang bertumpuk pada hari & jam yang sama.
-- Perbandingan memakai teacher_id bila ada, jatuh ke nama bila id kosong —
-- persis logika yang akan dipakai constraint.
guru_bentrok AS (
    SELECT
        a.day,
        a.teacher_name   AS guru,
        a.subject_name   AS mapel_a,
        b.subject_name   AS mapel_b,
        a.start_time::time AS mulai_a,
        a.end_time::time   AS selesai_a,
        b.start_time::time AS mulai_b,
        b.end_time::time   AS selesai_b
    FROM agenda.schedule a
    JOIN agenda.schedule b
      ON a.academic_year_id = b.academic_year_id
     AND a.day = b.day
     AND a.id < b.id
     AND a.status <> 'ARCHIVED'
     AND b.status <> 'ARCHIVED'
     AND COALESCE(a.teacher_id::text, lower(btrim(a.teacher_name)))
       = COALESCE(b.teacher_id::text, lower(btrim(b.teacher_name)))
     -- Tumpang-tindih ketat. Jam berdempet (07:45 setelah 07:00-07:45)
     -- TIDAK dianggap bentrok.
     AND GREATEST(a.start_time, b.start_time) < LEAST(a.end_time, b.end_time)
)

-- =============================================================================
-- HASIL — satu tabel, enam baris. Semua tampil sekaligus.
--
-- Teks disusun dengan format(), yang mengubah angka/tanggal ke teks sendiri —
-- jauh lebih tahan salah daripada merangkai dengan `||` lalu menambah `::text`
-- di mana-mana.
-- =============================================================================

-- 1. Ringkasan umum
SELECT 1 AS urut, 'A. Ringkasan' AS pemeriksaan, 'OK' AS status,
       format('Total jadwal: %s | arsip: %s | tahun ajaran aktif: %s | kelas aktif: %s | siswa aktif: %s',
              (SELECT count(*) FROM agenda.schedule),
              (SELECT count(*) FROM agenda.schedule WHERE status = 'ARCHIVED'),
              COALESCE((SELECT name FROM agenda.academic_year WHERE status = 'ACTIVE' LIMIT 1), '(tidak ada)'),
              (SELECT count(*) FROM agenda.kelas WHERE is_active),
              (SELECT count(*) FROM agenda.siswa WHERE status = 'AKTIF'))
       AS keterangan

UNION ALL
-- 2. Guru bertumpuk — pemeriksaan terpenting
SELECT 2, 'B. Guru bentrok (harus KOSONG)',
       CASE WHEN count(*) = 0 THEN 'AMAN' ELSE 'PERIKSA' END,
       CASE WHEN count(*) = 0
            THEN 'Tidak ada guru yang punya dua jadwal pada hari & jam yang sama.'
            ELSE format('%s pasangan bentrok — akan MENOLAK constraint Fase 1: %s',
                        count(*),
                        string_agg(
                            format('%s pada %s %s-%s (%s) dan %s-%s (%s)',
                                   guru, day, mulai_a, selesai_a, mapel_a,
                                   mulai_b, selesai_b, mapel_b),
                            ' ;; '))
       END
FROM guru_bentrok

UNION ALL
-- 3. Guru tanpa teacher_id — constraint guru tidak bisa menjaganya
SELECT 3, 'C. Guru tanpa teacher_id',
       CASE WHEN n = 0 THEN 'OK' ELSE 'CATATAN' END,
       CASE WHEN n = 0
            THEN 'Semua baris jadwal punya teacher_id — constraint guru bekerja penuh.'
            ELSE format('%s baris belum punya teacher_id, sehingga TIDAK terpantau constraint guru. '
                        'Tidak menghalangi Fase 1, tetapi melemahkan penjagaan.', n)
       END
FROM (SELECT count(*) AS n FROM agenda.schedule
       WHERE teacher_id IS NULL AND status <> 'ARCHIVED') g

UNION ALL
-- 4. Mapel Ummi — dasar aturan "halaqoh wajib"
SELECT 4, 'D. Mapel Ummi terdeteksi',
       CASE WHEN count(*) = 0 THEN 'CATATAN' ELSE 'OK' END,
       CASE WHEN count(*) = 0
            THEN 'Tidak ada mapel yang namanya mengandung "ummi". Aturan halaqoh wajib perlu nama mapel yang jelas.'
            ELSE format('Ditemukan: %s',
                        string_agg(format('%s (%s baris)', m.nama_mapel, cnt.n), ', '))
       END
FROM agenda.mapel m
LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM agenda.schedule s
     WHERE s.subject_id = m.id AND s.status <> 'ARCHIVED'
) cnt ON TRUE
WHERE lower(m.nama_mapel) LIKE '%ummi%' OR lower(m.nama_mapel) LIKE '%umi%'

UNION ALL
-- 5. Siswa aktif tanpa kelas tahun ini — tidak bisa masuk halaqoh
SELECT 5, 'E. Siswa aktif tanpa kelas tahun ini',
       CASE WHEN n = 0 THEN 'AMAN' ELSE 'PERIKSA' END,
       CASE WHEN n = 0
            THEN 'Semua siswa aktif sudah ditempatkan di kelas tahun ajaran aktif.'
            ELSE format('%s siswa aktif belum punya kelas tahun ini, sehingga tidak bisa dimasukkan ke halaqoh mana pun.', n)
       END
FROM (
    SELECT count(*) AS n
    FROM agenda.siswa sw
    WHERE sw.status = 'AKTIF'
      AND NOT EXISTS (
          SELECT 1 FROM agenda.siswa_kelas sk
          JOIN agenda.academic_year ay ON ay.id = sk.academic_year_id
          WHERE sk.siswa_id = sw.id AND sk.status = 'AKTIF' AND ay.status = 'ACTIVE')
) x

UNION ALL
-- 6. Sebaran siswa per kelas — penentu jumlah halaqoh
SELECT 6,
       format('F.%s (tingkat %s)', k.label, k.tingkat),
       'OK',
       format('%s siswa aktif → perkiraan %s halaqoh%s',
              count(sw.id),
              GREATEST(1, CEIL(count(sw.id)::numeric / 15)),
              CASE WHEN count(sw.id) <= 15
                   THEN ' (kelas kecil: 1 halaqoh berisi seluruh kelas)' ELSE '' END)
FROM agenda.kelas k
LEFT JOIN agenda.siswa_kelas sk ON sk.kelas_id = k.id
LEFT JOIN agenda.siswa sw ON sw.id = sk.siswa_id AND sw.status = 'AKTIF'
LEFT JOIN agenda.academic_year ay ON ay.id = sk.academic_year_id AND ay.status = 'ACTIVE'
WHERE k.is_active AND (sw.id IS NULL OR ay.id IS NOT NULL)
GROUP BY k.id, k.label, k.tingkat

UNION ALL
-- 7. Baris Ummi pada jadwal yang sudah ada.
--    Impor `seed_jadwal_2026_2027.sql` mengisi 248 baris jadwal, termasuk
--    baris Ummi. Pemeriksaan ini menghitungnya sebagai BAHAN Fase 3.
--
--    SENGAJA TIDAK membaca `halaqoh_id`: berkas ini dijalankan SEBELUM
--    schema.sql Fase 1 dipasang, jadi kolom itu belum tentu ada. Membacanya
--    di sini akan menggagalkan SELURUH query (dan seluruh hasil pemeriksaan
--    lain ikut hilang). Pemeriksaan sesudah Fase 1 ada di `stage_8_2_*`.
SELECT 7, 'G. Baris Ummi pada jadwal berjalan',
       CASE WHEN count(*) = 0 THEN 'CATATAN' ELSE 'OK' END,
       CASE WHEN count(*) = 0
            THEN 'Belum ada baris Ummi di jadwal. Import jadwal dulu, atau Ummi belum dijadwalkan.'
            ELSE format('%s baris Ummi tersebar di %s kelas. Semuanya masih satu guru per kelas '
                        '(seluruh kelas). Fase 3 memecahnya jadi satu baris per halaqoh.',
                        count(*), count(DISTINCT s.kelas_id))
       END
FROM agenda.schedule s
JOIN agenda.mapel m ON m.id = s.subject_id
WHERE s.status <> 'ARCHIVED'
  AND (lower(m.nama_mapel) LIKE '%ummi%' OR lower(m.nama_mapel) LIKE '%umi%')

UNION ALL
-- 8. Kelengkapan master data yang dibutuhkan impor jadwal
SELECT 8, 'H. Kelengkapan master data',
       'OK',
       format('guru: %s | mapel: %s | kelas aktif: %s | jam pelajaran (JP): %s',
              (SELECT count(*) FROM agenda.guru),
              (SELECT count(*) FROM agenda.mapel),
              (SELECT count(*) FROM agenda.kelas WHERE is_active),
              (SELECT count(*) FROM agenda.period_templates))

ORDER BY urut, pemeriksaan;
