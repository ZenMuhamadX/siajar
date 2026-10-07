-- =============================================================================
-- IMPORT DATA SISWA — KELAS 1A s.d. 6A (Tahun Ajaran AKTIF)
-- =============================================================================
-- Untuk apa
--   Memasukkan daftar siswa nyata ke master data, sekaligus menempatkannya ke
--   kelas yang SUDAH ADA di master `agenda.kelas` (1A, 2A, 3A, 4A, 5A, 6A).
--
-- Aturan yang dipegang skrip ini
--   1. KELAS TIDAK DIBUAT DI SINI. `kelas_id` diambil dengan SELECT dari
--      `agenda.kelas` berdasarkan `label`. Kalau label tidak ada, siswa itu
--      TIDAK dapat penempatan (dan dilaporkan di bagian HASIL) — bukan kelas
--      baru bernama salah yang diam-diam dibuat.
--   2. Kelas siswa TIDAK disimpan di tabel `siswa`. Penempatan kelas hidup di
--      `agenda.siswa_kelas`, per tahun ajaran — itulah yang membuat kenaikan
--      kelas bisa dilacak.
--   3. Idempoten: menjalankan ulang TIDAK menggandakan siswa. Kunci cegah-nya
--      adalah NAMA (karena `nis` dibiarkan NULL, lihat catatan NIS).
--
-- -----------------------------------------------------------------------------
-- CATATAN NIS
-- -----------------------------------------------------------------------------
-- Daftar yang diberikan tidak menyertakan NIS, jadi `nis` sengaja dibiarkan
-- NULL. Kolom `siswa.nis` boleh NULL (indeks unik parsial hanya berlaku saat
-- terisi), dan UI pun tidak mewajibkannya. Bila nanti sekolah mengeluarkan NIS,
-- isi belakangan lewat menu Siswa / UPDATE terpisah — skrip ini tidak mengarang
-- nomor.
--
-- -----------------------------------------------------------------------------
-- CATATAN: kenapa ditulis begini
-- -----------------------------------------------------------------------------
-- SQL Editor Supabase BUKAN satu sesi; tiap pernyataan dikirim ke sesi berbeda.
-- Karena itu di sini:
--   * TIDAK ada CREATE TEMP TABLE (terikat sesi → ERROR 42P01).
--   * TIDAK ada BEGIN/ROLLBACK (tidak bisa diandalkan).
--   * Setiap pernyataan berdiri sendiri.
--   * Hasil akhir = SATU query (editor hanya menampilkan hasil TERAKHIR).
-- =============================================================================

SET search_path TO agenda, public;

-- =============================================================================
-- BAGIAN 0 — PENGAMAN: pastikan tahun ajaran AKTIF ada
-- =============================================================================
-- Bila tidak ada tahun ACTIVE, BAGIAN 2 akan menyisipkan 0 baris penempatan dan
-- siswa "ada tapi tidak punya kelas" — persis kegagalan yang membingungkan.
-- Pernyataan ini menggagalkan diri sendiri dengan pesan jelas bila itu terjadi.
DO $$
DECLARE
    v_ay_count INTEGER;
BEGIN
    SELECT count(*) INTO v_ay_count FROM agenda.academic_year WHERE status = 'ACTIVE';
    IF v_ay_count = 0 THEN
        RAISE EXCEPTION
            'Tidak ada tahun ajaran berstatus ACTIVE. Buat/aktifkan dulu di menu Tahun Ajaran.';
    END IF;
END $$;

-- =============================================================================
-- BAGIAN 0b — PENGAMAN: pastikan master kelas 1A..6A lengkap
-- =============================================================================
-- Gagal cepat lebih baik daripada diam-diam melewatkan satu kelas. Bila ada
-- label yang tidak ada di master, sebutkan yang mana.
DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(w.label, ', ' ORDER BY w.label) INTO v_missing
    FROM (VALUES ('1A'), ('2A'), ('3A'), ('4A'), ('5A'), ('6A')) AS w(label)
    WHERE NOT EXISTS (SELECT 1 FROM agenda.kelas k WHERE k.label = w.label);

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION
            'Label kelas ini tidak ada di master agenda.kelas: %. Buat dulu lewat menu Kelas, lalu jalankan ulang.',
            v_missing;
    END IF;
END $$;

-- =============================================================================
-- BAGIAN 1 — SISWA (identitas saja, tanpa kelas)
-- =============================================================================
-- Daftar digabung jadi satu tabel nilai dengan kolom `label` sebagai penanda
-- kelas. `WHERE NOT EXISTS` pada nama membuat skrip aman dijalankan dua kali.
--
-- Kenapa `trim`: dua nama di daftar asli punya spasi ganda
-- ("FARIS ZAIZ AL  AZIZ", "NUR HAYATI  NUFUS"). Spasi ganda membuat pencocokan
-- nama jadi rapuh, jadi dirapikan saat masuk.

INSERT INTO agenda.siswa (nama_siswa, status)
SELECT trim(v.nama), 'AKTIF'
FROM (VALUES
    -- ---------------- KELAS 1A (25 siswa) ----------------
    ('1A', 'ADREENA NAIRA MALIKA'),
    ('1A', 'AHMAD FATIH MUBARAK'),
    ('1A', 'AHMAD NIZAR ALFARIZI HASIBUAN'),
    ('1A', 'ARETHA HERMI AISY HIDAYAT'),
    ('1A', 'ARSY AINIYAH AZHAR'),
    ('1A', 'ERINKA NAYYARA'),
    ('1A', 'FARIS ZAIZ AL  AZIZ'),
    ('1A', 'GAMILA NAURA ZUAR'),
    ('1A', 'GHATAN KHABIB SULAIMAN'),
    ('1A', 'HAIDAR DZAKI ARRAYAN'),
    ('1A', 'KHAIRY SYAZANI MANULLANG'),
    ('1A', 'KHALID AJI AL KAHFI'),
    ('1A', 'MARWAH SITI KEYSANADIRA FAUZI'),
    ('1A', 'MUHAMMAD ALIYY BAITS HAYTHAM'),
    ('1A', 'MUHAMMAD FAIQ FATURRAHMAN'),
    ('1A', 'MUHAMMAD JAFAR SISWOYO'),
    ('1A', 'MUHAMMAD MAHERZA'),
    ('1A', 'NADHIFAH ASHALINA DWI NOV'),
    ('1A', 'NAURA CHESSY FUKAYNA'),
    ('1A', 'NIFIRA KAYANA MECCA'),
    ('1A', 'QIANA SHANUM GELIS'),
    ('1A', 'RAFIF ABDILAH PRATAMA'),
    ('1A', 'SYAFA SITI AURELIA FAUZI'),
    ('1A', 'ZAYN ALVARO PRAMESTY'),
    ('1A', 'ZAKI MAULANA'),

    -- ---------------- KELAS 2A (11 siswa) ----------------
    ('2A', 'ABIZAR FARAS RAUFAR'),
    ('2A', 'AISYAH SABIA HENDRIAN'),
    ('2A', 'ALI MAULANA IBRAHIM'),
    ('2A', 'AYSILA QALESYA AZ ZAHRA'),
    ('2A', 'ELVANO VIRENDRA RAFFASYA'),
    ('2A', 'HANS ALESSIO KAILANI'),
    ('2A', 'NAUVAL FARIZ KEENANDRA'),
    ('2A', 'NAURA BIANCA SIDQIA'),
    ('2A', 'RAYHAN ADAM RAFAEYZA'),
    ('2A', 'RIZKI MUHAMMAD RAMADAN'),
    ('2A', 'AHMAD FAKHRIL HISYAM'),

    -- ---------------- KELAS 3A (22 siswa) ----------------
    ('3A', 'AFIQA MAFAZA FAUQIYYA'),
    ('3A', 'AIYRA ALNAIRA'),
    ('3A', 'ALLANA SAFIYA OKTAVIANA'),
    ('3A', 'ATHARRASYA NADIENDRA NUFIARI'),
    ('3A', 'FABIAN RAFA KAYENZO'),
    ('3A', 'FATHIMAH AZZAHRA SISWOYO'),
    ('3A', 'GHANI AKBAR SYAIFULLAH'),
    ('3A', 'HANA ANINDITA'),
    ('3A', 'HIZAM ADNAN ABDULLAH'),
    ('3A', 'MEISYA NARA RAFANIA'),
    ('3A', 'MUHAMMAD ALFARIL RESUNA HAMIZAN'),
    ('3A', 'MUHAMMAD DAFFA RAFISQY ARFADHIA'),
    ('3A', 'MUHAMMAD HAIKAL NURONI'),
    ('3A', 'MUHAMMAD KEIZO'),
    ('3A', 'MUHAMMAD PANJI DHARMA'),
    ('3A', 'MUHAMMAD RAFFASYA PRASETYA'),
    ('3A', 'NABIL ABIANSYAH AZIZ'),
    ('3A', 'NAUREEN RUMAISHA MIKAYLA'),
    ('3A', 'NINDYA PUTRI MISELA'),
    ('3A', 'NUR HAYATI  NUFUS'),
    ('3A', 'RAZQA EL RAFIF HENDRIAN'),
    ('3A', 'ZAINURI AS-SIDQI'),

    -- ---------------- KELAS 4A (18 siswa) ----------------
    ('4A', 'ABRISYAM ZAID AL-ABBASY'),
    ('4A', 'AIRIN ALDINI AFRIZA'),
    ('4A', 'AISYAH AYUDIA INARA'),
    ('4A', 'ALBINKA STIANA FAZIA'),
    ('4A', 'ANINDITA KEISHA ZAHRA'),
    ('4A', 'AZKAYRA FARIZ RAMADHANI'),
    ('4A', 'DENNIS PRATAMA'),
    ('4A', 'FIZZA ASHEEQA YANUAR'),
    ('4A', 'KANAYA ZIADATUL ALIYAH'),
    ('4A', 'MUHAMAD ENZO WITONO'),
    ('4A', 'MUHAMMAD ARNAV DWIPRADIPTA'),
    ('4A', 'MUHAMMAD FARID'),
    ('4A', 'NABILA ASSYIFA RAMADHANI'),
    ('4A', 'NAURA ZAMILLAH ALMUAFFAQOH'),
    ('4A', 'RAFFASYA AL ARIQ'),
    ('4A', 'RAFFASYA ALFATTAH MELICO'),
    ('4A', 'RAID RIDHA RABBIHI'),
    ('4A', 'SAHIN RAHMADINA'),

    -- ---------------- KELAS 5A (20 siswa) ----------------
    ('5A', 'ADZKIA EMIRA AZZAHRA'),
    ('5A', 'ADZKIA SAMHA SAUFA'),
    ('5A', 'AHMAD NAUFAL HASIBUAN'),
    ('5A', 'AIDILLA NAOMI PUTRI'),
    ('5A', 'DAFFA AL FARIZI ZAMZAM'),
    ('5A', 'KHAIRA BERLIAN QUEENZA'),
    ('5A', 'KIENDRA ARKA SAPUTRA'),
    ('5A', 'MUHAMMAD DZIKRY FAISAL OKTARA'),
    ('5A', 'MUHAMMAD FIRHAN RAFISQY HAIKAL'),
    ('5A', 'MUHAMMAD RAFAAZKA ZUAR'),
    ('5A', 'NAIRA SHAFA MAHBUBAH HASAN'),
    ('5A', 'NAURA SHAFA MAHBUBAH HASAN'),
    ('5A', 'NAYYARA SAQEENARAVA FARZANA'),
    ('5A', 'PUTRI FATIMATUZZAHRA'),
    ('5A', 'RIZQY NUR HAKIIM'),
    ('5A', 'TYARA SALSABILA NADZHIFA'),
    ('5A', 'ZAHDIAN KHIAR ARDHANI'),
    ('5A', 'SYAFIQ UBAIDILLAH'),
    ('5A', 'LIWA UL HIKMAH'),
    ('5A', 'RELISA AULIA PUTRI BR LUBIS'),

    -- ---------------- KELAS 6A (16 siswa) ----------------
    ('6A', 'ALSERO DHARMA RAKAS'),
    ('6A', 'AZKA DANISH'),
    ('6A', 'KEANU NAKHLA RAQILLA'),
    ('6A', 'M. SALMAN PUTERA RAMADHAN'),
    ('6A', 'MUHAMMAD ALI UMRI ALFATIH PULUNGAN'),
    ('6A', 'MUHAMMAD ARSAKHA REZKY SUHENDRA'),
    ('6A', 'MUHAMMAD FABIAN FAHREZA'),
    ('6A', 'MUHAMMAD FAIZ ILHAM'),
    ('6A', 'RAIHAN FATHURRAHMAN'),
    ('6A', 'RIZQI AKBAR ALFARIZI'),
    ('6A', 'TUBAGUS FAIREL ATHARIZ CALIEF'),
    ('6A', 'YASMINA AISYAH'),
    ('6A', 'ZHAFRAN ABYAN FELANI'),
    ('6A', 'AIDY REZKI SIREGAR'),
    ('6A', 'RADITYA GANTARA KURNIAWAN'),
    ('6A', 'PUTRA NANDA BALARAMA')
) AS v(label, nama)
WHERE NOT EXISTS (
    SELECT 1 FROM agenda.siswa s WHERE s.nama_siswa = trim(v.nama)
);

-- =============================================================================
-- BAGIAN 2 — PENEMPATAN KELAS (tahun ajaran AKTIF)
-- =============================================================================
-- INILAH bagian yang memakai master data: `kelas_id` diambil dengan SELECT dari
-- `agenda.kelas` berdasarkan `label`. Tidak ada satu pun INSERT INTO kelas di
-- berkas ini.
--
-- `kelas_diminta` diturunkan ULANG dari daftar yang sama, lalu di-LEFT JOIN
-- dengan master kelas. Baris yang tidak cocok (label kelas atau nama siswa tak
-- ketemu) tetap ikut lewat LEFT JOIN supaya bisa DILAPORKAN di BAGIAN 3, bukan
-- hilang diam-diam — tetapi hanya yang cocok yang benar-benar benar-benar masuk.
--
-- Penempatan hanya dibuat untuk siswa yang BELUM punya penempatan di tahun
-- aktif, sehingga menjalankan ulang tidak menyentuh siswa yang sudah benar.

WITH daftar(label, nama) AS (
    VALUES
    ('1A', 'ADREENA NAIRA MALIKA'),
    ('1A', 'AHMAD FATIH MUBARAK'),
    ('1A', 'AHMAD NIZAR ALFARIZI HASIBUAN'),
    ('1A', 'ARETHA HERMI AISY HIDAYAT'),
    ('1A', 'ARSY AINIYAH AZHAR'),
    ('1A', 'ERINKA NAYYARA'),
    ('1A', 'FARIS ZAIZ AL  AZIZ'),
    ('1A', 'GAMILA NAURA ZUAR'),
    ('1A', 'GHATAN KHABIB SULAIMAN'),
    ('1A', 'HAIDAR DZAKI ARRAYAN'),
    ('1A', 'KHAIRY SYAZANI MANULLANG'),
    ('1A', 'KHALID AJI AL KAHFI'),
    ('1A', 'MARWAH SITI KEYSANADIRA FAUZI'),
    ('1A', 'MUHAMMAD ALIYY BAITS HAYTHAM'),
    ('1A', 'MUHAMMAD FAIQ FATURRAHMAN'),
    ('1A', 'MUHAMMAD JAFAR SISWOYO'),
    ('1A', 'MUHAMMAD MAHERZA'),
    ('1A', 'NADHIFAH ASHALINA DWI NOV'),
    ('1A', 'NAURA CHESSY FUKAYNA'),
    ('1A', 'NIFIRA KAYANA MECCA'),
    ('1A', 'QIANA SHANUM GELIS'),
    ('1A', 'RAFIF ABDILAH PRATAMA'),
    ('1A', 'SYAFA SITI AURELIA FAUZI'),
    ('1A', 'ZAYN ALVARO PRAMESTY'),
    ('1A', 'ZAKI MAULANA'),
    ('2A', 'ABIZAR FARAS RAUFAR'),
    ('2A', 'AISYAH SABIA HENDRIAN'),
    ('2A', 'ALI MAULANA IBRAHIM'),
    ('2A', 'AYSILA QALESYA AZ ZAHRA'),
    ('2A', 'ELVANO VIRENDRA RAFFASYA'),
    ('2A', 'HANS ALESSIO KAILANI'),
    ('2A', 'NAUVAL FARIZ KEENANDRA'),
    ('2A', 'NAURA BIANCA SIDQIA'),
    ('2A', 'RAYHAN ADAM RAFAEYZA'),
    ('2A', 'RIZKI MUHAMMAD RAMADAN'),
    ('2A', 'AHMAD FAKHRIL HISYAM'),
    ('3A', 'AFIQA MAFAZA FAUQIYYA'),
    ('3A', 'AIYRA ALNAIRA'),
    ('3A', 'ALLANA SAFIYA OKTAVIANA'),
    ('3A', 'ATHARRASYA NADIENDRA NUFIARI'),
    ('3A', 'FABIAN RAFA KAYENZO'),
    ('3A', 'FATHIMAH AZZAHRA SISWOYO'),
    ('3A', 'GHANI AKBAR SYAIFULLAH'),
    ('3A', 'HANA ANINDITA'),
    ('3A', 'HIZAM ADNAN ABDULLAH'),
    ('3A', 'MEISYA NARA RAFANIA'),
    ('3A', 'MUHAMMAD ALFARIL RESUNA HAMIZAN'),
    ('3A', 'MUHAMMAD DAFFA RAFISQY ARFADHIA'),
    ('3A', 'MUHAMMAD HAIKAL NURONI'),
    ('3A', 'MUHAMMAD KEIZO'),
    ('3A', 'MUHAMMAD PANJI DHARMA'),
    ('3A', 'MUHAMMAD RAFFASYA PRASETYA'),
    ('3A', 'NABIL ABIANSYAH AZIZ'),
    ('3A', 'NAUREEN RUMAISHA MIKAYLA'),
    ('3A', 'NINDYA PUTRI MISELA'),
    ('3A', 'NUR HAYATI  NUFUS'),
    ('3A', 'RAZQA EL RAFIF HENDRIAN'),
    ('3A', 'ZAINURI AS-SIDQI'),
    ('4A', 'ABRISYAM ZAID AL-ABBASY'),
    ('4A', 'AIRIN ALDINI AFRIZA'),
    ('4A', 'AISYAH AYUDIA INARA'),
    ('4A', 'ALBINKA STIANA FAZIA'),
    ('4A', 'ANINDITA KEISHA ZAHRA'),
    ('4A', 'AZKAYRA FARIZ RAMADHANI'),
    ('4A', 'DENNIS PRATAMA'),
    ('4A', 'FIZZA ASHEEQA YANUAR'),
    ('4A', 'KANAYA ZIADATUL ALIYAH'),
    ('4A', 'MUHAMAD ENZO WITONO'),
    ('4A', 'MUHAMMAD ARNAV DWIPRADIPTA'),
    ('4A', 'MUHAMMAD FARID'),
    ('4A', 'NABILA ASSYIFA RAMADHANI'),
    ('4A', 'NAURA ZAMILLAH ALMUAFFAQOH'),
    ('4A', 'RAFFASYA AL ARIQ'),
    ('4A', 'RAFFASYA ALFATTAH MELICO'),
    ('4A', 'RAID RIDHA RABBIHI'),
    ('4A', 'SAHIN RAHMADINA'),
    ('5A', 'ADZKIA EMIRA AZZAHRA'),
    ('5A', 'ADZKIA SAMHA SAUFA'),
    ('5A', 'AHMAD NAUFAL HASIBUAN'),
    ('5A', 'AIDILLA NAOMI PUTRI'),
    ('5A', 'DAFFA AL FARIZI ZAMZAM'),
    ('5A', 'KHAIRA BERLIAN QUEENZA'),
    ('5A', 'KIENDRA ARKA SAPUTRA'),
    ('5A', 'MUHAMMAD DZIKRY FAISAL OKTARA'),
    ('5A', 'MUHAMMAD FIRHAN RAFISQY HAIKAL'),
    ('5A', 'MUHAMMAD RAFAAZKA ZUAR'),
    ('5A', 'NAIRA SHAFA MAHBUBAH HASAN'),
    ('5A', 'NAURA SHAFA MAHBUBAH HASAN'),
    ('5A', 'NAYYARA SAQEENARAVA FARZANA'),
    ('5A', 'PUTRI FATIMATUZZAHRA'),
    ('5A', 'RIZQY NUR HAKIIM'),
    ('5A', 'TYARA SALSABILA NADZHIFA'),
    ('5A', 'ZAHDIAN KHIAR ARDHANI'),
    ('5A', 'SYAFIQ UBAIDILLAH'),
    ('5A', 'LIWA UL HIKMAH'),
    ('5A', 'RELISA AULIA PUTRI BR LUBIS'),
    ('6A', 'ALSERO DHARMA RAKAS'),
    ('6A', 'AZKA DANISH'),
    ('6A', 'KEANU NAKHLA RAQILLA'),
    ('6A', 'M. SALMAN PUTERA RAMADHAN'),
    ('6A', 'MUHAMMAD ALI UMRI ALFATIH PULUNGAN'),
    ('6A', 'MUHAMMAD ARSAKHA REZKY SUHENDRA'),
    ('6A', 'MUHAMMAD FABIAN FAHREZA'),
    ('6A', 'MUHAMMAD FAIZ ILHAM'),
    ('6A', 'RAIHAN FATHURRAHMAN'),
    ('6A', 'RIZQI AKBAR ALFARIZI'),
    ('6A', 'TUBAGUS FAIREL ATHARIZ CALIEF'),
    ('6A', 'YASMINA AISYAH'),
    ('6A', 'ZHAFRAN ABYAN FELANI'),
    ('6A', 'AIDY REZKI SIREGAR'),
    ('6A', 'RADITYA GANTARA KURNIAWAN'),
    ('6A', 'PUTRA NANDA BALARAMA')
)
INSERT INTO agenda.siswa_kelas (siswa_id, academic_year_id, kelas_id, status)
SELECT
    s.id,
    ay.id,
    k.id,
    'AKTIF'
FROM daftar d
JOIN agenda.siswa s    ON s.nama_siswa = trim(d.nama)
JOIN agenda.kelas k    ON k.label = d.label
CROSS JOIN agenda.academic_year ay
WHERE ay.status = 'ACTIVE'
  AND NOT EXISTS (
      SELECT 1 FROM agenda.siswa_kelas sk
       WHERE sk.siswa_id = s.id
         AND sk.academic_year_id = ay.id
  );

-- =============================================================================
-- BAGIAN 3 — HASIL (satu query, karena editor hanya menampilkan yang terakhir)
-- =============================================================================
-- Baris 1 : ringkasan (jumlah siswa, penempatan, nama tahun ajaran aktif)
-- Baris 2 : judul kolom
-- Baris 3+: jumlah siswa PER KELAS pada tahun ajaran aktif

SELECT
    'RINGKASAN'::text AS "kelas",
    (
        'total siswa di master: ' || (SELECT count(*) FROM agenda.siswa)
        || '   |   penempatan tahun ini: ' || (
            SELECT count(*)
              FROM agenda.siswa_kelas sk
              JOIN agenda.academic_year ay ON ay.id = sk.academic_year_id
             WHERE ay.status = 'ACTIVE'
        )
        || '   |   tahun ajaran aktif: ' || COALESCE(
            (SELECT name FROM agenda.academic_year WHERE status = 'ACTIVE' LIMIT 1),
            'TIDAK ADA'
        )
    )::text AS "keterangan"

UNION ALL

SELECT 'kelas', 'jumlah siswa tahun ini'

UNION ALL

SELECT
    k.label,
    count(sk.id)::text
FROM agenda.kelas k
LEFT JOIN agenda.siswa_kelas sk ON sk.kelas_id = k.id
LEFT JOIN agenda.academic_year ay
       ON ay.id = sk.academic_year_id
      AND ay.status = 'ACTIVE'
WHERE k.label IN ('1A', '2A', '3A', '4A', '5A', '6A')
GROUP BY k.label
ORDER BY 1;

-- =============================================================================
-- BAGIAN 4 — (OPSIONAL) ALAT PERIKSA: siswa yang belum dapat kelas
-- =============================================================================
-- Jalankan HANYA bila BAGIAN 3 menunjukkan jumlah di bawah yang diharapkan.
-- Menampilkan nama yang ada di daftar tetapi belum punya penempatan di tahun
-- aktif — biasanya karena namanya sudah ada sebelumnya dengan ejaan berbeda.

-- SELECT s.nama_siswa, s.created_at
--   FROM agenda.siswa s
--  WHERE NOT EXISTS (
--        SELECT 1 FROM agenda.siswa_kelas sk
--         JOIN agenda.academic_year ay ON ay.id = sk.academic_year_id
--        WHERE sk.siswa_id = s.id AND ay.status = 'ACTIVE'
--  )
--  ORDER BY s.nama_siswa;
