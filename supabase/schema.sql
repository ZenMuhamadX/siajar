-- =============================================================================
-- SIAJAR — SKEMA UTAMA / BOOTSTRAP INSTALASI BARU
-- =============================================================================
-- File ini adalah satu-satunya migration yang perlu dijalankan untuk instalasi
-- baru. Jalankan setelah membuat backup, lalu jalankan aplikasi.
--
-- Catatan:
-- - File ini HANYA membuat struktur: tabel, index, dan bucket Storage.
--   Tidak ada policy keamanan di sini.
-- - WAJIB dilanjutkan dengan supabase/stage_7_rls_auth.sql. File itulah yang
--   membuat RLS, policy otorisasi, grant, dan policy Storage.
-- - Selama stage_7 belum dijalankan, aplikasi tidak dapat mengakses data
--   (fail-closed). Ini disengaja: lebih baik gagal tertutup daripada terbuka.
-- - Struktur assignment menggunakan homeroom_assignment.
-- - File migration incremental tetap dipertahankan untuk database existing.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS agenda;

SET search_path TO agenda, public;

-- =============================================================================
-- 1. MASTER DATA
-- =============================================================================

CREATE TABLE IF NOT EXISTS agenda.siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_siswa TEXT NOT NULL,
    kelas TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.mapel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mapel TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 2. TAHUN AJARAN, JAM PELAJARAN, DAN JADWAL
-- =============================================================================

CREATE TABLE IF NOT EXISTS agenda.academic_year (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.period_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL
        REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 20),
    label TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_period_template_ay_number
        UNIQUE (academic_year_id, period_number),
    CONSTRAINT chk_period_template_time CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS agenda.schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL
        REFERENCES agenda.academic_year(id) ON DELETE RESTRICT,
    day TEXT NOT NULL
        CHECK (day IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY')),
    period_number INTEGER NOT NULL CHECK (period_number >= 1 AND period_number <= 20),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    class_id TEXT NOT NULL,
    subject_id UUID REFERENCES agenda.mapel(id) ON DELETE SET NULL,
    subject_name TEXT NOT NULL,
    teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    period_template_id UUID REFERENCES agenda.period_templates(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL DEFAULT 'KBM'
        CHECK (activity_type IN ('KBM', 'EXTRACURRICULAR', 'LIFESKILL', 'SPECIAL')),
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_schedule_time_range CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS agenda.homeroom_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL
        REFERENCES agenda.academic_year(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL,
    teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    teacher_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_homeroom_class_ay UNIQUE (academic_year_id, class_id)
);

-- =============================================================================
-- 3. AGENDA, ABSENSI, KEJADIAN, DAN KOTAK SARAN
-- =============================================================================

CREATE TABLE IF NOT EXISTS agenda.agenda_header (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sekolah TEXT DEFAULT 'SDIT AS-SYIFA',
    kelas TEXT NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    schedule_id UUID REFERENCES agenda.schedule(id) ON DELETE SET NULL,
    actual_teacher_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.agenda_kbm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    jam_ke TEXT NOT NULL,
    nama_guru TEXT NOT NULL,
    mapel TEXT NOT NULL,
    materi TEXT NOT NULL,
    tugas_pr TEXT,
    is_badal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.agenda_absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    siswa_id UUID REFERENCES agenda.siswa(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('S', 'I', 'A')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.agenda_kejadian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    uraian_kejadian TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda.kotak_saran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_guru TEXT NOT NULL,
    kategori TEXT NOT NULL
        CHECK (kategori IN ('Fasilitas', 'Kurikulum', 'Aplikasi', 'Lainnya')),
    isi_saran TEXT NOT NULL,
    is_anonim BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 4. BADAL DAN BUKTI FOTO
-- =============================================================================

CREATE TABLE IF NOT EXISTS agenda.substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES agenda.schedule(id) ON DELETE RESTRICT,
    substitution_date DATE NOT NULL,
    original_teacher_name TEXT NOT NULL,
    original_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    substitute_teacher_name TEXT NOT NULL,
    substitute_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    reason TEXT NOT NULL DEFAULT 'Guru berhalangan',
    reason_detail TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS agenda.agenda_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID NOT NULL REFERENCES agenda.agenda_header(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/webp',
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    actual_teacher_name TEXT,
    actual_teacher_id UUID REFERENCES agenda.guru(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_agenda_evidence UNIQUE (agenda_id)
);

-- =============================================================================
-- 5. INDEX
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_siswa_kelas
    ON agenda.siswa(kelas);

CREATE INDEX IF NOT EXISTS idx_mapel_nama
    ON agenda.mapel(nama_mapel);

CREATE INDEX IF NOT EXISTS idx_academic_year_status
    ON agenda.academic_year(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_academic_year
    ON agenda.academic_year(status)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_period_templates_ay
    ON agenda.period_templates(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_period_templates_active
    ON agenda.period_templates(academic_year_id, is_active);

CREATE INDEX IF NOT EXISTS idx_schedule_academic_year
    ON agenda.schedule(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_schedule_day
    ON agenda.schedule(day);

CREATE INDEX IF NOT EXISTS idx_schedule_teacher
    ON agenda.schedule(teacher_name);

CREATE INDEX IF NOT EXISTS idx_schedule_teacher_id
    ON agenda.schedule(teacher_id);

CREATE INDEX IF NOT EXISTS idx_schedule_class
    ON agenda.schedule(class_id);

CREATE INDEX IF NOT EXISTS idx_schedule_status
    ON agenda.schedule(status);

CREATE INDEX IF NOT EXISTS idx_schedule_composite_conflict
    ON agenda.schedule(academic_year_id, day, status);

CREATE INDEX IF NOT EXISTS idx_schedule_period_template
    ON agenda.schedule(period_template_id);

CREATE INDEX IF NOT EXISTS idx_homeroom_ay_class
    ON agenda.homeroom_assignment(academic_year_id, class_id);

CREATE INDEX IF NOT EXISTS idx_homeroom_teacher
    ON agenda.homeroom_assignment(teacher_id, teacher_name);

CREATE INDEX IF NOT EXISTS idx_agenda_header_kelas_tgl
    ON agenda.agenda_header(kelas, tanggal);

CREATE INDEX IF NOT EXISTS idx_agenda_header_schedule_id
    ON agenda.agenda_header(schedule_id);

CREATE INDEX IF NOT EXISTS idx_agenda_header_schedule_date
    ON agenda.agenda_header(schedule_id, tanggal);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_schedule_date
    ON agenda.agenda_header(schedule_id, tanggal)
    WHERE schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_kbm_agenda
    ON agenda.agenda_kbm(agenda_id);

CREATE INDEX IF NOT EXISTS idx_agenda_kbm_guru
    ON agenda.agenda_kbm(nama_guru);

CREATE INDEX IF NOT EXISTS idx_agenda_absensi_agenda
    ON agenda.agenda_absensi(agenda_id);

CREATE INDEX IF NOT EXISTS idx_agenda_absensi_siswa
    ON agenda.agenda_absensi(siswa_id);

CREATE INDEX IF NOT EXISTS idx_substitution_unique_active
    ON agenda.substitutions(schedule_id, substitution_date)
    WHERE cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_substitutions_date
    ON agenda.substitutions(substitution_date);

CREATE INDEX IF NOT EXISTS idx_substitutions_schedule
    ON agenda.substitutions(schedule_id);

CREATE INDEX IF NOT EXISTS idx_substitutions_substitute
    ON agenda.substitutions(substitute_teacher_name);

CREATE INDEX IF NOT EXISTS idx_substitutions_original
    ON agenda.substitutions(original_teacher_name);

CREATE INDEX IF NOT EXISTS idx_agenda_evidence_agenda
    ON agenda.agenda_evidence(agenda_id);

CREATE INDEX IF NOT EXISTS idx_agenda_evidence_actual_teacher
    ON agenda.agenda_evidence(actual_teacher_name);

CREATE INDEX IF NOT EXISTS idx_agenda_evidence_captured_at
    ON agenda.agenda_evidence(captured_at);

CREATE INDEX IF NOT EXISTS idx_agenda_evidence_uploaded_at
    ON agenda.agenda_evidence(uploaded_at);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- RLS diaktifkan di sini agar setiap tabel gagal-tertutup (deny all) sampai
-- policy dibuat. Policy otorisasi TIDAK didefinisikan di file ini.
-- Jalankan supabase/stage_7_rls_auth.sql setelah file ini untuk membuat:
--   - fungsi helper (agenda.is_admin, agenda.is_member, agenda.can_manage_*)
--   - seluruh policy baca/tulis berbasis auth.jwt()
--   - grant untuk role authenticated dan grant kolom untuk halaman login
--   - policy Storage bucket agenda-evidence
-- =============================================================================

ALTER TABLE agenda.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.guru ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.mapel ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.academic_year ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.period_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.homeroom_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kbm ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_kejadian ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.kotak_saran ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda.agenda_evidence ENABLE ROW LEVEL SECURITY;

-- Policy otorisasi sengaja TIDAK dibuat di sini.
-- Lihat bagian 6 di supabase/stage_7_rls_auth.sql — file itu wajib dijalankan
-- dan berisi seluruh policy baca/tulis berbasis auth.jwt().

-- =============================================================================
-- 7. GRANT
-- =============================================================================
-- Grant sengaja TIDAK dibuat di sini. Tanpa grant, role anon/authenticated
-- tidak bisa menyentuh schema agenda sama sekali (fail-closed).
-- Grant yang benar ada di bagian 4 supabase/stage_7_rls_auth.sql:
--   - authenticated : ALL (dibatasi policy RLS)
--   - anon          : hanya kolom guru(id, nama_guru) untuk halaman login
-- =============================================================================

-- =============================================================================
-- 8. SUPABASE STORAGE — BUKTI FOTO
-- =============================================================================
-- Bucket tetap private. File ini hanya membuat bucket-nya.
-- Policy akses bucket ada di bagian 5 supabase/stage_7_rls_auth.sql dan hanya
-- mengizinkan anggota sekolah yang sudah login.

DO $$
BEGIN
    IF to_regclass('storage.buckets') IS NULL THEN
        RAISE NOTICE 'storage.buckets tidak tersedia; setup Storage dilewati.';
    ELSE
        INSERT INTO storage.buckets (
            id,
            name,
            public,
            file_size_limit,
            allowed_mime_types
        )
        VALUES (
            'agenda-evidence',
            'agenda-evidence',
            false,
            10485760,
            ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 10485760,
            allowed_mime_types = ARRAY[
                'image/webp', 'image/jpeg', 'image/png', 'image/jpg'
            ];
    END IF;
END $$;

-- Policy Storage sengaja TIDAK dibuat di sini.
-- Lihat bagian 5 di supabase/stage_7_rls_auth.sql — hanya anggota sekolah yang
-- sudah login yang boleh membaca/mengunggah/menghapus bukti foto.

-- =============================================================================
-- 9. VERIFIKASI RINGKAS
-- =============================================================================
-- Jalankan query berikut setelah schema.sql DAN stage_7_rls_auth.sql selesai:
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'agenda'
-- ORDER BY table_name;
--
-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE schemaname = 'agenda'
-- ORDER BY tablename, policyname;
--
-- Pastikan tabel legacy tidak dibuat oleh bootstrap ini.
-- =============================================================================
