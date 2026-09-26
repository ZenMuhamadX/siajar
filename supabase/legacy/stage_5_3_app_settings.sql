-- ==============================================================================
-- STAGE 5.3 MIGRATION: APP SETTINGS (PENGATURAN SISTEM)
-- Schema: agenda
-- Safe: idempotent, tabel singleton (1 baris), tidak menyentuh tabel lain
--
-- Untuk Stage 5.3 "fungsikan Pengaturan + kustomisasi tampilan Excel".
-- Satu tabel, satu baris: semua komputer membaca baris yang sama, jadi mengubah
-- gaya export di satu komputer langsung berlaku di komputer lain.
--
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run.
-- ==============================================================================

SET search_path TO agenda, public;

-- 1. Tabel app_settings
CREATE TABLE IF NOT EXISTS agenda.app_settings (
    -- Singleton: hanya boleh ada satu baris (id = 1).
    id SMALLINT PRIMARY KEY DEFAULT 1,
    CONSTRAINT chk_app_settings_singleton CHECK (id = 1),

    -- Identitas sekolah (satu field, dipakai di seluruh aplikasi)
    school_name TEXT NOT NULL DEFAULT 'SDIT AS-SYIFA',

    -- Gaya export Excel
    excel_font_family       TEXT    NOT NULL DEFAULT 'Bookman Old Style',
    excel_base_font_size    SMALLINT NOT NULL DEFAULT 11,
    excel_title_font_size   SMALLINT NOT NULL DEFAULT 20,
    excel_orientation       TEXT    NOT NULL DEFAULT 'landscape',
    excel_header_color      TEXT    NOT NULL DEFAULT '1F3864',
    excel_band_color        TEXT    NOT NULL DEFAULT 'D9E2F3',
    excel_title_color       TEXT    NOT NULL DEFAULT '1F3864',
    excel_border_color      TEXT    NOT NULL DEFAULT '9CA3AF',
    excel_show_borders      BOOLEAN NOT NULL DEFAULT true,
    excel_show_teacher_name BOOLEAN NOT NULL DEFAULT true,
    excel_time_separator    TEXT    NOT NULL DEFAULT 'en-dash',
    excel_include_draft     BOOLEAN NOT NULL DEFAULT true,
    excel_repeat_header     BOOLEAN NOT NULL DEFAULT true,
    excel_fit_to_width      BOOLEAN NOT NULL DEFAULT true,

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by TEXT,

    -- Validasi di sisi database: data rusak tidak akan pernah berhasil disimpan.
    CONSTRAINT chk_app_settings_orientation CHECK (
        excel_orientation IN ('landscape', 'portrait')
    ),
    CONSTRAINT chk_app_settings_separator CHECK (
        excel_time_separator IN ('en-dash', 'hyphen')
    ),
    CONSTRAINT chk_app_settings_font_size CHECK (
        excel_base_font_size BETWEEN 6 AND 24
        AND excel_title_font_size BETWEEN 10 AND 40
    ),
    -- Warna WAJIB 6 digit hex tanpa '#', contoh: 1F3864
    CONSTRAINT chk_app_settings_colors CHECK (
        excel_header_color ~ '^[0-9A-Fa-f]{6}$'
        AND excel_band_color   ~ '^[0-9A-Fa-f]{6}$'
        AND excel_title_color  ~ '^[0-9A-Fa-f]{6}$'
        AND excel_border_color ~ '^[0-9A-Fa-f]{6}$'
    )
);

-- 2. Baris singleton (aman dijalankan berkali-kali)
INSERT INTO agenda.app_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS
--
-- CATATAN PENTING: policy di bawah BUKAN kontrol akses.
-- Aplikasi ini tidak memakai Supabase Auth sama sekali: src/lib/supabase.ts hanya
-- membuat client dengan anon key, sedangkan "sesi admin" hanyalah flag di
-- localStorage + PIN yang diverifikasi di dalam browser. Karena tidak ada JWT,
-- database tidak punya cara membedakan admin dari pengunjung. Policy ini
-- karena itu sama longgarnya dengan tabel lain di repo ini (period_templates,
-- schedule, agenda_header, ...).
--
-- Mengubah nama sekolah atau warna export bukan data sensitif, jadi risikonya
-- rendah.
-- Catatan: mengganti "nama sekolah" bisa mengubah kop surat resmi yang sudah
-- tercetak. Karena itu kolom `updated_by` + `updated_at` ikut disimpan, agar
-- selalu ada jejak siapa yang mengubah dan kapan.
--
-- Opsi ketat (hanya aktif setelah aplikasi memakai Supabase Auth sungguhan):
--   DROP POLICY IF EXISTS "Allow public read-write app_settings" ON agenda.app_settings;
--   CREATE POLICY "app_settings_read"  ON agenda.app_settings FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "app_settings_write" ON agenda.app_settings FOR ALL    TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE agenda.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-write app_settings" ON agenda.app_settings;
CREATE POLICY "Allow public read-write app_settings"
ON agenda.app_settings FOR ALL USING (true) WITH CHECK (true);

-- 4. Grant
GRANT ALL ON agenda.app_settings TO anon, authenticated;

-- 5. Verifikasi (opsional, jalankan terpisah)
-- SELECT * FROM agenda.app_settings;
