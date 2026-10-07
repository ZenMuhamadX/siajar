-- =============================================================================
-- USANG — JANGAN DIPAKAI LAGI
-- =============================================================================
-- Berkas ini adalah versi LAMA berbasis `RAISE NOTICE`. Digantikan oleh:
--     stage_8_1_test_halaqoh_tabel.sql
-- yang menulis hasilnya ke tabel `public.hasil_uji`.
--
-- Alasannya: SQL Editor Supabase tidak punya tab "Messages"/"Logs", sehingga
-- hasil NOTICE tidak pernah terlihat. Selain itu versi ini berakhir dengan
-- beberapa SELECT, dan editor hanya menampilkan hasil TERAKHIR.
--
-- Uji penjaga sudah LULUS 11/11 lewat versi tabel. Berkas ini disimpan hanya
-- sebagai jejak sejarah. Jangan dijalankan.
-- =============================================================================

-- =============================================================================
-- UJI PENJAGA BENTROK HALAQOH — HARUS DIJALANKAN DI DATABASE UJI
-- =============================================================================
-- Membuktikan exclusion constraint benar-benar menolak yang seharusnya ditolak,
-- dan MEMBIARKAN yang seharusnya sah. "Terpasang" tidak sama dengan "bekerja":
-- salah tulis satu operator dan ia diam-diam tidak menjaga apa pun.
--
-- -----------------------------------------------------------------------------
-- MENGAPA BERKAS INI DITULIS ULANG DUA KALI (versi 1 & 2 GAGAL)
-- -----------------------------------------------------------------------------
-- Versi 1 mengarang UUID tetap ('11111111-…') → di database yang sudah berisi
-- 248 baris jadwal, tahun ajaran ber-id itu tidak ada → ERROR 23503 (foreign key).
--
-- Versi 2 memakai TEMP TABLE + BEGIN/ROLLBACK. Itu bekerja di `psql` karena
-- seluruh berkas dijalankan dalam SATU sesi. SUPABASE SQL EDITOR TIDAK BEGITU:
-- ia mengirim pernyataan-pernyataannya ke sesi database yang berbeda-beda.
-- Tabel `TEMP` terikat pada satu sesi, jadi begitu sesi berganti tabelnya
-- lenyap → ERROR 42P01: relation "uji_ctx" does not exist.
--
-- VERSI INI (3) mengikuti aturan keras agar cocok dengan Supabase SQL Editor:
--   1. TIDAK ada TEMP TABLE. Semua UUID ditulis apa adanya di setiap pernyataan.
--   2. TIDAK ada BEGIN/ROLLBACK. Setiap pernyataan berdiri sendiri.
--   3. TIDAK ada ketergantungan antar-pernyataan. Blok uji bisa dijalankan
--      satu per satu, berurutan, atau bahkan diulang — hasilnya sama.
--
-- Cara membersihkan: UUID di bawah sengaja memakai pola khas, dan seluruh
-- datanya berawalan 'ZZ'. Lihat blok PEMBERSIHAN di bagian paling bawah.
--
-- CARA MEMBACA HASIL
-- Supabase SQL Editor menampilkan NOTICE di tab "Messages" (bukan tabel hasil).
-- Setiap uji mencetak satu baris 'OK' atau 'GAGAL'. Yang diinginkan: semua OK.
-- =============================================================================

-- =============================================================================
-- BAGIAN 1 — SIAPKAN DATA UJI
-- Jalankan SELURUH bagian ini dulu (dari sini sampai baris SEBELUM "BAGIAN 2").
-- Aman dijalankan berulang: semua memakai ON CONFLICT DO NOTHING.
-- =============================================================================

-- Tahun ajaran uji. Status WAJIB 'DRAFT': ada indeks unik parsial
-- idx_single_active_academic_year yang hanya mengizinkan SATU tahun ACTIVE
-- di seluruh tabel — baris 'ACTIVE' akan bentrok dengan 2026/2027 Anda.
INSERT INTO agenda.academic_year (id, name, start_date, end_date, status)
VALUES
    ('0a11a111-0000-4000-8000-000000000001', 'ZZ-UJI-A', DATE '2026-07-01', DATE '2027-06-30', 'DRAFT'),
    ('0a11a111-0000-4000-8000-000000000002', 'ZZ-UJI-B', DATE '2027-07-01', DATE '2028-06-30', 'DRAFT')
ON CONFLICT (id) DO NOTHING;

-- Jam pelajaran (JP) untuk kedua tahun uji.
INSERT INTO agenda.period_templates
    (id, academic_year_id, period_number, label, start_time, end_time, is_active)
VALUES
    ('0b11b111-0000-4000-8000-000000000001',
     '0a11a111-0000-4000-8000-000000000001', 1, 'ZZ JP 1', TIME '07:00', TIME '07:45', true),
    ('0b11b111-0000-4000-8000-000000000002',
     '0a11a111-0000-4000-8000-000000000002', 1, 'ZZ JP 1', TIME '07:00', TIME '07:45', true)
ON CONFLICT (id) DO NOTHING;

-- Dua guru uji.
INSERT INTO agenda.guru (id, nama_guru)
VALUES
    ('0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A'),
    ('0c11c111-0000-4000-8000-000000000002', 'ZZ Uji Guru B')
ON CONFLICT (id) DO NOTHING;

-- Dua kelas uji. Rombel 'ZZ' dan 'ZY' — kelas nyata memakai 'A'.
-- Kelas 'ZZ' menampung halaqoh A & B. Kelas 'ZY' sengaja kosong, hanya dipakai
-- untuk membuktikan guru yang sama tidak boleh mengajar di kelas lain pada jam sama.
INSERT INTO agenda.kelas (id, tingkat, rombel, label)
VALUES
    ('0d11d111-0000-4000-8000-000000000001', 6, 'ZZ', 'ZZ-UJI'),
    ('0d11d111-0000-4000-8000-000000000002', 6, 'ZY', 'ZY-UJI')
ON CONFLICT (tingkat, rombel) DO NOTHING;

-- Dua halaqoh di kelas 'ZZ'.
INSERT INTO agenda.halaqoh (id, kelas_id, nama, urutan)
VALUES
    ('0e11e111-0000-4000-8000-00000000000a',
     '0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh A', 1),
    ('0e11e111-0000-4000-8000-00000000000b',
     '0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh B', 2)
ON CONFLICT (kelas_id, nama) DO NOTHING;

-- Satu siswa uji, hanya untuk uji keanggotaan halaqoh.
INSERT INTO agenda.siswa (id, nama_siswa, status)
VALUES ('0f11f111-0000-4000-8000-000000000001', 'ZZ Uji Siswa', 'AKTIF')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- BARIS DASAR — wajib ada sebelum uji apa pun dijalankan.
--
-- Tanpa baris ini, semua uji "halaqoh sama ditolak" akan lulus secara palsu:
-- tabelnya kosong, jadi tidak ada apa pun untuk bertabrakan. Menaruhnya di
-- langkah persiapan (bukan di dalam blok uji) memastikan ia BENAR-BENAR ada
-- saat uji berjalan — satu baris tetap, yang tidak ikut terbuang oleh
-- penolakan uji mana pun.
--
-- Isi: halaqoh A, Senin 07:00–07:45 (JP 1), guru A.
-- -----------------------------------------------------------------------------
INSERT INTO agenda.schedule
    (id, academic_year_id, day, period_number, start_time, end_time,
     kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
VALUES
    ('0aa11111-0000-4000-8000-000000000001',
     '0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
     '0d11d111-0000-4000-8000-000000000001', 'Ummi',
     '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
     '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Laporan kesiapan: pastikan keenam baris data uji benar-benar ada.
SELECT 'Persiapan' AS bagian, 'Data uji siap' AS keterangan,
       format('tahun: %s | guru: %s | kelas: %s | halaqoh: %s | siswa: %s | baris dasar: %s',
              (SELECT count(*) FROM agenda.academic_year
                WHERE name IN ('ZZ-UJI-A','ZZ-UJI-B')),
              (SELECT count(*) FROM agenda.guru
                WHERE nama_guru LIKE 'ZZ Uji Guru%'),
              (SELECT count(*) FROM agenda.kelas WHERE rombel IN ('ZZ','ZY')),
              (SELECT count(*) FROM agenda.halaqoh WHERE nama LIKE 'ZZ Halaqoh%'),
              (SELECT count(*) FROM agenda.siswa WHERE nama_siswa = 'ZZ Uji Siswa'),
              (SELECT count(*) FROM agenda.schedule
                WHERE id = '0aa11111-0000-4000-8000-000000000001'))
       AS isi;

-- =============================================================================
-- BAGIAN 2 — UJI
-- Setiap blok di bawah berdiri sendiri. Jalankan berurutan.
-- Hasil muncul di tab "Messages": satu baris OK / GAGAL per uji.
--
-- Sebelum mulai, sisa jalaran sebelumnya dibersihkan lebih dulu. SQL Editor
-- membagi skrip ke beberapa sesi sehingga blok uji yang gagal di tengah bisa
-- meninggalkan baris yang belum terhapus. Pembersihan ini membuat rangkaian uji
-- bisa diulang berkali-kali tanpa harus menyentuh blok PEMBERSIHAN di bawah.
-- =============================================================================

-- Buang keanggotaan halaqoh uji (didaftarkan ulang oleh UJI 8).
DELETE FROM agenda.siswa_halaqoh
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');

-- Buang halaqoh sisa uji. Ini SEKALIGUS membuang baris jadwal yang menunjuknya:
-- `schedule.halaqoh_id` memakai ON DELETE CASCADE. Jadi baris dasar di langkah
-- persiapan ikut terhapus di sini — dan itu memang disengaja, supaya tidak ada
-- sisa jalaran lama yang lolos. Baris dasarnya dibuat ulang persis di bawah.
DELETE FROM agenda.halaqoh
 WHERE kelas_id IN ('0d11d111-0000-4000-8000-000000000001',
                    '0d11d111-0000-4000-8000-000000000002');

-- Sisa baris jadwal uji yang TIDAK menunjuk halaqoh (mis. baris 'Matematika'
-- dari UJI 11). Yang menunjuk halaqoh sudah ikut terhapus oleh CASCADE di atas.
DELETE FROM agenda.schedule
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');

-- Dua halaqoh standar, dibuat ulang.
INSERT INTO agenda.halaqoh (id, kelas_id, nama, urutan)
VALUES
    ('0e11e111-0000-4000-8000-00000000000a',
     '0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh A', 1),
    ('0e11e111-0000-4000-8000-00000000000b',
     '0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh B', 2)
ON CONFLICT (kelas_id, nama) DO NOTHING;

-- Baris dasar, dibuat ulang (ia ikut terhapus oleh CASCADE di atas).
INSERT INTO agenda.schedule
    (id, academic_year_id, day, period_number, start_time, end_time,
     kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
VALUES
    ('0aa11111-0000-4000-8000-000000000001',
     '0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
     '0d11d111-0000-4000-8000-000000000001', 'Ummi',
     '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
     '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- UJI 1 — halaqoh sama, jam tumpang-tindih → HARUS DITOLAK
-- Baris dasar (halaqoh A, Senin 07:00–07:45) sudah ada dari langkah persiapan.
-- Sekarang coba tambahkan halaqoh A lagi pada 07:30–08:15 (beririsan).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 2, TIME '07:30', TIME '08:15',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000002', 'ZZ Uji Guru B',
                '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    IF v_ditolak THEN
        RAISE NOTICE 'OK    UJI 1 — halaqoh sama, jam tumpang-tindih (ditolak, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 1 — seharusnya DITOLAK, tetapi diterima. PENJAGA HALAQOH TIDAK BEKERJA.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 2 — inti Ummi: KELAS SAMA, halaqoh BEDA, jam SAMA → HARUS DITERIMA
-- Inilah perubahan yang membuat model ini berguna. Dulu kelas dianggap satu
-- kesatuan sehingga baris ini mustahil. Sekarang kunci bentroknya halaqoh.
--
-- Dicoba pada jam 07:00–07:45 yang SAMA dengan uji 1, tetapi halaqoh B.
-- Bila penjaga salah memakai kelas_id alih-alih halaqoh_id, baris ini tertolak.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
    v_ada     BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000002', 'ZZ Uji Guru B',
                '0e11e111-0000-4000-8000-00000000000b', 'ACTIVE');
        v_ada := TRUE;
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    -- Baris dibuang lagi supaya uji berikutnya berangkat dari keadaan bersih.
    -- (Tidak bisa diandalkan ROLLBACK di SQL Editor — lihat catatan di kepala berkas.)
    IF v_ada THEN
        DELETE FROM agenda.schedule
         WHERE halaqoh_id = '0e11e111-0000-4000-8000-00000000000b'
           AND day = 'MONDAY' AND start_time = TIME '07:00';
    END IF;

    IF NOT v_ditolak THEN
        RAISE NOTICE 'OK    UJI 2 — KELAS SAMA, halaqoh BEDA, jam sama (diterima, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 2 — seharusnya DITERIMA, tetapi ditolak. Penjaga memakai KELAS, bukan HALAQOH. Model Ummi tidak bekerja.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 3 — jam berdempet bukan bentrok → HARUS DITERIMA
-- 07:00–07:45 lalu 07:45–08:30 pada halaqoh yang sama. Batas [) setengah-terbuka.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 2, TIME '07:45', TIME '08:30',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    DELETE FROM agenda.schedule
     WHERE status = 'ACTIVE'
       AND academic_year_id = '0a11a111-0000-4000-8000-000000000001'
       AND start_time = TIME '07:45'
       AND halaqoh_id = '0e11e111-0000-4000-8000-00000000000a';

    IF NOT v_ditolak THEN
        RAISE NOTICE 'OK    UJI 3 — jam berdempet 07:45 setelah 07:00-07:45 (diterima, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 3 — jam berdempet seharusnya DITERIMA. Rentangnya tidak setengah-terbuka.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 4 — guru sama mengampu 2 halaqoh pada jam sama → HARUS DITOLAK
-- Inilah penjaga "satu guru tidak bisa di dua tempat".
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000b', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    IF v_ditolak THEN
        RAISE NOTICE 'OK    UJI 4 — guru sama mengampu 2 halaqoh pada jam sama (ditolak, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 4 — seharusnya DITOLAK. Guru bisa berada di dua halaqoh sekaligus.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 5 — guru sama di KELAS BERBEDA pada jam sama → HARUS DITOLAK
-- Memakai kelas 'ZY' (kelas uji yang kosong), bukan kelas nyata mana pun.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000002', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                NULL, 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    IF v_ditolak THEN
        RAISE NOTICE 'OK    UJI 5 — guru sama di kelas berbeda pada jam sama (ditolak, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 5 — seharusnya DITOLAK. Guru bisa mengajar dua kelas sekaligus.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 6 — jam sama di TAHUN AJARAN berbeda → HARUS DITERIMA
-- Jam 07:00 Senin ada di setiap tahun. Bila academic_year_id tidak ikut masuk
-- kunci constraint, jadwal tahun lalu akan memblokir tahun ini.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000002', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    DELETE FROM agenda.schedule
     WHERE status = 'ACTIVE'
       AND academic_year_id = '0a11a111-0000-4000-8000-000000000002'
       AND halaqoh_id = '0e11e111-0000-4000-8000-00000000000a';

    IF NOT v_ditolak THEN
        RAISE NOTICE 'OK    UJI 6 — jam sama di tahun ajaran berbeda (diterima, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 6 — lintas tahun seharusnya DITERIMA. academic_year_id tidak ada di kunci constraint.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 7 — baris ARCHIVED tidak pernah dianggap bentrok → HARUS DITERIMA
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000a', 'ARCHIVED');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    DELETE FROM agenda.schedule
     WHERE status = 'ARCHIVED'
       AND academic_year_id = '0a11a111-0000-4000-8000-000000000001'
       AND halaqoh_id = '0e11e111-0000-4000-8000-00000000000a';

    IF NOT v_ditolak THEN
        RAISE NOTICE 'OK    UJI 7 — baris ARCHIVED boleh tumpang-tindih (diterima, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 7 — ARCHIVED seharusnya DITERIMA. Syarat status di constraint salah.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 8 — siswa yang sama di dua halaqoh pada tahun yang sama → HARUS DITOLAK
-- (Membutuhkan UJI 1 berhasil lebih dulu? Tidak. Hanya butuh data uji siap.)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    -- Daftarkan siswa ke halaqoh A lebih dulu (boleh saja, belum ada isinya).
    BEGIN
        INSERT INTO agenda.siswa_halaqoh (siswa_id, halaqoh_id, academic_year_id)
        VALUES ('0f11f111-0000-4000-8000-000000000001',
                '0e11e111-0000-4000-8000-00000000000a',
                '0a11a111-0000-4000-8000-000000000001');
    EXCEPTION WHEN OTHERS THEN
        NULL;  -- sudah ada dari jalaran sebelumnya; abaikan
    END;

    -- Sekarang coba masukkan ke halaqoh B pada tahun yang sama → harus ditolak.
    BEGIN
        INSERT INTO agenda.siswa_halaqoh (siswa_id, halaqoh_id, academic_year_id)
        VALUES ('0f11f111-0000-4000-8000-000000000001',
                '0e11e111-0000-4000-8000-00000000000b',
                '0a11a111-0000-4000-8000-000000000001');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    IF v_ditolak THEN
        RAISE NOTICE 'OK    UJI 8 — siswa sama di dua halaqoh pada tahun yang sama (ditolak, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 8 — seharusnya DITOLAK. Satu siswa bisa ada di dua halaqoh setahun.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 9 — siswa yang sama di TAHUN AJARAN berikutnya → HARUS DITERIMA
-- Halaqoh dibagi ulang tiap tahun, jadi keanggotaan lama tidak mengikat.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.siswa_halaqoh (siswa_id, halaqoh_id, academic_year_id)
        VALUES ('0f11f111-0000-4000-8000-000000000001',
                '0e11e111-0000-4000-8000-00000000000a',
                '0a11a111-0000-4000-8000-000000000002');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    DELETE FROM agenda.siswa_halaqoh
     WHERE academic_year_id = '0a11a111-0000-4000-8000-000000000002';

    IF NOT v_ditolak THEN
        RAISE NOTICE 'OK    UJI 9 — siswa sama di tahun ajaran berikutnya (diterima, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 9 — seharusnya DITERIMA. Keanggotaan halaqoh tidak boleh mengikat lintas tahun.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 10 — dua halaqoh bernama sama di kelas yang sama → HARUS DITOLAK
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.halaqoh (kelas_id, nama, urutan)
        VALUES ('0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh A', 9);
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    IF v_ditolak THEN
        RAISE NOTICE 'OK    UJI 10 — dua halaqoh bernama sama di kelas yang sama (ditolak, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 10 — seharusnya DITOLAK. UNIQUE (kelas_id, nama) tidak terpasang.';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- UJI 11 — baris tanpa halaqoh (mapel biasa) tidak terjaring penjaga halaqoh
-- → HARUS DITERIMA. Mapel non-Ummi tidak berubah perilakunya.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'TUESDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Matematika',
                NULL, 'Guru Bidang', NULL, 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN
        v_ditolak := TRUE;
    END;

    DELETE FROM agenda.schedule
     WHERE status = 'ACTIVE' AND day = 'TUESDAY'
       AND academic_year_id = '0a11a111-0000-4000-8000-000000000001'
       AND subject_name = 'Matematika' AND halaqoh_id IS NULL
       AND kelas_id = '0d11d111-0000-4000-8000-000000000001';

    IF NOT v_ditolak THEN
        RAISE NOTICE 'OK    UJI 11 — baris tanpa halaqoh tidak terjaring penjaga halaqoh (diterima, benar)';
    ELSE
        RAISE NOTICE 'GAGAL UJI 11 — mapel biasa seharusnya DITERIMA. Syarat "halaqoh_id IS NOT NULL" bermasalah.';
    END IF;
END $$;

-- =============================================================================
-- BAGIAN 3 — RINGKASAN
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=============================================================';
    RAISE NOTICE '  UJI SELESAI. Lihat tab Messages di atas.';
    RAISE NOTICE '  Semua baris harus bertanda OK.';
    RAISE NOTICE '  Ada baris GAGAL = penjaga tidak bekerja sebagaimana mestinya.';
    RAISE NOTICE '=============================================================';
END $$;

-- =============================================================================
-- BAGIAN 4 — PEMBERSIHAN (OPSIONAL)
-- Data uji di atas TIDAK dihapus otomatis (SQL Editor membagi skrip ke beberapa
-- sesi, jadi ROLLBACK tidak bisa diandalkan). Jalankan blok ini setelah selesai
-- membaca hasil, supaya database uji bersih kembali.
--
-- Urutannya penting: baris yang ditunjuk harus dihapus lebih dulu.
-- =============================================================================
/*
DELETE FROM agenda.siswa_halaqoh
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');

DELETE FROM agenda.schedule
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');

DELETE FROM agenda.period_templates
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');

DELETE FROM agenda.halaqoh
 WHERE kelas_id IN ('0d11d111-0000-4000-8000-000000000001',
                    '0d11d111-0000-4000-8000-000000000002');

DELETE FROM agenda.siswa WHERE id = '0f11f111-0000-4000-8000-000000000001';
DELETE FROM agenda.kelas WHERE rombel IN ('ZZ','ZY');
DELETE FROM agenda.guru  WHERE id IN ('0c11c111-0000-4000-8000-000000000001',
                                      '0c11c111-0000-4000-8000-000000000002');
DELETE FROM agenda.academic_year WHERE name IN ('ZZ-UJI-A','ZZ-UJI-B');

SELECT 'Pembersihan' AS bagian, 'Selesai' AS keterangan;
*/
