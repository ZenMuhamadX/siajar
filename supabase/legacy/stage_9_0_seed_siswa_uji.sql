-- =============================================================================
-- STAGE 9.0 — SEED DATA SISWA UJI UNTUK HALAQOH
-- =============================================================================
-- Untuk apa
--   Precheck Fase 0 menunjukkan `siswa aktif = 0`, sehingga menu Halaqoh
--   (Fase 2) tidak bisa diuji: tidak ada siswa yang bisa dibagi ke kelompok.
--   Skrip ini mengisi data uji secukupnya supaya pembagian halaqoh benar-benar
--   bisa dicoba.
--
-- Dibuat apa
--   Kelas 1A dan 1B  → masing-masing 15 siswa (cukup untuk 2 halaqoh @ ~7-8).
--   Kelas 2A dan 2B  → masing-masing 15 siswa (untuk menguji halaqoh di kelas
--                       lain sekaligus, sekaligus membuktikan halaqoh tidak
--                       tercampur antar kelas).
--   Total 60 siswa, semua lewat `siswa_kelas` di tahun ajaran AKTIF.
--
-- PENTING — ini data UJI, bukan data nyata
--   Semua siswa diberi NIS berawalan 'ZZ' dan nama 'ZZ Uji ...'.
--   Untuk menghapus SEMUANYA nanti, jalankan berkas pendampingnya:
--     supabase/legacy/stage_9_0_seed_siswa_uji_HAPUS.sql
--
-- -----------------------------------------------------------------------------
-- CATATAN: kenapa ditulis begini
-- -----------------------------------------------------------------------------
-- SQL Editor Supabase BUKAN satu sesi; tiap pernyataan dikirim ke sesi berbeda.
-- Karena itu di sini:
--   * TIDAK ada CREATE TEMP TABLE.
--   * TIDAK ada BEGIN/ROLLBACK.
--   * Setiap pernyataan berdiri sendiri.
--   * Hasil akhir = SATU query (editor hanya menampilkan hasil TERAKHIR).
-- =============================================================================

SET search_path TO agenda, public;

-- =============================================================================
-- BAGIAN 1 — SIAPKAN KELAS 1B DAN 2B (1A, 2A sudah ada dari seed bawaan)
-- =============================================================================
-- Kelas bawaan seed schema adalah 1A..6A. Kita tambah 1B supaya ada dua kelas
-- paralel untuk diuji, dan 2B supaya kelas lain juga punya pembanding.
-- ON CONFLICT DO NOTHING: menjalankan ulang tidak menghapus rombel buatan admin.

INSERT INTO agenda.kelas (tingkat, rombel, label)
VALUES
    (1, 'B', '1B'),
    (2, 'B', '2B')
ON CONFLICT (tingkat, rombel) DO NOTHING;

-- =============================================================================
-- BAGIAN 2 — BUAT SISWA UJI
-- =============================================================================
-- 15 siswa per kelas × 4 kelas (1A, 1B, 2A, 2B) = 60 siswa.
-- NIS-nya berpola tetap supaya mudah dikenali dan dihapus: 'ZZ' + tingkat +
-- rombel + nomor urut (mis. 'ZZ1A01').
--
-- Idempoten: `WHERE NOT EXISTS` pada NIS membuat menjalankan ulang tidak
-- menggandakan siswa. `nis` punya indeks unik parsial (`uq_siswa_nis`), jadi
-- penggandaan memang akan ditolak database — tetapi guard ini membuatnya
-- tidak pernah sampai ke titik itu.
--
-- CATATAN TAHUN AJARAN: skrip ini TIDAK membuat tahun ajaran baru. Ada indeks
-- unik parsial `idx_single_active_academic_year` yang hanya mengizinkan SATU
-- tahun berstatus ACTIVE, jadi membuat tahun baru akan gagal bila sudah ada.
-- Yang dipakai adalah tahun AKTIF yang sudah ada (lihat BAGIAN 3).

INSERT INTO agenda.siswa (nama_siswa, nis, status)
SELECT
    'ZZ Uji ' || k.label || ' Siswa ' || LPAD(n::text, 2, '0'),
    'ZZ' || k.tingkat || k.rombel || LPAD(n::text, 2, '0'),
    'AKTIF'
FROM (VALUES (1, 'A', '1A'), (1, 'B', '1B'), (2, 'A', '2A'), (2, 'B', '2B')) AS k(tingkat, rombel, label)
CROSS JOIN generate_series(1, 15) AS n
WHERE NOT EXISTS (
    SELECT 1 FROM agenda.siswa s
     WHERE s.nis = 'ZZ' || k.tingkat || k.rombel || LPAD(n::text, 2, '0')
);

-- =============================================================================
-- BAGIAN 3 — TEMPATKAN SISWA UJI KE KELASNYA (tahun ajaran aktif)
-- =============================================================================

INSERT INTO agenda.siswa_kelas (siswa_id, academic_year_id, kelas_id, status)
SELECT
    s.id,
    ay.id,
    k.id,
    'AKTIF'
FROM agenda.siswa s
JOIN agenda.kelas k
  ON s.nis = 'ZZ' || k.tingkat || k.rombel || SUBSTRING(s.nis FROM 5 FOR 2)
JOIN agenda.academic_year ay
  ON ay.status = 'ACTIVE'
WHERE s.nis LIKE 'ZZ%'
ON CONFLICT (siswa_id, academic_year_id) DO NOTHING;

-- =============================================================================
-- BAGIAN 4 — HASIL (satu query, supaya terlihat)
-- =============================================================================
-- Baris 1 : ringkasan
-- Baris 2 : judul kolom
-- Baris 3+: jumlah siswa uji per kelas

SELECT 'RINGKASAN'::text AS "kelas",
       (
           'siswa uji: ' || (SELECT count(*) FROM agenda.siswa WHERE nis LIKE 'ZZ%')
           || '  |  penempatan: ' || (
               SELECT count(*) FROM agenda.siswa_kelas sk
                 JOIN agenda.siswa s ON s.id = sk.siswa_id
                WHERE s.nis LIKE 'ZZ%'
           )
           || '  |  tahun AJARAN AKTIF: ' || COALESCE(
               (SELECT name FROM agenda.academic_year WHERE status = 'ACTIVE' LIMIT 1),
               'TIDAK ADA — buat dulu di menu Tahun Ajaran'
           )
       )::text AS "keterangan"

UNION ALL

SELECT 'kelas', 'jumlah siswa uji'

UNION ALL

SELECT
    k.label,
    count(*)::text
FROM agenda.kelas k
JOIN agenda.siswa_kelas sk ON sk.kelas_id = k.id
JOIN agenda.siswa s ON s.id = sk.siswa_id
WHERE s.nis LIKE 'ZZ%'
GROUP BY k.label
ORDER BY 1;
