-- =============================================================================
-- STAGE 9.0 — HAPUS DATA SISWA UJI
-- =============================================================================
-- Menghapus SEMUA yang dibuat oleh `stage_9_0_seed_siswa_uji.sql`:
--   * 45 siswa uji (NIS berawalan 'ZZ', nama 'ZZ Uji ...')
--   * penempatan kelasnya di `siswa_kelas`
--   * kelas rombel 'B' untuk tingkat 1 dan 2 HANYA JIKA kosong dari siswa nyata
--
-- AMAN terhadap data nyata
--   Pembersihan siswa memakai penanda NIS 'ZZ%' — tidak ada siswa sungguhan yang
--   tersentuh. Kelas 1B/2B hanya dihapus kalau benar-benar tidak ada siswa nyata
--   yang menempatinya; kalau ada, kelasnya DIBIARKAN dan itu dilaporkan.
--
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run.
-- =============================================================================

SET search_path TO agenda, public;

-- =============================================================================
-- LANGKAH 1 — Lepas keanggotaan halaqoh siswa uji
-- =============================================================================
-- Harus lebih dulu: siswa_halaqoh.siswa_id -> RESTRICT/CASCADE tergantung FK.
-- Dihapus eksplisit supaya tidak bergantung pada perilaku FK.

DELETE FROM agenda.siswa_halaqoh
 WHERE siswa_id IN (SELECT id FROM agenda.siswa WHERE nis LIKE 'ZZ%');

-- =============================================================================
-- LANGKAH 2 — Hapus penempatan kelas siswa uji
-- =============================================================================

DELETE FROM agenda.siswa_kelas
 WHERE siswa_id IN (SELECT id FROM agenda.siswa WHERE nis LIKE 'ZZ%');

-- =============================================================================
-- LANGKAH 3 — Hapus siswanya
-- =============================================================================

DELETE FROM agenda.siswa WHERE nis LIKE 'ZZ%';

-- =============================================================================
-- LANGKAH 4 — Hapus kelas 1B / 2B, HANYA bila sudah tidak berisi siapa pun
-- =============================================================================
-- `kelas` adalah master yang dipakai jadwal, wali kelas, dan riwayat. Menghapus
-- kelas yang masih dipakai akan ditolak FK (ON DELETE RESTRICT) atau — lebih
-- buruk — meninggalkan rujukan menggantung. Jadi diperiksa dulu.

DELETE FROM agenda.kelas k
 WHERE k.tingkat IN (1, 2)
   AND k.rombel = 'B'
   AND NOT EXISTS (SELECT 1 FROM agenda.siswa_kelas sk WHERE sk.kelas_id = k.id)
   AND NOT EXISTS (SELECT 1 FROM agenda.homeroom_assignment h WHERE h.kelas_id = k.id)
   AND NOT EXISTS (SELECT 1 FROM agenda.schedule sc WHERE sc.kelas_id = k.id);

-- =============================================================================
-- LANGKAH 5 — HASIL (satu query)
-- =============================================================================

SELECT 'PEMBERSIHAN SELESAI'::text AS "keterangan",
       (
           'siswa uji tersisa: ' || (SELECT count(*) FROM agenda.siswa WHERE nis LIKE 'ZZ%')
           || '  |  penempatan tersisa: ' || (
               SELECT count(*) FROM agenda.siswa_kelas sk
                 JOIN agenda.siswa s ON s.id = sk.siswa_id
                WHERE s.nis LIKE 'ZZ%'
           )
           || '  |  kelas 1B/2B tersisa: ' || (
               SELECT count(*) FROM agenda.kelas
                WHERE tingkat IN (1, 2) AND rombel = 'B'
           )
       )::text AS "isi";
