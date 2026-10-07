-- =============================================================================
-- HAPUS SEMUA SISWA (SIAJAR) — hanya baris `agenda.siswa` dan turunannya
-- =============================================================================
--
-- ⚠️  BACA DULU SEBELUM MENJALANKAN
-- ---------------------------------
-- Skrip ini menghapus PERMANEN **seluruh** baris `agenda.siswa` — siswa asli
-- maupun siswa uji. Tidak ada undo.
--
-- Pastikan sudah punya backup (Dashboard Supabase → Database → Backups, atau
-- `pg_dump`) sebelum menjalankannya.
--
--
-- CARA PAKAI (PENTING — BACA SAMPAI HABIS)
-- ----------------------------------------
-- Skrip ini MEMANG sengaja tidak menghapus apa pun pada percobaan pertama.
-- Namanya DRY-RUN, tujuannya supaya Anda melihat dulu berapa baris yang akan
-- kena. Untuk benar-benar menghapus, ubah TIGA baris `v_confirm := false`
-- menjadi `v_confirm := true`:
--
--     BAGIAN B1  (longsor)   v_confirm := false   -> true
--     BAGIAN B2  (anak)      v_confirm := false   -> true
--     BAGIAN B3  (siswa)     v_confirm := false   -> true
--
-- lalu jalankan berkas ini lagi.
--
-- Ada TIGA blok (bukan satu) karena Supabase SQL Editor mengirim tiap
-- pernyataan ke sesi database BERBEDA. `DO $$ … $$;` adalah SATU pernyataan,
-- sehingga bila DELETE keempat gagal di tengah (mis. ditolak FK), transaksi
-- sudah telanjur sukses — data jadi setengah terhapus tanpa cara kembali.
-- Tiga pernyataan terpisah = tiga transaksi, masing-masing atomik, dan yang
-- sudah selesai tetap selesai.
--
--
-- APA YANG IKUT TERHAPUS (otomatis, lewat ON DELETE CASCADE)
-- ----------------------------------------------------------
--   agenda.siswa_kelas       — penempatan kelas per tahun ajaran
--   agenda.siswa_halaqoh     — keanggotaan halaqoh per tahun ajaran
--   agenda.agenda_absensi    — baris kehadiran siswa (status S/I/A)
--   agenda.promotion_log     — riwayat kenaikan kelas
--
-- Keempatnya `REFERENCES agenda.siswa(id) ON DELETE CASCADE`. Dihapus eksplisit
-- di B2 supaya kuat terhadap FK — yang bila kelak diubah menjadi RESTRICT, hapus
-- siswa di B3 tetap berhasil.
--
--
-- APA YANG **TIDAK** DISENTUH (sengaja)
-- -------------------------------------
--   * `agenda.guru`, `mapel`, `kelas`, `academic_year`, `period_templates`,
--     `schedule`, `homeroom_assignment`, `halaqoh` — master & jadwal tetap utuh.
--     Guru tidak kehilangan jadwalnya; halaman jadwal masih berfungsi.
--   * `agenda.agenda_header` / `agenda_kbm` / `agenda_kejadian` / `agenda_evidence`
--     — jurnal tetap ada. HANYA baris `agenda_absensi` yang hilang, sehingga
--     jurnal lama akan tampil "Hadir lengkap" (0 ketidakhadiran). Ini konsekuensi
--     wajar: tanpa daftar siswa, nama yang tidak hadir tidak bisa ditampilkan.
--   * `auth.*` — akun login tetap ada, Anda masih bisa masuk.
--   * `agenda.app_settings`, `kotak_saran`, `substitutions` — tidak berkaitan.
--
-- Bila maksud Anda sebenarnya mengosongkan **seluruh** aplikasi (guru, kelas,
-- jadwal, jurnal — semuanya), pakai `wipe_all_app_data.sql`, bukan berkas ini.
-- =============================================================================


-- #############################################################################
-- BAGIAN A — HITUNG ISI SEBELUM DIHAPUS (aman, tidak menghapus apa pun)
-- #############################################################################
SELECT 'siswa'            AS tabel, COUNT(*) AS jumlah FROM agenda.siswa
UNION ALL SELECT 'siswa_kelas',        COUNT(*) FROM agenda.siswa_kelas
UNION ALL SELECT 'siswa_halaqoh',      COUNT(*) FROM agenda.siswa_halaqoh
UNION ALL SELECT 'agenda_absensi',     COUNT(*) FROM agenda.agenda_absensi
UNION ALL SELECT 'promotion_log',      COUNT(*) FROM agenda.promotion_log
ORDER BY tabel;


-- #############################################################################
-- BAGIAN B1 — LONGSOR ABSENSI (anak paling dalam)
-- #############################################################################
-- `agenda_absensi.agenda_id` menunjuk ke `agenda_header` (masih hidup), dan
-- `siswa_id` menunjuk ke `siswa`. Ini satu-satunya anak yang bergantung pada
-- siswa DAN bukan milik siswa — harus dilongser lebih dulu, kalau tidak hapus
-- siswa di B3 akan menyeret baris absensi secara diam-diam lewat CASCADE
-- (yang sebenarnya sama saja, tapi tidak terlihat berapa banyak).
DO $$
DECLARE
    v_confirm boolean := false;   -- <<< UBAH KE true UNTUK BENAR-BENAR MENGHAPUS
    v_n integer;
BEGIN
    IF NOT v_confirm THEN
        RAISE NOTICE '=== DRY-RUN B1: tidak ada yang dihapus. Ubah v_confirm ke true. ===';
        RETURN;
    END IF;

    DELETE FROM agenda.agenda_absensi;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'B1 selesai: % baris absensi terhapus.', v_n;
END $$;


-- #############################################################################
-- BAGIAN B2 — LONGSOR ANAK SISWA
-- #############################################################################
DO $$
DECLARE
    v_confirm boolean := false;   -- <<< UBAH KE true UNTUK BENAR-BENAR MENGHAPUS
    v_h integer;
    v_k integer;
    v_p integer;
BEGIN
    IF NOT v_confirm THEN
        RAISE NOTICE '=== DRY-RUN B2: tidak ada yang dihapus. Ubah v_confirm ke true. ===';
        RETURN;
    END IF;

    DELETE FROM agenda.siswa_halaqoh;  GET DIAGNOSTICS v_h = ROW_COUNT;
    DELETE FROM agenda.siswa_kelas;    GET DIAGNOSTICS v_k = ROW_COUNT;
    DELETE FROM agenda.promotion_log;  GET DIAGNOSTICS v_p = ROW_COUNT;
    RAISE NOTICE 'B2 selesai: halaqoh=% | penempatan kelas=% | promotion_log=%',
                 v_h, v_k, v_p;
END $$;


-- #############################################################################
-- BAGIAN B3 — LONGSOR SISWA (inti)
-- #############################################################################
DO $$
DECLARE
    v_confirm boolean := false;   -- <<< UBAH KE true UNTUK BENAR-BENAR MENGHAPUS
    v_n integer;
BEGIN
    IF NOT v_confirm THEN
        RAISE NOTICE '=== DRY-RUN B3: tidak ada yang dihapus. Ubah v_confirm ke true. ===';
        RETURN;
    END IF;

    DELETE FROM agenda.siswa;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'B3 selesai: % siswa terhapus.', v_n;
END $$;


-- #############################################################################
-- BAGIAN C — HASIL (satu query, karena hanya hasil terakhir yang tampil)
-- #############################################################################
SELECT 'HASIL AKHIR'::text AS keterangan,
       (
           'siswa: '            || (SELECT COUNT(*) FROM agenda.siswa)
           || '  |  kelas: '    || (SELECT COUNT(*) FROM agenda.siswa_kelas)
           || '  |  halaqoh: '  || (SELECT COUNT(*) FROM agenda.siswa_halaqoh)
           || '  |  absensi: '  || (SELECT COUNT(*) FROM agenda.agenda_absensi)
           || '  |  promosi: '  || (SELECT COUNT(*) FROM agenda.promotion_log)
       )::text AS isi,
       -- Penanda status supaya jelas apakah ini masih dry-run atau sudah jalan.
       CASE
           WHEN (SELECT COUNT(*) FROM agenda.siswa) = 0
                THEN 'SELESAI — semua siswa sudah terhapus.'
           ELSE 'MASIH ADA ISI — kemungkinan v_confirm belum diubah ke true.'
       END::text AS status;


-- #############################################################################
-- PEMBERSIHAN (opsional) — hapus kelas rombel B yang jadi kosong
-- #############################################################################
-- Setelah semua siswa hilang, kelas seperti 1B / 2B bisa menjadi kosong tak
-- terpakai. Blok ini SENGAJA dikomentari supaya kelas tidak ikut terbuang tanpa
-- Anda sadari — kelas adalah master yang dipakai jadwal, wali kelas, dan riwayat.
--
-- Bila memang ingin dibuang: batalkan komentar, lalu jalankan.
-- Syaratnya masih sama seperti `stage_9_0_seed_siswa_uji_HAPUS.sql`: hanya kelas
-- yang benar-benar tidak lagi dipakai siswa, wali kelas, maupun jadwal.
--
-- DELETE FROM agenda.kelas k
--  WHERE NOT EXISTS (SELECT 1 FROM agenda.siswa_kelas       sk WHERE sk.kelas_id = k.id)
--    AND NOT EXISTS (SELECT 1 FROM agenda.homeroom_assignment h WHERE h.kelas_id  = k.id)
--    AND NOT EXISTS (SELECT 1 FROM agenda.schedule          sc WHERE sc.kelas_id = k.id);
