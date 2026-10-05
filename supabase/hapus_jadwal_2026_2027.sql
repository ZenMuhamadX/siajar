-- =============================================================================
-- HAPUS JADWAL PELAJARAN 2026/2027 — SDIT AS-SYIFA
-- =============================================================================
-- Menghapus HANYA baris jadwal (tabel `schedule`) untuk tahun ajaran 2026/2027.
--
-- Yang TIDAK disentuh:
--   - siswa, penempatan siswa, absensi, agenda, catatan kejadian
--   - guru, mapel, kelas, wali kelas
--   - tahun ajaran lain
--
-- Yang ikut dibersihkan (karena menunjuk ke jadwal yang dihapus):
--   - agenda.substitutions  -> data badal untuk jadwal ini
--   - agenda.agenda_header.schedule_id -> di-set NULL (baris agendanya tetap ada)
--
-- Urutannya penting: `substitutions.schedule_id` memakai ON DELETE RESTRICT,
-- jadi baris badal harus dihapus lebih dulu — kalau tidak, penghapusan jadwal
-- akan ditolak oleh kunci asing.
--
-- Jalankan seluruh berkas ini sekaligus (satu transaksi). Kalau ada yang gagal,
-- COMMIT tidak pernah tercapai dan tidak ada yang berubah.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Periksa dulu apa yang akan terhapus. Jalankan SELECT ini untuk melihat
--    angkanya SEBELUM menghapus. Kalau angkanya tidak sesuai harapan, ketik
--    ROLLBACK; dan berhenti.
-- -----------------------------------------------------------------------------
SELECT
    (SELECT count(*) FROM agenda.schedule s
      JOIN agenda.academic_year ay ON ay.id = s.academic_year_id
     WHERE ay.name = '2026/2027')                     AS jadwal_akan_dihapus,
    (SELECT count(*) FROM agenda.substitutions sub
      JOIN agenda.schedule s ON s.id = sub.schedule_id
      JOIN agenda.academic_year ay ON ay.id = s.academic_year_id
     WHERE ay.name = '2026/2027')                     AS badal_akan_dihapus,
    (SELECT count(*) FROM agenda.agenda_header ah
      JOIN agenda.schedule s ON s.id = ah.schedule_id
      JOIN agenda.academic_year ay ON ay.id = s.academic_year_id
     WHERE ay.name = '2026/2027')                     AS agenda_akan_dilepas;

-- -----------------------------------------------------------------------------
-- 2. Hapus data badal yang menunjuk ke jadwal ini (harus lebih dulu).
-- -----------------------------------------------------------------------------
DELETE FROM agenda.substitutions sub
USING agenda.schedule s, agenda.academic_year ay
WHERE sub.schedule_id = s.id
  AND s.academic_year_id = ay.id
  AND ay.name = '2026/2027';

-- -----------------------------------------------------------------------------
-- 3. Lepaskan tautan agenda ke jadwal. Baris agendanya TIDAK dihapus — agenda
--    adalah catatan mengajar guru; yang hilang hanya kaitannya ke slot jadwal.
-- -----------------------------------------------------------------------------
UPDATE agenda.agenda_header ah
SET schedule_id = NULL
FROM agenda.schedule s, agenda.academic_year ay
WHERE ah.schedule_id = s.id
  AND s.academic_year_id = ay.id
  AND ay.name = '2026/2027';

-- -----------------------------------------------------------------------------
-- 4. Hapus jadwalnya.
-- -----------------------------------------------------------------------------
DELETE FROM agenda.schedule s
USING agenda.academic_year ay
WHERE s.academic_year_id = ay.id
  AND ay.name = '2026/2027';

-- -----------------------------------------------------------------------------
-- 5. Ringkasan hasil. Angka `sisa_jadwal` harus 0.
-- -----------------------------------------------------------------------------
SELECT
    (SELECT count(*) FROM agenda.schedule s
      JOIN agenda.academic_year ay ON ay.id = s.academic_year_id
     WHERE ay.name = '2026/2027')                     AS sisa_jadwal,
    (SELECT count(*) FROM agenda.schedule s)           AS total_jadwal_semua_tahun,
    (SELECT count(*) FROM agenda.academic_year
      WHERE name = '2026/2027')                       AS tahun_ajaran_masih_ada;

COMMIT;

-- =============================================================================
-- CATATAN
-- =============================================================================
-- Kalau setelah menjalankan ini Anda ingin memasukkan jadwalnya lagi, cukup
-- tempel ulang `supabase/seed_jadwal_2026_2027.sql`. Tidak ada yang permanen.
--
-- Kalau Anda ingin menghapus jadwal SEMUA tahun ajaran, ubah tiga syarat
-- `ay.name = '2026/2027'` di atas menjadi tanpa syarat tahun — tetapi
-- pastikan dulu lewat SELECT di bagian 1.
-- =============================================================================
