-- ==============================================================================
-- STAGE 9.1 — FASE 2 HALAQOH: MAPEL BERKELOMPOK
-- Schema: agenda
-- Safe: idempotent, hanya menambah satu kolom pada agenda.mapel
--
-- Untuk apa
--   Fase 3 memunculkan pemilihan halaqoh di formulir jadwal. Pemicunya dipilih
--   pemilik produk: "DARI MASTER MAPEL", bukan dari nama mapel.
--
--   Alasannya: menebak dari nama ('Ummi') rapuh — sekali mapelnya diganti nama,
--   seluruh mekanisme halaqoh ikut mati tanpa error apa pun. Sebuah kolom di
--   master mapel membuat penandanya eksplisit, terlihat di UI, dan tidak bisa
--   berubah tanpa sengaja.
--
-- Kolom
--   `is_halaqoh` BOOLEAN NOT NULL DEFAULT false
--     true  -> mapel ini diajarkan berkelompok; baris jadwalnya WAJIB memilih
--              satu halaqoh, dan tiap halaqoh diampu guru berbeda.
--     false -> mapel biasa: satu baris jadwal berlaku untuk seluruh kelas.
--
--   Default `false` dipilih supaya mapel lama tidak berubah perilaku sama sekali.
--   Tidak ada backfill yang diperlukan.
--
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run.
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Kolom penanda
ALTER TABLE agenda.mapel
    ADD COLUMN IF NOT EXISTS is_halaqoh BOOLEAN NOT NULL DEFAULT false;

-- 2. Tandai mapel Ummi (kalau ada) sebagai berkelompok.
--    Dicocokkan ke nama yang mengandung 'ummi' (tanpa peduli huruf besar/kecil)
--    supaya 'Ummi', 'UMMI', dan 'Baca Ummi' sama-sama tertangkap sekali jalan.
--    Aman dijalankan ulang: sifatnya idempoten.
--
--    Kalau mapel Ummi belum ada di master, tidak ada yang terjadi di sini —
--    penandanya bisa dipasang belakangan dari halaman Mata Pelajaran.
UPDATE agenda.mapel
SET is_halaqoh = true
WHERE nama_mapel ILIKE '%ummi%';

-- 3. RLS
--    TIDAK ada perubahan policy. Kolom baru otomatis ikut policy agenda.mapel
--    yang sudah ada (member_read_mapel / admin_write_mapel) — policy Postgres
--    berlaku per baris, bukan per kolom.

-- 4. Verifikasi (jalankan terpisah — SATU query, editor hanya tampilkan terakhir)
-- SELECT
--     ('kolom ada: ' || (count(*) > 0)::text) AS ringkas,
--     ('mapel berkelompok: ' || count(*) FILTER (WHERE is_halaqoh)) AS detail
-- FROM information_schema.columns c, agenda.mapel m
-- WHERE c.table_schema = 'agenda' AND c.table_name = 'mapel' AND c.column_name = 'is_halaqoh';
