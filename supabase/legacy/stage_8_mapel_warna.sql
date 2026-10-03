-- ==============================================================================
-- STAGE 8 MIGRATION: WARNA MATA PELAJARAN
-- Schema: agenda
-- Safe: idempotent, hanya menambah satu kolom nullable pada agenda.mapel
--
-- Untuk fitur "warna latar unik per mata pelajaran pada export Excel".
-- Warna disimpan sebagai atribut mapel (bukan di app_settings) karena warna
-- adalah properti entitas mapel, sejajar dengan nama_mapel: ikut saat mapel
-- dihapus, dan otomatis terbaca oleh semua guru dari master data yang sama.
--
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run.
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Kolom warna
--
-- NULL atau string kosong berarti "belum diatur" -> aplikasi memakai palet
-- bawaan secara otomatis (deterministik dari id mapel). Jadi tidak ada baris
-- lama yang perlu di-backfill, dan export tetap terwarnai tanpa setup apa pun.
ALTER TABLE agenda.mapel
    ADD COLUMN IF NOT EXISTS warna TEXT;

-- 2. Validasi di sisi database
--
-- Mengikuti gaya chk_app_settings_colors: kalau diisi, wajib 6 digit hex tanpa
-- '#' (contoh: FBDDDD). Nilai rusak tidak akan pernah berhasil disimpan.
ALTER TABLE agenda.mapel
    DROP CONSTRAINT IF EXISTS chk_mapel_warna;
ALTER TABLE agenda.mapel
    ADD CONSTRAINT chk_mapel_warna CHECK (
        warna IS NULL
        OR warna = ''
        OR warna ~ '^[0-9A-Fa-f]{6}$'
    );

-- 3. RLS
--
-- TIDAK ada perubahan policy. Kolom baru otomatis ikut pada policy yang sudah
-- ada di agenda.mapel (member_read_mapel untuk SELECT, admin_write_mapel untuk
-- INSERT/UPDATE/DELETE) — policy Postgres berlaku per baris, bukan per kolom.

-- 4. Verifikasi (opsional, jalankan terpisah)
-- SELECT id, nama_mapel, warna FROM agenda.mapel ORDER BY nama_mapel;
