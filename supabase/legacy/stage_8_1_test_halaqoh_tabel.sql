-- =============================================================================
-- UJI PENJAGA BENTROK HALAQOH — VERSI TABEL
-- =============================================================================
-- Sama isinya dengan versi NOTICE, tetapi hasilnya ditulis ke TABEL, bukan
-- pesan NOTICE. Alasannya: sebagian SQL Editor tidak menampilkan tab
-- "Messages"/"Logs", sehingga hasil NOTICE tidak terlihat sama sekali.
--
-- Dengan versi ini, hasil dibaca sebagai TABEL BIASA yang bisa Anda salin
-- seperti hasil query lain — persis seperti yang Anda kirim sebelumnya.
--
-- CARA PAKAI
--   1. Tempel SELURUH berkas ini ke SQL Editor, klik Run.
--   2. Yang muncul paling akhir (dan karena itu terlihat) adalah SATU tabel
--      hasil berisi 13 baris:
--         baris 1    = ringkasan (OK / GAGAL / kesimpulan)
--         baris 2    = baris judul kolom
--         baris 3-13 = 11 baris uji
--   3. Salin SELURUH tabel itu dan kirimkan ke saya.
--
-- Setelah selesai, hapus tabel hasilnya:
--   DROP TABLE IF EXISTS public.hasil_uji;
--
-- -----------------------------------------------------------------------------
-- CATATAN PENTING: SQL Editor Supabase BUKAN satu sesi
-- -----------------------------------------------------------------------------
-- Ia memecah skrip dan mengirim pernyataannya ke sesi database yang berbeda.
-- Karena itu:
--   * TIDAK ada CREATE TEMP TABLE (tabel TEMP terikat satu sesi → hilang).
--   * TIDAK ada BEGIN/ROLLBACK (pernyataannya bisa berjalan di sesi berbeda).
--   * Setiap pernyataan berdiri sendiri.
-- Tabel hasil di sini dibuat PERMANEN (lalu dihapus di awal agar bisa diulang),
-- bukan TEMP, supaya ia bertahan sampai pernyataan terakhir.
-- =============================================================================

-- =============================================================================
-- BAGIAN 0 — SIAPKAN TABEL HASIL
-- =============================================================================

DROP TABLE IF EXISTS public.hasil_uji;

CREATE TABLE public.hasil_uji (
    urut        INTEGER,
    uji         TEXT,
    harapan     TEXT,
    kenyataan   TEXT,
    status      TEXT
);

-- =============================================================================
-- BAGIAN 1 — DATA UJI
-- =============================================================================

INSERT INTO agenda.academic_year (id, name, start_date, end_date, status)
VALUES
    ('0a11a111-0000-4000-8000-000000000001', 'ZZ-UJI-A', DATE '2026-07-01', DATE '2027-06-30', 'DRAFT'),
    ('0a11a111-0000-4000-8000-000000000002', 'ZZ-UJI-B', DATE '2027-07-01', DATE '2028-06-30', 'DRAFT')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agenda.period_templates
    (id, academic_year_id, period_number, label, start_time, end_time, is_active)
VALUES
    ('0b11b111-0000-4000-8000-000000000001',
     '0a11a111-0000-4000-8000-000000000001', 1, 'ZZ JP 1', TIME '07:00', TIME '07:45', true),
    ('0b11b111-0000-4000-8000-000000000002',
     '0a11a111-0000-4000-8000-000000000002', 1, 'ZZ JP 1', TIME '07:00', TIME '07:45', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO agenda.guru (id, nama_guru)
VALUES
    ('0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A'),
    ('0c11c111-0000-4000-8000-000000000002', 'ZZ Uji Guru B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agenda.kelas (id, tingkat, rombel, label)
VALUES
    ('0d11d111-0000-4000-8000-000000000001', 6, 'ZZ', 'ZZ-UJI'),
    ('0d11d111-0000-4000-8000-000000000002', 6, 'ZY', 'ZY-UJI')
ON CONFLICT (tingkat, rombel) DO NOTHING;

INSERT INTO agenda.siswa (id, nama_siswa, status)
VALUES ('0f11f111-0000-4000-8000-000000000001', 'ZZ Uji Siswa', 'AKTIF')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- BAGIAN 2 — BERSIHKAN SISA, LALU SIAPKAN KEADAAN AWAL
-- =============================================================================

DELETE FROM agenda.siswa_halaqoh
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');

-- Menghapus halaqoh IKUT menghapus baris jadwal yang menunjuknya
-- (schedule.halaqoh_id memakai ON DELETE CASCADE) — disengaja.
DELETE FROM agenda.halaqoh
 WHERE kelas_id IN ('0d11d111-0000-4000-8000-000000000001',
                    '0d11d111-0000-4000-8000-000000000002');

DELETE FROM agenda.schedule
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');

INSERT INTO agenda.halaqoh (id, kelas_id, nama, urutan)
VALUES
    ('0e11e111-0000-4000-8000-00000000000a',
     '0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh A', 1),
    ('0e11e111-0000-4000-8000-00000000000b',
     '0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh B', 2)
ON CONFLICT (kelas_id, nama) DO NOTHING;

-- Baris dasar: halaqoh A, Senin 07:00–07:45, guru A.
-- WAJIB ada sebelum uji dijalankan: tanpa ini, uji "harus ditolak" akan lulus
-- palsu karena tidak ada apa pun untuk bertabrakan.
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

-- =============================================================================
-- BAGIAN 3 — UJI
-- Pola tiap uji: coba INSERT yang seharusnya DITOLAK → kalau gagal, artinya
-- penjaga bekerja. Hasilnya ditulis ke public.hasil_uji.
-- =============================================================================

-- UJI 1 — halaqoh sama, jam tumpang-tindih → harus DITOLAK
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 2, TIME '07:30', TIME '08:15',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000002', 'ZZ Uji Guru B',
                '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    INSERT INTO public.hasil_uji VALUES (
        1, 'UJI 1 — halaqoh sama, jam tumpang-tindih', 'DITOLAK',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 2 — INTI UMMI: kelas sama, halaqoh beda, jam sama → harus DITERIMA
DO $$
DECLARE v_ditolak BOOLEAN := FALSE; v_ada BOOLEAN := FALSE;
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
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    IF v_ada THEN
        DELETE FROM agenda.schedule
         WHERE halaqoh_id = '0e11e111-0000-4000-8000-00000000000b'
           AND day = 'MONDAY' AND start_time = TIME '07:00'
           AND academic_year_id = '0a11a111-0000-4000-8000-000000000001';
    END IF;
    INSERT INTO public.hasil_uji VALUES (
        2, 'UJI 2 — KELAS SAMA, halaqoh BEDA, jam sama (inti Ummi)', 'DITERIMA',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN NOT v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 3 — jam berdempet bukan bentrok → harus DITERIMA
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 2, TIME '07:45', TIME '08:30',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    DELETE FROM agenda.schedule
     WHERE academic_year_id = '0a11a111-0000-4000-8000-000000000001'
       AND start_time = TIME '07:45'
       AND halaqoh_id = '0e11e111-0000-4000-8000-00000000000a';
    INSERT INTO public.hasil_uji VALUES (
        3, 'UJI 3 — jam berdempet 07:45 setelah 07:00-07:45', 'DITERIMA',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN NOT v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 4 — guru sama mengampu 2 halaqoh pada jam sama → harus DITOLAK
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000b', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    INSERT INTO public.hasil_uji VALUES (
        4, 'UJI 4 — guru sama mengampu 2 halaqoh pada jam sama', 'DITOLAK',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 5 — guru sama di kelas berbeda pada jam sama → harus DITOLAK
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000002', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                NULL, 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    INSERT INTO public.hasil_uji VALUES (
        5, 'UJI 5 — guru sama di kelas berbeda pada jam sama', 'DITOLAK',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 6 — jam sama di tahun ajaran berbeda → harus DITERIMA
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000002', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000a', 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    DELETE FROM agenda.schedule
     WHERE academic_year_id = '0a11a111-0000-4000-8000-000000000002'
       AND halaqoh_id = '0e11e111-0000-4000-8000-00000000000a';
    INSERT INTO public.hasil_uji VALUES (
        6, 'UJI 6 — jam sama di tahun ajaran berbeda', 'DITERIMA',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN NOT v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 7 — baris ARCHIVED tidak dianggap bentrok → harus DITERIMA
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'MONDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Ummi',
                '0c11c111-0000-4000-8000-000000000001', 'ZZ Uji Guru A',
                '0e11e111-0000-4000-8000-00000000000a', 'ARCHIVED');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    DELETE FROM agenda.schedule
     WHERE status = 'ARCHIVED'
       AND academic_year_id = '0a11a111-0000-4000-8000-000000000001'
       AND halaqoh_id = '0e11e111-0000-4000-8000-00000000000a';
    INSERT INTO public.hasil_uji VALUES (
        7, 'UJI 7 — baris ARCHIVED boleh tumpang-tindih', 'DITERIMA',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN NOT v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 8 — siswa sama di dua halaqoh pada tahun yang sama → harus DITOLAK
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.siswa_halaqoh (siswa_id, halaqoh_id, academic_year_id)
        VALUES ('0f11f111-0000-4000-8000-000000000001',
                '0e11e111-0000-4000-8000-00000000000a',
                '0a11a111-0000-4000-8000-000000000001');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        INSERT INTO agenda.siswa_halaqoh (siswa_id, halaqoh_id, academic_year_id)
        VALUES ('0f11f111-0000-4000-8000-000000000001',
                '0e11e111-0000-4000-8000-00000000000b',
                '0a11a111-0000-4000-8000-000000000001');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    INSERT INTO public.hasil_uji VALUES (
        8, 'UJI 8 — siswa sama di dua halaqoh tahun yang sama', 'DITOLAK',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 9 — siswa sama di tahun ajaran berikutnya → harus DITERIMA
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.siswa_halaqoh (siswa_id, halaqoh_id, academic_year_id)
        VALUES ('0f11f111-0000-4000-8000-000000000001',
                '0e11e111-0000-4000-8000-00000000000a',
                '0a11a111-0000-4000-8000-000000000002');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    DELETE FROM agenda.siswa_halaqoh
     WHERE academic_year_id = '0a11a111-0000-4000-8000-000000000002';
    INSERT INTO public.hasil_uji VALUES (
        9, 'UJI 9 — siswa sama di tahun ajaran berikutnya', 'DITERIMA',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN NOT v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 10 — dua halaqoh bernama sama di kelas yang sama → harus DITOLAK
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.halaqoh (kelas_id, nama, urutan)
        VALUES ('0d11d111-0000-4000-8000-000000000001', 'ZZ Halaqoh A', 9);
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    INSERT INTO public.hasil_uji VALUES (
        10, 'UJI 10 — dua halaqoh bernama sama di kelas yang sama', 'DITOLAK',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- UJI 11 — baris tanpa halaqoh (mapel biasa) tidak terjaring penjaga halaqoh
DO $$
DECLARE v_ditolak BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO agenda.schedule
            (academic_year_id, day, period_number, start_time, end_time,
             kelas_id, subject_name, teacher_id, teacher_name, halaqoh_id, status)
        VALUES ('0a11a111-0000-4000-8000-000000000001', 'TUESDAY', 1, TIME '07:00', TIME '07:45',
                '0d11d111-0000-4000-8000-000000000001', 'Matematika',
                NULL, 'Guru Bidang', NULL, 'ACTIVE');
    EXCEPTION WHEN OTHERS THEN v_ditolak := TRUE;
    END;
    DELETE FROM agenda.schedule
     WHERE academic_year_id = '0a11a111-0000-4000-8000-000000000001'
       AND day = 'TUESDAY' AND subject_name = 'Matematika'
       AND kelas_id = '0d11d111-0000-4000-8000-000000000001';
    INSERT INTO public.hasil_uji VALUES (
        11, 'UJI 11 — mapel biasa tanpa halaqoh', 'DITERIMA',
        CASE WHEN v_ditolak THEN 'DITOLAK' ELSE 'DITERIMA' END,
        CASE WHEN NOT v_ditolak THEN 'OK' ELSE 'GAGAL' END);
END $$;

-- =============================================================================
-- BAGIAN 4 — HASIL
-- =============================================================================
-- PENTING: SQL Editor hanya menampilkan TABEL HASIL TERAKHIR.
-- Karena itu 11 baris uji dan ringkasannya digabung jadi SATU hasil:
--   baris 1    = ringkasan (OK / GAGAL / kesimpulan)
--   baris 2    = judul kolom
--   baris 3-13 = 11 baris uji
-- Salin SELURUH tabel ini (13 baris) dan kirimkan ke saya.
-- =============================================================================

WITH ringkas AS (
    SELECT
        count(*) FILTER (WHERE status = 'OK')    AS jml_ok,
        count(*) FILTER (WHERE status = 'GAGAL') AS jml_gagal,
        count(*)                                 AS total
    FROM public.hasil_uji
)
SELECT
    'HASIL UJI PENJAGA BENTROK HALAQOH'::text AS "no",
    ('OK: ' || r.jml_ok || '  |  GAGAL: ' || r.jml_gagal
     || '  |  total: ' || r.total)::text      AS "uji",
    CASE WHEN r.jml_gagal = 0
         THEN 'SEMUA LULUS — penjaga bentrok bekerja'
         ELSE 'ADA YANG GAGAL — lihat baris GAGAL di bawah' END::text AS "status"
FROM ringkas r

UNION ALL

SELECT 'no', 'uji', 'status'

UNION ALL

SELECT
    urut::text,
    uji,
    CASE status WHEN 'OK' THEN 'OK' ELSE 'GAGAL  <-- PERIKSA' END
FROM public.hasil_uji
ORDER BY 1;

-- =============================================================================
-- BAGIAN 5 — PEMBERSIHAN (jalankan setelah hasil dicatat)
-- Hapus komentar pembuka dan penutup blok ini, lalu Run sekali lagi.
-- =============================================================================
/*
DROP TABLE IF EXISTS public.hasil_uji;

DELETE FROM agenda.schedule
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');
DELETE FROM agenda.siswa_halaqoh
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');
DELETE FROM agenda.halaqoh
 WHERE kelas_id IN ('0d11d111-0000-4000-8000-000000000001',
                    '0d11d111-0000-4000-8000-000000000002');
DELETE FROM agenda.siswa WHERE id = '0f11f111-0000-4000-8000-000000000001';
DELETE FROM agenda.kelas WHERE rombel IN ('ZZ','ZY');
DELETE FROM agenda.guru  WHERE id IN ('0c11c111-0000-4000-8000-000000000001',
                                      '0c11c111-0000-4000-8000-000000000002');
DELETE FROM agenda.period_templates
 WHERE academic_year_id IN ('0a11a111-0000-4000-8000-000000000001',
                            '0a11a111-0000-4000-8000-000000000002');
DELETE FROM agenda.academic_year WHERE name IN ('ZZ-UJI-A','ZZ-UJI-B');

SELECT 'Pembersihan selesai' AS keterangan;
*/
