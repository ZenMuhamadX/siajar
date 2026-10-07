-- =============================================================================
-- DIAGNOSA — "kenapa siswa tidak terhapus?" (baca-saja, TIDAK menghapus apa pun)
-- =============================================================================
-- Jalankan di Supabase SQL Editor. Hanya menghasilkan SATU tabel.
--
-- Tujuannya menjawab dua kemungkinan sekaligus:
--
--   1. `v_confirm` masih `false` di `hapus_semua_siswa.sql` → memang sengaja
--      tidak menghapus apa pun (dry-run). Kalau isinya masih banyak, ini
--      penyebabnya — bukan bug.
--
--   2. Ada FK yang memakai `ON DELETE RESTRICT` sehingga DELETE ditolak.
--      Baris pertama menyebutkannya. Kalau ada, hapus siswa memang MUSTAHIL
--      sampai FK itu ditangani lebih dulu.
--
-- Baris terakhir memberi "vonis": apa langkah berikutnya.
-- =============================================================================

WITH isi AS (
    SELECT 'siswa'           AS tabel, COUNT(*) AS jumlah FROM agenda.siswa
    UNION ALL SELECT 'siswa_kelas',       COUNT(*) FROM agenda.siswa_kelas
    UNION ALL SELECT 'siswa_halaqoh',     COUNT(*) FROM agenda.siswa_halaqoh
    UNION ALL SELECT 'agenda_absensi',    COUNT(*) FROM agenda.agenda_absensi
    UNION ALL SELECT 'promotion_log',     COUNT(*) FROM agenda.promotion_log
),
penghalang AS (
    -- FK apa pun yang menunjuk ke agenda.siswa dengan aturan RESTRICT/NO ACTION.
    -- CASCADE tidak dihitung: itu justru membuat hapus berhasil.
    SELECT string_agg(
               format('agenda.%s.%s (%s)', c.conrelid::regclass::text, a.attname, c.confdeltype),
               ' | ' ORDER BY c.conrelid::regclass::text
           ) AS daftar
      FROM pg_constraint c
      JOIN unnest(c.conkey) AS k(attnum) ON true
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum   = k.attnum
     WHERE c.contype = 'f'
       AND c.confrelid = 'agenda.siswa'::regclass
       AND c.confdeltype IN ('r', 'a')   -- r = RESTRICT, a = NO ACTION
)
SELECT tabel, jumlah, '' AS keterangan FROM isi
UNION ALL
SELECT '--- FK penghalang (RESTRICT/NO ACTION) ---',
       0,
       COALESCE((SELECT daftar FROM penghalang), 'tidak ada — hapus siswa TIDAK akan ditolak FK')
UNION ALL
SELECT
    '--- VONIS ---',
    0,
    CASE
        WHEN (SELECT COUNT(*) FROM isi WHERE tabel = 'siswa') = 0
            THEN 'Kosong: penghapusan SUDAH berhasil. Tidak ada yang perlu dikerjakan.'
        WHEN (SELECT daftar FROM penghalang) IS NOT NULL
            THEN 'Ada FK penghalang di atas. Ketiga blok harus dijalankan, dan blok yang GAGAL akan tampil sebagai error di editor ini.'
        ELSE 'Masih ada siswa & tidak ada FK penghalang. Penyebabnya v_confirm masih false — ubah ketiga v_confirm ke true di hapus_semua_siswa.sql lalu jalankan lagi.'
    END
ORDER BY tabel;
